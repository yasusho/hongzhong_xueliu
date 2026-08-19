/**
 * 紅中血流成河麻雀 - AI思考ロジック (MahjongAI)
 */
class MahjongAI {
    /**
     * 換三張：枚数の少ない花色の孤立牌から3枚選出
     */
    static getSwapTiles(hand) {
        const counts = { W: 0, T: 0, B: 0 };
        const nonHz = hand.filter(t => t.suit !== 'HZ');
        nonHz.forEach(t => { if (counts[t.suit] !== undefined) counts[t.suit]++; });

        return nonHz.sort((a, b) => {
            if (counts[a.suit] !== counts[b.suit]) return counts[a.suit] - counts[b.suit];
            const diffIso = this.evaluateTileIsolation(nonHz, b) - this.evaluateTileIsolation(nonHz, a);
            return diffIso !== 0 ? diffIso : a.num - b.num;
        }).slice(0, 3);
    }

    /**
     * 定缺：最少枚数の花色を選択
     */
    static getDingQue(hand) {
        const counts = { W: 0, T: 0, B: 0 };
        hand.forEach(t => { if (counts[t.suit] !== undefined) counts[t.suit]++; });
        return ['W', 'T', 'B'].reduce((min, s) => counts[s] < counts[min] ? s : min, 'W');
    }

    /**
     * 打牌選択（缺門牌優先、次いで孤立牌）
     */
    static chooseDiscardIndex(player) {
        // 1. 缺門牌があれば優先して打牌（1, 9の端牌から）
        const queIndices = [];
        player.hand.forEach((t, idx) => {
            if (t.suit === player.que) queIndices.push(idx);
        });

        if (queIndices.length > 0) {
            return queIndices.sort((a, b) => {
                const distA = Math.min(player.hand[a].num - 1, 9 - player.hand[a].num);
                const distB = Math.min(player.hand[b].num - 1, 9 - player.hand[b].num);
                return distA - distB;
            })[0];
        }

        // 2. 孤立度評価（紅中は残す）
        const candidates = [];
        player.hand.forEach((t, idx) => {
            if (t.suit !== 'HZ') candidates.push({ idx, score: this.evaluateTileIsolation(player.hand, t) });
        });

        if (candidates.length === 0) return 0;
        return candidates.sort((a, b) => b.score - a.score)[0].idx;
    }

    static evaluateTileIsolation(hand, targetTile) {
        let hasPair = false, hasAdj1 = false, hasAdj2 = false;

        hand.forEach(t => {
            if (t.id === targetTile.id || t.suit !== targetTile.suit) return;
            const diff = Math.abs(t.num - targetTile.num);
            if (diff === 0) hasPair = true;
            else if (diff === 1) hasAdj1 = true;
            else if (diff === 2) hasAdj2 = true;
        });

        let score = 100;
        if (hasPair) score -= 40;
        if (hasAdj1) score -= 30;
        if (hasAdj2) score -= 15;
        if (targetTile.num === 1 || targetTile.num === 9) score += 10;
        else if (targetTile.num === 2 || targetTile.num === 8) score += 5;

        return score;
    }

    static shouldPung(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ' || player.hand.some(t => t.suit === player.que)) return false;
        const counts = {};
        player.hand.forEach(t => { if (t.suit !== 'HZ') counts[t.code] = (counts[t.code] || 0) + 1; });
        return Object.values(counts).filter(c => c >= 2).length >= 2;
    }

    static shouldGang(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ') return false;
        return !player.hand.some(t => t.suit === player.que);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MahjongAI;
}
