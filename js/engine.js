const CONFIG = {
    SUITS: { W: '万', T: '筒', B: '条', HZ: '中' },
    PHASES: { INIT: 'INIT', SWAP3: 'SWAP3', DINGQUE: 'DINGQUE', PLAYING: 'PLAYING', END: 'END' },
    BASE_SCORE: 100, INITIAL_SCORE: 5000, TOTAL_PLAYERS: 4, HAND_SIZE: 13,
    GANG_SCORES: { AN_GANG: 200, JIA_GANG: 100, DIRECT_GANG: 200 },
    HUA_ZHU_PENALTY: 1600, DELAYS: { AI_TURN: 50, AUTO_ACTION: 50 }
};

const SUIT_PREFIX = { W: 'wan', T: 'tong', B: 'tiao' };
const SUIT_ORDER = { W: 1, T: 2, B: 3, HZ: 4 };

class MahjongEngine {
    static tileToSvgPath(tile) {
        if (!tile) return '';
        return tile.suit === 'HZ' ? 'assets/tiles/zhong.svg' : `assets/tiles/${SUIT_PREFIX[tile.suit]}_${tile.num}.svg`;
    }

    static tileToString(tile) {
        if (!tile) return '';
        return tile.suit === 'HZ' ? '红中' : `${tile.num}${CONFIG.SUITS[tile.suit] || tile.suit}`;
    }

    static createDeck() {
        let id = 0;
        const tiles = ['W', 'T', 'B'].flatMap(suit =>
            Array.from({ length: 36 }, (_, i) => ({ id: id++, suit, num: Math.floor(i / 4) + 1, code: `${Math.floor(i / 4) + 1}${suit}` }))
        );
        return [...tiles, ...Array.from({ length: 4 }, () => ({ id: id++, suit: 'HZ', num: 0, code: 'HZ' }))];
    }

    static shuffle(deck, prng = null) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const r = prng ? prng.nextInt(0, i) : Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[r]] = [shuffled[r], shuffled[i]];
        }
        return shuffled;
    }

    static sortHand(hand, queSuit = null) {
        if (!Array.isArray(hand)) return [];
        const sorted = [...hand].sort((a, b) =>
            ((a.suit === queSuit ? 1 : 0) - (b.suit === queSuit ? 1 : 0)) ||
            ((SUIT_ORDER[a.suit] || 99) - (SUIT_ORDER[b.suit] || 99)) ||
            (a.num - b.num)
        );
        for (let i = 0; i < hand.length; i++) hand[i] = sorted[i];
        return sorted;
    }

    static getCounts(tiles) {
        const counts = { W: Array(10).fill(0), T: Array(10).fill(0), B: Array(10).fill(0) };
        let hzCount = 0;
        for (const t of tiles) {
            if (t.suit === 'HZ') hzCount++;
            else if (counts[t.suit]?.[t.num] !== undefined) counts[t.suit][t.num]++;
        }
        return { counts, hzCount };
    }

    static countGen(player, extraTile = null) {
        const extra = (extraTile && player.hand.length % 3 !== 2) ? [extraTile] : [];
        const meldTiles = player.melds.flatMap(m => Array(m.type === 'PUNG' ? 3 : 4).fill(m.tile));
        const freqs = [...player.hand, ...extra, ...meldTiles].filter(t => t.suit !== 'HZ')
            .reduce((acc, t) => { acc[t.code] = (acc[t.code] || 0) + 1; return acc; }, {});
        return Object.values(freqs).filter(c => c === 4).length;
    }

    static checkQiDui(counts, wildCount) {
        let pairs = 0, singles = 0;
        for (const s of ['W', 'T', 'B']) {
            for (let n = 1; n <= 9; n++) {
                pairs += Math.floor(counts[s][n] / 2);
                singles += (counts[s][n] % 2);
            }
        }
        const used = Math.min(singles, wildCount);
        return (pairs + used + Math.floor((wildCount - used) / 2)) >= 7;
    }

    static checkDuiDuiHu(counts, wildCount) {
        const needTriplets = (exS = null, exN = null) => {
            let n = 0;
            for (const s of ['W', 'T', 'B']) {
                for (let num = 1; num <= 9; num++) {
                    if (s === exS && num === exN) continue;
                    const c = counts[s][num];
                    if (c > 0 && c % 3 !== 0) n += (3 - (c % 3));
                }
            }
            return n;
        };

        for (const s of ['W', 'T', 'B']) {
            for (let num = 1; num <= 9; num++) {
                const c = counts[s][num];
                if (c === 0) continue;
                const headNeed = c >= 2 ? ((c - 2) % 3 !== 0 ? (3 - ((c - 2) % 3)) : 0) : 1;
                const total = headNeed + needTriplets(s, num);
                if (total <= wildCount && (wildCount - total) % 3 === 0) return true;
            }
        }
        const wildNeed = needTriplets();
        return wildCount >= 2 && wildNeed <= (wildCount - 2) && ((wildCount - 2) - wildNeed) % 3 === 0;
    }

    static checkCanHu(player, extraTile = null) {
        const extra = (extraTile && player.hand.length % 3 !== 2) ? [extraTile] : [];
        const fullHand = [...player.hand, ...extra];
        if (fullHand.length % 3 !== 2 || fullHand.some(t => t.suit === player.que)) return false;

        const { counts, hzCount } = this.getCounts(fullHand);
        if (fullHand.length === 14 && player.melds.length === 0 && this.checkQiDui(counts, hzCount)) return true;
        return this.checkStandardWin(counts, hzCount);
    }

    static checkStandardWin(counts, wildCount) {
        const hc = { W: [...counts.W], T: [...counts.T], B: [...counts.B] };
        for (const s of ['W', 'T', 'B']) {
            for (let n = 1; n <= 9; n++) {
                if (hc[s][n] >= 2) {
                    hc[s][n] -= 2;
                    const win = this.canFormAllMelds(hc, wildCount);
                    hc[s][n] += 2;
                    if (win) return true;
                }
                if (hc[s][n] >= 1 && wildCount >= 1) {
                    hc[s][n] -= 1;
                    const win = this.canFormAllMelds(hc, wildCount - 1);
                    hc[s][n] += 1;
                    if (win) return true;
                }
            }
        }
        return wildCount >= 2 && this.canFormAllMelds(hc, wildCount - 2);
    }

    static canFormAllMelds(counts, wildCount) {
        const needed = ['W', 'T', 'B'].reduce((sum, s) => sum + this.minWildsForSuit([...counts[s]]), 0);
        return needed <= wildCount && (wildCount - needed) % 3 === 0;
    }

    static minWildsForSuit(arr) {
        let start = 1;
        while (start <= 9 && !arr[start]) start++;
        if (start > 9) return 0;

        let minCost = 99;
        const branch = (reductions, cost) => {
            reductions.forEach(([o, q]) => { arr[start + o] -= q; });
            minCost = Math.min(minCost, cost + this.minWildsForSuit(arr));
            reductions.forEach(([o, q]) => { arr[start + o] += q; });
        };

        if (arr[start] >= 3) branch([[0, 3]], 0);
        if (arr[start] >= 2) branch([[0, 2]], 1);
        if (arr[start] >= 1) branch([[0, 1]], 2);
        if (start <= 7 && arr[start] >= 1 && arr[start + 1] >= 1 && arr[start + 2] >= 1) branch([[0, 1], [1, 1], [2, 1]], 0);
        if (start <= 8 && arr[start] >= 1 && arr[start + 1] >= 1) branch([[0, 1], [1, 1]], 1);
        if (start <= 7 && arr[start] >= 1 && arr[start + 2] >= 1) branch([[0, 1], [2, 1]], 1);
        return minCost;
    }

    static checkCanGang(player) {
        if (!player?.hand) return [];
        const freqs = player.hand.filter(t => t.suit !== 'HZ').reduce((acc, t) => { acc[t.code] = (acc[t.code] || 0) + 1; return acc; }, {});
        const anGangs = Object.keys(freqs).filter(c => freqs[c] === 4).map(c => ({ type: 'AN_GANG', tile: player.hand.find(t => t.code === c) }));
        const jiaGangs = (player.melds || []).filter(m => m.type === 'PUNG')
            .map(m => ({ type: 'JIA_GANG', tile: player.hand.find(t => t.code === m.tile.code), meld: m })).filter(item => Boolean(item.tile));
        return [...anGangs, ...jiaGangs];
    }

    static checkCanPungOrGang(player, tile, type) {
        if (!player || !tile?.suit || tile.suit === 'HZ' || tile.suit === player.que) return false;
        return player.hand.filter(t => t?.code === tile.code).length >= (type === 'GANG' ? 3 : 2);
    }

    static calculateFan(player, lastTile, isZiMo, fromPlayer = null, gState = {}) {
        const extra = (!isZiMo || player.hand.length % 3 !== 2) ? [lastTile] : [];
        const full = [...player.hand, ...extra];
        const suits = new Set([...full.filter(t => t.suit !== 'HZ').map(t => t.suit), ...player.melds.filter(m => m.tile.suit !== 'HZ').map(m => m.tile.suit)]);
        const { counts, hzCount } = this.getCounts(full);

        const isQiDui = (full.length === 14 && player.melds.length === 0 && this.checkQiDui(counts, hzCount));
        const isJinGouDiao = (player.melds.length === 4);
        const isDuiDuiHu = !isQiDui && this.checkDuiDuiHu(counts, hzCount);
        const gen = this.countGen(player, lastTile);

        const rules = [
            { c: isQiDui, f: 2, n: '七对' }, { c: isDuiDuiHu, f: 1, n: '对对胡' }, { c: isJinGouDiao, f: 1, n: '金钩钓' },
            { c: suits.size === 1, f: 2, n: '清一色' }, { c: gen > 0, f: gen, n: `${gen}根` },
            { c: Boolean(isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === player.id), f: 1, n: '杠上花' },
            { c: Boolean(!isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === fromPlayer), f: 1, n: '杠上炮' },
            { c: Boolean(isZiMo), f: 1, n: '自摸' }
        ];

        const matched = rules.filter(r => r.c);
        const totalFan = matched.reduce((s, r) => s + r.f, 0);
        const names = matched.map(r => r.n);
        if (!isQiDui && !isDuiDuiHu && !isJinGouDiao) names.unshift('平胡');
        return { fan: totalFan, name: names.join(' ') };
    }

    static getTingTiles(player) {
        if (!player?.hand?.length || player.hand.some(t => t.suit === player.que)) return [];
        const candidates = ['W', 'T', 'B'].filter(s => s !== player.que)
            .flatMap(s => Array.from({ length: 9 }, (_, i) => ({ suit: s, num: i + 1, code: `${i + 1}${s}` })))
            .concat([{ suit: 'HZ', num: 0, code: 'HZ' }]);

        if (player.hand.length % 3 === 1) return candidates.filter(t => this.checkCanHu(player, t));

        if (player.hand.length % 3 === 2) {
            const baseHand = player.hand.slice(0, -1);
            const tingLast = candidates.filter(t => this.checkCanHu({ ...player, hand: baseHand }, t));
            if (tingLast.length > 0) return tingLast;

            const tings = new Map();
            for (let i = 0; i < player.hand.length; i++) {
                if (player.hand.some(t => t.suit === player.que) && player.hand[i].suit !== player.que) continue;
                const testHand = player.hand.filter((_, idx) => idx !== i);
                candidates.filter(t => this.checkCanHu({ ...player, hand: testHand }, t)).forEach(t => tings.set(t.code, t));
            }
            return Array.from(tings.values());
        }
        return [];
    }
}

class MahjongAI {
    static getSwapTiles(hand) {
        const nonHz = hand.filter(t => t.suit !== 'HZ');
        const counts = nonHz.reduce((acc, t) => { acc[t.suit] = (acc[t.suit] || 0) + 1; return acc; }, { W: 0, T: 0, B: 0 });
        return [...nonHz].sort((a, b) =>
            (counts[a.suit] - counts[b.suit]) || (this.evalIso(nonHz, b) - this.evalIso(nonHz, a)) || (a.num - b.num)
        ).slice(0, 3);
    }

    static getDingQue(hand) {
        const counts = hand.reduce((acc, t) => { acc[t.suit] = (acc[t.suit] || 0) + 1; return acc; }, { W: 0, T: 0, B: 0 });
        return ['W', 'T', 'B'].reduce((min, s) => counts[s] < counts[min] ? s : min, 'W');
    }

    static evalIso(hand, tile) {
        const diffs = hand.filter(t => t.id !== tile.id && t.suit === tile.suit).map(t => Math.abs(t.num - tile.num));
        const weights = [40, 30, 15];
        const penalty = [0, 1, 2].reduce((sum, d, i) => sum + (diffs.includes(d) ? weights[i] : 0), 0);
        const bonus = { 1: 10, 9: 10, 2: 5, 8: 5 }[tile.num] || 0;
        return 100 - penalty + bonus;
    }

    static chooseDiscardIndex(player) {
        const scores = player.hand.map((tile, idx) => {
            if (tile.suit === player.que) return { idx, prio: 1000 - Math.min(tile.num - 1, 9 - tile.num) };
            if (tile.suit === 'HZ') return { idx, prio: -1000 };
            return { idx, prio: this.evalIso(player.hand, tile) };
        }).sort((a, b) => b.prio - a.prio);
        return scores[0]?.idx || 0;
    }

    static shouldPung(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ' || player.hand.some(t => t.suit === player.que)) return false;
        const freqs = player.hand.filter(t => t.suit !== 'HZ').reduce((acc, t) => { acc[t.code] = (acc[t.code] || 0) + 1; return acc; }, {});
        return Object.values(freqs).filter(c => c >= 2).length >= 2;
    }

    static shouldGang(player, tile) {
        return tile.suit !== player.que && tile.suit !== 'HZ' && !player.hand.some(t => t.suit === player.que);
    }
}

class DeterministicPRNG {
    constructor(seed = 12345678) { this.s = (seed >>> 0) || 12345678; }
    nextUint32() {
        let t = (this.s += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    }
    nextInt(min, max) {
        const span = Math.abs(max - min) + 1;
        return (min > max ? max : min) + (this.nextUint32() % span);
    }
}

class GameState {
    constructor() { this.reset(); }
    reset() {
        Object.assign(this, {
            phase: CONFIG.PHASES.INIT, gameSeed: null, wall: null, wallCount: 112, currentTurn: 0, startPlayer: 0,
            lastDiscard: null, autoPlay: false, autoQue: false, selectedSwapIndices: [], lastActionIsGang: false,
            lastGangPlayer: null, logs: ['系统就绪。'],
            players: Array.from({ length: CONFIG.TOTAL_PLAYERS }, (_, i) => ({
                id: i, name: `${i + 1}P`, hand: [], melds: [], discards: [], que: null,
                score: CONFIG.INITIAL_SCORE, isHu: false, isEliminated: false, huRecords: [], swapTiles: []
            }))
        });
    }
    get remainingWall() { return this.wall ? this.wall.length : (this.wallCount ?? 112); }

    transferScore(fromIdx, toIdx, amount) {
        const f = this.players[fromIdx], t = this.players[toIdx];
        if (!f || !t || (f.isEliminated && f.score <= 0)) return 0;
        const actual = Math.min(amount, Math.max(0, f.score));
        f.score -= amount;
        t.score += amount;
        if (f.score <= 0) f.isEliminated = true;
        return actual;
    }

    sortAllHands() { this.players.forEach(p => MahjongEngine.sortHand(p.hand, p.que)); }
    isGameOver() { return this.remainingWall === 0 || this.players.filter(p => !p.isEliminated && p.score > 0).length <= 1; }
}

const gameState = new GameState();

class GameDSL {
    static initGame(state, seed, engine) {
        state.reset();
        const prng = new DeterministicPRNG(seed);
        state.gameSeed = seed;
        state.startPlayer = state.currentTurn = prng.nextInt(0, CONFIG.TOTAL_PLAYERS - 1);
        state.phase = CONFIG.PHASES.SWAP3;

        const deck = engine.shuffle(engine.createDeck(), prng);
        const hands = Array.from({ length: CONFIG.TOTAL_PLAYERS }, () => []);
        let ptr = deck.length - 1;
        for (let r = 0; r < CONFIG.HAND_SIZE; r++) {
            for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) hands[p].push(deck[ptr--]);
        }
        hands[state.startPlayer].push(deck[ptr--]);

        state.players = state.players.map((p, i) => ({ ...p, hand: engine.sortHand(hands[i], p.que) }));
        state.wall = deck.slice(0, ptr + 1);
        state.wallCount = state.wall.length;

        return [{ type: 'LOG', text: `开局: ${state.players[state.startPlayer].name}起家` }, { type: 'UI_RENDER' }];
    }

    static executeSwap(state) {
        const packs = state.players.map(p => [...p.swapTiles]);
        state.players = state.players.map((p, i) => {
            const swapIds = new Set(p.swapTiles.map(t => t.id));
            const remaining = p.hand.filter(t => !swapIds.has(t.id));
            const received = packs[(i + CONFIG.TOTAL_PLAYERS - 1) % CONFIG.TOTAL_PLAYERS];
            return { ...p, hand: MahjongEngine.sortHand([...remaining, ...received], p.que) };
        });
        state.phase = CONFIG.PHASES.DINGQUE;
        state.selectedSwapIndices = [];
        return [{ type: 'LOG', text: '换三张完成' }, { type: 'UI_RENDER' }];
    }

    static confirmDingQue(state) {
        if (!state.players.every(p => Boolean(p.que))) return [];
        state.sortAllHands();
        state.phase = CONFIG.PHASES.PLAYING;
        const desc = state.players.map(p => `${p.name}缺${CONFIG.SUITS[p.que]}`).join(' ');
        return [{ type: 'LOG', text: `定缺: ${desc}` }, { type: 'UI_RENDER' }];
    }

    static drawTile(state, playerIndex, isRinshan = false) {
        if (!state.wall?.length) { state.phase = CONFIG.PHASES.END; return []; }
        const drawn = state.wall.pop();
        state.wallCount = state.wall.length;
        state.players[playerIndex].hand.push(drawn);
        if (!isRinshan) { state.lastActionIsGang = false; state.lastGangPlayer = null; }
        return [{ type: 'DRAW', playerIndex, tile: drawn, isRinshan }, { type: 'UI_RENDER' }];
    }

    static discardTile(state, playerIndex, tileIndex, engine) {
        const p = state.players[playerIndex];
        if (!p || p.hand.length % 3 !== 2) return [];
        const tile = p.hand.splice(tileIndex, 1)[0];
        if (!tile) return [];

        p.hand = engine.sortHand(p.hand, p.que);
        p.discards.push(tile);
        state.lastDiscard = { tile, playerIndex };
        state.lastActionIsGang = false;
        return [{ type: 'SOUND', sound: 'discard' }, { type: 'LOG', text: `${p.name} 打 ${engine.tileToString(tile)}` }, { type: 'UI_RENDER' }];
    }

    static executeHu(state, playerIndex, winningTile, isZiMo, fromPlayerIndex, engine) {
        const p = state.players[playerIndex];
        if (!p) return [];

        const fanInfo = engine.calculateFan(p, winningTile, isZiMo, fromPlayerIndex, state);
        const score = CONFIG.BASE_SCORE * Math.pow(2, fanInfo.fan);
        const yakuName = (fanInfo.name || '平胡').replace(/\s*自摸\b/, '').trim();

        p.isHu = true;
        p.huRecords.push({ fan: fanInfo.fan, fanName: fanInfo.name, score, isZiMo, tile: winningTile });
        state.lastActionIsGang = false;
        state.lastGangPlayer = null;

        if (isZiMo) {
            for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) { if (i !== playerIndex) state.transferScore(i, playerIndex, score); }
        } else {
            state.transferScore(fromPlayerIndex, playerIndex, score);
        }

        const events = [
            { type: 'SOUND_HU', playerIndex },
            { type: 'LOG', text: `★ ${p.name} ${isZiMo ? '自摸' : '点炮'} ${engine.tileToString(winningTile)} (${yakuName ? yakuName + ' ' : ''}${fanInfo.fan}番 ${score}分)` },
            { type: 'UI_RENDER' }
        ];
        this.checkEliminations(state, events);
        return events;
    }

    static executeMeld(state, playerIndex, meldType, tile, fromPlayerIndex, removeCount, scoreTransfer, isGang, engine) {
        const p = state.players[playerIndex];
        let rem = removeCount;
        p.hand = p.hand.filter(t => (t.code === tile.code && rem > 0) ? (rem--, false) : true);
        p.melds.push({ type: meldType, tile, from: fromPlayerIndex, isAnGang: false });

        const fromPlayer = state.players[fromPlayerIndex];
        if (fromPlayer?.discards?.length) {
            const idx = fromPlayer.discards.map(t => t.code).lastIndexOf(tile.code);
            if (idx > -1) fromPlayer.discards.splice(idx, 1);
        }
        state.lastDiscard = null;

        const events = [];
        if (scoreTransfer > 0) {
            state.transferScore(fromPlayerIndex, playerIndex, scoreTransfer);
            this.checkEliminations(state, events);
        }

        state.currentTurn = playerIndex;
        state.lastActionIsGang = isGang;
        state.lastGangPlayer = isGang ? playerIndex : null;

        events.push(
            { type: 'SOUND', sound: 'action' },
            { type: 'LOG', text: `${p.name} ${meldType === 'GANG' ? '明杠' : '碰'} ${engine.tileToString(tile)}` },
            { type: 'UI_RENDER' }
        );
        return events;
    }

    static executeSelfGang(state, playerIndex, option, engine) {
        const p = state.players[playerIndex];
        const tile = option.tile;
        const isJiaGang = (option.type === 'JIA_GANG');
        const events = [];

        if (isJiaGang) {
            const idx = p.hand.findIndex(t => t.code === tile.code);
            if (idx > -1) p.hand.splice(idx, 1);
            const m = p.melds.find(m => m.type === 'PUNG' && m.tile.code === tile.code);
            if (m) { m.type = 'GANG'; m.isAnGang = false; }
        } else {
            p.hand = p.hand.filter(t => t.code !== tile.code);
            p.melds.push({ type: 'GANG', tile, from: playerIndex, isAnGang: true });
        }

        const scorePerPlayer = isJiaGang ? (CONFIG.GANG_SCORES?.JIA_GANG || 100) : (CONFIG.GANG_SCORES?.AN_GANG || 200);
        events.push({ type: 'LOG', text: `${p.name} ${isJiaGang ? '补杠' : '暗杠'} ${engine.tileToString(tile)} (各家${scorePerPlayer}分)` });

        for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) {
            if (i !== playerIndex) state.transferScore(i, playerIndex, scorePerPlayer);
        }
        this.checkEliminations(state, events);

        state.lastActionIsGang = true;
        state.lastGangPlayer = playerIndex;
        events.push({ type: 'SOUND', sound: 'action' }, { type: 'UI_RENDER' });
        return events;
    }

    static calculateEndSettlement(state, engine) {
        const logs = [];
        const isHuaZhu = p => p.hand.some(t => t.suit === p.que);
        const huaZhu = state.players.filter(isHuaZhu);
        const nonHuaZhu = state.players.filter(p => !isHuaZhu(p));

        huaZhu.forEach(hp => {
            nonHuaZhu.forEach(np => {
                state.transferScore(hp.id, np.id, CONFIG.HUA_ZHU_PENALTY);
                logs.push(`查花猪: ${hp.name}→${np.name} ${CONFIG.HUA_ZHU_PENALTY}分`);
            });
        });

        const unHu = state.players.filter(p => !p.isHu && !isHuaZhu(p)).map(p => ({ p, tings: engine.getTingTiles(p) }));
        const tingPlayers = unHu.filter(x => x.tings.length > 0);
        const noTingPlayers = unHu.filter(x => x.tings.length === 0);

        noTingPlayers.forEach(({ p: np }) => {
            tingPlayers.forEach(({ p: tp, tings }) => {
                const maxFan = Math.max(...tings.map(t => engine.calculateFan(tp, t, false).fan), 0);
                const penalty = CONFIG.BASE_SCORE * Math.pow(2, maxFan);
                state.transferScore(np.id, tp.id, penalty);
                logs.push(`查大叫: ${np.name}→${tp.name} ${penalty}分(${maxFan}番)`);
            });
        });
        return logs;
    }

    static checkEliminations(state, events = []) {
        state.players.forEach(p => {
            if (p.score <= 0 && !p.isEliminated) {
                events.push({ type: 'LOG', text: `★ ${p.name} 脱落` });
                p.isEliminated = true;
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.SUIT_PREFIX = SUIT_PREFIX;
    window.SUIT_ORDER = SUIT_ORDER;
    window.MahjongEngine = MahjongEngine;
    window.MahjongAI = MahjongAI;
    window.DeterministicPRNG = DeterministicPRNG;
    window.GameState = GameState;
    window.gameState = gameState;
    window.GameDSL = GameDSL;
}
