/**
 * 紅中血流成河麻雀 - Web Audio API 音響効果 (SoundManager)
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
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
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
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => this.playTone(type, ctx)).catch(() => {});
            return;
        }
        this.playTone(type, ctx);
    }

    _tone(ctx, type, freqFn, gainVal, dur, delay = 0) {
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        freqFn(osc.frequency, now);
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.linearRampToValueAtTime(0.01, now + dur);
        osc.connect(gain).connect(this.masterGain || ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
    }

    playTone(type, ctx) {
        try {
            if (type === 'discard') {
                this._tone(ctx, 'triangle', (f, t) => { f.setValueAtTime(320, t); f.exponentialRampToValueAtTime(80, t + 0.08); }, 0.4, 0.08);
            } else if (type === 'select') {
                this._tone(ctx, 'sine', (f, t) => f.setValueAtTime(600, t), 0.25, 0.05);
            } else if (type === 'action') {
                this._tone(ctx, 'triangle', (f, t) => { f.setValueAtTime(440, t); f.setValueAtTime(880, t + 0.06); }, 0.35, 0.14);
            } else if (type === 'hu') {
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    this._tone(ctx, 'triangle', (f, t) => f.setValueAtTime(freq, t), 0.35, 0.18, idx * 0.08);
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
