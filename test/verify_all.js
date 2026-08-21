/**
 * 紅中血流成河麻雀 - 自動リグレッション・ユニット検証スクリプト
 */
const assert = require('assert');
global.assert = assert;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ブラウザ環境モック
global.window = {
    addEventListener: () => {},
    AudioContext: class {
        createGain() { return { gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
        createOscillator() { return { type: 'sine', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    }
};
global.document = {
    getElementById: id => ({ innerText: '', innerHTML: '', style: {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} } }),
    querySelector: () => null
};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// ブラウザの読み込み順序に従ってスクリプトをグローバルスコープにロード
['dsl.js', 'i18n.js', 'engine.js', 'p2p.js', 'sound.js', 'ui.js', 'game.js', 'main.js'].forEach(file => {
    const code = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
    vm.runInThisContext(code, { filename: file });
});

console.log('--- 1. モジュール読み込みテスト ---');
assert(typeof CONFIG !== 'undefined' && CONFIG.TOTAL_PLAYERS === 4, 'CONFIG loaded correctly');
assert(typeof MahjongEngine !== 'undefined', 'MahjongEngine loaded');
assert(typeof MahjongAI !== 'undefined', 'MahjongAI loaded');
assert(typeof DeterministicVM !== 'undefined', 'DeterministicVM loaded');
assert(typeof SoundManager !== 'undefined', 'SoundManager loaded');
assert(typeof P2PManager !== 'undefined', 'P2PManager loaded');
assert(typeof GameFlow !== 'undefined', 'GameFlow loaded');
assert(typeof PinyinHelper !== 'undefined' && typeof PINYIN_DICT !== 'undefined', 'PinyinHelper and PINYIN_DICT loaded');
console.log('✓ 全モジュールの読み込みに成功');

console.log('\n--- 2. 麻雀エンジン（牌生成・ソート・文字列表現）テスト ---');
const deck = MahjongEngine.createDeck();
assert.strictEqual(deck.length, 112, 'Deck should contain 112 tiles (108 suit + 4 HZ)');
const hzCount = deck.filter(t => t.suit === 'HZ').length;
assert.strictEqual(hzCount, 4, 'Deck should contain 4 HongZhong tiles');

const shuffled = MahjongEngine.shuffle(deck);
assert.strictEqual(shuffled.length, 112, 'Shuffled deck should contain 112 tiles');

// 牌表現テスト (SVG / 文字列)
const tileW1 = { suit: 'W', num: 1, code: '1W' };
const tileHZ = { suit: 'HZ', num: 0, code: 'HZ' };
assert.strictEqual(MahjongEngine.tileToString(tileW1), '1万');
assert.strictEqual(MahjongEngine.tileToString(tileHZ), '红中');
assert.strictEqual(MahjongEngine.tileToSvgPath(tileW1), 'assets/tiles/wan_1.svg');
assert.strictEqual(MahjongEngine.tileToSvgPath(tileHZ), 'assets/tiles/zhong.svg');

// 手牌ソートテスト
const testHand = [
    { suit: 'T', num: 5 },
    { suit: 'W', num: 9 },
    { suit: 'W', num: 1 },
    { suit: 'HZ', num: 0 },
    { suit: 'B', num: 3 }
];
MahjongEngine.sortHand(testHand, 'T'); // 缺筒
assert.strictEqual(testHand[0].suit, 'W', 'W should come before B');
assert.strictEqual(testHand[testHand.length - 1].suit, 'T', 'Que suit (T) should be sorted to the very end');
console.log('✓ 麻雀エンジン基本処理テスト通過');

console.log('\n--- 3. 和了判定 (checkCanHu) テスト ---');
// 平胡テスト: 123万 456万 789万 111筒 99条
const pingHuPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'W', num: 3, code: '3W' },
        { suit: 'W', num: 4, code: '4W' }, { suit: 'W', num: 5, code: '5W' }, { suit: 'W', num: 6, code: '6W' },
        { suit: 'W', num: 7, code: '7W' }, { suit: 'W', num: 8, code: '8W' }, { suit: 'W', num: 9, code: '9W' },
        { suit: 'T', num: 1, code: '1T' }, { suit: 'T', num: 1, code: '1T' }, { suit: 'T', num: 1, code: '1T' },
        { suit: 'T', num: 9, code: '9T' }, { suit: 'T', num: 9, code: '9T' }
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(pingHuPlayer), 'PingHu hand should win');

// 紅中ワイルドカード置換テスト
const wildHuPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'HZ', num: 0, code: 'HZ' }, // 12[3]万
        { suit: 'T', num: 5, code: '5T' }, { suit: 'T', num: 5, code: '5T' } // 55筒 (頭)
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(wildHuPlayer), 'Hand with HongZhong wild card should win');

// 七対子テスト
const qiDuiPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 1 }, { suit: 'W', num: 1 },
        { suit: 'W', num: 3 }, { suit: 'W', num: 3 },
        { suit: 'W', num: 5 }, { suit: 'W', num: 5 },
        { suit: 'T', num: 2 }, { suit: 'T', num: 2 },
        { suit: 'T', num: 4 }, { suit: 'T', num: 4 },
        { suit: 'T', num: 6 }, { suit: 'T', num: 6 },
        { suit: 'HZ', num: 0 }, { suit: 'HZ', num: 0 }
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(qiDuiPlayer), 'QiDui hand should win');

// 高位牌順子テスト (8W 9W + 紅中 + 1T 1T)
const highShuntsuPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 8, code: '8W' }, { suit: 'W', num: 9, code: '9W' }, { suit: 'HZ', num: 0, code: 'HZ' },
        { suit: 'T', num: 1, code: '1T' }, { suit: 'T', num: 1, code: '1T' }
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(highShuntsuPlayer), '8W 9W + HZ + pair should win');

// カンチャン待ちテスト (7W 9W + 紅中 + 1T 1T)
const kanchanPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 7, code: '7W' }, { suit: 'W', num: 9, code: '9W' }, { suit: 'HZ', num: 0, code: 'HZ' },
        { suit: 'T', num: 1, code: '1T' }, { suit: 'T', num: 1, code: '1T' }
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(kanchanPlayer), '7W 9W + HZ + pair should win');

// 14枚複雑形テスト (123W 456W 89W(HZ) 999W 111T 99T)
const complex14Player = {
    que: 'B',
    hand: [
        { suit: 'W', num: 1 }, { suit: 'W', num: 2 }, { suit: 'W', num: 3 },
        { suit: 'W', num: 4 }, { suit: 'W', num: 5 }, { suit: 'W', num: 6 },
        { suit: 'W', num: 8 }, { suit: 'W', num: 9 }, { suit: 'HZ', num: 0 },
        { suit: 'T', num: 1 }, { suit: 'T', num: 1 }, { suit: 'T', num: 1 },
        { suit: 'T', num: 9 }, { suit: 'T', num: 9 }
    ],
    melds: []
};
assert(MahjongEngine.checkCanHu(complex14Player), 'Complex 14-tile hand with 8W 9W HZ should win');
console.log('✓ 和了判定テスト通過 (平胡・七対子・紅中順子・カンチャン・高位牌)');

console.log('\n--- 4. 番数計算 (calculateFan) テスト ---');
const qingYiSePlayer = {
    id: 0,
    que: 'T',
    hand: [
        { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'W', num: 3, code: '3W' },
        { suit: 'W', num: 4, code: '4W' }, { suit: 'W', num: 5, code: '5W' }, { suit: 'W', num: 6, code: '6W' },
        { suit: 'W', num: 7, code: '7W' }, { suit: 'W', num: 8, code: '8W' }, { suit: 'W', num: 9, code: '9W' },
        { suit: 'W', num: 9, code: '9W' }, { suit: 'W', num: 9, code: '9W' }, { suit: 'W', num: 9, code: '9W' },
        { suit: 'W', num: 5, code: '5W' }, { suit: 'W', num: 5, code: '5W' }
    ],
    melds: []
};
const fanInfo = MahjongEngine.calculateFan(qingYiSePlayer, { suit: 'W', num: 5, code: '5W' }, true);
assert(fanInfo.fan >= 3, `QingYiSe + ZiMo should be at least 3 fan, got ${fanInfo.fan}`);
assert(fanInfo.name.includes('清一色'), 'Fan name should include 清一色');
assert(fanInfo.name.includes('自摸'), 'Fan name should include 自摸');
console.log(`✓ 番数計算テスト通過: ${fanInfo.name} (${fanInfo.fan}番)`);

console.log('\n--- 5. 聴牌判定 (getTingTiles) テスト ---');
const tingPlayer = {
    que: 'B',
    hand: [
        { suit: 'W', num: 1, code: '1W' }, { suit: 'W', num: 2, code: '2W' }, { suit: 'W', num: 3, code: '3W' },
        { suit: 'T', num: 5, code: '5T' } // 聴 5筒 or 紅中
    ],
    melds: []
};
const tingTiles = MahjongEngine.getTingTiles(tingPlayer);
assert(tingTiles.length > 0, 'Ting list should not be empty');
assert(tingTiles.some(t => t.suit === 'T' && t.num === 5), 'Ting list should include 5筒');
assert(tingTiles.some(t => t.suit === 'HZ'), 'Ting list should include 紅中');
console.log(`✓ 聴牌判定テスト通過 (聴牌数: ${tingTiles.length})`);

console.log('\n--- 6. AI思考 (MahjongAI) テスト ---');
const aiHand = [
    { id: 1, suit: 'W', num: 1, code: '1W' },
    { id: 2, suit: 'W', num: 2, code: '2W' },
    { id: 3, suit: 'W', num: 3, code: '3W' },
    { id: 4, suit: 'T', num: 1, code: '1T' },
    { id: 5, suit: 'T', num: 9, code: '9T' },
    { id: 6, suit: 'B', num: 5, code: '5B' },
    { id: 7, suit: 'HZ', num: 0, code: 'HZ' }
];
const queSuit = MahjongAI.getDingQue(aiHand);
assert.strictEqual(queSuit, 'B', 'DingQue should select least frequent suit (B)');

const swap3 = MahjongAI.getSwapTiles(aiHand);
assert.strictEqual(swap3.length, 3, 'Swap 3 tiles should return exactly 3 tiles');
assert(!swap3.some(t => t.suit === 'HZ'), 'Swap tiles must never include HongZhong');
console.log('✓ AI換三張・定缺テスト通過');

console.log('\n--- 7. 決定論的DSLインタプリタ (DSL VM) テスト ---');
const prng = new DeterministicPRNG(42);
const r1 = prng.nextInt(1, 100);
const r2 = prng.nextInt(1, 100);
const prng2 = new DeterministicPRNG(42);
assert.strictEqual(prng2.nextInt(1, 100), r1, 'PRNG must be deterministic');
assert.strictEqual(prng2.nextInt(1, 100), r2, 'PRNG sequence must match');

const dslScript = {
    instructions: [
        { type: 'VAR_ASSIGN', name: 'bonus', value: { type: 'LITERAL', value: 500 } },
        { type: 'MODIFY_NUMERIC', path: ['players', 0, 'score'], delta: { type: 'VAR', name: 'bonus' } }
    ]
};
const vmContext = { sequenceId: 1, prng, variables: new Map() };
const vmRes = DeterministicVM.execute({ players: [{ score: 5000 }] }, dslScript, vmContext);
assert(vmRes.ok, 'DSL VM execution should succeed');
assert.strictEqual(vmRes.value.nextState.players[0].score, 5500, 'Score should be modified to 5500');
console.log('✓ 決定論的DSLインタプリタテスト通過');

console.log('\n--- 8. 和了後自動摸打 (Auto Tsumogiri after Hu) テスト ---');
const testState = new GameState();
const dummySound = { play: () => {} };
const dummyUI = {
    render: () => {}, updateTingPanel: () => {}, showActionBox: () => {}, hideActionBox: () => {},
    showInstruction: () => {}, hideInstruction: () => {}, showResultModal: () => {}, hideResultModal: () => {},
    log: () => {}, clearLog: () => {}
};
const controller = new GameController(testState, dummySound, dummyUI, MahjongEngine, MahjongAI, null, GameFlow, DeterministicPRNG);

// プレイヤー0を手動人間プレイヤーとして初期化
testState.phase = CONFIG.PHASES.PLAYING;
testState.currentTurn = 0;
testState.players[0].hand = [
    { id: 101, suit: 'W', num: 1, code: '1W' }, { id: 102, suit: 'W', num: 2, code: '2W' }, { id: 103, suit: 'W', num: 3, code: '3W' },
    { id: 104, suit: 'W', num: 4, code: '4W' }, { id: 105, suit: 'W', num: 5, code: '5W' }, { id: 106, suit: 'W', num: 6, code: '6W' },
    { id: 107, suit: 'W', num: 7, code: '7W' }, { id: 108, suit: 'W', num: 8, code: '8W' }, { id: 109, suit: 'W', num: 9, code: '9W' },
    { id: 110, suit: 'T', num: 1, code: '1T' }, { id: 111, suit: 'T', num: 1, code: '1T' }, { id: 112, suit: 'T', num: 1, code: '1T' },
    { id: 113, suit: 'T', num: 9, code: '9T' }, { id: 114, suit: 'T', num: 9, code: '9T' } // 14枚：和了形
];
testState.players[0].que = 'B';
testState.autoPlay = false; // 托管はオフ

// 1回目の和了（自摸）を実行
controller.doHu(0, testState.players[0].hand[13], true);
assert.strictEqual(testState.players[0].isHu, true, 'Player 0 should be isHu = true');
assert.strictEqual(testState.players[0].huRecords.length, 1, 'Player 0 should have 1 huRecord');
assert.strictEqual(testState.players[0].hand.length, 13, 'Hand size should be 13 after zimo discard');

// 次の手番でツモ牌が来たとき（和了牌でない牌）
testState.currentTurn = 0;
const drawnTile = { id: 200, suit: 'T', num: 4, code: '4T' };
testState.players[0].hand.push(drawnTile);

// autoPlayPlayerTurn が呼ばれたときに自動ツモ切りされるかテスト
controller.autoPlayPlayerTurn(0);
assert.strictEqual(testState.players[0].hand.length, 13, 'Hand size should be 13 after auto tsumogiri');
assert.strictEqual(testState.lastDiscard.tile.id, 200, 'Drawn tile (4T) should be automatically discarded');

// 次の手番でツモ牌が和了牌（9T）だったとき
testState.currentTurn = 0;
const winningTile = { id: 201, suit: 'T', num: 9, code: '9T' };
testState.players[0].hand.push(winningTile);

// autoPlayPlayerTurn が自動で自摸和了し、かつツモ切りするかテスト
controller.autoPlayPlayerTurn(0);
assert.strictEqual(testState.players[0].huRecords.length, 2, 'Player 0 should have 2 huRecords (auto zimo)');
assert.strictEqual(testState.players[0].hand.length, 13, 'Hand size should be 13 after auto zimo and discard');
console.log('✓ 和了後自動摸打＆自動自摸テスト通過');

console.log('\n--- 9. 多言語 (I18nHelper) ＆ ピンイン表記 (汉↔A) テスト ---');
I18nHelper.lang = 'JA';
I18nHelper.isPinyin = false;
assert.strictEqual(I18nHelper.t('红中血流成河麻将'), '红中血流成河麻雀', '日本語モード時は日本語で翻訳されること');

// 表記切替 (ピンインON)
I18nHelper.togglePinyin();
assert.strictEqual(I18nHelper.isPinyin, true);
assert.strictEqual(I18nHelper.t('红中血流成河麻将'), 'Hóngzhōng Xuèliú Chénghé Mǎjiàng', 'ピンインON時は言語設定に関わらずピンインになること');
assert.strictEqual(I18nHelper.t('1万'), '1 Wàn');
assert.strictEqual(I18nHelper.t('4番'), '4 fān');
assert.strictEqual(I18nHelper.t('100分'), '100 fēn');

// ピンインOFFに戻す
I18nHelper.togglePinyin();
assert.strictEqual(I18nHelper.isPinyin, false);

// 言語切替 (中国語モード)
I18nHelper.toggleLanguage();
assert.strictEqual(I18nHelper.lang, 'ZH');
assert.strictEqual(I18nHelper.t('红中血流成河麻将'), '红中血流成河麻将', '中国語モード時は原文のまま表示されること');

// 再び日本語モードに戻す
I18nHelper.toggleLanguage();
assert.strictEqual(I18nHelper.lang, 'JA');
assert.strictEqual(I18nHelper.t('红中血流成河麻将'), '红中血流成河麻雀');
console.log('✓ 独立した言語切替 (日/中) ＆ 表記切替 (汉↔A) テスト通過');

console.log('\n--- 10. 効果音管理 (SoundManager) & 他家和了音テスト ---');
const playedSounds = [];
const soundTracker = {
    play: type => playedSounds.push(type)
};
const ctrlSoundTest = new GameController(testState, soundTracker, dummyUI, MahjongEngine, MahjongAI, null, GameFlow, DeterministicPRNG);

// 自身（0番座席 = mySeat）の和了時
playedSounds.length = 0;
ctrlSoundTest.doHu(0, { id: 301, suit: 'W', num: 1, code: '1W' }, true);
assert.strictEqual(playedSounds[0], 'hu', 'Player 0 (self) win should play "hu" sound');

// 他家（1番座席）の和了時
playedSounds.length = 0;
ctrlSoundTest.doHu(1, { id: 302, suit: 'W', num: 2, code: '2W' }, true);
assert.strictEqual(playedSounds[0], 'hu_opp', 'Player 1 (opponent) win should play "hu_opp" sound');

// 他家（2番座席）の和了時
playedSounds.length = 0;
ctrlSoundTest.doHu(2, { id: 303, suit: 'W', num: 3, code: '3W' }, true);
assert.strictEqual(playedSounds[0], 'hu_opp', 'Player 2 (opponent) win should play "hu_opp" sound');

console.log('✓ 自家/他家和了時の効果音鳴らし分けテスト通過');

console.log('\n--- 11. P2P クライアント副露（ポン・カン）＆オフターン調停テスト ---');
const p2pState = new GameState();
p2pState.phase = CONFIG.PHASES.PLAYING;
p2pState.currentTurn = 0; // ホスト（0番席）のターン

// ホストの手牌とクライアント（1番席）の手牌を設定
p2pState.players[0].hand = [
    { id: 401, suit: 'W', num: 1, code: '1W' },
    { id: 402, suit: 'W', num: 5, code: '5W' }
];
p2pState.players[1].hand = [
    { id: 403, suit: 'W', num: 1, code: '1W' },
    { id: 404, suit: 'W', num: 1, code: '1W' },
    { id: 405, suit: 'T', num: 3, code: '3T' },
    { id: 406, suit: 'T', num: 4, code: '4T' },
    { id: 407, suit: 'T', num: 5, code: '5T' },
    { id: 408, suit: 'T', num: 6, code: '6T' },
    { id: 409, suit: 'T', num: 7, code: '7T' },
    { id: 410, suit: 'T', num: 8, code: '8T' },
    { id: 411, suit: 'T', num: 9, code: '9T' },
    { id: 412, suit: 'B', num: 2, code: '2B' },
    { id: 413, suit: 'B', num: 3, code: '3B' },
    { id: 414, suit: 'B', num: 4, code: '4B' },
    { id: 415, suit: 'B', num: 5, code: '5B' }
];
p2pState.players[1].que = 'B';

// モックP2Pマネージャー（ホスト側）
const sentPrompts = [];
const mockHostP2P = {
    isHost: true,
    seatIndex: 0,
    playersInfo: [
        { id: 0, name: '1P (房主)', isAI: false, peerId: 'hz1234' },
        { id: 1, name: '2P (玩家)', isAI: false, peerId: 'client-peer-1' },
        { id: 2, name: '3P (电脑)', isAI: true, peerId: null },
        { id: 3, name: '4P (电脑)', isAI: true, peerId: null }
    ],
    sendToSeat: (seat, msg) => {
        sentPrompts.push({ seat, msg });
        return true;
    },
    broadcastState: () => {},
    broadcastRoomInfo: () => {}
};

const hostController = new GameController(p2pState, dummySound, dummyUI, MahjongEngine, MahjongAI, mockHostP2P, GameFlow, DeterministicPRNG);

// ホストが 1W を打牌
const discardedTile = { id: 401, suit: 'W', num: 1, code: '1W' };
p2pState.players[0].discards.push(discardedTile);
p2pState.lastDiscard = { tile: discardedTile, playerIndex: 0 };

// checkOffTurnActions を実行
hostController.checkOffTurnActions(discardedTile, 0);

// クライアント（1番席）へ PROMPT_OFFTURN_ACTION が送信されたか検証
assert.strictEqual(sentPrompts.length, 1, 'Prompt should be sent to client seat 1');
assert.strictEqual(sentPrompts[0].seat, 1, 'Target seat should be 1');
assert.strictEqual(sentPrompts[0].msg.options.canPung, true, 'Client should be prompted with canPung = true');

// クライアント（1番席）から RESPONSE_OFFTURN (choice: PUNG) を受信したケースのテスト
hostController.handleRemoteAction(1, 'RESPONSE_OFFTURN', {
    choice: 'PUNG',
    tile: discardedTile,
    fromPlayer: 0
});

// 検証:
// 1. クライアント(1番席)の手牌から 1W が2枚取り除かれていること
assert.strictEqual(p2pState.players[1].hand.filter(t => t.code === '1W').length, 0, '1W should be removed from hand');
assert.strictEqual(p2pState.players[1].hand.length, 11, 'Hand size should be 11 (13 - 2)');
// 2. クライアント(1番席)の melds に PUNG が追加されていること
assert.strictEqual(p2pState.players[1].melds.length, 1, 'Melds should contain 1 meld');
assert.strictEqual(p2pState.players[1].melds[0].type, 'PUNG', 'Meld type should be PUNG');
// 3. 現在の手番がクライアント（1番席）に移っていること
assert.strictEqual(p2pState.currentTurn, 1, 'Current turn should be player 1');
// 4. 捨て牌から鳴かれた 1W が取り除かれていること
assert.strictEqual(p2pState.players[0].discards.length, 0, 'Discarded 1W should be removed from player 0 river');

console.log('✓ P2P クライアント副露（ポン）＆オフターン調停テスト通過');

console.log('\n--- 12. 欠色自動切りモード (Auto-Discard Que) テスト ---');
const autoQueState = new GameState();
autoQueState.phase = CONFIG.PHASES.PLAYING;
autoQueState.currentTurn = 0;
autoQueState.autoQue = true;
autoQueState.autoPlay = false;

// プレイヤー0の手牌：缺門（'B'）の牌が2枚含まれる
autoQueState.players[0].que = 'B';
autoQueState.players[0].hand = [
    { id: 501, suit: 'W', num: 1, code: '1W' },
    { id: 502, suit: 'W', num: 2, code: '2W' },
    { id: 503, suit: 'W', num: 3, code: '3W' },
    { id: 504, suit: 'T', num: 4, code: '4T' },
    { id: 505, suit: 'T', num: 5, code: '5T' },
    { id: 506, suit: 'T', num: 6, code: '6T' },
    { id: 507, suit: 'T', num: 7, code: '7T' },
    { id: 508, suit: 'T', num: 8, code: '8T' },
    { id: 509, suit: 'T', num: 9, code: '9T' },
    { id: 510, suit: 'W', num: 9, code: '9W' },
    { id: 511, suit: 'W', num: 9, code: '9W' },
    { id: 512, suit: 'W', num: 9, code: '9W' },
    { id: 513, suit: 'B', num: 1, code: '1B' }, // 缺門牌 1
    { id: 514, suit: 'B', num: 9, code: '9B' }  // 缺門牌 2 (ツモ牌)
];

const autoQueCtrl = new GameController(autoQueState, dummySound, dummyUI, MahjongEngine, MahjongAI, null, GameFlow, DeterministicPRNG);

// 1回目の自手番自動打缺テスト
autoQueCtrl.autoPlayQueDiscard(0);
assert.strictEqual(autoQueState.players[0].hand.length, 13, 'Hand size should be 13 after auto discard');
assert.strictEqual(autoQueState.lastDiscard.tile.suit, 'B', 'Discarded tile must be Que suit (B)');
assert.strictEqual(autoQueState.players[0].hand.filter(t => t.suit === 'B').length, 1, 'Only 1 Que tile should remain');

// 2回目のツモ番（非缺門牌をツモったが手牌にまだ缺門牌 9B が残っているケース）
autoQueState.currentTurn = 0;
const drawnW = { id: 515, suit: 'W', num: 5, code: '5W' };
autoQueState.players[0].hand.push(drawnW);
autoQueCtrl.autoPlayQueDiscard(0);
assert.strictEqual(autoQueState.players[0].hand.length, 13, 'Hand size should be 13 after second auto discard');
assert.strictEqual(autoQueState.lastDiscard.tile.suit, 'B', 'Remaining Que tile should be automatically discarded');
assert.strictEqual(autoQueState.players[0].hand.some(t => t.suit === 'B'), false, 'No Que tiles should remain in hand');

console.log('✓ 欠色自動切りモードテスト通過');

console.log('\n--- 13. 自摸ログ制御（他人の摸牌ログ非表示）テスト ---');
const logTestState = new GameState();
logTestState.phase = CONFIG.PHASES.PLAYING;
logTestState.currentTurn = 1; // プレイヤー1の手番
logTestState.players[1].hand = new Array(13).fill({ id: 1, suit: 'W', num: 1, code: '1W' });
logTestState.players[0].hand = new Array(13).fill({ id: 2, suit: 'W', num: 1, code: '1W' });
logTestState.wall = [{ id: 999, suit: 'T', num: 9, code: '9T' }, { id: 998, suit: 'T', num: 8, code: '8T' }];

let lastLoggedMsg = null;
const mockUI = {
    ...dummyUI,
    log: (msg) => { lastLoggedMsg = msg; }
};
const logCtrl = new GameController(logTestState, dummySound, mockUI, MahjongEngine, MahjongAI, null, GameFlow, DeterministicPRNG);
logCtrl.mySeat = 0; // 自身はプレイヤー0

// 他人(プレイヤー1)のツモ
logCtrl.processTurn();
assert.strictEqual(lastLoggedMsg, null, '他人の自摸（摸牌）はログに出力されてはならない');

// 自分(プレイヤー0)のツモ
logTestState.currentTurn = 0;
logCtrl.processTurn();
assert(lastLoggedMsg && lastLoggedMsg.includes('摸'), '自分の自摸（摸牌）はログに出力される必要がある');

console.log('✓ 他人の自摸ログ非表示テスト通過');

console.log('\n--- 14. オフターンタイムアウト撤廃＆切断時調停フォールバックテスト ---');
const discTestState = new GameState();
discTestState.phase = CONFIG.PHASES.PLAYING;
discTestState.currentTurn = 0;
const mockDisconnectP2P = {
    isHost: true,
    playersInfo: [
        { id: 0, name: '1P', isAI: false, peerId: 'host' },
        { id: 1, name: '2P', isAI: false, peerId: 'client1' },
        { id: 2, name: '3P', isAI: true, peerId: null },
        { id: 3, name: '4P', isAI: true, peerId: null }
    ],
    sendToSeat: () => true,
    broadcastState: () => {},
    broadcastRoomInfo: () => {}
};
const discCtrl = new GameController(discTestState, dummySound, dummyUI, MahjongEngine, MahjongAI, mockDisconnectP2P, GameFlow, DeterministicPRNG);

// プレイヤー1がポン可能な状態で待機
discCtrl.pendingOffTurn = {
    idx: 1,
    tile: { id: 701, suit: 'W', num: 1, code: '1W' },
    discarder: 0,
    offset: 2
};

// クライアント1が切断した際のフォールバック
discCtrl.handlePlayerDisconnect(1);
assert.strictEqual(discCtrl.pendingOffTurn, null, '切断時に待機中調停が安全に解消されること');
assert.strictEqual(discTestState.players[1].name, '2P (电脑)', '切断プレイヤーがAI化されること');

console.log('✓ オフターンタイムアウト撤廃＆切断時調停フォールバックテスト通過');

console.log('\n--- 15. マイナス点プレイヤー脱落＆ゲーム継続テスト ---');
const elimState = new GameState();
elimState.phase = CONFIG.PHASES.PLAYING;
elimState.players[1].score = 200; // プレイヤー1が低得点
elimState.players[0].score = 5000;

// プレイヤー1からプレイヤー0へ400点移動（点数がマイナスになり脱落）
elimState.transferScore(1, 0, 400);
assert.strictEqual(elimState.players[1].score, -200, 'スコアがマイナスになること');
assert.strictEqual(elimState.players[1].isEliminated, true, 'マイナス点プレイヤーが脱落(isEliminated=true)になること');

// まだ他プレイヤー(0, 2, 3)が生存しているためゲームは継続(isGameOver=false)
assert.strictEqual(elimState.isGameOver(), false, '1人脱落しても残りが複数人生存していればゲーム継続すること');

// 脱落プレイヤーの手番スキップ検証 (生存者が残っている状態でプレイヤー1の手番)
const elimCtrl = new GameController(elimState, dummySound, dummyUI, MahjongEngine, MahjongAI, null, GameFlow, DeterministicPRNG);
elimState.currentTurn = 1; // プレイヤー1(脱落)の手番
elimCtrl.processTurn();
assert.strictEqual(elimState.currentTurn, 2, '脱落プレイヤー1の手番が自動スキップされてプレイヤー2に移ること');

// プレイヤー2, 3も脱落した場合
elimState.players[2].isEliminated = true;
elimState.players[2].score = 0;
elimState.players[3].isEliminated = true;
elimState.players[3].score = -500;
assert.strictEqual(elimState.isGameOver(), true, '生存者が1人以下になった場合はゲーム終了となること');

console.log('✓ マイナス点プレイヤー脱落＆ゲーム継続テスト通過');

console.log('\n--- 16. 簡体字混じり直訳風日本語（JAモード）テスト ---');
PinyinHelper.langMode = 'JA';
assert.strictEqual(PinyinHelper.t('红中血流成河麻将'), '红中血流成河麻雀', 'タイトルが簡体字混じりの直訳風日本語に翻訳されること');
assert.strictEqual(PinyinHelper.t('清一色'), '清一色', '清一色が直訳風に翻訳されること');
assert.strictEqual(PinyinHelper.t('对对胡'), '对对胡', '对对胡が簡体字混じりで翻訳されること');
assert.strictEqual(PinyinHelper.t('自摸'), '自摸', '自摸が翻訳されること');
assert.strictEqual(PinyinHelper.t('点炮'), '点炮', '点炮が翻訳されること');
assert.strictEqual(PinyinHelper.t('查大叫'), 'ノーテン罰符', '查大叫が翻訳されること');
assert.strictEqual(PinyinHelper.t('查花猪'), '欠色ペナルティ', '查花猪が翻訳されること');
assert.strictEqual(PinyinHelper.t('换三张'), '三张を换えて', '换三张が直訳風になること');
assert.strictEqual(PinyinHelper.t('缺万'), '缺万', '缺万が翻訳されること');
assert.strictEqual(PinyinHelper.t('先打缺门牌'), '先に缺门の牌を打ってください！', 'ログ文が中華直訳風になること');

// UIController.getDingQueOptionsHtml の検証
const dingQueHtml = UIController.getDingQueOptionsHtml();
assert.ok(dingQueHtml.includes('wan_1.svg'), '定缺選択肢に1万のSVG画像が含まれること');
assert.ok(dingQueHtml.includes('tong_1.svg'), '定缺選択肢に1筒のSVG画像が含まれること');
assert.ok(dingQueHtml.includes('tiao_1.svg'), '定缺選択肢に1条のSVG画像が含まれること');

console.log('✓ 簡体字混じり直訳風日本語＆定缺牌図表示テスト通過');

console.log('\n========================================');
console.log('★ 全ての検証テストに正常に合格しました！');
console.log('========================================');



