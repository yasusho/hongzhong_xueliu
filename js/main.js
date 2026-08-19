/**
 * 紅中血流成河麻雀 - ゲームコントローラー＆エントリーポイント (GameController)
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
        this.isDiscarding = false;
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
        return (this.p2p && !this.p2p.isHost && this.p2p.seatIndex != null) ? this.p2p.seatIndex : 0;
    }

    isHumanPlayer(pIndex) {
        return (this.p2p?.playersInfo?.[pIndex]) ? !this.p2p.playersInfo[pIndex].isAI : pIndex === 0;
    }

    getPlayerDisplayName(pIndex) {
        const isMe = (pIndex === this.mySeat);
        const isHuman = this.isHumanPlayer(pIndex);
        if (isMe) return `${pIndex + 1}P (你${this.p2p?.isHost ? '/房主' : ''})`;
        return `${pIndex + 1}P (${isHuman ? '玩家' : '电脑'})`;
    }

    updateRoomMembersDisplay() {
        const el = document.getElementById('room-members-display');
        if (!el) return;
        const mySeat = this.mySeat;
        const html = [0, 1, 2, 3].map(i => {
            const isMe = (i === mySeat);
            const isHuman = this.isHumanPlayer(i);
            const label = isMe ? (this.p2p?.isHost ? '你/房主' : '你') : (isHuman ? '玩家' : '电脑');
            const badgeClass = isHuman ? 'member-badge human' : 'member-badge cpu';
            return `<span class="${badgeClass}">${i + 1}P (${label})</span>`;
        }).join(' ');
        el.innerHTML = html;
    }

    initP2PEvents() {
        if (!this.p2p) return;
        this.p2p.onStateReceived = (s) => this.handleRemoteStateSync(s);
        this.p2p.onActionReceived = (p, a, pl) => this.handleRemoteAction(p, a, pl);
        this.p2p.onPromptReceived = (opt) => this.handleRemotePrompt(opt);
        this.p2p.onRoomUpdate = () => {
            for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) {
                if (this.state.players[i]) this.state.players[i].name = this.getPlayerDisplayName(i);
            }
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
        };
    }

    /**
     * ゲーム初期化
     */
    initGame(isOnlineMatch = false) {
        this.isOnline = isOnlineMatch;
        this.isDiscarding = false;
        this.pendingOffTurnHu = null;
        this.pendingOffTurnPungGang = null;

        this.ui.hideInstruction();
        this.ui.hideResultModal();
        this.ui.hideActionBox();
        const tingEl = document.getElementById('ting-info');
        if (tingEl) tingEl.style.display = 'none';

        this.state.reset();
        for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) {
            if (this.state.players[i]) this.state.players[i].name = this.getPlayerDisplayName(i);
        }
        this.updateRoomMembersDisplay();

        const startPlayer = Math.floor(Math.random() * CONFIG.TOTAL_PLAYERS);
        this.state.startPlayer = startPlayer;
        this.state.currentTurn = startPlayer;

        this.clearLog(`新局开始，${this.state.players[startPlayer].name} 起家。`);

        const deck = this.engine.shuffle(this.engine.createDeck());
        for (let r = 0; r < CONFIG.HAND_SIZE; r++) {
            for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) this.state.players[p].hand.push(deck.pop());
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
            this.updateRoomMembersDisplay();
            sessionStorage.setItem('hz_session', JSON.stringify({ role: 'host', roomCode: actualCode }));
        } catch (err) {
            console.error('初始化房间失败:', err);
        }
    }

    async handleChangeRoom() {
        try {
            sessionStorage.removeItem('hz_session');
            const newCode = String(Math.floor(1000 + Math.random() * 9000));
            await this.handleCreateRoom(newCode);
            this.initGame(false);
            this.log(`已切换至新房间: ${newCode} (房主)`);
        } catch (err) {
            console.error('更换房间失败:', err);
        }
    }

    async handleJoinRoom(inputCode = null, savedSeat = null) {
        const code = inputCode || prompt('请输入4位房间号:');
        if (!code) return;
        try {
            this.log(`正在加入房间 ${code}...`);
            await this.p2p.joinRoom(code.trim(), savedSeat);
            this.isOnline = true;
            this.showRoomBar(this.p2p.roomCode, '玩家');
            this.updateRoomMembersDisplay();
            sessionStorage.setItem('hz_session', JSON.stringify({ role: 'client', roomCode: this.p2p.roomCode, seatIndex: this.p2p.seatIndex }));
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
        if (startBtn) startBtn.style.display = (role === '玩家') ? 'none' : 'inline-block';
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
        if (this.p2p && this.p2p.isHost) {
            this.p2p.broadcastState(this.state);
        }
    }

    // --- 換三張フェーズ ---

    startSwap3Phase() {
        this.state.phase = CONFIG.PHASES.SWAP3;
        this.state.selectedSwapIndices = [];

        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            this.state.players[p].swapTiles = this.isHumanPlayer(p) ? [] : this.ai.getSwapTiles(this.state.players[p].hand);
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
        const btn = document.getElementById('btn-confirm-swap');
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

        this.ui.hideInstruction();
        this.log('已提交换牌，等待其他玩家...');

        if (this.p2p && !this.p2p.isHost) {
            this.p2p.sendAction('CONFIRM_SWAP', { swapTiles: userPlayer.swapTiles, swapTileIds });
            return;
        }
        this.checkAndExecuteSwap();
    }

    checkAndExecuteSwap() {
        if (!this.state.players.every(p => p.swapTiles && p.swapTiles.length === 3)) return;

        this.state.players.forEach(p => {
            p.swapTiles.forEach(t => {
                const idx = p.hand.findIndex(x => (x.id != null && t.id != null && x.id === t.id) || (x.suit === t.suit && x.num === t.num));
                if (idx > -1) p.hand.splice(idx, 1);
            });
        });

        const swapped = this.state.players.map(p => [...p.swapTiles]);
        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            this.state.players[(p + 1) % CONFIG.TOTAL_PLAYERS].hand.push(...swapped[p]);
        }

        this.log('换三张完成。');
        this.state.sortAllHands();
        this.startDingQuePhase();
    }

    // --- 定缺フェーズ ---

    startDingQuePhase() {
        this.state.phase = CONFIG.PHASES.DINGQUE;
        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            this.state.players[p].que = this.isHumanPlayer(p) ? null : this.ai.getDingQue(this.state.players[p].hand);
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
        if (this.state.players[this.mySeat]) this.state.players[this.mySeat].que = suit;
        this.ui.hideInstruction();
        this.ui.render(this.state, this.mySeat);
        this.log(`已选择缺${CONFIG.SUITS[suit]}，等待其他玩家...`);

        if (this.p2p && !this.p2p.isHost) {
            this.p2p.sendAction('SELECT_QUE', { que: suit });
            return;
        }
        this.checkAndExecuteDingQue();
    }

    checkAndExecuteDingQue() {
        if (!this.state.players.every(p => !!p.que)) {
            this.syncStateToPeers();
            return;
        }

        this.state.sortAllHands();
        this.state.phase = CONFIG.PHASES.PLAYING;
        this.log(`定缺完毕: ${this.state.players.map(p => `${p.name}缺${CONFIG.SUITS[p.que]}`).join('，')}`);

        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();
        this.processTurn();
    }

    // --- 進行ループ ---

    processTurn(isRinshan = false) {
        if (this.state.phase !== CONFIG.PHASES.PLAYING) return;
        if (this.state.isGameOver()) {
            this.endGame();
            return;
        }

        const p = this.state.players[this.state.currentTurn];

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
                setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CONFIG.DELAYS.AI_TURN);
            }
        } else if (!this.isHumanPlayer(this.state.currentTurn)) {
            setTimeout(() => this.autoPlayPlayerTurn(this.state.currentTurn), CONFIG.DELAYS.AI_TURN);
        }
    }

    checkPlayerTurnActions() {
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length === 0 || p.hand.length % 3 !== 2) return;

        const drawnTile = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawnTile);
        const gangOptions = this.engine.checkCanGang(p);

        if (canHu || gangOptions.length > 0) {
            this.ui.showActionBox(
                canHu, gangOptions.length > 0, false,
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
        this.ui.hideActionBox();
        if (this.p2p && !this.p2p.isHost) {
            this.p2p.sendAction(action, payload);
            return;
        }

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
            if (!p || p.hand.length % 3 !== 2) return;

            const tile = p.hand[index];
            if (!tile) return;

            if (p.hand.some(t => t.suit === p.que) && tile.suit !== p.que) {
                this.log(`必须先打出缺门牌（缺${CONFIG.SUITS[p.que]}）`);
                return;
            }
            if (p.isHu && index !== p.hand.length - 1) {
                this.log('胡牌后只能打出摸到的最后一张牌。');
                return;
            }

            this.ui.hideActionBox();

            if (this.p2p && !this.p2p.isHost) {
                this.p2p.sendAction('DISCARD', { handIndex: index });
                return;
            }
            this.executeDiscard(this.mySeat, index);
        }
    }

    executeDiscard(playerIndex, handIndex) {
        const p = this.state.players[playerIndex];
        if (!p || p.hand.length === 0 || p.hand.length % 3 !== 2 || this.isDiscarding) return;
        this.isDiscarding = true;

        try {
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
            if (playerIndex === this.mySeat) this.ui.updateTingPanel(p);
            this.syncStateToPeers();

            this.checkOffTurnActions(tile, playerIndex);
            this.state.lastActionIsGang = false;
        } finally {
            this.isDiscarding = false;
        }
    }

    // --- 他家捨牌に対するアクション判定 ---

    checkOffTurnActions(discardTile, discarderIndex) {
        const huCandidates = [];
        for (let i = 1; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            if (this.engine.checkCanHu(this.state.players[targetIdx], discardTile)) huCandidates.push(targetIdx);
        }

        if (huCandidates.length > 0) {
            this.arbitrateHuActions(huCandidates, discardTile, discarderIndex);
            return;
        }
        this.arbitratePungGangActions(discardTile, discarderIndex, 1);
    }

    arbitrateHuActions(huCandidates, discardTile, discarderIndex) {
        const decisions = {};
        let pendingCount = 0;

        huCandidates.forEach(pIdx => {
            if (!this.isHumanPlayer(pIdx) || (pIdx === this.mySeat && this.state.autoPlay)) {
                decisions[pIdx] = 'HU';
            } else if (pIdx === this.mySeat) {
                pendingCount++;
                this.ui.showActionBox(true, false, false,
                    () => { this.ui.hideActionBox(); decisions[pIdx] = 'HU'; this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex); },
                    null, null,
                    () => { this.ui.hideActionBox(); decisions[pIdx] = 'PASS'; this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex); }
                );
            } else {
                const sent = this.p2p.sendToSeat(pIdx, {
                    type: 'PROMPT_OFFTURN_ACTION',
                    options: { canHu: true, canGang: false, canPung: false, tile: discardTile, fromPlayer: discarderIndex }
                });
                if (sent) {
                    pendingCount++;
                    setTimeout(() => {
                        if (this.pendingOffTurnHu && this.pendingOffTurnHu.decisions[pIdx] === undefined) {
                            this.pendingOffTurnHu.decisions[pIdx] = 'PASS';
                            this.resolveHuDecisions(this.pendingOffTurnHu.huCandidates, this.pendingOffTurnHu.decisions, this.pendingOffTurnHu.discardTile, this.pendingOffTurnHu.discarderIndex);
                        }
                    }, 8000);
                } else {
                    decisions[pIdx] = 'PASS';
                }
            }
        });

        this.pendingOffTurnHu = { huCandidates, decisions, discardTile, discarderIndex, pendingCount };
        if (pendingCount === 0) this.resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex);
    }

    resolveHuDecisions(huCandidates, decisions, discardTile, discarderIndex) {
        if (!huCandidates.every(pIdx => decisions[pIdx] !== undefined)) return;
        this.pendingOffTurnHu = null;

        const actualHuPlayers = huCandidates.filter(pIdx => decisions[pIdx] === 'HU');
        if (actualHuPlayers.length > 0) {
            actualHuPlayers.forEach(pIdx => this.doHu(pIdx, discardTile, false, discarderIndex));
            this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
            this.syncStateToPeers();
            setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
            return;
        }

        this.arbitratePungGangActions(discardTile, discarderIndex, 1);
    }

    arbitratePungGangActions(discardTile, discarderIndex, startIndexOffset = 1) {
        for (let i = startIndexOffset; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            const targetP = this.state.players[targetIdx];
            if (targetP.isHu) continue;

            const canGang = this.engine.checkCanPungOrGang(targetP, discardTile, 'GANG');
            const canPung = this.engine.checkCanPungOrGang(targetP, discardTile, 'PUNG');
            if (!canGang && !canPung) continue;

            if (!this.isHumanPlayer(targetIdx) || (targetIdx === this.mySeat && this.state.autoPlay)) {
                if (canGang && this.ai.shouldGang(targetP, discardTile)) {
                    this.doGangFromDiscard(targetIdx, discardTile, discarderIndex);
                    return;
                } else if (canPung && this.ai.shouldPung(targetP, discardTile)) {
                    this.doPung(targetIdx, discardTile, discarderIndex);
                    return;
                }
                if (targetIdx === this.mySeat) {
                    this.arbitratePungGangActions(discardTile, discarderIndex, i + 1);
                    return;
                }
            } else if (targetIdx === this.mySeat) {
                this.ui.showActionBox(false, canGang, canPung,
                    null,
                    () => { this.ui.hideActionBox(); this.doGangFromDiscard(this.mySeat, discardTile, discarderIndex); },
                    () => { this.ui.hideActionBox(); this.doPung(this.mySeat, discardTile, discarderIndex); },
                    () => { this.ui.hideActionBox(); this.arbitratePungGangActions(discardTile, discarderIndex, i + 1); }
                );
                return;
            } else {
                const sent = this.p2p.sendToSeat(targetIdx, {
                    type: 'PROMPT_OFFTURN_ACTION',
                    options: { canHu: false, canGang, canPung, tile: discardTile, fromPlayer: discarderIndex }
                });
                if (sent) {
                    this.pendingOffTurnPungGang = { targetIdx, discardTile, discarderIndex, nextOffset: i + 1 };
                    setTimeout(() => {
                        if (this.pendingOffTurnPungGang?.targetIdx === targetIdx) {
                            const info = this.pendingOffTurnPungGang;
                            this.pendingOffTurnPungGang = null;
                            this.arbitratePungGangActions(info.discardTile, info.discarderIndex, info.nextOffset);
                        }
                    }, 8000);
                    return;
                }
            }
        }

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

        if (playerIndex === this.mySeat) this.checkPlayerTurnActions();
        else if (!this.isHumanPlayer(playerIndex)) setTimeout(() => this.autoPlayPlayerTurn(playerIndex), CONFIG.DELAYS.AI_TURN);
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
        if (!gangOption?.tile) return;
        this.sound.play('action');
        const p = this.state.players[playerIndex];
        const tile = gangOption.tile;

        if (gangOption.type === 'JIA_GANG') {
            const idx = p.hand.findIndex(t => t.code === tile.code);
            if (idx > -1) p.hand.splice(idx, 1);
            const meld = p.melds.find(m => m.type === 'PUNG' && m.tile.code === tile.code);
            if (meld) { meld.type = 'GANG'; meld.isAnGang = false; }
            this.log(`${p.name} 补杠 ${this.engine.tileToString(tile)}`);
        } else {
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
        if (!p) return;
        p.isHu = true;

        const fanInfo = this.engine.calculateFan(p, tile, isZiMo, fromPlayer, this.state);
        const score = CONFIG.BASE_SCORE * Math.pow(2, fanInfo.fan);

        this.log(`★ ${p.name} ${isZiMo ? '自摸' : '点炮'}胡: ${fanInfo.name} ${fanInfo.fan}番 ${score}分 ${this.engine.tileToString(tile)}`);
        p.huRecords.push({ fan: fanInfo.fan, fanName: fanInfo.name, score, isZiMo });

        this.state.lastActionIsGang = false;
        this.state.lastGangPlayer = null;

        if (isZiMo) {
            for (let other = 0; other < CONFIG.TOTAL_PLAYERS; other++) {
                if (other !== playerIndex) this.state.transferScore(other, playerIndex, score);
            }
            this.ui.hideActionBox();
            this.ui.render(this.state, this.mySeat);
            this.syncStateToPeers();

            if (this.state.isGameOver()) {
                this.endGame();
                return;
            }

            // 自摸和了後はツモ牌を即座に河に打牌して進行
            this.executeDiscard(playerIndex, p.hand.length - 1);
        } else {
            this.state.transferScore(fromPlayer, playerIndex, score);
            this.ui.hideActionBox();
            this.ui.render(this.state, this.mySeat);
            this.syncStateToPeers();

            if (this.state.isGameOver()) {
                this.endGame();
            }
        }
    }

    // --- 自動手番処理 ---

    autoPlayPlayerTurn(pIdx) {
        if (this.state.currentTurn !== pIdx || this.state.phase !== CONFIG.PHASES.PLAYING) return;
        const p = this.state.players[pIdx];
        if (!p || p.hand.length === 0 || p.hand.length % 3 !== 2) return; // 摸牌状態でのみ打牌可能

        const drawnTile = p.hand[p.hand.length - 1];
        if (this.engine.checkCanHu(p, drawnTile)) {
            this.doHu(pIdx, drawnTile, true);
            return;
        }

        if (p.isHu) {
            this.executeDiscard(pIdx, p.hand.length - 1);
            return;
        }

        const gangTiles = this.engine.checkCanGang(p);
        if (gangTiles.length > 0 && !this.isHumanPlayer(pIdx)) {
            this.doGang(pIdx, gangTiles[0]);
            return;
        }

        this.executeDiscard(pIdx, this.ai.chooseDiscardIndex(p));
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
        const unHuTing = [], unHuNoTing = [];
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

    // --- P2P同期 ---

    handleRemoteStateSync(remoteState) {
        const savedIndices = this.state.selectedSwapIndices || [];
        const savedQue = this.state.players[this.mySeat]?.que;
        this.state.wall = null;
        Object.assign(this.state, remoteState);

        if (savedQue && this.state.players[this.mySeat] && !this.state.players[this.mySeat].que) {
            this.state.players[this.mySeat].que = savedQue;
        }

        for (let i = 0; i < CONFIG.TOTAL_PLAYERS; i++) {
            if (this.state.players[i]) this.state.players[i].name = this.getPlayerDisplayName(i);
        }
        this.updateRoomMembersDisplay();

        if (this.state.phase === CONFIG.PHASES.SWAP3) {
            this.state.selectedSwapIndices = savedIndices;
            const myP = this.state.players[this.mySeat];
            if (!myP?.swapTiles || myP.swapTiles.length !== 3) {
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
            if (!myP?.que) {
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
                if (this.state.autoPlay || this.state.players[this.mySeat]?.isHu) {
                    setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CONFIG.DELAYS.AI_TURN);
                }
            }
        } else if (this.state.phase === CONFIG.PHASES.END) {
            this.ui.showResultModal(this.state.players, []);
        }

        this.ui.render(this.state, this.mySeat);
    }

    handleRemotePrompt(options) {
        this.ui.showActionBox(
            options.canHu, options.canGang, options.canPung,
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'HU', tile: options.tile, fromPlayer: options.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'GANG', tile: options.tile, fromPlayer: options.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PUNG', tile: options.tile, fromPlayer: options.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PASS' }); }
        );
    }

    handleRemoteAction(playerIndex, action, payload) {
        if (!this.p2p?.isHost) return;
        const p = this.state.players[playerIndex];
        if (!p) return;

        switch (action) {
            case 'CONFIRM_SWAP': {
                if (payload.swapTileIds) {
                    p.swapTiles = payload.swapTileIds.map(id => p.hand.find(x => x.id === id)).filter(Boolean);
                } else if (payload.swapTiles) {
                    p.swapTiles = payload.swapTiles.map(t => p.hand.find(x => x.suit === t.suit && x.num === t.num)).filter(Boolean);
                }
                if (!p.swapTiles || p.swapTiles.length !== 3) {
                    p.swapTiles = p.hand.filter(t => t.suit !== 'HZ').slice(0, 3);
                }
                this.checkAndExecuteSwap();
                break;
            }
            case 'SELECT_QUE':
                p.que = payload.que;
                this.log(`${p.name} 已选择缺${CONFIG.SUITS[payload.que]}`);
                this.ui.render(this.state, this.mySeat);
                this.checkAndExecuteDingQue();
                break;
            case 'DISCARD':
                this.executeDiscard(playerIndex, payload.handIndex);
                break;
            case 'HU':
                this.doHu(playerIndex, payload.tile, payload.isZiMo, payload.fromPlayer);
                break;
            case 'GANG':
                this.doGang(playerIndex, payload.gangOption || { tile: payload.gangTile, type: 'AN_GANG' });
                break;
            case 'GANG_DISCARD':
                this.doGangFromDiscard(playerIndex, payload.tile, payload.fromPlayer);
                break;
            case 'PUNG':
                this.doPung(playerIndex, payload.tile, payload.fromPlayer);
                break;
            case 'RESPONSE_OFFTURN':
                if (this.pendingOffTurnHu) {
                    this.pendingOffTurnHu.decisions[playerIndex] = payload.choice;
                    this.resolveHuDecisions(this.pendingOffTurnHu.huCandidates, this.pendingOffTurnHu.decisions, this.pendingOffTurnHu.discardTile, this.pendingOffTurnHu.discarderIndex);
                } else if (this.pendingOffTurnPungGang?.targetIdx === playerIndex) {
                    const info = this.pendingOffTurnPungGang;
                    this.pendingOffTurnPungGang = null;
                    if (payload.choice === 'GANG') this.doGangFromDiscard(playerIndex, info.discardTile, info.discarderIndex);
                    else if (payload.choice === 'PUNG') this.doPung(playerIndex, info.discardTile, info.discarderIndex);
                    else this.arbitratePungGangActions(info.discardTile, info.discarderIndex, info.nextOffset);
                }
                break;
        }
    }
}

// グローバル初期化
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

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        UIController.init();

        const btnAuto = document.getElementById('btn-auto');
        if (btnAuto) {
            btnAuto.onclick = () => {
                gameState.autoPlay = !gameState.autoPlay;
                btnAuto.innerText = `托管: ${gameState.autoPlay ? '开' : '关'}`;
                if (gameState.autoPlay && gameState.phase === CONFIG.PHASES.PLAYING && gameState.currentTurn === gameController.mySeat) {
                    gameController.autoPlayPlayerTurn(gameController.mySeat);
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
                    document.getElementById('btn-confirm-swap')?.click();
                }
                return;
            }

            if (gameState.phase !== CONFIG.PHASES.PLAYING || gameState.currentTurn !== mySeat || p.hand.length % 3 !== 2) return;

            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key) - 1;
                if (idx < p.hand.length) gameController.handleTileClick(idx);
            } else if (e.code === 'Space') {
                gameController.handleTileClick(p.hand.length - 1);
            } else {
                const btnMap = { H: 'btn-hu', G: 'btn-gang', P: 'btn-pung', X: 'btn-pass' };
                const btnId = btnMap[e.key.toUpperCase()];
                if (btnId) {
                    const btn = document.getElementById(btnId);
                    if (btn && btn.style.display !== 'none') btn.click();
                }
            }
        });

        if (window.location.hash) {
            try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
        }

        let saved = null;
        try { saved = JSON.parse(sessionStorage.getItem('hz_session')); } catch(e) {}

        if (saved?.role === 'client' && saved.roomCode) {
            gameController.handleJoinRoom(saved.roomCode, saved.seatIndex);
        } else {
            const el = document.getElementById('room-code-display');
            const code = saved?.roomCode || (el ? el.innerText.trim() : null);
            gameController.handleCreateRoom(code);
            gameController.initGame(false);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameController, gameController };
}
