/**
 * 紅中血流成河麻雀 - ゲーム進行コントローラー (GameController)
 */

const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);

class GameController {
    constructor(state, sound, ui, engine, ai, p2p, flow, dslPrng = null) {
        Object.assign(this, {
            state, sound, ui, engine, ai, p2p, flow, dslPrng,
            isOnline: false,
            isDiscarding: false,
            pendingOffTurn: null,
            pinyinMode: false
        });
        this.initP2PEvents();
    }

    get config() {
        return CONFIG;
    }

    log(text) {
        this.state.logs = this.state.logs || [];
        this.state.logs.push(text);
        if (this.state.logs.length > 50) this.state.logs.shift();
        this.ui.log(text);
    }

    clearLog(text = '系统就绪。') {
        this.state.logs = [text];
        this.ui.clearLog(text);
    }

    get mySeat() {
        return (!this.p2p?.isHost && this.p2p?.seatIndex != null) ? Number(this.p2p.seatIndex) : 0;
    }

    getMyName() {
        try { return localStorage.getItem('hz_username') || ''; } catch (e) { return ''; }
    }

    setMyName(name) {
        try { localStorage.setItem('hz_username', name); } catch (e) {}
    }

    toggleLanguage() {
        if (typeof I18nHelper !== 'undefined') {
            I18nHelper.toggleLanguage();
            try { localStorage.setItem('hz_lang', I18nHelper.lang); } catch (e) {}
            this.ui.applyPinyinMode();
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
        }
    }

    togglePinyin() {
        if (typeof I18nHelper !== 'undefined') {
            I18nHelper.togglePinyin();
            try { localStorage.setItem('hz_pinyin', String(I18nHelper.isPinyin)); } catch (e) {}
            this.ui.applyPinyinMode();
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
        }
    }

    checkPlayerEliminations() {
        this.state.players.forEach(p => {
            if (p.score <= 0 && !p.isEliminated) {
                p.isEliminated = true;
                this.log(`★ ${p.name} ${pyT('脱落')} (${pyT('积分')} <= 0)`);
            }
        });
    }

    isHumanPlayer = idx => this.p2p?.playersInfo?.[idx] ? !this.p2p.playersInfo[idx].isAI : idx === 0;

    getBasePlayerName = idx => {
        const info = this.p2p?.playersInfo?.[idx];
        if (info?.name) return info.name;
        if (idx === 0) return '1P (房主)';
        return this.isHumanPlayer(idx) ? `${idx + 1}P (玩家)` : `${idx + 1}P (电脑)`;
    };

    getMemberBadgeName = idx => {
        const base = this.getBasePlayerName(idx);
        return idx === this.mySeat ? `${base} (你)` : base;
    };

    updateRoomMembersDisplay() {
        const el = UIController.$('room-members-display');
        if (el) {
            el.innerHTML = [0, 1, 2, 3].map(i => {
                const name = pyT(this.getMemberBadgeName(i));
                return `<span class="member-badge ${this.isHumanPlayer(i) ? 'human' : 'cpu'}" onclick="${i === this.mySeat ? 'gameController.handleChangeName()' : ''}" title="${i === this.mySeat ? pyT('点击修改昵称') : ''}">${name}</span>`;
            }).join(' ');
        }
    }

    initP2PEvents() {
        if (!this.p2p) return;
        this.p2p.onStateReceived = s => this.handleRemoteStateSync(s);
        this.p2p.onActionReceived = (p, a, pl) => this.handleRemoteAction(p, a, pl);
        this.p2p.onPromptReceived = opt => this.handleRemotePrompt(opt);
        this.p2p.onRoomUpdate = () => {
            this.state.players.forEach((p, i) => { p.name = this.getBasePlayerName(i); });
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
        };
    }

    initGame(isOnlineMatch = false, customSeed = null) {
        const CFG = this.config;
        Object.assign(this, { isOnline: isOnlineMatch, isDiscarding: false, pendingOffTurn: null });
        this.ui.hideInstruction();
        this.ui.hideResultModal();
        this.ui.hideActionBox();
        const tingEl = UIController.$('ting-info');
        if (tingEl) tingEl.style.display = 'none';

        this.state.reset();
        this.state.players.forEach((p, i) => { p.name = this.getBasePlayerName(i); });
        this.updateRoomMembersDisplay();

        const seed = customSeed || Math.floor(Math.random() * 0xFFFFFFFF);
        this.state.gameSeed = seed;

        const PRNGClass = this.dslPrng || DeterministicPRNG;
        const prng = PRNGClass ? new PRNGClass(seed) : null;

        const start = prng ? prng.nextInt(0, CFG.TOTAL_PLAYERS - 1) : Math.floor(Math.random() * CFG.TOTAL_PLAYERS);
        this.state.startPlayer = this.state.currentTurn = start;
        this.clearLog(`新局开始，${this.state.players[start].name} 起家`);

        const deck = this.engine.shuffle(this.engine.createDeck(), prng);
        for (let r = 0; r < CFG.HAND_SIZE; r++) {
            for (let p = 0; p < CFG.TOTAL_PLAYERS; p++) this.state.players[p].hand.push(deck.pop());
        }
        this.state.players[start].hand.push(deck.pop());
        this.state.wall = deck;
        this.state.wallCount = deck.length;
        this.state.sortAllHands();
        this.startSwap3Phase();
    }

    startOnlineMatch() {
        if (!this.p2p?.isHost) return;
        this.initGame(true);
        this.syncStateToPeers();
    }

    handleResetAndNewRoom() {
        UIController.hideResultModal();
        try { sessionStorage.removeItem('hz_session'); } catch (e) {}
        this.p2p.reset();
        this.isOnline = false;
        const code = String(Math.floor(1000 + Math.random() * 9000));
        this.handleCreateRoom(code);
        this.initGame(false);
        this.log(`新房间: ${code}`);
    }

    handleChangeName() {
        const current = this.getMyName() || (this.mySeat === 0 ? '1P' : `${this.mySeat + 1}P`);
        const input = prompt(pyT('请输入你的玩家昵称 (最多8字):'), current);
        if (input == null) return;
        const rawName = input.trim().slice(0, 8) || (this.mySeat === 0 ? '1P' : `${this.mySeat + 1}P`);
        this.setMyName(rawName);

        const isHostOrSolo = (this.mySeat === 0 || !this.p2p || !this.p2p.roomCode || this.p2p.isHost);
        const formattedName = isHostOrSolo ? `${rawName} (房主)` : rawName;

        if (this.state.players[this.mySeat]) {
            this.state.players[this.mySeat].name = formattedName;
        }
        if (this.p2p?.playersInfo?.[this.mySeat]) {
            this.p2p.playersInfo[this.mySeat].name = formattedName;
        }

        if (isHostOrSolo) {
            if (this.p2p?.isHost) {
                this.p2p.broadcastRoomInfo();
                this.syncStateToPeers();
            }
        } else {
            this.p2p?.sendAction('SET_NAME', { name: formattedName });
        }
        this.log(`改名: ${rawName}`);

        this.updateRoomMembersDisplay();
        this.ui.render(this.state, this.mySeat);
    }

    async handleCreateRoom(code = null) {
        try {
            const hostName = this.getMyName() ? `${this.getMyName()} (房主)` : '1P (房主)';
            const c = await this.p2p.createRoom(code, hostName);
            this.showRoomBar(c, '房主');
            this.updateRoomMembersDisplay();
            try { sessionStorage.setItem('hz_session', JSON.stringify({ role: 'host', roomCode: c })); } catch (e) {}
        } catch (e) {}
    }

    async handleChangeRoom() {
        try { sessionStorage.removeItem('hz_session'); } catch (e) {}
        const code = String(Math.floor(1000 + Math.random() * 9000));
        await this.handleCreateRoom(code);
        this.initGame(false);
        this.log(`换房: ${code}`);
    }

    async handleJoinRoom(inputCode = null, savedSeat = null) {
        const code = inputCode || prompt(pyT('请输入4位房间号:'));
        if (!code) return;
        try {
            this.log(`连接房间 ${code.trim()}...`);
            const myName = this.getMyName() || null;
            await this.p2p.joinRoom(code.trim(), savedSeat, myName);
            this.isOnline = true;
            this.state.reset();
            this.state.players.forEach(p => { p.swapTiles = []; p.que = null; });
            this.state.selectedSwapIndices = [];
            this.showRoomBar(this.p2p.roomCode, '玩家');
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
            try {
                sessionStorage.setItem('hz_session', JSON.stringify({ role: 'client', roomCode: this.p2p.roomCode, seatIndex: this.p2p.seatIndex }));
            } catch (e) {}
            this.log(`已加入 ${code.trim()}，等待开局...`);
        } catch (err) {
            try { sessionStorage.removeItem('hz_session'); } catch (e) {}
            this.handleResetAndNewRoom();
            alert(pyT('加入房间失败: ') + (err.message || err));
        }
    }

    showRoomBar(code, role) {
        const set = (id, prop, val) => { const el = UIController.$(id); if (el) el[prop] = val; };
        set('room-bar', 'style', 'display: flex;');
        set('room-code-display', 'innerText', code);
        set('room-role-display', 'innerText', `(${pyT(role)})`);

        const isClient = (role === '玩家' || (this.isOnline && !this.p2p?.isHost));
        const startBtn = UIController.$('btn-start');
        if (startBtn) startBtn.style.display = isClient ? 'none' : 'inline-block';
        const changeRoomBtn = UIController.$('btn-change-room');
        if (changeRoomBtn) {
            changeRoomBtn.style.display = 'inline-block';
            changeRoomBtn.innerText = isClient ? pyT('离开') : pyT('换号');
            changeRoomBtn.title = isClient ? pyT('离开房间并重置') : pyT('重新生成4位房间号');
            changeRoomBtn.onclick = () => (isClient ? this.handleResetAndNewRoom() : this.handleChangeRoom());
        }
        const joinBtn = UIController.$('btn-join');
        if (joinBtn) joinBtn.style.display = (this.isOnline || isClient) ? 'none' : 'inline-block';
    }

    handleStartGame() {
        if (this.isOnline && !this.p2p?.isHost) return this.log('请等待房主开局');
        this.initGame(true);
        this.syncStateToPeers();
    }

    syncStateToPeers() {
        if (this.p2p?.isHost) this.p2p.broadcastState(this.state);
    }

    startSwap3Phase() {
        const CFG = this.config;
        this.state.phase = CFG.PHASES.SWAP3;
        this.state.selectedSwapIndices = [];
        this.state.players.forEach((p, i) => {
            p.swapTiles = this.isHumanPlayer(i) ? [] : this.ai.getSwapTiles(p.hand);
        });
        this.ui.render(this.state, this.mySeat);
        const confirmTxt = pyT('确定');
        this.ui.showInstruction('换三张', '选3张牌', `<button id="btn-confirm-swap" disabled onclick="gameController.confirmUserSwap()">${confirmTxt} (0/3)</button>`);
        this.syncStateToPeers();
    }

    toggleSwapTileSelect(idx) {
        const CFG = this.config;
        if (this.state.phase !== CFG.PHASES.SWAP3) return;
        const p = this.state.players[this.mySeat], tile = p.hand[idx];
        if (!tile || tile.suit === 'HZ') return this.log('红中为万能牌，不能作为换三张牌打出');

        this.sound.play('select');
        const pos = this.state.selectedSwapIndices.indexOf(idx);
        if (pos > -1) this.state.selectedSwapIndices.splice(pos, 1);
        else if (this.state.selectedSwapIndices.length < 3) this.state.selectedSwapIndices.push(idx);

        this.ui.render(this.state, this.mySeat);
        const btn = UIController.$('btn-confirm-swap');
        if (btn) {
            const c = this.state.selectedSwapIndices.length;
            btn.disabled = (c !== 3);
            btn.innerText = `${pyT('确定')} (${c}/3)`;
        }
    }

    confirmUserSwap() {
        if (this.state.selectedSwapIndices?.length !== 3) return;
        this.sound.play('select');
        const u = this.state.players[this.mySeat];
        u.swapTiles = this.state.selectedSwapIndices.map(i => u.hand[i]);
        this.ui.hideInstruction();
        this.log('已选换牌，等待中...');
        if (this.p2p && !this.p2p.isHost) {
            return this.p2p.sendAction('CONFIRM_SWAP', { swapTiles: u.swapTiles, swapTileIds: u.swapTiles.map(t => t.id) });
        }
        this.checkAndExecuteSwap();
    }

    checkAndExecuteSwap() {
        this.flow.executeSwap(this.state, () => {
            this.log('换三张完成');
            this.startDingQuePhase();
        });
    }

    startDingQuePhase() {
        const CFG = this.config;
        this.state.phase = CFG.PHASES.DINGQUE;
        this.state.players.forEach((p, i) => {
            p.que = this.isHumanPlayer(i) ? null : this.ai.getDingQue(p.hand);
        });
        this.ui.render(this.state, this.mySeat);
        this.ui.showInstruction('定缺', '请选择定缺门类', UIController.getDingQueOptionsHtml());
        this.syncStateToPeers();
    }

    selectUserQue(suit) {
        const CFG = this.config;
        this.sound.play('select');
        if (this.state.players[this.mySeat]) this.state.players[this.mySeat].que = suit;
        this.ui.hideInstruction();
        this.ui.render(this.state, this.mySeat);
        this.log(`已定${pyT('缺' + CFG.SUITS[suit])}，等待中...`);
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction('SELECT_QUE', { que: suit });
        this.checkAndExecuteDingQue();
    }

    checkAndExecuteDingQue() {
        const CFG = this.config;
        if (!this.flow.checkDingQueComplete(this.state)) return this.syncStateToPeers();
        this.state.sortAllHands();
        this.state.phase = CFG.PHASES.PLAYING;
        this.log(`定缺: ${this.state.players.map(p => `${p.name} 缺${CFG.SUITS[p.que]}`).join(', ')}`);
        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();
        this.processTurn();
    }

    processTurn(isRinshan = false) {
        const CFG = this.config;
        if (this.p2p && !this.p2p.isHost) return;
        if (this.state.phase !== CFG.PHASES.PLAYING) return;
        if (this.state.isGameOver()) return this.endGame();

        const p = this.state.players[this.state.currentTurn];
        if (p && (p.isEliminated || p.score <= 0)) {
            p.isEliminated = true;
            this.state.currentTurn = (this.state.currentTurn + 1) % CFG.TOTAL_PLAYERS;
            return this.processTurn();
        }

        if (isRinshan || p.hand.length % 3 === 1) {
            if (!this.state.wall || this.state.wall.length === 0) return this.endGame();
            const drawn = this.state.wall.pop();
            this.state.wallCount = this.state.wall.length;
            p.hand.push(drawn);
            if (this.state.currentTurn === this.mySeat) {
                this.log(`${p.name} 摸 ${isRinshan ? '[杠] ' : ''}${this.engine.tileToString(drawn)}`);
            }
            this.ui.render(this.state, this.mySeat);
        } else if (!isRinshan) {
            this.state.lastActionIsGang = false;
            this.state.lastGangPlayer = null;
        }

        this.syncStateToPeers();
        const isMe = (this.state.currentTurn === this.mySeat);
        if (isMe) {
            this.ui.updateTingPanel(p);
            if (this.state.autoPlay || p.isHu) {
                this.ui.hideActionBox();
                setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CFG.DELAYS.AI_TURN);
            } else if (this.state.autoQue && p.que && p.hand.some(t => t.suit === p.que)) {
                this.ui.hideActionBox();
                setTimeout(() => this.autoPlayQueDiscard(this.mySeat), CFG.DELAYS.AI_TURN);
            } else {
                this.checkPlayerTurnActions();
            }
        } else if (!this.isHumanPlayer(this.state.currentTurn) || p.isHu) {
            setTimeout(() => this.autoPlayPlayerTurn(this.state.currentTurn), CFG.DELAYS.AI_TURN);
        }
    }

    checkPlayerTurnActions() {
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length % 3 !== 2 || this.state.autoPlay || p.isHu || p.isEliminated) {
            this.ui.hideActionBox();
            return;
        }
        const drawn = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawn);
        const gangs = this.engine.checkCanGang(p);

        if (canHu || gangs.length > 0) {
            this.ui.showActionBox(
                canHu,
                gangs.length > 0,
                false,
                () => this.handleActionClick('HU', { tile: drawn, isZiMo: true }),
                () => this.handleActionClick('GANG', { gangOption: gangs[0] }),
                null,
                () => this.ui.hideActionBox()
            );
        } else {
            this.ui.hideActionBox();
        }
    }

    handleActionClick(action, payload) {
        const CFG = this.config;
        this.ui.hideActionBox();
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction(action, payload);
        const handlers = {
            HU: () => this.doHu(this.mySeat, payload.tile, payload.isZiMo, payload.fromPlayer),
            GANG: () => this.doGang(this.mySeat, payload.gangOption),
            GANG_DISCARD: () => this._executeMeld(this.mySeat, 'GANG', payload.tile, payload.fromPlayer, 3, CFG.GANG_SCORE, true),
            PUNG: () => this._executeMeld(this.mySeat, 'PUNG', payload.tile, payload.fromPlayer, 2, 0, false)
        };
        handlers[action]?.();
    }

    handleTileClick(index) {
        const CFG = this.config;
        if (this.state.phase === CFG.PHASES.SWAP3) return this.toggleSwapTileSelect(index);
        if (this.state.phase !== CFG.PHASES.PLAYING || this.state.currentTurn !== this.mySeat) return;

        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length % 3 !== 2 || p.isEliminated) return;
        const tile = p.hand[index];
        if (!tile) return;

        if (p.hand.some(t => t.suit === p.que) && tile.suit !== p.que) {
            return this.log(`先打缺门牌(缺${CFG.SUITS[p.que]})`);
        }
        if (p.isHu && index !== p.hand.length - 1) {
            return this.log('已胡牌只能打摸牌');
        }

        this.ui.hideActionBox();
        if (this.p2p && !this.p2p.isHost) {
            return this.p2p.sendAction('DISCARD', { handIndex: index, tileId: tile.id, tileCode: tile.code });
        }
        this.executeDiscard(this.mySeat, index);
    }

    executeDiscard(pIdx, hIdx, tileId = null, tileCode = null) {
        if (this.p2p && !this.p2p.isHost) {
            return this.p2p.sendAction('DISCARD', { handIndex: hIdx, tileId, tileCode });
        }
        const p = this.state.players[pIdx];
        if (!p || p.hand.length % 3 !== 2 || this.isDiscarding) return;

        this.isDiscarding = true;
        try {
            let actualIdx = -1;
            if (tileId != null) actualIdx = p.hand.findIndex(t => t.id === tileId);
            if (actualIdx === -1 && tileCode) actualIdx = p.hand.findIndex(t => t.code === tileCode);
            if (actualIdx === -1) actualIdx = (hIdx < 0 || hIdx >= p.hand.length) ? (p.hand.length - 1) : hIdx;

            const tile = p.hand.splice(actualIdx, 1)[0];
            if (!tile) return;

            p.discards.push(tile);
            this.state.lastDiscard = { tile, playerIndex: pIdx };
            this.sound.play('discard');
            this.log(`${p.name} 打 ${this.engine.tileToString(tile)}`);

            this.engine.sortHand(p.hand, p.que);
            this.ui.hideActionBox();
            this.ui.render(this.state, this.mySeat);
            if (pIdx === this.mySeat) this.ui.updateTingPanel(p);
            this.syncStateToPeers();

            this.checkOffTurnActions(tile, pIdx);
            this.state.lastActionIsGang = false;
        } finally {
            this.isDiscarding = false;
        }
    }

    checkOffTurnActions(tile, discarder) {
        const CFG = this.config;
        const hus = [1, 2, 3].map(o => (discarder + o) % CFG.TOTAL_PLAYERS)
            .filter(i => !this.state.players[i].isEliminated && this.engine.checkCanHu(this.state.players[i], tile));
        if (hus.length > 0) return this.arbitrateHu(hus, tile, discarder);
        this.arbitratePungGang(tile, discarder, 1);
    }

    arbitrateHu(cands, tile, discarder) {
        const decisions = {};
        let pending = 0;

        cands.forEach(idx => {
            const isAuto = !this.isHumanPlayer(idx) || (idx === this.mySeat && (this.state.autoPlay || this.state.players[idx]?.isHu));
            if (isAuto) {
                decisions[idx] = 'HU';
            } else if (idx === this.mySeat) {
                pending++;
                this.ui.showActionBox(
                    true, false, false,
                    () => { this.ui.hideActionBox(); decisions[idx] = 'HU'; this.resolveHu(cands, decisions, tile, discarder); },
                    null, null,
                    () => { this.ui.hideActionBox(); decisions[idx] = 'PASS'; this.resolveHu(cands, decisions, tile, discarder); }
                );
            } else {
                const sent = this.p2p.sendToSeat(idx, { type: 'PROMPT_OFFTURN_ACTION', options: { canHu: true, canGang: false, canPung: false, tile, fromPlayer: discarder } });
                if (sent) {
                    pending++;
                } else {
                    decisions[idx] = 'PASS';
                }
            }
        });

        this.pendingOffTurn = { cands, decisions, tile, discarder };
        if (pending === 0) this.resolveHu(cands, decisions, tile, discarder);
    }

    resolveHu(cands, decisions, tile, discarder) {
        const CFG = this.config;
        if (!cands.every(i => decisions[i] !== undefined)) return;
        this.pendingOffTurn = null;

        const actual = cands.filter(i => decisions[i] === 'HU');
        if (actual.length > 0) {
            actual.forEach(i => this.doHu(i, tile, false, discarder));
            this.state.currentTurn = (discarder + 1) % CFG.TOTAL_PLAYERS;
            this.syncStateToPeers();
            setTimeout(() => this.processTurn(), CFG.DELAYS.AI_TURN);
            return;
        }
        this.arbitratePungGang(tile, discarder, 1);
    }

    arbitratePungGang(tile, discarder, offset = 1) {
        const CFG = this.config;
        for (let i = offset; i <= 3; i++) {
            const idx = (discarder + i) % CFG.TOTAL_PLAYERS, p = this.state.players[idx];
            if (p.isHu || p.isEliminated) continue;

            const canG = this.engine.checkCanPungOrGang(p, tile, 'GANG');
            const canP = this.engine.checkCanPungOrGang(p, tile, 'PUNG');
            if (!canG && !canP) continue;

            if (!this.isHumanPlayer(idx) || (idx === this.mySeat && this.state.autoPlay)) {
                if (canG && this.ai.shouldGang(p, tile)) return this._executeMeld(idx, 'GANG', tile, discarder, 3, CFG.GANG_SCORE, true);
                if (canP && this.ai.shouldPung(p, tile)) return this._executeMeld(idx, 'PUNG', tile, discarder, 2, 0, false);
                if (idx === this.mySeat) return this.arbitratePungGang(tile, discarder, i + 1);
            } else if (idx === this.mySeat) {
                return this.ui.showActionBox(
                    false, canG, canP, null,
                    () => { this.ui.hideActionBox(); this._executeMeld(this.mySeat, 'GANG', tile, discarder, 3, CFG.GANG_SCORE, true); },
                    () => { this.ui.hideActionBox(); this._executeMeld(this.mySeat, 'PUNG', tile, discarder, 2, 0, false); },
                    () => { this.ui.hideActionBox(); this.arbitratePungGang(tile, discarder, i + 1); }
                );
            } else {
                const sent = this.p2p.sendToSeat(idx, { type: 'PROMPT_OFFTURN_ACTION', options: { canHu: false, canGang: canG, canPung: canP, tile, fromPlayer: discarder } });
                if (sent) {
                    this.pendingOffTurn = { idx, tile, discarder, offset: i + 1 };
                    return;
                }
            }
        }
        this.state.currentTurn = (discarder + 1) % CFG.TOTAL_PLAYERS;
        this.syncStateToPeers();
        setTimeout(() => this.processTurn(), CFG.DELAYS.AI_TURN);
    }

    _executeMeld(pIdx, type, tile, from, removeCount, scoreTransfer, isGang) {
        const CFG = this.config;
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction(type === 'GANG' ? 'GANG_DISCARD' : 'PUNG', { tile, fromPlayer: from });
        this.sound.play('action');
        const p = this.state.players[pIdx];
        let removed = 0;
        for (let i = p.hand.length - 1; i >= 0; i--) {
            if (p.hand[i].code === tile.code && (++removed <= removeCount)) p.hand.splice(i, 1);
        }
        p.melds.push({ type, tile, from, isAnGang: false });

        // 河（捨て牌）から鳴かれた牌を取り除く
        const fromP = this.state.players[from];
        if (fromP?.discards?.length > 0) {
            let dIdx = -1;
            for (let k = fromP.discards.length - 1; k >= 0; k--) {
                if (fromP.discards[k].code === tile.code) { dIdx = k; break; }
            }
            if (dIdx > -1) fromP.discards.splice(dIdx, 1);
        }
        this.state.lastDiscard = null;

        this.log(`${p.name} ${type === 'GANG' ? '明杠' : '碰'} ${this.engine.tileToString(tile)}`);
        if (scoreTransfer > 0) {
            this.state.transferScore(from, pIdx, scoreTransfer);
            this.checkPlayerEliminations();
        }

        this.state.currentTurn = pIdx;
        this.state.lastActionIsGang = isGang;
        this.state.lastGangPlayer = isGang ? pIdx : null;
        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();

        if (isGang) {
            this.processTurn(true);
        } else if (pIdx === this.mySeat) {
            if (this.state.autoPlay || p.isHu) {
                setTimeout(() => this.autoPlayPlayerTurn(pIdx), CFG.DELAYS.AI_TURN);
            } else if (this.state.autoQue && p.que && p.hand.some(t => t.suit === p.que)) {
                setTimeout(() => this.autoPlayQueDiscard(pIdx), CFG.DELAYS.AI_TURN);
            } else {
                this.checkPlayerTurnActions();
            }
        } else if (!this.isHumanPlayer(pIdx) || p.isHu) {
            setTimeout(() => this.autoPlayPlayerTurn(pIdx), CFG.DELAYS.AI_TURN);
        }
    }

    doGang(pIdx, option) {
        const CFG = this.config;
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction('GANG', { gangOption: option });
        if (!option?.tile) return;
        this.sound.play('action');
        const p = this.state.players[pIdx], tile = option.tile;

        if (option.type === 'JIA_GANG') {
            const idx = p.hand.findIndex(t => t.code === tile.code);
            if (idx > -1) p.hand.splice(idx, 1);
            const meld = p.melds.find(m => m.type === 'PUNG' && m.tile.code === tile.code);
            if (meld) Object.assign(meld, { type: 'GANG', isAnGang: false });
            this.log(`${p.name} 补杠 ${this.engine.tileToString(tile)}`);
        } else {
            p.hand = p.hand.filter(t => t.code !== tile.code);
            p.melds.push({ type: 'GANG', tile, from: pIdx, isAnGang: true });
            this.log(`${p.name} 暗杠 ${this.engine.tileToString(tile)}`);
        }

        for (let o = 0; o < CFG.TOTAL_PLAYERS; o++) {
            if (o !== pIdx) this.state.transferScore(o, pIdx, CFG.GANG_SCORE);
        }
        this.checkPlayerEliminations();
        this.state.lastActionIsGang = true;
        this.state.lastGangPlayer = pIdx;
        this.syncStateToPeers();
        this.processTurn(true);
    }

    doHu(pIdx, tile, isZiMo, fromPlayer = null) {
        const CFG = this.config;
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction('HU', { tile, isZiMo, fromPlayer });

        // 自身か他家かで効果音を鳴らし分け
        this.sound.play(pIdx === this.mySeat ? 'hu' : 'hu_opp');

        const p = this.state.players[pIdx];
        if (!p) return;
        p.isHu = true;

        const fanInfo = this.engine.calculateFan(p, tile, isZiMo, fromPlayer, this.state);
        const score = CFG.BASE_SCORE * Math.pow(2, fanInfo.fan);

        const yakuNames = (fanInfo.name || '平胡').replace(/\s*自摸\b/, '').trim();
        this.log(`★ ${p.name} ${isZiMo ? '自摸' : '点炮'}: ${yakuNames ? yakuNames + ' ' : ''}(${fanInfo.fan}番 ${score}分) ${this.engine.tileToString(tile)}`);
        p.huRecords.push({ fan: fanInfo.fan, fanName: fanInfo.name, score, isZiMo, tile });
        this.state.lastActionIsGang = false;
        this.state.lastGangPlayer = null;

        if (isZiMo) {
            for (let o = 0; o < CFG.TOTAL_PLAYERS; o++) {
                if (o !== pIdx) this.state.transferScore(o, pIdx, score);
            }
        } else {
            this.state.transferScore(fromPlayer, pIdx, score);
        }
        this.checkPlayerEliminations();

        this.ui.hideActionBox();
        this.ui.render(this.state, this.mySeat);
        this.syncStateToPeers();
        if (this.state.isGameOver()) return this.endGame();
        if (isZiMo) this.executeDiscard(pIdx, p.hand.length - 1);
    }

    autoPlayPlayerTurn(pIdx) {
        const CFG = this.config;
        if (this.state.currentTurn !== pIdx || this.state.phase !== CFG.PHASES.PLAYING) return;
        const p = this.state.players[pIdx];
        if (!p || p.hand.length % 3 !== 2) return;

        const drawn = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawn);
        const gangs = this.engine.checkCanGang(p);

        if (this.p2p && !this.p2p.isHost) {
            if (canHu) return this.p2p.sendAction('HU', { tile: drawn, isZiMo: true });
            if (gangs.length > 0) return this.p2p.sendAction('GANG', { gangOption: gangs[0] });
            const discardIdx = p.isHu ? (p.hand.length - 1) : this.ai.chooseDiscardIndex(p);
            const tile = p.hand[discardIdx];
            return this.p2p.sendAction('DISCARD', { handIndex: discardIdx, tileId: tile?.id, tileCode: tile?.code });
        }

        if (canHu) return this.doHu(pIdx, drawn, true);
        if (p.isHu) return this.executeDiscard(pIdx, p.hand.length - 1);
        if (gangs.length > 0 && !this.isHumanPlayer(pIdx)) return this.doGang(pIdx, gangs[0]);

        this.executeDiscard(pIdx, this.ai.chooseDiscardIndex(p));
    }

    autoPlayQueDiscard(pIdx) {
        const CFG = this.config;
        if (this.state.currentTurn !== pIdx || this.state.phase !== CFG.PHASES.PLAYING) return;
        const p = this.state.players[pIdx];
        if (!p || p.hand.length % 3 !== 2 || !p.que) return;

        const queIndices = p.hand.map((t, idx) => ({ t, idx })).filter(x => x.t.suit === p.que);
        if (queIndices.length === 0) return;

        const discardIdx = this.ai.chooseDiscardIndex(p);
        const targetIdx = (p.hand[discardIdx]?.suit === p.que) ? discardIdx : queIndices[0].idx;
        const tile = p.hand[targetIdx];

        if (this.p2p && !this.p2p.isHost) {
            return this.p2p.sendAction('DISCARD', { handIndex: targetIdx, tileId: tile?.id, tileCode: tile?.code });
        }
        this.executeDiscard(pIdx, targetIdx);
    }

    endGame() {
        const CFG = this.config;
        this.state.phase = CFG.PHASES.END;
        const logs = this.flow.calculateEndSettlement(this.state, this.engine);
        this.state.settlementLogs = logs;
        logs.forEach(l => this.log(l));
        this.ui.render(this.state, this.mySeat);
        this.ui.showResultModal(this.state.players, logs);
        this.syncStateToPeers();
    }

    handleRemoteStateSync(remoteState) {
        const CFG = this.config;
        const isNewGame = Boolean(remoteState.gameSeed && this.state.gameSeed !== remoteState.gameSeed);

        // リモートの打牌効果音
        if (remoteState.lastDiscard && (!this.state.lastDiscard || this.state.lastDiscard.tile?.id !== remoteState.lastDiscard.tile?.id)) {
            this.sound.play('discard');
        }

        // リモートの和了効果音（自身 vs 他家）
        const myHuRemote = remoteState.players?.[this.mySeat]?.huRecords?.length || 0;
        const myHuLocal = this.state.players?.[this.mySeat]?.huRecords?.length || 0;
        const totalHuRemote = (remoteState.players || []).reduce((acc, p) => acc + (p.huRecords?.length || 0), 0);
        const totalHuLocal = (this.state.players || []).reduce((acc, p) => acc + (p.huRecords?.length || 0), 0);

        if (myHuRemote > myHuLocal) {
            this.sound.play('hu');
        } else if (totalHuRemote > totalHuLocal) {
            this.sound.play('hu_opp');
        }

        if (isNewGame) {
            this.state.selectedSwapIndices = [];
            if (this.state.players) this.state.players.forEach(p => { p.swapTiles = []; p.que = null; });
        }

        const savedIndices = isNewGame ? [] : (this.state.selectedSwapIndices || []);
        const savedQue = isNewGame ? null : this.state.players[this.mySeat]?.que;
        const mySwapTiles = isNewGame ? [] : this.state.players[this.mySeat]?.swapTiles;

        // DSL PRNGによる山と配牌の決定論的同期
        if (remoteState.gameSeed && this.state.gameSeed !== remoteState.gameSeed && remoteState.phase !== CFG.PHASES.INIT) {
            const PRNGClass = this.dslPrng || DeterministicPRNG;
            const prng = PRNGClass ? new PRNGClass(remoteState.gameSeed) : null;
            const deck = this.engine.shuffle(this.engine.createDeck(), prng);
            for (let r = 0; r < CFG.HAND_SIZE * CFG.TOTAL_PLAYERS + 1; r++) deck.pop();
            this.state.wall = deck;
            this.state.gameSeed = remoteState.gameSeed;
        }

        Object.assign(this.state, remoteState);
        if (this.p2p && !this.p2p.isHost) {
            this.state.wall = null; // クライアント側はホストから同期されたwallCountを直接使用
        }

        // クライアント側の確定・選択状態の保護（同局内のみ）
        if (savedQue && this.state.players[this.mySeat] && !this.state.players[this.mySeat].que) {
            this.state.players[this.mySeat].que = savedQue;
        }
        if (mySwapTiles?.length === 3 && this.state.players[this.mySeat] && (!this.state.players[this.mySeat].swapTiles || this.state.players[this.mySeat].swapTiles.length === 0)) {
            this.state.players[this.mySeat].swapTiles = mySwapTiles;
        }

        this.state.players.forEach((p, i) => {
            p.name = this.getBasePlayerName(i);
            if (p.hand) this.engine.sortHand(p.hand, p.que);
        });
        this.updateRoomMembersDisplay();

        const phaseHandlers = {
            [CFG.PHASES.SWAP3]: () => {
                this.state.selectedSwapIndices = savedIndices;
                const myP = this.state.players[this.mySeat], c = this.state.selectedSwapIndices.length;
                if (!myP?.swapTiles || myP.swapTiles.length !== 3) {
                    this.ui.showInstruction('换三张', '选3张牌', `<button id="btn-confirm-swap" ${c === 3 ? '' : 'disabled'} onclick="gameController.confirmUserSwap()">${pyT('确定')} (${c}/3)</button>`);
                } else {
                    this.ui.hideInstruction();
                }
            },
            [CFG.PHASES.DINGQUE]: () => {
                this.state.selectedSwapIndices = [];
                if (!this.state.players[this.mySeat]?.que) {
                    this.ui.showInstruction('定缺', '请选择定缺门类', UIController.getDingQueOptionsHtml());
                } else {
                    this.ui.hideInstruction();
                }
            },
            [CFG.PHASES.PLAYING]: () => {
                this.ui.hideInstruction();
                if (this.state.currentTurn === this.mySeat) {
                    const myP = this.state.players[this.mySeat];
                    if (this.state.autoPlay || myP?.isHu) {
                        this.ui.hideActionBox();
                        setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CFG.DELAYS.AI_TURN);
                    } else if (this.state.autoQue && myP?.que && myP.hand.some(t => t.suit === myP.que)) {
                        this.ui.hideActionBox();
                        setTimeout(() => this.autoPlayQueDiscard(this.mySeat), CFG.DELAYS.AI_TURN);
                    } else {
                        this.checkPlayerTurnActions();
                    }
                }
            },
            [CFG.PHASES.END]: () => {
                const logs = this.state.settlementLogs || this.flow.calculateEndSettlement(this.state, this.engine);
                this.ui.showResultModal(this.state.players, logs);
            }
        };
        phaseHandlers[this.state.phase]?.();
        this.ui.render(this.state, this.mySeat);
    }

    handleRemotePrompt(opt) {
        const myP = this.state.players[this.mySeat];
        if (opt.canHu && (this.state.autoPlay || myP?.isHu)) {
            return this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'HU', tile: opt.tile, fromPlayer: opt.fromPlayer });
        }
        this.sound.play('action');
        this.ui.showActionBox(
            opt.canHu, opt.canGang, opt.canPung,
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'HU', tile: opt.tile, fromPlayer: opt.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'GANG', tile: opt.tile, fromPlayer: opt.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PUNG', tile: opt.tile, fromPlayer: opt.fromPlayer }); },
            () => { this.ui.hideActionBox(); this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'PASS' }); }
        );
    }

    handlePlayerDisconnect(pIdx) {
        if (!this.state?.players?.[pIdx]) return;
        this.state.players[pIdx].name = `${pIdx + 1}P (电脑)`;

        // 待機中のオフターン調停があれば解決してゲームを続行
        if (this.pendingOffTurn?.decisions && this.pendingOffTurn.decisions[pIdx] === undefined) {
            this.pendingOffTurn.decisions[pIdx] = 'PASS';
            this.resolveHu(this.pendingOffTurn.cands, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
        } else if (Number(this.pendingOffTurn?.idx) === pIdx) {
            const info = this.pendingOffTurn;
            this.pendingOffTurn = null;
            this.arbitratePungGang(info.tile, info.discarder, info.offset);
        }

        // 定缺フェーズで未定缺ならAIが自動選択
        if (this.state.phase === this.config.PHASES.DINGQUE && !this.state.players[pIdx].que) {
            this.state.players[pIdx].que = this.ai.getQueSuit(this.state.players[pIdx].hand);
            this.checkAndExecuteDingQue();
        }
        // 換三張フェーズで未選択ならAIが自動選択
        if (this.state.phase === this.config.PHASES.SWAP3 && (!this.state.players[pIdx].swapTiles || this.state.players[pIdx].swapTiles.length !== 3)) {
            this.state.players[pIdx].swapTiles = this.ai.getSwapTiles(this.state.players[pIdx].hand);
            this.checkAndExecuteSwap();
        }
    }

    handleRemoteAction(playerIndex, action, payload) {
        const CFG = this.config;
        if (!this.p2p?.isHost) return;
        const pIdx = Number(playerIndex);
        const p = this.state.players[pIdx];
        if (!p) return;

        const handlers = {
            SET_NAME: () => {
                if (payload.name && this.p2p?.playersInfo?.[pIdx]) {
                    const newName = String(payload.name).trim().slice(0, 8);
                    this.p2p.playersInfo[pIdx].name = newName;
                    p.name = newName;
                    this.p2p.broadcastRoomInfo();
                    this.syncStateToPeers();
                    this.updateRoomMembersDisplay();
                    this.ui.render(this.state, this.mySeat);
                    this.log(`${pIdx + 1}P 改名: ${newName}`);
                }
            },
            CONFIRM_SWAP: () => {
                p.swapTiles = payload.swapTileIds
                    ? payload.swapTileIds.map(id => p.hand.find(x => x.id === id)).filter(Boolean)
                    : (payload.swapTiles || []).map(t => p.hand.find(x => x.suit === t.suit && x.num === t.num)).filter(Boolean);
                if (p.swapTiles?.length !== 3) {
                    p.swapTiles = p.hand.filter(t => t.suit !== 'HZ').slice(0, 3);
                }
                this.log(`${p.name} 已选换牌`);
                this.checkAndExecuteSwap();
            },
            SELECT_QUE: () => {
                p.que = payload.que;
                this.log(`${p.name} 定缺${CFG.SUITS[payload.que]}`);
                this.ui.render(this.state, this.mySeat);
                this.checkAndExecuteDingQue();
            },
            DISCARD: () => this.executeDiscard(pIdx, payload.handIndex, payload.tileId, payload.tileCode),
            HU: () => this.doHu(pIdx, payload.tile, payload.isZiMo, payload.fromPlayer),
            GANG: () => this.doGang(pIdx, payload.gangOption || { tile: payload.gangTile, type: 'AN_GANG' }),
            GANG_DISCARD: () => this._executeMeld(pIdx, 'GANG', payload.tile, payload.fromPlayer, 3, CFG.GANG_SCORE, true),
            PUNG: () => this._executeMeld(pIdx, 'PUNG', payload.tile, payload.fromPlayer, 2, 0, false),
            RESPONSE_OFFTURN: () => {
                if (this.pendingOffTurn?.decisions) {
                    this.pendingOffTurn.decisions[pIdx] = payload.choice;
                    this.resolveHu(this.pendingOffTurn.cands, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
                } else if (Number(this.pendingOffTurn?.idx) === pIdx) {
                    const info = this.pendingOffTurn;
                    this.pendingOffTurn = null;
                    if (payload.choice === 'GANG') this._executeMeld(pIdx, 'GANG', info.tile, info.discarder, 3, CFG.GANG_SCORE, true);
                    else if (payload.choice === 'PUNG') this._executeMeld(pIdx, 'PUNG', info.tile, info.discarder, 2, 0, false);
                    else this.arbitratePungGang(info.tile, info.discarder, info.offset);
                }
            }
        };
        handlers[action]?.();
    }
}
