const TRANSLATIONS = {
    // 游戏标题与牌名
    '红中': ['红中', 'Hóngzhōng'],
    '红中血流成河麻将': ['红中血流成河麻雀', 'Hóngzhōng Xuèliú Chénghé Mǎjiàng'],

    // 头部与房间操作
    '开始对局': ['对局开始', 'Kāishǐ Duìjú'],
    '加入房间': ['ルーム加入', 'Jiārù Fángjiān'],
    '换号': ['ルーム番号を変え', 'Huànhào'],
    '离开': ['ルームを离れ', 'Líkāi'],
    '离开房间并重置': ['ルームを离脱して重置', 'Líkāi fángjiān bìng chóngzhì'],
    '改名': ['改名', 'Gǎimíng'],
    '房间号': ['ルーム番号', 'Fángjiānhào'],
    '房主': ['房主', 'Fángzhǔ'],
    '你': ['あなた', 'Nǐ'],
    '电脑': ['コンピュータ', 'Diànnǎo'],
    '玩家': ['プレイヤー', 'Wánjiā'],
    '积分': ['点数', 'Jīfēn'],
    '定缺/状态': ['定缺/状态', 'Dìngquē / Zhuàngtài'],
    '副露': ['副露', 'Fùlù'],
    '剩余牌山': ['余る牌山', 'Shèngyú Páishān'],
    '弃牌区': ['廃棄ゾーン', 'Qìpái Qū'],
    '日志': ['ログ', 'Rìzhì'],
    '听牌': ['テンパイ', 'Tīngpái'],

    // 对局阶段与指令
    '换三张': ['三枚换え', 'Huàn Sān Zhāng'],
    '选3张牌': ['3张の牌を選択して', 'Xuǎn 3 zhāng pái'],
    '确定': ['确定', 'Quèdìng'],
    '定缺': ['定缺', 'Dìngquē'],
    '请选择定缺门类': ['定缺の门类を選択して', 'Qǐng xuǎnzé dìngquē ménlèi'],

    // 动作与操作
    '胡': ['あがり', 'Hú'],
    '杠': ['カン', 'Gàng'],
    '碰': ['ポン', 'Pèng'],
    '过': ['パス', 'Guò'],
    '脱落': ['脱落', 'Tuōluò'],
    '摸': ['摸', 'Mō'],
    '打': ['打', 'Dǎ'],
    '[杠]': ['[嶺上]', '[Gàng]'],
    '明杠': ['明カン', 'Mínggàng'],
    '暗杠': ['暗カン', 'Àngàng'],
    '补杠': ['補カン', 'Bǔgàng'],
    '点炮': ['点炮', 'Diǎnpào'],
    '自摸': ['自摸', 'Zìmō'],
    '开局': ['开局', 'Kāijú'],
    '起家': ['が起家です', 'Qǐjiā'],
    '完成': ['完成', 'Wánchéng'],

    // 役名
    '平胡': ['平胡', 'Pínghú'],
    '清一色': ['清一色', 'Qīngyīsè'],
    '对对胡': ['对对胡', 'Duìduìhú'],
    '七对': ['七对', 'Qīduì'],
    '金钩钓': ['金钩钓', 'Jīngōudiào'],
    '杠上花': ['杠上花', 'Gàngshànghuā'],
    '杠上炮': ['杠上炮', 'Gàngshàngpào'],

    // 托管与状态
    '托管': ['自动', 'Tuōguǎn'],
    '托管中': ['自动中', 'Tuōguǎn zhōng'],
    '托管: 开': ['自动: ON', 'Tuōguǎn: Kāi'],
    '托管: 关': ['自动: OFF', 'Tuōguǎn: Guān'],
    '自动打缺': ['自动で缺を打つ', 'Zìdòng dǎquē'],
    '自动打缺中': ['自动打缺中', 'Zìdòng dǎquē zhōng'],
    '自动打缺: 开': ['自动打缺: ON', 'Zìdòng dǎquē: Kāi'],
    '自动打缺: 关': ['自动打缺: OFF', 'Zìdòng dǎquē: Guān'],
    '已胡牌（自动摸打）': ['すでに胡牌（自动摸打）', 'Yǐ hú pái (Zìdòng mō dǎ)'],
    '已胡牌（自动摸打中）': ['すでに胡牌（自动摸打中）', 'Yǐ hú pái (Zìdòng mō dǎ zhōng)'],
    '已胡': ['すでに胡牌', 'Yǐ hú'],

    // 结算与提示
    '对局结算': ['对局结算', 'Duìjú Jiésuàn'],
    '再来一局': ['もう一局', 'Zàilái Yìjú'],
    '等待房主再来一局': ['房主の再来を待ち', 'Děngdài fángzhǔ zàilái yìjú'],
    '新建房间 (重置)': ['新しくルーム建て', 'Xīnjiàn fángjiān (Chóngzhì)'],
    '查花猪': ['欠色ペナルティ', 'Chá huāzhū'],
    '查大叫': ['ノーテン罰符', 'Chá dàjiào'],
    '本局未胡牌': ['本局未胡牌', 'Běnjú wèi hú pái'],
    '清算明细': ['清算明细', 'Qīngsuàn míngxì'],

    // 警告・通知ログ
    '红中不能换牌': ['红中は换牌できません！', 'Hóngzhōng bùnéng huànpái'],
    '已选换牌': ['换牌を選択完了', 'Yǐ xuǎn huànpái'],
    '先打缺门牌': ['まず缺门の牌を打って', 'Xiān dǎ quēmén pái'],
    '已胡牌只能摸打': ['すでに胡牌したプレイヤーは摸打固定です！', 'Yǐ hú pái zhǐnéng mō dǎ'],
    '新房间': ['新ルーム', 'Xīn fángjiān'],
    '换房': ['ルーム変更', 'Huàn fáng'],
    '连接中': ['连接中', 'Liánjiē zhōng'],
    '已加入': ['すでに加入', 'Yǐ jiārù'],
    '与房主断开连接': ['房主との接続切れ', 'Yǔ fángzhǔ duànkāi liánjiē'],
    '进入房间': ['が房间に入室', 'Jìnrù fángjiān'],
    '离线 (电脑托管)': ['が离线 (コンピュータ托管)', 'Líxiàn (Diànnǎo tuōguǎn)'],
    '已加入房间': ['ルームに加入', 'Yǐ jiārù fángjiān'],
    '房间已满员': ['房间は満員', 'Fángjiān yǐ mǎnyuán'],
    '请输入4位房间号:': ['4桁のルーム番号を入力してください:', 'Qǐng shūrù 4 wèi fángjiānhào:'],
    '请输入你的玩家昵称 (最多8字):': ['玩家のニックネームを入力してください (最多8字):', 'Qǐng shūrù nǐ de wánjiā nǐchēng (Zuìduō 8 zì):'],
    '加入房间失败: ': ['房间への加入に失敗: ', 'Jiārù fángjiān shībài: '],
    '连接超时：请确认房间号是否正确': ['タイムアウト：房间番号を确认してください', 'Liánjiē chāoshí: Qǐng quèrèn fángjiānhào shìfǒu zhèngquè'],
    '请等待房主开局': ['房主の开局を待ってください', 'Qǐng děngdài fángzhǔ kāijú'],

    // 单位・数量
    '手番': ['手番', 'Shǒufān'],
    '分': ['点', 'fēn'],
    '番': ['番', 'fān'],
    '根': ['根', 'gēn'],
    '位': ['位', 'wèi'],
    '次': ['回', 'cì'],
    '张': ['枚', 'zhāng'],
    '各家': ['各家', 'gèjiā'],
    '万': ['万', 'wàn'],
    '筒': ['筒', 'tǒng'],
    '条': ['条', 'tiáo']
};

class I18nHelper {
    static lang = 'ZH';
    static isPinyin = false;
    static _sortedKeys = Object.keys(TRANSLATIONS).sort((a, b) => b.length - a.length);
    static _regex = new RegExp(Object.keys(TRANSLATIONS).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

    static getMode() {
        if (this.lang === 'JA') return 'JA';
        return this.isPinyin ? 'PY' : 'ZH';
    }

    static setMode(mode) {
        if (mode === 'JA') {
            this.lang = 'JA';
            this.isPinyin = false;
        } else if (mode === 'PY') {
            this.lang = 'ZH';
            this.isPinyin = true;
        } else {
            this.lang = 'ZH';
            this.isPinyin = false;
        }
        return this.getMode();
    }

    static toggleLanguage() {
        this.lang = (this.lang === 'JA') ? 'ZH' : 'JA';
        return this.lang;
    }

    static togglePinyin() {
        return this.setMode(this.isPinyin ? 'ZH' : 'PY');
    }

    static t(text) {
        if (!text || (this.lang === 'ZH' && !this.isPinyin)) return text;
        const targetIdx = (this.lang === 'JA') ? 0 : 1;
        if (TRANSLATIONS[text]) return TRANSLATIONS[text][targetIdx];

        let result = String(text);
        if (this.isPinyin) result = result.replace(/(\d+)\s*([番分根张位次回])/g, '$1 $2');
        result = result.replace(this._regex, matched => TRANSLATIONS[matched]?.[targetIdx] ?? matched);
        return this.isPinyin ? result.replace(/，/g, ', ').replace(/\s{2,}/g, ' ').trim() : result;
    }
}

const pyT = text => I18nHelper.t(text);

class UIController {
    static $(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }

    static getTileHtml(tile, extraClass = '') {
        if (!tile) return '';
        const svg = MahjongEngine.tileToSvgPath(tile);
        const alt = MahjongEngine.tileToString(tile);
        const cls = `tile-img ${extraClass}`.trim();
        return `<img class="${cls}" src="${svg}" alt="${alt}" draggable="false" />`;
    }

    static getMeldsHtml(melds, size = 'normal') {
        if (!melds?.length) return size === 'small' ? '-' : '';
        return melds.map(meld => {
            const count = meld.type === 'PUNG' ? 3 : 4;
            const extra = size === 'small' ? 'tile-small' : '';
            return `<span class="meld-group">${this.getTileHtml(meld.tile, extra).repeat(count)}</span>`;
        }).join('');
    }

    static getDiscardsHtml(discards, lastDiscard) {
        if (!discards?.length) return '';
        return discards.map(t => this.getTileHtml(t, `tile-river${lastDiscard?.tile?.id === t.id ? ' latest' : ''}`)).join('');
    }

    static getDingQueOptionsHtml() {
        return ['W', 'T', 'B'].map(suit => {
            const img = this.getTileHtml({ suit, num: 1 }, 'tile-small');
            return `<button class="btn-que-choice" onclick="gameController.selectUserQue('${suit}')">${img}</button>`;
        }).join('');
    }

    static applyPinyinMode() {
        const mode = I18nHelper.getMode();

        if (typeof document !== 'undefined') {
            document.querySelectorAll('[data-i18n]').forEach(el => { el.innerText = pyT(el.dataset.i18n); });

            const jaBtn = this.$('btn-lang-ja');
            const zhBtn = this.$('btn-lang-zh');
            const pyBtn = this.$('btn-lang-py');
            if (jaBtn) jaBtn.classList.toggle('active', mode === 'JA');
            if (zhBtn) zhBtn.classList.toggle('active', mode === 'ZH');
            if (pyBtn) pyBtn.classList.toggle('active', mode === 'PY');
        }

        const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
        const curState = ctrl?.state || (typeof gameState !== 'undefined' ? gameState : null);
        if (curState) {
            const autoBtn = this.$('btn-auto');
            if (autoBtn) {
                autoBtn.innerText = curState.autoPlay ? pyT('托管: 开') : pyT('托管: 关');
                autoBtn.classList.toggle('active', Boolean(curState.autoPlay));
            }
            const autoQueBtn = this.$('btn-auto-que');
            if (autoQueBtn) {
                autoQueBtn.innerText = curState.autoQue ? pyT('自动打缺: 开') : pyT('自动打缺: 关');
                autoQueBtn.classList.toggle('active', Boolean(curState.autoQue));
            }
        }
    }

    static render(state, mySeat = 0) {
        const wallEl = this.$('wall-num');
        if (wallEl) wallEl.innerText = state.wallCount ?? state.wall?.length ?? 112;
        if (state.logs) this.renderLogs(state.logs);

        const isQuePhase = [CONFIG.PHASES.PLAYING, CONFIG.PHASES.END].includes(state.phase);
        const oppIndices = [1, 2, 3].map(o => (mySeat + o) % CONFIG.TOTAL_PLAYERS);

        const tbody = this.$('opponents-tbody');
        if (tbody) {
            tbody.innerHTML = oppIndices.map(idx => state.players[idx]).filter(Boolean).map(p => {
                const isTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === p.id && !p.isEliminated);
                const rowCls = [p.isEliminated ? 'player-eliminated' : '', isTurn ? 'turn-active' : ''].filter(Boolean).join(' ');
                const elimTag = p.isEliminated ? `<span class="tag-eliminated">${pyT('脱落')}</span> ` : '';
                const queTag = (isQuePhase && p.que) ? `<span class="tag-que">${this.getTileHtml({ suit: p.que, num: 1 }, 'tile-small')}</span> ` : '';
                const huTag = p.isHu ? `<span class="tag-hu">${pyT('已胡')}${p.huRecords.length}</span>` : '';

                return `<tr class="${rowCls}">
                    <td>${pyT(p.name)}${isTurn ? ` [${pyT('手番')}]` : ''}</td>
                    <td class="player-score">${p.score}</td>
                    <td>${elimTag}${queTag}${huTag}</td>
                    <td>${this.getMeldsHtml(p.melds, 'small')}</td>
                </tr>`;
            }).join('');
        }

        const riverEl = this.$('river-container');
        if (riverEl) {
            riverEl.innerHTML = [...oppIndices, mySeat].map(idx => state.players[idx]).filter(Boolean).map(p => `
                <div class="river-row">
                    <span class="river-label">${pyT(p.name)}:</span>
                    <span class="river-tiles">${this.getDiscardsHtml(p.discards, state.lastDiscard)}</span>
                </div>
            `).join('');
        }

        const myPlayer = state.players[mySeat];
        if (!myPlayer) return;

        if (typeof document !== 'undefined') {
            const isMyTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === mySeat && !myPlayer.isEliminated);
            document.querySelector('.my-section')?.classList.toggle('turn-active', isMyTurn);
        }

        const setTxt = (id, txt) => { const el = this.$(id); if (el) el.innerText = txt; };
        setTxt('hand-score-0', myPlayer.score);
        const queEl = this.$('hand-que-0');
        if (queEl) {
            queEl.innerHTML = (isQuePhase && myPlayer.que) ? this.getTileHtml({ suit: myPlayer.que, num: 1 }, 'tile-small') : '';
            queEl.title = (isQuePhase && myPlayer.que) ? pyT(`缺${CONFIG.SUITS[myPlayer.que]}`) : '';
        }

        const huTagEl = this.$('hu-tag-0');
        if (huTagEl) {
            huTagEl.innerHTML = myPlayer.isEliminated
                ? `<span class="tag-eliminated">${pyT('脱落')}</span>`
                : (myPlayer.isHu ? `${pyT('已胡')}${myPlayer.huRecords.length}` : '');
        }

        const autoBtn = this.$('btn-auto');
        if (autoBtn) {
            autoBtn.innerText = state.autoPlay ? pyT('托管: 开') : pyT('托管: 关');
            autoBtn.classList.toggle('active', Boolean(state.autoPlay));
        }
        const autoQueBtn = this.$('btn-auto-que');
        if (autoQueBtn) {
            autoQueBtn.innerText = state.autoQue ? pyT('自动打缺: 开') : pyT('自动打缺: 关');
            autoQueBtn.classList.toggle('active', Boolean(state.autoQue));
        }

        this.renderHand(myPlayer, state, mySeat);

        if (isQuePhase && !myPlayer.isEliminated) this.updateTingPanel(myPlayer);
        else { const t = this.$('ting-info'); if (t) t.style.display = 'none'; }

        const autoMsgEl = this.$('auto-hu-msg');
        if (autoMsgEl) {
            const hasQue = Boolean(myPlayer.que && myPlayer.hand.some(t => t.suit === myPlayer.que));
            const showMsg = (myPlayer.isHu || state.autoPlay || (state.autoQue && hasQue) || myPlayer.isEliminated);
            autoMsgEl.style.display = showMsg ? 'inline-block' : 'none';
            if (showMsg) {
                if (myPlayer.isEliminated) autoMsgEl.innerText = pyT('脱落');
                else if (myPlayer.isHu) autoMsgEl.innerText = pyT('已胡牌（自动摸打中）');
                else if (state.autoPlay) autoMsgEl.innerText = pyT('托管中');
                else if (state.autoQue && hasQue) autoMsgEl.innerText = pyT('自动打缺中');
            }
        }

        if (state.phase === CONFIG.PHASES.SWAP3) {
            const count = (state.selectedSwapIndices || []).length;
            if (!myPlayer?.swapTiles?.length) {
                this.showInstruction('换三张', '选3张牌', `<button id="btn-confirm-swap" ${count === 3 ? '' : 'disabled'} onclick="gameController.confirmUserSwap()">${pyT('确定')} (${count}/3)</button>`);
            } else {
                this.hideInstruction();
            }
        } else if (state.phase === CONFIG.PHASES.DINGQUE) {
            if (!myPlayer?.que) this.showInstruction('定缺', '请选择定缺门类', this.getDingQueOptionsHtml());
            else this.hideInstruction();
        } else {
            this.hideInstruction();
        }
    }

    static replaceTilesWithHtml(text) {
        if (!text) return '';
        const suitMap = { '万': 'wan', '筒': 'tong', '条': 'tiao' };
        return text
            .replace(/([1-9])([万筒条])/g, (_, num, suit) => {
                const prefix = suitMap[suit];
                const svg = `assets/tiles/${prefix}_${num}.svg`;
                return `<img class="tile-log" src="${svg}" alt="${num}${suit}" draggable="false" />`;
            })
            .replace(/红中/g, () => `<img class="tile-log" src="assets/tiles/zhong.svg" alt="红中" draggable="false" />`);
    }

    static formatLog(text) {
        const translated = pyT(text);
        return this.replaceTilesWithHtml(translated);
    }

    static renderLogs(logs) {
        const c = this.$('cmd-log');
        if (!c || !logs) return;
        c.innerHTML = logs.map(l => `<div>> ${this.formatLog(l)}</div>`).join('');
        c.scrollTop = c.scrollHeight;
    }

    static log(text) {
        const c = this.$('cmd-log');
        if (!c) return;
        const div = document.createElement('div');
        div.innerHTML = `> ${this.formatLog(text)}`;
        c.appendChild(div);
        c.scrollTop = c.scrollHeight;
    }

    static clearLog(text = '系统就绪。') {
        const c = this.$('cmd-log');
        if (c) c.innerHTML = `<div>> ${this.formatLog(text)}</div>`;
    }

    static renderHand(player, state, mySeat = 0) {
        const handEl = this.$('hand-0');
        const meldsEl = this.$('melds-0');
        if (!handEl || !meldsEl) return;

        meldsEl.innerHTML = this.getMeldsHtml(player.melds, 'normal');

        const isDrawn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === mySeat && player.hand.length % 3 === 2);
        const isQue = [CONFIG.PHASES.PLAYING, CONFIG.PHASES.END].includes(state.phase);
        const hasQue = isQue && player.hand.some(t => t.suit === player.que);

        handEl.innerHTML = player.hand.map((tile, idx) => {
            const isDrawnTile = (isDrawn && idx === player.hand.length - 1);
            const isSwap = (state.phase === CONFIG.PHASES.SWAP3);
            const isSelected = isSwap && (state.selectedSwapIndices || []).includes(idx);
            const isQueTile = isQue && (tile.suit === player.que);
            const isPlayable = isSwap || (isDrawn && (player.isHu ? (idx === player.hand.length - 1) : (!hasQue || isQueTile)));

            const cls = ['tile-img', isSelected ? 'selected' : '', isQueTile ? 'is-que' : '', isPlayable ? 'tile-playable' : 'tile-disabled'].filter(Boolean).join(' ');
            const divider = isDrawnTile ? '<span class="tsumo-divider"></span>' : '';
            const svg = MahjongEngine.tileToSvgPath(tile);
            const alt = MahjongEngine.tileToString(tile);

            return `${divider}<img class="${cls}" src="${svg}" alt="${alt}" draggable="false" onclick="window.gameController?.handleTileClick(${idx})" />`;
        }).join('');
    }

    static updateTingPanel(player) {
        const infoEl = this.$('ting-info');
        const listEl = this.$('ting-list');
        if (!infoEl || !listEl) return;
        const ting = MahjongEngine.getTingTiles(player);
        infoEl.style.display = ting.length ? 'inline-flex' : 'none';
        listEl.innerHTML = ting.map(t => this.getTileHtml(t, 'tile-ting')).join('');
    }

    static showInstruction(title, desc, optionsHtml) {
        const box = this.$('phase-instruction');
        if (!box) return;
        const tEl = this.$('instruction-title'), dEl = this.$('instruction-desc'), oEl = this.$('instruction-options');
        if (tEl) tEl.innerText = pyT(title);
        if (dEl) dEl.innerText = pyT(desc);
        if (oEl) oEl.innerHTML = optionsHtml;
        box.style.display = 'flex';
    }

    static hideInstruction() {
        const box = this.$('phase-instruction');
        if (box) box.style.display = 'none';
    }

    static showActionBox(showHu, showGang, showPung, onHu, onGang, onPung, onPass) {
        const buttons = [
            { id: 'btn-hu', show: showHu, fn: onHu, label: `${pyT('胡')} (H)` },
            { id: 'btn-gang', show: showGang, fn: onGang, label: `${pyT('杠')} (G)` },
            { id: 'btn-pung', show: showPung, fn: onPung, label: `${pyT('碰')} (P)` },
            { id: 'btn-pass', show: (showHu || showGang || showPung), fn: onPass, label: `${pyT('过')} (X)` }
        ];
        buttons.forEach(({ id, show, fn, label }) => {
            const btn = this.$(id);
            if (btn) {
                btn.style.display = show ? 'inline-block' : 'none';
                btn.onclick = fn;
                btn.innerText = label;
            }
        });
        const box = this.$('cmd-box');
        if (box) box.style.display = (showHu || showGang || showPung) ? 'inline-flex' : 'none';
    }

    static hideActionBox() {
        const box = this.$('cmd-box');
        if (box) box.style.display = 'none';
    }

    static showResultModal(players, penaltyLogs = []) {
        const modal = this.$('result-modal');
        if (!modal) return;

        const titleEl = this.$('lbl-result-title');
        if (titleEl) titleEl.innerText = pyT('对局结算');

        const resetBtn = this.$('btn-reset-room');
        if (resetBtn) resetBtn.innerText = pyT('新建房间 (重置)');

        const sorted = [...players].sort((a, b) => b.score - a.score);
        const ranksEl = this.$('result-ranks');
        if (ranksEl) {
            ranksEl.innerHTML = sorted.map((p, idx) => {
                const huItems = (p.huRecords || []).map(r => {
                    const yaku = (r.fanName || '').split('自摸').join('').trim() || '平胡';
                    return `<div class="result-hu-item">• ${r.score} ${pyT('分')} (${r.fan} ${pyT('番')}: ${r.isZiMo ? pyT('自摸') + ' ' : ''}${pyT(yaku)})</div>`;
                }).join('');

                return `<div class="result-rank-row">
                    <div class="result-rank-header">
                        <span>${idx + 1} ${pyT('位')} ${pyT(p.name)}</span>
                        <span><b>${p.score} ${pyT('分')}</b> (${pyT('已胡')} ${p.huRecords?.length || 0} ${pyT('次')})</span>
                    </div>
                    ${huItems ? `<div class="result-hu-list">${huItems}</div>` : `<div class="result-no-hu">${pyT('本局未胡牌')}</div>`}
                </div>`;
            }).join('');
        }

        const penaltiesEl = this.$('result-penalties');
        if (penaltiesEl) {
            if (penaltyLogs.length > 0) {
                penaltiesEl.innerHTML = `<b class="penalties-title">${pyT('清算明细')}:</b>` + penaltyLogs.map(l => `<div class="penalty-item">${pyT(l)}</div>`).join('');
                penaltiesEl.style.display = 'block';
            } else {
                penaltiesEl.innerHTML = '';
                penaltiesEl.style.display = 'none';
            }
        }

        const restartBtn = modal.querySelector('.btn-restart');
        const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
        const isHost = Boolean(ctrl?.p2p?.isHost);

        if (restartBtn) {
            restartBtn.innerText = pyT(ctrl?.isOnline ? (isHost ? '再来一局' : '等待房主再来一局') : '再来一局');
            restartBtn.disabled = Boolean(ctrl?.isOnline && !isHost);
            restartBtn.onclick = () => (ctrl?.isOnline ? ctrl.handleStartGame() : ctrl?.initGame(false));
        }

        modal.style.display = 'flex';
    }

    static hideResultModal() {
        const modal = this.$('result-modal');
        if (modal) modal.style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.TRANSLATIONS = TRANSLATIONS;
    window.I18nHelper = I18nHelper;
    window.pyT = pyT;
    window.UIController = UIController;
}
