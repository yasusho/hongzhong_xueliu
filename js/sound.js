class SoundManager {
    constructor() {
        this.ctx = null;
        this.tones = {
            discard: [{ f: 300, t: 'triangle', d: 0.04, g: 0.18 }],
            select: [{ f: 600, t: 'sine', d: 0.04, g: 0.1 }],
            action: [{ f: 440, t: 'sine', d: 0.08, g: 0.2 }, { f: 880, t: 'sine', d: 0.1, delay: 0.08, g: 0.2 }],
            hu: [{ f: 523, t: 'triangle', d: 0.1, g: 0.3 }, { f: 659, t: 'triangle', d: 0.1, delay: 0.1, g: 0.3 }, { f: 784, t: 'triangle', d: 0.2, delay: 0.2, g: 0.3 }],
            hu_opp: [{ f: 330, t: 'sine', d: 0.1, g: 0.2 }, { f: 220, t: 'sine', d: 0.2, delay: 0.1, g: 0.2 }]
        };
    }

    _init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    play(name) {
        this._init();
        if (!this.ctx) return;
        const steps = this.tones[name] || [];
        const now = this.ctx.currentTime;

        steps.forEach(({ f, t, d, delay = 0, g = 0.2 }) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = t;
            osc.frequency.setValueAtTime(f, now + delay);
            gain.gain.setValueAtTime(g, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + d);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + d);
        });
    }
}
const soundManager = new SoundManager();

if (typeof window !== 'undefined') {
    window.SoundManager = SoundManager;
    window.soundManager = soundManager;
}
