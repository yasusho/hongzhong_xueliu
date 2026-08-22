class P2PManager {
    constructor() { this.reset(); }

    _generateRoomCode() { return String(Math.floor(1000 + Math.random() * 9000)); }

    reset() {
        try { if (this.peer && !this.peer.destroyed) this.peer.destroy(); } catch (e) {}
        this.peer = null;
        this.myPeerId = null;
        this.hostConn = null;
        this.roomCode = null;
        this.isHost = false;
        this.seatIndex = 0;
        this.connections = {};
        this._joinResolve = null;
        this._joinReject = null;
        this.playersInfo = Array.from({ length: 4 }, (_, i) => ({
            id: i, name: `${i + 1}P`, isAI: i !== 0, peerId: null
        }));
    }

    initPeer(customId = null) {
        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') return reject(new Error('PeerJS未加载'));
            try { if (this.peer && !this.peer.destroyed) this.peer.destroy(); } catch (e) {}

            const id = customId || ('hz_c_' + Math.random().toString(36).slice(2, 9));
            const iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] };

            try {
                this.peer = new Peer(id, { debug: 1, config: iceConfig });
            } catch (err) {
                return reject(err);
            }

            this.peer.once('open', peerId => { this.myPeerId = peerId; resolve(peerId); });
            this.peer.once('error', err => {
                if (err.type === 'unavailable-id' && this.isHost) {
                    const newCode = this._generateRoomCode();
                    this.roomCode = newCode;
                    if (this.playersInfo?.[0]) this.playersInfo[0].peerId = 'hz' + newCode;
                    this._updateRoomUI(newCode, '(房主)');
                    return this.initPeer('hz' + newCode).then(resolve).catch(reject);
                }
                reject(err);
            });
            this.peer.on('connection', conn => this._handleIncomingConnection(conn));
        });
    }

    async createRoom(customCode = null, hostName = null) {
        this.reset();
        const code = customCode || this._generateRoomCode();
        this.roomCode = code;
        this.isHost = true;
        this.seatIndex = 0;

        const displayName = hostName || '1P (房主)';
        this.playersInfo[0] = { id: 0, name: displayName, isAI: false, peerId: 'hz' + code };
        this._updateRoomUI(code, '(房主)');

        try {
            const actualPeerId = await this.initPeer('hz' + code);
            this.roomCode = actualPeerId.replace(/^hz/, '');
            this._updateRoomUI(this.roomCode, '(房主)');
            return this.roomCode;
        } catch (e) {
            return code;
        }
    }

    async joinRoom(targetCode, savedSeat = null, playerName = null) {
        this.reset();
        const cleanCode = String(targetCode).trim().replace(/^hz/, '');
        await this.initPeer('hz_c_' + Math.random().toString(36).slice(2, 9));

        this.isHost = false;
        this.roomCode = cleanCode;

        return new Promise((resolve, reject) => {
            const conn = this.peer.connect('hz' + cleanCode, { reliable: true });
            this.hostConn = conn;

            const timeout = setTimeout(() => reject(new Error('连接超时：请确认房间号是否正确')), 12000);
            this._joinResolve = () => { clearTimeout(timeout); resolve(); };
            this._joinReject = err => { clearTimeout(timeout); reject(err); };

            conn.once('open', () => {
                conn.send({ type: 'JOIN_REQ', peerId: this.myPeerId, seatIndex: savedSeat, playerName });
            });
            conn.on('data', data => this._handleHostMessage(data));
            conn.on('close', () => {
                try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('hz_session'); } catch (e) {}
                this._log('与房主断开连接');
            });
            conn.once('error', err => { clearTimeout(timeout); reject(err); });
        });
    }

    _log(msg) {
        const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
        ctrl?.log ? ctrl.log(msg) : UIController.log(msg);
    }

    _updateRoomUI(roomCode, roleLabel = null) {
        const c = UIController.$('room-code-display');
        const r = UIController.$('room-role-display');
        if (c && roomCode != null) c.innerText = roomCode;
        if (r && roleLabel != null) r.innerText = roleLabel;
    }

    _handleIncomingConnection(conn) {
        this.connections[conn.peer] = conn;
        conn.on('open', () => { this.connections[conn.peer] = conn; });

        conn.on('data', data => {
            if (!data) return;
            if (data.type === 'JOIN_REQ') {
                const reqSeat = Number(data.seatIndex);
                const cand = (reqSeat > 0 && reqSeat < 4) ? this.playersInfo[reqSeat] : null;
                const seat = (cand && (cand.isAI || cand.peerId === conn.peer)) ? cand : this.playersInfo.find(p => p.id > 0 && p.isAI);

                if (seat) {
                    const name = data.playerName || `${seat.id + 1}P`;
                    seat.isAI = false;
                    seat.peerId = conn.peer;
                    seat.name = name;
                    this.connections[conn.peer] = conn;

                    const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
                    if (ctrl?.state?.players?.[seat.id]) {
                        const target = ctrl.state.players[seat.id];
                        target.name = name;
                        target.swapTiles = [];
                        target.que = null;
                    }

                    conn.send({ type: 'JOIN_RES', success: true, seatIndex: seat.id, playersInfo: this.playersInfo });
                    this.broadcastRoomInfo();
                    this._log(`${seat.id + 1}P 进入房间`);
                    if (ctrl?.state) this.broadcastState(ctrl.state);
                } else {
                    conn.send({ type: 'JOIN_RES', success: false, message: '房间已满员' });
                }
            } else if (data.type === 'ACTION_REQUEST') {
                const pIdx = Number(data.playerIndex >= 0 ? data.playerIndex : this.playersInfo.find(p => p.peerId === conn.peer)?.id);
                this.onActionReceived?.(pIdx, data.action, data.payload);
            }
        });

        conn.on('close', () => {
            delete this.connections[conn.peer];
            setTimeout(() => {
                const active = Object.values(this.connections).some(c => c?.peer === conn.peer);
                const player = !active && this.playersInfo.find(x => x.peerId === conn.peer);
                if (player) {
                    player.isAI = true;
                    player.peerId = null;
                    player.name = `${player.id + 1}P`;
                    const ctrl = (typeof window !== 'undefined') ? window.gameController : null;
                    if (ctrl?.handlePlayerDisconnect) ctrl.handlePlayerDisconnect(player.id);
                    this.broadcastRoomInfo();
                    this._log(`${player.id + 1}P 离线 (电脑托管)`);
                    if (ctrl?.state) this.broadcastState(ctrl.state);
                }
            }, 1000);
        });
    }

    _handleHostMessage(data) {
        if (!data) return;
        const map = {
            JOIN_RES: () => {
                if (data.success) {
                    this.seatIndex = Number(data.seatIndex);
                    this.playersInfo = data.playersInfo;
                    this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
                    this._log(`已加入房间 (${this.seatIndex + 1}P)`);
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
        map[data.type]?.();
    }

    broadcastRoomInfo() {
        if (!this.isHost) return;
        this.broadcast({ type: 'ROOM_INFO', playersInfo: this.playersInfo });
        this.onRoomUpdate?.(this.playersInfo, this.seatIndex);
    }

    broadcastState(state) {
        if (!this.isHost || !state) return;
        const sanitizedPlayers = (state.players || []).map(p => ({
            id: p.id, name: p.name, score: p.score, que: p.que, isHu: p.isHu,
            isEliminated: Boolean(p.isEliminated),
            huRecords: p.huRecords ? [...p.huRecords] : [],
            melds: p.melds ? [...p.melds] : [],
            discards: p.discards ? [...p.discards] : [],
            handCount: p.hand?.length || 0,
            hand: p.hand ? [...p.hand] : []
        }));

        this.broadcast({
            type: 'SYNC_STATE',
            state: {
                phase: state.phase, gameSeed: state.gameSeed, currentTurn: state.currentTurn,
                startPlayer: state.startPlayer, wallCount: state.remainingWall,
                lastDiscard: state.lastDiscard ? { ...state.lastDiscard, tile: { ...state.lastDiscard.tile } } : null,
                lastActionIsGang: state.lastActionIsGang, lastGangPlayer: state.lastGangPlayer,
                logs: state.logs || [], settlementLogs: state.settlementLogs || [],
                players: sanitizedPlayers
            }
        });
    }

    sendToSeat(seatIndex, data) {
        if (!this.isHost) return false;
        const target = this.playersInfo[seatIndex];
        if (!target || target.isAI) return false;
        const conn = (target.peerId && this.connections[target.peerId]) || Object.values(this.connections).find(c => c?.peer === target.peerId);
        if (conn) {
            try { conn.send(data); return true; } catch (e) {}
        }
        return false;
    }

    broadcast(data) {
        Object.values(this.connections).forEach(conn => { try { conn?.send(data); } catch (e) {} });
    }

    sendAction(action, payload = {}) {
        if (!this.isHost && this.hostConn) {
            try {
                this.hostConn.send({ type: 'ACTION_REQUEST', playerIndex: this.seatIndex, action, payload });
            } catch (e) {}
        }
    }
}

const p2pManager = new P2PManager();

if (typeof window !== 'undefined') {
    window.P2PManager = P2PManager;
    window.p2pManager = p2pManager;
}
