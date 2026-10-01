import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch } from '../../render/sketch';
import { HAND_FONT } from '../../render/textures';
import { RED_HEX } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Capitolo 10: il condominio di Via della Penna, di notte (carta carbone).
//
// Quattro piani uguali, uno sopra l'altro (H = 3,2 m): a ogni piano un corridoio (x 0..24, z 6..9)
// con le porte degli appartamenti a nord (z 9..14) e a sud (z 1..6).
// Due scale a U:
//   EST (x 24..31): piano terra → 1° e 2° → 3°. Quella dal 1° al 2° è smontata (lavori del signor Chiodo).
//   OVEST (x -7..0): solo 1° → 2°.
// Così per salire al 3° si attraversano tutti i corridoi: il 1° (il cane), il 2° (i lavori, il signor
// Chiodo), il 3° (il neonato). Il pacco è davanti all'interno 11, in fondo al 3° piano.
// Piano terra: androne col portone (x -7), portineria, lavanderia, l'interno 1 (Stecco), l'interno 2
// (Nonna Pina), le cassette della posta, l'ascensore guasto.
//
// Le collisioni sono 2D: ogni piano ha le sue (Colliders.tag/level). floorAt() dà l'altezza del
// pavimento, scegliendo sulle scale la rampa più vicina all'altezza a cui sei.
// ---------------------------------------------------------------------------

export const H = 3.2;
export const LEVELS = 4;
export const CORR = { x0: 0, x1: 24, z0: 6, z1: 9 };
const FZ = 6, MZ = 1, ZS = -1.5, ZN = 10; // pianerottolo da z 6 a 10, mezzo piano da -1.5 a 1, rampe da 1 a 6

// una scala a U: la rampa A sale andando verso sud (dal pianerottolo al mezzo piano), la B sale verso
// nord (dal mezzo piano al pianerottolo di sopra). pairs = i piani da cui parte una rampa che sale.
export interface Well { x0: number; x1: number; mid: number; aWest: boolean; pairs: number[]; floors: number[] }
export const EAST: Well = { x0: 24, x1: 31, mid: 27.5, aWest: false, pairs: [0, 2], floors: [0, 1, 2, 3] };
export const WEST: Well = { x0: -7, x1: 0, mid: -3.5, aWest: true, pairs: [1], floors: [1, 2] };

export const levelOf = (y: number) => Math.max(0, Math.min(LEVELS - 1, Math.round(y / H)));

function wellHeight(w: Well, x: number, z: number, y: number): number | null {
  if (x <= w.x0 || x >= w.x1 || z <= ZS || z >= ZN) return null;
  const cands: number[] = [];
  if (z >= FZ) for (const k of w.floors) cands.push(k * H);
  else if (z <= MZ) for (const k of w.pairs) cands.push(k * H + H / 2);
  else {
    const onA = w.aWest ? x < w.mid : x > w.mid;
    const f = onA ? ((H / 2) * (FZ - z)) / (FZ - MZ) : H / 2 + ((H / 2) * (z - MZ)) / (FZ - MZ);
    for (const k of w.pairs) cands.push(k * H + f);
  }
  let best: number | null = null;
  for (const c of cands) if (best === null || Math.abs(c - y) < Math.abs(best - y)) best = c;
  // lontano da tutte le rampe di questa scala: non ci sei sopra (es. l'androne, sotto la scala ovest)
  if (best === null || Math.abs(best - y) > H * 0.6) return null;
  return best;
}

// altezza del pavimento sotto (x, z) per chi sta all'altezza y
export function floorAt(x: number, z: number, y: number) {
  return wellHeight(EAST, x, z, y) ?? wellHeight(WEST, x, z, y) ?? levelOf(y) * H;
}

// sulle scale? (per il rumore: i gradini scricchiolano al centro, vicino al muro molto meno)
export function onStairs(x: number, z: number) {
  for (const w of [EAST, WEST]) {
    if (x > w.x0 && x < w.x1 && z > MZ && z < FZ) {
      const edge = Math.min(Math.abs(x - w.x0), Math.abs(x - w.x1), Math.abs(x - w.mid));
      return { edge: edge < 0.75 };
    }
  }
  return null;
}

// --- i pavimenti: cosa c'è sotto i piedi (per il rumore) ---
export type Surface = 'tiles' | 'wood' | 'parquet' | 'creak' | 'soft';
interface Patch { x0: number; z0: number; x1: number; z1: number; s: Surface }
const R = (x0: number, z0: number, x1: number, z1: number, s: Surface): Patch => ({ x0, z0, x1, z1, s });
// pavimento di base di ogni piano (piano terra: marmo; 1° e 3°: legno; 2°: parquet nuovo, scricchiola tutto)
export const BASE: Surface[] = ['tiles', 'wood', 'parquet', 'wood'];
export const PATCHES: Patch[][] = [
  // piano terra: zerbini
  [R(11.4, 6.1, 12.6, 6.8, 'soft'), R(19.4, 8.2, 20.6, 8.9, 'soft'), R(-6.8, 6.4, -5.6, 8.6, 'soft')],
  // 1° piano: la passatoia (lungo il lato sud) e le assi segnate; il cane dorme sul suo tappeto
  [
    R(1, 6.15, 15.4, 6.85, 'soft'), R(17.4, 6.15, 23.5, 6.85, 'soft'),
    R(15.4, 6.9, 17.4, 7.5, 'creak'), R(5.2, 6.95, 6.2, 7.45, 'creak'), R(9.2, 7.0, 10.2, 7.45, 'creak'),
    R(19.2, 7.55, 20.2, 8.05, 'creak'), R(2.0, 7.6, 3.0, 8.1, 'creak'), R(21.6, 7.0, 22.6, 7.5, 'creak'),
    R(11.6, 7.7, 13.4, 8.85, 'soft'),
  ],
  // 2° piano: il cartone dei lavori (non fa rumore) fa un percorso tra gli attrezzi
  [
    R(13.4, 6.3, 23.9, 7.1, 'soft'), R(10.2, 6.3, 13.4, 7.1, 'soft'), R(8.0, 7.5, 10.2, 8.6, 'soft'), R(0.5, 6.3, 8.0, 7.1, 'soft'),
    R(-0.5, 6.3, 0.5, 7.1, 'soft'),
  ],
  // 3° piano: il tappeto dei giochi, le assi davanti alla porta del neonato
  [
    R(5, 6.3, 9, 8.6, 'soft'), R(11.3, 7.6, 13.2, 8.2, 'creak'), R(18, 6.8, 19, 7.25, 'creak'), R(14, 6.55, 15, 7.05, 'creak'),
    R(20.8, 7.7, 21.8, 8.2, 'creak'), R(2.3, 7.0, 3.3, 7.45, 'creak'), R(3.2, 8.2, 4.8, 8.85, 'soft'),
  ],
];

export function surfaceAt(x: number, z: number, level: number): Surface {
  for (const p of PATCHES[level]) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return p.s;
  return BASE[level];
}

// gli oggetti che fanno rumore se ci passi sopra o li urti (una volta, poi devi allontanarti)
export interface Prop { id: string; level: number; x: number; z: number; r: number; noise: number; word: string; sound: 'clang' | 'squeak' }
export const PROPS: Prop[] = [
  { id: 'secchio', level: 2, x: 9.5, z: 6.7, r: 0.6, noise: 4.5, word: 'CLANG!', sound: 'clang' },
  { id: 'barattolo', level: 2, x: 17.2, z: 8.3, r: 0.5, noise: 3.2, word: 'TLAN!', sound: 'clang' },
  { id: 'paperella', level: 3, x: 10.5, z: 7.4, r: 0.45, noise: 3.6, word: 'SQUIIK!', sound: 'squeak' },
  { id: 'paperella2', level: 3, x: 16.6, z: 6.75, r: 0.45, noise: 3.6, word: 'SQUIIK!', sound: 'squeak' },
  { id: 'paperella3', level: 3, x: 19.6, z: 8.35, r: 0.45, noise: 3.6, word: 'SQUIIK!', sound: 'squeak' },
];

export const REFS10 = {
  lm: null as LineMaterial | null,
  thin: null as LineMaterial | null,
  fill: null as THREE.Material | null,
  props: {} as Record<string, THREE.Object3D>,
  drop: null as THREE.Mesh | null, // la goccia del rubinetto
  pacco: null as THREE.Group | null, // il pacco sullo zerbino dell'interno 11
  letter: null as THREE.Mesh | null, // la lettera sotto la porta dei Righello
  pantofole: null as THREE.Group | null, // le pantofole sullo zerbino di Nonna Pina
};

export function buildCondominio(): World {
  const b = new WorldBuilder(1010);
  const { S, D, G, col, A, sign, wallText } = b;
  REFS10.lm = b.lineMat(2.2);
  REFS10.thin = b.lineMat(1.4);
  REFS10.fill = b.fill;
  REFS10.props = {};
  const creakMat = b.lineMat(2.4, '#e8b04a');
  const softMat = b.lineMat(1.6, '#c98aa0');
  const CK = new Sketch();
  CK.style = { jitter: 0.01, over: 0 };
  const SO = new Sketch();
  SO.style = { jitter: 0.01, over: 0 };

  const ALL = [0, 1, 2, 3];
  const at = (k: number) => k * H;
  const wall = (x0: number, z0: number, x1: number, z1: number) => b.wall(x0, z0, x1, z1, H);
  // una porta chiusa disegnata sulla parete del corridoio (n = verso il corridoio: +z o -z), con targhetta
  const door = (k: number, x: number, zWall: number, n: 1 | -1, plate: string) => {
    const z = zWall + n * 0.135;
    D.rectV(x - 0.6, at(k), z, 1.2, 2.25, 'x');
    D.circle(x + 0.38, at(k) + 1.05, z, 0.05, 'z', 8);
    wallText(plate, x + 1.1, at(k) + 1.7, z + n * 0.01, 0.75, 0.42, n > 0 ? '+z' : '-z');
  };

  // =========================================================================
  // I SOLAI (pavimenti e soffitti) e le scale
  // =========================================================================
  for (let j = 0; j <= LEVELS; j++) {
    const y = at(j) - 0.2;
    // blocco centrale (corridoio + appartamenti) e il pezzo a nord della scala est (ascensore)
    S.box(12, y, 7.5, 24, 0.2, 13);
    S.box(27.5, y, 12, 7, 0.2, 4);
    // scala est: il pianerottolo a ogni piano; in cima il tetto copre tutto
    if (j < LEVELS) S.box(27.5, y, 8, 7, 0.2, 4);
    else S.box(27.5, y, 4.25, 7, 0.2, 11.5);
    // lato ovest: l'androne al piano terra, sopra la scala ovest (pianerottoli al 1° e 2°, chiuso sopra)
    if (j === 0) S.box(-3.5, y, 7.5, 7, 0.2, 3);
    if (j === 1 || j === 3) S.box(-3.5, y, 4.25, 7, 0.2, 11.5);
    if (j === 2) S.box(-3.5, y, 8, 7, 0.2, 4);
  }
  const flights = (w: Well) => {
    const hw = (w.x1 - w.x0) / 2;
    for (const k of w.pairs) {
      // mezzo piano
      S.box((w.x0 + w.x1) / 2, at(k) + H / 2 - 0.2, (ZS + MZ) / 2, w.x1 - w.x0, 0.2, MZ - ZS);
      const ax = w.aWest ? w.x0 + hw / 2 : w.mid + hw / 2;
      const bx = w.aWest ? w.mid + hw / 2 : w.x0 + hw / 2;
      for (let i = 0; i < 10; i++) {
        const rise = H / 20;
        // rampa A: sale andando verso sud
        const ta = at(k) + (i + 1) * rise;
        S.box(ax, ta - 0.32, FZ - (i + 0.5) * 0.5, hw - 0.1, 0.32, 0.5);
        // rampa B: sale andando verso nord
        const tb = at(k) + H / 2 + (i + 1) * rise;
        S.box(bx, tb - 0.32, MZ + (i + 0.5) * 0.5, hw - 0.1, 0.32, 0.5);
      }
      // il corrimano sul muretto in mezzo
      D.seg(w.mid, at(k) + 0.95, FZ, w.mid, at(k) + H / 2 + 0.95, MZ).seg(w.mid, at(k) + H / 2 + 0.95, MZ, w.mid, at(k) + H + 0.95, FZ);
    }
  };
  flights(EAST);
  flights(WEST);

  // =========================================================================
  // LE PARETI, piano per piano (ogni piano ha le sue collisioni)
  // =========================================================================
  for (const k of ALL) {
    col.tag = k;
    S.push(0, at(k), 0, 0);
    // --- il corridoio: parete sud (continua, porte disegnate) ---
    wall(0, CORR.z0, 24, CORR.z0);
    // --- parete nord: al piano terra con le aperture (lavanderia, interno 1) e la vetrata della portineria ---
    if (k === 0) {
      wall(0, CORR.z1, 2, CORR.z1);
      wall(6, CORR.z1, 11.4, CORR.z1);
      wall(12.6, CORR.z1, 19.4, CORR.z1);
      wall(20.6, CORR.z1, 24, CORR.z1);
      S.box(4, 0, CORR.z1, 4, 0.95, 0.25);
      S.box(4, 2.25, CORR.z1, 4, H - 2.25, 0.25);
      col.box(4, CORR.z1, 4, 0.25);
      for (const x of [12, 20]) S.box(x, 2.3, CORR.z1, 1.2, H - 2.3, 0.25);
    } else wall(0, CORR.z1, 24, CORR.z1);
    // --- le due teste del corridoio ---
    if (k === 0) {
      // l'androne fino al portone
      wall(-7, CORR.z0, 0, CORR.z0);
      wall(-7, CORR.z1, 0, CORR.z1);
      wall(-7, CORR.z0, -7, CORR.z1);
    } else if (k === 3) wall(0, CORR.z0, 0, CORR.z1);
    // --- scala est (uguale a ogni piano) ---
    wall(31, ZS, 31, ZN);
    wall(24, ZS, 31, ZS);
    wall(24, ZN, 31, ZN);
    wall(24, ZS, 24, CORR.z0);
    wall(24, CORR.z1, 24, ZN);
    wall(EAST.mid, MZ + 0.1, EAST.mid, FZ);
    // --- scala ovest (solo al 1° e al 2°) ---
    if (k === 1 || k === 2) {
      wall(-7, ZS, -7, ZN);
      wall(-7, ZS, 0, ZS);
      wall(-7, ZN, 0, ZN);
      wall(0, ZS, 0, CORR.z0);
      wall(0, CORR.z1, 0, ZN);
      wall(WEST.mid, MZ + 0.1, WEST.mid, FZ);
    }
    S.pop();
    col.tag = undefined;
  }
  // le scale che non ci sono: ringhiere e nastri (le collisioni valgono solo a quel piano)
  const barrier = (k: number, x0: number, x1: number, tape: boolean, text: string) => {
    col.tag = k;
    col.rect(x0, FZ - 0.12, x1, FZ + 0.08);
    col.tag = undefined;
    const y = at(k);
    if (tape) {
      const t = new Sketch();
      t.style = { jitter: 0.01, over: 0 };
      t.seg(x0, y + 1.0, FZ, x1, y + 0.95, FZ).seg(x0, y + 0.6, FZ, x1, y + 0.62, FZ);
      b.group.add(t.build(b.lineMat(3, RED_HEX), b.fill));
      S.seg(x0 + 0.05, y, FZ, x0 + 0.05, y + 1.1, FZ).seg(x1 - 0.05, y, FZ, x1 - 0.05, y + 1.1, FZ);
    } else {
      S.seg(x0, y + 1.0, FZ, x1, y + 1.0, FZ);
      for (let x = x0 + 0.3; x < x1; x += 0.35) S.seg(x, y, FZ, x, y + 1.0, FZ, { over: 0 });
    }
    sign(text, (x0 + x1) / 2, y + 1.3, FZ + 0.06, 1.7, 0.42, '+z', { font: HAND_FONT });
  };
  barrier(0, 24.1, EAST.mid, false, 'CANTINE\n(chiuse di notte)');
  barrier(1, EAST.mid, 30.9, true, 'SCALA CHIUSA: LAVORI\nusare la scala in fondo');
  barrier(2, 24.1, EAST.mid, true, 'SCALA SMONTATA\n(dal signor Chiodo)');
  barrier(3, EAST.mid, 30.9, false, 'TETTO\n(vietato, anche di giorno)');
  barrier(1, WEST.mid, -0.1, false, 'CANTINA\n(chiusa)');
  barrier(2, -6.9, WEST.mid, false, 'SOFFITTA\n(chiusa)');
  // la scala smontata: dal 1° piano si vede il buco (qualche gradino appoggiato)
  S.box(29.2, at(1), 3.2, 1.0, 0.25, 2.0);

  // =========================================================================
  // I PAVIMENTI DEL CORRIDOIO: assi, marmo, passatoie (e le assi che scricchiolano, segnate)
  // =========================================================================
  for (const k of ALL) {
    const y = at(k) + 0.012;
    const x0 = k === 0 ? -7 : 0;
    if (BASE[k] === 'tiles') {
      for (let x = x0 + 0.75; x < 24; x += 0.75) G.seg(x, y, CORR.z0 + 0.13, x, y, CORR.z1 - 0.13, { over: 0 });
      G.seg(x0, y, 7.5, 24, y, 7.5, { over: 0 });
    } else {
      for (let z = CORR.z0 + 0.4; z < CORR.z1 - 0.1; z += 0.4) G.seg(0, y, z, 24, y, z, { over: 0 });
      for (let x = 1.2; x < 24; x += 2.4) for (let z = CORR.z0 + 0.4; z < CORR.z1 - 0.3; z += 0.8) G.seg(x + (z * 3) % 1.2, y, z, x + (z * 3) % 1.2, y, z + 0.4, { over: 0 });
    }
    for (const p of PATCHES[k]) {
      const yy = y + 0.004;
      if (p.s === 'creak') {
        // asse segnata: contorno giallo e le crepe
        CK.poly([[p.x0, yy, p.z0], [p.x1, yy, p.z0], [p.x1, yy, p.z1], [p.x0, yy, p.z1]], true);
        const mx = (p.x0 + p.x1) / 2, mz = (p.z0 + p.z1) / 2;
        CK.seg(mx - 0.25, yy, mz - 0.08, mx - 0.05, yy, mz + 0.06).seg(mx - 0.05, yy, mz + 0.06, mx + 0.2, yy, mz - 0.05);
      } else {
        // tappeti, passatoie, cartone: contorno e qualche riga (dove non fa rumore)
        SO.poly([[p.x0, yy, p.z0], [p.x1, yy, p.z0], [p.x1, yy, p.z1], [p.x0, yy, p.z1]], true);
        for (let x = p.x0 + 0.25; x < p.x1 - 0.1; x += 0.5) SO.seg(x, yy, p.z0 + 0.08, x, yy, p.z1 - 0.08, { over: 0 });
      }
    }
  }
  b.group.add(CK.build(creakMat, b.fill));
  b.group.add(SO.build(softMat, b.fill));

  // =========================================================================
  // PIANO TERRA
  // =========================================================================
  {
    // il portone, i cartelli dell'androne
    D.rectV(-6.87, 0, 6.6, 1.8, 2.6, 'z');
    D.seg(-6.87, 0, 7.5, -6.87, 2.6, 7.5);
    sign('REGOLAMENTO CONDOMINIALE\nart. 1: dopo le 22 si cammina col pensiero', -3.5, 2.1, CORR.z1 - 0.14, 3.6, 0.8, '-z', { font: HAND_FONT });
    sign('VIA DELLA PENNA, 3\n"Qui la gomma non passa"', -3.5, 2.1, CORR.z0 + 0.14, 3, 0.7, '+z', { font: HAND_FONT });
    // le cassette della posta (parete sud)
    for (let i = 0; i < 12; i++) {
      const cx = 1.6 + (i % 6) * 0.55, cy = 1.15 + Math.floor(i / 6) * 0.42;
      D.rectV(cx - 0.24, cy, CORR.z0 + 0.14, 0.48, 0.36, 'x');
      D.seg(cx - 0.15, cy + 0.26, CORR.z0 + 0.15, cx + 0.15, cy + 0.26, CORR.z0 + 0.15, { over: 0 });
    }
    wallText('POSTA', 3, 2.15, CORR.z0 + 0.15, 1, 0.3, '+z');
    // la portineria: vetrata, dentro la scrivania e la lampada
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.3), new THREE.MeshBasicMaterial({ color: '#7fa0d8', transparent: true, opacity: 0.18, depthWrite: false }));
    glass.position.set(4, 1.6, CORR.z1);
    b.group.add(glass);
    D.rectV(2, 0.95, CORR.z1 - 0.13, 4, 1.3, 'x');
    wallText('PORTINERIA', 4, 2.55, CORR.z1 - 0.14, 1.8, 0.35, '-z');
    wall(0, 9, 0, 14);
    wall(0, 14, 8, 14);
    wall(8, 9, 8, 14);
    S.box(3.6, 0, 11.0, 2.4, 0.8, 0.9);
    S.seg(4.5, 0.8, 11.1, 4.5, 1.35, 11.1);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ color: '#f2d58c', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    lamp.position.set(4.5, 1.42, 11.08);
    b.group.add(lamp);
    // le porte: interno 2 (Nonna Pina, a sud), l'ascensore guasto
    door(0, 12, CORR.z0, 1, 'int. 2\nPina');
    // sullo zerbino di Nonna Pina: due pantofole di feltro e un biglietto
    {
      const pf = new Sketch();
      pf.style = { jitter: 0.004, over: 0 };
      for (const dx of [-0.16, 0.16]) {
        const pts: [number, number, number][] = [];
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          pts.push([dx + Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.17]);
        }
        pf.curve(pts);
        pf.seg(dx - 0.08, 0.05, -0.05, dx + 0.08, 0.05, -0.05);
      }
      pf.poly([[0.32, 0.02, -0.12], [0.55, 0.02, -0.12], [0.55, 0.02, 0.05], [0.32, 0.02, 0.05]], true);
      const pg = new THREE.Group();
      pg.add(pf.build(b.lineMat(2, '#c98aa0'), b.fill));
      pg.position.set(12, 0.01, 6.5);
      b.group.add(pg);
      REFS10.pantofole = pg;
    }
    D.rectV(19.4, 0, CORR.z0 + 0.14, 1.2, 2.25, 'x');
    D.seg(20, 0, CORR.z0 + 0.14, 20, 2.25, CORR.z0 + 0.14);
    sign('ASCENSORE\nGUASTO (dal giorno del trasloco)', 20, 2.55, CORR.z0 + 0.15, 1.9, 0.5, '+z', { font: HAND_FONT });
    // --- la lavanderia (x 8..16) ---
    wall(8, 14, 16, 14);
    wall(16, 9, 16, 14);
    wallText('LAVANDERIA\n(non lavare dopo le 22)', 13.8, 2.55, CORR.z1 - 0.14, 2, 0.5, '-z');
    for (const x of [9.2, 10.6]) {
      b.solid(x, 13.3, 1.1, 1.0, 1.0);
      D.circle(x, 0.55, 12.79, 0.3, 'z', 14).circle(x, 0.55, 12.79, 0.18, 'z', 12);
    }
    b.solid(14.6, 13.6, 1.4, 0.6, 0.9);
    S.seg(14.6, 0.9, 13.8, 14.6, 1.25, 13.8).seg(14.6, 1.25, 13.8, 14.6, 1.25, 13.55);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#9fc0f0' }));
    drop.position.set(14.6, 1.2, 13.55);
    b.group.add(drop);
    REFS10.drop = drop;
    // --- l'interno 1: casa di Stecco (x 16..24), quasi vuota ---
    wall(16, 14, 24, 14);
    wall(24, ZN, 24, 14);
    wallText('int. 1\nStecco (nuovo)', 21.1, 1.7, CORR.z1 - 0.135, 0.75, 0.42, '-z');
    b.solid(21.8, 12.6, 2.0, 1.3, 0.25, 0, true, true); // il materasso, per terra
    D.box(22.6, 0.25, 12.6, 0.45, 0.12, 1.1);
    for (const [x, z, s] of [[17.2, 13.2, 0.7], [17.9, 13.3, 0.6], [17.4, 12.4, 0.5]] as [number, number, number][]) b.solid(x, z, s, s, s * 0.8);
    wallText('SCATOLONI\n(roba di Stecco)', 17.6, 1.2, 13.86, 1.3, 0.35, '-z');
    D.window(18.6, 1.1, 13.86, 1.6, 1.3, 'x');
    b.litPane(19.4, 1.75, 13.87, 1.55, 1.25, Math.PI, new THREE.MeshBasicMaterial({ color: '#33406a' }));
  }

  // =========================================================================
  // 1° PIANO: il cane che dorme sul tappeto, la scarpiera
  // =========================================================================
  {
    const k = 1, y = at(k);
    door(k, 4, CORR.z1, -1, 'int. 3\nTratteggi');
    door(k, 12, CORR.z1, -1, 'int. 4\nCroccante');
    door(k, 20, CORR.z1, -1, 'int. 5\nGomitolo');
    door(k, 8, CORR.z0, 1, 'int. 6\nVirgola');
    door(k, 17, CORR.z0, 1, 'int. 7\n(sfitto)');
    col.tag = k;
    b.solid(16.4, 6.35, 1.5, 0.5, 0.9, y); // la scarpiera, in mezzo alla passatoia
    col.tag = undefined;
    for (let i = 0; i < 3; i++) D.seg(15.8 + i * 0.5, y + 0.92, 6.4, 16.1 + i * 0.5, y + 0.92, 6.45);
    sign('ATTENTI AL CANE\n(che dorme)', 12, y + 2.5, CORR.z1 - 0.14, 1.8, 0.5, '-z', { font: HAND_FONT });
    // la ciotola
    S.cylinder(13.9, y, 8.5, 0.18, 0.08, 10);
  }

  // =========================================================================
  // 2° PIANO: i lavori del signor Chiodo (scala a pioli, secchio, barattoli, cartone per terra)
  // =========================================================================
  {
    const k = 2, y = at(k);
    door(k, 4, CORR.z0, 1, 'int. 8\nRighello');
    door(k, 12, CORR.z1, -1, 'int. 9\nSpillo');
    door(k, 20, CORR.z1, -1, 'int. 10\nChiodo');
    door(k, 16, CORR.z0, 1, 'int. 11\n(vuoto)');
    sign('LAVORI IN CORSO\nscusate il disturbo (di giorno)', 6, y + 2.5, CORR.z1 - 0.14, 2.6, 0.6, '-z', { font: HAND_FONT });
    col.tag = k;
    // la scala a pioli, aperta, che occupa metà corridoio
    col.rect(12, 7.25, 13.1, 8.85);
    col.circle(9.5, 6.7, 0.18);
    col.circle(17.2, 8.3, 0.14);
    col.circle(6, 8.4, 0.16);
    col.tag = undefined;
    const L = new Sketch();
    L.style = { jitter: 0.004, over: 0.02 };
    L.seg(12.1, y, 7.3, 12.55, y + 2.2, 8.05).seg(12.1, y, 8.8, 12.55, y + 2.2, 8.05);
    L.seg(13.0, y, 7.3, 12.55, y + 2.2, 8.05).seg(13.0, y, 8.8, 12.55, y + 2.2, 8.05);
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      L.seg(12.1 + 0.45 * t, y + 2.2 * t, 7.3 + 0.75 * t, 12.1 + 0.45 * t, y + 2.2 * t, 8.8 - 0.75 * t);
    }
    b.group.add(L.build(REFS10.lm, b.fill));
    // il secchio e i barattoli di vernice
    const sec = new Sketch();
    sec.style = { jitter: 0.004, over: 0.01 };
    sec.cylinder(0, 0, 0, 0.18, 0.35, 12);
    sec.curve([[-0.18, 0.35, 0], [-0.1, 0.5, 0], [0.1, 0.5, 0], [0.18, 0.35, 0]]);
    const secG = new THREE.Group();
    secG.add(sec.build(REFS10.lm, b.fill));
    secG.position.set(9.5, y, 6.7);
    b.group.add(secG);
    REFS10.props.secchio = secG;
    const can = (x: number, z: number, id?: string) => {
      const c = new Sketch();
      c.style = { jitter: 0.004, over: 0.01 };
      c.cylinder(0, 0, 0, 0.14, 0.22, 10);
      const g = new THREE.Group();
      g.add(c.build(REFS10.lm!, b.fill));
      g.position.set(x, y, z);
      b.group.add(g);
      if (id) REFS10.props[id] = g;
    };
    can(17.2, 8.3, 'barattolo');
    can(6, 8.4);
    // la cassetta degli attrezzi (col martello)
    b.solid(22.8, 8.5, 0.8, 0.4, 0.3, y);
  }

  // =========================================================================
  // 3° PIANO: il neonato, la carrozzina, le paperelle di gomma, il pacco
  // =========================================================================
  {
    const k = 3, y = at(k);
    door(k, 4, CORR.z1, -1, 'int. 12\nVolpe');
    door(k, 12, CORR.z1, -1, 'int. 13\nCulla');
    door(k, 20, CORR.z1, -1, 'int. 14\nMatitoni');
    door(k, 8, CORR.z0, 1, 'int. 15\nSquadretta');
    door(k, 17, CORR.z0, 1, 'int. 16\nBis');
    sign('SILENZIO: C\'È UN NEONATO\n(int. 13, dorme poco e sente tutto)', 14.5, y + 2.5, CORR.z1 - 0.14, 3, 0.6, '-z', { font: HAND_FONT });
    // la carrozzina
    col.tag = k;
    col.rect(13.0, 7.75, 14.3, 8.75);
    col.tag = undefined;
    S.push(13.65, y, 8.25, 0);
    S.box(0, 0.45, 0, 1.1, 0.45, 0.7);
    S.curve([[-0.55, 0.9, -0.35], [-0.6, 1.25, -0.2], [-0.55, 1.4, 0], [-0.6, 1.25, 0.2], [-0.55, 0.9, 0.35]]);
    for (const [wx, wz] of [[-0.4, -0.38], [0.4, -0.38], [-0.4, 0.38], [0.4, 0.38]]) S.circle(wx, 0.22, wz, 0.2, 'z', 12);
    S.seg(0.55, 0.9, 0, 0.85, 1.25, 0);
    S.pop();
    // le paperelle di gomma (gialle: sono giocattoli, i colori li hanno i bambini)
    const duckMat = new THREE.MeshBasicMaterial({ color: '#f2c200' });
    for (const p of PROPS.filter((p) => p.sound === 'squeak')) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), duckMat);
      body.scale.set(1.3, 0.8, 1);
      body.position.y = 0.09;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), duckMat);
      head.position.set(0.1, 0.2, 0);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 6), new THREE.MeshBasicMaterial({ color: '#e8791e' }));
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.18, 0.19, 0);
      g.add(body, head, beak);
      g.position.set(p.x, y, p.z);
      g.rotation.y = p.x * 1.3;
      b.group.add(g);
      REFS10.props[p.id] = g;
    }
    // il pacco, sullo zerbino dell'interno 12 (quello sbagliato: l'1 e il 12 si assomigliano)
    const pk = new Sketch();
    pk.style = { jitter: 0.005, over: 0.015 };
    pk.box(0, 0, 0, 0.7, 0.5, 0.5);
    pk.seg(-0.35, 0.5, 0, 0.35, 0.5, 0).seg(0, 0.5, -0.25, 0, 0.5, 0.25);
    const pg = new THREE.Group();
    pg.add(pk.build(REFS10.lm, b.fill));
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), new THREE.MeshBasicMaterial({ color: '#e9e2c6' }));
    label.position.set(0, 0.3, -0.255);
    label.rotation.y = Math.PI;
    pg.add(label);
    pg.position.set(4, y, 8.45);
    b.group.add(pg);
    REFS10.pacco = pg;
  }

  // =========================================================================
  // SCALE: finestre sul mezzo piano (fuori è notte), vasi sui pianerottoli
  // =========================================================================
  for (const w of [EAST, WEST]) {
    for (const k of w.pairs) {
      const y = at(k) + H / 2;
      const xw = w === EAST ? w.x1 - 0.14 : w.x0 + 0.14;
      D.window(xw, y + 0.9, -0.95, 1.4, 1.3, 'z');
      b.litPane(xw + (w === EAST ? 0.005 : -0.005), y + 1.55, -0.25, 1.36, 1.26, w === EAST ? -Math.PI / 2 : Math.PI / 2, new THREE.MeshBasicMaterial({ color: '#34406c' }));
    }
  }
  for (const k of [0, 2]) {
    S.cylinder(30.4, at(k), 9.5, 0.22, 0.4, 10);
    D.curve([[30.4, at(k) + 0.4, 9.5], [30.2, at(k) + 0.9, 9.4], [30.5, at(k) + 1.2, 9.6]]).curve([[30.4, at(k) + 0.4, 9.5], [30.7, at(k) + 0.85, 9.45]]);
  }
  // lo sgabello pieghevole del signor Gufo (sul mezzo piano della scala ovest), col libro e la torcia
  S.push(0, at(1) + H / 2, 0, 0);
  D.push(0, at(1) + H / 2, 0, 0);
  b.stool(-1.6, -0.4);
  S.box(-0.9, 0, -0.9, 0.3, 0.12, 0.22);
  D.pop();
  S.pop();
  // i numeri dei piani sui pianerottoli
  for (const k of ALL) {
    wallText(k === 0 ? 'PIANO TERRA' : `${k}° PIANO`, 27.5, at(k) + 2.4, ZN - 0.14, 1.6, 0.4, '-z');
    if (k === 1 || k === 2) wallText(`${k}° PIANO`, -3.5, at(k) + 2.4, ZN - 0.14, 1.6, 0.4, '-z');
  }

  // =========================================================================
  // PUNTI NOTEVOLI
  // =========================================================================
  A('spawn', 21.2, 0, 11.6);
  A('spawnLook', 20, 1.1, 9);
  A('portinaia', 3.4, 0, 12.2);
  A('dog', 12.5, at(1), 8.3);
  A('chiodo', 20, at(2), 9);
  A('neonato', 12, at(3), 9);
  A('pacco', 4, at(3) + 0.3, 8.45);
  A('pinaDoor', 12, 0, 6);
  A('mailbox', 2.15, 1.35, CORR.z0 + 0.15);
  A('tap', 14.6, 1.1, 13.5);
  A('righelloDoor', 4, at(2), CORR.z0);
  A('home', 20, 0, 9.6);
  A('gufo', -1.6, at(1) + H / 2 + 0.2, -0.4); // seduto sul suo sgabello pieghevole
  for (const k of ALL) A(`east${k}`, 27.5, at(k), 8);
  A('west1', -3.5, at(1), 8);
  A('west2', -3.5, at(2), 8);

  return b.finish({ isIndoor: () => true, fog: [26, 70] });
}
