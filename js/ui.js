/**
 * 紅中血流成河麻雀 - UI描画・表示管理 (UIController)
 */
class UIController {
    static init() {
        if (this.initialized && typeof document !== 'undefined' && document.getElementById('wall-num')) return;
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
        this.mySectionEl = document.querySelector('.my-section');
        this.opponentsTbodyEl = document.getElementById('opponents-tbody');
        this.riverContainerEl = document.getElementById('river-container');
        this.initialized = true;
    }

    /**
     * 全体のデータ駆動描画
     */
    static render(state, mySeat = 0) {
        this.init();

        const wallCount = (state.wallCount !== undefined) ? state.wallCount : (Array.isArray(state.wall) ? state.wall.length : 0);
        if (this.wallNumEl) this.wallNumEl.innerText = wallCount;
        if (state.logs && this.cmdLogEl) this.renderLogs(state.logs);

        const isQueAnnounced = (state.phase === CONFIG.PHASES.PLAYING || state.phase === CONFIG.PHASES.END);
        const opponentIndices = [1, 2, 3].map(offset => (mySeat + offset) % CONFIG.TOTAL_PLAYERS);

        // 1. 対戦相手3名の描画
        if (this.opponentsTbodyEl) {
            this.opponentsTbodyEl.innerHTML = '';
            opponentIndices.forEach(pIdx => {
                const p = state.players[pIdx];
                if (!p) return;

                const isTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === pIdx);
                const tr = document.createElement('tr');
                if (isTurn) tr.classList.add('turn-active');

                const tdName = document.createElement('td');
                tdName.innerText = `${p.name}${isTurn ? ' [手番]' : ''}`;

                const tdScore = document.createElement('td');
                tdScore.className = 'player-score';
                tdScore.innerText = p.score;

                const tdStatus = document.createElement('td');
                if (isQueAnnounced && p.que) {
                    const spanQue = document.createElement('span');
                    spanQue.className = 'tag-que';
                    spanQue.innerText = `缺${CONFIG.SUITS[p.que]} `;
                    tdStatus.appendChild(spanQue);
                }
                if (p.isHu) {
                    const spanHu = document.createElement('span');
                    spanHu.className = 'tag-hu';
                    spanHu.innerText = `已胡${p.huRecords.length}`;
                    tdStatus.appendChild(spanHu);
                }

                const tdMelds = document.createElement('td');
                this.renderMelds(tdMelds, p.melds, 'small');

                tr.append(tdName, tdScore, tdStatus, tdMelds);
                this.opponentsTbodyEl.appendChild(tr);
            });
        }

        // 2. 河（棄牌）の描画
        if (this.riverContainerEl) {
            this.riverContainerEl.innerHTML = '';
            [...opponentIndices, mySeat].forEach(pIdx => {
                const p = state.players[pIdx];
                if (!p) return;

                const row = document.createElement('div');
                row.className = 'river-row';

                const label = document.createElement('span');
                label.className = 'river-label';
                label.innerText = `${p.name}:`;

                const tilesDiv = document.createElement('span');
                tilesDiv.className = 'river-tiles';
                this.renderDiscards(tilesDiv, p.discards, state.lastDiscard);

                row.append(label, tilesDiv);
                this.riverContainerEl.appendChild(row);
            });
        }

        // 3. 自分の情報・手牌の描画
        const myP = state.players[mySeat];
        if (myP) {
            const isMyTurn = (state.phase === CONFIG.PHASES.PLAYING && state.currentTurn === mySeat);
            if (this.mySectionEl) this.mySectionEl.classList.toggle('turn-active', isMyTurn);

            const scoreEl = document.getElementById('hand-score-0');
            if (scoreEl) scoreEl.innerText = myP.score;

            const queEl = document.getElementById('hand-que-0');
            if (queEl) queEl.innerText = (isQueAnnounced && myP.que) ? `缺${CONFIG.SUITS[myP.que]}` : '';

            const huEl = document.getElementById('hu-tag-0');
            if (huEl) huEl.innerText = myP.isHu ? `已胡${myP.huRecords.length}` : '';

            this.renderHand(myP, state, mySeat);
            if (this.autoHuMsgEl) this.autoHuMsgEl.style.display = (myP.isHu && state.autoPlay) ? 'inline-block' : 'none';
        }
    }

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
                group.appendChild(this.createTileElement(m.tile, size === 'small' ? 'tile-small' : ''));
            }
            container.appendChild(group);
        });
    }

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
            if (isMyTurnDrawn && index === player.hand.length - 1) {
                const spacer = document.createElement('span');
                spacer.className = 'tsumo-divider';
                handDiv.appendChild(spacer);
            }

            const el = this.createTileElement(tile);

            if (state.phase === CONFIG.PHASES.SWAP3) {
                if (state.selectedSwapIndices && state.selectedSwapIndices.includes(index)) el.classList.add('selected');
                el.classList.add('tile-playable');
            } else if (state.phase === CONFIG.PHASES.PLAYING) {
                if (isQueAnnounced && tile.suit === player.que) el.classList.add('is-que');

                if (isMyTurn && isMyTurnDrawn) {
                    if (player.isHu) {
                        el.classList.add(index === player.hand.length - 1 ? 'tile-playable' : 'tile-disabled');
                    } else if (hasQueTiles) {
                        el.classList.add(tile.suit === player.que ? 'tile-playable' : 'tile-disabled');
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

    static renderDiscards(container, discards, lastDiscard) {
        container.innerHTML = '';
        if (!discards) return;
        discards.forEach(tile => {
            const el = this.createTileElement(tile, 'tile-river');
            if (lastDiscard && lastDiscard.tile && lastDiscard.tile.id === tile.id) {
                el.classList.add('latest');
            }
            container.appendChild(el);
        });
    }

    static createTileElement(tile, extraClass = '') {
        const img = document.createElement('img');
        img.className = 'tile-img' + (extraClass ? ` ${extraClass}` : '');
        if (tile) {
            const svgPath = MahjongEngine.tileToSvgPath(tile);
            if (svgPath) img.src = svgPath;
            img.alt = MahjongEngine.tileToString(tile);
        }
        img.draggable = false;
        return img;
    }

    static renderLogs(logs) {
        this.init();
        if (!this.cmdLogEl || !logs) return;
        this.cmdLogEl.innerHTML = logs.map(l => `<div>> ${l}</div>`).join('');
        this.cmdLogEl.scrollTop = this.cmdLogEl.scrollHeight;
    }

    static log(text) {
        this.init();
        if (!this.cmdLogEl) return;
        const div = document.createElement('div');
        div.innerText = `> ${text}`;
        this.cmdLogEl.appendChild(div);
        this.cmdLogEl.scrollTop = this.cmdLogEl.scrollHeight;
    }

    static clearLog(text = '系统就绪。') {
        this.init();
        if (this.cmdLogEl) this.cmdLogEl.innerHTML = `<div>> ${text}</div>`;
    }

    static updateTingPanel(player) {
        this.init();
        if (!this.tingInfoEl || !this.tingListEl) return;
        const tingTiles = MahjongEngine.getTingTiles(player);

        if (tingTiles.length > 0) {
            this.tingInfoEl.style.display = 'inline-flex';
            this.tingListEl.innerHTML = '';
            tingTiles.forEach(tile => this.tingListEl.appendChild(this.createTileElement(tile, 'tile-ting')));
        } else {
            this.tingInfoEl.style.display = 'none';
        }
    }

    static showInstruction(title, desc, optionsHtml) {
        this.init();
        if (!this.instructionBoxEl) return;
        this.instructionTitleEl.innerText = title;
        this.instructionDescEl.innerText = desc;
        this.instructionOptionsEl.innerHTML = optionsHtml;
        this.instructionBoxEl.style.display = 'flex';
    }

    static hideInstruction() {
        if (this.instructionBoxEl) this.instructionBoxEl.style.display = 'none';
    }

    static showActionBox(showHu, showGang, showPung, onHu, onGang, onPung, onPass) {
        this.init();
        const actions = [
            ['btn-hu', showHu, onHu],
            ['btn-gang', showGang, onGang],
            ['btn-pung', showPung, onPung],
            ['btn-pass', true, onPass]
        ];
        actions.forEach(([id, show, handler]) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.style.display = show ? 'inline-block' : 'none';
                btn.onclick = handler;
            }
        });
        if (this.cmdBoxEl) this.cmdBoxEl.style.display = 'inline-flex';
    }

    static hideActionBox() {
        if (this.cmdBoxEl) this.cmdBoxEl.style.display = 'none';
    }

    static showResultModal(players, penaltyLogs = []) {
        this.init();
        if (!this.resultModalEl) return;

        const sorted = [...players].sort((a, b) => b.score - a.score);
        this.resultRanksEl.innerHTML = sorted.map((p, idx) => `
            <div class="result-rank-row">
                <span class="rank-name">${idx + 1}位 ${p.name}</span>
                <span class="rank-score"><b>${p.score}分</b> (胡${p.huRecords.length}次)</span>
            </div>
        `).join('');

        if (this.resultPenaltiesEl) {
            if (penaltyLogs.length > 0) {
                this.resultPenaltiesEl.innerHTML = `<b class="penalties-title">清算明细:</b>` + penaltyLogs.map(l => `<div class="penalty-item">${l}</div>`).join('');
                this.resultPenaltiesEl.style.display = 'block';
            } else {
                this.resultPenaltiesEl.innerHTML = '';
                this.resultPenaltiesEl.style.display = 'none';
            }
        }

        const restartBtn = this.resultModalEl.querySelector('.btn-restart');
        if (restartBtn) {
            const ctrl = window.gameController || (typeof gameController !== 'undefined' ? gameController : null);
            if (ctrl && ctrl.isOnline) {
                restartBtn.innerText = (ctrl.p2p && ctrl.p2p.isHost) ? '再来一局 (房主开始)' : '等待房主再来一局';
                restartBtn.disabled = !(ctrl.p2p && ctrl.p2p.isHost);
                restartBtn.onclick = () => ctrl.startOnlineMatch();
            } else {
                restartBtn.innerText = '再来一局';
                restartBtn.disabled = false;
                restartBtn.onclick = () => { if (ctrl) ctrl.initGame(false); };
            }
        }

        this.resultModalEl.style.display = 'flex';
    }

    static hideResultModal() {
        if (this.resultModalEl) this.resultModalEl.style.display = 'none';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
}
