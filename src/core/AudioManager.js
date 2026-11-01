/**
 * AudioManager
 * Fully procedural audio: engine, weapons, impacts, ambience and stingers are synthesized
 * with the Web Audio API. No audio files and no external services.
 *
 * Browsers block audio until a gesture, so the context is created lazily in unlock().
 */
export class AudioManager {
  constructor(settings) {
    this.settings = { ...settings };
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.engine = null;
    this.engineTarget = 0;
    this.ambientStarted = false;
    this.ambientTimer = null;
    this.muted = Boolean(settings?.muted);
  }

  get supported() {
    return typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  }

  unlock() {
    if (!this.supported) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new Ctx();
      } catch (error) {
        console.warn('[AudioManager] Audio context unavailable:', error);
        return;
      }

      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);

      this.noiseBuffer = this.createNoiseBuffer(2.5);
      this.applySettings(this.settings);
      this.startAmbient();
      this.ready = true;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.muted = Boolean(this.settings.muted);
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const master = this.muted ? 0.0001 : this.settings.master ?? 0.85;
    const music = this.settings.music ?? 0.4;
    const sfx = this.settings.sfx ?? 0.8;
    this.master.gain.setTargetAtTime(master, now, 0.05);
    this.musicGain.gain.setTargetAtTime(music * 0.6, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(sfx, now, 0.05);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.settings.muted = this.muted;
    if (this.ready) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0001 : this.settings.master ?? 0.85, this.ctx.currentTime, 0.05);
    }
  }

  createNoiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /* ---------------- primitives ---------------- */

  tone({ freq = 220, endFreq = null, duration = 0.2, type = 'sine', volume = 0.2, delay = 0, attack = 0.005, dest = null }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(dest || this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise({ duration = 0.3, volume = 0.3, filter = 'lowpass', freq = 1000, endFreq = null, q = 0.8, delay = 0, attack = 0.004 }) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = filter;
    filterNode.frequency.setValueAtTime(freq, t0);
    filterNode.Q.value = q;
    if (endFreq != null) filterNode.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filterNode);
    filterNode.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  /* ---------------- engine ---------------- */

  startEngine() {
    if (!this.ready || this.engine) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.9;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 44;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 63;
    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.value = 88;

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc1.start();
    osc2.start();
    osc3.start();

    this.engine = { gain, filter, osc1, osc2, osc3 };
  }

  setEngine(active, speedRatio = 0) {
    if (!this.ready) return;
    this.startEngine();
    if (!this.engine) return;
    const now = this.ctx.currentTime;
    const target = active ? 0.035 + speedRatio * 0.05 : 0.0001;
    this.engine.gain.gain.setTargetAtTime(target, now, 0.12);
    const base = 42 + speedRatio * 30;
    this.engine.osc1.frequency.setTargetAtTime(base, now, 0.15);
    this.engine.osc2.frequency.setTargetAtTime(base * 1.42, now, 0.15);
    this.engine.osc3.frequency.setTargetAtTime(base * 2.05, now, 0.2);
    this.engine.filter.frequency.setTargetAtTime(200 + speedRatio * 360, now, 0.15);
  }

  /* ---------------- weapons / impacts ---------------- */

  fire(weaponId = 'standard', enemy = false) {
    if (!this.ready) return;
    const vol = enemy ? 0.35 : 0.65;
    if (weaponId === 'rapid') {
      this.noise({ duration: 0.1, volume: vol * 0.7, filter: 'bandpass', freq: 1700, endFreq: 500, q: 1.2 });
      this.tone({ freq: 220, endFreq: 80, duration: 0.09, type: 'square', volume: vol * 0.28 });
      return;
    }
    if (weaponId === 'rocket') {
      this.noise({ duration: 0.6, volume: vol * 0.55, filter: 'bandpass', freq: 600, endFreq: 2200, q: 0.9 });
      this.tone({ freq: 120, endFreq: 45, duration: 0.5, type: 'sawtooth', volume: vol * 0.25 });
      return;
    }
    const heavy = weaponId === 'heavy';
    this.noise({
      duration: heavy ? 0.65 : 0.42,
      volume: vol * 0.8,
      filter: 'lowpass',
      freq: heavy ? 1400 : 1900,
      endFreq: 120,
      q: 0.7,
    });
    this.tone({
      freq: heavy ? 95 : 130,
      endFreq: heavy ? 28 : 36,
      duration: heavy ? 0.6 : 0.42,
      type: 'sine',
      volume: vol * 0.55,
    });
    this.tone({ freq: 70, endFreq: 40, duration: 0.25, type: 'triangle', volume: vol * 0.3, delay: 0.02 });
  }

  impact(surface = 'metal') {
    if (!this.ready) return;
    if (surface === 'metal') {
      this.tone({ freq: 820, endFreq: 380, duration: 0.12, type: 'triangle', volume: 0.11 });
      this.noise({ duration: 0.09, volume: 0.14, filter: 'highpass', freq: 1800 });
    } else {
      this.noise({ duration: 0.12, volume: 0.16, filter: 'lowpass', freq: 700, endFreq: 200 });
    }
  }

  explosion(size = 1) {
    if (!this.ready) return;
    const vol = Math.min(1, 0.5 * size + 0.2);
    this.noise({ duration: 0.7 + size * 0.4, volume: vol, filter: 'lowpass', freq: 1100, endFreq: 70, q: 0.6 });
    this.tone({ freq: 75, endFreq: 22, duration: 0.55 + size * 0.3, type: 'sine', volume: vol * 0.65 });
    this.tone({ freq: 150, endFreq: 40, duration: 0.25, type: 'square', volume: vol * 0.18 });
    if (size > 1.4) {
      this.noise({ duration: 1.1, volume: vol * 0.5, filter: 'lowpass', freq: 400, endFreq: 50, delay: 0.25 });
    }
  }

  ricochet() {
    if (!this.ready) return;
    this.tone({ freq: 1500, endFreq: 420, duration: 0.18, type: 'sine', volume: 0.08 });
  }

  reload(heavy = false) {
    if (!this.ready) return;
    const t = heavy ? 0.3 : 0.2;
    this.noise({ duration: 0.05, volume: 0.18, filter: 'bandpass', freq: 2400, q: 2 });
    this.noise({ duration: 0.05, volume: 0.14, filter: 'bandpass', freq: 1800, q: 2, delay: t });
    this.tone({ freq: 180, endFreq: 120, duration: 0.08, type: 'square', volume: 0.06, delay: t });
  }

  pickup(kind = 'ammo') {
    if (!this.ready) return;
    const base = kind === 'health' ? 440 : kind === 'special' ? 520 : 380;
    this.tone({ freq: base, duration: 0.08, type: 'square', volume: 0.09 });
    this.tone({ freq: base * 1.5, duration: 0.12, type: 'square', volume: 0.08, delay: 0.08 });
  }

  ui(kind = 'click') {
    if (!this.ready) return;
    if (kind === 'back') {
      this.tone({ freq: 180, endFreq: 120, duration: 0.09, type: 'square', volume: 0.05 });
    } else {
      this.noise({ duration: 0.04, volume: 0.05, filter: 'bandpass', freq: 2600, q: 2 });
      this.tone({ freq: 520, endFreq: 420, duration: 0.06, type: 'square', volume: 0.035 });
    }
  }

  alarm() {
    if (!this.ready) return;
    this.tone({ freq: 300, endFreq: 220, duration: 0.35, type: 'sawtooth', volume: 0.08 });
    this.tone({ freq: 220, endFreq: 300, duration: 0.35, type: 'sawtooth', volume: 0.08, delay: 0.4 });
  }

  waveStart() {
    if (!this.ready) return;
    this.tone({ freq: 110, endFreq: 110, duration: 0.7, type: 'sawtooth', volume: 0.09 });
    this.tone({ freq: 165, endFreq: 165, duration: 0.55, type: 'triangle', volume: 0.08, delay: 0.16 });
    this.tone({ freq: 220, endFreq: 220, duration: 0.5, type: 'triangle', volume: 0.06, delay: 0.32 });
  }

  bossWarning() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 140, endFreq: 90, duration: 0.5, type: 'sawtooth', volume: 0.1, delay: i * 0.65 });
      this.tone({ freq: 280, endFreq: 180, duration: 0.5, type: 'square', volume: 0.05, delay: i * 0.65 });
    }
  }

  victory() {
    if (!this.ready) return;
    const notes = [220, 277, 330, 440, 554];
    notes.forEach((freq, i) => {
      this.tone({ freq, duration: 1.5, type: 'triangle', volume: 0.08, delay: i * 0.14, attack: 0.02 });
      this.tone({ freq: freq * 2, duration: 1.0, type: 'sine', volume: 0.03, delay: i * 0.14, attack: 0.02 });
    });
    this.tone({ freq: 110, duration: 2.6, type: 'sine', volume: 0.08, attack: 0.05 });
  }

  defeat() {
    if (!this.ready) return;
    const notes = [196, 174, 146, 110];
    notes.forEach((freq, i) => {
      this.tone({ freq, endFreq: freq * 0.95, duration: 1.8, type: 'triangle', volume: 0.075, delay: i * 0.3, attack: 0.03 });
    });
    this.tone({ freq: 55, endFreq: 40, duration: 3, type: 'sine', volume: 0.08, attack: 0.08 });
  }

  /* ---------------- ambient music ---------------- */

  startAmbient() {
    if (!this.ready || this.ambientStarted) return;
    this.ambientStarted = true;
    this.scheduleAmbientBar();
    this.ambientTimer = setInterval(() => this.scheduleAmbientBar(), 8000);
  }

  scheduleAmbientBar() {
    if (!this.ready || this.ctx.state !== 'running') return;
    const start = this.ctx.currentTime + 0.15;
    const musicDest = this.musicGain;

    // Low drone.
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    const droneFilter = this.ctx.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(55, start);
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneGain.gain.setValueAtTime(0.0001, start);
    droneGain.gain.exponentialRampToValueAtTime(0.09, start + 1.5);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, start + 8);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(musicDest);
    drone.start(start);
    drone.stop(start + 8.3);

    // Distant metallic pad, every other bar.
    if (Math.random() > 0.4) {
      const padFreqs = [110, 146.83, 164.81];
      padFreqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.016, start + 2.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 7.5);
        osc.connect(gain);
        gain.connect(musicDest);
        osc.start(start + i * 0.4);
        osc.stop(start + 8);
      });
    }

    // Sparse percussion: distant impacts and a slow heartbeat.
    const hits = [0, 2.6, 4.1, 6.2];
    for (const offset of hits) {
      if (Math.random() > 0.75) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.034, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(musicDest);
      src.start(start + offset, Math.random() * 1.5, 0.4);
    }
  }

  stopAmbient() {
    if (this.ambientTimer) clearInterval(this.ambientTimer);
    this.ambientTimer = null;
    this.ambientStarted = false;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
}
