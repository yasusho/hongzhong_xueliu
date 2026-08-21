/**
 * 紅中血流成河麻雀 - WebRTC P2P 通信マネージャー (P2PManager)
 */
class P2PManager {
    constructor() {
        this.reset();
    }

    _gen = () => String(Math.floor(1000 + Math.random() * 9000));

    reset() {
        try {
            if (this.peer && !this.peer.destroyed) this.peer.destroy();
        } catch (e) {}
        Object.assign(this, {
            peer: null,
            myPeerId: null,
            hostConn: null,
            roomCode: null,
            isHost: false,
            seatIndex: 0,
            connections: {},
            _joinResolve: null,
            _joinReject: null
        });
        this.playersInfo = Array.from({ length: 4 }, (_, i) => ({
            id: i,
            name: `${i + 1}P`,
            isAI: i !== 0,
            peerId: null
        }));
    }

    initPeer(customId = null) {
        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') return reject(new Error('PeerJS未加载'));
            try {
                if (this.peer && !this.peer.destroyed) this.peer.destroy();
            } catch (e) {}

            const id = customId || ('hz_c_' + Math.random().toString(36).slice(2, 9));
            const iceConfig = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            };

            try {
                this.peer = new Peer(id, { debug: 1, config: iceConfig });
            } catch (err) {
                return reject(err);
            }

            this.peer.once('open', peerId => {
                this.myPeerId = peerId;
                resolve(peerId);
            });

            this.peer.once('error', err => {
                if (err.type === 'unavailable-id' && this.isHost) {
                    const newCode = this._gen();
                    this.roomCode = newCode;
                    if (this.playersInfo?.[0]) this.playersInfo[0].peerId = 'hz' + newCode;
                    this._updateUI(newCode, '(房主)');
                    return this.initPeer('hz' + newCode).then(resolve).catch(reject);
                }
                reject(err);
            });

            this.peer.on('connection', conn => this._handleConn(conn));
        });
    }

    async createRoom(code = null, hostName = null) {
        this.reset();
        const code4 = code || this._gen();
        Object.assign(this, { roomCode: code4, isHost: true, seatIndex: 0 });
        const name = hostName || '1P (房主)';
        this.playersInfo[0] = { id: 0, name, isAI: false, peerId: 'hz' + code4 };
        this._updateUI(code4, '(房主)');

        try {
            const actualId = await this.initPeer('hz' + code4);
            this.roomCode = actualId.replace(/^hz/, '');
            this._updateUI(this.roomCode, '(房主)');
            return this.roomCode;
        } catch (e) {
            return code4;
        }
    }

    async joinRoom(targetCode, savedSeat = null, playerName = null) {
        this.reset();
        const code = String(targetCode).trim().replace(/^hz/, '');
        const clientPeerId = 'hz_c_' + Math.random().toString(36).slice(2, 9);
        await this.initPeer(clientPeerId);
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
            conn.on('close', () => {
                try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('hz_session'); } catch (e) {}
                this._log('与房主的连接已断开。');
            });
            conn.once('error', err => { clearTimeout(timeout); reject(err); });
        });
    }

    _log(msg) {
        if (typeof window !== 'undefined') {
            if (window.gameController) window.gameController.log(msg);
            else window.UIController?.log(msg);
        }
    }

    _updateUI(code, role = null) {
        if (typeof document === 'undefined') return;
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null) el.innerText = val;
        };
        set('room-code-display', code);
        set('room-role-display', role);
    }

    _handleConn(conn) {
        this.connections[conn.peer] = conn;
        conn.on('open', () => { this.connections[conn.peer] = conn; });
        conn.on('data', data => {
            const handlers = {
                JOIN_REQ: () => {
                    const reqSeat = Number(data.seatIndex);
                    const valid = (reqSeat > 0 && reqSeat < 4) ? this.playersInfo[reqSeat] : null;
                    const seat = (valid && (valid.isAI || valid.peerId === conn.peer)) ? valid : this.playersInfo.find(p => p.id > 0 && p.isAI);
                    if (seat) {
                        const displayName = data.playerName || `${seat.id + 1}P`;
                        Object.assign(seat, { isAI: false, peerId: conn.peer, name: displayName });
                        this.connections[conn.peer] = conn;
                        if (window.gameController?.state?.players?.[seat.id]) {
                            const p = window.gameController.state.players[seat.id];
                            p.name = displayName;
                            p.swapTiles = [];
                            p.que = null;
                        }
                        conn.send({ type: 'JOIN_RES', success: true, seatIndex: seat.id, playersInfo: this.playersInfo });
                        this.broadcastRoomInfo();
                        this._log(`${seat.id + 1}P 进入房间`);
                        if (window.gameController?.state) this.broadcastState(window.gameController.state);
                    } else {
                        conn.send({ type: 'JOIN_RES', success: false, message: '房间已满员' });
                    }
                },
                ACTION_REQUEST: () => {
                    const pIdx = Number(data.playerIndex >= 0 ? data.playerIndex : this.playersInfo.find(p => p.peerId === conn.peer)?.id);
                    this.onActionReceived?.(pIdx, data.action, data.payload);
                }
            };
            handlers[data?.type]?.();
        });

        conn.on('close', () => {
            delete this.connections[conn.peer];
            setTimeout(() => {
                const p = !Object.values(this.connections).some(c => c?.peer === conn.peer) && this.playersInfo.find(x => x.peerId === conn.peer);
                if (p) {
                    Object.assign(p, { isAI: true, peerId: null, name: `${p.id + 1}P` });
                    if (window.gameController?.handlePlayerDisconnect) {
                        window.gameController.handlePlayerDisconnect(p.id);
                    } else if (window.gameController?.state?.players?.[p.id]) {
                        window.gameController.state.players[p.id].name = `${p.id + 1}P (电脑)`;
                    }
                    this.broadcastRoomInfo();
                    this._log(`${p.id + 1}P 离线 (电脑托管)`);
                    if (window.gameController?.state) this.broadcastState(window.gameController.state);
                }
            }, 1000);
        });
    }

    _handleHostMsg(data) {
        const handlers = {
            JOIN_RES: () => {
                if (data.success) {
                    this.seatIndex = Number(data.seatIndex);
                    this.playersInfo = data.playersInfo;
                    this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
                    this._log(`已加入房间 (你是 ${this.seatIndex + 1}P)，等待开局...`);
                    this._joinResolve?.();
                } else {
                    const msg = data.message || '加入失败';
                    if (typeof alert !== 'undefined') alert(msg);
                    this._joinReject?.(new Error(msg));
                }
            },
            ROOM_INFO: () => {
                this.playersInfo = data.playersInfo;
                this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
            },
            SYNC_STATE: () => this.onStateReceived?.(data.state),
            PROMPT_OFFTURN_ACTION: () => this.onPromptReceived?.(data.options)
        };
        handlers[data?.type]?.();
    }

    broadcastRoomInfo() {
        if (!this.isHost) return;
        this.broadcast({ type: 'ROOM_INFO', playersInfo: this.playersInfo });
        this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
    }

    broadcastState(state) {
        if (!this.isHost || !state) return;
        this.broadcast({
            type: 'SYNC_STATE',
            state: {
                phase: state.phase,
                gameSeed: state.gameSeed,
                currentTurn: state.currentTurn,
                startPlayer: state.startPlayer,
                wallCount: state.remainingWall,
                lastDiscard: state.lastDiscard ? { ...state.lastDiscard, tile: { ...state.lastDiscard.tile } } : null,
                lastActionIsGang: state.lastActionIsGang,
                lastGangPlayer: state.lastGangPlayer,
                logs: state.logs || [],
                settlementLogs: state.settlementLogs || [],
                players: (state.players || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    score: p.score,
                    que: p.que,
                    isHu: p.isHu,
                    isEliminated: Boolean(p.isEliminated),
                    huRecords: p.huRecords ? JSON.parse(JSON.stringify(p.huRecords)) : [],
                    melds: p.melds ? JSON.parse(JSON.stringify(p.melds)) : [],
                    discards: p.discards ? JSON.parse(JSON.stringify(p.discards)) : [],
                    handCount: p.hand?.length || 0,
                    hand: p.hand ? JSON.parse(JSON.stringify(p.hand)) : []
                }))
            }
        });
    }

    sendToSeat(seatIndex, data) {
        if (!this.isHost) return false;
        const target = this.playersInfo[seatIndex];
        if (!target || target.isAI) return false;
        const conn = (target.peerId && this.connections[target.peerId]) || Object.values(this.connections).find(c => c?.peer === target.peerId);
        if (conn) {
            try {
                conn.send(data);
                return true;
            } catch (e) {}
        }
        return false;
    }

    broadcast = data => Object.values(this.connections).forEach(c => {
        try { c?.send(data); } catch (e) {}
    });

    sendAction(action, payload = {}) {
        if (!this.isHost && this.hostConn) {
            try {
                this.hostConn.send({ type: 'ACTION_REQUEST', playerIndex: this.seatIndex, action, payload });
            } catch (e) {}
        }
    }
}

const p2pManager = new P2PManager();

