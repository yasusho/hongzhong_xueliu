/**
 * 紅中血流成河麻雀 - メインエントリーポイント (初期化・イベントバインド)
 */

// インスタンス生成
const gameController = new GameController(gameState, soundManager, UIController, MahjongEngine, MahjongAI, p2pManager, GameFlow, DeterministicPRNG);

// ブラウザ環境イベントバインド
function setupBrowserEvents(ctrl, state) {
    if (!ctrl || !state) return;
    const pyT = text => (typeof I18nHelper !== 'undefined' ? I18nHelper.t(text) : text);

    // 言語・表記設定の復元 (デフォルト: 'JA' 日本語, ピンインOFF)
    let savedLang = 'JA';
    let savedPinyin = false;
    try {
        savedLang = localStorage.getItem('hz_lang') || localStorage.getItem('hz_lang_mode') || 'JA';
        savedPinyin = localStorage.getItem('hz_pinyin') === 'true';
    } catch (e) {}
    if (typeof I18nHelper !== 'undefined') {
        I18nHelper.lang = (savedLang === 'ZH') ? 'ZH' : 'JA';
        I18nHelper.isPinyin = savedPinyin;
    }
    UIController.applyPinyinMode();

    // 托管ボタン
    const btnAuto = UIController.$('btn-auto');
    if (btnAuto) {
        btnAuto.onclick = () => {
            state.autoPlay = !state.autoPlay;
            btnAuto.innerText = state.autoPlay ? pyT('托管: 开') : pyT('托管: 关');
            btnAuto.classList.toggle('active', state.autoPlay);
            ctrl.ui.render(state, ctrl.mySeat);
            if (state.autoPlay && state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat) {
                ctrl.autoPlayPlayerTurn(ctrl.mySeat);
            }
        };
    }

    // 自动打缺ボタン
    const btnAutoQue = UIController.$('btn-auto-que');
    if (btnAutoQue) {
        let savedAutoQue = false;
        try { savedAutoQue = localStorage.getItem('hz_auto_que') === 'true'; } catch (e) {}
        state.autoQue = savedAutoQue;
        btnAutoQue.classList.toggle('active', savedAutoQue);
        btnAutoQue.innerText = state.autoQue ? pyT('自动打缺: 开') : pyT('自动打缺: 关');

        btnAutoQue.onclick = () => {
            state.autoQue = !state.autoQue;
            try { localStorage.setItem('hz_auto_que', state.autoQue); } catch (e) {}
            btnAutoQue.innerText = state.autoQue ? pyT('自动打缺: 开') : pyT('自动打缺: 关');
            btnAutoQue.classList.toggle('active', state.autoQue);
            ctrl.ui.render(state, ctrl.mySeat);
            if (state.autoQue && state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat) {
                const myP = state.players[ctrl.mySeat];
                if (myP?.que && myP.hand.some(t => t.suit === myP.que)) {
                    ctrl.autoPlayQueDiscard(ctrl.mySeat);
                }
            }
        };
    }

    // キーボードショートカット
    window.addEventListener('keydown', e => {
        const p = state.players[ctrl.mySeat];
        if (!p) return;

        if (state.phase === CONFIG.PHASES.SWAP3) {
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
        if (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === ctrl.mySeat && p.hand.length % 3 === 2) {
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
        const code = saved?.roomCode || UIController.$('room-code-display')?.innerText?.trim();
        ctrl.handleCreateRoom(code);
        ctrl.initGame(false);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        setupBrowserEvents(gameController, gameState);
    });
}
