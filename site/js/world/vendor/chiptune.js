// ===========================================================================
// chiptune.js — render Michael Maier's Atalanta Fugiens fugues (1617) through
// an NES-APU-style synth ("video game synth sounds").
//
// Source: EmblemRoguelike/assets/fugues.json — 50 emblems, each
//   { bpm, beats, notes: [[startBeat, durBeat, midiPitch], ...] } (3 canon voices).
// Voice model (after nsfripper CODEXSYNTH / NES APU): 2 pulse + 1 triangle, with
// per-channel duty / ADSR / vibrato / gain supplied by a GAME PALETTE
// (gamesynths.js). Palettes cycle as the fugue repeats → many versions per emblem.
// ===========================================================================

const LOOKAHEAD = 0.2, TICK = 25;
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const C = (duty, a, d, s, r, gain, vib = 0, vibHz = 5.5) => ({ duty, a, d, s, r, gain, vib, vibHz });

// the default (generic NES) palette, used when none is supplied
const DEFAULT_PALETTE = {
  id: "default", game: "NES", level: "—",
  p1: C(0.5, 0.006, 0.05, 0.62, 0.08, 0.30),
  p2: C(0.25, 0.006, 0.05, 0.58, 0.08, 0.24),
  tri: C(0, 0.006, 0.03, 0.95, 0.08, 0.5),
};

export class ChipPlayer {
  constructor() {
    this.ac = null; this.master = null; this.analyser = null; this.waveCache = {};
    this.fugues = null;
    this.notes = null; this.i = 0; this.beatDur = 0.5; this.pieceLen = 0;
    this.pieceStart = 0; this.loop = true; this.timer = null;
    this.current = null; this.vol = 0.5;
    this.palettes = null; this.palIdx = 0; this.palette = DEFAULT_PALETTE; this.onPalette = null;
    // 3 NES channels mapped to palette slots p1 / p2 / tri
    this.chans = [{ slot: "p1", busy: 0 }, { slot: "p2", busy: 0 }, { slot: "tri", busy: 0 }];
  }

  async load(url = "/EmblemRoguelike/assets/fugues.json") {
    try { this.fugues = await (await fetch(url)).json(); }
    catch (e) { console.warn("fugues load failed", e); this.fugues = {}; }
    return this;
  }

  _ensure() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ac = new AC();
    this.master = this.ac.createGain(); this.master.gain.value = this.vol;
    const lp = this.ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4400;
    this.analyser = this.ac.createAnalyser(); this.analyser.fftSize = 256;
    const delay = this.ac.createDelay(); delay.delayTime.value = 0.16;
    const fb = this.ac.createGain(); fb.gain.value = 0.16; delay.connect(fb); fb.connect(delay);
    const wet = this.ac.createGain(); wet.gain.value = 0.1;
    this.master.connect(lp); lp.connect(this.analyser); this.analyser.connect(this.ac.destination);
    lp.connect(delay); delay.connect(wet); wet.connect(this.ac.destination);
  }

  _wave(duty) {
    const key = duty.toFixed(3);
    if (this.waveCache[key]) return this.waveCache[key];
    const N = 32, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
    const w = this.ac.createPeriodicWave(real, imag, { disableNormalization: false });
    this.waveCache[key] = w; return w;
  }

  resume() { this._ensure(); if (this.ac.state === "suspended") this.ac.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ac.currentTime, 0.1); }
  setMuted(m) { this.setVolume(m ? 0 : 0.5); }

  // schedule one NES note on a channel, voiced by the current palette
  _note(ch, freq, t, dur) {
    const ac = this.ac;
    const cfg = this.palette[ch.slot] || DEFAULT_PALETTE[ch.slot];
    const o = ac.createOscillator();
    if (ch.slot === "tri") o.type = "triangle";
    else o.setPeriodicWave(this._wave(cfg.duty));
    o.frequency.value = freq;
    // vibrato
    let lfo, lg;
    if (cfg.vib > 0) {
      lfo = ac.createOscillator(); lfo.frequency.value = cfg.vibHz;
      lg = ac.createGain(); lg.gain.value = cfg.vib; lfo.connect(lg); lg.connect(o.detune);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    const g = ac.createGain();
    const peak = cfg.gain;
    const a = cfg.a, d = cfg.d, sus = peak * cfg.s, r = Math.min(cfg.r, dur * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(sus, t + a + d);
    g.gain.setValueAtTime(sus, t + Math.max(a + d, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _alloc(t, midi) {
    const order = midi <= 52 ? [2, 0, 1] : [0, 1, 2];
    for (const idx of order) if (this.chans[idx].busy <= t + 0.001) return this.chans[idx];
    return this.chans.reduce((a, b) => (a.busy <= b.busy ? a : b));
  }

  _applyPalette() {
    this.palette = this.palettes ? this.palettes[this.palIdx % this.palettes.length] : DEFAULT_PALETTE;
    if (this.onPalette) this.onPalette(this.palIdx % (this.palettes ? this.palettes.length : 1), this.palette);
  }

  // playEmblem(n, true)  OR  playEmblem(n, { loop, palettes, onPalette, startPalette })
  playEmblem(n, opts = true) {
    this._ensure(); this.resume();
    if (typeof opts === "boolean") opts = { loop: opts };
    const f = this.fugues && this.fugues[String(n)];
    if (!f || !f.notes) return false;
    this.current = n; this.loop = opts.loop !== false;
    if (opts.palettes) { this.palettes = opts.palettes; this.palIdx = opts.startPalette || 0; }
    if (opts.onPalette !== undefined) this.onPalette = opts.onPalette;
    this._applyPalette();
    this.beatDur = 60 / (f.bpm || 75);
    this.notes = f.notes.slice().sort((a, b) => a[0] - b[0]);
    this.pieceLen = (f.beats || (this.notes.at(-1)[0] + this.notes.at(-1)[1])) * this.beatDur;
    this.i = 0; this.pieceStart = this.ac.currentTime + 0.12;
    this.chans.forEach((c) => (c.busy = 0));
    if (!this.timer) this.timer = setInterval(() => this._tick(), TICK);
    return true;
  }

  nextPalette() { if (this.palettes) { this.palIdx = (this.palIdx + 1) % this.palettes.length; this._applyPalette(); } }

  _tick() {
    if (!this.notes || !this.ac) return;
    const ahead = this.ac.currentTime + LOOKAHEAD;
    while (this.i < this.notes.length) {
      const [start, dur, midi] = this.notes[this.i];
      const t = this.pieceStart + start * this.beatDur;
      if (t > ahead) break;
      const ch = this._alloc(t, midi);
      this._note(ch, midiToFreq(midi), t, Math.max(0.05, dur * this.beatDur));
      ch.busy = t + dur * this.beatDur;
      this.i++;
    }
    if (this.i >= this.notes.length) {
      const end = this.pieceStart + this.pieceLen;
      if (this.ac.currentTime >= end - LOOKAHEAD) {
        if (this.loop) {
          this.pieceStart = end; this.i = 0; this.chans.forEach((c) => (c.busy = 0));
          if (this.palettes) { this.palIdx = (this.palIdx + 1) % this.palettes.length; this._applyPalette(); } // cycle version each repeat
        } else this.stop();
      }
    }
  }

  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.notes = null; this.current = null; }

  level() {
    if (!this.analyser) return 0;
    const b = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(b);
    let s = 0; for (let i = 0; i < b.length; i++) { const v = (b[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / b.length);
  }
}
