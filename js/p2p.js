/**
 * 紅中血流成河麻雀 - WebRTC P2P (PeerJS) 通信マネージャー
 */
class P2PManager {
    constructor() {
        this.reset();
        this.onStateReceived = null;
        this.onActionReceived = null;
        this.onRoomUpdate = null;
        this.onPromptReceived = null;
    }

    reset() {
        if (this.peer && !this.peer.destroyed) {
            try { this.peer.destroy(); } catch (e) {}
        }
        this.peer = null;
        this.myPeerId = null;
        this.isHost = false;
        this.connections = {};
        this.hostConn = null;
        this.roomCode = null;
        this.seatIndex = 0;
        this.playersInfo = [
            { id: 0, name: '1P', isAI: false, peerId: null },
            { id: 1, name: '2P', isAI: true, peerId: null },
            { id: 2, name: '3P', isAI: true, peerId: null },
            { id: 3, name: '4P', isAI: true, peerId: null }
        ];
    }

    initPeer(customId = null) {
        return new Promise((resolve, reject) => {
            if (typeof Peer === 'undefined') {
                return reject(new Error('PeerJS库未加载，请检查网络连接'));
            }
            if (this.peer && !this.peer.destroyed) {
                try { this.peer.destroy(); } catch (e) {}
            }

            const id = customId || ('hz' + Math.floor(100000 + Math.random() * 900000));
            try {
                this.peer = new Peer(id, {
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    }
                });
            } catch (err) {
                return reject(err);
            }

            let resolved = false;
            this.peer.on('open', (peerId) => {
                this.myPeerId = peerId;
                resolved = true;
                resolve(peerId);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (!resolved) {
                    resolved = true;
                    if (err.type === 'unavailable-id') {
                        const fallbackId = 'hz' + Math.floor(100000 + Math.random() * 900000);
                        this.initPeer(fallbackId).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                }
            });

            this.peer.on('connection', (conn) => this.handleIncomingConnection(conn));
        });
    }

    async createRoom() {
        this.reset();
        const code4 = String(Math.floor(1000 + Math.random() * 9000));
        const peerId = 'hz' + code4;
        const actualId = await this.initPeer(peerId);
        this.isHost = true;
        this.roomCode = actualId.startsWith('hz') ? actualId.substring(2) : actualId;
        this.seatIndex = 0;
        this.playersInfo[0] = { id: 0, name: '1P (房主)', isAI: false, peerId: actualId };
        return this.roomCode;
    }

    async joinRoom(targetRoomCode) {
        this.reset();
        let code = String(targetRoomCode).trim();
        let targetId = code.startsWith('hz') ? code : ('hz' + code);

        await this.initPeer();
        this.isHost = false;
        this.roomCode = code.startsWith('hz') ? code.substring(2) : code;

        return new Promise((resolve, reject) => {
            const conn = this.peer.connect(targetId, { reliable: true });
            this.hostConn = conn;

            const timeout = setTimeout(() => {
                reject(new Error('连接超时: 未找到对应房间号或房主未在线'));
            }, 10000);

            const onOpen = () => {
                clearTimeout(timeout);
                conn.send({ type: 'JOIN_REQ', peerId: this.myPeerId });
                resolve();
            };

            conn.on('open', onOpen);
            conn.on('data', (data) => this.handleHostMessage(data));
            conn.on('close', () => {
                if (typeof UIController !== 'undefined') UIController.log('房主已断开连接。');
            });
            conn.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    handleIncomingConnection(conn) {
        this.connections[conn.peer] = conn;

        conn.on('open', () => {
            this.connections[conn.peer] = conn;
        });

        conn.on('data', (data) => {
            if (!data || !data.type) return;
            if (data.type === 'JOIN_REQ') {
                const seat = this.playersInfo.find(p => p.id > 0 && p.isAI);
                if (seat) {
                    seat.isAI = false;
                    seat.peerId = conn.peer;
                    seat.name = `${seat.id + 1}P`;
                    conn.send({
                        type: 'JOIN_RES',
                        success: true,
                        seatIndex: seat.id,
                        playersInfo: this.playersInfo
                    });
                    this.broadcastRoomInfo();
                    if (typeof UIController !== 'undefined') UIController.log(`${seat.name} 加入了房间。`);
                } else {
                    conn.send({ type: 'JOIN_RES', success: false, message: '房间已满员' });
                }
            } else if (data.type === 'ACTION_REQUEST') {
                if (this.onActionReceived) {
                    this.onActionReceived(data.playerIndex, data.action, data.payload);
                }
            }
        });

        conn.on('close', () => {
            delete this.connections[conn.peer];
            const p = this.playersInfo.find(x => x.peerId === conn.peer);
            if (p) {
                p.isAI = true;
                p.peerId = null;
                p.name = `${p.id + 1}P (CPU)`;
                this.broadcastRoomInfo();
                if (typeof UIController !== 'undefined') UIController.log(`${p.name} 已离开，切换为CPU代打。`);
            }
        });
    }

    handleHostMessage(data) {
        if (!data || !data.type) return;
        if (data.type === 'JOIN_RES') {
            if (data.success) {
                this.seatIndex = data.seatIndex;
                this.playersInfo = data.playersInfo;
                if (this.onRoomUpdate) this.onRoomUpdate(this.playersInfo, this.seatIndex);
                if (typeof UIController !== 'undefined') UIController.log(`已成功加入房间 (${this.seatIndex + 1}P)`);
            } else {
                alert(data.message || '加入房间失败');
            }
        } else if (data.type === 'ROOM_INFO') {
            this.playersInfo = data.playersInfo;
            if (this.onRoomUpdate) this.onRoomUpdate(this.playersInfo, this.seatIndex);
        } else if (data.type === 'SYNC_STATE') {
            if (this.onStateReceived) this.onStateReceived(data.state);
        } else if (data.type === 'PROMPT_OFFTURN_ACTION') {
            if (this.onPromptReceived) this.onPromptReceived(data.options);
        }
    }

    broadcastRoomInfo() {
        if (!this.isHost) return;
        this.broadcast({ type: 'ROOM_INFO', playersInfo: this.playersInfo });
        if (this.onRoomUpdate) this.onRoomUpdate(this.playersInfo, this.seatIndex);
    }

    broadcastState(state) {
        if (!this.isHost) return;
        const serialized = {
            phase: state.phase,
            currentTurn: state.currentTurn,
            startPlayer: state.startPlayer,
            wallCount: state.wall ? state.wall.length : (state.wallCount || 0),
            lastDiscard: state.lastDiscard,
            lastActionIsGang: state.lastActionIsGang,
            lastGangPlayer: state.lastGangPlayer,
            players: state.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                que: p.que,
                isHu: p.isHu,
                huRecords: p.huRecords,
                melds: p.melds,
                discards: p.discards,
                handCount: p.hand ? p.hand.length : 0,
                hand: p.hand
            }))
        };

        Object.values(this.connections).forEach(conn => {
            if (conn && conn.open) conn.send({ type: 'SYNC_STATE', state: serialized });
        });
    }

    sendToSeat(seatIndex, data) {
        if (!this.isHost) return;
        const targetPlayer = this.playersInfo[seatIndex];
        if (!targetPlayer || targetPlayer.isAI || !targetPlayer.peerId) return;

        const conn = this.connections[targetPlayer.peerId];
        if (conn && conn.open) {
            conn.send(data);
        }
    }

    broadcast(data) {
        Object.values(this.connections).forEach(conn => {
            if (conn && conn.open) conn.send(data);
        });
    }

    sendAction(action, payload = {}) {
        if (this.isHost) return;
        if (this.hostConn && this.hostConn.open) {
            this.hostConn.send({
                type: 'ACTION_REQUEST',
                playerIndex: this.seatIndex,
                action,
                payload
            });
        }
    }
}

const p2pManager = new P2PManager();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { P2PManager, p2pManager };
}
