/**
 * 紅中血流成河麻雀 - 麻雀エンジン (MahjongEngine)
 */
const _ENG_CFG = (typeof CONFIG !== 'undefined') ? CONFIG : ((typeof require !== 'undefined') ? require('./config.js') : {});

class MahjongEngine {
    static tileToUnicode(tile) {
        if (!tile) return '';
        if (tile.suit === 'HZ') return '🀄\uFE0E';
        return String.fromCodePoint(_ENG_CFG.UNICODE_BASE[tile.suit] + tile.num) + '\uFE0E';
    }

    static tileToSvgPath(tile) {
        if (!tile) return '';
        if (tile.suit === 'HZ') return 'assets/tiles/zhong.svg';
        const prefix = { W: 'wan', T: 'tong', B: 'tiao' }[tile.suit];
        return `assets/tiles/${prefix}_${tile.num}.svg`;
    }

    static tileToString(tile) {
        if (!tile) return '';
        return tile.suit === 'HZ' ? '红中' : `${tile.num}${_ENG_CFG.SUITS ? _ENG_CFG.SUITS[tile.suit] : tile.suit}`;
    }

    static createDeck() {
        const deck = [];
        let id = 0;
        ['W', 'T', 'B'].forEach(suit => {
            for (let num = 1; num <= 9; num++) {
                for (let c = 0; c < 4; c++) deck.push({ id: id++, suit, num, code: `${num}${suit}` });
            }
        });
        for (let c = 0; c < 4; c++) deck.push({ id: id++, suit: 'HZ', num: 0, code: 'HZ' });
        return deck;
    }

    static shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    static sortHand(hand, queSuit = null) {
        const suitOrder = { W: 1, T: 2, B: 3, HZ: 4 };
        hand.sort((a, b) => {
            const aQue = a.suit === queSuit ? 1 : 0;
            const bQue = b.suit === queSuit ? 1 : 0;
            if (aQue !== bQue) return aQue - bQue;
            if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
            return a.num - b.num;
        });
    }

    static getCounts(tiles) {
        const counts = { W: Array(10).fill(0), T: Array(10).fill(0), B: Array(10).fill(0) };
        let hzCount = 0;
        tiles.forEach(t => {
            if (t.suit === 'HZ') hzCount++;
            else if (counts[t.suit]) counts[t.suit][t.num]++;
        });
        return { counts, hzCount };
    }

    static countGen(player, extraTile = null) {
        const counts = {};
        const allTiles = [...player.hand];
        if (extraTile && player.hand.length % 3 !== 2) allTiles.push(extraTile);
        player.melds.forEach(m => {
            const cnt = m.type === 'PUNG' ? 3 : 4;
            for (let i = 0; i < cnt; i++) allTiles.push(m.tile);
        });
        allTiles.forEach(t => { if (t.suit !== 'HZ') counts[t.code] = (counts[t.code] || 0) + 1; });
        return Object.values(counts).filter(c => c === 4).length;
    }

    static checkJinGouDiao(player) {
        return player.melds.length === 4;
    }

    static checkQiDui(counts, hzCount) {
        let pairs = 0, singles = 0;
        ['W', 'T', 'B'].forEach(s => {
            for (let n = 1; n <= 9; n++) {
                pairs += Math.floor(counts[s][n] / 2);
                if (counts[s][n] % 2 === 1) singles++;
            }
        });
        return (pairs + Math.min(singles, hzCount) + Math.floor(Math.max(0, hzCount - singles) / 2)) >= 7;
    }

    static checkDuiDuiHu(counts, wildCount) {
        const suits = ['W', 'T', 'B'];
        for (const s of suits) {
            for (let n = 1; n <= 9; n++) {
                let neededWild = 0;
                for (const checkS of suits) {
                    for (let checkN = 1; checkN <= 9; checkN++) {
                        const cnt = counts[checkS][checkN];
                        if (checkS === s && checkN === n) {
                            if (cnt < 2) neededWild += (2 - cnt);
                        } else if (cnt % 3 !== 0) {
                            neededWild += (3 - (cnt % 3));
                        }
                    }
                }
                if (neededWild <= wildCount && (wildCount - neededWild) % 3 === 0) return true;
            }
        }
        return false;
    }

    static checkCanHu(player, extraTile = null) {
        let testHand = [...player.hand];
        if (extraTile && player.hand.length % 3 !== 2) testHand.push(extraTile);
        if (testHand.length % 3 !== 2 || testHand.some(t => t.suit === player.que)) return false;

        const { counts, hzCount } = this.getCounts(testHand);
        if (testHand.length === 14 && player.melds.length === 0 && this.checkQiDui(counts, hzCount)) {
            return true;
        }
        return this.checkStandardWinWithWild(counts, hzCount);
    }

    static checkStandardWinWithWild(counts, wildCount) {
        const suits = ['W', 'T', 'B'];
        for (const s of suits) {
            for (let n = 1; n <= 9; n++) {
                if (counts[s][n] >= 2) {
                    counts[s][n] -= 2;
                    if (this.canFormMeldsAll(counts, wildCount)) { counts[s][n] += 2; return true; }
                    counts[s][n] += 2;
                }
                if (counts[s][n] >= 1 && wildCount >= 1) {
                    counts[s][n] -= 1;
                    if (this.canFormMeldsAll(counts, wildCount - 1)) { counts[s][n] += 1; return true; }
                    counts[s][n] += 1;
                }
            }
        }
        return wildCount >= 2 && this.canFormMeldsAll(counts, wildCount - 2);
    }

    static canFormMeldsAll(counts, wildCount) {
        let needed = 0;
        ['W', 'T', 'B'].forEach(s => { needed += this.minWildsForSuit([...counts[s]]); });
        return needed <= wildCount && (wildCount - needed) % 3 === 0;
    }

    static minWildsForSuit(arr, idx = 1) {
        while (idx <= 9 && arr[idx] === 0) idx++;
        if (idx > 9) return 0;

        let res = 99;
        // 刻子
        if (arr[idx] >= 3) {
            arr[idx] -= 3;
            res = Math.min(res, this.minWildsForSuit(arr, idx));
            arr[idx] += 3;
        } else {
            const need = 3 - arr[idx];
            const orig = arr[idx];
            arr[idx] = 0;
            res = Math.min(res, need + this.minWildsForSuit(arr, idx + 1));
            arr[idx] = orig;
        }

        // 順子
        if (idx <= 7) {
            const w1 = arr[idx + 1] > 0 ? 0 : 1;
            const w2 = arr[idx + 2] > 0 ? 0 : 1;
            arr[idx]--;
            if (w1 === 0) arr[idx + 1]--;
            if (w2 === 0) arr[idx + 2]--;
            res = Math.min(res, w1 + w2 + this.minWildsForSuit(arr, idx));
            arr[idx]++;
            if (w1 === 0) arr[idx + 1]++;
            if (w2 === 0) arr[idx + 2]++;
        }
        return res;
    }

    static checkCanGang(player) {
        const counts = {};
        player.hand.forEach(t => { if (t.suit !== 'HZ') counts[t.code] = (counts[t.code] || 0) + 1; });
        const result = [];
        // 暗槓
        player.hand.forEach(t => {
            if (counts[t.code] === 4 && !result.some(x => x.tile.code === t.code)) {
                result.push({ type: 'AN_GANG', tile: t });
            }
        });
        // 加槓
        player.melds.forEach(m => {
            if (m.type === 'PUNG') {
                const matchTile = player.hand.find(t => t.code === m.tile.code);
                if (matchTile && !result.some(x => x.tile.code === matchTile.code)) {
                    result.push({ type: 'JIA_GANG', tile: matchTile, meld: m });
                }
            }
        });
        return result;
    }

    static checkCanPungOrGang(player, tile, type) {
        if (!player || !tile || !tile.suit || tile.suit === 'HZ' || tile.suit === player.que) return false;
        const match = player.hand.filter(t => t && t.code === tile.code).length;
        return type === 'PUNG' ? match >= 2 : match >= 3;
    }

    static calculateFan(player, lastTile, isZiMo, fromPlayer = null, gameState = {}) {
        let hand = [...player.hand];
        if (!isZiMo || hand.length % 3 !== 2) hand.push(lastTile);

        const nonHzSuits = new Set();
        hand.forEach(t => { if (t.suit !== 'HZ') nonHzSuits.add(t.suit); });
        player.melds.forEach(m => { if (m.tile.suit !== 'HZ') nonHzSuits.add(m.tile.suit); });

        const isQingYiSe = nonHzSuits.size === 1;
        const { counts, hzCount } = this.getCounts(hand);

        const isQiDui = (hand.length === 14 && player.melds.length === 0 && this.checkQiDui(counts, hzCount));
        const isJinGouDiao = this.checkJinGouDiao(player);
        const isDuiDuiHu = this.checkDuiDuiHu(counts, hzCount);
        const genCount = this.countGen(player, lastTile);

        const isGangShangHua = isZiMo && gameState.lastActionIsGang && gameState.lastGangPlayer === player.id;
        const isGangShangPao = !isZiMo && gameState.lastActionIsGang && gameState.lastGangPlayer === fromPlayer;

        let fan = 0;
        const yakuNames = [];

        if (isQiDui) { fan += 2; yakuNames.push("七对"); }
        else {
            if (isDuiDuiHu) { fan += 1; yakuNames.push("对对胡"); }
            if (isJinGouDiao) { fan += 1; yakuNames.push("金钩钓"); }
        }

        if (yakuNames.length === 0) yakuNames.push("平胡");
        if (isQingYiSe) { fan += 2; yakuNames.push("清一色"); }
        if (genCount > 0) { fan += genCount; yakuNames.push(`${genCount}根`); }
        if (isGangShangHua) { fan += 1; yakuNames.push("杠上花"); }
        else if (isGangShangPao) { fan += 1; yakuNames.push("杠上炮"); }
        if (isZiMo) { fan += 1; yakuNames.push("自摸"); }

        return { fan, name: yakuNames.join(" ") };
    }

    static getTingTiles(player) {
        if (!player || !player.hand || player.hand.some(t => t.suit === player.que)) return [];
        let baseHand = [...player.hand];
        if (baseHand.length % 3 === 2) baseHand.pop();
        if (baseHand.length % 3 !== 1) return [];

        const testPlayer = { ...player, hand: baseHand };
        const tingTiles = [];

        ['W', 'T', 'B'].forEach(s => {
            if (s === player.que) return;
            for (let n = 1; n <= 9; n++) {
                const testTile = { suit: s, num: n, code: `${n}${s}` };
                if (this.checkCanHu(testPlayer, testTile)) tingTiles.push(testTile);
            }
        });

        const hzTile = { suit: 'HZ', num: 0, code: 'HZ' };
        if (this.checkCanHu(testPlayer, hzTile)) tingTiles.push(hzTile);

        return tingTiles;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MahjongEngine;
}
