// ---------------------------------------------------------------------------
// Musica procedurale: un sequencer con "lookahead" su AudioContext e una manciata
// di strumenti sintetizzati. Ogni brano (Track) decide cosa suonare a ogni passo.
// ---------------------------------------------------------------------------

export interface Track {
  bpm: number;
  stepsPerBeat: number; // 2 = crome, 4 = semicrome
  swing?: number; // ritardo dei passi dispari (secondi)
  play(m: Music, step: number, t: number): void;
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private startTime = 0;
  private noise: AudioBuffer;
  track: Track | null = null;

  constructor(private ctx: AudioContext, private out: AudioNode) {
    const len = ctx.sampleRate * 0.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get playing() {
    return this.timer !== null;
  }

  start(track: Track) {
    if (this.track === track && this.timer) return;
    this.stop();
    this.track = track;
    this.step = 0;
    this.next = this.startTime = this.ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  // posizione nel battito corrente (0..1) e numero del battito: per luci e minigiochi
  beat() {
    if (!this.track) return { phase: 0, index: 0, bpm: 120 };
    const beats = ((this.ctx.currentTime - this.startTime) * this.track.bpm) / 60;
    return { phase: ((beats % 1) + 1) % 1, index: Math.floor(beats), bpm: this.track.bpm };
  }

  // tempo (AudioContext) del battito numero i
  beatTime(i: number) {
    return this.startTime + (i * 60) / (this.track?.bpm ?? 120);
  }

  private schedule() {
    const tr = this.track;
    if (!tr) return;
    const stepDur = 60 / tr.bpm / tr.stepsPerBeat;
    while (this.next < this.ctx.currentTime + 0.25) {
      tr.play(this, this.step, this.next + (this.step % 2 ? tr.swing ?? 0 : 0));
      this.next += stepDur;
      this.step++;
    }
  }

  // --- strumenti ----------------------------------------------------------------
  env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  pluck(f: number, t: number, vol: number, decay = 0.38) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const g = this.env(t, vol * (0.85 + Math.random() * 0.3), 0.004, decay);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + decay + 0.07);
  }

  bass(f: number, t: number, dur: number, vol = 0.13) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const s = this.ctx.createOscillator();
    s.frequency.value = f;
    const g = this.env(t, vol, 0.01, dur);
    o.connect(g);
    s.connect(g);
    g.connect(this.out);
    o.start(t);
    s.start(t);
    o.stop(t + dur + 0.05);
    s.stop(t + dur + 0.05);
  }

  // basso "da club": dente di sega filtrato
  sawBass(f: number, t: number, dur: number, vol = 0.12) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = this.env(t, vol, 0.005, dur);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  stab(notes: number[], t: number, vol = 0.03, dur = 0.12) {
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = mtof(n);
      o.detune.value = (Math.random() - 0.5) * 12;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      const g = this.env(t, vol, 0.004, dur);
      o.connect(lp).connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  whistle(f: number, t: number, dur: number, vol = 0.06) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(dur, 0.25));
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g).connect(this.out);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }

  hit(t: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', dur = 0.03, q = 1.5) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.env(t, vol, 0.002, dur);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur + 0.05);
  }

  kick(t: number, vol = 0.1, from = 110, to = 45, dur = 0.14) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const g = this.env(t, vol, 0.003, dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.06);
  }

  lead(f: number, t: number, dur: number, vol = 0.035) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const o2 = this.ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = f * 2;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.2;
    const g = this.env(t, vol, 0.005, dur);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.out);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }
}

// ===========================================================================
// BRANI
// ===========================================================================

// "Paese": motivetto fischiettato su accordi pizzicati (capitolo 1)
const _ = -1;
const PAESE_CHORDS: Record<string, number[]> = {
  C: [36, 60, 64, 67, 72],
  Am: [33, 57, 60, 64, 69],
  F: [29, 57, 60, 65, 69],
  G: [31, 55, 59, 62, 67],
  Dm: [38, 57, 62, 65, 69],
};
const PAESE_PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];
const PAESE_PLUCK = [1, 3, 2, 3, 4, 3, 2, 3];
const PAESE_MELODY: number[][] = [
  [76, _, 79, _, 76, 74, 72, _],
  [72, _, 76, _, 69, _, _, 0],
  [69, _, 72, _, 77, 76, 74, _],
  [71, _, 74, _, 79, _, _, 0],
  [76, 79, 76, 72, 74, _, 76, _],
  [72, _, 69, _, 72, _, 76, _],
  [77, _, 76, _, 74, _, 72, _],
  [74, _, _, 71, 67, _, _, 0],
];

export const PAESE: Track = {
  bpm: 96,
  stepsPerBeat: 2,
  swing: 0.045,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 4; // 0: base, 1: +fischio, 2: +percussioni, 3: tutto
    const chord = PAESE_CHORDS[PAESE_PROG[bar]];
    if (slot === 0) m.bass(mtof(chord[0]), t, 0.5);
    if (slot === 4) m.bass(mtof(chord[0] + 7), t, 0.35);
    if (slot === 6 && bar % 2 === 1) m.bass(mtof(chord[0] + 12), t, 0.2);
    const skip = section === 0 && slot === 7 && bar % 2 === 0;
    if (!skip) m.pluck(mtof(chord[PAESE_PLUCK[slot]]), t, slot === 0 ? 0.075 : 0.055);
    if (section >= 2) {
      if (slot % 2 === 1) m.hit(t, 0.018, 5500);
      if (slot === 0 || slot === 4) m.kick(t);
      if (slot === 6 && bar % 4 === 3) m.hit(t, 0.03, 2500);
    }
    if (section === 1 || section === 3) {
      const row = PAESE_MELODY[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        m.whistle(mtof(n), t, len * (60 / 96 / 2) * 0.95);
      }
    }
  },
};

// "Sbiadisco": la hit del Parallelepipedo. Cassa dritta, basso in levare, accordi "disco".
const DISCO_CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 60, 64], // C
  [55, 59, 62], // G
];
const DISCO_ROOTS = [45, 41, 48, 43];

// lead = true: la versione "Sbiadisco" con la melodia sempre presente (la preferita di Rosa)
const disco = (lead: boolean): Track => ({
  bpm: 124,
  stepsPerBeat: 4,
  play(m, step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const ci = bar % 4;
    let section = Math.floor(bar / 8) % 4; // 0 intro, 1 +accordi, 2 +melodia, 3 pausa (niente cassa)
    if (lead) section = section === 3 ? 3 : 2;
    else if (section === 2) section = 1;
    const chord = DISCO_CHORDS[ci];
    const root = DISCO_ROOTS[ci];
    const breakdown = section === 3 && bar % 8 < 4;
    if (!breakdown && s % 4 === 0) m.kick(t, 0.26, 150, 42, 0.2);
    if (!breakdown && (s === 4 || s === 12) && section > 0) {
      m.hit(t, 0.1, 1500, 'bandpass', 0.12, 0.7);
      m.hit(t + 0.01, 0.06, 2600, 'bandpass', 0.08, 1);
    }
    if (s % 4 === 2) m.hit(t, 0.045, 8000, 'highpass', 0.06, 0.8);
    else if (s % 2 === 1) m.hit(t, 0.018, 9000, 'highpass', 0.02, 0.8);
    if (s % 4 === 2) m.sawBass(mtof(root - 12), t, 0.16);
    if (s === 3 || s === 11) m.sawBass(mtof(root), t, 0.08, 0.07);
    if (section >= 1 && (s === 2 || s === 5 || s === 10 || s === 13)) m.stab(chord.map((n) => n + 12), t);
    if (breakdown && s % 8 === 0) m.stab(chord.map((n) => n + 12), t, 0.03, 0.9);
    if (section === 2) {
      const arp = [0, 1, 2, 1];
      const n = chord[arp[s % 4]] + (s >= 8 ? 24 : 12);
      m.lead(mtof(n), t, 0.1);
    }
  },
});

// "Indagine": jazz da detective per Quadropoli. Basso che cammina, spazzole, accordi
// di vibrafono e ogni tanto una tromba con la sordina.
const JAZZ = [
  { bass: [38, 41, 45, 48], chord: [62, 65, 69, 72] }, // Dm7
  { bass: [43, 47, 50, 53], chord: [59, 62, 65, 67] }, // G7
  { bass: [36, 40, 43, 47], chord: [60, 64, 67, 71] }, // Cmaj7
  { bass: [45, 49, 52, 55], chord: [61, 64, 67, 69] }, // A7
];
const TRUMPET: number[][] = [
  [74, -1, 72, 69, 0, 0, 0, 0],
  [71, -1, -1, 67, 65, -1, 0, 0],
  [67, 69, 71, 72, -1, -1, 0, 0],
  [73, -1, 76, -1, 73, 69, 0, 0],
];
export const INDAGINE: Track = {
  bpm: 112,
  stepsPerBeat: 2,
  swing: 0.09,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 4;
    const slot = step % 8;
    const phrase = Math.floor(step / 32) % 4; // 0,2 senza tromba; 1,3 con tromba
    const c = JAZZ[bar];
    // basso che cammina: una nota per battito
    if (slot % 2 === 0) m.bass(mtof(c.bass[slot / 2] - 12), t, 0.28, 0.12);
    // spazzole sul 2 e sul 4, piatto in levare
    if (slot === 2 || slot === 6) m.hit(t, 0.05, 2200, 'bandpass', 0.14, 0.6);
    if (slot % 2 === 1) m.hit(t, 0.02, 7500, 'highpass', 0.05, 0.8);
    if (slot % 2 === 0) m.hit(t, 0.012, 9000, 'highpass', 0.12, 0.8);
    // accordi in levare, un po' sfasati
    if (slot === 1 || slot === 5) for (const n of c.chord) m.pluck(mtof(n), t + Math.random() * 0.015, 0.02, 0.6);
    // tromba con sordina
    if (phrase % 2 === 1) {
      const row = TRUMPET[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === -1) len++;
        m.stab([n], t, 0.028, len * (60 / 112 / 2) * 0.9);
      }
    }
  },
};

export const TRACKS = { paese: PAESE, club: disco(false), sbiadisco: disco(true), indagine: INDAGINE };
export type TrackName = keyof typeof TRACKS;
