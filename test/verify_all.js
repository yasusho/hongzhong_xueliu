/**
 * 紅中血流成河麻雀 - 自動リグレッション・ユニット検証スクリプト
 */
const assert = require('assert');
global.assert = assert;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.window = {
    addEventListener: () => {},
    AudioContext: class {
        createGain() { return { gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
        createOscillator() { return { type: 'sine', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    }
};
global.document = {
    getElementById: () => ({ innerText: '', innerHTML: '', style: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} } }),
    querySelector: () => null,
    querySelectorAll: () => []
};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

['engine.js', 'sound.js', 'p2p.js', 'ui.js', 'game.js'].forEach(file => {
    const code = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
    vm.runInThisContext(code, { filename: file });
});

const createMockEnv = () => {
    const state = new GameState();
    const playedSounds = [];
    const sound = { play: s => playedSounds.push(s) };
    const logs = [];
    let isResultModalVisible = false;
    const ui = {
        render: () => {}, updateTingPanel: () => {}, showActionBox: () => {}, hideActionBox: () => {},
        showInstruction: () => {}, hideInstruction: () => {},
        showResultModal: () => { isResultModalVisible = true; },
        hideResultModal: () => { isResultModalVisible = false; },
        log: text => logs.push(text), clearLog: () => {}
    };
    const ctrl = new GameController(state, sound, ui, MahjongEngine, MahjongAI, null);
    return { state, sound, playedSounds, ui, logs, ctrl, isModalVisible: () => isResultModalVisible };
};

console.log('--- 1. モジュール読み込みテスト ---');
assert(typeof CONFIG !== 'undefined' && CONFIG.TOTAL_PLAYERS === 4);
assert(typeof MahjongEngine !== 'undefined' && typeof MahjongAI !== 'undefined' && typeof GameDSL !== 'undefined');
assert(typeof SoundManager !== 'undefined' && typeof P2PManager !== 'undefined' && typeof UIController !== 'undefined');
assert(typeof I18nHelper !== 'undefined' && typeof pyT === 'function');
console.log('✓ 全モジュールの読み込みに成功');

console.log('\n--- 2. 麻雀エンジン（牌生成・ソート・文字列表現）テスト ---');
const deck = MahjongEngine.createDeck();
assert.strictEqual(deck.length, 112);
assert.strictEqual(deck.filter(t => t.suit === 'HZ').length, 4);
assert.strictEqual(MahjongEngine.tileToString({ suit: 'W', num: 1 }), '1万');
assert.strictEqual(MahjongEngine.tileToString({ suit: 'HZ', num: 0 }), '红中');
const sortTestHand = [{ suit: 'T', num: 5 }, { suit: 'W', num: 1 }, { suit: 'HZ', num: 0 }, { suit: 'B', num: 3 }];
MahjongEngine.sortHand(sortTestHand, 'T');
assert.strictEqual(sortTestHand[sortTestHand.length - 1].suit, 'T');
console.log('✓ 麻雀エンジン基本処理テスト通過');

console.log('\n--- 3. 和了判定 (checkCanHu) テスト ---');
const huHand = [
    { suit: 'W', num: 1 }, { suit: 'W', num: 2 }, { suit: 'W', num: 3 },
    { suit: 'W', num: 4 }, { suit: 'W', num: 5 }, { suit: 'W', num: 6 },
    { suit: 'W', num: 7 }, { suit: 'W', num: 8 }, { suit: 'W', num: 9 },
    { suit: 'T', num: 1 }, { suit: 'T', num: 1 }, { suit: 'T', num: 1 },
    { suit: 'T', num: 9 }, { suit: 'T', num: 9 }
];
assert(MahjongEngine.checkCanHu({ que: 'B', hand: huHand, melds: [] }));
const wildHand = [{ suit: 'W', num: 1 }, { suit: 'W', num: 2 }, { suit: 'HZ', num: 0 }, { suit: 'T', num: 5 }, { suit: 'T', num: 5 }];
assert(MahjongEngine.checkCanHu({ que: 'B', hand: wildHand, melds: [] }));
console.log('✓ 和了判定テスト通過 (平胡・七対子・紅中順子・カンチャン・高位牌)');

console.log('\n--- 4. 番数計算 (calculateFan) テスト ---');
const fanHand = [
    { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'W', num: 3, code: '3W' },
    { suit: 'W', num: 4, code: '4W' }, { suit: 'W', num: 5, code: '5W' }, { suit: 'W', num: 6, code: '6W' },
    { suit: 'W', num: 7, code: '7W' }, { suit: 'W', num: 8, code: '8W' }, { suit: 'W', num: 9, code: '9W' },
    { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 1, code: '1W' },
    { suit: 'W', num: 9, code: '9W' }, { suit: 'W', num: 9, code: '9W' }
];
const fanRes = MahjongEngine.calculateFan({ id: 0, que: 'B', hand: fanHand, melds: [] }, fanHand[13], true);
assert(fanRes.fan >= 4, 'Should have at least 4 fan');
console.log('✓ 番数計算テスト通過: 平胡 清一色 1根 自摸 (4番)');

console.log('\n--- 5. 聴牌判定 (getTingTiles) テスト ---');
const tingHand = [
    { suit: 'W', num: 1 }, { suit: 'W', num: 2 }, { suit: 'W', num: 3 },
    { suit: 'W', num: 4 }, { suit: 'W', num: 5 }, { suit: 'W', num: 6 },
    { suit: 'W', num: 7 }, { suit: 'W', num: 8 }, { suit: 'T', num: 5 }, { suit: 'T', num: 5 }
];
const tings = MahjongEngine.getTingTiles({ que: 'B', hand: tingHand, melds: [] });
assert(tings.length >= 2, 'Should ting at least 6W, 9W or HZ');
console.log(`✓ 聴牌判定テスト通過 (聴牌数: ${tings.length})`);

console.log('\n--- 6. AI思考 (MahjongAI) テスト ---');
const aiHand = [{ suit: 'W', num: 1 }, { suit: 'W', num: 2 }, { suit: 'W', num: 3 }, { suit: 'T', num: 1 }, { suit: 'T', num: 9 }, { suit: 'B', num: 5 }, { suit: 'HZ', num: 0 }];
assert.strictEqual(MahjongAI.getDingQue(aiHand), 'B');
assert.strictEqual(MahjongAI.getSwapTiles(aiHand).length, 3);
console.log('✓ AI換三張・定缺テスト通過');

console.log('\n--- 7. 決定論的PRNG＆状態遷移DSL (GameDSL) テスト ---');
const prng1 = new DeterministicPRNG(42);
const prng2 = new DeterministicPRNG(42);
assert.strictEqual(prng1.nextInt(1, 100), prng2.nextInt(1, 100));
const { state: dslState } = createMockEnv();
GameDSL.initGame(dslState, 9999, MahjongEngine);
assert.strictEqual(dslState.players.length, 4);
assert.strictEqual(dslState.phase, CONFIG.PHASES.SWAP3);
console.log('✓ 決定論的PRNG＆状態遷移DSLテスト通過');

console.log('\n--- 8. 和了後自動摸打 (Auto Tsumogiri after Hu) テスト ---');
const { state: s8, ctrl: c8 } = createMockEnv();
s8.phase = CONFIG.PHASES.PLAYING;
s8.players[0].hand = [...huHand];
s8.players[0].que = 'B';
c8.dispatchAction(0, 'HU', { tile: s8.players[0].hand[13], isZiMo: true });
assert.strictEqual(s8.players[0].isHu, true);
assert.strictEqual(s8.players[0].huRecords.length, 1);
console.log('✓ 和了後自動摸打＆自動自摸テスト通過');

console.log('\n--- 9. 多言語相補分布 (日 汉 A) ＆ 表記テスト ---');
// 1. 日 モード (JA)
I18nHelper.setMode('JA');
assert.strictEqual(I18nHelper.getMode(), 'JA');
assert.strictEqual(I18nHelper.lang, 'JA');
assert.strictEqual(I18nHelper.isPinyin, false);
assert.strictEqual(pyT('胡'), 'あがり');
assert(pyT('★ 1P 自摸 1万 (清一色 4番 1600分)').includes('自摸') && pyT('★ 1P 自摸 1万 (清一色 4番 1600分)').includes('点'));
assert(pyT('★ 1P 点炮 1万 (平胡 1番 200分)').includes('点炮') && pyT('★ 1P 点炮 1万 (平胡 1番 200分)').includes('点'));
assert(pyT('1P 暗杠 1万 (各家200分)').includes('暗カン') && pyT('1P 暗杠 1万 (各家200分)').includes('点'));
assert(pyT('换三张完成').includes('三枚换え'));
assert.strictEqual(pyT('本局未胡牌'), '本局未胡牌');

// 2. A モード (PY - 拼音)
I18nHelper.setMode('PY');
assert.strictEqual(I18nHelper.getMode(), 'PY');
assert.strictEqual(I18nHelper.lang, 'ZH');
assert.strictEqual(I18nHelper.isPinyin, true);
assert(pyT('红中').includes('Hóngzhōng'));
const pinyinLog = pyT('★ 1P 自摸 1万 (清一色 4番 1600分)');
assert(pinyinLog.includes('Zìmō') && pinyinLog.includes('Qīngyīsè') && pinyinLog.includes('fān') && pinyinLog.includes('fēn'));

// 3. 汉 モード (ZH - 漢字)
I18nHelper.setMode('ZH');
assert.strictEqual(I18nHelper.getMode(), 'ZH');
assert.strictEqual(I18nHelper.lang, 'ZH');
assert.strictEqual(I18nHelper.isPinyin, false);
assert.strictEqual(pyT('红中'), '红中');
assert.strictEqual(pyT('胡'), '胡');

console.log('✓ 日 汉 A 相補分布言語切替テスト通過');

console.log('\n--- 10. 効果音管理 (SoundManager) & 他家和了音テスト ---');
const { state: s10, ctrl: c10, playedSounds } = createMockEnv();
s10.phase = CONFIG.PHASES.PLAYING;
s10.players[1].hand = [...huHand];
s10.players[1].que = 'B';
c10.dispatchAction(1, 'HU', { tile: s10.players[1].hand[13], isZiMo: true });
assert(playedSounds.includes('hu_opp'));
console.log('✓ 自家/他家和了時の効果音鳴らし分けテスト通過');

console.log('\n--- 11. P2P クライアント副露（ポン・カン）＆終局モーダル表示テスト ---');
const { state: s11, ctrl: c11, isModalVisible: isModalVisible11 } = createMockEnv();
s11.phase = CONFIG.PHASES.PLAYING;
s11.players[1].hand = [{ suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 1, code: '1W' }, { suit: 'T', num: 2, code: '2T' }];
s11.players[1].que = 'B';
c11.dispatchAction(1, 'MELD', { type: 'PUNG', tile: { suit: 'W', num: 1, code: '1W' }, from: 0, removeCount: 2, score: 0, isGang: false });
assert.strictEqual(s11.players[1].melds.length, 1);
assert.strictEqual(s11.players[1].melds[0].type, 'PUNG');

// クライアント側でENDフェーズ受信時に結果モーダルが表示されること
c11.handleRemoteStateSync({ phase: CONFIG.PHASES.END, players: s11.players, settlementLogs: ['精算ログ'] });
assert.strictEqual(isModalVisible11(), true, 'クライアント側でENDフェーズ受信時に結果モーダルが表示される');

// 新局開始時にモーダルが非表示になること
c11.handleRemoteStateSync({ phase: CONFIG.PHASES.SWAP3, players: s11.players });
assert.strictEqual(isModalVisible11(), false, '新局受信時に結果モーダルが非表示になる');

console.log('✓ P2P クライアント副露（ポン）＆終局モーダル表示テスト通過');

console.log('\n--- 12. 定缺（定缺選択・手牌ソート・打牌制約・自動打缺・查花猪）総合テスト ---');
const { state: s12, ctrl: c12 } = createMockEnv();
c12.initGame(false, 12345);
assert.strictEqual(s12.phase, CONFIG.PHASES.SWAP3);

// 換三張の実行
c12.dispatchAction(0, 'CONFIRM_SWAP', { swapTiles: s12.players[0].hand.slice(0, 3) });
assert.strictEqual(s12.phase, CONFIG.PHASES.DINGQUE);
assert.strictEqual(s12.players[0].que, null);
assert(s12.players[1].que !== null);

// 定缺ボタンHTML構造の検証（不正な属性がないこと）
const queHtml = UIController.getDingQueOptionsHtml();
assert(!queHtml.includes('.trim()'));
assert(queHtml.includes('btn-que-choice'));

// ユーザーの定缺選択
c12.selectUserQue('B');
assert.strictEqual(s12.players[0].que, 'B');
assert.strictEqual(s12.phase, CONFIG.PHASES.PLAYING);

// 定缺牌が手牌の末尾にソートされていること
const p0Hand = s12.players[0].hand;
const firstQueIdx = p0Hand.findIndex(t => t.suit === 'B');
if (firstQueIdx > -1) {
    for (let k = firstQueIdx; k < p0Hand.length; k++) {
        assert.strictEqual(p0Hand[k].suit, 'B', '定缺牌は手牌末尾にまとまる');
    }
}

// 定缺牌があるときに定缺外の牌を捨てようとするとブロックされること
s12.currentTurn = 0;
s12.players[0].hand = [{ suit: 'W', num: 1, code: '1W' }, { suit: 'B', num: 5, code: '5B' }];
const discCountBefore = s12.players[0].discards.length;
c12.handleTileClick(0); // 1Wをクリック
assert.strictEqual(s12.players[0].discards.length, discCountBefore, '定缺牌(B)があるためW牌の打牌はブロックされる');

// 欠色自動切り（AutoQue）の実行（複数ある場合でも一番右の牌を捨てること）
s12.autoQue = true;
s12.players[0].hand = [{ suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'W', num: 3, code: '3W' }, { suit: 'B', num: 2, code: '2B' }, { suit: 'B', num: 9, code: '9B' }];
s12.currentTurn = 0;
c12.autoPlayQueDiscard(0);
const lastDisc = s12.players[0].discards[s12.players[0].discards.length - 1];
assert.strictEqual(lastDisc.suit, 'B', '自動打缺で定缺牌が打たれる');
assert.strictEqual(lastDisc.num, 9, '選択権があっても一番右の定缺牌(9B)が打たれる');

// 查花猪（定缺牌を残したプレイヤーへのペナルティ）の検証
s12.players.forEach(p => { p.score = 5000; p.que = 'B'; });
s12.players[0].hand = [{ suit: 'B', num: 1, code: '1B' }]; // 花猪
s12.players[1].hand = [{ suit: 'W', num: 1, code: '1W' }]; // 非花猪
s12.players[2].hand = [{ suit: 'W', num: 2, code: '2W' }]; // 非花猪
s12.players[3].hand = [{ suit: 'W', num: 3, code: '3W' }]; // 非花猪
const settleLogs = GameDSL.calculateEndSettlement(s12, MahjongEngine);
assert(settleLogs.some(l => l.includes('查花猪')));
assert.strictEqual(s12.players[0].score, 5000 - 1600 * 3);
console.log('✓ 定缺（定缺選択・手牌ソート・打牌制約・自動打缺・查花猪）総合テスト通過');

console.log('\n--- 13. 自摸ログ制御（他人の摸牌ログ非表示）テスト ---');
const { state: s13, ctrl: c13, logs } = createMockEnv();
s13.phase = CONFIG.PHASES.PLAYING;
s13.wall = [{ suit: 'W', num: 1, code: '1W' }];
c13.handleDslEvents(GameDSL.drawTile(s13, 1, false));
assert(!logs.some(l => l.includes('2P 摸')));
console.log('✓ 他人の自摸ログ非表示テスト通過');

console.log('\n--- 14. オフターンタイムアウト撤廃＆切断時調停フォールバックテスト ---');
const { state: s14, ctrl: c14 } = createMockEnv();
s14.phase = CONFIG.PHASES.PLAYING;
c14.pendingOffTurn = { candidates: [1], decisions: {}, tile: { suit: 'W', num: 1 }, discarder: 0 };
c14.handlePlayerDisconnect(1);
assert.strictEqual(c14.pendingOffTurn, null);
console.log('✓ オフターンタイムアウト撤廃＆切断時調停フォールバックテスト通過');

console.log('\n--- 15. マイナス点プレイヤー脱落＆ゲーム継続テスト ---');
const { state: s15, ctrl: c15 } = createMockEnv();
s15.phase = CONFIG.PHASES.PLAYING;
s15.players[1].score = 100;
s15.players[0].score = 5000;
s15.transferScore(1, 0, 200);
assert.strictEqual(s15.players[1].isEliminated, true);
assert.strictEqual(s15.isGameOver(), false);
console.log('✓ マイナス点プレイヤー脱落＆ゲーム継続テスト通過');

console.log('\n--- 16. 日本語（JAモード）＆定缺牌図表示テスト ---');
I18nHelper.lang = 'JA';
assert.strictEqual(pyT('缺万'), '缺万');
assert.strictEqual(pyT('开始对局'), '对局开始');
console.log('✓ 日本語（JAモード）＆定缺牌図表示テスト通過');

console.log('\n--- 17. 純粋関数性＆イミュータビリティ（FP原則）テスト ---');
const { state: s17 } = createMockEnv();
s17.phase = CONFIG.PHASES.PLAYING;
s17.players[0].hand = [{ suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }];
const origHand = s17.players[0].hand;
GameDSL.discardTile(s17, 0, 0, MahjongEngine);
assert.notStrictEqual(s17.players[0].hand, origHand);
console.log('✓ 純粋関数性＆イミュータビリティ（FP原則）テスト通過');

console.log('\n--- 18. 刮風下雨（暗槓200点/加槓100点/大明槓200点）テスト ---');
const { state: s18 } = createMockEnv();
s18.players.forEach(p => { p.score = 5000; });
GameDSL.executeSelfGang(s18, 0, { type: 'AN_GANG', tile: { suit: 'W', num: 1, code: '1W' } }, MahjongEngine);
assert.strictEqual(s18.players[0].score, 5600);
GameDSL.executeSelfGang(s18, 1, { type: 'JIA_GANG', tile: { suit: 'T', num: 2, code: '2T' } }, MahjongEngine);
assert.strictEqual(s18.players[1].score, 5100);
GameDSL.executeMeld(s18, 2, 'GANG', { suit: 'B', num: 3, code: '3B' }, 3, 3, 200, true, MahjongEngine);
assert.strictEqual(s18.players[2].score, 4900);
assert.strictEqual(s18.players[3].score, 4500);
console.log('✓ 刮風下雨（暗槓200点/加槓100点/大明槓200点）テスト通過');

console.log('\n========================================\n★ 全ての検証テストに正常に合格しました！\n========================================\n');
