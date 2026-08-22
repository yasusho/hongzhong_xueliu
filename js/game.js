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
        this.pendingOffTurn = null;
        this.initP2PEvents();
    }

    get config() { return CONFIG; }
    get mySeat() { return (!this.p2p?.isHost && this.p2p?.seatIndex != null) ? Number(this.p2p.seatIndex) : 0; }

    log(text) {
        this.state.logs = (this.state.logs || []).slice(-49).concat(text);
        this.ui.log(text);
    }

    clearLog(text = '系统就绪。') {
        this.state.logs = [text];
        this.ui.clearLog(text);
    }

    getMyName() { try { return localStorage.getItem('hz_username') || ''; } catch { return ''; } }
    setMyName(name) { try { localStorage.setItem('hz_username', name); } catch {} }

    isHumanPlayer(idx) {
        return this.p2p?.playersInfo?.[idx] ? !this.p2p.playersInfo[idx].isAI : (idx === 0);
    }

    getBasePlayerName(idx) {
        if (this.p2p?.playersInfo?.[idx]?.name) return this.p2p.playersInfo[idx].name;
        return (idx === 0) ? '1P (房主)' : (this.isHumanPlayer(idx) ? `${idx + 1}P (玩家)` : `${idx + 1}P (电脑)`);
    }

    updateRoomMembersDisplay() {
        const container = UIController.$('room-members-display');
        if (!container) return;
        container.innerHTML = [0, 1, 2, 3].map(i => {
            const isMe = (i === this.mySeat);
            const base = this.getBasePlayerName(i);
            const name = isMe ? `${base} (你)` : base;
            const clickAttr = isMe ? 'onclick="gameController.handleChangeName()"' : '';
            const titleAttr = isMe ? `title="${pyT('点击修改昵称')}"` : '';
            return `<span class="member-badge ${this.isHumanPlayer(i) ? 'human' : 'cpu'}" ${clickAttr} ${titleAttr}>${pyT(name)}</span>`;
        }).join(' ');
    }

    handleDslEvents(events) {
        if (!events?.length) return;
        events.forEach(ev => {
            if (ev.type === 'LOG') this.log(ev.text);
            else if (ev.type === 'SOUND') this.sound.play(ev.sound);
            else if (ev.type === 'SOUND_HU') this.sound.play(ev.playerIndex === this.mySeat ? 'hu' : 'hu_opp');
            else if (ev.type === 'DRAW' && ev.playerIndex === this.mySeat) {
                this.log(`${this.state.players[ev.playerIndex].name} 摸 ${ev.isRinshan ? '[杠] ' : ''}${this.engine.tileToString(ev.tile)}`);
            } else if (ev.type === 'UI_RENDER') {
                this.ui.render(this.state, this.mySeat);
                this.syncStateToPeers();
            }
        });
    }

    dispatchAction(playerIndex, action, payload = {}) {
        if (this.p2p && !this.p2p.isHost) return this.p2p.sendAction(action, payload);
        const p = this.state.players[playerIndex];

        const map = {
            SET_NAME: () => {
                if (payload.name && this.p2p?.playersInfo?.[playerIndex]) {
                    const name = String(payload.name).trim().slice(0, 8);
                    this.p2p.playersInfo[playerIndex].name = p.name = name;
                    this.p2p.broadcastRoomInfo();
                    this.syncStateToPeers();
                    this.updateRoomMembersDisplay();
                    this.ui.render(this.state, this.mySeat);
                    this.log(`${playerIndex + 1}P 改名: ${name}`);
                }
            },
            CONFIRM_SWAP: () => {
                p.swapTiles = payload.swapTileIds
                    ? payload.swapTileIds.map(id => p.hand.find(x => x.id === id)).filter(Boolean)
                    : (payload.swapTiles || []).map(t => p.hand.find(x => x.suit === t.suit && x.num === t.num)).filter(Boolean);
                if (p.swapTiles?.length !== 3) p.swapTiles = p.hand.filter(t => t.suit !== 'HZ').slice(0, 3);
                this.log(`${p.name} 已选换牌`);
                if (this.state.players.every(pl => pl.swapTiles?.length === 3)) {
                    this.handleDslEvents(GameDSL.executeSwap(this.state));
                    this.state.players.forEach((pl, idx) => { pl.que = this.isHumanPlayer(idx) ? null : this.ai.getDingQue(pl.hand); });
                    this.syncStateToPeers();
                    if (this.state.autoPlay) setTimeout(() => this.checkAutoActions(), CONFIG.DELAYS.AUTO_ACTION);
                }
            },
            SELECT_QUE: () => {
                p.que = payload.que;
                this.log(`${p.name} 定缺${CONFIG.SUITS[payload.que]}`);
                this.ui.render(this.state, this.mySeat);
                const evs = GameDSL.confirmDingQue(this.state);
                if (evs.length > 0) { this.handleDslEvents(evs); this.processTurn(); }
                else this.syncStateToPeers();
            },
            DISCARD: () => this.executeDiscard(playerIndex, payload.handIndex, payload.tileId),
            HU: () => {
                this.ui.hideActionBox();
                this.handleDslEvents(GameDSL.executeHu(this.state, playerIndex, payload.tile, payload.isZiMo, payload.fromPlayer, this.engine));
                if (this.state.isGameOver()) return this.endGame();
                if (payload.isZiMo) this.executeDiscard(playerIndex, p.hand.length - 1);
            },
            GANG: () => {
                if (!payload.gangOption?.tile) return;
                this.handleDslEvents(GameDSL.executeSelfGang(this.state, playerIndex, payload.gangOption, this.engine));
                this.processTurn(true);
            },
            MELD: () => {
                const { type, tile, from, removeCount, score, isGang } = payload;
                this.handleDslEvents(GameDSL.executeMeld(this.state, playerIndex, type, tile, from, removeCount, score, isGang, this.engine));
                if (isGang) {
                    this.processTurn(true);
                } else if (playerIndex === this.mySeat) {
                    const isAuto = this.state.autoPlay || p.isHu || (this.state.autoQue && p.que && p.hand.some(t => t.suit === p.que));
                    if (isAuto) setTimeout(() => this.autoPlayPlayerTurn(playerIndex), CONFIG.DELAYS.AI_TURN);
                    else this.checkPlayerTurnActions();
                } else if (!this.isHumanPlayer(playerIndex) || p.isHu) {
                    setTimeout(() => this.autoPlayPlayerTurn(playerIndex), CONFIG.DELAYS.AI_TURN);
                }
            },
            RESPONSE_OFFTURN: () => {
                if (this.pendingOffTurn?.decisions) {
                    this.pendingOffTurn.decisions[playerIndex] = payload.choice;
                    this.resolveHu(this.pendingOffTurn.candidates, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
                } else if (Number(this.pendingOffTurn?.idx) === playerIndex) {
                    const info = this.pendingOffTurn;
                    this.pendingOffTurn = null;
                    if (payload.choice === 'GANG') this.dispatchAction(playerIndex, 'MELD', { type: 'GANG', tile: info.tile, from: info.discarder, removeCount: 3, score: 200, isGang: true });
                    else if (payload.choice === 'PUNG') this.dispatchAction(playerIndex, 'MELD', { type: 'PUNG', tile: info.tile, from: info.discarder, removeCount: 2, score: 0, isGang: false });
                    else this.arbitratePungGang(info.tile, info.discarder, info.offset);
                }
            }
        };
        map[action]?.();
    }

    initGame(isOnlineMatch = false, customSeed = null) {
        this.isOnline = isOnlineMatch;
        this.isDiscarding = false;
        this.pendingOffTurn = null;
        this.ui.hideInstruction();
        this.ui.hideResultModal();
        this.ui.hideActionBox();

        const seed = customSeed || Math.floor(Math.random() * 0xFFFFFFFF);
        const events = GameDSL.initGame(this.state, seed, this.engine);
        this.state.players.forEach((p, idx) => {
            p.name = this.getBasePlayerName(idx);
            p.swapTiles = this.isHumanPlayer(idx) ? [] : this.ai.getSwapTiles(p.hand);
        });

        this.updateRoomMembersDisplay();
        this.handleDslEvents(events);
        this.syncStateToPeers();
        if (this.state.autoPlay) setTimeout(() => this.checkAutoActions(), CONFIG.DELAYS.AUTO_ACTION);
    }

    toggleSwapTileSelect(tileIndex) {
        if (this.state.phase !== CONFIG.PHASES.SWAP3) return;
        const myPlayer = this.state.players[this.mySeat];
        const tile = myPlayer?.hand?.[tileIndex];
        if (!tile || tile.suit === 'HZ') return this.log('红中不能换牌');

        this.sound.play('select');
        const list = this.state.selectedSwapIndices;
        const pos = list.indexOf(tileIndex);
        if (pos > -1) list.splice(pos, 1);
        else if (list.length < 3) list.push(tileIndex);

        this.ui.render(this.state, this.mySeat);
    }

    confirmUserSwap() {
        if (this.state.selectedSwapIndices?.length !== 3) return;
        this.sound.play('select');
        const myPlayer = this.state.players[this.mySeat];
        myPlayer.swapTiles = this.state.selectedSwapIndices.map(i => myPlayer.hand[i]);
        this.ui.hideInstruction();
        this.log('已选换牌');
        this.dispatchAction(this.mySeat, 'CONFIRM_SWAP', { swapTiles: myPlayer.swapTiles, swapTileIds: myPlayer.swapTiles.map(t => t.id) });
    }

    selectUserQue(chosenSuit) {
        this.sound.play('select');
        const myPlayer = this.state.players[this.mySeat];
        if (myPlayer) myPlayer.que = chosenSuit;
        this.ui.hideInstruction();
        this.ui.render(this.state, this.mySeat);
        this.dispatchAction(this.mySeat, 'SELECT_QUE', { que: chosenSuit });
    }

    processTurn(isRinshan = false) {
        if ((this.p2p && !this.p2p.isHost) || this.state.phase !== CONFIG.PHASES.PLAYING) return;
        if (this.state.isGameOver()) return this.endGame();

        const p = this.state.players[this.state.currentTurn];
        if (p?.isEliminated || p?.score <= 0) {
            if (p) p.isEliminated = true;
            this.state.currentTurn = (this.state.currentTurn + 1) % CONFIG.TOTAL_PLAYERS;
            return this.processTurn();
        }

        if (isRinshan || p.hand.length % 3 === 1) {
            const events = GameDSL.drawTile(this.state, this.state.currentTurn, isRinshan);
            if (this.state.phase === CONFIG.PHASES.END) return this.endGame();
            this.handleDslEvents(events);
        }

        this.syncStateToPeers();
        if (this.state.currentTurn === this.mySeat) {
            this.ui.updateTingPanel(p);
            const isAuto = this.state.autoPlay || p.isHu || (this.state.autoQue && p.que && p.hand.some(t => t.suit === p.que));
            if (isAuto) {
                this.ui.hideActionBox();
                setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CONFIG.DELAYS.AI_TURN);
            } else {
                this.checkPlayerTurnActions();
            }
        } else if (!this.isHumanPlayer(this.state.currentTurn) || p.isHu) {
            setTimeout(() => this.autoPlayPlayerTurn(this.state.currentTurn), CONFIG.DELAYS.AI_TURN);
        }
    }

    checkPlayerTurnActions() {
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length % 3 !== 2 || this.state.autoPlay || p.isHu || p.isEliminated) return this.ui.hideActionBox();

        const drawnTile = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawnTile);
        const gangs = this.engine.checkCanGang(p);

        if (canHu || gangs.length > 0) {
            this.ui.showActionBox(
                canHu, gangs.length > 0, false,
                () => { this.ui.hideActionBox(); this.dispatchAction(this.mySeat, 'HU', { tile: drawnTile, isZiMo: true }); },
                () => { this.ui.hideActionBox(); this.dispatchAction(this.mySeat, 'GANG', { gangOption: gangs[0] }); },
                null, () => this.ui.hideActionBox()
            );
        } else {
            this.ui.hideActionBox();
        }
    }

    handleTileClick(index) {
        if (this.state.phase === CONFIG.PHASES.SWAP3) return this.toggleSwapTileSelect(index);
        if (this.state.phase !== CONFIG.PHASES.PLAYING || this.state.currentTurn !== this.mySeat) return;

        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length % 3 !== 2 || p.isEliminated) return;
        const tile = p.hand[index];
        if (!tile) return;

        if (p.hand.some(t => t.suit === p.que) && tile.suit !== p.que) return this.log(`先打缺门牌(缺${CONFIG.SUITS[p.que]})`);
        if (p.isHu && index !== p.hand.length - 1) return this.log('已胡牌只能摸打');

        this.ui.hideActionBox();
        this.dispatchAction(this.mySeat, 'DISCARD', { handIndex: index, tileId: tile.id, tileCode: tile.code });
    }

    executeDiscard(playerIndex, handIndex, tileId = null) {
        const p = this.state.players[playerIndex];
        if (!p || p.hand.length % 3 !== 2 || this.isDiscarding) return;

        this.isDiscarding = true;
        try {
            const actualIndex = (tileId != null) ? p.hand.findIndex(t => t.id === tileId) : handIndex;
            const targetTile = p.hand[actualIndex];
            if (!targetTile) return;

            const events = GameDSL.discardTile(this.state, playerIndex, actualIndex, this.engine);
            this.handleDslEvents(events);
            if (playerIndex === this.mySeat) this.ui.updateTingPanel(p);
            this.checkOffTurnActions(targetTile, playerIndex);
        } finally {
            this.isDiscarding = false;
        }
    }

    checkOffTurnActions(discardedTile, discarderIndex) {
        const huCandidates = [1, 2, 3].map(o => (discarderIndex + o) % CONFIG.TOTAL_PLAYERS)
            .filter(idx => !this.state.players[idx].isEliminated && this.engine.checkCanHu(this.state.players[idx], discardedTile));

        if (huCandidates.length > 0) return this.arbitrateHu(huCandidates, discardedTile, discarderIndex);
        this.arbitratePungGang(discardedTile, discarderIndex, 1);
    }

    arbitrateHu(candidateIndices, discardedTile, discarderIndex) {
        const decisions = {};
        let pendingCount = 0;

        candidateIndices.forEach(idx => {
            const isAuto = !this.isHumanPlayer(idx) || (idx === this.mySeat && (this.state.autoPlay || this.state.players[idx]?.isHu));
            if (isAuto) {
                decisions[idx] = 'HU';
            } else if (idx === this.mySeat) {
                pendingCount++;
                this.ui.showActionBox(
                    true, false, false,
                    () => { this.ui.hideActionBox(); decisions[idx] = 'HU'; this.resolveHu(candidateIndices, decisions, discardedTile, discarderIndex); },
                    null, null,
                    () => { this.ui.hideActionBox(); decisions[idx] = 'PASS'; this.resolveHu(candidateIndices, decisions, discardedTile, discarderIndex); }
                );
            } else {
                const sent = this.p2p.sendToSeat(idx, { type: 'PROMPT_OFFTURN_ACTION', options: { canHu: true, canGang: false, canPung: false, tile: discardedTile, fromPlayer: discarderIndex } });
                if (sent) pendingCount++;
                else decisions[idx] = 'PASS';
            }
        });

        this.pendingOffTurn = { candidates: candidateIndices, decisions, tile: discardedTile, discarder: discarderIndex };
        if (pendingCount === 0) this.resolveHu(candidateIndices, decisions, discardedTile, discarderIndex);
    }

    resolveHu(candidateIndices, decisions, discardedTile, discarderIndex) {
        if (!candidateIndices.every(i => decisions[i] !== undefined)) return;
        this.pendingOffTurn = null;

        const huWinners = candidateIndices.filter(i => decisions[i] === 'HU');
        if (huWinners.length > 0) {
            huWinners.forEach(idx => this.dispatchAction(idx, 'HU', { tile: discardedTile, isZiMo: false, fromPlayer: discarderIndex }));
            this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
            this.syncStateToPeers();
            return setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
        }
        this.arbitratePungGang(discardedTile, discarderIndex, 1);
    }

    arbitratePungGang(discardedTile, discarderIndex, offset = 1) {
        for (let i = offset; i <= 3; i++) {
            const targetIndex = (discarderIndex + i) % CONFIG.TOTAL_PLAYERS;
            const targetPlayer = this.state.players[targetIndex];
            if (targetPlayer.isHu || targetPlayer.isEliminated) continue;

            const canGang = this.engine.checkCanPungOrGang(targetPlayer, discardedTile, 'GANG');
            const canPung = this.engine.checkCanPungOrGang(targetPlayer, discardedTile, 'PUNG');
            if (!canGang && !canPung) continue;

            const isAuto = !this.isHumanPlayer(targetIndex) || (targetIndex === this.mySeat && this.state.autoPlay);
            if (isAuto) {
                if (canGang && this.ai.shouldGang(targetPlayer, discardedTile)) {
                    return this.dispatchAction(targetIndex, 'MELD', { type: 'GANG', tile: discardedTile, from: discarderIndex, removeCount: 3, score: 200, isGang: true });
                }
                if (canPung && this.ai.shouldPung(targetPlayer, discardedTile)) {
                    return this.dispatchAction(targetIndex, 'MELD', { type: 'PUNG', tile: discardedTile, from: discarderIndex, removeCount: 2, score: 0, isGang: false });
                }
                if (targetIndex === this.mySeat) return this.arbitratePungGang(discardedTile, discarderIndex, i + 1);
            } else if (targetIndex === this.mySeat) {
                return this.ui.showActionBox(
                    false, canGang, canPung, null,
                    () => { this.ui.hideActionBox(); this.dispatchAction(this.mySeat, 'MELD', { type: 'GANG', tile: discardedTile, from: discarderIndex, removeCount: 3, score: 200, isGang: true }); },
                    () => { this.ui.hideActionBox(); this.dispatchAction(this.mySeat, 'MELD', { type: 'PUNG', tile: discardedTile, from: discarderIndex, removeCount: 2, score: 0, isGang: false }); },
                    () => { this.ui.hideActionBox(); this.arbitratePungGang(discardedTile, discarderIndex, i + 1); }
                );
            } else {
                const sent = this.p2p.sendToSeat(targetIndex, { type: 'PROMPT_OFFTURN_ACTION', options: { canHu: false, canGang, canPung, tile: discardedTile, fromPlayer: discarderIndex } });
                if (sent) {
                    this.pendingOffTurn = { idx: targetIndex, tile: discardedTile, discarder: discarderIndex, offset: i + 1 };
                    return;
                }
            }
        }

        this.state.currentTurn = (discarderIndex + 1) % CONFIG.TOTAL_PLAYERS;
        this.syncStateToPeers();
        setTimeout(() => this.processTurn(), CONFIG.DELAYS.AI_TURN);
    }

    autoPlayQueDiscard(playerIndex) {
        if (this.state.currentTurn !== playerIndex || this.state.phase !== CONFIG.PHASES.PLAYING) return;
        const p = this.state.players[playerIndex];
        if (!p || p.hand.length % 3 !== 2) return;

        if (p.que && p.hand.some(t => t.suit === p.que)) {
            let rightmostQueIdx = -1;
            for (let i = p.hand.length - 1; i >= 0; i--) {
                if (p.hand[i].suit === p.que) {
                    rightmostQueIdx = i;
                    break;
                }
            }
            if (rightmostQueIdx !== -1) {
                const target = p.hand[rightmostQueIdx];
                return this.dispatchAction(playerIndex, 'DISCARD', { handIndex: rightmostQueIdx, tileId: target?.id, tileCode: target?.code });
            }
        }
        return this.autoPlayPlayerTurn(playerIndex);
    }

    autoPlayPlayerTurn(playerIndex) {
        if (this.state.currentTurn !== playerIndex || this.state.phase !== CONFIG.PHASES.PLAYING) return;
        const p = this.state.players[playerIndex];
        if (!p || p.hand.length % 3 !== 2) return;

        const drawnTile = p.hand[p.hand.length - 1];
        const canHu = this.engine.checkCanHu(p, drawnTile);
        const gangs = this.engine.checkCanGang(p);

        if (canHu) return this.dispatchAction(playerIndex, 'HU', { tile: drawnTile, isZiMo: true });
        if (p.isHu) return this.dispatchAction(playerIndex, 'DISCARD', { handIndex: p.hand.length - 1 });
        if (gangs.length > 0 && !this.isHumanPlayer(playerIndex)) return this.dispatchAction(playerIndex, 'GANG', { gangOption: gangs[0] });

        let idx = -1;
        if (p.que && p.hand.some(t => t.suit === p.que)) {
            if (playerIndex === this.mySeat && this.state.autoQue) {
                for (let i = p.hand.length - 1; i >= 0; i--) {
                    if (p.hand[i].suit === p.que) { idx = i; break; }
                }
            } else {
                idx = this.ai.chooseDiscardIndex(p);
            }
        } else {
            idx = this.ai.chooseDiscardIndex(p);
        }

        if (idx < 0) idx = 0;
        const target = p.hand[idx];
        this.dispatchAction(playerIndex, 'DISCARD', { handIndex: idx, tileId: target?.id, tileCode: target?.code });
    }

    endGame() {
        this.state.phase = CONFIG.PHASES.END;
        const logs = GameDSL.calculateEndSettlement(this.state, this.engine);
        this.state.settlementLogs = logs;
        logs.forEach(t => this.log(t));
        this.ui.render(this.state, this.mySeat);
        this.ui.showResultModal(this.state.players, logs);
        this.syncStateToPeers();
    }

    syncStateToPeers() { if (this.p2p?.isHost) this.p2p.broadcastState(this.state); }

    initP2PEvents() {
        if (!this.p2p) return;
        this.p2p.onStateReceived = s => this.handleRemoteStateSync(s);
        this.p2p.onActionReceived = (pIdx, a, pl) => this.dispatchAction(pIdx, a, pl);
        this.p2p.onPromptReceived = opt => this.handleRemotePrompt(opt);
        this.p2p.onRoomUpdate = () => {
            this.state.players.forEach((p, i) => { p.name = this.getBasePlayerName(i); });
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
        };
    }

    handleRemoteStateSync(remoteState) {
        const isNew = Boolean(remoteState.gameSeed && this.state.gameSeed !== remoteState.gameSeed);
        if (remoteState.lastDiscard && (!this.state.lastDiscard || this.state.lastDiscard.tile?.id !== remoteState.lastDiscard.tile?.id)) this.sound.play('discard');

        const myHuR = remoteState.players?.[this.mySeat]?.huRecords?.length || 0;
        const myHuL = this.state.players?.[this.mySeat]?.huRecords?.length || 0;
        const totalHuR = (remoteState.players || []).reduce((acc, p) => acc + (p.huRecords?.length || 0), 0);
        const totalHuL = (this.state.players || []).reduce((acc, p) => acc + (p.huRecords?.length || 0), 0);

        if (myHuR > myHuL) this.sound.play('hu');
        else if (totalHuR > totalHuL) this.sound.play('hu_opp');

        const savedIndices = isNew ? [] : (this.state.selectedSwapIndices || []);
        const savedQue = isNew ? null : this.state.players[this.mySeat]?.que;
        const mySwapTiles = isNew ? [] : this.state.players[this.mySeat]?.swapTiles;

        if (remoteState.gameSeed && this.state.gameSeed !== remoteState.gameSeed && remoteState.phase !== CONFIG.PHASES.INIT) {
            const prng = new DeterministicPRNG(remoteState.gameSeed);
            const fullDeck = this.engine.shuffle(this.engine.createDeck(), prng);
            for (let r = 0; r < CONFIG.HAND_SIZE * CONFIG.TOTAL_PLAYERS + 1; r++) fullDeck.pop();
            this.state.wall = fullDeck;
            this.state.gameSeed = remoteState.gameSeed;
        }

        Object.assign(this.state, remoteState);
        if (this.p2p && !this.p2p.isHost) this.state.wall = null;

        const myPlayer = this.state.players[this.mySeat];
        if (savedQue && myPlayer && !myPlayer.que) myPlayer.que = savedQue;
        if (mySwapTiles?.length === 3 && myPlayer && !myPlayer.swapTiles?.length) myPlayer.swapTiles = mySwapTiles;
        if (this.state.phase === CONFIG.PHASES.SWAP3) this.state.selectedSwapIndices = savedIndices;

        this.state.players.forEach((p, idx) => {
            p.name = this.getBasePlayerName(idx);
            if (p.hand) this.engine.sortHand(p.hand, p.que);
        });

        this.updateRoomMembersDisplay();
        this.ui.render(this.state, this.mySeat);

        if (this.state.phase === CONFIG.PHASES.PLAYING && this.state.currentTurn === this.mySeat) {
            const isAuto = this.state.autoPlay || myPlayer?.isHu || (this.state.autoQue && myPlayer?.que && myPlayer.hand.some(t => t.suit === myPlayer.que));
            if (isAuto) {
                this.ui.hideActionBox();
                setTimeout(() => this.autoPlayPlayerTurn(this.mySeat), CONFIG.DELAYS.AI_TURN);
            } else {
                this.checkPlayerTurnActions();
            }
        }
    }

    handleRemotePrompt(options) {
        const myPlayer = this.state.players[this.mySeat];
        if (options.canHu && (this.state.autoPlay || myPlayer?.isHu)) {
            return this.p2p.sendAction('RESPONSE_OFFTURN', { choice: 'HU', tile: options.tile, fromPlayer: options.fromPlayer });
        }
        this.sound.play('action');
        const sendChoice = choice => {
            this.ui.hideActionBox();
            this.p2p.sendAction('RESPONSE_OFFTURN', { choice, tile: options.tile, fromPlayer: options.fromPlayer });
        };
        this.ui.showActionBox(
            options.canHu, options.canGang, options.canPung,
            () => sendChoice('HU'), () => sendChoice('GANG'), () => sendChoice('PUNG'), () => sendChoice('PASS')
        );
    }

    handlePlayerDisconnect(playerIndex) {
        const p = this.state?.players?.[playerIndex];
        if (!p) return;
        p.name = `${playerIndex + 1}P (电脑)`;

        if (this.pendingOffTurn?.decisions && this.pendingOffTurn.decisions[playerIndex] === undefined) {
            this.pendingOffTurn.decisions[playerIndex] = 'PASS';
            this.resolveHu(this.pendingOffTurn.candidates, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
        } else if (Number(this.pendingOffTurn?.idx) === playerIndex) {
            const info = this.pendingOffTurn;
            this.pendingOffTurn = null;
            this.arbitratePungGang(info.tile, info.discarder, info.offset);
        }

        if (this.state.phase === CONFIG.PHASES.DINGQUE && !p.que) {
            p.que = this.ai.getDingQue(p.hand);
            const evs = GameDSL.confirmDingQue(this.state);
            if (evs.length > 0) { this.handleDslEvents(evs); this.processTurn(); }
        }
        if (this.state.phase === CONFIG.PHASES.SWAP3 && (!p.swapTiles || p.swapTiles.length !== 3)) {
            p.swapTiles = this.ai.getSwapTiles(p.hand);
            if (this.state.players.every(pl => pl.swapTiles?.length === 3)) {
                this.handleDslEvents(GameDSL.executeSwap(this.state));
                this.state.players.forEach((pl, idx) => { pl.que = this.isHumanPlayer(idx) ? null : this.ai.getDingQue(pl.hand); });
                this.syncStateToPeers();
            }
        }
    }

    handleResetAndNewRoom() {
        UIController.hideResultModal();
        try { sessionStorage.removeItem('hz_session'); } catch {}
        this.p2p.reset();
        this.isOnline = false;
        const code = String(Math.floor(1000 + Math.random() * 9000));
        this.handleCreateRoom(code);
        this.initGame(false);
        this.log(`新房间: ${code}`);
    }

    handleChangeName() {
        const defaultName = this.getMyName() || (this.mySeat === 0 ? '1P' : `${this.mySeat + 1}P`);
        const input = prompt(pyT('请输入你的玩家昵称 (最多8字):'), defaultName);
        if (input == null) return;

        const name = input.trim().slice(0, 8) || defaultName;
        this.setMyName(name);
        this.dispatchAction(this.mySeat, 'SET_NAME', { name });
    }

    async handleCreateRoom(roomCode = null) {
        try {
            const hostName = this.getMyName() ? `${this.getMyName()} (房主)` : '1P (房主)';
            const finalCode = await this.p2p.createRoom(roomCode, hostName);
            this.showRoomBar(finalCode, '房主');
            this.updateRoomMembersDisplay();
            try { sessionStorage.setItem('hz_session', JSON.stringify({ role: 'host', roomCode: finalCode })); } catch {}
        } catch {}
    }

    async handleChangeRoom() {
        try { sessionStorage.removeItem('hz_session'); } catch {}
        const code = String(Math.floor(1000 + Math.random() * 9000));
        await this.handleCreateRoom(code);
        this.initGame(false);
        this.log(`换房: ${code}`);
    }

    async handleJoinRoom(inputCode = null, savedSeat = null) {
        const code = (inputCode || prompt(pyT('请输入4位房间号:')))?.trim();
        if (!code) return;

        try {
            this.log(`连接房间 ${code}...`);
            await this.p2p.joinRoom(code, savedSeat, this.getMyName() || null);
            this.isOnline = true;
            this.state.reset();
            this.state.players.forEach(p => { p.swapTiles = []; p.que = null; });
            this.state.selectedSwapIndices = [];

            this.showRoomBar(this.p2p.roomCode, '玩家');
            this.updateRoomMembersDisplay();
            this.ui.render(this.state, this.mySeat);
            try {
                sessionStorage.setItem('hz_session', JSON.stringify({
                    role: 'client', roomCode: this.p2p.roomCode, seatIndex: this.p2p.seatIndex
                }));
            } catch {}
            this.log(`已加入: ${code}`);
        } catch (err) {
            try { sessionStorage.removeItem('hz_session'); } catch {}
            this.handleResetAndNewRoom();
            alert(pyT('加入房间失败: ') + (err.message || err));
        }
    }

    showRoomBar(roomCode, roleName) {
        const isClient = (roleName === '玩家' || (this.isOnline && !this.p2p?.isHost));
        const bar = UIController.$('room-bar');
        if (bar) bar.style.display = 'flex';
        const codeEl = UIController.$('room-code-display');
        if (codeEl) codeEl.innerText = roomCode;
        const roleEl = UIController.$('room-role-display');
        if (roleEl) roleEl.innerText = `(${pyT(roleName)})`;

        const startBtn = UIController.$('btn-start');
        if (startBtn) startBtn.style.display = isClient ? 'none' : 'inline-block';

        const changeBtn = UIController.$('btn-change-room');
        if (changeBtn) {
            changeBtn.style.display = 'inline-block';
            changeBtn.innerText = isClient ? pyT('离开') : pyT('换号');
            changeBtn.title = isClient ? pyT('离开房间并重置') : pyT('重新生成4位房间号');
            changeBtn.onclick = () => (isClient ? this.handleResetAndNewRoom() : this.handleChangeRoom());
        }

        const joinBtn = UIController.$('btn-join');
        if (joinBtn) joinBtn.style.display = (this.isOnline || isClient) ? 'none' : 'inline-block';
    }

    setLanguageMode(mode) {
        I18nHelper.setMode(mode);
        try {
            localStorage.setItem('hz_lang_mode', mode);
            localStorage.setItem('hz_lang', I18nHelper.lang);
            localStorage.setItem('hz_pinyin', I18nHelper.isPinyin);
        } catch (e) {}
        this.ui.applyPinyinMode();
        this.updateRoomMembersDisplay();
        this.ui.render(this.state, this.mySeat);
    }

    toggleLanguage() {
        this.setLanguageMode(I18nHelper.lang === 'JA' ? 'ZH' : 'JA');
    }

    togglePinyin() {
        this.setLanguageMode(I18nHelper.isPinyin ? 'ZH' : 'PY');
    }

    checkAutoActions() {
        if (!this.state.autoPlay) return;
        const myPlayer = this.state.players[this.mySeat];
        if (!myPlayer) return;

        if (this.state.phase === CONFIG.PHASES.SWAP3 && (!myPlayer.swapTiles || !myPlayer.swapTiles.length)) {
            const swap = this.ai.getSwapTiles(myPlayer.hand);
            myPlayer.swapTiles = swap;
            this.dispatchAction(this.mySeat, 'CONFIRM_SWAP', { swapTiles: swap, swapTileIds: swap.map(t => t.id) });
        } else if (this.state.phase === CONFIG.PHASES.DINGQUE && !myPlayer.que) {
            const que = this.ai.getDingQue(myPlayer.hand);
            this.selectUserQue(que);
        } else if (this.state.phase === CONFIG.PHASES.PLAYING && this.state.currentTurn === this.mySeat) {
            this.autoPlayPlayerTurn(this.mySeat);
        }
    }

    handleStartGame() {
        if (this.isOnline && !this.p2p?.isHost) return this.log('请等待房主开局');
        this.initGame(true);
        this.syncStateToPeers();
    }
}

const gameController = new GameController(
    gameState, soundManager, UIController, MahjongEngine, MahjongAI, p2pManager
);

if (typeof window !== 'undefined') {
    window.GameController = GameController;
    window.gameController = gameController;
}

function setupBrowserEvents(ctrl, state) {
    if (!ctrl || !state) return;
    try {
        const savedMode = localStorage.getItem('hz_lang_mode') ||
            (localStorage.getItem('hz_lang') === 'JA' ? 'JA' : (localStorage.getItem('hz_pinyin') === 'true' ? 'PY' : 'ZH'));
        I18nHelper.setMode(savedMode);
    } catch (e) {}
    UIController.applyPinyinMode();

    const bindToggle = (btnId, key, storeKey, onToggle) => {
        const btn = UIController.$(btnId);
        if (!btn) return;
        if (storeKey) {
            try { state[key] = (localStorage.getItem(storeKey) === 'true'); } catch (e) {}
            btn.classList.toggle('active', state[key]);
        }
        btn.onclick = () => {
            state[key] = !state[key];
            if (storeKey) { try { localStorage.setItem(storeKey, state[key]); } catch (e) {} }
            btn.classList.toggle('active', state[key]);
            ctrl.ui.render(state, ctrl.mySeat);
            onToggle?.();
        };
    };

    bindToggle('btn-auto', 'autoPlay', 'hz_auto_play', () => {
        if (state.autoPlay) ctrl.checkAutoActions();
    });

    bindToggle('btn-auto-que', 'autoQue', 'hz_auto_que', () => {
        const p = state.players[ctrl.mySeat];
        if (state.autoQue && state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat && p?.que && p.hand.some(t => t.suit === p.que)) {
            ctrl.autoPlayQueDiscard(ctrl.mySeat);
        }
    });

    window.addEventListener('keydown', e => {
        const p = state.players[ctrl.mySeat];
        if (!p) return;

        if (state.phase === CONFIG.PHASES.SWAP3) {
            if (e.key >= '1' && e.key <= '9') ctrl.handleTileClick(parseInt(e.key, 10) - 1);
            if (e.key === 'Enter' || e.code === 'Space') UIController.$('btn-confirm-swap')?.click();
            return;
        }

        const cmdBox = UIController.$('cmd-box');
        if (cmdBox && cmdBox.style.display !== 'none') {
            const btnId = { H: 'btn-hu', G: 'btn-gang', P: 'btn-pung', X: 'btn-pass' }[e.key.toUpperCase()];
            const btn = btnId ? UIController.$(btnId) : null;
            if (btn && btn.style.display !== 'none') { e.preventDefault(); return btn.click(); }
        }

        if (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat && p.hand.length % 3 === 2) {
            if (e.key >= '1' && e.key <= '9') ctrl.handleTileClick(parseInt(e.key, 10) - 1);
            else if (e.code === 'Space') ctrl.handleTileClick(p.hand.length - 1);
        }
    });

    let session = null;
    try { session = JSON.parse(sessionStorage.getItem('hz_session')); } catch (e) {}
    if (session?.role === 'client' && session.roomCode) {
        ctrl.handleJoinRoom(session.roomCode, session.seatIndex);
    } else {
        const code = session?.roomCode || UIController.$('room-code-display')?.innerText?.trim();
        ctrl.handleCreateRoom(code);
        ctrl.initGame(false);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => setupBrowserEvents(gameController, gameState));
}

