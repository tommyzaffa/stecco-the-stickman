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
