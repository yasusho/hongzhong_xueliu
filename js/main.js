/**
 * 紅中血流成河麻雀 - UI描画・サウンド・ゲーム進行コントローラー (UIController, SoundManager, GameController)
 */

// --- 1. 依存モジュールの解決 (Browser / Node.js 両対応) ---
const _CFG = (typeof globalThis !== 'undefined' && globalThis.CONFIG) ? globalThis.CONFIG : ((typeof require !== 'undefined') ? require('./engine.js').CONFIG : {});
const _Pinyin = (typeof globalThis !== 'undefined' && globalThis.PinyinHelper) ? globalThis.PinyinHelper : ((typeof require !== 'undefined') ? require('./pinyin.js').PinyinHelper : null);
const _Dict = (typeof globalThis !== 'undefined' && globalThis.PINYIN_DICT) ? globalThis.PINYIN_DICT : ((typeof require !== 'undefined') ? require('./pinyin.js').PINYIN_DICT : null);

const pyT = text => _Pinyin ? _Pinyin.t(text) : text;

// --- 2. サウンド管理 (SoundManager) ---
class SoundManager {
    constructor() {
        this._ctx = null;
        this.gain = null;
        if (typeof window === 'undefined') return;

        const resumeAudio = () => {
            if (this._ctx && this._ctx.state === 'suspended') {
                this._ctx.resume().catch(() => {});
            }
        };
        ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
            window.addEventListener(ev, resumeAudio, { passive: true });
        });
    }

    get ctx() {
        if (!this._ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this._ctx = new AudioCtx();
                this.gain = this._ctx.createGain();
                this.gain.gain.value = 0.6;
                this.gain.connect(this._ctx.destination);
            }
        }
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    }

    play(type) {
        const audioCtx = this.ctx;
        if (!audioCtx) return;

        const soundEffects = {
            discard: () => {
                this._tone('triangle', (f, t) => {
                    f.setValueAtTime(360, t);
                    f.exponentialRampToValueAtTime(80, t + 0.07);
                }, 0.5, 0.07);
            },
            select: () => {
                this._tone('sine', (f, t) => {
                    f.setValueAtTime(750, t);
                }, 0.25, 0.05);
            },
            action: () => {
                this._tone('triangle', (f, t) => { f.setValueAtTime(523, t); }, 0.35, 0.08, 0);
                this._tone('triangle', (f, t) => { f.setValueAtTime(880, t); }, 0.35, 0.12, 0.07);
            },
            // 自分自身の和了（高揚感のあるファンファーレ調アルペジオ）
            hu: () => {
                [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                    this._tone('triangle', (f, t) => { f.setValueAtTime(freq, t); }, 0.4, 0.22, i * 0.09);
                });
            },
            // 他家の和了（注意を促す下降チャイム）
            hu_opp: () => {
                [783.99, 659.25, 523.25].forEach((freq, i) => {
                    this._tone('sawtooth', (f, t) => { f.setValueAtTime(freq, t); }, 0.28, 0.16, i * 0.08);
                });
            }
        };

        soundEffects[type]?.();
    }

    _tone(type, freqFn, gainVal, dur, delay = 0) {
        try {
            const c = this.ctx;
            if (!c) return;
            const t = c.currentTime + delay;
            const osc = c.createOscillator();
            const g = c.createGain();

            osc.type = type;
            freqFn(osc.frequency, t);

            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(gainVal, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(g);
            g.connect(this.gain || c.destination);

            osc.start(t);
            osc.stop(t + dur);
        } catch (e) {}
    }
}

const soundManager = new SoundManager();

// --- 3. UI描画・表示管理 (UIController) ---
class UIController {
    static $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    static getTileHtml(t, extra = '') {
        if (!t) return '';
        const Engine = (typeof globalThis !== 'undefined' && globalThis.MahjongEngine) || (typeof MahjongEngine !== 'undefined' ? MahjongEngine : null);
        const svg = Engine ? Engine.tileToSvgPath(t) : '';
        const str = Engine ? Engine.tileToString(t) : '';
        return `<img class="tile-img ${extra}".trim() src="${svg}" alt="${str}" draggable="false" />`;
    }

    static getMeldsHtml(melds, size = 'normal') {
        if (!melds?.length) return (size === 'small' ? '-' : '');
        return melds.map(m => {
            const imgHtml = this.getTileHtml(m.tile, size === 'small' ? 'tile-small' : '');
            return `<span class="meld-group">${imgHtml.repeat(m.type === 'PUNG' ? 3 : 4)}</span>`;
        }).join('');
    }

    static getDiscardsHtml(discards, last) {
        return (discards || []).map(t => {
            const isLatest = last?.tile?.id === t.id;
            return this.getTileHtml(t, `tile-river${isLatest ? ' latest' : ''}`);
        }).join('');
    }

    static applyPinyinMode(isPinyin) {
        if (_Pinyin) _Pinyin.isPinyin = isPinyin;

        const textElements = [
            ['game-title', '红中血流成河麻将', 'Hóngzhōng Xuèliú Chénghé Mǎjiàng'],
            ['btn-start', '开始对局', 'Kāishǐ Duìjú'],
            ['btn-join', '加入房间', 'Jiārù Fángjiān'],
            ['lbl-room-code', '房间号', 'Fángjiānhào'],
            ['btn-change-room', '换号', 'Huànhào'],
            ['btn-change-name', '改名', 'Gǎimíng'],
            ['th-player', '玩家', 'Wánjiā'],
            ['th-score', '积分', 'Jīfēn'],
            ['th-state', '定缺/状态', 'Dìngquē / Zhuàngtài'],
            ['th-melds', '副露', 'Fùlù'],
            ['td-wall-lbl', '剩余牌山', 'Shèngyú Páishān'],
            ['lbl-tiles-unit', '张', 'zhāng'],
            ['legend-river', '弃牌区', 'Qìpái Qū'],
            ['legend-log', '日志', 'Rìzhì'],
            ['lbl-my-score', '积分', 'Jīfēn'],
            ['lbl-ting', '听牌', 'Tīngpái'],
            ['btn-pinyin', '汉↔A', 'A↔汉'],
            ['lbl-result-title', '对局结算', 'Duìjú Jiésuàn'],
            ['btn-reset-room', '新建房间 (重置)', 'Xīnjiàn Fángjiān (Chóngzhì)'],
            ['auto-hu-msg', '已胡牌（自动摸打中）', 'Yǐ Hú (Zìdòng mō dǎ zhōng)']
        ];
        textElements.forEach(([id, zh, py]) => {
            const el = this.$(id);
            if (el) el.innerText = isPinyin ? py : zh;
        });

        const titleElements = [
            ['btn-change-room', '重新生成4位房间号', 'Chóngxīn shēngchéng 4 wèi fángjiānhào'],
            ['btn-change-name', '修改你的显示昵称', 'Xiūgǎi nǐ de xiǎnshì nǐchēng'],
            ['btn-pinyin', '切换拼音/汉字显示', 'Qiēhuàn pīnyīn/hànzì xiǎnshì']
        ];
        titleElements.forEach(([id, zh, py]) => {
            const el = this.$(id);
            if (el) el.title = isPinyin ? py : zh;
        });

        const roleEl = this.$('room-role-display');
        if (roleEl) {
            const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
            const isClient = (ctrl?.isOnline && !ctrl?.p2p?.isHost);
            roleEl.innerText = isClient ? (isPinyin ? '(Wánjiā)' : '(玩家)') : (isPinyin ? '(Fángzhǔ)' : '(房主)');
        }

        const autoBtn = this.$('btn-auto');
        if (autoBtn && (typeof globalThis !== 'undefined' && globalThis.gameState)) {
            autoBtn.innerText = isPinyin ? `Tuōguǎn: ${globalThis.gameState.autoPlay ? 'Kāi' : 'Guān'}` : `托管: ${globalThis.gameState.autoPlay ? '开' : '关'}`;
        }
    }

    static render(state, mySeat = 0) {
        const CFG = (typeof globalThis !== 'undefined' && globalThis.CONFIG) || _CFG;
        const wall = this.$('wall-num');
        if (wall) wall.innerText = state.wallCount ?? state.wall?.length ?? 112;
        if (state.logs) this.renderLogs(state.logs);

        const isQue = [CFG.PHASES.PLAYING, CFG.PHASES.END].includes(state.phase);
        const opps = [1, 2, 3].map(o => (mySeat + o) % CFG.TOTAL_PLAYERS);

        // 他家プレイヤー一覧描画
        const tbody = this.$('opponents-tbody');
        if (tbody) {
            tbody.innerHTML = opps.map(i => state.players[i]).filter(Boolean).map(p => `
                <tr class="${state.phase === CFG.PHASES.PLAYING && state.currentTurn === p.id ? 'turn-active' : ''}">
                    <td>${pyT(p.name)}${state.phase === CFG.PHASES.PLAYING && state.currentTurn === p.id ? ` [${pyT('手番')}]` : ''}</td>
                    <td class="player-score">${p.score}</td>
                    <td>${(isQue && p.que) ? `<span class="tag-que">${pyT('缺' + CFG.SUITS[p.que])}</span> ` : ''}${p.isHu ? `<span class="tag-hu">${pyT('已胡')}${p.huRecords.length}</span>` : ''}</td>
                    <td>${this.getMeldsHtml(p.melds, 'small')}</td>
                </tr>`).join('');
        }

        // 捨て牌（河）描画
        const river = this.$('river-container');
        if (river) {
            river.innerHTML = [...opps, mySeat].map(i => state.players[i]).filter(Boolean).map(p => `
                <div class="river-row"><span class="river-label">${pyT(p.name)}:</span><span class="river-tiles">${this.getDiscardsHtml(p.discards, state.lastDiscard)}</span></div>`).join('');
        }

        // 自身の手牌・情報描画
        const myP = state.players[mySeat];
        if (myP) {
            if (typeof document !== 'undefined') {
                document.querySelector('.my-section')?.classList.toggle('turn-active', state.phase === CFG.PHASES.PLAYING && state.currentTurn === mySeat);
            }
            const set = (id, txt) => { const el = this.$(id); if (el) el.innerText = txt; };
            set('hand-score-0', myP.score);
            set('hand-que-0', (isQue && myP.que) ? pyT(`缺${CFG.SUITS[myP.que]}`) : '');
            set('hu-tag-0', myP.isHu ? `${pyT('已胡')}${myP.huRecords.length}` : '');
            this.renderHand(myP, state, mySeat);
            if (isQue) this.updateTingPanel(myP);
            else {
                const info = this.$('ting-info');
                if (info) info.style.display = 'none';
            }
            const autoMsg = this.$('auto-hu-msg');
            if (autoMsg) autoMsg.style.display = (myP.isHu || state.autoPlay) ? 'inline-block' : 'none';
        }
    }

    static renderHand(player, state, mySeat = 0) {
        const CFG = (typeof globalThis !== 'undefined' && globalThis.CONFIG) || _CFG;
        const Engine = (typeof globalThis !== 'undefined' && globalThis.MahjongEngine) || (typeof MahjongEngine !== 'undefined' ? MahjongEngine : null);
        const hand0 = this.$('hand-0'), melds0 = this.$('melds-0');
        if (!hand0 || !melds0) return;

        melds0.innerHTML = this.getMeldsHtml(player.melds, 'normal');
        hand0.innerHTML = '';

        const isDrawn = (state.phase === CFG.PHASES.PLAYING && state.currentTurn === mySeat && player.hand.length % 3 === 2);
        const isQue = [CFG.PHASES.PLAYING, CFG.PHASES.END].includes(state.phase);
        const hasQue = isQue && player.hand.some(t => t.suit === player.que);

        player.hand.forEach((tile, idx) => {
            if (isDrawn && idx === player.hand.length - 1) {
                const sp = document.createElement('span');
                sp.className = 'tsumo-divider';
                hand0.appendChild(sp);
            }
            const isSwap = (state.phase === CFG.PHASES.SWAP3);
            const isSel = isSwap && state.selectedSwapIndices?.includes(idx);
            const isQueTile = isQue && (tile.suit === player.que);
            const isPlayable = isSwap || (isDrawn && (player.isHu ? idx === player.hand.length - 1 : (!hasQue || isQueTile)));

            const img = document.createElement('img');
            img.className = `tile-img ${isSel ? 'selected' : ''} ${isQueTile ? 'is-que' : ''} ${isPlayable ? 'tile-playable' : 'tile-disabled'}`.trim();
            img.src = Engine ? Engine.tileToSvgPath(tile) : '';
            img.alt = Engine ? Engine.tileToString(tile) : '';
            img.draggable = false;
            img.onclick = () => window.gameController?.handleTileClick(idx);
            hand0.appendChild(img);
        });
    }

    static renderLogs(logs) {
        const el = this.$('cmd-log');
        if (el && logs) {
            el.innerHTML = logs.map(l => `<div>> ${pyT(l)}</div>`).join('');
            el.scrollTop = el.scrollHeight;
        }
    }

    static log(text) {
        const el = this.$('cmd-log');
        if (el) {
            const d = document.createElement('div');
            d.innerText = `> ${pyT(text)}`;
            el.appendChild(d);
            el.scrollTop = el.scrollHeight;
        }
    }

    static clearLog(text = '系统就绪。') {
        const el = this.$('cmd-log');
        if (el) el.innerHTML = `<div>> ${pyT(text)}</div>`;
    }

    static updateTingPanel(player) {
        const info = this.$('ting-info'), list = this.$('ting-list');
        if (!info || !list) return;
        const Engine = (typeof globalThis !== 'undefined' && globalThis.MahjongEngine) || (typeof MahjongEngine !== 'undefined' ? MahjongEngine : null);
        const tingTiles = Engine ? Engine.getTingTiles(player) : [];
        info.style.display = tingTiles.length ? 'inline-flex' : 'none';
        list.innerHTML = tingTiles.map(t => this.getTileHtml(t, 'tile-ting')).join('');
    }

    static showInstruction(title, desc, optionsHtml) {
        const box = this.$('phase-instruction');
        if (!box) return;
        this.$('instruction-title').innerText = pyT(title);
        this.$('instruction-desc').innerText = pyT(desc);
        this.$('instruction-options').innerHTML = optionsHtml;
        box.style.display = 'flex';
    }

    static hideInstruction = () => {
        const el = this.$('phase-instruction');
        if (el) el.style.display = 'none';
    };

    static showActionBox(showHu, showGang, showPung, onHu, onGang, onPung, onPass) {
        const actions = [
            { id: 'btn-hu', show: showHu, fn: onHu, label: `${pyT('胡')} (H)` },
            { id: 'btn-gang', show: showGang, fn: onGang, label: `${pyT('杠')} (G)` },
            { id: 'btn-pung', show: showPung, fn: onPung, label: `${pyT('碰')} (P)` },
            { id: 'btn-pass', show: true, fn: onPass, label: `${pyT('过')} (X)` }
        ];

        actions.forEach(({ id, show, fn, label }) => {
            const btn = this.$(id);
            if (btn) {
                btn.style.display = show ? 'inline-block' : 'none';
                btn.onclick = fn;
                btn.innerText = label;
            }
        });
        const box = this.$('cmd-box');
        if (box) box.style.display = 'inline-flex';
    }

    static hideActionBox = () => {
        const el = this.$('cmd-box');
        if (el) el.style.display = 'none';
    };

    static showResultModal(players, penaltyLogs = []) {
        const modal = this.$('result-modal');
        if (!modal) return;

        const titleEl = this.$('lbl-result-title');
        if (titleEl) titleEl.innerText = pyT('对局结算');

        const resetBtn = this.$('btn-reset-room');
        if (resetBtn) resetBtn.innerText = pyT('新建房间 (重置)');

        const sorted = [...players].sort((a, b) => b.score - a.score);

        const ranksHtml = sorted.map((p, idx) => {
            const huList = (p.huRecords || []).map(r => {
                const yakuStr = (r.fanName || '').split('自摸').join('').trim() || '平胡';
                const fanInfoStr = `${r.fan} ${pyT('番')}: ${r.isZiMo ? `${pyT('自摸')} ` : ''}${pyT(yakuStr)}`;
                return `<div class="result-hu-item">• ${r.score} ${pyT('分')} (${fanInfoStr.trim()})</div>`;
            }).join('');

            return `
                <div class="result-rank-row">
                    <div class="result-rank-header">
                        <span>${idx + 1} ${pyT('位')} ${pyT(p.name)}</span>
                        <span><b>${p.score} ${pyT('分')}</b> (${pyT('已胡')} ${p.huRecords?.length || 0} ${pyT('次')})</span>
                    </div>
                    ${huList ? `<div class="result-hu-list">${huList}</div>` : `<div class="result-no-hu">${pyT('本局未胡牌')}</div>`}
                </div>
            `;
        }).join('');

        this.$('result-ranks').innerHTML = ranksHtml;

        const pen = this.$('result-penalties');
        if (pen) {
            pen.innerHTML = penaltyLogs.length ? `<b class="penalties-title">${pyT('清算明细')}:</b>` + penaltyLogs.map(l => `<div class="penalty-item">${pyT(l)}</div>`).join('') : '';
            pen.style.display = penaltyLogs.length ? 'block' : 'none';
        }

        const btn = modal.querySelector('.btn-restart');
        const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
        const isHost = Boolean(ctrl?.p2p?.isHost);
        if (btn) {
            const restartZh = ctrl?.isOnline ? (isHost ? '再来一局 (房主开始)' : '等待房主再来一局') : '再来一局';
            const restartPy = ctrl?.isOnline ? (isHost ? 'Zàilái Yìjú (Fángzhǔ kāishǐ)' : 'Děngdài fángzhǔ zàilái yìjú') : 'Zàilái Yìjú';
            btn.innerText = _Pinyin?.isPinyin ? restartPy : restartZh;
            btn.disabled = Boolean(ctrl?.isOnline && !isHost);
            btn.onclick = () => (ctrl?.isOnline ? ctrl.startOnlineMatch() : ctrl?.initGame(false));
        }
        modal.style.display = 'flex';
    }

    static hideResultModal = () => {
        const el = this.$('result-modal');
        if (el) el.style.display = 'none';
    };
}

// --- 4. ゲーム進行コントローラー (GameController) ---
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
        return (typeof globalThis !== 'undefined' && globalThis.CONFIG) || _CFG;
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
        return (!this.p2p?.isHost && this.p2p?.seatIndex != null) ? this.p2p.seatIndex : 0;
    }

    getMyName() {
        try { return localStorage.getItem('hz_username') || ''; } catch (e) { return ''; }
    }

    setMyName(name) {
        try { localStorage.setItem('hz_username', name); } catch (e) {}
    }

    togglePinyin() {
        this.pinyinMode = !this.pinyinMode;
        try { localStorage.setItem('hz_pinyin_mode', this.pinyinMode); } catch (e) {}
        this.ui.applyPinyinMode(this.pinyinMode);
        this.updateRoomMembersDisplay();
        this.ui.render(this.state, this.mySeat);
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
                return `<span class="member-badge ${this.isHumanPlayer(i) ? 'human' : 'cpu'}" onclick="${i === this.mySeat ? 'gameController.handleChangeName()' : ''}" title="${i === this.mySeat ? (this.pinyinMode ? 'Diǎnjī xiūgǎi nǐchēng' : '点击修改昵称') : ''}">${name}</span>`;
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

        const PRNGClass = this.dslPrng || (typeof globalThis !== 'undefined' && globalThis.DeterministicPRNG) || null;
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
        const code = String(Math.floor(1000 + Math.random() * 9000));
        this.handleCreateRoom(code);
        this.initGame(false);
        this.log(`新房间: ${code}`);
    }

    handleChangeName() {
        const current = this.getMyName() || (this.mySeat === 0 ? '1P' : `${this.mySeat + 1}P`);
        const input = prompt(this.pinyinMode ? 'Qǐng shūrù wánjiā nǐchēng (Zuìduō 8 zì):' : '请输入你的玩家昵称 (最多8字):', current);
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
            this.log(`改名: ${rawName}`);
        } else {
            this.p2p?.sendAction('SET_NAME', { name: formattedName });
            this.log(`改名: ${rawName}`);
        }

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
        const code = inputCode || prompt(this.pinyinMode ? 'Qǐng shūrù 4 wèi fángjiānhào:' : '请输入4位房间号:');
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
            try {
                sessionStorage.setItem('hz_session', JSON.stringify({ role: 'client', roomCode: this.p2p.roomCode, seatIndex: this.p2p.seatIndex }));
            } catch (e) {}
            this.log(`已加入 ${code.trim()}，等待开局...`);
        } catch (err) {
            alert((this.pinyinMode ? 'Jiārù fángjiān shībài: ' : '加入房间失败: ') + (err.message || err));
        }
    }

    showRoomBar(code, role) {
        const set = (id, prop, val) => { const el = UIController.$(id); if (el) el[prop] = val; };
        set('room-bar', 'style', 'display: flex;');
        set('room-code-display', 'innerText', code);
        set('room-role-display', 'innerText', `(${pyT(role)})`);
        const startBtn = UIController.$('btn-start');
        if (startBtn) startBtn.style.display = role === '玩家' ? 'none' : 'inline-block';
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
        const [wTxt, tTxt, bTxt] = [pyT('缺万'), pyT('缺筒'), pyT('缺条')];
        this.ui.showInstruction('定缺', '请选择定缺门类', `
            <button onclick="gameController.selectUserQue('W')">${wTxt}</button>
            <button onclick="gameController.selectUserQue('T')">${tTxt}</button>
            <button onclick="gameController.selectUserQue('B')">${bTxt}</button>`);
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
        if (isRinshan || p.hand.length % 3 === 1) {
            if (!this.state.wall || this.state.wall.length === 0) return this.endGame();
            const drawn = this.state.wall.pop();
            this.state.wallCount = this.state.wall.length;
            p.hand.push(drawn);
            this.log(`${p.name} 摸 ${isRinshan ? '[杠] ' : ''}${this.engine.tileToString(drawn)}`);
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
            } else {
                this.checkPlayerTurnActions();
            }
        } else if (!this.isHumanPlayer(this.state.currentTurn) || p.isHu) {
            setTimeout(() => this.autoPlayPlayerTurn(this.state.currentTurn), CFG.DELAYS.AI_TURN);
        }
    }

    checkPlayerTurnActions() {
        const p = this.state.players[this.mySeat];
        if (!p || p.hand.length % 3 !== 2 || this.state.autoPlay || p.isHu) {
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
        if (!p || p.hand.length % 3 !== 2) return;
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
        const hus = [1, 2, 3].map(o => (discarder + o) % CFG.TOTAL_PLAYERS).filter(i => this.engine.checkCanHu(this.state.players[i], tile));
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
                const sent = this.p2p.sendToSeat(idx, { type: 'PROMPT_OFFTURN_ACTION', options: { canHu: true, tile, fromPlayer: discarder } });
                if (sent) {
                    pending++;
                    setTimeout(() => {
                        if (this.pendingOffTurn?.decisions[idx] === undefined) {
                            this.pendingOffTurn.decisions[idx] = 'PASS';
                            this.resolveHu(this.pendingOffTurn.cands, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
                        }
                    }, 5000);
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
            if (p.isHu) continue;

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
                    setTimeout(() => {
                        if (this.pendingOffTurn?.idx === idx) {
                            const info = this.pendingOffTurn;
                            this.pendingOffTurn = null;
                            this.arbitratePungGang(info.tile, info.discarder, info.offset);
                        }
                    }, 5000);
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
        this.log(`${p.name} ${type === 'GANG' ? '明杠' : '碰'} ${this.engine.tileToString(tile)}`);
        if (scoreTransfer > 0) this.state.transferScore(from, pIdx, scoreTransfer);

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
            const PRNGClass = this.dslPrng || (typeof globalThis !== 'undefined' && globalThis.DeterministicPRNG) || null;
            const prng = PRNGClass ? new PRNGClass(remoteState.gameSeed) : null;
            const deck = this.engine.shuffle(this.engine.createDeck(), prng);
            for (let r = 0; r < CFG.HAND_SIZE * CFG.TOTAL_PLAYERS + 1; r++) deck.pop();
            this.state.wall = deck;
            this.state.gameSeed = remoteState.gameSeed;
        }

        Object.assign(this.state, remoteState);

        // クライアント側の確定・選択状態の保護（同局内のみ）
        if (savedQue && this.state.players[this.mySeat] && !this.state.players[this.mySeat].que) {
            this.state.players[this.mySeat].que = savedQue;
        }
        if (mySwapTiles?.length === 3 && this.state.players[this.mySeat] && (!this.state.players[this.mySeat].swapTiles || this.state.players[this.mySeat].swapTiles.length === 0)) {
            this.state.players[this.mySeat].swapTiles = mySwapTiles;
        }

        this.state.players.forEach((p, i) => { p.name = this.getBasePlayerName(i); });
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
                    const [wTxt, tTxt, bTxt] = [pyT('缺万'), pyT('缺筒'), pyT('缺条')];
                    this.ui.showInstruction('定缺', '请选择定缺门类', `<button onclick="gameController.selectUserQue('W')">${wTxt}</button><button onclick="gameController.selectUserQue('T')">${tTxt}</button><button onclick="gameController.selectUserQue('B')">${bTxt}</button>`);
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

    handleRemoteAction(playerIndex, action, payload) {
        const CFG = this.config;
        if (!this.p2p?.isHost) return;
        const p = this.state.players[playerIndex];
        if (!p) return;

        const handlers = {
            SET_NAME: () => {
                if (payload.name && this.p2p?.playersInfo?.[playerIndex]) {
                    const newName = String(payload.name).trim().slice(0, 8);
                    this.p2p.playersInfo[playerIndex].name = newName;
                    p.name = newName;
                    this.p2p.broadcastRoomInfo();
                    this.syncStateToPeers();
                    this.updateRoomMembersDisplay();
                    this.ui.render(this.state, this.mySeat);
                    this.log(`${playerIndex + 1}P 改名: ${newName}`);
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
            DISCARD: () => this.executeDiscard(playerIndex, payload.handIndex, payload.tileId, payload.tileCode),
            HU: () => this.doHu(playerIndex, payload.tile, payload.isZiMo, payload.fromPlayer),
            GANG: () => this.doGang(playerIndex, payload.gangOption || { tile: payload.gangTile, type: 'AN_GANG' }),
            GANG_DISCARD: () => this._executeMeld(playerIndex, 'GANG', payload.tile, payload.fromPlayer, 3, CFG.GANG_SCORE, true),
            PUNG: () => this._executeMeld(playerIndex, 'PUNG', payload.tile, payload.fromPlayer, 2, 0, false),
            RESPONSE_OFFTURN: () => {
                if (this.pendingOffTurn?.decisions) {
                    this.pendingOffTurn.decisions[playerIndex] = payload.choice;
                    this.resolveHu(this.pendingOffTurn.cands, this.pendingOffTurn.decisions, this.pendingOffTurn.tile, this.pendingOffTurn.discarder);
                } else if (this.pendingOffTurn?.idx === playerIndex) {
                    const info = this.pendingOffTurn;
                    this.pendingOffTurn = null;
                    if (payload.choice === 'GANG') this._executeMeld(playerIndex, 'GANG', info.tile, info.discarder, 3, CFG.GANG_SCORE, true);
                    else if (payload.choice === 'PUNG') this._executeMeld(playerIndex, 'PUNG', info.tile, info.discarder, 2, 0, false);
                    else this.arbitratePungGang(info.tile, info.discarder, info.offset);
                }
            }
        };
        handlers[action]?.();
    }
}

// --- 5. インスタンス生成と初期化 ---
const _state = (typeof globalThis !== 'undefined' && globalThis.gameState) ? globalThis.gameState : ((typeof require !== 'undefined') ? require('./engine.js').gameState : null);
const _engine = (typeof globalThis !== 'undefined' && globalThis.MahjongEngine) ? globalThis.MahjongEngine : ((typeof require !== 'undefined') ? require('./engine.js').MahjongEngine : null);
const _ai = (typeof globalThis !== 'undefined' && globalThis.MahjongAI) ? globalThis.MahjongAI : ((typeof require !== 'undefined') ? require('./engine.js').MahjongAI : null);
const _p2p = (typeof globalThis !== 'undefined' && globalThis.p2pManager) ? globalThis.p2pManager : ((typeof require !== 'undefined') ? require('./p2p.js').p2pManager : null);
const _flow = (typeof globalThis !== 'undefined' && globalThis.GameFlow) ? globalThis.GameFlow : ((typeof require !== 'undefined') ? require('./engine.js').GameFlow : null);
const _dslPrng = (typeof globalThis !== 'undefined' && globalThis.DeterministicPRNG) ? globalThis.DeterministicPRNG : ((typeof require !== 'undefined') ? require('./dsl.js').DeterministicPRNG : null);

let gameController = null;
if (_state) {
    gameController = new GameController(_state, soundManager, UIController, _engine, _ai, _p2p, _flow, _dslPrng);
    if (typeof globalThis !== 'undefined') {
        globalThis.gameController = gameController;
    }
}

// ブラウザ環境イベントバインド
function setupBrowserEvents(ctrl, state) {
    if (typeof window === 'undefined' || !ctrl || !state) return;
    const CFG = (typeof globalThis !== 'undefined' && globalThis.CONFIG) || _CFG;

    // ピンイン設定の復元
    let savedPinyin = false;
    try { savedPinyin = localStorage.getItem('hz_pinyin_mode') === 'true'; } catch (e) {}
    ctrl.pinyinMode = savedPinyin;
    UIController.applyPinyinMode(savedPinyin);

    // 托管ボタン
    const btnAuto = UIController.$('btn-auto');
    if (btnAuto) {
        btnAuto.onclick = () => {
            state.autoPlay = !state.autoPlay;
            const isPy = ctrl.pinyinMode;
            btnAuto.innerText = isPy ? `Tuōguǎn: ${state.autoPlay ? 'Kāi' : 'Guān'}` : `托管: ${state.autoPlay ? '开' : '关'}`;
            btnAuto.classList.toggle('active', state.autoPlay);
            if (state.autoPlay && state.phase === CFG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat) {
                ctrl.autoPlayPlayerTurn(ctrl.mySeat);
            }
        };
    }

    // キーボードショートカット
    window.addEventListener('keydown', e => {
        const p = state.players[ctrl.mySeat];
        if (!p) return;

        if (state.phase === CFG.PHASES.SWAP3) {
            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key) - 1;
                if (idx < p.hand.length) ctrl.handleTileClick(idx);
            }
            if (e.key === 'Enter' || e.code === 'Space') UIController.$('btn-confirm-swap')?.click();
            return;
        }

        // アクションボタン（胡・杠・碰・过）
        const cmdBox = UIController.$('cmd-box');
        if (cmdBox && cmdBox.style.display !== 'none') {
            const btnId = { H: 'btn-hu', G: 'btn-gang', P: 'btn-pung', X: 'btn-pass' }[e.key.toUpperCase()];
            const btn = btnId && UIController.$(btnId);
            if (btn && btn.style.display !== 'none') {
                e.preventDefault();
                return btn.click();
            }
        }

        // 自手番の打牌 (数字キー 1〜9 または Space でツモ切り)
        if (state.phase === CFG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat && p.hand.length % 3 === 2) {
            if (e.key >= '1' && e.key <= '9') {
                const idx = parseInt(e.key) - 1;
                if (idx < p.hand.length) ctrl.handleTileClick(idx);
            } else if (e.code === 'Space') {
                ctrl.handleTileClick(p.hand.length - 1);
            }
        }
    });

    if (window.location.hash) {
        try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    }

    // セッション復元 または 新規ルーム作成
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('hz_session')); } catch (e) {}
    if (saved?.role === 'client' && saved.roomCode) {
        ctrl.handleJoinRoom(saved.roomCode, saved.seatIndex);
    } else {
        const code = saved?.roomCode || UIController.$('room-code-display')?.innerText.trim();
        ctrl.handleCreateRoom(code);
        ctrl.initGame(false);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setupBrowserEvents(gameController, _state);
    });
}

// Universal Global / Module Export
if (typeof globalThis !== 'undefined') {
    globalThis.SoundManager = SoundManager;
    globalThis.soundManager = soundManager;
    globalThis.UIController = UIController;
    globalThis.GameController = GameController;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoundManager, soundManager, UIController, GameController, gameController, setupBrowserEvents };
}
