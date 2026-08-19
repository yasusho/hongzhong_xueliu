/**
 * 紅中血流成河麻雀 - コア麻雀エンジン & ゲーム進行 (MahjongEngine, GameFlow, GameState, MahjongAI, CONFIG)
 */

const CONFIG = {
    SUITS: { W: '万', T: '筒', B: '条', HZ: '中' },
    PHASES: { INIT: 'INIT', SWAP3: 'SWAP3', DINGQUE: 'DINGQUE', PLAYING: 'PLAYING', END: 'END' },
    BASE_SCORE: 100, INITIAL_SCORE: 5000, TOTAL_PLAYERS: 4, HAND_SIZE: 13, GANG_SCORE: 200, HUA_ZHU_PENALTY: 1600,
    DELAYS: { AI_TURN: 100, AUTO_ACTION: 100 }
};

const SUIT_PREFIX = { W: 'wan', T: 'tong', B: 'tiao' };
const SUIT_ORDER = { W: 1, T: 2, B: 3, HZ: 4 };

// --- 麻雀計算エンジン ---
class MahjongEngine {
    static tileToSvgPath = t => !t ? '' : (t.suit === 'HZ' ? 'assets/tiles/zhong.svg' : `assets/tiles/${SUIT_PREFIX[t.suit]}_${t.num}.svg`);
    static tileToString = t => !t ? '' : (t.suit === 'HZ' ? '红中' : `${t.num}${CONFIG.SUITS[t.suit] || t.suit}`);

    static createDeck() {
        let id = 0;
        return [
            ...['W', 'T', 'B'].flatMap(s => Array.from({ length: 36 }, (_, i) => ({ id: id++, suit: s, num: Math.floor(i / 4) + 1, code: `${Math.floor(i / 4) + 1}${s}` }))),
            ...Array.from({ length: 4 }, () => ({ id: id++, suit: 'HZ', num: 0, code: 'HZ' }))
        ];
    }

    static shuffle(arr, prng = null) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = prng ? prng.nextInt(0, i) : Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    static sortHand = (hand, que = null) => hand.sort((a, b) => ((a.suit === que) - (b.suit === que)) || (SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]) || (a.num - b.num));

    static getCounts(tiles) {
        return tiles.reduce((acc, t) => {
            if (t.suit === 'HZ') acc.hzCount++;
            else if (acc.counts[t.suit]) acc.counts[t.suit][t.num]++;
            return acc;
        }, { counts: { W: Array(10).fill(0), T: Array(10).fill(0), B: Array(10).fill(0) }, hzCount: 0 });
    }

    static countGen(p, extra = null) {
        const all = [...p.hand, ...(extra && p.hand.length % 3 !== 2 ? [extra] : []), ...p.melds.flatMap(m => Array(m.type === 'PUNG' ? 3 : 4).fill(m.tile))].filter(t => t.suit !== 'HZ');
        const freq = all.reduce((acc, t) => ((acc[t.code] = (acc[t.code] || 0) + 1), acc), {});
        return Object.values(freq).filter(c => c === 4).length;
    }

    static checkQiDui(counts, hz) {
        let pairs = 0, singles = 0;
        ['W', 'T', 'B'].forEach(s => {
            for (let n = 1; n <= 9; n++) {
                pairs += Math.floor(counts[s][n] / 2);
                if (counts[s][n] % 2 === 1) singles++;
            }
        });
        return (pairs + Math.min(singles, hz) + Math.floor(Math.max(0, hz - singles) / 2)) >= 7;
    }

    static checkDuiDuiHu(counts, wilds) {
        const suits = ['W', 'T', 'B'];
        for (const s of suits) {
            for (let n = 1; n <= 9; n++) {
                let need = 0;
                for (const cs of suits) {
                    for (let cn = 1; cn <= 9; cn++) {
                        const cnt = counts[cs][cn];
                        need += (cs === s && cn === n) ? Math.max(0, 2 - cnt) : (cnt % 3 !== 0 ? (3 - (cnt % 3)) : 0);
                    }
                }
                if (need <= wilds && (wilds - need) % 3 === 0) return true;
            }
        }
        return false;
    }

    static checkCanHu(player, extra = null) {
        const hand = [...player.hand, ...(extra && player.hand.length % 3 !== 2 ? [extra] : [])];
        if (hand.length % 3 !== 2 || hand.some(t => t.suit === player.que)) return false;
        const { counts, hzCount } = this.getCounts(hand);
        return (hand.length === 14 && !player.melds.length && this.checkQiDui(counts, hzCount)) || this.checkStandardWin(counts, hzCount);
    }

    static checkStandardWin(counts, wilds) {
        for (const s of ['W', 'T', 'B']) {
            for (let n = 1; n <= 9; n++) {
                const c = counts[s][n];
                if (c >= 2 && (counts[s][n] -= 2, this.canFormAllMelds(counts, wilds) ? ((counts[s][n] += 2), true) : ((counts[s][n] += 2), false))) return true;
                if (c >= 1 && wilds >= 1 && (counts[s][n] -= 1, this.canFormAllMelds(counts, wilds - 1) ? ((counts[s][n] += 1), true) : ((counts[s][n] += 1), false))) return true;
            }
        }
        return wilds >= 2 && this.canFormAllMelds(counts, wilds - 2);
    }

    static canFormAllMelds(counts, wilds) {
        const need = ['W', 'T', 'B'].reduce((sum, s) => sum + this.minWildsForSuit([...counts[s]]), 0);
        return need <= wilds && (wilds - need) % 3 === 0;
    }

    static minWildsForSuit(arr, idx = 1) {
        while (idx <= 9 && !arr[idx]) idx++;
        if (idx > 9) return 0;
        let res = 99;
        if (arr[idx] >= 3) {
            arr[idx] -= 3; res = Math.min(res, this.minWildsForSuit(arr, idx)); arr[idx] += 3;
        } else {
            const orig = arr[idx]; arr[idx] = 0;
            res = Math.min(res, (3 - orig) + this.minWildsForSuit(arr, idx + 1));
            arr[idx] = orig;
        }
        if (idx <= 7) {
            const [w1, w2] = [arr[idx + 1] ? 0 : 1, arr[idx + 2] ? 0 : 1];
            arr[idx]--; if (!w1) arr[idx + 1]--; if (!w2) arr[idx + 2]--;
            res = Math.min(res, w1 + w2 + this.minWildsForSuit(arr, idx));
            arr[idx]++; if (!w1) arr[idx + 1]++; if (!w2) arr[idx + 2]++;
        }
        return res;
    }

    static checkCanGang(p) {
        const counts = p.hand.filter(t => t.suit !== 'HZ').reduce((acc, t) => ((acc[t.code] = (acc[t.code] || 0) + 1), acc), {});
        const an = Object.keys(counts).filter(k => counts[k] === 4).map(code => ({ type: 'AN_GANG', tile: p.hand.find(t => t.code === code) }));
        const jia = p.melds.filter(m => m.type === 'PUNG').map(m => ({ type: 'JIA_GANG', tile: p.hand.find(t => t.code === m.tile.code), meld: m })).filter(x => Boolean(x.tile));
        return [...an, ...jia];
    }

    static checkCanPungOrGang(p, tile, type) {
        if (!p || !tile?.suit || tile.suit === 'HZ' || tile.suit === p.que) return false;
        return p.hand.filter(t => t?.code === tile.code).length >= (type === 'PUNG' ? 2 : 3);
    }

    static calculateFan(p, lastTile, isZiMo, fromPlayer = null, gState = {}) {
        const hand = [...p.hand, ...(!isZiMo || p.hand.length % 3 !== 2 ? [lastTile] : [])];
        const suits = new Set([...hand.filter(t => t.suit !== 'HZ').map(t => t.suit), ...p.melds.filter(m => m.tile.suit !== 'HZ').map(m => m.tile.suit)]);
        const { counts, hzCount } = this.getCounts(hand);

        const isQiDui = (hand.length === 14 && !p.melds.length && this.checkQiDui(counts, hzCount));
        const isJinGouDiao = (p.melds.length === 4);
        const isDuiDuiHu = !isQiDui && this.checkDuiDuiHu(counts, hzCount);
        const genCount = this.countGen(p, lastTile);

        const yaku = [
            { cond: isQiDui, fan: 2, name: '七对' },
            { cond: isDuiDuiHu, fan: 1, name: '对对胡' },
            { cond: isJinGouDiao, fan: 1, name: '金钩钓' },
            { cond: suits.size === 1, fan: 2, name: '清一色' },
            { cond: genCount > 0, fan: genCount, name: `${genCount}根` },
            { cond: Boolean(isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === p.id), fan: 1, name: '杠上花' },
            { cond: Boolean(!isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === fromPlayer), fan: 1, name: '杠上炮' },
            { cond: isZiMo, fan: 1, name: '自摸' }
        ].filter(r => r.cond);

        const totalFan = yaku.reduce((sum, r) => sum + r.fan, 0);
        const names = yaku.map(r => r.name);
        if (!isQiDui && !isDuiDuiHu && !isJinGouDiao) names.unshift('平胡');

        return { fan: totalFan, name: names.join(' ') };
    }

    static getTingTiles(p) {
        if (!p?.hand || p.hand.some(t => t.suit === p.que)) return [];
        const baseHand = p.hand.length % 3 === 2 ? p.hand.slice(0, -1) : [...p.hand];
        if (baseHand.length % 3 !== 1) return [];

        const testP = { ...p, hand: baseHand };
        const cands = ['W', 'T', 'B'].filter(s => s !== p.que).flatMap(s => Array.from({ length: 9 }, (_, i) => ({ suit: s, num: i + 1, code: `${i + 1}${s}` })));
        cands.push({ suit: 'HZ', num: 0, code: 'HZ' });
        return cands.filter(t => this.checkCanHu(testP, t));
    }
}

// --- AI思考 ---
class MahjongAI {
    static getSwapTiles(hand) {
        const nonHz = hand.filter(t => t.suit !== 'HZ');
        const counts = nonHz.reduce((acc, t) => ((acc[t.suit] = (acc[t.suit] || 0) + 1), acc), { W: 0, T: 0, B: 0 });
        return [...nonHz].sort((a, b) => (counts[a.suit] - counts[b.suit]) || (this.evalIso(nonHz, b) - this.evalIso(nonHz, a)) || (a.num - b.num)).slice(0, 3);
    }

    static getDingQue(hand) {
        const counts = hand.reduce((acc, t) => ((acc[t.suit] = (acc[t.suit] || 0) + 1), acc), { W: 0, T: 0, B: 0 });
        return ['W', 'T', 'B'].reduce((min, s) => counts[s] < counts[min] ? s : min, 'W');
    }

    static chooseDiscardIndex(p) {
        return p.hand.map((t, idx) => ({
            idx,
            prio: t.suit === p.que ? (1000 - Math.min(t.num - 1, 9 - t.num)) : (t.suit === 'HZ' ? -1000 : this.evalIso(p.hand, t))
        })).sort((a, b) => b.prio - a.prio)[0]?.idx || 0;
    }

    static evalIso(hand, tile) {
        const diffs = hand.filter(t => t.id !== tile.id && t.suit === tile.suit).map(t => Math.abs(t.num - tile.num));
        return 100 - (diffs.includes(0) ? 40 : 0) - (diffs.includes(1) ? 30 : 0) - (diffs.includes(2) ? 15 : 0) + ([1, 9].includes(tile.num) ? 10 : ([2, 8].includes(tile.num) ? 5 : 0));
    }

    static shouldPung(p, t) {
        if (t.suit === p.que || t.suit === 'HZ' || p.hand.some(x => x.suit === p.que)) return false;
        const counts = p.hand.filter(x => x.suit !== 'HZ').reduce((acc, x) => ((acc[x.code] = (acc[x.code] || 0) + 1), acc), {});
        return Object.values(counts).filter(c => c >= 2).length >= 2;
    }

    static shouldGang = (p, t) => t.suit !== p.que && t.suit !== 'HZ' && !p.hand.some(x => x.suit === p.que);
}

// --- 進行・精算 & 状態管理 ---
class GameFlow {
    static executeSwap(state, onComplete) {
        if (!state.players.every(p => p.swapTiles?.length === 3)) return false;
        state.players.forEach(p => p.swapTiles.forEach(t => {
            const idx = p.hand.findIndex(x => (x.id != null && t.id != null ? x.id === t.id : x.code === t.code));
            if (idx > -1) p.hand.splice(idx, 1);
        }));
        const swapped = state.players.map(p => [...p.swapTiles]);
        state.players.forEach((p, i) => state.players[(i + 1) % CONFIG.TOTAL_PLAYERS].hand.push(...swapped[i]));
        state.sortAllHands();
        onComplete?.();
        return true;
    }

    static checkDingQueComplete = state => state.players.every(p => Boolean(p.que));

    static calculateEndSettlement(state, engine) {
        const logs = [], isHZ = p => p.hand.some(t => t.suit === p.que);
        const [hz, nonHz] = [state.players.filter(isHZ), state.players.filter(p => !isHZ(p))];
        hz.forEach(hp => nonHz.forEach(np => {
            state.transferScore(hp.id, np.id, CONFIG.HUA_ZHU_PENALTY);
            logs.push(`查花猪: ${hp.name} 赔付 ${np.name} ${CONFIG.HUA_ZHU_PENALTY}分`);
        }));

        const ev = state.players.filter(p => !p.isHu && !isHZ(p)).map(p => ({ p, ting: engine.getTingTiles(p) }));
        const [ting, noting] = [ev.filter(x => x.ting.length > 0), ev.filter(x => !x.ting.length)];
        noting.forEach(({ p: np }) => ting.forEach(({ p: tp, ting: tList }) => {
            const maxFan = Math.max(...tList.map(t => engine.calculateFan(tp, t, false).fan), 0);
            const penalty = CONFIG.BASE_SCORE * Math.pow(2, maxFan);
            state.transferScore(np.id, tp.id, penalty);
            logs.push(`查大叫: ${np.name} 赔付 ${tp.name} ${penalty}分 (${maxFan}番)`);
        }));
        return logs;
    }
}

class GameState {
    constructor() { this.reset(); }
    reset() {
        Object.assign(this, {
            phase: CONFIG.PHASES.INIT, gameSeed: null, wall: null, wallCount: 112, currentTurn: 0, startPlayer: 0, lastDiscard: null, autoPlay: false,
            selectedSwapIndices: [], lastActionIsGang: false, lastGangPlayer: null, logs: ['系统就绪。'],
            players: Array.from({ length: CONFIG.TOTAL_PLAYERS }, (_, i) => ({
                id: i, name: `${i + 1}P`, hand: [], melds: [], discards: [], que: null, score: CONFIG.INITIAL_SCORE, isHu: false, huRecords: [], swapTiles: []
            }))
        });
    }
    get remainingWall() { return this.wall ? this.wall.length : (this.wallCount ?? 112); }
    transferScore(from, to, amount) {
        if (this.players[from] && this.players[to]) {
            this.players[from].score -= amount;
            this.players[to].score += amount;
        }
    }
    sortAllHands() { this.players.forEach(p => MahjongEngine.sortHand(p.hand, p.que)); }
    isGameOver() { return this.remainingWall === 0 || this.players.some(p => p.score <= 0); }
}

const gameState = new GameState();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, MahjongEngine, MahjongAI, GameFlow, GameState, gameState };
}
