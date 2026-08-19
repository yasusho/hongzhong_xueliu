/**
 * 紅中血流成河麻雀 - 決定論的DSLインタプリタ & VM (Deterministic Game DSL)
 */
class DeterministicPRNG {
    constructor(seed = 12345678) {
        this.s = seed >>> 0;
    }

    nextUint32() {
        let t = (this.s += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    }

    nextFloat() {
        return this.nextUint32() / 4294967296;
    }

    nextInt(min, max) {
        if (min > max) [min, max] = [max, min];
        return min + (this.nextUint32() % (max - min + 1));
    }

    clone() {
        const copy = new DeterministicPRNG(0);
        copy.s = this.s;
        return copy;
    }
}

class DeterministicVM {
    static execute(initialState, script, context) {
        const state = JSON.parse(JSON.stringify(initialState));
        const uiEvents = [];
        const triggeredSequences = [];

        try {
            if (!script || !Array.isArray(script.instructions)) {
                throw new Error('Invalid Script AST: instructions array missing');
            }
            this.executeBlock(script.instructions, state, context, uiEvents, triggeredSequences);
            return { ok: true, value: { nextState: state, uiEvents, triggeredSequences } };
        } catch (err) {
            return { ok: false, error: err && err.message ? err.message : String(err) };
        }
    }

    static executeBlock(instructions, state, ctx, uiEvents, triggers) {
        for (const inst of instructions) {
            switch (inst.type) {
                case 'SET_STATE':
                    this.setNestedPath(state, inst.path, this.evalExpr(inst.value, state, ctx));
                    break;
                case 'MODIFY_NUMERIC': {
                    const delta = this.evalExpr(inst.delta, state, ctx);
                    const current = this.getNestedPath(state, inst.path) ?? 0;
                    this.setNestedPath(state, inst.path, current + delta);
                    break;
                }
                case 'VAR_ASSIGN':
                    ctx.variables.set(inst.name, this.evalExpr(inst.value, state, ctx));
                    break;
                case 'IF':
                    if (Boolean(this.evalExpr(inst.condition, state, ctx))) {
                        this.executeBlock(inst.then, state, ctx, uiEvents, triggers);
                    } else if (inst.else) {
                        this.executeBlock(inst.else, state, ctx, uiEvents, triggers);
                    }
                    break;
                case 'REPEAT': {
                    const count = this.evalExpr(inst.count, state, ctx) || 0;
                    for (let i = 0; i < count; i++) this.executeBlock(inst.body, state, ctx, uiEvents, triggers);
                    break;
                }
                case 'ROLL_DICE': {
                    const count = this.evalExpr(inst.count, state, ctx) || 1;
                    const sides = this.evalExpr(inst.sides, state, ctx) || 6;
                    const rolls = Array.from({ length: count }, () => ctx.prng.nextInt(1, sides));
                    ctx.variables.set(inst.targetVar, rolls);
                    break;
                }
                case 'SHUFFLE_LIST': {
                    const list = this.getNestedPath(state, inst.path);
                    if (Array.isArray(list)) {
                        for (let i = list.length - 1; i > 0; i--) {
                            const j = ctx.prng.nextInt(0, i);
                            [list[i], list[j]] = [list[j], list[i]];
                        }
                    }
                    break;
                }
                case 'TRANSFER_SCORE': {
                    const fromIdx = this.evalExpr(inst.fromPlayer, state, ctx);
                    const toIdx = this.evalExpr(inst.toPlayer, state, ctx);
                    const amount = this.evalExpr(inst.amount, state, ctx);
                    if (state.players && state.players[fromIdx] && state.players[toIdx]) {
                        state.players[fromIdx].score -= amount;
                        state.players[toIdx].score += amount;
                    }
                    break;
                }
                case 'DISPATCH_TRIGGER': {
                    const payload = {};
                    if (inst.payload) {
                        for (const [k, vExpr] of Object.entries(inst.payload)) payload[k] = this.evalExpr(vExpr, state, ctx);
                    }
                    triggers.push({ triggerId: inst.triggerId, payload });
                    break;
                }
                case 'EMIT_UI_EVENT': {
                    const payload = {};
                    if (inst.payload) {
                        for (const [k, vExpr] of Object.entries(inst.payload)) payload[k] = this.evalExpr(vExpr, state, ctx);
                    }
                    uiEvents.push({ sequenceId: ctx.sequenceId, eventType: inst.eventType, payload });
                    break;
                }
            }
        }
    }

    static evalExpr(expr, state, ctx) {
        if (expr === null || expr === undefined || typeof expr !== 'object') return expr;

        switch (expr.type) {
            case 'LITERAL': return expr.value;
            case 'VAR': return ctx.variables.get(expr.name) ?? null;
            case 'STATE_GET': return this.getNestedPath(state, expr.path);
            case 'RANDOM_INT': {
                const min = this.evalExpr(expr.min, state, ctx) || 0;
                const max = this.evalExpr(expr.max, state, ctx) || 100;
                return ctx.prng.nextInt(min, max);
            }
            case 'BINARY_OP': {
                const l = this.evalExpr(expr.left, state, ctx);
                const r = this.evalExpr(expr.right, state, ctx);
                const ops = {
                    '+': l + r, '-': l - r, '*': l * r, '/': Math.floor(l / r), '%': l % r,
                    '==': l === r, '!=': l !== r, '<': l < r, '<=': l <= r, '>': l > r, '>=': l >= r
                };
                return ops[expr.op] ?? null;
            }
            case 'LOGICAL_OP':
                if (expr.op === 'NOT') return !this.evalExpr(expr.args[0], state, ctx);
                if (expr.op === 'AND') return expr.args.every(a => Boolean(this.evalExpr(a, state, ctx)));
                if (expr.op === 'OR') return expr.args.some(a => Boolean(this.evalExpr(a, state, ctx)));
                return false;
            default: return expr;
        }
    }

    static getNestedPath(obj, path) {
        if (!path || !Array.isArray(path)) return undefined;
        return path.reduce((curr, key) => (curr != null ? curr[key] : undefined), obj);
    }

    static setNestedPath(obj, path, value) {
        if (!path || !Array.isArray(path) || path.length === 0) return;
        let curr = obj;
        for (let i = 0; i < path.length - 1; i++) {
            const key = path[i];
            if (!(key in curr) || typeof curr[key] !== 'object' || curr[key] === null) curr[key] = {};
            curr = curr[key];
        }
        curr[path[path.length - 1]] = value;
    }
}

class TriggerResolutionEngine {
    constructor() {
        this.scriptRegistry = new Map();
    }

    registerScript(id, script) {
        this.scriptRegistry.set(id, script);
    }

    executeAction(initialState, initialScript, baseContext) {
        let currentState = initialState;
        const prng = new DeterministicPRNG(baseContext.baseSeed || 12345678);
        let sequenceCounter = 0;
        const allEvents = [];
        const queue = [{ script: initialScript, actorId: baseContext.actorId || '0', variables: new Map() }];

        while (queue.length > 0) {
            const task = queue.shift();
            sequenceCounter++;

            const context = {
                actionId: `${baseContext.actionId || 'act'}#${sequenceCounter}`,
                actorId: task.actorId,
                sequenceId: sequenceCounter,
                prng,
                variables: task.variables
            };

            const result = DeterministicVM.execute(currentState, task.script, context);
            if (!result.ok) throw new Error(`DSL Failure at seq ${sequenceCounter}: ${result.error}`);

            currentState = result.value.nextState;
            allEvents.push(...result.value.uiEvents);

            for (const trigger of result.value.triggeredSequences) {
                const script = this.scriptRegistry.get(trigger.triggerId);
                if (script) queue.push({ script, actorId: task.actorId, variables: new Map(Object.entries(trigger.payload)) });
            }
        }

        return { finalState: currentState, allEvents, finalHash: this.computeStateHash(currentState) };
    }

    computeStateHash(state) {
        const canonicalJson = JSON.stringify(state, Object.keys(state).sort());
        let hash = 0x811c9dc5;
        for (let i = 0; i < canonicalJson.length; i++) {
            hash ^= canonicalJson.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeterministicPRNG, DeterministicVM, TriggerResolutionEngine };
}
