/**
 * 紅中血流成河麻雀 - AI思考ロジック
 */
class MahjongAI {
    /**
     * 換三張：枚数の少ない花色の孤立牌から3枚選出（花色をまたいだ選出も許容）
     */
    static getSwapTiles(hand) {
        const suitCounts = { W: 0, T: 0, B: 0 };
        const nonHzTiles = [];

        hand.forEach(tile => {
            if (tile.suit !== 'HZ') {
                if (suitCounts[tile.suit] !== undefined) suitCounts[tile.suit]++;
                nonHzTiles.push(tile);
            }
        });

        nonHzTiles.sort((a, b) => {
            if (suitCounts[a.suit] !== suitCounts[b.suit]) {
                return suitCounts[a.suit] - suitCounts[b.suit];
            }
            const scoreA = this.evaluateTileIsolation(nonHzTiles, a);
            const scoreB = this.evaluateTileIsolation(nonHzTiles, b);
            if (scoreA !== scoreB) return scoreB - scoreA;
            return a.num - b.num;
        });

        return nonHzTiles.slice(0, 3);
    }

    /**
     * 定缺：最少枚数の花色を選択
     */
    static getDingQue(hand) {
        const counts = { W: 0, T: 0, B: 0 };
        hand.forEach(t => {
            if (counts[t.suit] !== undefined) counts[t.suit]++;
        });

        let minSuit = 'W';
        let minCount = counts['W'];
        ['T', 'B'].forEach(s => {
            if (counts[s] < minCount) {
                minCount = counts[s];
                minSuit = s;
            }
        });
        return minSuit;
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
            queIndices.sort((a, b) => {
                const distA = Math.min(player.hand[a].num - 1, 9 - player.hand[a].num);
                const distB = Math.min(player.hand[b].num - 1, 9 - player.hand[b].num);
                return distA - distB;
            });
            return queIndices[0];
        }

        // 2. 孤立度評価（紅中は残す）
        const candidates = [];
        player.hand.forEach((t, idx) => {
            if (t.suit !== 'HZ') {
                candidates.push({ idx, tile: t, score: this.evaluateTileIsolation(player.hand, t) });
            }
        });

        if (candidates.length === 0) return 0;
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].idx;
    }

    static evaluateTileIsolation(hand, targetTile) {
        let hasPair = false;
        let hasAdj1 = false;
        let hasAdj2 = false;

        hand.forEach(t => {
            if (t.id === targetTile.id) return;
            if (t.suit === targetTile.suit) {
                const diff = Math.abs(t.num - targetTile.num);
                if (diff === 0) hasPair = true;
                else if (diff === 1) hasAdj1 = true;
                else if (diff === 2) hasAdj2 = true;
            }
        });

        let isolationScore = 100;
        if (hasPair) isolationScore -= 40;
        if (hasAdj1) isolationScore -= 30;
        if (hasAdj2) isolationScore -= 15;

        if (targetTile.num === 1 || targetTile.num === 9) isolationScore += 10;
        else if (targetTile.num === 2 || targetTile.num === 8) isolationScore += 5;

        return isolationScore;
    }

    static shouldPung(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ') return false;
        if (player.hand.some(t => t.suit === player.que)) return false;

        let pairCount = 0;
        const counts = {};
        player.hand.forEach(t => {
            if (t.suit !== 'HZ') {
                counts[t.code] = (counts[t.code] || 0) + 1;
            }
        });
        Object.values(counts).forEach(c => {
            if (c >= 2) pairCount++;
        });

        return pairCount >= 2;
    }

    static shouldGang(player, tile) {
        if (tile.suit === player.que || tile.suit === 'HZ') return false;
        return !player.hand.some(t => t.suit === player.que);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MahjongAI;
}
