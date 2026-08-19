/**
 * 紅中血流成河麻雀 - ゲーム状態管理
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.phase = CONFIG.PHASES.INIT;
        this.wall = [];
        this.currentTurn = 0;
        this.startPlayer = 0;
        this.lastDiscard = null;
        this.autoPlay = false;
        this.selectedSwapIndices = [];
        this.lastActionIsGang = false;
        this.lastGangPlayer = null;
        this.logs = ['系统就绪。'];
        this.players = [];

        for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) {
            this.players.push({
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
            });
        }
    }

    getUserPlayer(seat = 0) {
        return this.players[seat];
    }

    transferScore(fromIndex, toIndex, amount) {
        if (this.players[fromIndex] && this.players[toIndex]) {
            this.players[fromIndex].score -= amount;
            this.players[toIndex].score += amount;
        }
    }

    sortAllHands() {
        if (typeof MahjongEngine !== 'undefined') {
            this.players.forEach(p => MahjongEngine.sortHand(p.hand, p.que));
        }
    }

    isGameOver() {
        const wallEmpty = this.wall ? (this.wall.length === 0) : (this.wallCount !== undefined && this.wallCount === 0);
        return wallEmpty || this.players.some(p => p.score <= 0);
    }
}

const gameState = new GameState();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, gameState };
}
