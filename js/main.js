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
        this.initP2PEvents();
    }

    get mySeat() {
        return this.isOnline ? this.p2p.seatIndex : 0;
    }

    isHumanPlayer(pIndex) {
        return this.isOnline ? !this.p2p.playersInfo[pIndex].isAI : (pIndex === 0);
    }

    initP2PEvents() {
        if (!this.p2p) return;
        this.p2p.onStateReceived = (remoteState) => this.handleRemoteStateSync(remoteState);
        this.p2p.onActionReceived = (pIdx, action, payload) => this.handleRemoteAction(pIdx, action, payload);
        this.p2p.onRoomUpdate = (playersInfo) => {
            const membersEl = typeof document !== 'undefined' ? document.getElementById('room-members-display') : null;
            if (membersEl) {
                membersEl.innerText = playersInfo.map(p => `${p.name}${p.isAI ? '(CPU)' : '(人)'}`).join(' ');
            }
            const hostStartBtn = typeof document !== 'undefined' ? document.getElementById('btn-host-start') : null;
            if (hostStartBtn && this.p2p.isHost) hostStartBtn.style.display = 'inline-block';
        };
    }

    /**
     * ゲームの新規開始
     */
    initGame() {
        this.isOnline = false;
        if (this.p2p) this.p2p.reset();

        const bar = typeof document !== 'undefined' ? document.getElementById('room-bar') : null;
        if (bar) bar.style.display = 'none';

        this.ui.hideInstruction();
        this.ui.hideResultModal();
        this.ui.hideActionBox();
        const tingEl = typeof document !== 'undefined' ? document.getElementById('ting-info') : null;
        if (tingEl) tingEl.style.display = 'none';

        this.state.reset();
        const startPlayer = Math.floor(Math.random() * CONFIG.TOTAL_PLAYERS);
        this.state.startPlayer = startPlayer;
        this.state.currentTurn = startPlayer;

        this.ui.clearLog(`新局开始，${this.state.players[startPlayer].name} 起家。`);

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

    async handleCreateRoom() {
        try {
            this.ui.log('正在连接网络并创建房间...');
            const code = await this.p2p.createRoom();
            this.isOnline = true;
            this.showRoomBar(code, '房主');
            this.ui.log(`房间创建成功，房间号: ${code}`);
            window.location.hash = code;
        } catch (err) {
            alert('创建房间失败: ' + (err.message || err));
            this.ui.log('创建房间失败: ' + (err.message || err));
        }
    }

    async handleJoinRoom(inputCode = null) {
        const code = inputCode || prompt('请输入房间号 (如 hz1234):');
        if (!code) return;

        try {
            this.ui.log(`正在加入房间 ${code}...`);
            await this.p2p.joinRoom(code.trim());
            this.isOnline = true;
            this.showRoomBar(code.trim(), '玩家');
            window.location.hash = code.trim();
        } catch (err) {
            alert('加入房间失败: ' + (err.message || err));
            this.ui.log('加入房间失败: ' + (err.message || err));
        }
    }

    showRoomBar(code, role) {
        const bar = document.getElementById('room-bar');
        const codeEl = document.getElementById('room-code-display');
        const roleEl = document.getElementById('room-role-display');
        if (bar) bar.style.display = 'flex';
        if (codeEl) codeEl.innerText = code;
        if (roleEl) roleEl.innerText = `(${role})`;
    }

    copyRoomLink() {
        const url = `${window.location.origin}${window.location.pathname}#${this.p2p.roomCode}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('邀请链接已复制到剪贴板！发送给好友即可加入对局。');
        }).catch(() => prompt('请复制以下链接:', url));
    }

    startOnlineMatch() {
        if (!this.p2p.isHost) return;
        this.initGame();
        this.syncStateToPeers();
    }

    syncStateToPeers() {
        if (this.isOnline && this.p2p.isHost) {
            this.p2p.broadcastState(this.state);
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
        if (!tile || tile.suit === 'HZ') return;

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
        if (this.state.selectedSwapIndices.length !== 3) return;
        this.sound.play('select');

        const userPlayer = this.state.players[this.mySeat];
        userPlayer.swapTiles = this.state.selectedSwapIndices.map(i => userPlayer.hand[i]);

        if (this.isOnline && !this.p2p.isHost) {
            this.p2p.sendAction('CONFIRM_SWAP', { swapTiles: userPlayer.swapTiles });
            this.ui.hideInstruction();
            this.ui.log('已提交换牌，等待其他玩家...');
            return;
        }

        this.checkAndExecuteSwap();
    }

    checkAndExecuteSwap() {
        const allReady = this.state.players.every(p => p.swapTiles && p.swapTiles.length === 3);
        if (!allReady) return;

        // 交換実行（時計回りに受け渡し）
        this.state.players.forEach(p => {
            p.swapTiles.forEach(t => {
                const idx = p.hand.findIndex(x => x.id === t.id);
                if (idx > -1) p.hand.splice(idx, 1);
            });
        });

        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            const nextP = (p + 1) % CONFIG.TOTAL_PLAYERS;
            this.state.players[nextP].hand.push(...this.state.players[p].swapTiles);
        }

        this.ui.log('换牌完成。');
        this.state.sortAllHands();
        this.startDingQuePhase();
    }

    // --- 定缺フェーズ ---

    startDingQuePhase() {
        this.state.phase = CONFIG.PHASES.DINGQUE;

        for (let p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
            if (!this.isHumanPlayer(p)) {
                this.state.players[p].que = this.ai.getDingQue(this.state.players[p].hand);
            }
        }

        this.ui.render(this.state, this.mySeat);
        this.ui.showInstruction('定缺', '选择缺门', `
            <button onclick="gameController.selectUserQue('W')">缺万</button>
            <button onclick="gameController.selectUserQue('T')">缺筒</button>
            <button onclick="gameController.selectUserQue('B')">缺条</button>
        `);
        this.syncStateToPeers();
    }

    selectUserQue(suit) {
        this.sound.play('select');
        this.state.players[this.mySeat].que = suit;
        this.ui.hideInstruction();

        if (this.isOnline && !this.p2p.isHost) {
            this.p2p.sendAction('SELECT_QUE', { que: suit });
            this.ui.log(`已选择缺${CONFIG.SUITS[suit]}，等待其他玩家...`);
            return;
        }

        this.checkAndExecuteDingQue();
    }

    checkAndExecuteDingQue() {
        if (!this.state.players.every(p => !!p.que)) return;

        this.state.sortAllHands();
        this.state.phase = CONFIG.PHASES.PLAYING;

        const queSummary = this.state.players.map(p => `${p.name}缺${CONFIG.SUITS[p.que]}`).join(' ');
        this.ui.log(`定缺: ${queSummary}`);

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
                this.ui.log(`摸 ${isRinshan ? '[杠上牌] ' : ''}${this.engine.tileToString(drawnTile)}`);
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

        // 実行前に既存のアクションダイアログを閉じる（槓後に新たな胡アクションが開くのを阻害しないため）
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
                this.ui.log('当前不是你的手番，请等待其他玩家打牌。');
                return;
            }
            const p = this.state.players[this.mySeat];
            const tile = p.hand[index];
            const hasQueTiles = p.hand.some(t => t.suit === p.que);
            if (hasQueTiles && tile.suit !== p.que) {
                this.ui.log(`必须先打出缺门牌（缺${CONFIG.SUITS[p.que]}）`);
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
        this.ui.log(`${p.name} 打 ${this.engine.tileToString(tile)}`);

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
        const huPlayers = [];
        for (let i = 1; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            if (this.engine.checkCanHu(this.state.players[targetIdx], discardTile)) {
                huPlayers.push(targetIdx);
            }
        }

        if (huPlayers.length > 0) {
            if (huPlayers.includes(this.mySeat) && !this.state.players[this.mySeat].isHu && !this.state.autoPlay) {
                this.showUserHuAction(discardTile, discarderIndex, huPlayers);
                return;
            }

            huPlayers.forEach(pIdx => this.doHu(pIdx, discardTile, false, discarderIndex));
            this.state.currentTurn = discarderIndex;
            setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
            return;
        }

        this.checkPungGangActions(discardTile, discarderIndex);
    }

    showUserHuAction(discardTile, discarderIndex, huPlayers) {
        this.ui.showActionBox(
            true, false, false,
            () => {
                this.ui.hideActionBox();
                huPlayers.forEach(pIdx => this.doHu(pIdx, discardTile, false, discarderIndex));
                this.state.currentTurn = discarderIndex;
                setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
            },
            null, null,
            () => {
                this.ui.hideActionBox();
                const aiHu = huPlayers.filter(idx => idx !== this.mySeat);
                if (aiHu.length > 0) {
                    aiHu.forEach(pIdx => this.doHu(pIdx, discardTile, false, discarderIndex));
                    this.state.currentTurn = discarderIndex;
                    setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
                } else {
                    this.checkPungGangActions(discardTile, discarderIndex);
                }
            }
        );
    }

    checkPungGangActions(discardTile, discarderIndex, startIndexOffset = 1) {
        let actionTriggered = false;

        for (let i = startIndexOffset; i <= 3; i++) {
            const targetIdx = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            const targetP = this.state.players[targetIdx];
            if (targetP.isHu) continue;

            const canGang = this.engine.checkCanPungOrGang(targetP, discardTile, 'GANG');
            const canPung = this.engine.checkCanPungOrGang(targetP, discardTile, 'PUNG');

            if (this.isHumanPlayer(targetIdx)) {
                if ((canGang || canPung) && targetIdx === this.mySeat) {
                    actionTriggered = true;
                    this.ui.showActionBox(
                        false, canGang, canPung,
                        null,
                        () => { this.doGangFromDiscard(this.mySeat, discardTile, discarderIndex); this.ui.hideActionBox(); },
                        () => { this.doPung(this.mySeat, discardTile, discarderIndex); this.ui.hideActionBox(); },
                        () => {
                            this.ui.hideActionBox();
                            this.checkPungGangActions(discardTile, discarderIndex, i + 1);
                        }
                    );
                    break;
                }
            } else {
                if (canGang && this.ai.shouldGang(targetP, discardTile)) {
                    actionTriggered = true;
                    this.doGangFromDiscard(targetIdx, discardTile, discarderIndex);
                    break;
                } else if (canPung && this.ai.shouldPung(targetP, discardTile)) {
                    actionTriggered = true;
                    this.doPung(targetIdx, discardTile, discarderIndex);
                    break;
                }
            }
        }

        if (!actionTriggered) {
            this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
            setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
        }
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
        this.ui.log(`${p.name} 碰 ${this.engine.tileToString(tile)}`);

        this.state.currentTurn = playerIndex;
        this.state.lastActionIsGang = false;
        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();

        if (playerIndex === this.mySeat) this.checkPlayerTurnActions();
        else setTimeout(() => this.processAITurn(), CONFIG.DELAYS.AI_TURN);
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
        this.ui.log(`${p.name} 明杠 ${this.engine.tileToString(tile)}`);
        this.state.transferScore(fromPlayer, playerIndex, CONFIG.GANG_SCORE);

        this.state.lastActionIsGang = true;
        this.state.lastGangPlayer = playerIndex;
        this.state.currentTurn = playerIndex;
        this.syncStateToPeers();
        this.processTurn(true);
    }

    doGang(playerIndex, gangOption) {
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
            this.ui.log(`${p.name} 补杠 ${this.engine.tileToString(tile)}`);
        } else {
            // 暗槓
            p.hand = p.hand.filter(t => t.code !== tile.code);
            p.melds.push({ type: 'GANG', tile, from: playerIndex, isAnGang: true });
            this.ui.log(`${p.name} 暗杠 ${this.engine.tileToString(tile)}`);
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

        this.ui.log(`★ ${p.name} ${isZiMo ? '自摸' : '点炮'}胡: ${fanInfo.name} ${fanInfo.fan}番 ${score}分 ${this.engine.tileToString(tile)}`);
        p.huRecords.push({ fan: fanInfo.fan, fanName: fanInfo.name, score });

        // 和了判定後は槓フラグをリセット
        this.state.lastActionIsGang = false;
        this.state.lastGangPlayer = null;

        if (isZiMo) {
            for (let other = 0; other < CONFIG.TOTAL_PLAYERS; other++) {
                if (other !== playerIndex) this.state.transferScore(other, playerIndex, score);
            }
            // ツモ和了牌を手牌から除外（和了記録に保持し、河には捨てない）
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
        const drawnTile = p.hand[p.hand.length - 1];

        if (p.isHu) {
            if (this.engine.checkCanHu(p, drawnTile)) this.doHu(turn, drawnTile, true);
            else this.executeDiscard(turn, p.hand.length - 1);
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
        const drawnTile = p.hand[p.hand.length - 1];

        if (this.engine.checkCanHu(p, drawnTile)) {
            this.doHu(this.mySeat, drawnTile, true);
            return;
        }
        this.executeDiscard(this.mySeat, this.ai.chooseDiscardIndex(p));
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
                this.ui.log(msg);
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
                    this.ui.log(msg);
                    penaltyLogs.push(msg);
                });
            });
        }

        this.ui.render(this.state, this.mySeat);
        this.ui.showResultModal(this.state.players, penaltyLogs);
        this.syncStateToPeers();
    }

    // --- P2P同期受信ハンドラ ---

    handleRemoteStateSync(remoteState) {
        Object.assign(this.state, remoteState);
        this.ui.render(this.state, this.mySeat);

        if (this.state.phase === CONFIG.PHASES.SWAP3) {
            this.ui.showInstruction('换三张', '选3张牌', `
                <button id="btn-confirm-swap" disabled onclick="gameController.confirmUserSwap()">确定 (0/3)</button>
            `);
        } else if (this.state.phase === CONFIG.PHASES.DINGQUE) {
            this.ui.showInstruction('定缺', '选择缺门', `
                <button onclick="gameController.selectUserQue('W')">缺万</button>
                <button onclick="gameController.selectUserQue('T')">缺筒</button>
                <button onclick="gameController.selectUserQue('B')">缺条</button>
            `);
        } else if (this.state.phase === CONFIG.PHASES.PLAYING) {
            this.ui.hideInstruction();
            if (this.state.currentTurn === this.mySeat) this.checkPlayerTurnActions();
        }
    }

    handleRemoteAction(playerIndex, action, payload) {
        if (!this.p2p.isHost) return;
        if (action === 'CONFIRM_SWAP') {
            this.state.players[playerIndex].swapTiles = payload.swapTiles;
            this.checkAndExecuteSwap();
        } else if (action === 'SELECT_QUE') {
            this.state.players[playerIndex].que = payload.que;
            this.checkAndExecuteDingQue();
        } else if (action === 'DISCARD') {
            this.executeDiscard(playerIndex, payload.handIndex);
        } else if (action === 'HU') {
            this.doHu(playerIndex, payload.tile, payload.isZiMo, payload.fromPlayer);
        } else if (action === 'GANG') {
            this.doGang(playerIndex, payload.gangTile);
        } else if (action === 'GANG_DISCARD') {
            this.doGangFromDiscard(playerIndex, payload.tile, payload.fromPlayer);
        } else if (action === 'PUNG') {
            this.doPung(playerIndex, payload.tile, payload.fromPlayer);
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
            btnAuto.onclick = function() {
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

        // URLハッシュから自動参加
        if (window.location.hash && window.location.hash.length > 1) {
            const roomCode = window.location.hash.substring(1);
            if (roomCode.startsWith('hz') && confirm(`检测到房间链接，是否加入房间 ${roomCode}？`)) {
                gameController.handleJoinRoom(roomCode);
                return;
            }
        }

        gameController.initGame();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameController, gameController };
}
