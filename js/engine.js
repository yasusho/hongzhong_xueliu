/**
 * 紅中血流成河麻雀 - コア麻雀エンジン & ゲーム進行 (MahjongEngine, GameFlow, GameState, MahjongAI, CONFIG)
 */

const CONFIG = {
    SUITS: { W: '万', T: '筒', B: '条', HZ: '中' },
    PHASES: { INIT: 'INIT', SWAP3: 'SWAP3', DINGQUE: 'DINGQUE', PLAYING: 'PLAYING', END: 'END' },
    BASE_SCORE: 100,
    INITIAL_SCORE: 5000,
    TOTAL_PLAYERS: 4,
    HAND_SIZE: 13,
    GANG_SCORE: 200,
    HUA_ZHU_PENALTY: 1600,
    DELAYS: { AI_TURN: 100, AUTO_ACTION: 100 }
};

const SUIT_PREFIX = { W: 'wan', T: 'tong', B: 'tiao' };
const SUIT_ORDER = { W: 1, T: 2, B: 3, HZ: 4 };

// --- 麻雀計算エンジン ---
class MahjongEngine {
    static tileToSvgPath = t => {
        if (!t) return '';
        if (t.suit === 'HZ') return 'assets/tiles/zhong.svg';
        return `assets/tiles/${SUIT_PREFIX[t.suit]}_${t.num}.svg`;
    };

    static tileToString = t => {
        if (!t) return '';
        if (t.suit === 'HZ') return '红中';
        return `${t.num}${CONFIG.SUITS[t.suit] || t.suit}`;
    };

    static createDeck() {
        let id = 0;
        return [
            ...['W', 'T', 'B'].flatMap(s => Array.from({ length: 36 }, (_, i) => ({
                id: id++,
                suit: s,
                num: Math.floor(i / 4) + 1,
                code: `${Math.floor(i / 4) + 1}${s}`
            }))),
            ...Array.from({ length: 4 }, () => ({
                id: id++,
                suit: 'HZ',
                num: 0,
                code: 'HZ'
            }))
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

    static sortHand = (hand, que = null) => {
        return hand.sort((a, b) => {
            const queOrder = (a.suit === que) - (b.suit === que);
            if (queOrder !== 0) return queOrder;
            const suitDiff = (SUIT_ORDER[a.suit] || 99) - (SUIT_ORDER[b.suit] || 99);
            if (suitDiff !== 0) return suitDiff;
            return a.num - b.num;
        });
    };

    static getCounts(tiles) {
        return tiles.reduce((acc, t) => {
            if (t.suit === 'HZ') acc.hzCount++;
            else if (acc.counts[t.suit]) acc.counts[t.suit][t.num]++;
            return acc;
        }, { counts: { W: Array(10).fill(0), T: Array(10).fill(0), B: Array(10).fill(0) }, hzCount: 0 });
    }

    static countGen(player, extra = null) {
        const all = [
            ...player.hand,
            ...(extra && player.hand.length % 3 !== 2 ? [extra] : []),
            ...player.melds.flatMap(m => Array(m.type === 'PUNG' ? 3 : 4).fill(m.tile))
        ].filter(t => t.suit !== 'HZ');

        const freq = all.reduce((acc, t) => {
            acc[t.code] = (acc[t.code] || 0) + 1;
            return acc;
        }, {});
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
        // 1. 通常牌から雀頭を取るケース
        for (const s of suits) {
            for (let n = 1; n <= 9; n++) {
                const headCnt = counts[s][n];
                if (headCnt === 0) continue;

                let need = 0;
                if (headCnt >= 2) {
                    const rem = headCnt - 2;
                    need += (rem % 3 !== 0) ? (3 - (rem % 3)) : 0;
                } else if (headCnt === 1) {
                    need += 1;
                }

                for (const cs of suits) {
                    for (let cn = 1; cn <= 9; cn++) {
                        if (cs === s && cn === n) continue;
                        const c = counts[cs][cn];
                        if (c > 0) need += (c % 3 !== 0) ? (3 - (c % 3)) : 0;
                    }
                }
                if (need <= wilds && (wilds - need) % 3 === 0) return true;
            }
        }

        // 2. 紅中2枚で雀頭を作るケース
        if (wilds >= 2) {
            let need = 0;
            for (const cs of suits) {
                for (let cn = 1; cn <= 9; cn++) {
                    const c = counts[cs][cn];
                    if (c > 0) need += (c % 3 !== 0) ? (3 - (c % 3)) : 0;
                }
            }
            if (need <= (wilds - 2) && ((wilds - 2) - need) % 3 === 0) return true;
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
        // 雀頭を通常牌から取るケース
        for (const s of ['W', 'T', 'B']) {
            for (let n = 1; n <= 9; n++) {
                if (counts[s][n] >= 2) {
                    counts[s][n] -= 2;
                    const can = this.canFormAllMelds(counts, wilds);
                    counts[s][n] += 2;
                    if (can) return true;
                }
                if (counts[s][n] >= 1 && wilds >= 1) {
                    counts[s][n] -= 1;
                    const can = this.canFormAllMelds(counts, wilds - 1);
                    counts[s][n] += 1;
                    if (can) return true;
                }
            }
        }
        // 雀頭を紅中2枚から取るケース
        return wilds >= 2 && this.canFormAllMelds(counts, wilds - 2);
    }

    static canFormAllMelds(counts, wilds) {
        const need = ['W', 'T', 'B'].reduce((sum, s) => sum + this.minWildsForSuit([...counts[s]]), 0);
        return need <= wilds && (wilds - need) % 3 === 0;
    }

    static minWildsForSuit(arr, memo = new Map()) {
        let idx = 1;
        while (idx <= 9 && !arr[idx]) idx++;
        if (idx > 9) return 0;

        const key = arr.slice(1).join(',');
        if (memo.has(key)) return memo.get(key);

        let res = 99;

        // 1. 刻子を作る
        if (arr[idx] >= 3) {
            arr[idx] -= 3;
            res = Math.min(res, this.minWildsForSuit(arr, memo));
            arr[idx] += 3;
        }
        if (arr[idx] >= 2) {
            arr[idx] -= 2;
            res = Math.min(res, 1 + this.minWildsForSuit(arr, memo));
            arr[idx] += 2;
        }
        if (arr[idx] >= 1) {
            arr[idx] -= 1;
            res = Math.min(res, 2 + this.minWildsForSuit(arr, memo));
            arr[idx] += 1;
        }

        // 2. 順子を作る
        if (idx <= 7 && arr[idx] >= 1 && arr[idx + 1] >= 1 && arr[idx + 2] >= 1) {
            arr[idx]--; arr[idx + 1]--; arr[idx + 2]--;
            res = Math.min(res, this.minWildsForSuit(arr, memo));
            arr[idx]++; arr[idx + 1]++; arr[idx + 2]++;
        }
        if (idx <= 8 && arr[idx] >= 1 && arr[idx + 1] >= 1) {
            arr[idx]--; arr[idx + 1]--;
            res = Math.min(res, 1 + this.minWildsForSuit(arr, memo));
            arr[idx]++; arr[idx + 1]++;
        }
        if (idx <= 7 && arr[idx] >= 1 && arr[idx + 2] >= 1) {
            arr[idx]--; arr[idx + 2]--;
            res = Math.min(res, 1 + this.minWildsForSuit(arr, memo));
            arr[idx]++; arr[idx + 2]++;
        }

        memo.set(key, res);
        return res;
    }

    static checkCanGang(player) {
        const counts = player.hand.filter(t => t.suit !== 'HZ').reduce((acc, t) => {
            acc[t.code] = (acc[t.code] || 0) + 1;
            return acc;
        }, {});
        const an = Object.keys(counts).filter(k => counts[k] === 4).map(code => ({
            type: 'AN_GANG',
            tile: player.hand.find(t => t.code === code)
        }));
        const jia = player.melds.filter(m => m.type === 'PUNG').map(m => ({
            type: 'JIA_GANG',
            tile: player.hand.find(t => t.code === m.tile.code),
            meld: m
        })).filter(x => Boolean(x.tile));

        return [...an, ...jia];
    }

    static checkCanPungOrGang(player, tile, type) {
        if (!player || !tile?.suit || tile.suit === 'HZ' || tile.suit === player.que) return false;
        const matching = player.hand.filter(t => t?.code === tile.code).length;
        return matching >= (type === 'PUNG' ? 2 : 3);
    }

    static calculateFan(player, lastTile, isZiMo, fromPlayer = null, gState = {}) {
        const hand = [...player.hand, ...(!isZiMo || player.hand.length % 3 !== 2 ? [lastTile] : [])];
        const suits = new Set([
            ...hand.filter(t => t.suit !== 'HZ').map(t => t.suit),
            ...player.melds.filter(m => m.tile.suit !== 'HZ').map(m => m.tile.suit)
        ]);
        const { counts, hzCount } = this.getCounts(hand);

        const isQiDui = (hand.length === 14 && !player.melds.length && this.checkQiDui(counts, hzCount));
        const isJinGouDiao = (player.melds.length === 4);
        const isDuiDuiHu = !isQiDui && this.checkDuiDuiHu(counts, hzCount);
        const genCount = this.countGen(player, lastTile);

        const yaku = [
            { cond: isQiDui, fan: 2, name: '七对' },
            { cond: isDuiDuiHu, fan: 1, name: '对对胡' },
            { cond: isJinGouDiao, fan: 1, name: '金钩钓' },
            { cond: suits.size === 1, fan: 2, name: '清一色' },
            { cond: genCount > 0, fan: genCount, name: `${genCount}根` },
            { cond: Boolean(isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === player.id), fan: 1, name: '杠上花' },
            { cond: Boolean(!isZiMo && gState.lastActionIsGang && gState.lastGangPlayer === fromPlayer), fan: 1, name: '杠上炮' },
            { cond: isZiMo, fan: 1, name: '自摸' }
        ].filter(r => r.cond);

        const totalFan = yaku.reduce((sum, r) => sum + r.fan, 0);
        const names = yaku.map(r => r.name);
        if (!isQiDui && !isDuiDuiHu && !isJinGouDiao) names.unshift('平胡');

        return { fan: totalFan, name: names.join(' ') };
    }

    static getTingTiles(player) {
        if (!player?.hand || player.hand.length === 0 || player.hand.some(t => t.suit === player.que)) return [];
        const cands = ['W', 'T', 'B'].filter(s => s !== player.que).flatMap(s => Array.from({ length: 9 }, (_, i) => ({ suit: s, num: i + 1, code: `${i + 1}${s}` })));
        cands.push({ suit: 'HZ', num: 0, code: 'HZ' });

        if (player.hand.length % 3 === 1) {
            return cands.filter(t => this.checkCanHu(player, t));
        }

        if (player.hand.length % 3 === 2) {
            const baseHand = player.hand.slice(0, -1);
            const tingLast = cands.filter(t => this.checkCanHu({ ...player, hand: baseHand }, t));
            if (tingLast.length > 0) return tingLast;

            const allTings = new Map();
            for (let i = 0; i < player.hand.length; i++) {
                const cutTile = player.hand[i];
                if (player.hand.some(t => t.suit === player.que) && cutTile.suit !== player.que) continue;
                const testHand = player.hand.filter((_, idx) => idx !== i);
                const tings = cands.filter(t => this.checkCanHu({ ...player, hand: testHand }, t));
                tings.forEach(t => allTings.set(t.code, t));
            }
            return Array.from(allTings.values());
        }

        return [];
    }
}

// --- AI思考 ---
class MahjongAI {
    static getSwapTiles(hand) {
        const nonHz = hand.filter(t => t.suit !== 'HZ');
        const counts = nonHz.reduce((acc, t) => {
            acc[t.suit] = (acc[t.suit] || 0) + 1;
            return acc;
        }, { W: 0, T: 0, B: 0 });

        return [...nonHz].sort((a, b) => {
            const countDiff = counts[a.suit] - counts[b.suit];
            if (countDiff !== 0) return countDiff;
            const isoDiff = this.evalIso(nonHz, b) - this.evalIso(nonHz, a);
            if (isoDiff !== 0) return isoDiff;
            return a.num - b.num;
        }).slice(0, 3);
    }

    static getDingQue(hand) {
        const counts = hand.reduce((acc, t) => {
            acc[t.suit] = (acc[t.suit] || 0) + 1;
            return acc;
        }, { W: 0, T: 0, B: 0 });
        return ['W', 'T', 'B'].reduce((min, s) => counts[s] < counts[min] ? s : min, 'W');
    }

    static chooseDiscardIndex(player) {
        return player.hand.map((t, idx) => ({
            idx,
            prio: t.suit === player.que ? (1000 - Math.min(t.num - 1, 9 - t.num)) : (t.suit === 'HZ' ? -1000 : this.evalIso(player.hand, t))
        })).sort((a, b) => b.prio - a.prio)[0]?.idx || 0;
    }

    static evalIso(hand, tile) {
        const diffs = hand.filter(t => t.id !== tile.id && t.suit === tile.suit).map(t => Math.abs(t.num - tile.num));
        return 100 - (diffs.includes(0) ? 40 : 0) - (diffs.includes(1) ? 30 : 0) - (diffs.includes(2) ? 15 : 0) + ([1, 9].includes(tile.num) ? 10 : ([2, 8].includes(tile.num) ? 5 : 0));
    }

    static shouldPung(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ' || player.hand.some(x => x.suit === player.que)) return false;
        const counts = player.hand.filter(x => x.suit !== 'HZ').reduce((acc, x) => {
            acc[x.code] = (acc[x.code] || 0) + 1;
            return acc;
        }, {});
        return Object.values(counts).filter(c => c >= 2).length >= 2;
    }

    static shouldGang = (player, tile) => tile.suit !== player.que && tile.suit !== 'HZ' && !player.hand.some(x => x.suit === player.que);
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
        const logs = [];
        const isHZ = p => p.hand.some(t => t.suit === p.que);
        const [hz, nonHz] = [state.players.filter(isHZ), state.players.filter(p => !isHZ(p))];

        // 1. 査花猪
        hz.forEach(hp => nonHz.forEach(np => {
            state.transferScore(hp.id, np.id, CONFIG.HUA_ZHU_PENALTY);
            logs.push(`查花猪: ${hp.name} → ${np.name} ${CONFIG.HUA_ZHU_PENALTY}分`);
        }));

        // 2. 査大叫（査叫）
        const ev = state.players.filter(p => !p.isHu && !isHZ(p)).map(p => ({ p, ting: engine.getTingTiles(p) }));
        const [ting, noting] = [ev.filter(x => x.ting.length > 0), ev.filter(x => !x.ting.length)];
        noting.forEach(({ p: np }) => ting.forEach(({ p: tp, ting: tList }) => {
            const maxFan = Math.max(...tList.map(t => engine.calculateFan(tp, t, false).fan), 0);
            const penalty = CONFIG.BASE_SCORE * Math.pow(2, maxFan);
            state.transferScore(np.id, tp.id, penalty);
            logs.push(`查大叫: ${np.name} → ${tp.name} ${penalty}分 (${maxFan}番)`);
        }));

        return logs;
    }
}

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        Object.assign(this, {
            phase: CONFIG.PHASES.INIT,
            gameSeed: null,
            wall: null,
            wallCount: 112,
            currentTurn: 0,
            startPlayer: 0,
            lastDiscard: null,
            autoPlay: false,
            selectedSwapIndices: [],
            lastActionIsGang: false,
            lastGangPlayer: null,
            logs: ['系统就绪。'],
            players: Array.from({ length: CONFIG.TOTAL_PLAYERS }, (_, i) => ({
                id: i,
                name: `${i + 1}P`,
                hand: [],
                melds: [],
                discards: [],
                que: null,
                score: CONFIG.INITIAL_SCORE,
                isHu: false,
                huRecords: [],
                swapTiles: []
            }))
        });
    }

    get remainingWall() {
        return this.wall ? this.wall.length : (this.wallCount ?? 112);
    }

    transferScore(from, to, amount) {
        if (this.players[from] && this.players[to]) {
            this.players[from].score -= amount;
            this.players[to].score += amount;
        }
    }

    sortAllHands() {
        this.players.forEach(p => MahjongEngine.sortHand(p.hand, p.que));
    }

    isGameOver() {
        return this.remainingWall === 0 || this.players.some(p => p.score <= 0);
    }
}

const gameState = new GameState();

// Universal Global / Module Export
if (typeof globalThis !== 'undefined') {
    globalThis.CONFIG = CONFIG;
    globalThis.SUIT_PREFIX = SUIT_PREFIX;
    globalThis.SUIT_ORDER = SUIT_ORDER;
    globalThis.MahjongEngine = MahjongEngine;
    globalThis.MahjongAI = MahjongAI;
    globalThis.GameFlow = GameFlow;
    globalThis.GameState = GameState;
    globalThis.gameState = gameState;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, SUIT_PREFIX, SUIT_ORDER, MahjongEngine, MahjongAI, GameFlow, GameState, gameState };
}
