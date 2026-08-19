/**
 * 紅中血流成河麻雀 - ピンイン（Pinyin）辞書・翻訳ヘルパー (PinyinHelper, PINYIN_DICT)
 */

const PINYIN_DICT = {
    // 牌名
    '1万': '1 Wàn', '2万': '2 Wàn', '3万': '3 Wàn', '4万': '4 Wàn', '5万': '5 Wàn',
    '6万': '6 Wàn', '7万': '7 Wàn', '8万': '8 Wàn', '9万': '9 Wàn',
    '1筒': '1 Tóng', '2筒': '2 Tóng', '3筒': '3 Tóng', '4筒': '4 Tóng', '5筒': '5 Tóng',
    '6筒': '6 Tóng', '7筒': '7 Tóng', '8筒': '8 Tóng', '9筒': '9 Tóng',
    '1条': '1 Tiáo', '2条': '2 Tiáo', '3条': '3 Tiáo', '4条': '4 Tiáo', '5条': '5 Tiáo',
    '6条': '6 Tiáo', '7条': '7 Tiáo', '8条': '8 Tiáo', '9条': '9 Tiáo',
    '红中': 'Hóngzhōng',

    // UI・タイトル・ボタン
    '红中血流成河麻将': 'Hóngzhōng Xuèliú Chénghé Mâjiàng',
    '开始对局': 'Kāishǐ Duìjú',
    '加入房间': 'Jiārù Fángjiān',
    '换号': 'Huànhào',
    '改名': 'Gǎimíng',
    '房间号': 'Fángjiānhào',
    '玩家': 'Wánjiā',
    '积分': 'Jīfēn',
    '定缺/状态': 'Dìngquē / Zhuàngtài',
    '副露': 'Fùlù',
    '剩余牌山': 'Shèngyú Páishān',
    '张': 'zhāng',
    '弃牌区': 'Qìpái Qū',
    '日志': 'Rìzhì',
    '听牌': 'Tīngpái',
    '换三张': 'Huàn Sān Zhāng',
    '选3张牌': 'Xuǎn 3 zhāng pái',
    '确定': 'Quèdìng',
    '定缺': 'Dìngquē',
    '请选择定缺门类': 'Qǐng xuǎnzé dìngquē ménlèi',
    '缺万': 'Quē Wàn',
    '缺筒': 'Quē Tóng',
    '缺条': 'Quē Tiáo',
    '对局结算': 'Duìjú Jiésuàn',
    '再来一局': 'Zàilái Yìjú',
    '新建房间 (重置)': 'Xīnjiàn Fángjiān (Chóngzhì)',
    '已胡牌（自动摸打中）': 'Yǐ Hú (Zìdòng mō dǎ zhōng)',
    '胡': 'Hú',
    '杠': 'Gàng',
    '碰': 'Pèng',
    '过': 'Guò',

    // ロール・座席
    '(你/房主)': '(Nǐ/Fángzhǔ)',
    '(你)': '(Nǐ)',
    '(房主)': '(Fángzhǔ)',
    '(玩家)': '(Wánjiā)',
    '(电脑)': '(Diànnǎo)',
    '房主': 'Fángzhǔ',
    '电脑': 'Diànnǎo',
    '你': 'Nǐ',

    // 役名・和了
    '平胡': 'Pínghú',
    '清一色': 'Qīngyīsè',
    '对对胡': 'Duìduìhú',
    '七对': 'Qīduì',
    '金钩钓': 'Jīngōudiào',
    '杠上花': 'Gàngshànghuā',
    '杠上炮': 'Gàngshàngpào',
    '自摸': 'Zìmō',
    '点炮': 'Diǎnpào',
    '暗杠': 'Àngàng',
    '明杠': 'Mínggàng',
    '补杠': 'Bǔgàng',
    '已胡': 'Yǐ Hú',

    // 清算・単位
    '查花猪': 'Chá Huāzhū',
    '查大叫': 'Chá Dàjiào',
    '本局未胡牌': 'Běnjú wèi hú pái',
    '清算明细': 'Qīngsuàn Míngxì',
    '手番': 'Shǒufān',
    '分': 'fēn',
    '番': 'fān',
    '根': 'gēn',
    '位': 'wèi',
    '次': 'cì',
    '张': 'zhāng',

    // 短縮ログ文
    '新局开始，': 'Xīnjú kāishǐ, ',
    '起家': 'qǐjiā',
    '[杠]': '[Gàng]',
    '先打缺门牌': 'Xiān dǎ quēmén pái',
    '已胡牌只能打摸牌': 'Yǐ hú pái zhǐ néng dǎ mōpái',
    '红中不能换三张': 'Hóngzhōng bù néng huàn sān zhāng',
    '已选换牌，等待中...': 'Yǐ xuǎn huànpái, děngdài zhōng...',
    '已选换牌': 'yǐ xuǎn huànpái',
    '换三张完成': 'Huàn sān zhāng wánchéng',
    '定缺:': 'Dìngquē:',
    '，等待中...': ', děngdài zhōng...',
    '系统就绪': 'Xìtǒng jiùxù',
    '连接房间 ': 'Liánjiē fángjiān ',
    '已加入 ': 'Yǐ jiārù ',
    '，等待开局...': ', děngdài kāijú...',
    '进入房间': 'jìnrù fángjiān',
    '离线 (电脑托管)': 'líxiàn (diànnǎo tuōguǎn)',
    '新房间: ': 'Xīn fángjiān: ',
    '换房: ': 'Huàn fáng: ',
    '改名: ': 'Gǎimíng: ',
    '请等待房主开局': 'Qǐng děngdài fángzhǔ kāijú',
    ' 摸 ': ' mō ',
    ' 打 ': ' dǎ '
};

class PinyinHelper {
    static isPinyin = false;
    static _sortedKeys = null;

    static get sortedKeys() {
        if (!this._sortedKeys) {
            this._sortedKeys = Object.keys(PINYIN_DICT).sort((a, b) => b.length - a.length);
        }
        return this._sortedKeys;
    }

    static t(text) {
        if (!this.isPinyin || !text) return text;
        if (PINYIN_DICT[text]) return PINYIN_DICT[text];
        let res = String(text);
        for (const k of this.sortedKeys) {
            if (res.includes(k)) {
                res = res.split(k).join(PINYIN_DICT[k]);
            }
        }

        // 自然なスペーシングと単位の整形
        res = res
            .replace(/\)(Quē|quē|Wánjiā|Diànnǎo|Fángzhǔ|qǐjiā)/g, ') $1')
            .replace(/(\d+)\s*番/g, '$1 fān')
            .replace(/(\d+)\s*分/g, '$1 fēn')
            .replace(/(\d+)\s*根/g, '$1 gēn')
            .replace(/(\d+)\s*张/g, '$1 zhāng')
            .replace(/(\d+)\s*位/g, '$1 wèi')
            .replace(/(\d+)\s*次/g, '$1 cì')
            .replace(/，/g, ', ')
            .replace(/、/g, ', ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        return res;
    }
}

if (typeof window !== 'undefined') {
    window.PinyinHelper = PinyinHelper;
    window.PINYIN_DICT = PINYIN_DICT;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PinyinHelper, PINYIN_DICT };
}
