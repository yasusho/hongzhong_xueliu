/**
 * 紅中血流成河麻雀 - UI描画・表示管理 (UIController)
 */
class UIController {
    static init() {
        this.wallNumEl = document.getElementById('wall-num');
        this.cmdLogEl = document.getElementById('cmd-log');
        this.tingInfoEl = document.getElementById('ting-info');
        this.tingListEl = document.getElementById('ting-list');
        this.cmdBoxEl = document.getElementById('cmd-box');
        this.autoHuMsgEl = document.getElementById('auto-hu-msg');
        this.instructionBoxEl = document.getElementById('phase-instruction');
        this.instructionTitleEl = document.getElementById('instruction-title');
        this.instructionDescEl = document.getElementById('instruction-desc');
        this.instructionOptionsEl = document.getElementById('instruction-options');
        this.resultModalEl = document.getElementById('result-modal');
        this.resultRanksEl = document.getElementById('result-ranks');
        this.resultPenaltiesEl = document.getElementById('result-penalties');
        this.mySeatLabelEl = document.getElementById('my-seat-label');
        this.mySectionEl = document.querySelector('.my-section');
        this.opponentsTbodyEl = document.getElementById('opponents-tbody');
        this.riverContainerEl = document.getElementById('river-container');
    }

    /**
     * 全体のデータ駆動描画
     */
    static render(state, mySeat = 0) {
        if (!this.wallNumEl) this.init();
        if (this.wallNumEl) this.wallNumEl.innerText = state.wall ? state.wall.length : (state.wallCount || 0);

        const isQueAnnounced = (state.phase === CONFIG.PHASES.PLAYING || state.phase === CONFIG.PHASES.END);

        // 1. 対戦相手3名の描画
        const opponentIndices = [1, 2, 3].map(offset => (mySeat + offset) % CONFIG.TOTAL_PLAYERS);
        if (this.opponentsTbodyEl) {
            this.opponentsTbodyEl.innerHTML = '';
            opponentIndices.forEach(pIdx => {
                const player = state.players[pIdx];
                if (!player) return;

                const tr = document.createElement('tr');
                const isTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === pIdx);
                if (isTurn) tr.classList.add('turn-active');

                // 玩家名
                const tdName = document.createElement('td');
                tdName.innerText = `${player.name}${isTurn ? ' [手番]' : ''}`;

                // 積分
                const tdScore = document.createElement('td');
                tdScore.innerText = player.score;

                // 定缺/状態
                const tdStatus = document.createElement('td');
                if (isQueAnnounced && player.que) {
                    const spanQue = document.createElement('span');
                    spanQue.className = 'tag-que';
                    spanQue.innerText = `缺${CONFIG.SUITS[player.que]} `;
                    tdStatus.appendChild(spanQue);
                }
                if (player.isHu) {
                    const spanHu = document.createElement('span');
                    spanHu.className = 'tag-hu';
                    spanHu.innerText = `已胡${player.huRecords.length}`;
                    tdStatus.appendChild(spanHu);
                }

                // 副露
                const tdMelds = document.createElement('td');
                this.renderMelds(tdMelds, player.melds, 'small');

                tr.appendChild(tdName);
                tr.appendChild(tdScore);
                tr.appendChild(tdStatus);
                tr.appendChild(tdMelds);
                this.opponentsTbodyEl.appendChild(tr);
            });
        }

        // 2. 河（棄牌）の描画（他家3名 + 自家）
        if (this.riverContainerEl) {
            this.riverContainerEl.innerHTML = '';
            const allIndices = [...opponentIndices, mySeat];
            allIndices.forEach(pIdx => {
                const player = state.players[pIdx];
                if (!player) return;

                const row = document.createElement('div');
                row.className = 'river-row';

                const label = document.createElement('span');
                label.className = 'river-label';
                label.innerText = `${player.name}:`;

                const tilesDiv = document.createElement('span');
                tilesDiv.className = 'river-tiles';
                this.renderDiscards(tilesDiv, player.discards, state.lastDiscard);

                row.appendChild(label);
                row.appendChild(tilesDiv);
                this.riverContainerEl.appendChild(row);
            });
        }

        // 3. 自分の情報・手牌の描画
        const myPlayer = state.players[mySeat];
        if (myPlayer) {
            const isMyTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === mySeat);
            if (this.mySectionEl) {
                this.mySectionEl.classList.toggle('turn-active', isMyTurn);
            }
            if (this.mySeatLabelEl) {
                this.mySeatLabelEl.innerText = `${myPlayer.name}${isMyTurn ? ' [你的手番]' : ''}`;
            }

            const handScoreEl = document.getElementById('hand-score-0');
            if (handScoreEl) handScoreEl.innerText = myPlayer.score;

            const handQueEl = document.getElementById('hand-que-0');
            if (handQueEl) {
                handQueEl.innerText = (isQueAnnounced && myPlayer.que) ? `缺${CONFIG.SUITS[myPlayer.que]}` : '';
            }

            const huTag0 = document.getElementById('hu-tag-0');
            if (huTag0) huTag0.innerText = myPlayer.isHu ? `已胡${myPlayer.huRecords.length}` : '';

            this.renderHand(myPlayer, state, mySeat);

            if (this.autoHuMsgEl) {
                this.autoHuMsgEl.style.display = (myPlayer.isHu && state.autoPlay) ? 'inline' : 'none';
            }
        }
    }

    /**
     * 副露のレンダリング
     */
    static renderMelds(container, melds, size = 'normal') {
        container.innerHTML = '';
        if (!melds || melds.length === 0) {
            if (size === 'small') container.innerText = '-';
            return;
        }

        melds.forEach(m => {
            const group = document.createElement('span');
            group.className = 'meld-group';
            const count = m.type === 'PUNG' ? 3 : 4;
            for (let i = 0; i < count; i++) {
                const tileEl = this.createTileElement(m.tile);
                if (size === 'small') tileEl.classList.add('tile-small');
                group.appendChild(tileEl);
            }
            container.appendChild(group);
        });
    }

    /**
     * 自分の手牌レンダリング
     */
    static renderHand(player, state, mySeat = 0) {
        const handDiv = document.getElementById('hand-0');
        const meldsDiv = document.getElementById('melds-0');
        if (!handDiv || !meldsDiv) return;

        handDiv.innerHTML = '';
        this.renderMelds(meldsDiv, player.melds, 'normal');

        const isMyTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === mySeat);
        const isMyTurnDrawn = (isMyTurn && player.hand.length % 3 === 2);
        const isQueAnnounced = (state.phase === CONFIG.PHASES.PLAYING || state.phase === CONFIG.PHASES.END);
        const hasQueTiles = isQueAnnounced && player.hand.some(t => t.suit === player.que);

        player.hand.forEach((tile, index) => {
            // ツモ牌の区切り
            if (isMyTurnDrawn && index === player.hand.length - 1) {
                const spacer = document.createElement('span');
                spacer.className = 'tsumo-divider';
                handDiv.appendChild(spacer);
            }

            const el = this.createTileElement(tile);

            if (state.phase === CONFIG.PHASES.SWAP3) {
                if (state.selectedSwapIndices && state.selectedSwapIndices.includes(index)) {
                    el.classList.add('selected');
                }
                el.classList.add('tile-playable');
            } else if (state.phase === CONFIG.PHASES.PLAYING) {
                if (isQueAnnounced && tile.suit === player.que) {
                    el.classList.add('is-que');
                }

                if (isMyTurn) {
                    if (hasQueTiles) {
                        if (tile.suit === player.que) el.classList.add('tile-playable');
                        else el.classList.add('tile-disabled');
                    } else {
                        el.classList.add('tile-playable');
                    }
                } else {
                    el.classList.add('tile-disabled');
                }
            }

            el.onclick = () => {
                const ctrl = window.gameController || (typeof gameController !== 'undefined' ? gameController : null);
                if (ctrl) ctrl.handleTileClick(index);
            };
            handDiv.appendChild(el);
        });
    }

    /**
     * 捨牌（河）のレンダリング
     */
    static renderDiscards(container, discards, lastDiscard) {
        container.innerHTML = '';
        if (!discards) return;

        discards.forEach(tile => {
            const el = this.createTileElement(tile);
            el.classList.add('tile-river');
            if (lastDiscard && lastDiscard.tile && lastDiscard.tile.id === tile.id) {
                el.classList.add('latest');
            }
            container.appendChild(el);
        });
    }

    static createTileElement(tile) {
        const img = document.createElement('img');
        img.className = 'tile-img';
        img.src = MahjongEngine.tileToSvgPath(tile);
        img.alt = MahjongEngine.tileToString(tile);
        img.draggable = false;
        return img;
    }

    static log(text) {
        if (!this.cmdLogEl) this.init();
        if (!this.cmdLogEl) return;
        const div = document.createElement('div');
        div.innerText = `> ${text}`;
        this.cmdLogEl.appendChild(div);
        this.cmdLogEl.scrollTop = this.cmdLogEl.scrollHeight;
    }

    static clearLog(text = '系统就绪。') {
        if (!this.cmdLogEl) this.init();
        if (this.cmdLogEl) {
            this.cmdLogEl.innerHTML = `<div>> ${text}</div>`;
        }
    }

    static updateTingPanel(player) {
        if (!this.tingInfoEl) this.init();
        const tingTiles = MahjongEngine.getTingTiles(player);

        if (tingTiles.length > 0) {
            this.tingInfoEl.style.display = 'inline-flex';
            this.tingListEl.innerHTML = '';
            tingTiles.forEach(tile => {
                const el = this.createTileElement(tile);
                el.classList.add('tile-ting');
                this.tingListEl.appendChild(el);
            });
        } else {
            this.tingInfoEl.style.display = 'none';
        }
    }

    static showInstruction(title, desc, optionsHtml) {
        if (!this.instructionBoxEl) this.init();
        this.instructionTitleEl.innerText = title;
        this.instructionDescEl.innerText = desc;
        this.instructionOptionsEl.innerHTML = optionsHtml;
        this.instructionBoxEl.style.display = 'flex';
    }

    static hideInstruction() {
        if (this.instructionBoxEl) {
            this.instructionBoxEl.style.display = 'none';
        }
    }

    static showActionBox(showHu, showGang, showPung, onHu, onGang, onPung, onPass) {
        if (!this.cmdBoxEl) this.init();
        const btnHu = document.getElementById('btn-hu');
        const btnGang = document.getElementById('btn-gang');
        const btnPung = document.getElementById('btn-pung');
        const btnPass = document.getElementById('btn-pass');

        this.cmdBoxEl.style.display = 'inline-flex';
        btnHu.style.display = showHu ? 'inline-block' : 'none';
        btnGang.style.display = showGang ? 'inline-block' : 'none';
        btnPung.style.display = showPung ? 'inline-block' : 'none';

        btnHu.onclick = onHu;
        btnGang.onclick = onGang;
        btnPung.onclick = onPung;
        btnPass.onclick = onPass;
    }

    static hideActionBox() {
        if (this.cmdBoxEl) {
            this.cmdBoxEl.style.display = 'none';
        }
    }

    static showResultModal(players, penaltyLogs = []) {
        if (!this.resultModalEl) this.init();
        const sorted = [...players].sort((a, b) => b.score - a.score);
        this.resultRanksEl.innerHTML = sorted.map((p, idx) => `
            <div style="display:flex; justify-content:space-between; margin:6px 0; font-size:14px;">
                <span>${idx + 1}位 ${p.name}</span>
                <span><b>${p.score}分</b> 胡${p.huRecords.length}</span>
            </div>
        `).join('');

        if (this.resultPenaltiesEl) {
            if (penaltyLogs.length > 0) {
                this.resultPenaltiesEl.innerHTML = `<b style="display:block;margin-top:4px;">清算:</b>` + penaltyLogs.map(l => `・${l}`).join('<br>');
                this.resultPenaltiesEl.style.display = 'block';
            } else {
                this.resultPenaltiesEl.innerHTML = '';
                this.resultPenaltiesEl.style.display = 'none';
            }
        }

        this.resultModalEl.style.display = 'flex';
    }

    static hideResultModal() {
        if (this.resultModalEl) {
            this.resultModalEl.style.display = 'none';
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
