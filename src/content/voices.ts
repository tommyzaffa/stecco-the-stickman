import type { Voice } from '../audio/audio';

// Voci dei personaggi (bip sintetizzati). Chiave = id del PNG, 'player' = tu.
export const VOICES: Record<string, Voice> = {
  player: { base: 205, type: 'triangle', spread: 5, every: 2 },
  marco: { base: 250, type: 'square', spread: 7, every: 2 },
  gino: { base: 150, type: 'sawtooth', spread: 4, every: 3 },
  aldo: { base: 195, type: 'square', spread: 6, every: 2 },
  soldini: { base: 165, type: 'triangle', spread: 3, every: 3 },
  bruno: { base: 82, type: 'sawtooth', spread: 2, every: 3, vol: 0.07 },
  sindaco: { base: 180, type: 'sawtooth', spread: 9, every: 2 },
  pina: { base: 380, type: 'triangle', spread: 6, every: 2, vibrato: 18 },
  gianni: { base: 158, type: 'triangle', spread: 3, every: 3 },
  filosofo: { base: 128, type: 'sine', spread: 5, every: 3, vol: 0.07 },
  fabio: { base: 285, type: 'square', spread: 8, every: 1, vol: 0.04 },
  luca: { base: 205, type: 'square', spread: 5, every: 2 },
  giulia: { base: 345, type: 'triangle', spread: 7, every: 2 },
  ugo: { base: 235, type: 'sine', spread: 6, every: 2, vol: 0.07 },
  rocco: { base: 138, type: 'square', spread: 5, every: 2 },
  rossi: { base: 172, type: 'square', spread: 3, every: 3 },
  giallo: { base: 108, type: 'sawtooth', spread: 3, every: 3, vol: 0.065 },
};

// Capitolo 2
Object.assign(VOICES, {
  ornella: { base: 330, type: 'triangle', spread: 5, every: 2 },
  nando: { base: 150, type: 'square', spread: 4, every: 2 },
  dj: { base: 240, type: 'sawtooth', spread: 9, every: 1, vol: 0.045 },
  rey: { base: 190, type: 'square', spread: 10, every: 2 },
  linea: { base: 420, type: 'sine', spread: 3, every: 3, vol: 0.05 },
  rosa: { base: 300, type: 'sawtooth', spread: 4, every: 2, vol: 0.05 },
  verde: { base: 130, type: 'sawtooth', spread: 3, every: 3 },
  arancione: { base: 160, type: 'sawtooth', spread: 5, every: 2 },
  azzurro: { base: 210, type: 'sawtooth', spread: 5, every: 2 },
  viola: { base: 120, type: 'sawtooth', spread: 3, every: 3 },
  fluo: { base: 95, type: 'sawtooth', spread: 6, every: 3, vol: 0.075, vibrato: 6 },
  fila1: { base: 230, type: 'triangle', spread: 5, every: 2 },
  fila2: { base: 280, type: 'square', spread: 6, every: 2 },
  fila3: { base: 175, type: 'triangle', spread: 4, every: 2 },
});

// Capitolo 3
Object.assign(VOICES, {
  penna: { base: 175, type: 'square', spread: 2, every: 3, vol: 0.05 },
  pegno: { base: 160, type: 'triangle', spread: 7, every: 2, vibrato: 10 },
  gustavo: { base: 220, type: 'triangle', spread: 4, every: 2 },
  colla: { base: 360, type: 'square', spread: 6, every: 2, vol: 0.045 },
  balcone: { base: 140, type: 'sawtooth', spread: 5, every: 2, vol: 0.05 },
  temperino: { base: 185, type: 'triangle', spread: 3, every: 3 },
  presidente: { base: 200, type: 'sine', spread: 4, every: 3, vol: 0.06 },
  insonne: { base: 260, type: 'square', spread: 9, every: 1, vol: 0.04 },
  postino: { base: 230, type: 'triangle', spread: 6, every: 2 },
  mimo: { base: 300, type: 'sine', spread: 3, every: 3, vol: 0.05 },
  turista: { base: 250, type: 'square', spread: 8, every: 2 },
  poeta: { base: 170, type: 'sine', spread: 8, every: 2, vol: 0.07, vibrato: 8 },
  fioraio: { base: 330, type: 'triangle', spread: 5, every: 2 },
});

// Capitolo 4
Object.assign(VOICES, {
  tornello: { base: 95, type: 'sawtooth', spread: 2, every: 3, vol: 0.07 },
  calamaio: { base: 150, type: 'triangle', spread: 5, every: 2, vibrato: 5 },
  banditore: { base: 210, type: 'square', spread: 10, every: 1, vol: 0.045 },
  pneumatica: { base: 340, type: 'sine', spread: 4, every: 2, vol: 0.06 },
  collezionista: { base: 170, type: 'triangle', spread: 3, every: 3 },
  pelliccia: { base: 320, type: 'triangle', spread: 6, every: 2, vibrato: 12 },
  salutatore: { base: 260, type: 'square', spread: 8, every: 2 },
  riflesso: { base: 190, type: 'sine', spread: 6, every: 2, vol: 0.07 },
  controluce: { base: 175, type: 'triangle', spread: 3, every: 2 },
  vocabolo: { base: 140, type: 'square', spread: 7, every: 2 },
  tarocco: { base: 230, type: 'sawtooth', spread: 8, every: 2, vol: 0.05 },
  grigia: { base: 350, type: 'square', spread: 5, every: 2, vol: 0.045 },
  boccetta: { base: 300, type: 'sine', spread: 7, every: 2, vol: 0.07, vibrato: 7 },
  bossolo: { base: 200, type: 'square', spread: 4, every: 2 },
  smarriti: { base: 120, type: 'sine', spread: 2, every: 3, vol: 0.05 },
  cliente1: { base: 160, type: 'triangle', spread: 3, every: 3 },
  cliente2: { base: 185, type: 'triangle', spread: 4, every: 2 },
  martina: { base: 310, type: 'triangle', spread: 6, every: 2, vibrato: 4 },
  martinaM: { base: 310, type: 'triangle', spread: 6, every: 2, vibrato: 4 },
  pRosso: { base: 270, type: 'sawtooth', spread: 9, every: 1, vol: 0.05 },
  pastellone: { base: 85, type: 'sawtooth', spread: 4, every: 3, vol: 0.08 },
});
for (const id of ['pBlu', 'pVerde', 'pArancione', 'pMarrone', 'pNero', 'pCeleste', 'pOcra', 'pRame', 'pRosso2', 'pVerde2', 'aGiallo', 'aBianco', 'aNero', 'aRosso']) {
  VOICES[id] = { base: 230 + Math.random() * 80, type: 'sawtooth', spread: 9, every: 1, vol: 0.045 };
}

// Capitolo 5
Object.assign(VOICES, {
  fioraia: { base: 330, type: 'triangle', spread: 6, every: 2 },
  bianco: { base: 175, type: 'sine', spread: 3, every: 3, vol: 0.06 },
  marcello: { base: 265, type: 'square', spread: 9, every: 1, vol: 0.05 },
  violinista: { base: 380, type: 'sine', spread: 8, every: 2, vol: 0.05, vibrato: 10 },
});
for (let i = 0; i < 6; i++) {
  for (const s of ['a', 'b']) VOICES[`cliente${i}${s}`] = { base: 200 + Math.random() * 140, type: 'sawtooth', spread: 7, every: 2, vol: 0.04 };
}
