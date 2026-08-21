/**
 * 紅中血流成河麻雀 - 多言語（日本語・中国語・ピンイン）辞書 & 翻訳ヘルパー (I18nHelper, JA_DICT, PINYIN_DICT)
 */

const JA_DICT = {
    // 牌名
    '1万': '1万', '2万': '2万', '3万': '3万', '4万': '4万', '5万': '5万',
    '6万': '6万', '7万': '7万', '8万': '8万', '9万': '9万',
    '1筒': '1筒', '2筒': '2筒', '3筒': '3筒', '4筒': '4筒', '5筒': '5筒',
    '6筒': '6筒', '7筒': '7筒', '8筒': '8筒', '9筒': '9筒',
    '1条': '1条', '2条': '2条', '3条': '3条', '4条': '4条', '5条': '5条',
    '6条': '6条', '7条': '7条', '8条': '8条', '9条': '9条',
    '红中': '红中',

    // UI・タイトル・ボタン
    '红中血流成河麻将': '红中血流成河麻雀',
    '开始对局': '对局を开始',
    '加入房间': 'ルームに加入',
    '换号': 'ルーム番号を変える',
    '离开': 'ルームを离れる',
    '离开房间并重置': 'ルームを离脱して重置する',
    '改名': '改名する',
    '房间号': 'ルーム番号',
    '玩家': '玩家',
    '积分': '点数',
    '定缺/状态': '定缺/状态',
    '副露': '副露',
    '剩余牌山': '余る牌山',
    '弃牌区': '廃棄ゾーン',
    '日志': 'ログ',
    '听牌': 'テンパイ',
    '换三张': '三张を换えて',
    '选3张牌': '3张の牌を選択して',
    '确定': '确定',
    '定缺': '定缺',
    '请选择定缺门类': '定缺の门类を選択して',
    '缺万': '缺万',
    '缺筒': '缺筒',
    '缺条': '缺条',
    '对局结算': '对局の结算',
    '再来一局': 'もう一局',
    '新建房间 (重置)': '新しく房间建て',
    '已胡牌（自动摸打中）': 'すでに胡牌（自动摸打中）',
    '托管中': '托管中',
    '托管: 开': '托管: ON',
    '托管: 关': '托管: OFF',
    '自动打缺': '自动で缺を打つ',
    '自动打缺中': '自动で缺を打つ中',
    '自动打缺: 开': '自动で缺を打つ: ON',
    '自动打缺: 关': '自动で缺を打つ: OFF',
    '自动打缺模式': '自动打缺模式',
    '胡': 'あがり',
    '杠': 'カン',
    '碰': 'ポン',
    '过': 'パス',
    '脱落': '脱落',

    // ツールチップ・ダイアログ・補助UI
    '重新生成4位房间号': '4桁の部屋番号を再生成',
    '修改你的显示昵称': '表示ニックネームを変更',
    '切换语言显示 (日/中/拼音)': '言語表示を切替 (日/中/拼音)',
    '点击修改昵称': 'クリックしてニックネームを変更',
    '自动打缺门牌': '自動で缺门の牌を打つ',
    '自动托管对局': '自動で対局を托管する',
    '请输入4位房间号:': '4桁の部屋番号を入力してください:',
    '请输入你的玩家昵称 (最多8字):': 'プレイヤーのニックネームを入力してください (最多8字):',
    '加入房间失败: ': '部屋への参加に失敗しました: ',

    // ロール・座席
    '(你/房主)': '(あなた/房主)',
    '(你)': '(あなた)',
    '(房主)': '(房主)',
    '(玩家)': '(玩家)',
    '(电脑)': '(电脑)',
    '房主': '房主',
    '电脑': 'コンピュータ',
    '你': 'あなた',

    // 役名・和了
    '平胡': '平胡',
    '清一色': '清一色',
    '对对胡': '对对胡',
    '七对': '七对',
    '金钩钓': '金钩钓',
    '杠上花': '杠上花',
    '杠上炮': '杠上炮',
    '自摸': '自摸',
    '点炮': '点炮',
    '暗杠': '暗杠',
    '明杠': '明杠',
    '补杠': '补杠',
    '已胡': 'すでにあがり',

    // 清算・単位
    '查花猪': '欠色ペナルティ',
    '查大叫': 'ノーテン罰符',
    '本局未胡牌': '本局は胡牌していません',
    '清算明细': '清算明细',
    '手番': '手番',
    '分': '点',
    '番': '番',
    '根': '根',
    '位': '位',
    '次': '次',
    '张': '枚',

    // ログ文
    '新局开始，': '新局が开始しました、',
    '起家': 'が起家です',
    '[杠]': '[カン]',
    '先打缺门牌': '先に缺门の牌を打ってください！',
    '已胡牌只能打摸牌': 'すでに胡牌した玩家は摸牌しか打てません！',
    '红中为万能牌，不能作为换三张牌打出': '红中は万能牌であるため、换三张の牌として打つことは不可能です！',
    '红中不能换三张': '红中は换三张できません',
    '已选换牌，等待中...': '换牌を選択完了しました、他の玩家を等待中...',
    '已选换牌': '换牌を選択完了',
    '换三张完成': '换三张が完成しました',
    '已定': 'すでに決定: ',
    '定缺: ': '定缺: ',
    '定缺:': '定缺:',
    '，等待中...': '、他の玩家を等待中...',
    '系统就绪。': '系统の准备が整いました。',
    '系统就绪': 'システム準備完了',
    '连接房间 ': '部屋に接続中: ',
    '已加入 ': 'すでに加入しました: ',
    '，等待开局...': '、开局を等待中...',
    '进入房间': 'が部屋に入室しました',
    '离线 (电脑托管)': 'が离线しました (コンピュータ托管)',
    '新房间: ': '新部屋: ',
    '换房: ': '部屋変更: ',
    '改名: ': '改名: ',
    '请等待房主开局': '房主が开局するのをお待ちして',
    ' 摸 ': ' が引く: ',
    ' 打 ': ' が打つ: ',
    ' 碰 ': ' がポンする: ',
    ' 暗杠 ': ' が暗カンする: ',
    ' 明杠 ': ' が明カンする: ',
    ' 补杠 ': ' が补カンする: '
};

const PINYIN_DICT = {
    // 牌名
    '1万': '1 Wàn', '2万': '2 Wàn', '3万': '3 Wàn', '4万': '4 Wàn', '5万': '5 Wàn',
    '6万': '6 Wàn', '7万': '7 Wàn', '8万': '8 Wàn', '9万': '9 Wàn',
    '1筒': '1 Tǒng', '2筒': '2 Tǒng', '3筒': '3 Tǒng', '4筒': '4 Tǒng', '5筒': '5 Tǒng',
    '6筒': '6 Tǒng', '7筒': '7 Tǒng', '8筒': '8 Tǒng', '9筒': '9 Tǒng',
    '1条': '1 Tiáo', '2条': '2 Tiáo', '3条': '3 Tiáo', '4条': '4 Tiáo', '5条': '5 Tiáo',
    '6条': '6 Tiáo', '7条': '7 Tiáo', '8条': '8 Tiáo', '9条': '9 Tiáo',
    '红中': 'Hóngzhōng',

    // UI・タイトル・ボタン
    '红中血流成河麻将': 'Hóngzhōng Xuèliú Chénghé Mǎjiàng',
    '开始对局': 'Kāishǐ Duìjú',
    '加入房间': 'Jiārù Fángjiān',
    '换号': 'Huànhào',
    '离开': 'Líkāi',
    '离开房间并重置': 'Líkāi fángjiān bìng chóngzhì',
    '改名': 'Gǎimíng',
    '房间号': 'Fángjiānhào',
    '玩家': 'Wánjiā',
    '积分': 'Jīfēn',
    '定缺/状态': 'Dìngquē / Zhuàngtài',
    '副露': 'Fùlù',
    '剩余牌山': 'Shèngyú Páishān',
    '弃牌区': 'Qìpái Qū',
    '日志': 'Rìzhì',
    '听牌': 'Tīngpái',
    '换三张': 'Huàn Sān Zhāng',
    '选3张牌': 'Xuǎn 3 zhāng pái',
    '确定': 'Quèdìng',
    '定缺': 'Dìngquē',
    '请选择定缺门类': 'Qǐng xuǎnzé dìngquē ménlèi',
    '缺万': 'Quē Wàn',
    '缺筒': 'Quē Tǒng',
    '缺条': 'Quē Tiáo',
    '对局结算': 'Duìjú Jiésuàn',
    '再来一局': 'Zàilái Yìjú',
    '新建房间 (重置)': 'Xīnjiàn Fángjiān (Chóngzhì)',
    '已胡牌（自动摸打中）': 'Yǐ Hú (Zìdòng mō dǎ zhōng)',
    '托管中': 'Tuōguǎn zhōng',
    '托管: 开': 'Tuōguǎn: Kāi',
    '托管: 关': 'Tuōguǎn: Guān',
    '自动打缺': 'Zìdòng dǎquē',
    '自动打缺中': 'Zìdòng dǎquē zhōng',
    '自动打缺: 开': 'Zìdòng dǎquē: Kāi',
    '自动打缺: 关': 'Zìdòng dǎquē: Guān',
    '自动打缺模式': 'Zìdòng dǎquē móshì',
    '胡': 'Hú',
    '杠': 'Gàng',
    '碰': 'Pèng',
    '过': 'Guò',
    '脱落': 'Tuōluò',

    // ツールチップ・ダイアログ・補助UI
    '重新生成4位房间号': 'Chóngxīn shēngchéng 4 wèi fángjiānhào',
    '修改你的显示昵称': 'Xiūgǎi nǐ de xiǎnshì nìchēng',
    '切换语言显示 (日/中/拼音)': 'Qiēhuàn yǔyán xiǎnshì (Rì/Zhōng/Pīnyīn)',
    '点击修改昵称': 'Diǎnjī xiūgǎi nǐchēng',
    '自动打缺门牌': 'Zìdòng dǎ quēmén pái',
    '自动托管对局': 'Zìdòng tuōguǎn duìjú',
    '请输入4位房间号:': 'Qǐng shūrù 4 wèi fángjiānhào:',
    '请输入你的玩家昵称 (最多8字):': 'Qǐng shūrù wánjiā nǐchēng (Zuìduō 8 zì):',
    '加入房间失败: ': 'Jiārù fángjiān shībài: ',

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

    // ログ文
    '新局开始，': 'Xīnjú kāishǐ, ',
    '起家': 'qǐjiā',
    '[杠]': '[Gàng]',
    '先打缺门牌': 'Xiān dǎ quēmén pái',
    '已胡牌只能打摸牌': 'Yǐ hú pái zhǐ néng dǎ mōpái',
    '红中为万能牌，不能作为换三张牌打出': 'Hóngzhōng bù néng huàn sān zhāng',
    '红中不能换三张': 'Hóngzhōng bù néng huàn sān zhāng',
    '已选换牌，等待中...': 'Yǐ xuǎn huànpái, děngdài zhōng...',
    '已选换牌': 'yǐ xuǎn huànpái',
    '换三张完成': 'Huàn sān zhāng wánchéng',
    '已定': 'Yǐ dìng: ',
    '定缺: ': 'Dìngquē: ',
    '定缺:': 'Dìngquē:',
    '，等待中...': ', děngdài zhōng...',
    '系统就绪。': 'Xìtǒng jiùxù.',
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
    ' 打 ': ' dǎ ',
    ' 碰 ': ' pèng ',
    ' 暗杠 ': ' àngàng ',
    ' 明杠 ': ' mínggàng ',
    ' 补杠 ': ' bǔgàng '
};

class I18nHelper {
    // 言語: 'JA' (日本語) / 'ZH' (中国語)
    static lang = 'JA';
    // 表記モード: false (漢字/通常) / true (ピンイン表示)
    static isPinyin = false;

    static _sortedJaKeys = null;
    static _sortedPyKeys = null;

    // 後方互換用ゲッター/セッター
    static get langMode() {
        return this.isPinyin ? 'PINYIN' : this.lang;
    }

    static set langMode(val) {
        if (val === 'PINYIN') {
            this.isPinyin = true;
        } else {
            this.isPinyin = false;
            this.lang = val || 'JA';
        }
    }

    static get sortedJaKeys() {
        if (!this._sortedJaKeys) {
            this._sortedJaKeys = Object.keys(JA_DICT).sort((a, b) => b.length - a.length);
        }
        return this._sortedJaKeys;
    }

    static get sortedPyKeys() {
        if (!this._sortedPyKeys) {
            this._sortedPyKeys = Object.keys(PINYIN_DICT).sort((a, b) => b.length - a.length);
        }
        return this._sortedPyKeys;
    }

    // 言語切替 (JA ↔ ZH)
    static toggleLanguage() {
        this.lang = (this.lang === 'JA') ? 'ZH' : 'JA';
        return this.lang;
    }

    // 表記切替 (漢字 ↔ ピンイン)
    static togglePinyin() {
        this.isPinyin = !this.isPinyin;
        return this.isPinyin;
    }

    static t(text) {
        if (!text) return text;

        // ピンイン表記が有効な場合
        if (this.isPinyin) {
            if (PINYIN_DICT[text]) return PINYIN_DICT[text];
            let res = String(text)
                .replace(/(\d+)\s*番/g, ' $1 fān')
                .replace(/(\d+)\s*分/g, ' $1 fēn')
                .replace(/(\d+)\s*根/g, ' $1 gēn')
                .replace(/(\d+)\s*张/g, ' $1 zhāng')
                .replace(/(\d+)\s*位/g, ' $1 wèi')
                .replace(/(\d+)\s*次/g, ' $1 cì');

            for (const k of this.sortedPyKeys) {
                if (res.includes(k)) {
                    res = res.split(k).join(PINYIN_DICT[k]);
                }
            }

            return res
                .replace(/\)(Quē|quē|Wánjiā|Diànnǎo|Fángzhǔ|qǐjiā)/g, ') $1')
                .replace(/(\d+)\s*(fān|fēn|gēn|zhāng|wèi|cì)\b/g, '$1 $2')
                .replace(/\(\s+/g, '(')
                .replace(/\s+\)/g, ')')
                .replace(/，/g, ', ')
                .replace(/、/g, ', ')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }

        // 日本語モードの場合
        if (this.lang === 'JA') {
            if (JA_DICT[text]) return JA_DICT[text];
            let res = String(text);
            for (const k of this.sortedJaKeys) {
                if (res.includes(k)) {
                    res = res.split(k).join(JA_DICT[k]);
                }
            }
            return res;
        }

        // 中国語モードの場合 (原文)
        return text;
    }
}

// 互換性用エイリアス
const PinyinHelper = I18nHelper;
