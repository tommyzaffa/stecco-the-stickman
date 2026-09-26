import * as THREE from 'three';

// Tutta la palette del gioco. Il mondo è inchiostro su carta:
// gli unici colori "veri" sono la penna rossa (obiettivi), la penna blu
// (missioni secondarie) e gli evidenziatori (la gang).
export const PAPER_HEX = '#f3eee2';
export const INK_HEX = '#1e1d24';
export const RED_HEX = '#d6333a';
export const BLUE_HEX = '#2f5bd3';
export const HIGHLIGHT_YELLOW_HEX = '#e8f53a';

// Tema corrente: di giorno inchiostro su carta, di notte gesso su carta nera.
// PAPER e INK vengono aggiornati da setTheme(); materiali e texture ne fanno una copia
// quando vengono creati, quindi il tema va impostato PRIMA di costruire un capitolo.
export interface Theme {
  paper: string;
  ink: string;
  grid?: { size: number; color: string }; // carta a quadretti
}
export const THEME: { paperHex: string; inkHex: string; night: boolean; grid: Theme['grid'] | null } = {
  paperHex: PAPER_HEX,
  inkHex: INK_HEX,
  night: false,
  grid: null,
};
export const PAPER = new THREE.Color(PAPER_HEX);
export const INK = new THREE.Color(INK_HEX);

export const DAY: Theme = { paper: PAPER_HEX, ink: INK_HEX };
export const NIGHT: Theme = { paper: '#1b1a21', ink: '#ebe6d8' };
// Quadropoli: carta a quadretti, un po' più fredda, inchiostro blu scuro
export const QUADRETTI: Theme = { paper: '#f2f3f0', ink: '#1d2233', grid: { size: 1, color: '#9fb8d6' } };

export function setTheme(t: Theme) {
  THEME.paperHex = t.paper;
  THEME.inkHex = t.ink;
  THEME.night = t === NIGHT;
  THEME.grid = t.grid ?? null;
  PAPER.set(t.paper);
  INK.set(t.ink);
}

// Colori degli evidenziatori (la gang e tutto ciò che possiede)
export const HL = {
  yellow: '#e8f53a',
  pink: '#ff5fa8',
  green: '#5cff8a',
  orange: '#ff9f3a',
  cyan: '#5ce1ff',
};

// RNG deterministico: lo stesso "disegno" a ogni avvio.
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = makeRng(1337);
export const rand = (min: number, max: number) => min + (max - min) * rng();
