/**
 * 紅中血流成河麻雀 - ゲームコントローラー＆エントリーポイント
 */
class GameController {
    constructor(state, sound, ui, engine, ai, p2p) {
        this.state = state;
        this.sound = sound;
        this.ui = ui;
        this.engine = engine;
        this.ai = ai;
        this.p2p = p2p;
        this.isOnline = false;
        this.pendingOffTurnHu = null;
        this.pendingOffTurnPungGang = null;
        this.initP2PEvents();
    }

    log(text) {
        if (!this.state.logs) this.state.logs = [];
        this.state.logs.push(text);
        if (this.state.logs.length > 50) this.state.logs.shift();
        this.ui.log(text);
    }

    clearLog(text = '系统就绪。') {
        this.state.logs = [text];
        this.ui.clearLog(text);
    }

    get mySeat() {
        return this.isOnline ? this.p2p.seatIndex : 0;
    }

    isHumanPlayer(pIndex) {
        if (!this.isOnline) return pIndex === 0;
        const pInfo = this.p2p.playersInfo[pIndex];
        return pInfo ? !pInfo.isAI : (pIndex === 0);
    }

    initP2PEvents() {
        if (!this.p2p) return;
        this.p2p.onStateReceived = (remoteState) => this.handleRemoteStateSync(remoteState);
        this.p2p.onActionReceived = (pIdx, action, payload) => this.handleRemoteAction(pIdx, action, payload);
        this.p2p.onPromptReceived = (options) => this.handleRemotePrompt(options);
        this.p2p.onRoomUpdate = (playersInfo, mySeat) => {
            const membersEl = typeof document !== 'undefined' ? document.getElementById('room-members-display') : null;
            if (membersEl) {
                membersEl.innerText = playersInfo.map(p => `${p.id + 1}P${p.isAI ? '(CPU)' : (p.id === this.mySeat ? '(你)' : '(人)')}`).join(' ');
            }
        };
    }

    /**
     * ゲームの新規開始 (単機またはオンライン)
     */
    initGame(isOnlineMatch = false) {
        this.isOnline = isOnlineMatch;
        this.pendingOffTurnHu = null;
        this.pendingOffTurnPungGang = null;

        this.ui.hideInstruction();
        this.ui.hideResultModal();
        this.ui.hideActionBox();
        const tingEl = typeof document !== 'undefined' ? document.getElementById('ting-info') : null;
        if (tingEl) tingEl.style.display = 'none';

        this.state.reset();

        // プレイヤー表示名の設定
        if (this.p2p && this.p2p.playersInfo) {
            this.p2p.playersInfo.forEach((pInfo, idx) => {
                if (this.state.players[idx]) {
                    this.state.players[idx].name = `${idx + 1}P${pInfo.isAI ? ' (CPU)' : (idx === this.mySeat ? ' (你)' : '')}`;
                }
            });
        } else {
            this.state.players[0].name = '1P (你)';
            this.state.players[1].name = '2P (CPU)';
            this.state.players[2].name = '3P (CPU)';
            this.state.players[3].name = '4P (CPU)';
        }

        const startPlayer = Math.floor(Math.random() * CONFIG.TOTAL_PLAYERS);
        this.state.startPlayer = startPlayer;
        this.state.currentTurn = startPlayer;

        this.clearLog(`新局开始，${this.state.players[startPlayer].name} 起家。`);

        const deck = this.engine.shuffle(this.engine.createDeck());

        // 各自13枚配牌、親は14枚
        for (let round = 0; round < CONFIG.HAND_SIZE; round++) {
            for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
                this.state.players[p].hand.push(deck.pop());
            }
        }
        this.state.players[startPlayer].hand.push(deck.pop());
        this.state.wall = deck;

        this.state.sortAllHands();
        this.startSwap3Phase();
    }

    // --- P2P ルーム管理 ---

    async handleCreateRoom(code = null) {
        try {
            const actualCode = await this.p2p.createRoom(code);
            this.showRoomBar(actualCode, '房主');
            try { sessionStorage.setItem('hz_session', JSON.stringify({ role: 'host', roomCode: actualCode })); } catch(e) {}
        } catch (err) {
            console.error('初始化房间失败:', err);
        }
    }

    async handleChangeRoom() {
        try {
            sessionStorage.removeItem('hz_session');
            sessionStorage.removeItem('hz_live_state');
            const newCode = String(Math.floor(1000 + Math.random() * 9000));
            await this.handleCreateRoom(newCode);
            this.initGame(false);
            this.log(`已切换至新房间: ${newCode} (房主)`);
        } catch (err) {
            console.error('更换房间失败:', err);
        }
    }

    async handleJoinRoom(inputCode = null, savedSeatIndex = null) {
        const code = inputCode || prompt('请输入4位房间号:');
        if (!code) return;

        try {
            this.log(`正在加入房间 ${code}...`);
            await this.p2p.joinRoom(code.trim(), savedSeatIndex);
            this.isOnline = true;
            this.showRoomBar(this.p2p.roomCode, '玩家');
            try { sessionStorage.setItem('hz_session', JSON.stringify({ role: 'client', roomCode: this.p2p.roomCode, seatIndex: this.p2p.seatIndex })); } catch(e) {}
            this.log(`已加入房间 ${code}，等待房主开始对局...`);
        } catch (err) {
            alert('加入房间失败: ' + (err.message || err));
            this.log('加入房间失败: ' + (err.message || err));
        }
    }

    showRoomBar(code, role) {
        const bar = document.getElementById('room-bar');
        const codeEl = document.getElementById('room-code-display');
        const roleEl = document.getElementById('room-role-display');
        const startBtn = document.getElementById('btn-start');

        if (bar) bar.style.display = 'flex';
        if (codeEl) codeEl.innerText = code;
        if (roleEl) roleEl.innerText = `(${role})`;
        if (startBtn) {
            startBtn.style.display = (role === '玩家') ? 'none' : 'inline-block';
        }
    }

    handleStartGame() {
        if (this.isOnline && this.p2p && !this.p2p.isHost) {
            this.log('当前为玩家身份，请等待房主点击开始对局。');
            return;
        }
        this.startOnlineMatch();
    }

    startOnlineMatch() {
        this.initGame(true);
        this.syncStateToPeers();
    }

    syncStateToPeers() {
        if (this.isOnline && this.p2p && this.p2p.isHost) {
            this.p2p.broadcastState(this.state);
            try {
                sessionStorage.setItem('hz_live_state', JSON.stringify({
                    phase: this.state.phase,
                    currentTurn: this.state.currentTurn,
                    startPlayer: this.state.startPlayer,
                    wall: this.state.wall,
                    lastDiscard: this.state.lastDiscard,
                    players: this.state.players
                }));
            } catch(e) {}
        }
    }

    // --- 換三張フェーズ ---

    startSwap3Phase() {
        this.state.phase = CONFIG.PHASES.SWAP3;
        this.state.selectedSwapIndices = [];

        // CPUの3枚選定
        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            if (!this.isHumanPlayer(p)) {
                this.state.players[p].swapTiles = this.ai.getSwapTiles(this.state.players[p].hand);
            } else {
                this.state.players[p].swapTiles = [];
            }
        }

        this.ui.render(this.state, this.mySeat);
        this.ui.showInstruction('换三张', '选3张牌', `
            <button id="btn-confirm-swap" disabled onclick="gameController.confirmUserSwap()">确定 (0/3)</button>
        `);
        this.syncStateToPeers();
    }

    toggleSwapTileSelect(index) {
        if (this.state.phase !== CONFIG.PHASES.SWAP3) return;
        const p = this.state.players[this.mySeat];
        const tile = p.hand[index];
        if (!tile || tile.suit === 'HZ') {
            this.log('红中为万能牌，不能作为换三张牌打出');
            return;
        }

        this.sound.play('select');

        const pos = this.state.selectedSwapIndices.indexOf(index);
        if (pos > -1) {
            this.state.selectedSwapIndices.splice(pos, 1);
        } else if (this.state.selectedSwapIndices.length < 3) {
            this.state.selectedSwapIndices.push(index);
        }

        this.ui.render(this.state, this.mySeat);
        const btn = typeof document !== 'undefined' ? document.getElementById('btn-confirm-swap') : null;
        if (btn) {
            const count = this.state.selectedSwapIndices.length;
            btn.disabled = (count !== 3);
            btn.innerText = `确定 (${count}/3)`;
        }
    }

    confirmUserSwap() {
        if (!this.state.selectedSwapIndices || this.state.selectedSwapIndices.length !== 3) return;
        this.sound.play('select');

        const userPlayer = this.state.players[this.mySeat];
        userPlayer.swapTiles = this.state.selectedSwapIndices.map(i => userPlayer.hand[i]);
        const swapTileIds = userPlayer.swapTiles.map(t => t.id);

        if (this.isOnline && !this.p2p.isHost) {
            this.p2p.sendAction('CONFIRM_SWAP', { swapTiles: userPlayer.swapTiles, swapTileIds: swapTileIds });
            this.ui.hideInstruction();
            this.log('已提交换牌，等待其他玩家...');
            return;
        }

        this.checkAndExecuteSwap();
    }

    checkAndExecuteSwap() {
        const allReady = this.state.players.every(p => p.swapTiles && p.swapTiles.length === 3);
        if (!allReady) return;

        // 1. 各プレイヤーの手牌から選択された3枚を厳密に除去
        this.state.players.forEach(p => {
            p.swapTiles.forEach(t => {
                let idx = p.hand.findIndex(x => (x.id !== undefined && t.id !== undefined && x.id === t.id));
                if (idx === -1) {
                    idx = p.hand.findIndex(x => x.suit === t.suit && x.num === t.num);
                }
                if (idx > -1) {
                    p.hand.splice(idx, 1);
                }
            });
        });

        // 2. 時計回りに次のプレイヤーに3枚を渡す
        const swappedGroups = this.state.players.map(p => [...p.swapTiles]);
        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            const nextP = (p + 1) % CONFIG.TOTAL_PLAYERS;
            this.state.players[nextP].hand.push(...swappedGroups[p]);
        }

        this.log('换三张完成。');
        this.state.sortAllHands();
        this.startDingQuePhase();
    }

    // --- 定缺フェーズ ---

    startDingQuePhase() {
        this.state.phase = CONFIG.PHASES.DINGQUE;

        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            if (!this.isHumanPlayer(p)) {
                this.state.players[p].que = this.ai.getDingQue(this.state.players[p].hand);
            } else {
                this.state.players[p].que = null;
            }
        }

        this.ui.render(this.state, this.mySeat);
        this.ui.showInstruction('定缺', '请选择定缺门类', `
            <button onclick="gameController.selectUserQue('W')">缺万</button>
            <button onclick="gameController.selectUserQue('T')">缺筒</button>
            <button onclick="gameController.selectUserQue('B')">缺条</button>
        `);
        this.syncStateToPeers();
    }

    selectUserQue(suit) {
        this.sound.play('select');
        if (this.state.players[this.mySeat]) {
            this.state.players[this.mySeat].que = suit;
        }
        this.ui.hideInstruction();
        this.ui.render(this.state, this.mySeat);

        if (this.isOnline && !this.p2p.isHost) {
            this.p2p.sendAction('SELECT_QUE', { que: suit });
            this.log(`已选择缺${CONFIG.SUITS[suit]}，等待其他玩家...`);
            return;
        }

        this.checkAndExecuteDingQue();
    }

    checkAndExecuteDingQue() {
        const allReady = this.state.players.every(p => !!p.que);
        if (!allReady) {
            this.syncStateToPeers();
            return;
        }

        this.state.sortAllHands();
        this.state.phase = CONFIG.PHASES.PLAYING;

        const queSummary = this.state.players.map(p => `${p.name}缺${CONFIG.SUITS[p.que]}`).join('，');
        this.log(`定缺完毕: ${queSummary}`);

        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();
        this.processTurn();
    }

    // --- プレイ進行ループ ---

    processTurn(isRinshan = false) {
        if (this.state.phase !== CONFIG.PHASES.PLAYING) return;
        if (this.state.isGameOver()) {
            this.endGame();
            return;
        }

        const p = this.state.players[this.state.currentTurn];

        // 嶺上牌または通常のツモ牌を引く
        if (isRinshan || p.hand.length % 3 === 1) {
            if (this.state.wall.length === 0) {
                this.endGame();
                return;
            }
            const drawnTile = this.state.wall.pop();
            p.hand.push(drawnTile);
            if (this.state.currentTurn === this.mySeat) {
                this.log(`摸 ${isRinshan ? '[杠上牌] ' : ''}${this.engine.tileToString(drawnTile)}`);
            }
            this.ui.render(this.state, this.mySeat);
        } else if (!isRinshan) {
            this.state.lastActionIsGang = false;
            this.state.lastGangPlayer = null;
        }

        this.syncStateToPeers();

        if (this.state.currentTurn === this.mySeat) {
            this.ui.updateTingPanel(p);
            this.checkPlayerTurnActions();

            if (this.state.autoPlay) {
                setTimeout(() => this.autoPlayUserTurn(), CONFIG.DELAYS.AI_TURN);
            }
        } else if (!this.isHumanPlayer(this.state.currentTurn)) {
            setTimeout(() => this.processAITurn(), CONFIG.DELAYS.AI_TURN);
        }
    }

    checkPlayerTurnActions() {
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length === 0) return;

        const drawnTile = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawnTile);
        const gangOptions = this.engine.checkCanGang(p);

        if (canHu || gangOptions.length > 0) {
            this.ui.showActionBox(
                canHu,
                gangOptions.length > 0,
                false,
                () => this.handleActionClick('HU', { tile: drawnTile, isZiMo: true }),
                () => this.handleActionClick('GANG', { gangOption: gangOptions[0] }),
                null,
                () => this.ui.hideActionBox()
            );
        } else {
            this.ui.hideActionBox();
        }
    }

    handleActionClick(action, payload) {
        if (this.isOnline && !this.p2p.isHost) {
            this.p2p.sendAction(action, payload);
            this.ui.hideActionBox();
            return;
        }

        this.ui.hideActionBox();

        if (action === 'HU') this.doHu(this.mySeat, payload.tile, payload.isZiMo, payload.fromPlayer);
        else if (action === 'GANG') this.doGang(this.mySeat, payload.gangOption);
        else if (action === 'GANG_DISCARD') this.doGangFromDiscard(this.mySeat, payload.tile, payload.fromPlayer);
        else if (action === 'PUNG') this.doPung(this.mySeat, payload.tile, payload.fromPlayer);
    }

    handleTileClick(index) {
        if (this.state.phase === CONFIG.PHASES.SWAP3) {
            this.toggleSwapTileSelect(index);
            return;
        }

        if (this.state.phase === CONFIG.PHASES.PLAYING) {
            if (this.state.currentTurn !== this.mySeat) {
                this.log('当前不是你的手番，请等待其他玩家打牌。');
                return;
            }
            const p = this.state.players[this.mySeat];
            const tile = p.hand[index];
            if (!tile) return;

            // 定缺牌優先ルール
            const hasQueTiles = p.hand.some(t => t.suit === p.que);
            if (hasQueTiles && tile.suit !== p.que) {
                this.log(`必须先打出缺门牌（缺${CONFIG.SUITS[p.que]}）`);
                return;
            }

            // 和了後の手牌固定（摸打固定）
            if (p.isHu && index !== p.hand.length - 1) {
                this.log('胡牌后只能打出摸到的最后一张牌。');
                return;
            }

            if (this.isOnline && !this.p2p.isHost) {
                this.p2p.sendAction('DISCARD', { handIndex: index });
                return;
            }

            this.executeDiscard(this.mySeat, index);
        }
    }

    executeDiscard(playerIndex, handIndex) {
        const p = this.state.players[playerIndex];
        if (!p || p.hand.length === 0) return;

        if (handIndex < 0 || handIndex >= p.hand.length) handIndex = p.hand.length - 1;
        const tile = p.hand.splice(handIndex, 1)[0];
        if (!tile) return;

        p.discards.push(tile);
        this.state.lastDiscard = { tile, playerIndex };

        this.sound.play('discard');
        this.log(`${p.name} 打 ${this.engine.tileToString(tile)}`);

        this.engine.sortHand(p.hand, p.que);
        this.ui.hideActionBox();
        this.ui.render(this.state, this.mySeat);
        if (playerIndex === this.mySeat) {
            this.ui.updateTingPanel(p);
        }
        this.syncStateToPeers();

        this.checkOffTurnActions(tile, playerIndex);
        this.state.lastActionIsGang = false;
    }

    // --- 他家捨牌に対するアクション（和了・ポン・カン）判定 ---

    checkOffTurnActions(discardTile, discarderIndex) {
        // 1. 和了（胡）判定（一炮多响対応）
        const huCandidates = [];
        for (let i = 1; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            const targetP = this.state.players[targetIdx];
            if (this.engine.checkCanHu(targetP, discardTile)) {
                huCandidates.push(targetIdx);
            }
        }

        if (huCandidates.length > 0) {
            this.arbitrateHuActions(huCandidates, discardTile, discarderIndex);
            return;
        }

        // 2. 碰・槓判定
        this.arbitratePungGangActions(discardTile, discarderIndex, 1);
    }

    arbitrateHuActions(huCandidates, discardTile, discarderIndex) {
        const decisions = {};
        let pendingCount = 0;

        huCandidates.forEach(pIdx => {
            if (!this.isHumanPlayer(pIdx)) {
                decisions[pIdx] = 'HU';
            } else if (pIdx === this.mySeat) {
                if (this.state.autoPlay) {
                    decisions[pIdx] = 'HU';
                } else {
                    pendingCount++;
                    this.ui.showActionBox(
                        true, false, false,
                        () => {
                            this.ui.hideActionBox();
                            decisions[pIdx] = 'HU';
                            this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex);
                        },
                        null, null,
                        () => {
                            this.ui.hideActionBox();
                            decisions[pIdx] = 'PASS';
                            this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex);
                        }
                    );
                }
            } else {
                // 遠隔人間プレイヤーに問い合わせ
                pendingCount++;
                this.p2p.sendToSeat(pIdx, {
                    type: 'PROMPT_OFFTURN_ACTION',
                    options: { canHu: true, canGang: false, canPung: false, tile: discardTile, fromPlayer: discarderIndex }
                });
            }
        });

        this.pendingOffTurnHu = {
            huCandidates,
            decisions,
            discardTile,
            discarderIndex,
            pendingCount
        };

        if (pendingCount === 0) {
            this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex);
        }
    }

    resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex) {
        // すべての候補者が回答済みか確認
        const allResponded = huCandidates.every(pIdx => decisions[pIdx] !== undefined);
        if (!allResponded) return;

        this.pendingOffTurnHu = null;

        const actualHuPlayers = huCandidates.filter(pIdx => decisions[pIdx] === 'HU');
        if (actualHuPlayers.length > 0) {
            actualHuPlayers.forEach(pIdx => {
                this.doHu(pIdx, discardTile, false, discarderIndex);
            });

            // 血流成河ルール: 点炮後は捨て牌はそのまま河に残り、次のプレイヤーの手番へ
            this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
            this.syncStateToPeers();
            setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
            return;
        }

        // 全員が見逃し(PASS)した場合、碰・槓判定へ移行
        this.arbitratePungGangActions(discardTile, discarderIndex, 1);
    }

    arbitratePungGangActions(discardTile, discarderIndex, startIndexOffset = 1) {
        for (let i = startIndexOffset; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            const targetP = this.state.players[targetIdx];
            if (targetP.isHu) continue; // 胡牌後は手牌固定のため鳴き不可

            const canGang = this.engine.checkCanPungOrGang(targetP, discardTile, 'GANG');
            const canPung = this.engine.checkCanPungOrGang(targetP, discardTile, 'PUNG');
            if (!canGang && !canPung) continue;

            if (!this.isHumanPlayer(targetIdx)) {
                if (canGang && this.ai.shouldGang(targetP, discardTile)) {
                    this.doGangFromDiscard(targetIdx, discardTile, discarderIndex);
                    return;
                } else if (canPung && this.ai.shouldPung(targetP, discardTile)) {
                    this.doPung(targetIdx, discardTile, discarderIndex);
                    return;
                }
            } else if (targetIdx === this.mySeat) {
                this.ui.showActionBox(
                    false, canGang, canPung,
                    null,
                    () => { this.ui.hideActionBox(); this.doGangFromDiscard(this.mySeat, discardTile, discarderIndex); },
                    () => { this.ui.hideActionBox(); this.doPung(this.mySeat, discardTile, discarderIndex); },
                    () => {
                        this.ui.hideActionBox();
                        this.arbitratePungGangActions(discardTile, discarderIndex, i + 1);
                    }
                );
                return;
            } else {
                // 遠隔人間プレイヤーに問い合わせ
                this.pendingOffTurnPungGang = { targetIdx, discardTile, discarderIndex, nextOffset: i + 1 };
                this.p2p.sendToSeat(targetIdx, {
                    type: 'PROMPT_OFFTURN_ACTION',
                    options: { canHu: false, canGang, canPung, tile: discardTile, fromPlayer: discarderIndex }
                });
                return;
            }
        }

        // 誰も鳴かない場合は次のプレイヤーの手番へ
        this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
        this.syncStateToPeers();
        setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
    }

    // --- 鳴き・和了処理 ---

    doPung(playerIndex, tile, fromPlayer) {
        this.sound.play('action');
        const p = this.state.players[playerIndex];
        let removed = 0;
        for (let i = p.hand.length - 1; i >= 0; i--) {
            if (p.hand[i].code === tile.code) {
                p.hand.splice(i, 1);
                if (++removed === 2) break;
            }
        }
        p.melds.push({ type: 'PUNG', tile, from: fromPlayer });
        this.log(`${p.name} 碰 ${this.engine.tileToString(tile)}`);

        this.state.currentTurn = playerIndex;
        this.state.lastActionIsGang = false;
        this.state.lastGangPlayer = null;
        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();

        if (playerIndex === this.mySeat) {
            this.checkPlayerTurnActions();
        } else if (!this.isHumanPlayer(playerIndex)) {
            setTimeout(() => this.processAITurn(), CONFIG.DELAYS.AI_TURN);
        }
    }

    doGangFromDiscard(playerIndex, tile, fromPlayer) {
        this.sound.play('action');
        const p = this.state.players[playerIndex];
        let removed = 0;
        for (let i = p.hand.length - 1; i >= 0; i--) {
            if (p.hand[i].code === tile.code) {
                p.hand.splice(i, 1);
                if (++removed === 3) break;
            }
        }
        p.melds.push({ type: 'GANG', tile, from: fromPlayer, isAnGang: false });
        this.log(`${p.name} 明杠 ${this.engine.tileToString(tile)}`);
        this.state.transferScore(fromPlayer, playerIndex, CONFIG.GANG_SCORE);

        this.state.lastActionIsGang = true;
        this.state.lastGangPlayer = playerIndex;
        this.state.currentTurn = playerIndex;
        this.syncStateToPeers();
        this.processTurn(true);
    }

    doGang(playerIndex, gangOption) {
        if (!gangOption || !gangOption.tile) return;
        this.sound.play('action');
        const p = this.state.players[playerIndex];
        const tile = gangOption.tile;

        if (gangOption.type === 'JIA_GANG') {
            // 加槓 (既存のポン副露を槓に昇格)
            const idx = p.hand.findIndex(t => t.code === tile.code);
            if (idx > -1) p.hand.splice(idx, 1);
            const meld = p.melds.find(m => m.type === 'PUNG' && m.tile.code === tile.code);
            if (meld) {
                meld.type = 'GANG';
                meld.isAnGang = false;
            }
            this.log(`${p.name} 补杠 ${this.engine.tileToString(tile)}`);
        } else {
            // 暗槓
            p.hand = p.hand.filter(t => t.code !== tile.code);
            p.melds.push({ type: 'GANG', tile, from: playerIndex, isAnGang: true });
            this.log(`${p.name} 暗杠 ${this.engine.tileToString(tile)}`);
        }

        for (let other = 0; other < CONFIG.TOTAL_PLAYERS; other++) {
            if (other !== playerIndex) this.state.transferScore(other, playerIndex, CONFIG.GANG_SCORE);
        }

        this.state.lastActionIsGang = true;
        this.state.lastGangPlayer = playerIndex;
        this.syncStateToPeers();
        this.processTurn(true);
    }

    doHu(playerIndex, tile, isZiMo, fromPlayer = null) {
        this.sound.play('hu');
        const p = this.state.players[playerIndex];
        p.isHu = true;

        const fanInfo = this.engine.calculateFan(p, tile, isZiMo, fromPlayer, this.state);
        const score = CONFIG.BASE_SCORE * Math.pow(2, fanInfo.fan);

        this.log(`★ ${p.name} ${isZiMo ? '自摸' : '点炮'}胡: ${fanInfo.name} ${fanInfo.fan}番 ${score}分 ${this.engine.tileToString(tile)}`);
        p.huRecords.push({ fan: fanInfo.fan, fanName: fanInfo.name, score, isZiMo });

        // 和了判定後は槓フラグをリセット
        this.state.lastActionIsGang = false;
        this.state.lastGangPlayer = null;

        if (isZiMo) {
            for (let other = 0; other < CONFIG.TOTAL_PLAYERS; other++) {
                if (other !== playerIndex) this.state.transferScore(other, playerIndex, score);
            }

            // 自摸牌を手牌から除外（血流成河: 和了牌を手牌に固定）
            const tileIdx = p.hand.findIndex(t => t.id === tile.id);
            if (tileIdx > -1) {
                p.hand.splice(tileIdx, 1);
            } else if (p.hand.length % 3 === 2) {
                p.hand.pop();
            }
            this.engine.sortHand(p.hand, p.que);
            this.ui.hideActionBox();
            this.ui.render(this.state, this.mySeat);
            this.syncStateToPeers();

            setTimeout(() => {
                if (this.state.phase === CONFIG.PHASES.PLAYING) {
                    this.state.currentTurn = (playerIndex + 1) % CONFIG.TOTAL_PLAYERS;
                    this.processTurn();
                }
            }, CONFIG.DELAYS.AUTO_ACTION);
        } else {
            this.state.transferScore(fromPlayer, playerIndex, score);
            this.ui.hideActionBox();
            this.ui.render(this.state, this.mySeat);
            this.syncStateToPeers();
        }
    }

    // --- AI / ユーザー自動実行 ---

    processAITurn() {
        const turn = this.state.currentTurn;
        const p = this.state.players[turn];
        if (!p || p.hand.length === 0) return;

        const drawnTile = p.hand[p.hand.length - 1];

        // すでに和了済みの場合は摸打固定（自摸可能なら和了）
        if (p.isHu) {
            if (this.engine.checkCanHu(p, drawnTile)) {
                this.doHu(turn, drawnTile, true);
            } else {
                this.executeDiscard(turn, p.hand.length - 1);
            }
            return;
        }

        if (this.engine.checkCanHu(p, drawnTile)) {
            this.doHu(turn, drawnTile, true);
            return;
        }

        const gangTiles = this.engine.checkCanGang(p);
        if (gangTiles.length > 0) {
            this.doGang(turn, gangTiles[0]);
            return;
        }

        this.executeDiscard(turn, this.ai.chooseDiscardIndex(p));
    }

    autoPlayUserTurn() {
        if (this.state.currentTurn !== this.mySeat || this.state.phase !== CONFIG.PHASES.PLAYING) return;
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length === 0) return;

        const drawnTile = p.hand[p.hand.length - 1];
        if (this.engine.checkCanHu(p, drawnTile)) {
            this.doHu(this.mySeat, drawnTile, true);
            return;
        }

        if (p.isHu) {
            this.executeDiscard(this.mySeat, p.hand.length - 1);
        } else {
            this.executeDiscard(this.mySeat, this.ai.chooseDiscardIndex(p));
        }
    }

    // --- 対局終了・清算 ---

    endGame() {
        this.state.phase = CONFIG.PHASES.END;
        const penaltyLogs = [];

        // 1. 查花猪
        const huaZhu = this.state.players.filter(p => p.hand.some(t => t.suit === p.que));
        const nonHuaZhu = this.state.players.filter(p => !p.hand.some(t => t.suit === p.que));

        huaZhu.forEach(hzp => {
            nonHuaZhu.forEach(nhp => {
                const penalty = CONFIG.HUA_ZHU_PENALTY;
                this.state.transferScore(hzp.id, nhp.id, penalty);
                const msg = `查花猪: ${hzp.name} 赔付 ${nhp.name} ${penalty}分`;
                this.log(msg);
                penaltyLogs.push(msg);
            });
        });

        // 2. 查大叫
        const unHuTing = [];
        const unHuNoTing = [];
        this.state.players.forEach(p => {
            if (p.isHu || p.hand.some(t => t.suit === p.que)) return;
            const tingTiles = this.engine.getTingTiles(p);
            if (tingTiles.length > 0) unHuTing.push({ player: p, tingTiles });
            else unHuNoTing.push(p);
        });

        if (unHuTing.length > 0 && unHuNoTing.length > 0) {
            unHuNoTing.forEach(notingP => {
                unHuTing.forEach(({ player: tingP, tingTiles }) => {
                    let maxFan = 0;
                    tingTiles.forEach(tile => {
                        const fanInfo = this.engine.calculateFan(tingP, tile, false);
                        if (fanInfo.fan > maxFan) maxFan = fanInfo.fan;
                    });
                    const penalty = CONFIG.BASE_SCORE * Math.pow(2, maxFan);
                    this.state.transferScore(notingP.id, tingP.id, penalty);
                    const msg = `查大叫: ${notingP.name} 赔付 ${tingP.name} ${penalty}分 (${maxFan}番)`;
                    this.log(msg);
                    penaltyLogs.push(msg);
                });
            });
        }

        this.ui.render(this.state, this.mySeat);
        this.ui.showResultModal(this.state.players, penaltyLogs);
        this.syncStateToPeers();
    }

    // --- P2P同期・RPCハンドラ ---

    handleRemoteStateSync(remoteState) {
        const savedSelectedIndices = this.state.selectedSwapIndices || [];
        this.state.wall = null;
        Object.assign(this.state, remoteState);

        if (this.state.phase === CONFIG.PHASES.SWAP3) {
            this.state.selectedSwapIndices = savedSelectedIndices;
            const myP = this.state.players[this.mySeat];
            if (!myP || !myP.swapTiles || myP.swapTiles.length !== 3) {
                const count = (this.state.selectedSwapIndices || []).length;
                this.ui.showInstruction('换三张', '选3张牌', `
                    <button id="btn-confirm-swap" ${count === 3 ? '' : 'disabled'} onclick="gameController.confirmUserSwap()">确定 (${count}/3)</button>
                `);
            } else {
                this.ui.hideInstruction();
            }
        } else if (this.state.phase === CONFIG.PHASES.DINGQUE) {
            this.state.selectedSwapIndices = [];
            const myP = this.state.players[this.mySeat];
            if (!myP || !myP.que) {
                this.ui.showInstruction('定缺', '请选择定缺门类', `
                    <button onclick="gameController.selectUserQue('W')">缺万</button>
                    <button onclick="gameController.selectUserQue('T')">缺筒</button>
                    <button onclick="gameController.selectUserQue('B')">缺条</button>
                `);
            } else {
                this.ui.hideInstruction();
            }
        } else if (this.state.phase === CONFIG.PHASES.PLAYING) {
            this.ui.hideInstruction();
            if (this.state.currentTurn === this.mySeat) {
                this.checkPlayerTurnActions();
                if (this.state.autoPlay) {
                    setTimeout(() => this.autoPlayUserTurn(), CONFIG.DELAYS.AI_TURN);
                }
            }
        } else if (this.state.phase === CONFIG.PHASES.END) {
            this.ui.showResultModal(this.state.players, []);
        }

        this.ui.render(this.state, this.mySeat);
    }

    handleRemotePrompt(options) {
        this.ui.showActionBox(
            options.canHu,
            options.canGang,
            options.canPung,
            () => {
                this.ui.hideActionBox();
                this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'HU', tile: options.tile, fromPlayer: options.fromPlayer });
            },
            () => {
                this.ui.hideActionBox();
                this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'GANG', tile: options.tile, fromPlayer: options.fromPlayer });
            },
            () => {
                this.ui.hideActionBox();
                this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PUNG', tile: options.tile, fromPlayer: options.fromPlayer });
            },
            () => {
                this.ui.hideActionBox();
                this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PASS' });
            }
        );
    }

    handleRemoteAction(playerIndex, action, payload) {
        if (!this.p2p || !this.p2p.isHost) return;

        if (action === 'CONFIRM_SWAP') {
            if (this.state.players[playerIndex]) {
                const p = this.state.players[playerIndex];
                if (payload.swapTileIds && Array.isArray(payload.swapTileIds)) {
                    p.swapTiles = payload.swapTileIds.map(id => p.hand.find(x => x.id === id)).filter(Boolean);
                } else if (payload.swapTiles) {
                    p.swapTiles = payload.swapTiles;
                }
                this.checkAndExecuteSwap();
            }
        } else if (action === 'SELECT_QUE') {
            if (this.state.players[playerIndex]) {
                this.state.players[playerIndex].que = payload.que;
                this.log(`${this.state.players[playerIndex].name} 已选择缺${CONFIG.SUITS[payload.que]}`);
                this.ui.render(this.state, this.mySeat);
                this.checkAndExecuteDingQue();
            }
        } else if (action === 'DISCARD') {
            this.executeDiscard(playerIndex, payload.handIndex);
        } else if (action === 'HU') {
            this.doHu(playerIndex, payload.tile, payload.isZiMo, payload.fromPlayer);
        } else if (action === 'GANG') {
            const gangOpt = payload.gangOption || { tile: payload.gangTile, type: 'AN_GANG' };
            this.doGang(playerIndex, gangOpt);
        } else if (action === 'GANG_DISCARD') {
            this.doGangFromDiscard(playerIndex, payload.tile, payload.fromPlayer);
        } else if (action === 'PUNG') {
            this.doPung(playerIndex, payload.tile, payload.fromPlayer);
        } else if (action === 'RESPONSE_OFFTURN') {
            if (this.pendingOffTurnHu) {
                this.pendingOffTurnHu.decisions[playerIndex] = payload.choice;
                this.resolveHuDecisions(
                    this.pendingOffTurnHu.huCandidates,
                    this.pendingOffTurnHu.decisions,
                    this.pendingOffTurnHu.discardTile,
                    this.pendingOffTurnHu.discarderIndex
                );
            } else if (this.pendingOffTurnPungGang && this.pendingOffTurnPungGang.targetIdx === playerIndex) {
                const info = this.pendingOffTurnPungGang;
                this.pendingOffTurnPungGang = null;

                if (payload.choice === 'GANG') {
                    this.doGangFromDiscard(playerIndex, info.discardTile, info.discarderIndex);
                } else if (payload.choice === 'PUNG') {
                    this.doPung(playerIndex, info.discardTile, info.discarderIndex);
                } else {
                    this.arbitratePungGangActions(info.discardTile, info.discarderIndex, info.nextOffset);
                }
            }
        }
    }
}

// グローバルコントローラー
let gameController = null;
if (typeof gameState !== 'undefined') {
    gameController = new GameController(
        gameState,
        typeof soundManager !== 'undefined' ? soundManager : null,
        typeof UIController !== 'undefined' ? UIController : null,
        typeof MahjongEngine !== 'undefined' ? MahjongEngine : null,
        typeof MahjongAI !== 'undefined' ? MahjongAI : null,
        typeof p2pManager !== 'undefined' ? p2pManager : null
    );
    if (typeof window !== 'undefined') {
        window.gameController = gameController;
        window.gameState = gameState;
    }
}

// イベントリスナー設定
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        UIController.init();

        const btnAuto = document.getElementById('btn-auto');
        if (btnAuto) {
            btnAuto.onclick = function () {
                gameState.autoPlay = !gameState.autoPlay;
                this.innerText = `托管: ${gameState.autoPlay ? '开' : '关'}`;
                if (gameState.autoPlay && gameState.phase === CONFIG.PHASES.PLAYING) {
                    if (gameState.currentTurn === gameController.mySeat) gameController.autoPlayUserTurn();
                }
            };
        }

        window.addEventListener('keydown', (e) => {
            const mySeat = gameController.mySeat;
            const p = gameState.players[mySeat];
            if (!p) return;

            if (gameState.phase === CONFIG.PHASES.SWAP3) {
                if (e.key >= '1' && e.key <= '9') {
                    const idx = parseInt(e.key) - 1;
                    if (idx < p.hand.length) gameController.handleTileClick(idx);
                }
                if (e.key === 'Enter' || e.code === 'Space') {
                    const btn = document.getElementById('btn-confirm-swap');
                    if (btn && !btn.disabled) btn.click();
                }
                return;
            }

            if (gameState.phase !== CONFIG.PHASES.PLAYING || gameState.currentTurn !== mySeat) return;

            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key) - 1;
                if (idx < p.hand.length) gameController.handleTileClick(idx);
            } else if (e.code === 'Space') {
                if (p.hand.length % 3 === 2) gameController.handleTileClick(p.hand.length - 1);
            } else if (e.key.toUpperCase() === 'H') {
                const btn = document.getElementById('btn-hu');
                if (btn && btn.style.display !== 'none') btn.click();
            } else if (e.key.toUpperCase() === 'G') {
                const btn = document.getElementById('btn-gang');
                if (btn && btn.style.display !== 'none') btn.click();
            } else if (e.key.toUpperCase() === 'P') {
                const btn = document.getElementById('btn-pung');
                if (btn && btn.style.display !== 'none') btn.click();
            } else if (e.key.toUpperCase() === 'X') {
                const btn = document.getElementById('btn-pass');
                if (btn && btn.parentElement.style.display !== 'none') btn.click();
            }
        });

        // URLの古いハッシュをクリア
        if (window.location.hash) {
            try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
        }

        // セッションから前回の部屋情報を復元
        let savedSession = null;
        try { savedSession = JSON.parse(sessionStorage.getItem('hz_session')); } catch(e) {}

        if (savedSession && savedSession.role === 'client' && savedSession.roomCode) {
            gameController.handleJoinRoom(savedSession.roomCode, savedSession.seatIndex);
        } else {
            const el = document.getElementById('room-code-display');
            const initialCode = (savedSession && savedSession.roomCode) ? savedSession.roomCode : (el ? el.innerText.trim() : null);
            gameController.handleCreateRoom(initialCode);
            gameController.initGame(false);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameController, gameController };
}

