/**
 * 紅中血流成河麻雀 - 定数設定
 */
const CONFIG = {
    SUITS: { W: '万', T: '筒', B: '条', HZ: '中' },
    UNICODE_BASE: { W: 0x1F006, T: 0x1F018, B: 0x1F00F },

    PHASES: {
        INIT: 'INIT',
        SWAP3: 'SWAP3',
        DINGQUE: 'DINGQUE',
        PLAYING: 'PLAYING',
        END: 'END'
    },

    YAKU: {
        PING_HU: { name: '平胡', fan: 0 },
        DUI_DUI_HU: { name: '对对胡', fan: 1 },
        JIN_GOU_DIAO: { name: '金钩钓', fan: 1 },
        QI_DUI: { name: '七对', fan: 2 },
        QING_YI_SE: { name: '清一色', fan: 2 },
        GANG_SHANG_HUA: { name: '杠上花', fan: 1 },
        GANG_SHANG_PAO: { name: '杠上炮', fan: 1 },
        ZI_MO: { name: '自摸', fan: 1 }
    },

    BASE_SCORE: 100,
    INITIAL_SCORE: 5000,
    TOTAL_PLAYERS: 4,
    HAND_SIZE: 13,
    GANG_SCORE: 200,
    HUA_ZHU_PENALTY: 1600,
    NO_TING_DEFAULT: 800,

    DELAYS: {
        AI_TURN: 300,
        AUTO_ACTION: 400
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
