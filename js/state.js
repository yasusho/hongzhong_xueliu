/**
 * 紅中血流成河麻雀 - ゲーム状態管理 (GameState)
 */
const _CFG = (typeof CONFIG !== 'undefined') ? CONFIG : ((typeof require !== 'undefined') ? require('./config.js') : {});

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.phase = _CFG.PHASES ? _CFG.PHASES.INIT : 'INIT';
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

        const totalPlayers = _CFG.TOTAL_PLAYERS || 4;
        const initialScore = _CFG.INITIAL_SCORE || 5000;

        for (let i = 0; i < totalPlayers; i++) {
            this.players.push({
                id: i,
                name: `${i + 1}P`,
                hand: [],
                melds: [],
                discards: [],
                que: null,
                score: initialScore,
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
        const engine = (typeof MahjongEngine !== 'undefined') ? MahjongEngine : ((typeof require !== 'undefined') ? require('./engine.js') : null);
        if (engine) this.players.forEach(p => engine.sortHand(p.hand, p.que));
    }

    isGameOver() {
        const wallEmpty = this.wall ? (this.wall.length === 0) : (this.wallCount != null && this.wallCount === 0);
        return wallEmpty || this.players.some(p => p.score <= 0);
    }
}

const gameState = new GameState();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, gameState };
}
