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
  grid?: { size: number; color: string; major?: number; rows?: boolean; dots?: boolean; staff?: boolean; bands?: boolean }; // carta a quadretti (major: una riga più marcata ogni N; rows: solo righe orizzontali, quaderno a righe; dots: solo i puntini agli incroci; staff: righe a gruppi di cinque, carta da musica)
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

// Capitolo 6, le strade in discesa: carta millimetrata, come il progetto di un geometra
export const MILLIMETRATA: Theme = { paper: '#f7f2e4', ink: '#2a2530', grid: { size: 1, color: '#eba47a', major: 5 } };

// Capitolo 7, il trasloco: quaderno a righe (righe orizzontali anche sui muri, come un foglio di bella)
export const RIGHE: Theme = { paper: '#fbf8ef', ink: '#23222b', grid: { size: 0.8, color: '#9dbbe0', rows: true } };

// Capitolo 8, la sagra: carta a puntini (quella dei diari), coi puntini color confetto
export const PUNTINI: Theme = { paper: '#fbf7ee', ink: '#25222c', grid: { size: 0.7, color: '#c58fae', dots: true } };

// Capitolo 9, il pub di Dario la sera: carta pentagrammata (da musica), color panna sotto le lampade
export const PENTAGRAMMA: Theme = { paper: '#f1e6cf', ink: '#2a2119', grid: { size: 0.18, color: '#b99b76', rows: true, staff: true } };

// Capitolo 10, il condominio di notte: carta carbone (blu notte), inchiostro azzurro chiaro
export const CARBONE: Theme = { paper: '#1c2232', ink: '#d3dbf2' };

// Capitolo 11, l'Ufficio Protocollo: carta a modulo continuo (strisce verdi, come i tabulati)
export const MODULO: Theme = { paper: '#f7f8f1', ink: '#1f2629', grid: { size: 0.45, color: '#b7d9b1', rows: true, bands: true } };

// Mercato Nero: carta da pacchi. Tutto quello che si vende qui sotto è incartato.
export const PACCHI: Theme = { paper: '#d8c29d', ink: '#2a2119' };

// Da Pastello: cartoncino color prugna, inchiostro color crema (luce di candela)
export const CARTONCINO: Theme = { paper: '#33222f', ink: '#f2e3cf' };

// Colori dei Pastelli a Cera (la gang rivale): pieni, un po' sporchi, da astuccio delle elementari
export const CERA = {
  rosso: '#d9412b',
  blu: '#2f62d9',
  verde: '#2f9e44',
  arancione: '#e8791e',
  viola: '#8a3fc8',
  marrone: '#8a5a2b',
};

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
