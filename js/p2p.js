/**
 * 紅中血流成河麻雀 - WebRTC P2P 通信マネージャー (P2PManager)
 */
class P2PManager {
    constructor() { this.reset(); }
    _gen = () => String(Math.floor(1000 + Math.random() * 9000));

    reset() {
        try { if (this.peer && !this.peer.destroyed) this.peer.destroy(); } catch (e) {}
        Object.assign(this, { peer: null, myPeerId: null, hostConn: null, roomCode: null, isHost: false, seatIndex: 0, connections: {}, _joinResolve: null, _joinReject: null });
        this.playersInfo = Array.from({ length: 4 }, (_, i) => ({ id: i, name: `${i + 1}P`, isAI: i !== 0, peerId: null }));
    }

    initPeer(customId = null) {
        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') return reject(new Error('PeerJS未加载'));
            try { if (this.peer && !this.peer.destroyed) this.peer.destroy(); } catch (e) {}

            const id = customId || ('hz' + (this.roomCode || this._gen()));
            const iceConfig = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            };

            try { this.peer = new Peer(id, { debug: 1, config: iceConfig }); } catch (err) { return reject(err); }

            this.peer.once('open', peerId => { this.myPeerId = peerId; resolve(peerId); });
            this.peer.once('error', err => {
                if (err.type === 'unavailable-id') {
                    const code = this._gen();
                    this.roomCode = code;
                    return this.initPeer('hz' + code).then(resolve).catch(reject);
                }
                reject(err);
            });
            this.peer.on('connection', conn => this._handleConn(conn));
        });
    }

    async createRoom(code = null, hostName = null) {
        this.reset();
        const code4 = code || this._gen();
        Object.assign(this, { roomCode: code4, isHost: true });
        const name = hostName || '1P (房主)';
        this.playersInfo[0] = { id: 0, name, isAI: false, peerId: 'hz' + code4 };
        this._updateUI(code4, '(房主)');

        try {
            const actualId = await this.initPeer('hz' + code4);
            this.roomCode = actualId.replace(/^hz/, '');
            this._updateUI(this.roomCode);
            return this.roomCode;
        } catch (e) { return code4; }
    }

    async joinRoom(targetCode, savedSeat = null, playerName = null) {
        this.reset();
        const code = String(targetCode).trim().replace(/^hz/, '');
        await this.initPeer();
        Object.assign(this, { isHost: false, roomCode: code });

        return new Promise((resolve, reject) => {
            const conn = this.peer.connect('hz' + code, { reliable: true });
            this.hostConn = conn;
            const timeout = setTimeout(() => {
                reject(new Error('连接超时：请确认房间号是否正确，且房主正在同一房间内'));
            }, 12000);

            this._joinResolve = () => { clearTimeout(timeout); resolve(); };
            this._joinReject = err => { clearTimeout(timeout); reject(err); };

            conn.once('open', () => {
                conn.send({ type: 'JOIN_REQ', peerId: this.myPeerId, seatIndex: savedSeat, playerName });
            });
            conn.on('data', data => this._handleHostMsg(data));
            conn.on('close', () => window.UIController?.log('与房主的连接已断开。'));
            conn.once('error', err => { clearTimeout(timeout); reject(err); });
        });
    }

    _updateUI(code, role = null) {
        const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.innerText = val; };
        set('room-code-display', code);
        set('room-role-display', role);
    }

    _handleConn(conn) {
        this.connections[conn.peer] = conn;
        conn.on('open', () => { this.connections[conn.peer] = conn; });
        conn.on('data', data => {
            const H = {
                JOIN_REQ: () => {
                    const valid = (data.seatIndex > 0 && data.seatIndex < 4) ? this.playersInfo[data.seatIndex] : null;
                    const seat = (valid && (valid.isAI || valid.peerId === conn.peer)) ? valid : this.playersInfo.find(p => p.id > 0 && p.isAI);
                    if (seat) {
                        const displayName = data.playerName || `${seat.id + 1}P`;
                        Object.assign(seat, { isAI: false, peerId: conn.peer, name: displayName });
                        if (window.gameController?.state?.players?.[seat.id]) {
                            const p = window.gameController.state.players[seat.id];
                            p.name = displayName;
                            p.swapTiles = [];
                            p.que = null;
                        }
                        conn.send({ type: 'JOIN_RES', success: true, seatIndex: seat.id, playersInfo: this.playersInfo });
                        this.broadcastRoomInfo();
                        window.UIController?.log(`${seat.name} 已成功连接加入。`);
                        if (window.gameController?.state) this.broadcastState(window.gameController.state);
                    } else conn.send({ type: 'JOIN_RES', success: false, message: '房间已满员' });
                },
                ACTION_REQUEST: () => {
                    const pIdx = data.playerIndex >= 0 ? data.playerIndex : this.playersInfo.find(p => p.peerId === conn.peer)?.id;
                    this.onActionReceived?.(pIdx, data.action, data.payload);
                }
            };
            H[data?.type]?.();
        });
        conn.on('close', () => {
            delete this.connections[conn.peer];
            setTimeout(() => {
                const p = !Object.values(this.connections).some(c => c?.peer === conn.peer) && this.playersInfo.find(x => x.peerId === conn.peer);
                if (p) {
                    Object.assign(p, { isAI: true, peerId: null, name: `${p.id + 1}P` });
                    if (window.gameController?.state?.players?.[p.id]) window.gameController.state.players[p.id].name = `${p.id + 1}P (电脑)`;
                    this.broadcastRoomInfo();
                }
            }, 4000);
        });
    }

    _handleHostMsg(data) {
        const H = {
            JOIN_RES: () => {
                if (data.success) {
                    this.seatIndex = data.seatIndex;
                    this.playersInfo = data.playersInfo;
                    this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
                    window.UIController?.log(`已成功加入房间 (${this.playersInfo[this.seatIndex]?.name || (this.seatIndex + 1) + 'P'})`);
                    this._joinResolve?.();
                } else {
                    const msg = data.message || '加入失败';
                    alert(msg);
                    this._joinReject?.(new Error(msg));
                }
            },
            ROOM_INFO: () => { this.playersInfo = data.playersInfo; this.onRoomUpdate?.(this.playersInfo, this.seatIndex); },
            SYNC_STATE: () => this.onStateReceived?.(data.state),
            PROMPT_OFFTURN_ACTION: () => this.onPromptReceived?.(data.options)
        };
        H[data?.type]?.();
    }

    broadcastRoomInfo() {
        if (!this.isHost) return;
        this.broadcast({ type: 'ROOM_INFO', playersInfo: this.playersInfo });
        this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
    }

    broadcastState(state) {
        if (!this.isHost) return;
        this.broadcast({
            type: 'SYNC_STATE',
            state: {
                phase: state.phase, gameSeed: state.gameSeed, currentTurn: state.currentTurn, startPlayer: state.startPlayer,
                wallCount: state.remainingWall, lastDiscard: state.lastDiscard,
                lastActionIsGang: state.lastActionIsGang, lastGangPlayer: state.lastGangPlayer,
                logs: state.logs || [],
                players: state.players.map(p => ({
                    id: p.id, name: p.name, score: p.score, que: p.que, isHu: p.isHu,
                    huRecords: p.huRecords, melds: p.melds, discards: p.discards, handCount: p.hand?.length || 0, hand: p.hand
                }))
            }
        });
    }

    sendToSeat(seatIndex, data) {
        if (!this.isHost) return false;
        const target = this.playersInfo[seatIndex];
        const conn = target?.peerId && this.connections[target.peerId];
        if (conn?.open) { try { conn.send(data); return true; } catch (e) {} }
        return false;
    }

    broadcast = data => Object.values(this.connections).forEach(c => { if (c?.open) c.send(data); });

    sendAction(action, payload = {}) {
        if (!this.isHost && this.hostConn?.open) this.hostConn.send({ type: 'ACTION_REQUEST', playerIndex: this.seatIndex, action, payload });
    }
}

const p2pManager = new P2PManager();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { P2PManager, p2pManager };
}
