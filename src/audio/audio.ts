import * as THREE from 'three';
import { Music } from './music';

// ---------------------------------------------------------------------------
// Audio sintetizzato con Web Audio: nessun file, come per la grafica.
// Filosofia: suoni "da cartone disegnato a mano" — graffi di matita, carta,
// campanelli, versi dei personaggi fatti di bip (alla Animal Crossing).
// ---------------------------------------------------------------------------

export interface Voice {
  base: number; // frequenza di base in Hz
  type: OscillatorType;
  spread: number; // escursione in semitoni
  every: number; // un bip ogni N caratteri
  vol?: number;
  vibrato?: number;
}

const DEFAULT_VOICE: Voice = { base: 200, type: 'square', spread: 6, every: 2 };

type Filter = { type: BiquadFilterType; freq: number; to?: number; q?: number };

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  music: Music | null = null;
  musicOn = true;

  // posizione dell'ascoltatore (aggiornata dal gioco a ogni frame)
  private lpos = new THREE.Vector3();
  private lyaw = 0;

  // suoni in loop
  private alarm: { gate: GainNode; pan: StereoPannerNode } | null = null;
  private fountain: { gain: GainNode; pan: StereoPannerNode } | null = null;
  private wind: GainNode | null = null;
  private nextBird = 4;

  get ready() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  // Va chiamato durante un click: i browser sbloccano l'audio solo così.
  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.sfx = this.bus(0.9);
    this.amb = this.bus(0.55);
    this.musicBus = this.bus(0.32);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.setupLoops();
    this.music = new Music(ctx, this.musicBus);
  }

  private bus(v: number) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    g.connect(this.master);
    return g;
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    this.ctx?.resume();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.2);
    return this.musicOn;
  }

  startMusic() {
    this.music?.start();
  }

  // --- primitive ------------------------------------------------------------------
  private tone(
    freq: number,
    dur: number,
    o: { type?: OscillatorType; vol?: number; to?: number; delay?: number; attack?: number; pan?: number; vibrato?: [number, number]; filter?: Filter; dest?: AudioNode } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato[0];
      lg.gain.value = o.vibrato[1];
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.1, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    let out: AudioNode = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + a + dur + 0.05);
  }

  private noise(dur: number, vol: number, filter: Filter, o: { delay?: number; pan?: number; attack?: number; dest?: AudioNode } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
    f.Q.value = filter.q ?? 1;
    const g = ctx.createGain();
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(f).connect(g);
    let out: AudioNode = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + dur + 0.05);
  }

  // volume e panning in base alla posizione rispetto al giocatore
  private spatial(pos: THREE.Vector3, maxD = 22) {
    const dx = pos.x - this.lpos.x, dz = pos.z - this.lpos.z;
    const d = Math.hypot(dx, dz);
    const vol = Math.max(0, 1 - d / maxD) ** 1.6;
    // destra della camera = (cos yaw, -sin yaw)
    const right = (dx * Math.cos(this.lyaw) - dz * Math.sin(this.lyaw)) / (d || 1);
    return { vol, pan: Math.max(-0.85, Math.min(0.85, right * 0.85)) };
  }

  // --- giocatore --------------------------------------------------------------------
  footstep(run: boolean, indoor: boolean) {
    const v = run ? 1.3 : 1;
    if (indoor) {
      this.tone(95 + Math.random() * 20, 0.06, { to: 60, vol: 0.12 * v });
      this.noise(0.05, 0.05 * v, { type: 'bandpass', freq: 900, q: 1.5 });
    } else {
      // graffio di matita sulla carta
      this.noise(0.055 + Math.random() * 0.02, 0.05 * v, { type: 'bandpass', freq: 2600 + Math.random() * 1400, q: 1.4 });
      this.noise(0.04, 0.03 * v, { type: 'lowpass', freq: 500 });
    }
  }

  jump() {
    this.noise(0.14, 0.05, { type: 'bandpass', freq: 600, to: 2200, q: 2 });
  }

  land() {
    this.tone(90, 0.08, { to: 50, vol: 0.18 });
    this.noise(0.06, 0.06, { type: 'lowpass', freq: 600 });
  }

  swing(weapon: 'fist' | 'ruler') {
    if (weapon === 'fist') this.noise(0.16, 0.09, { type: 'bandpass', freq: 1800, to: 450, q: 2.2 });
    else this.noise(0.2, 0.1, { type: 'bandpass', freq: 3200, to: 800, q: 3 });
  }

  hit(weapon: 'fist' | 'ruler') {
    this.tone(170, 0.14, { to: 55, vol: 0.35 });
    this.noise(0.09, 0.16, { type: 'bandpass', freq: 1300, q: 0.8 });
    // il righello "vibra" come sul bordo del banco di scuola
    if (weapon === 'ruler') this.tone(196, 0.55, { type: 'triangle', vol: 0.12, vibrato: [15, 14], delay: 0.02 });
  }

  hurt() {
    this.tone(130, 0.28, { to: 40, vol: 0.4 });
    this.noise(0.18, 0.2, { type: 'lowpass', freq: 900 });
  }

  // trombone triste
  faint() {
    const notes = [392, 370, 349];
    notes.forEach((n, i) => this.tone(n, 0.28, { type: 'sawtooth', vol: 0.08, delay: i * 0.38, filter: { type: 'lowpass', freq: 1100 } }));
    this.tone(330, 1.1, { type: 'sawtooth', vol: 0.08, delay: 1.14, vibrato: [5, 9], filter: { type: 'lowpass', freq: 1100 } });
  }

  heal() {
    this.tone(300, 0.25, { to: 720, vol: 0.08, type: 'triangle' });
    for (let i = 0; i < 3; i++) this.tone(900 + i * 200, 0.04, { vol: 0.04, delay: 0.08 + i * 0.07 });
  }

  // --- ricompense e interfaccia ---------------------------------------------------------
  coin() {
    this.tone(988, 0.06, { type: 'square', vol: 0.09, filter: { type: 'lowpass', freq: 4000 } });
    this.tone(1319, 0.28, { type: 'square', vol: 0.09, delay: 0.07, filter: { type: 'lowpass', freq: 4000 } });
  }

  pay() {
    this.tone(1319, 0.05, { type: 'square', vol: 0.035, filter: { type: 'lowpass', freq: 3000 } });
    this.tone(880, 0.16, { type: 'square', vol: 0.035, delay: 0.06, filter: { type: 'lowpass', freq: 3000 } });
  }

  private arp(notes: number[], step: number, o: { type?: OscillatorType; vol?: number; last?: number } = {}) {
    notes.forEach((n, i) =>
      this.tone(n, i === notes.length - 1 ? o.last ?? 0.4 : step * 1.4, { type: o.type ?? 'triangle', vol: o.vol ?? 0.07, delay: i * step }),
    );
  }

  item() {
    this.arp([523, 659, 784, 1047], 0.08);
  }

  objective() {
    this.tone(660, 0.12, { type: 'triangle', vol: 0.06 });
    this.tone(880, 0.25, { type: 'triangle', vol: 0.06, delay: 0.1 });
  }

  questDone() {
    this.arp([523, 659, 784, 1047, 1319], 0.07, { last: 0.6 });
    [523, 659, 784].forEach((n) => this.tone(n, 0.8, { type: 'sine', vol: 0.04, delay: 0.38 }));
  }

  levelUp() {
    this.arp([392, 523, 659, 784, 1047, 1319, 1568], 0.06, { vol: 0.06, last: 0.7 });
    for (let i = 0; i < 6; i++) this.tone(2000 + Math.random() * 1500, 0.08, { vol: 0.02, delay: 0.45 + i * 0.06 });
  }

  phone() {
    this.tone(1760, 0.07, { vol: 0.06 });
    this.tone(1760, 0.07, { vol: 0.06, delay: 0.14 });
  }

  dialogueOpen() {
    this.noise(0.12, 0.04, { type: 'highpass', freq: 1800, to: 5000 });
  }

  tick() {
    this.tone(1400, 0.025, { vol: 0.035 });
  }

  select() {
    this.tone(700, 0.06, { to: 950, type: 'triangle', vol: 0.06 });
  }

  bad() {
    this.tone(220, 0.18, { type: 'square', vol: 0.04, filter: { type: 'lowpass', freq: 1200 } });
    this.tone(180, 0.25, { type: 'square', vol: 0.04, delay: 0.15, filter: { type: 'lowpass', freq: 1200 } });
  }

  // scarabocchio + accordo (titoli dei capitoli)
  chapter() {
    for (let i = 0; i < 14; i++) this.noise(0.035, 0.035, { type: 'bandpass', freq: 1500 + Math.random() * 3500, q: 2 }, { delay: i * 0.045 });
    [262, 330, 392, 523].forEach((n, i) => this.tone(n, 1.4, { type: 'triangle', vol: 0.035, delay: 0.55 + i * 0.03, attack: 0.05 }));
  }

  jingle() {
    const mel = [523, 659, 784, 659, 784, 1047];
    mel.forEach((n, i) => this.tone(n, 0.2, { type: 'triangle', vol: 0.07, delay: i * 0.15 }));
    [262, 330, 392].forEach((n) => this.tone(n, 1.2, { vol: 0.05, delay: 0.9 }));
  }

  // --- voci --------------------------------------------------------------------------
  voice(v: Voice | undefined, ch: string, pos?: THREE.Vector3, quiet = 1) {
    const voice = v ?? DEFAULT_VOICE;
    const code = ch.toLowerCase().charCodeAt(0);
    const semis = ((code * 7) % (voice.spread * 2 + 1)) - voice.spread;
    const f = voice.base * Math.pow(2, semis / 12) * (1 + (Math.random() - 0.5) * 0.03);
    let vol = (voice.vol ?? 0.055) * quiet;
    let pan = 0;
    if (pos) {
      const s = this.spatial(pos, 16);
      vol *= s.vol;
      pan = s.pan;
      if (vol < 0.002) return;
    }
    this.tone(f, 0.05, {
      type: voice.type,
      vol,
      pan,
      vibrato: voice.vibrato ? [9, voice.vibrato] : undefined,
      filter: { type: 'lowpass', freq: 2600 },
    });
  }

  // matita che scrive (narratore)
  pencil() {
    this.noise(0.03, 0.02, { type: 'bandpass', freq: 3500 + Math.random() * 1500, q: 2 });
  }

  // borbottio spaziale: le battute dei passanti
  mumble(v: Voice | undefined, text: string, pos: THREE.Vector3) {
    const letters = text.replace(/[^a-zàèéìòù]/gi, '');
    const n = Math.min(10, Math.max(3, Math.floor(letters.length / 3)));
    const ctx = this.ctx;
    if (!ctx) return;
    for (let i = 0; i < n; i++) {
      const ch = letters[(i * 3) % letters.length] ?? 'a';
      setTimeout(() => this.voice(v, ch, pos, 0.8), i * 75);
    }
  }

  bark(pos: THREE.Vector3) {
    const s = this.spatial(pos, 20);
    if (s.vol < 0.01) return;
    for (let i = 0; i < 2; i++) {
      this.tone(520, 0.07, { type: 'square', to: 300, vol: 0.09 * s.vol, pan: s.pan, delay: i * 0.16, filter: { type: 'lowpass', freq: 1400 } });
      this.noise(0.06, 0.05 * s.vol, { type: 'bandpass', freq: 900 }, { delay: i * 0.16, pan: s.pan });
    }
  }

  // --- ambiente ----------------------------------------------------------------------
  private setupLoops() {
    const ctx = this.ctx!;
    const loopNoise = () => {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      s.start();
      return s;
    };

    // vento leggero
    {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 350;
      const g = ctx.createGain();
      g.gain.value = 0;
      loopNoise().connect(f).connect(g).connect(this.amb);
      this.wind = g;
    }
    // fontana
    {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      loopNoise().connect(f).connect(g).connect(p).connect(this.amb);
      this.fountain = { gain: g, pan: p };
    }
    // sveglia: "DRIIIN" = onda quadra acuta con tremolo veloce
    {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 2350;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 17;
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.5;
      lfo.connect(lfoG).connect(trem.gain);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3500;
      const gate = ctx.createGain();
      gate.gain.value = 0;
      const pan = ctx.createStereoPanner();
      osc.connect(trem).connect(f).connect(gate).connect(pan).connect(this.sfx);
      osc.start();
      lfo.start();
      this.alarm = { gate, pan };
    }
  }

  update(dt: number, s: { pos: THREE.Vector3; yaw: number; indoor: boolean; alarmOn: boolean; alarmPos: THREE.Vector3; fountainPos: THREE.Vector3; time: number }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    this.lpos.copy(s.pos);
    this.lyaw = s.yaw;

    if (this.wind) this.wind.gain.setTargetAtTime(s.indoor ? 0.015 : 0.05, t, 0.5);

    if (this.fountain) {
      const f = this.spatial(s.fountainPos, 16);
      this.fountain.gain.gain.setTargetAtTime(f.vol * 0.12, t, 0.1);
      this.fountain.pan.pan.setTargetAtTime(f.pan, t, 0.1);
    }

    if (this.alarm) {
      // squilli da ~0.9 s con pause da 0.5 s
      const ringing = s.alarmOn && s.time % 1.4 < 0.9;
      const a = this.spatial(s.alarmPos, 30);
      const v = ringing ? 0.05 * Math.max(0.15, a.vol) : 0;
      this.alarm.gate.gain.setTargetAtTime(v, t, 0.01);
      this.alarm.pan.pan.setTargetAtTime(a.pan, t, 0.05);
    }

    // uccellini (solo all'aperto)
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 3 + Math.random() * 7;
      if (!s.indoor) this.bird();
    }
  }

  private bird() {
    const pan = Math.random() * 1.6 - 0.8;
    const base = 2600 + Math.random() * 1400;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.tone(base, 0.05, { to: base * 1.35, vol: 0.025, pan, delay: i * 0.11, dest: this.amb });
    }
  }
}
