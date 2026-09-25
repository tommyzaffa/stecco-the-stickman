// ---------------------------------------------------------------------------
// Musica procedurale: un motivetto fischiettato su accordi pizzicati,
// da cittadina di cartone. Sequencer con "lookahead" su AudioContext.
// ---------------------------------------------------------------------------

const BPM = 96;
const EIGHTH = 60 / BPM / 2;
const SWING = 0.045; // le crome in levare arrivano un filo dopo

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// accordi: [basso, poi le note del pizzicato]
const CHORDS: Record<string, number[]> = {
  C: [36, 60, 64, 67, 72],
  Am: [33, 57, 60, 64, 69],
  F: [29, 57, 60, 65, 69],
  G: [31, 55, 59, 62, 67],
  Dm: [38, 57, 62, 65, 69],
};
const PROGRESSION = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];
const PLUCK = [1, 3, 2, 3, 4, 3, 2, 3];

// melodia fischiettata: numero = nota MIDI, 0 = pausa, -1 = prolunga
const _ = -1;
const MELODY: number[][] = [
  [76, _, 79, _, 76, 74, 72, _],
  [72, _, 76, _, 69, _, _, 0],
  [69, _, 72, _, 77, 76, 74, _],
  [71, _, 74, _, 79, _, _, 0],
  [76, 79, 76, 72, 74, _, 76, _],
  [72, _, 69, _, 72, _, 76, _],
  [77, _, 76, _, 74, _, 72, _],
  [74, _, _, 71, 67, _, _, 0],
];

export class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private noise: AudioBuffer;

  constructor(private ctx: AudioContext, private out: AudioNode) {
    const len = ctx.sampleRate * 0.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  start() {
    if (this.timer) return;
    this.next = this.ctx.currentTime + 0.15;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    while (this.next < this.ctx.currentTime + 0.25) {
      this.play(this.step, this.next + (this.step % 2 ? SWING : 0));
      this.next += EIGHTH;
      this.step++;
    }
  }

  private play(step: number, t: number) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const section = Math.floor(step / 64) % 4; // 0: base, 1: +fischio, 2: +percussioni, 3: tutto
    const chord = CHORDS[PROGRESSION[bar]];

    // basso
    if (slot === 0) this.bass(mtof(chord[0]), t, 0.5);
    if (slot === 4) this.bass(mtof(chord[0] + 7), t, 0.35);
    if (slot === 6 && bar % 2 === 1) this.bass(mtof(chord[0] + 12), t, 0.2);

    // pizzicato (ogni tanto salta una nota: respira)
    const idx = PLUCK[slot];
    const skip = section === 0 && slot === 7 && bar % 2 === 0;
    if (!skip) this.pluck(mtof(chord[idx]), t, slot === 0 ? 0.075 : 0.055);

    // percussioni "matita sul banco"
    if (section >= 2) {
      if (slot % 2 === 1) this.tap(t, 0.018, 5500);
      if (slot === 0 || slot === 4) this.kick(t);
      if (slot === 6 && bar % 4 === 3) this.tap(t, 0.03, 2500);
    }

    // melodia
    if (section === 1 || section === 3) {
      const row = MELODY[bar];
      const n = row[slot];
      if (n > 0) {
        let len = 1;
        while (slot + len < 8 && row[slot + len] === _) len++;
        this.whistle(mtof(n), t, len * EIGHTH * 0.95);
      }
    }
  }

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private pluck(f: number, t: number, vol: number) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const g = this.env(t, vol * (0.85 + Math.random() * 0.3), 0.004, 0.38);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.45);
  }

  private bass(f: number, t: number, dur: number) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const s = this.ctx.createOscillator();
    s.frequency.value = f;
    const g = this.env(t, 0.13, 0.01, dur);
    o.connect(g);
    s.connect(g);
    g.connect(this.out);
    o.start(t);
    s.start(t);
    o.stop(t + dur + 0.05);
    s.stop(t + dur + 0.05);
  }

  private whistle(f: number, t: number, dur: number) {
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
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
    g.gain.setValueAtTime(0.06, t + Math.max(0.05, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g).connect(this.out);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.1);
    lfo.stop(t + dur + 0.1);
  }

  private tap(t: number, vol: number, freq: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.5;
    const g = this.env(t, vol, 0.002, 0.03);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random() * 0.3);
    s.stop(t + 0.06);
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.env(t, 0.1, 0.003, 0.14);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }
}
