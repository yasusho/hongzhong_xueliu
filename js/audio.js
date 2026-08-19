/**
 * 紅中血流成河麻雀 - Web Audio API 音響効果
 */
class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initUnlockListener();
    }

    initUnlockListener() {
        if (typeof window === 'undefined') return;
        const unlock = () => {
            this.ensureContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
        };
        ['click', 'keydown', 'touchstart', 'mousedown'].forEach(ev => {
            window.addEventListener(ev, unlock, { passive: true });
        });
    }

    ensureContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                    this.masterGain = this.ctx.createGain();
                    this.masterGain.gain.value = 0.5;
                    this.masterGain.connect(this.ctx.destination);
                }
            } catch (e) {
                console.warn('AudioContext error:', e);
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    play(type) {
        const ctx = this.ensureContext();
        if (!ctx || ctx.state !== 'running') {
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(() => this.playTone(type, ctx)).catch(() => {});
                return;
            }
        }
        this.playTone(type, ctx);
    }

    playTone(type, ctx) {
        if (!ctx) return;
        const now = ctx.currentTime;
        const dest = this.masterGain || ctx.destination;

        try {
            if (type === 'discard') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain).connect(dest);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'select') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.connect(gain).connect(dest);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'action') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(880, now + 0.06);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.14);
                osc.connect(gain).connect(dest);
                osc.start(now);
                osc.stop(now + 0.14);
            } else if (type === 'hu') {
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.35, now + idx * 0.08);
                    gain.gain.linearRampToValueAtTime(0.01, now + idx * 0.08 + 0.18);
                    osc.connect(gain).connect(dest);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.18);
                });
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }
}

const soundManager = new SoundManager();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SoundManager, soundManager };
}
