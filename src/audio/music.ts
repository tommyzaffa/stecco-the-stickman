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

// "Mercato": habanera losca per il Mercato Nero. Basso col ritmo di tango, chitarra pizzicata
// e ogni tanto un clarinetto (lead) che sembra voler vendere qualcosa.
const MERCATO_CHORDS = [
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 45, chord: [61, 64, 67] }, // A7
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 46, chord: [62, 65, 70] }, // Bb
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 45, chord: [61, 64, 69] }, // A
  { root: 45, chord: [61, 64, 67] }, // A7
];
const CLARINETTO: number[][] = [
  [74, _, 73, 74, 77, _, 76, 74],
  [73, _, _, 69, 70, _, 69, _],
  [74, _, 77, _, 81, _, 79, 77],
  [79, _, _, 0, 74, _, 70, _],
  [70, _, 74, _, 77, _, 76, 74],
  [74, _, 70, _, 67, _, 70, _],
  [69, _, 73, _, 76, _, 73, _],
  [73, _, _, _, 0, 0, 0, 0],
];
export const MERCATO: Track = {
  bpm: 92,
  stepsPerBeat: 2,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 2; // la seconda volta c'è il clarinetto
    const c = MERCATO_CHORDS[bar];
    // habanera: TA - - ta TA - TA -
    if (slot === 0) m.bass(mtof(c.root), t, 0.4, 0.14);
    if (slot === 3) m.bass(mtof(c.root + 7), t, 0.15, 0.1);
    if (slot === 4) m.bass(mtof(c.root + 12), t, 0.3, 0.11);
    if (slot === 6) m.bass(mtof(c.root + 7), t, 0.25, 0.1);
    // chitarra: accordi pizzicati sul levare
    if (slot === 2 || slot === 5 || slot === 7) for (const n of c.chord) m.pluck(mtof(n), t + Math.random() * 0.02, 0.022, 0.3);
    // nacchere di carta
    if (slot === 0 || slot === 3 || slot === 4) m.hit(t, 0.03, 3200, 'bandpass', 0.04, 2);
    if (slot === 7 && bar % 2 === 1) for (let i = 0; i < 3; i++) m.hit(t + i * 0.055, 0.02, 3600, 'bandpass', 0.03, 2);
    if (section === 1) {
      const row = CLARINETTO[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        m.lead(mtof(n - 12), t, len * (60 / 92 / 2) * 0.9, 0.03);
      }
    }
  },
};

// "Sparatoria": western all'italiana, galoppo e fischio solista (ironico, ovviamente)
const WEST_ROOTS = [45, 45, 43, 43, 41, 41, 40, 40]; // Am Am G G F F E E
const WEST_CHORDS: Record<number, number[]> = { 45: [57, 60, 64], 43: [55, 59, 62], 41: [53, 57, 60], 40: [56, 59, 64] };
const FISCHIO: number[][] = [
  [81, _, _, _, 76, _, 81, _],
  [79, _, _, _, _, _, 0, 0],
  [79, _, _, _, 74, _, 79, _],
  [77, _, _, _, _, _, 0, 0],
  [77, _, 76, _, 74, _, 72, _],
  [74, _, _, _, 71, _, 0, 0],
  [71, _, 72, _, 74, _, 76, _],
  [68, _, _, _, _, _, 0, 0],
];
export const SPARATORIA: Track = {
  bpm: 150,
  stepsPerBeat: 2,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 2;
    const root = WEST_ROOTS[bar];
    // galoppo: TA-ta-ta TA-ta-ta
    if (slot % 4 === 0) m.kick(t, 0.13, 100, 45, 0.12);
    if (slot % 4 === 1 || slot % 4 === 2) m.hit(t, 0.03, 1800, 'bandpass', 0.05, 1.2);
    if (slot % 2 === 0) m.sawBass(mtof(root - 12 + (slot === 4 ? 7 : 0)), t, 0.16, 0.09);
    // chitarra "twang" in levare
    if (slot === 3 || slot === 7) m.stab(WEST_CHORDS[root], t, 0.018, 0.2);
    // frusta ogni due battute
    if (slot === 6 && bar % 2 === 1) m.hit(t, 0.06, 5000, 'highpass', 0.08, 0.8);
    if (section === 1) {
      const row = FISCHIO[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        m.whistle(mtof(n), t, len * (60 / 150 / 2) * 0.95, 0.05);
      }
    }
  },
};

// "Cena": valzer lento da ristorante (Da Pastello). Con violino = il violinista al tavolo.
const VALZER = [
  { root: 41, chord: [65, 69, 72] }, // F
  { root: 45, chord: [64, 69, 72] }, // Am
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 48, chord: [64, 67, 70] }, // C7
  { root: 41, chord: [65, 69, 72] }, // F
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 48, chord: [64, 67, 70] }, // C7
];
const VIOLINO: number[][] = [
  [81, _, _, 79, 77, _],
  [76, _, _, _, 72, _],
  [74, _, 77, _, 81, _],
  [82, _, _, _, 0, 0],
  [79, _, 77, _, 76, _],
  [77, _, _, 81, 84, _],
  [82, _, 79, _, 77, _],
  [76, _, _, _, 0, 0],
];
const valzer = (violin: boolean): Track => ({
  bpm: 84,
  stepsPerBeat: 2,
  play(m, step, t) {
    const bar = Math.floor(step / 6) % 8;
    const slot = step % 6; // tre battiti, due passi per battito
    const c = VALZER[bar];
    if (slot === 0) m.bass(mtof(c.root), t, 0.6, 0.12);
    if (slot === 2 || slot === 4) for (const n of c.chord) m.pluck(mtof(n), t + Math.random() * 0.02, 0.018, 0.5);
    if (slot === 0) m.hit(t, 0.012, 6000, 'highpass', 0.1, 0.7);
    const withLead = violin || Math.floor(step / 48) % 2 === 1;
    if (withLead) {
      const row = VIOLINO[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 6 && row[slot + len] === _) len++;
        m.whistle(mtof(n - (violin ? 0 : 12)), t, len * (60 / 84 / 2) * 0.95, violin ? 0.055 : 0.03);
      }
    }
  },
});

// "Consegna": polka da inseguimento in re minore (capitolo 6, la discesa con i Pastelli dietro)
const CONSEGNA_PROG = [
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 34, chord: [62, 65, 70] }, // Bb
  { root: 33, chord: [61, 64, 69] }, // A
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 38, chord: [62, 65, 69] }, // Dm
  { root: 43, chord: [62, 67, 70] }, // Gm
  { root: 33, chord: [61, 64, 69] }, // A
];
const CONSEGNA_TEMA: number[][] = [
  [74, _, 72, 74, 77, _, 74, _],
  [72, 69, _, 65, 69, _, _, 0],
  [70, _, 74, _, 77, 76, 74, _],
  [73, _, 76, _, 81, _, _, 0],
  [74, 77, 81, 77, 74, _, 72, _],
  [69, _, 72, _, 74, _, _, 0],
  [70, _, 74, 79, 77, _, 74, _],
  [73, _, 69, _, 74, _, _, 0],
];
export const CONSEGNA: Track = {
  bpm: 168,
  stepsPerBeat: 2,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 3; // 0: base, 1: +tema, 2: tema un'ottava sopra
    const c = CONSEGNA_PROG[bar];
    // oom-pah: basso sui tempi, accordo in levare
    if (slot % 4 === 0) m.bass(mtof(c.root), t, 0.22, 0.15);
    if (slot % 4 === 2) m.bass(mtof(c.root + 7), t, 0.18, 0.11);
    if (slot % 2 === 1) m.stab(c.chord, t, 0.016, 0.09);
    if (slot % 4 === 0) m.kick(t, 0.1, 100, 45, 0.1);
    if (slot % 4 === 2) m.hit(t, 0.045, 1900, 'bandpass', 0.07, 1);
    if (slot % 2 === 1) m.hit(t, 0.014, 6000, 'highpass');
    if (section > 0) {
      const row = CONSEGNA_TEMA[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        m.lead(mtof(n + (section === 2 ? 12 : 0)), t, len * (60 / 168 / 2) * 0.9, section === 2 ? 0.026 : 0.032);
      }
    }
  },
};

// "Trasloco": marcetta da lavoro, un po' zoppa (sol maggiore, 108 bpm): tuba, battimani e fischio
const TRASLOCO_PROG = [
  { root: 43, chord: [67, 71, 74] }, // G
  { root: 43, chord: [67, 71, 74] }, // G
  { root: 48, chord: [67, 72, 76] }, // C
  { root: 50, chord: [66, 69, 74] }, // D
  { root: 43, chord: [67, 71, 74] }, // G
  { root: 40, chord: [67, 71, 76] }, // Em
  { root: 45, chord: [69, 72, 76] }, // Am
  { root: 50, chord: [66, 69, 74] }, // D
];
const TRASLOCO_TEMA: number[][] = [
  [79, _, 78, 79, 81, _, 79, _],
  [74, _, _, 71, 74, _, _, 0],
  [76, _, 79, _, 84, 83, 81, _],
  [78, _, 76, _, 74, _, _, 0],
  [79, _, 81, 83, 84, _, 83, _],
  [79, _, 76, _, 71, _, _, 0],
  [72, _, 76, _, 81, 79, 76, _],
  [74, _, _, 78, 79, _, _, 0],
];
export const TRASLOCO: Track = {
  bpm: 108,
  stepsPerBeat: 2,
  swing: 0.05,
  play(m, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 2;
    const c = TRASLOCO_PROG[bar];
    // tuba: fondamentale e quinta, con un passo "pesante" in mezzo
    if (slot === 0) m.bass(mtof(c.root - 12), t, 0.35, 0.16);
    if (slot === 4) m.bass(mtof(c.root - 5), t, 0.3, 0.13);
    if (slot === 6 && bar % 2) m.bass(mtof(c.root - 10), t, 0.15, 0.1);
    if (slot === 2 || slot === 6) m.pluck(mtof(c.chord[slot === 2 ? 0 : 1]), t, 0.04, 0.2);
    // battimani sul 2 e sul 4
    if (slot === 2 || slot === 6) m.hit(t, 0.05, 1500, 'bandpass', 0.05, 0.8);
    if (slot % 2 === 1) m.hit(t, 0.012, 7000, 'highpass');
    if (section === 1) {
      const row = TRASLOCO_TEMA[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        m.whistle(mtof(n), t, len * (60 / 108 / 2) * 0.95, 0.045);
      }
    }
  },
};

export const TRACKS = {
  paese: PAESE,
  club: disco(false),
  sbiadisco: disco(true),
  indagine: INDAGINE,
  mercato: MERCATO,
  sparatoria: SPARATORIA,
  cena: valzer(false),
  violino: valzer(true),
  consegna: CONSEGNA,
  trasloco: TRASLOCO,
};
export type TrackName = keyof typeof TRACKS;
