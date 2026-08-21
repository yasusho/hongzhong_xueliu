/**
 * 紅中血流成河麻雀 - UI描画・表示管理 (UIController)
 */

class UIController {
    static $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    static getTileHtml(t, extra = '') {
        if (!t) return '';
        const svg = MahjongEngine.tileToSvgPath(t);
        const str = MahjongEngine.tileToString(t);
        const cls = `tile-img ${extra}`.trim();
        return `<img class="${cls}" src="${svg}" alt="${str}" draggable="false" />`;
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

    static getDingQueOptionsHtml() {
        const [wTxt, tTxt, bTxt] = [I18nHelper.t('缺万'), I18nHelper.t('缺筒'), I18nHelper.t('缺条')];
        const wImg = this.getTileHtml({ suit: 'W', num: 1 }, 'tile-small');
        const tImg = this.getTileHtml({ suit: 'T', num: 1 }, 'tile-small');
        const bImg = this.getTileHtml({ suit: 'B', num: 1 }, 'tile-small');
        return `
            <button class="btn-que-choice" onclick="gameController.selectUserQue('W')">${wImg} <span>${wTxt}</span></button>
            <button class="btn-que-choice" onclick="gameController.selectUserQue('T')">${tImg} <span>${tTxt}</span></button>
            <button class="btn-que-choice" onclick="gameController.selectUserQue('B')">${bImg} <span>${bTxt}</span></button>
        `.trim();
    }

    static applyPinyinMode(isPinyin) {
        if (typeof I18nHelper !== 'undefined' && typeof isPinyin === 'boolean') {
            I18nHelper.isPinyin = isPinyin;
        }

        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);

        const textElements = [
            ['game-title', '红中血流成河麻将'],
            ['btn-start', '开始对局'],
            ['btn-join', '加入房间'],
            ['lbl-room-code', '房间号'],
            ['btn-change-room', '换号'],
            ['btn-change-name', '改名'],
            ['th-player', '玩家'],
            ['th-score', '积分'],
            ['th-state', '定缺/状态'],
            ['th-melds', '副露'],
            ['td-wall-lbl', '剩余牌山'],
            ['lbl-tiles-unit', '张'],
            ['legend-river', '弃牌区'],
            ['legend-log', '日志'],
            ['lbl-my-score', '积分'],
            ['lbl-ting', '听牌'],
            ['lbl-result-title', '对局结算'],
            ['btn-reset-room', '新建房间 (重置)'],
            ['auto-hu-msg', '已胡牌（自动摸打中）']
        ];
        textElements.forEach(([id, zh]) => {
            const el = this.$(id);
            if (el) el.innerText = pyT(zh);
        });

        const titleElements = [
            ['btn-change-room', '重新生成4位房间号'],
            ['btn-change-name', '修改你的显示昵称'],
            ['btn-pinyin', '切换拼音/汉字显示']
        ];
        titleElements.forEach(([id, zh]) => {
            const el = this.$(id);
            if (el) el.title = pyT(zh);
        });

        // 言語切替ボタン (日/中)
        const langBtn = this.$('btn-lang');
        if (langBtn && typeof I18nHelper !== 'undefined') {
            const isJa = (I18nHelper.lang === 'JA');
            langBtn.innerText = isJa ? '日/中' : '中/日';
            langBtn.title = isJa ? '言語: 日本語 (クリックで中文に切替)' : '语言: 中文 (点击切换到日语)';
        }

        // 表記切替ボタン (汉↔A)
        const pinyinBtn = this.$('btn-pinyin');
        if (pinyinBtn && typeof I18nHelper !== 'undefined') {
            pinyinBtn.innerText = '汉↔A';
            pinyinBtn.classList.toggle('active', I18nHelper.isPinyin);
            pinyinBtn.title = I18nHelper.isPinyin ? '表記: 拼音/Pinyin中 (クリックで漢字表示に戻す)' : '表記: 漢字中 (クリックで拼音表示)';
        }

        const roleEl = this.$('room-role-display');
        if (roleEl) {
            const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
            const isClient = (ctrl?.isOnline && !ctrl?.p2p?.isHost);
            roleEl.innerText = isClient ? `(${pyT('玩家')})` : `(${pyT('房主')})`;
        }

        const autoBtn = this.$('btn-auto');
        if (autoBtn && typeof gameState !== 'undefined') {
            autoBtn.innerText = gameState.autoPlay ? pyT('托管: 开') : pyT('托管: 关');
            autoBtn.title = pyT('自动托管对局');
        }

        const autoQueBtn = this.$('btn-auto-que');
        if (autoQueBtn && typeof gameState !== 'undefined') {
            autoQueBtn.innerText = gameState.autoQue ? pyT('自动打缺: 开') : pyT('自动打缺: 关');
            autoQueBtn.title = pyT('自动打缺门牌');
        }
    }

    static render(state, mySeat = 0) {
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
        const CFG = CONFIG;
        const wall = this.$('wall-num');
        if (wall) wall.innerText = state.wallCount ?? state.wall?.length ?? 112;
        if (state.logs) this.renderLogs(state.logs);

        const isQue = [CFG.PHASES.PLAYING, CFG.PHASES.END].includes(state.phase);
        const opps = [1, 2, 3].map(o => (mySeat + o) % CFG.TOTAL_PLAYERS);

        // 他家プレイヤー一覧描画
        const tbody = this.$('opponents-tbody');
        if (tbody) {
            tbody.innerHTML = opps.map(i => state.players[i]).filter(Boolean).map(p => `
                <tr class="${p.isEliminated ? 'player-eliminated' : ''} ${state.phase === CFG.PHASES.PLAYING && state.currentTurn === p.id && !p.isEliminated ? 'turn-active' : ''}">
                    <td>${pyT(p.name)}${state.phase === CFG.PHASES.PLAYING && state.currentTurn === p.id && !p.isEliminated ? ` [${pyT('手番')}]` : ''}</td>
                    <td class="player-score">${p.score}</td>
                    <td>
                        ${p.isEliminated ? `<span class="tag-eliminated">${pyT('脱落')}</span> ` : ''}
                        ${(isQue && p.que) ? `<span class="tag-que">${pyT('缺' + CFG.SUITS[p.que])}</span> ` : ''}
                        ${p.isHu ? `<span class="tag-hu">${pyT('已胡')}${p.huRecords.length}</span>` : ''}
                    </td>
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
                document.querySelector('.my-section')?.classList.toggle('turn-active', state.phase === CFG.PHASES.PLAYING && state.currentTurn === mySeat && !myP.isEliminated);
            }
            const set = (id, txt) => { const el = this.$(id); if (el) el.innerText = txt; };
            set('hand-score-0', myP.score);
            set('hand-que-0', (isQue && myP.que) ? pyT(`缺${CFG.SUITS[myP.que]}`) : '');
            set('hu-tag-0', myP.isEliminated ? `<span class="tag-eliminated">${pyT('脱落')}</span>` : (myP.isHu ? `${pyT('已胡')}${myP.huRecords.length}` : ''));
            this.renderHand(myP, state, mySeat);
            if (isQue && !myP.isEliminated) this.updateTingPanel(myP);
            else {
                const info = this.$('ting-info');
                if (info) info.style.display = 'none';
            }
            const autoMsg = this.$('auto-hu-msg');
            if (autoMsg) {
                const hasQue = Boolean(myP.que && myP.hand.some(t => t.suit === myP.que));
                const isAutoQueActive = state.autoQue && hasQue;
                const showAuto = (myP.isHu || state.autoPlay || isAutoQueActive || myP.isEliminated);
                autoMsg.style.display = showAuto ? 'inline-block' : 'none';
                if (showAuto) {
                    if (myP.isEliminated) autoMsg.innerText = pyT('脱落');
                    else if (myP.isHu) autoMsg.innerText = pyT('已胡牌（自动摸打中）');
                    else if (state.autoPlay) autoMsg.innerText = pyT('托管中');
                    else if (isAutoQueActive) autoMsg.innerText = pyT('自动打缺中');
                }
            }
        }
    }

    static renderHand(player, state, mySeat = 0) {
        const CFG = CONFIG;
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
            img.src = MahjongEngine.tileToSvgPath(tile);
            img.alt = MahjongEngine.tileToString(tile);
            img.draggable = false;
            img.onclick = () => window.gameController?.handleTileClick(idx);
            hand0.appendChild(img);
        });
    }

    static renderLogs(logs) {
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
        const el = this.$('cmd-log');
        if (el && logs) {
            el.innerHTML = logs.map(l => `<div>> ${pyT(l)}</div>`).join('');
            el.scrollTop = el.scrollHeight;
        }
    }

    static log(text) {
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
        const el = this.$('cmd-log');
        if (el) {
            const d = document.createElement('div');
            d.innerText = `> ${pyT(text)}`;
            el.appendChild(d);
            el.scrollTop = el.scrollHeight;
        }
    }

    static clearLog(text = '系统就绪。') {
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
        const el = this.$('cmd-log');
        if (el) el.innerHTML = `<div>> ${pyT(text)}</div>`;
    }

    static updateTingPanel(player) {
        const info = this.$('ting-info'), list = this.$('ting-list');
        if (!info || !list) return;
        const tingTiles = MahjongEngine.getTingTiles(player);
        info.style.display = tingTiles.length ? 'inline-flex' : 'none';
        list.innerHTML = tingTiles.map(t => this.getTileHtml(t, 'tile-ting')).join('');
    }

    static showInstruction(title, desc, optionsHtml) {
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
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
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
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
        const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);
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
            btn.innerText = (typeof I18nHelper !== 'undefined' && I18nHelper.isPinyin) ? restartPy : restartZh;
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
