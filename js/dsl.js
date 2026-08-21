/**
 * 紅中血流成河麻雀 - 決定論的DSLインタプリタ & VM (Deterministic Game DSL)
 */
class DeterministicPRNG {
    constructor(seed = 12345678) {
        this.s = (seed >>> 0) || 12345678;
    }

    nextUint32() {
        let t = (this.s += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    }

    nextFloat = () => this.nextUint32() / 4294967296;
    nextInt = (min, max) => (min > max ? max : min) + (this.nextUint32() % (Math.abs(max - min) + 1));
    clone() {
        const c = new DeterministicPRNG(0);
        c.s = this.s;
        return c;
    }
}

class DeterministicVM {
    static execute(initialState, script, ctx) {
        const state = JSON.parse(JSON.stringify(initialState));
        const uiEvents = [];
        const triggeredSequences = [];
        try {
            if (!Array.isArray(script?.instructions)) {
                throw new Error('Invalid Script AST: instructions must be an array');
            }
            this.executeBlock(script.instructions, state, ctx, uiEvents, triggeredSequences);
            return { ok: true, value: { nextState: state, uiEvents, triggeredSequences } };
        } catch (err) {
            return { ok: false, error: err?.message || String(err) };
        }
    }

    static executeBlock(instructions, state, ctx, uiEvents, triggers) {
        const handlers = {
            SET_STATE: i => this.setPath(state, i.path, this.evalExpr(i.value, state, ctx)),
            MODIFY_NUMERIC: i => this.setPath(state, i.path, (this.getPath(state, i.path) ?? 0) + this.evalExpr(i.delta, state, ctx)),
            VAR_ASSIGN: i => ctx.variables.set(i.name, this.evalExpr(i.value, state, ctx)),
            IF: i => {
                const branch = this.evalExpr(i.condition, state, ctx) ? i.then : i.else;
                if (branch) this.executeBlock(branch, state, ctx, uiEvents, triggers);
            },
            REPEAT: i => {
                const count = this.evalExpr(i.count, state, ctx) || 0;
                for (let k = 0; k < count; k++) this.executeBlock(i.body, state, ctx, uiEvents, triggers);
            },
            ROLL_DICE: i => {
                const count = this.evalExpr(i.count, state, ctx) || 1;
                const sides = this.evalExpr(i.sides, state, ctx) || 6;
                ctx.variables.set(i.targetVar, Array.from({ length: count }, () => ctx.prng.nextInt(1, sides)));
            },
            SHUFFLE_LIST: i => {
                const list = this.getPath(state, i.path);
                if (Array.isArray(list)) {
                    for (let k = list.length - 1; k > 0; k--) {
                        const j = ctx.prng.nextInt(0, k);
                        [list[k], list[j]] = [list[j], list[k]];
                    }
                }
            },
            TRANSFER_SCORE: i => {
                const from = this.evalExpr(i.fromPlayer, state, ctx);
                const to = this.evalExpr(i.toPlayer, state, ctx);
                const amt = this.evalExpr(i.amount, state, ctx);
                if (state.players?.[from] && state.players?.[to]) {
                    state.players[from].score -= amt;
                    state.players[to].score += amt;
                }
            },
            DISPATCH_TRIGGER: i => {
                triggers.push({
                    triggerId: i.triggerId,
                    payload: Object.fromEntries(Object.entries(i.payload || {}).map(([k, v]) => [k, this.evalExpr(v, state, ctx)]))
                });
            },
            EMIT_UI_EVENT: i => {
                uiEvents.push({
                    sequenceId: ctx.sequenceId,
                    eventType: i.eventType,
                    payload: Object.fromEntries(Object.entries(i.payload || {}).map(([k, v]) => [k, this.evalExpr(v, state, ctx)]))
                });
            }
        };

        instructions.forEach(inst => handlers[inst.type]?.(inst));
    }

    static evalExpr(expr, state, ctx) {
        if (expr == null || typeof expr !== 'object') return expr;
        const handlers = {
            LITERAL: e => e.value,
            VAR: e => ctx.variables.get(e.name) ?? null,
            STATE_GET: e => this.getPath(state, e.path),
            RANDOM_INT: e => ctx.prng.nextInt(this.evalExpr(e.min, state, ctx) || 0, this.evalExpr(e.max, state, ctx) || 100),
            BINARY_OP: e => {
                const [l, r] = [this.evalExpr(e.left, state, ctx), this.evalExpr(e.right, state, ctx)];
                const ops = {
                    '+': l + r, '-': l - r, '*': l * r, '/': Math.floor(l / r), '%': l % r,
                    '==': l === r, '!=': l !== r, '<': l < r, '<=': l <= r, '>': l > r, '>=': l >= r
                };
                return ops[e.op] ?? null;
            },
            LOGICAL_OP: e => {
                const ops = {
                    NOT: () => !this.evalExpr(e.args[0], state, ctx),
                    AND: () => e.args.every(a => Boolean(this.evalExpr(a, state, ctx))),
                    OR: () => e.args.some(a => Boolean(this.evalExpr(a, state, ctx)))
                };
                return ops[e.op]?.() ?? false;
            }
        };
        return handlers[expr.type] ? handlers[expr.type](expr) : expr;
    }

    static getPath(obj, path) {
        if (!Array.isArray(path)) return undefined;
        return path.reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
    }

    static setPath(obj, path, val) {
        if (!Array.isArray(path) || path.length === 0) return;
        path.slice(0, -1).reduce((cur, key) => (cur[key] = (cur[key] && typeof cur[key] === 'object') ? cur[key] : {}), obj)[path[path.length - 1]] = val;
    }
}

class TriggerResolutionEngine {
    constructor() {
        this.scriptRegistry = new Map();
    }

    registerScript = (id, script) => this.scriptRegistry.set(id, script);

    executeAction(initialState, initialScript, baseContext) {
        let currentState = initialState;
        let seq = 0;
        const prng = new DeterministicPRNG(baseContext.baseSeed || 12345678);
        const allEvents = [];
        const queue = [{ script: initialScript, actorId: baseContext.actorId || '0', variables: new Map() }];

        while (queue.length > 0) {
            const task = queue.shift();
            seq++;
            const context = {
                actionId: `${baseContext.actionId || 'act'}#${seq}`,
                actorId: task.actorId,
                sequenceId: seq,
                prng,
                variables: task.variables
            };
            const result = DeterministicVM.execute(currentState, task.script, context);
            if (!result.ok) throw new Error(`DSL Failure at seq ${seq}: ${result.error}`);

            currentState = result.value.nextState;
            allEvents.push(...result.value.uiEvents);
            result.value.triggeredSequences.forEach(trig => {
                const s = this.scriptRegistry.get(trig.triggerId);
                if (s) queue.push({ script: s, actorId: task.actorId, variables: new Map(Object.entries(trig.payload)) });
            });
        }
        return { finalState: currentState, allEvents, finalHash: this.computeStateHash(currentState) };
    }

    computeStateHash(state) {
        const json = JSON.stringify(state, Object.keys(state).sort());
        let hash = 0x811c9dc5;
        for (let i = 0; i < json.length; i++) {
            hash ^= json.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}


