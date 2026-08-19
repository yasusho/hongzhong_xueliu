/**
 * 紅中血流成河麻雀 - 自動リグレッション・ユニット検証スクリプト
 */
const assert = require('assert');

// 1. 統合モジュールのロード
const { CONFIG, MahjongEngine, MahjongAI, GameFlow, GameState } = require('../js/engine.js');
const { SoundManager, UIController, GameController } = require('../js/main.js');
const { P2PManager } = require('../js/p2p.js');
const { DeterministicPRNG, DeterministicVM, TriggerResolutionEngine } = require('../js/dsl.js');

console.log('--- 1. モジュール読み込みテスト ---');
assert(CONFIG && CONFIG.TOTAL_PLAYERS === 4, 'CONFIG loaded correctly');
assert(MahjongEngine, 'MahjongEngine loaded');
assert(MahjongAI, 'MahjongAI loaded');
assert(DeterministicVM, 'DeterministicVM loaded');
assert(SoundManager, 'SoundManager loaded');
assert(P2PManager, 'P2PManager loaded');
assert(GameFlow, 'GameFlow loaded');
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
console.log('✓ 和了判定テスト通過');

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

console.log('\n========================================');
console.log('★ 全ての検証テストに正常に合格しました！');
console.log('========================================');
