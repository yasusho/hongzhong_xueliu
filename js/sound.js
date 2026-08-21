/**
 * 紅中血流成河麻雀 - サウンド管理 (SoundManager)
 */

class SoundManager {
    constructor() {
        this._ctx = null;
        this.gain = null;

        const resumeAudio = () => {
            if (this._ctx && this._ctx.state === 'suspended') {
                this._ctx.resume().catch(() => {});
            }
        };
        ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev => {
            if (typeof window !== 'undefined') {
                window.addEventListener(ev, resumeAudio, { passive: true });
            }
        });
    }

    get ctx() {
        if (!this._ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this._ctx = new AudioCtx();
                this.gain = this._ctx.createGain();
                this.gain.gain.value = 0.6;
                this.gain.connect(this._ctx.destination);
            }
        }
        if (this._ctx && this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    }

    play(type) {
        const audioCtx = this.ctx;
        if (!audioCtx) return;

        const soundEffects = {
            discard: () => {
                this._tone('triangle', (f, t) => {
                    f.setValueAtTime(360, t);
                    f.exponentialRampToValueAtTime(80, t + 0.07);
                }, 0.5, 0.07);
            },
            select: () => {
                this._tone('sine', (f, t) => {
                    f.setValueAtTime(750, t);
                }, 0.25, 0.05);
            },
            action: () => {
                this._tone('triangle', (f, t) => { f.setValueAtTime(523, t); }, 0.35, 0.08, 0);
                this._tone('triangle', (f, t) => { f.setValueAtTime(880, t); }, 0.35, 0.12, 0.07);
            },
            // 自分自身の和了（高揚感のあるファンファーレ調アルペジオ）
            hu: () => {
                [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
                    this._tone('triangle', (f, t) => { f.setValueAtTime(freq, t); }, 0.4, 0.22, i * 0.09);
                });
            },
            // 他家の和了（注意を促す下降チャイム）
            hu_opp: () => {
                [783.99, 659.25, 523.25].forEach((freq, i) => {
                    this._tone('sawtooth', (f, t) => { f.setValueAtTime(freq, t); }, 0.28, 0.16, i * 0.08);
                });
            }
        };

        soundEffects[type]?.();
    }

    _tone(type, freqFn, gainVal, dur, delay = 0) {
        try {
            const c = this.ctx;
            if (!c) return;
            const t = c.currentTime + delay;
            const osc = c.createOscillator();
            const g = c.createGain();

            osc.type = type;
            freqFn(osc.frequency, t);

            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(gainVal, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(g);
            g.connect(this.gain || c.destination);

            osc.start(t);
            osc.stop(t + dur);
        } catch (e) {}
    }
}

const soundManager = new SoundManager();
