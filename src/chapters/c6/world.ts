import * as THREE from 'three';
import { Sketch, makeHatchMaterial } from '../../render/sketch';
import { HAND_FONT, MARKER_FONT, bushTexture, cloudTexture, crownTexture, sunTexture, textTexture } from '../../render/textures';
import { BLUE_HEX, CERA, INK_HEX, RED_HEX, THEME, makeRng } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';
import { ROAD, S } from './road';
import { buildLucaCar, buildScatola, type CarModel } from './car';

// ---------------------------------------------------------------------------
// Capitolo 6: dalla cima di Quadropoli a San Scarabocchio. Carta millimetrata.
//
//   la Piazza del Righello (y = 0)      x -23..23, z -30..20: si cammina, c'è la macchina di Luca
//   la strada (road.ts)                 1300 metri di discesa, tornanti, mercato, ponte, salita...
//   in fondo, sulla pagina (BASE_Y)     il Parallelepipedo, il pub di Dario e il parco
//
// Fuori dalla strada il foglio non è disegnato: i pendii finiscono in pareti dritte fino alla pagina.
// La strada è divisa in pezzi da 100 metri (CHUNKS): quelli lontani non si disegnano.
// ---------------------------------------------------------------------------

export const BASE_Y = ROAD.y[ROAD.n - 1] - 0.12; // la pagina, in fondo alla discesa

export interface Chunk { group: THREE.Group; c: THREE.Vector3; r: number }
// ostacolo sulla strada, in coordinate stradali (s lungo la strada, d di lato)
export interface Obstacle { s0: number; s1: number; d0: number; d1: number; kind: 'car' | 'crates' | 'stall' | 'erased' | 'barrier'; name: string }
export interface Mailbox { s: number; d: number; pos: THREE.Vector3; flag: THREE.Object3D; done: boolean }
export interface CapSpot { s: number; d: number; sprite: THREE.Sprite; taken: boolean }
export interface Cone { s: number; d: number; obj: THREE.Group; hit: boolean; vel: THREE.Vector3; spin: number }

export const REFS = {
  chunks: [] as Chunk[],
  obstacles: [] as Obstacle[],
  mailboxes: [] as Mailbox[],
  caps: [] as CapSpot[],
  cones: [] as Cone[],
  sky: null as THREE.Group | null,
  park: new THREE.Vector3(),
  bench: new THREE.Vector3(), // dove c'era la panchina di Arturo
  crumbs: null as THREE.Group | null,
  car: null as CarModel | null,
  scatola: null as THREE.Group | null,
  lmD: null as import('three/examples/jsm/lines/LineMaterial.js').LineMaterial | null,
};

// Pezzi di strada da non disegnare "a macchina" (li disegna la piazza)
const PIAZZA_ROAD_END = 14;
const HOUSES_FROM = 24;

export function buildConsegna(): World {
  REFS.chunks = [];
  REFS.obstacles = [];
  REFS.mailboxes = [];
  REFS.caps = [];
  REFS.cones = [];
  const b = new WorldBuilder(606);
  const r = makeRng(66);
  const rnd = (a: number, c: number) => a + (c - a) * r();
  const lmS = b.lineMat(2.4);
  const lmD = b.lineMat(1.5);
  const lmG = b.lineMat(1.8);
  const fill = b.fill;
  const inkFill = new THREE.MeshBasicMaterial({ color: INK_HEX === THEME.inkHex ? INK_HEX : THEME.inkHex });
  const blueFill = new THREE.MeshBasicMaterial({ color: BLUE_HEX });
  const crownMats = [0, 1, 2, 3].map((i) => {
    const m = new THREE.SpriteMaterial({ map: crownTexture(60 + i), alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  });
  const bushMats = [0, 1].map((i) => {
    const m = new THREE.SpriteMaterial({ map: bushTexture(70 + i), alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  });
  const capMats = [CERA.rosso, CERA.blu, CERA.verde, '#e0b400'].map((c) => {
    const m = new THREE.SpriteMaterial({ map: capTexture(c), alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  });

  // posizione nel mondo a (s, d) e h sopra l'asfalto
  const P = (s: number, d: number, h = 0) => ROAD.point(s, d, h);
  // rotazione di un oggetto che guarda la strada dal lato "side" (+1 sinistra, -1 destra):
  // il suo +z locale punta lontano dalla strada
  const awayRot = (s: number, side: number) => {
    const th = ROAD.at(s).th;
    return Math.atan2(side * Math.cos(th), -side * Math.sin(th));
  };

  // cartello scritto a mano appeso a un gruppo (orientato con rot)
  const signTo = (parent: THREE.Object3D, text: string, pos: THREE.Vector3, rot: number, w: number, h: number, opts: Parameters<typeof textTexture>[1] = {}) => {
    const holder = new THREE.Group();
    holder.position.copy(pos);
    holder.rotation.y = rot;
    const tex = textTexture(text, { w: 512, h: Math.round((512 * h) / w), border: true, bg: THEME.paperHex, font: HAND_FONT, ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    holder.add(m);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: THEME.paperHex }));
    back.rotation.y = Math.PI;
    back.position.z = -0.01;
    holder.add(back);
    parent.add(holder);
    return holder;
  };
  // cartello su palo al bordo della strada, rivolto verso chi arriva
  const roadSign = (chunk: THREE.Group, Sk: Sketch, s: number, side: number, text: string, w = 2.6, h = 1.3) => {
    const p = ROAD.at(s);
    const d = side * (p.hw + 0.9);
    const base = P(s, d);
    Sk.seg(base.x, base.y, base.z, base.x, base.y + 1.5, base.z, { over: 0.03 });
    // guarda verso chi sale la strada: normale verso -heading
    signTo(chunk, text, base.clone().setY(base.y + 1.5 + h / 2), p.th + Math.PI, w, h);
  };

  // =========================================================================
  // I PEZZI SPECIALI
  // =========================================================================
  const HL_PINK = '#ff5fa8';
  const SHOP_NAMES = ['Ferramenta Il Cubo', 'Pizzeria Quadrata', 'Lavanderia Angolo Retto', 'Tabacchi', 'Merceria Quadrettata', 'Bar Novanta Gradi', 'Fioraio', 'Calzolaio', 'Edicola', 'Frutta e Verdura'];
  const SPECIAL_HOUSES = [
    { s: S.dario, side: -1, len: 12, h: 7, sign: 'DA DARIO · pub · freccette', dark: false, neon: undefined as string | undefined },
    { s: S.fluo, side: 1, len: 16, h: 13, sign: undefined as string | undefined, dark: true, neon: 'Il Parallelepipedo' },
  ];

  type Feature = { s: number; draw: (chunk: THREE.Group, Sk: Sketch, Dk: Sketch, Gk: Sketch) => void };
  const FEATURES: Feature[] = [];
  const feat = (s: number, draw: Feature['draw']) => FEATURES.push({ s, draw });

  // --- la Via Ripida ---
  feat(34, (c, Sk) => roadSign(c, Sk, 34, -1, 'VIA RIPIDA\npendenza 10%\n(misurata a occhio)', 2.4, 1.5));
  for (const [s, d] of [[62, -4.3], [98, 4.4], [150, -4.3], [192, 4.4], [236, -4.3]] as const) feat(s, (_c, Sk, Dk) => parkedCar(Sk, Dk, s, d));
  for (const [s, side] of [[74, 1], [118, -1], [168, 1], [214, -1]] as const) feat(s, (c, Sk) => mailbox(c, Sk, s, side));
  for (const [s, d] of [[46, 1.5], [82, -1.2], [108, 2.6], [135, 0], [176, -2.4], [205, 1.2], [248, 0.5]] as const) feat(s, (c) => cap(c, s, d));

  // --- la piazzola dell'autostop ---
  feat(S.barnie - 8, (c, Sk) => roadSign(c, Sk, S.barnie - 8, -1, 'Fermata autostop\n(non ufficiale)', 2.4, 1.2));
  feat(S.barnie + 6, (_c, Sk) => {
    // panchina sulla piazzola
    const p = P(S.barnie + 6, -6.7);
    Sk.push(p.x, p.y, p.z, ROAD.at(S.barnie + 6).th + Math.PI / 2);
    Sk.box(0, 0.42, 0, 1.8, 0.07, 0.5).box(0, 0.55, -0.24, 1.8, 0.45, 0.06);
    for (const bx of [-0.8, 0.8]) Sk.seg(bx, 0, 0.2, bx, 0.42, 0.2).seg(bx, 0, -0.22, bx, 0.42, -0.22);
    Sk.pop();
  });

  // --- i tornanti ---
  feat(S.tornanti - 4, (c, Sk) => roadSign(c, Sk, S.tornanti - 4, -1, 'TORNANTI\nrallentare. sul serio.', 2.6, 1.3));
  feat(S.tornanti + 60, (c, Sk) => roadSign(c, Sk, S.tornanti + 60, 1, 'TORNANTE 2\n(il primo era peggio)', 2.6, 1.3));
  for (const [s, d] of [[318, 0], [352, 2], [404, -1.5], [458, 1.5], [505, 0]] as const) feat(s, (c) => cap(c, s, d));

  // --- il mercato ---
  feat(S.mercato + 4, (c, Sk) => roadSign(c, Sk, S.mercato + 4, -1, 'MERCATO\nandare a passo d\'uomo\n(o di omino)', 2.6, 1.5));
  for (let s = S.mercato + 12; s < S.ponte - 12; s += 11) {
    for (const side of [1, -1]) {
      if (r() < 0.25) continue;
      feat(s, (_c, Sk, Dk) => stall(Sk, Dk, s + rnd(-2, 2), side));
    }
  }
  function stall(Sk: Sketch, Dk: Sketch, s: number, side: number) {
    const p = ROAD.at(s);
    const at = P(s, side * (p.hw + 1.4), 0.15);
    Sk.push(at.x, at.y, at.z, p.th);
    Sk.box(0, 0, 0, 1.8, 0.9, 3).box(0, 0.9, 0, 1.9, 0.08, 3.1);
    for (const z of [-1.4, 1.4]) for (const x of [-0.85, 0.85]) Sk.seg(x, 0.9, z, x, 2.3, z, { over: 0.02 });
    Sk.poly([[-1.2, 2.3, -1.6], [1.2, 2.5, -1.6], [1.2, 2.5, 1.6], [-1.2, 2.3, 1.6]], true);
    Sk.pop();
    Dk.push(at.x, at.y, at.z, p.th);
    for (let i = 0; i < 6; i++) Dk.circle(rnd(-0.6, 0.6), 1.08, rnd(-1.2, 1.2), rnd(0.1, 0.18), 'y', 8);
    for (let z = -1.5; z <= 1.5; z += 0.5) Dk.seg(-1.2 + 0.0, 2.3, z, 1.2, 2.5, z, { over: 0 });
    Dk.pop();
  }
  // una pila di cassette e il carretto del pesce: occupano la strada
  feat(S.mercato + 46, (_c, Sk) => {
    const s = S.mercato + 46, d = 3.6;
    for (let k = 0; k < 3; k++) {
      const p = P(s + (k - 1) * 0.9, d, 0);
      Sk.push(p.x, p.y, p.z, ROAD.at(s).th);
      Sk.box(0, 0, 0, 1.2, 0.5, 0.8).box(0.1, 0.5, 0.05, 1.1, 0.5, 0.75);
      Sk.pop();
    }
    REFS.obstacles.push({ s0: s - 1.9, s1: s + 1.9, d0: d - 0.8, d1: d + 1.2, kind: 'crates', name: 'le cassette della frutta' });
  });
  feat(S.mercato + 98, (_c, Sk, Dk) => {
    const s = S.mercato + 98, d = -3.8;
    const p = P(s, d);
    Sk.push(p.x, p.y, p.z, ROAD.at(s).th);
    Sk.box(0, 0.35, 0, 1.6, 0.7, 2.8);
    Sk.pop();
    Dk.push(p.x, p.y, p.z, ROAD.at(s).th);
    for (const z of [-0.9, 0.9]) Dk.circle(0.82, 0.35, z, 0.33, 'x', 12);
    for (let i = 0; i < 5; i++) Dk.poly([[-0.5 + i * 0.25, 1.1, -0.9], [-0.35 + i * 0.25, 1.15, 0], [-0.5 + i * 0.25, 1.1, 0.9]]);
    Dk.pop();
    REFS.obstacles.push({ s0: s - 1.6, s1: s + 1.6, d0: d - 1.0, d1: d + 1.0, kind: 'stall', name: 'il carretto del pesce' });
  });
  // strisce pedonali (la nonna attraversa qui)
  feat(S.mercato + 72, (_c, _Sk, _Dk, Gk) => {
    const s = S.mercato + 72;
    const hw = ROAD.at(s).hw;
    for (let d = -hw + 0.4; d < hw - 0.4; d += 1.1) {
      const a = P(s - 1.5, d, 0.02), b2 = P(s + 1.5, d, 0.02), c = P(s + 1.5, d + 0.55, 0.02), e = P(s - 1.5, d + 0.55, 0.02);
      Gk.poly([[a.x, a.y, a.z], [b2.x, b2.y, b2.z], [c.x, c.y, c.z], [e.x, e.y, e.z]], true, { over: 0 });
    }
  });
  for (const [s, d] of [[S.mercato + 20, -1], [S.mercato + 60, 1.5], [S.mercato + 120, -0.5]] as const) feat(s, (c) => cap(c, s, d));

  // --- il ponte ---
  feat(S.ponte + 3, (c, Sk) => roadSign(c, Sk, S.ponte + 3, 1, 'PONTE PROVVISORIO\nsotto: ancora da disegnare', 2.8, 1.3));
  for (let s = S.ponte + 10; s < S.salita - 5; s += 20) {
    feat(s, (_c, Sk) => {
      for (const side of [1, -1]) {
        const top = P(s, side * 4.2);
        Sk.seg(top.x, top.y, top.z, top.x, BASE_Y, top.z, { over: 0 });
        const top2 = P(s + 1.2, side * 4.2);
        Sk.seg(top2.x, top2.y, top2.z, top2.x, BASE_Y, top2.z, { over: 0 });
      }
      // arcata sotto il ponte
      const a = P(s, 0, -0.4), c = P(s - 10, 0, -4), e = P(s + 10, 0, -4);
      Sk.curve([[c.x, c.y, c.z], [a.x, a.y - 0.1, a.z], [e.x, e.y, e.z]]);
    });
  }
  feat(S.ponte + 40, (_c, Sk) => {
    // fianchi del ponte: una fascia piena sotto l'asfalto
    const pts: number[] = [];
    for (let i = S.ponte; i < S.salita; i++) {
      for (const side of [1, -1]) {
        const a = P(i, side * 5.6), c = P(i + 1, side * 5.6), a2 = P(i, side * 5.6, -1.2), c2 = P(i + 1, side * 5.6, -1.2);
        pts.push(a.x, a.y, a.z, c.x, c.y, c.z, c2.x, c2.y, c2.z, a.x, a.y, a.z, c2.x, c2.y, c2.z, a2.x, a2.y, a2.z);
      }
      const l = P(i, 5.6, -1.2), rr2 = P(i, -5.6, -1.2), l2 = P(i + 1, 5.6, -1.2), r2 = P(i + 1, -5.6, -1.2);
      pts.push(l.x, l.y, l.z, l2.x, l2.y, l2.z, r2.x, r2.y, r2.z, l.x, l.y, l.z, r2.x, r2.y, r2.z, rr2.x, rr2.y, rr2.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.computeVertexNormals();
    _c.add(new THREE.Mesh(geo, fill));
    for (const side of [1, -1]) {
      for (let i = S.ponte; i < S.salita; i += 2) {
        const a = P(i, side * 5.6, -1.2), c = P(i + 2, side * 5.6, -1.2);
        Sk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
      }
    }
  });

  // --- la salita ---
  feat(S.salita + 3, (c, Sk) => roadSign(c, Sk, S.salita + 3, -1, 'SALITA 5%\nprendete la rincorsa', 2.4, 1.2));
  for (const [s, d] of [[S.salita + 40, -2], [S.salita + 85, 2]] as const) feat(s, (c) => cap(c, s, d));
  feat(S.cresta + 2, (c, Sk) => roadSign(c, Sk, S.cresta + 2, 1, 'San Scarabocchio ↓\nda qui è tutta discesa', 2.8, 1.3));

  // --- la grande discesa ---
  for (const [s, side] of [[930, -1], [972, 1], [1190, 1], [1238, -1]] as const) feat(s, (c, Sk) => mailbox(c, Sk, s, side));
  for (const [s, d] of [[912, 1], [948, -2], [988, 2], [1040, 0], [1080, -1.5], [1100, 2]] as const) feat(s, (c) => cap(c, s, d));
  feat(S.gregge - 30, (c, Sk) => roadSign(c, Sk, S.gregge - 30, -1, 'ATTENZIONE\npecore (nuvole con le gambe)', 2.8, 1.3));

  // --- il cantiere: metà strada cancellata ---
  feat(S.cantiere - 22, (c, Sk) => roadSign(c, Sk, S.cantiere - 22, -1, 'LAVORI IN CORSO\nstanotte qui la strada è stata cancellata.\nla stiamo ridisegnando.', 3.2, 1.6));
  feat(S.cantiere, (chunk, Sk, Dk) => {
    // la metà cancellata: foglio più bianco del foglio (niente quadretti, niente niente)
    const pts: number[] = [];
    for (let i = 1118; i < 1168; i++) {
      const a = P(i, 0, -0.03), c = P(i + 1, 0, -0.03), a2 = P(i, ROAD.hw[i] + 0.4, -0.03), c2 = P(i + 1, ROAD.hw[i + 1] + 0.4, -0.03);
      pts.push(a.x, a.y, a.z, c.x, c.y, c.z, c2.x, c2.y, c2.z, a.x, a.y, a.z, c2.x, c2.y, c2.z, a2.x, a2.y, a2.z);
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    chunk.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ color: '#fffdf8', side: THREE.DoubleSide })));
    // bordo della cancellatura: frastagliato, con le briciole di gomma
    for (let i = 1118; i < 1168; i++) {
      const a = P(i, rnd(-0.15, 0.15)), c = P(i + 1, rnd(-0.15, 0.15));
      Sk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
      if (i % 3 === 0) {
        const cr = P(i + rnd(0, 1), rnd(0.2, 1.4), 0.03);
        Dk.circle(cr.x, cr.y, cr.z, rnd(0.05, 0.12), 'y', 6, 0.3);
      }
    }
    // l'omino che ridisegna la strada con una matita gigante (sta sul bordo della cancellatura)
    const m = P(1166, 2.8);
    Sk.push(m.x, m.y, m.z, ROAD.at(1166).th);
    Sk.seg(-0.4, 0, 0, 0.6, 2.8, 0.2).seg(-0.4, 0, 0, -0.3, 0.1, 0.4);
    Sk.pop();
    for (let s = 1110; s <= 1172; s += 4) {
      const cone = coneObj(lmD);
      cone.position.copy(P(s, 0.35));
      chunk.add(cone);
      REFS.cones.push({ s, d: 0.35, obj: cone, hit: false, vel: new THREE.Vector3(), spin: 0 });
    }
    REFS.obstacles.push({ s0: 1118, s1: 1168, d0: 0.2, d1: 12, kind: 'erased', name: 'il pezzo di strada cancellato' });
  });

  // --- l'arrivo a San Scarabocchio ---
  feat(S.arrivo + 2, (c, Sk) => roadSign(c, Sk, S.arrivo + 2, -1, 'SAN SCARABOCCHIO\n47 abitanti · 0 colori', 2.8, 1.3));
  for (const [s, d] of [[S.arrivo + 20, 1], [S.arrivo + 34, -2]] as const) feat(s, (c) => cap(c, s, d));
  feat(ROAD.length - 4, (_c, Sk) => {
    // fine della strada: una barriera di scatoloni
    for (let d = -6.5; d <= 6.5; d += 1.3) {
      const p = P(ROAD.length - 2.5, d);
      Sk.push(p.x, p.y, p.z, ROAD.at(ROAD.length - 2.5).th);
      Sk.box(0, 0, 0, 1.2, 0.9, 1.1);
      if (Math.abs(d) < 5) Sk.box(0.05, 0.9, 0, 1.0, 0.8, 1.0);
      Sk.pop();
    }
    REFS.obstacles.push({ s0: ROAD.length - 3.2, s1: ROAD.length + 5, d0: -12, d1: 12, kind: 'barrier', name: 'gli scatoloni in fondo alla strada' });
  });
  feat(ROAD.length - 6, (c) => {
    const p = ROAD.at(ROAD.length - 2.5);
    signTo(c, 'fine della strada disegnata\n(il resto del paese è di là, a piedi)', P(ROAD.length - 2.5, 0, 2.6), p.th + Math.PI, 3.6, 1.0);
  });

  // =========================================================================
  // PEZZI DI STRADA
  // =========================================================================
  const CHUNK = 100;
  for (let s0 = 0; s0 < ROAD.length; s0 += CHUNK) {
    const s1 = Math.min(ROAD.length, s0 + CHUNK);
    const chunk = new THREE.Group();
    const Sk = new Sketch();
    const Dk = new Sketch();
    Dk.style = { jitter: 0.015, over: 0.06 };
    const Gk = new Sketch();
    Gk.style = { jitter: 0.02, over: 0.05 };
    const surf: number[] = []; // triangoli di asfalto, marciapiedi e pendii
    const quad = (a: THREE.Vector3, b2: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
      surf.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    };
    const from = Math.max(s0, PIAZZA_ROAD_END);
    for (let i = from; i < s1; i++) {
      const open = ROAD.open[i] === 1;
      const hw0 = ROAD.hw[i], hw1 = ROAD.hw[i + 1];
      const erased = i >= 1118 && i < 1168; // cantiere: metà strada cancellata
      // asfalto
      const eL0 = erased ? 0 : hw0 + (open ? 0.4 : 0), eL1 = erased ? 0 : hw1 + (open ? 0.4 : 0);
      quad(P(i, eL0), P(i + 1, eL1), P(i + 1, -hw1 - (open ? 0.4 : 0)), P(i, -hw0 - (open ? 0.4 : 0)));
      if (!open) {
        // marciapiedi con il gradino
        for (const side of [1, -1]) {
          const a0 = P(i, side * hw0, 0.15), a1 = P(i + 1, side * hw1, 0.15);
          const o0 = P(i, side * (hw0 + 2.6), 0.15), o1 = P(i + 1, side * (hw1 + 2.6), 0.15);
          quad(a0, a1, o1, o0);
          quad(P(i, side * hw0), P(i + 1, side * hw1), a1, a0);
        }
      } else if (!(i >= S.ponte && i < S.salita)) {
        // pendii ai lati: scendono e poi il foglio finisce in una parete fino alla pagina
        for (const side of [1, -1]) {
          const prof = (j: number) => {
            const hw = ROAD.hw[j];
            const k = ROAD.curv[j];
            // dal lato interno di una curva stretta il pendio si accorcia (non si ripiega su se stesso)
            let w = 16;
            if (k * side > 0.001) w = Math.max(2.5, Math.min(16, 0.8 / Math.abs(k) - hw - 0.6));
            const e = hw + 0.4;
            const y = ROAD.y[j];
            return [
              P(j, side * e),
              P(j, side * (e + w * 0.35), -w * 0.12),
              P(j, side * (e + w), -w * 0.55),
              P(j, side * (e + w), BASE_Y - y),
            ];
          };
          const A = prof(i), B = prof(i + 1);
          for (let q = 0; q < A.length - 1; q++) {
            if (side > 0) quad(A[q], B[q], B[q + 1], A[q + 1]);
            else quad(A[q + 1], B[q + 1], B[q], A[q]);
          }
        }
      }
      // segni per terra: tratteggio in mezzo, righe ai bordi in campagna
      if (i % 6 < 3 && !erased) {
        const a = P(i, 0, 0.02), c = P(i + 1, 0, 0.02);
        Gk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
      }
      if (open && i % 2 === 0) {
        for (const side of [1, -1]) {
          if (side > 0 && erased) continue;
          const a = P(i, side * (hw0 - 0.3), 0.02), c = P(i + 2, side * (hw1 - 0.3), 0.02);
          Gk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
        }
      }
      if (!open && i % 2 === 0) {
        // bordo del marciapiede
        for (const side of [1, -1]) {
          const a = P(i, side * hw0, 0.15), c = P(i + 2, side * ROAD.hw[Math.min(ROAD.n - 1, i + 2)], 0.15);
          Sk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
        }
      }
      // guardrail (in campagna) e parapetti (sul ponte)
      if (open && !erased) {
        const bridge = i >= S.ponte && i < S.salita;
        for (const side of [1, -1]) {
          const e = hw0 + 0.35;
          if (i % 3 === 0) {
            const a = P(i, side * e), c = P(i, side * e, bridge ? 1.1 : 0.75);
            Dk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0.02 });
          }
          for (const h of bridge ? [0.5, 1.1] : [0.5, 0.72]) {
            const a = P(i, side * e, h), c = P(i + 1, side * (hw1 + 0.35), h);
            Dk.seg(a.x, a.y, a.z, c.x, c.y, c.z, { over: 0 });
          }
        }
      }
    }
    // alberi e cespugli sui pendii
    for (let i = from; i < s1; i += 7) {
      if (!ROAD.open[i] || (i >= S.ponte && i < S.salita)) continue;
      for (const side of [1, -1]) {
        if (r() < 0.45) continue;
        const k = ROAD.curv[i];
        if (k * side > 0.01) continue;
        const e = ROAD.hw[i] + 0.4;
        const dd = rnd(3, 13);
        // altezza sul pendio (stesso profilo dei pendii)
        const w = 16;
        const t = dd / w;
        const h = t < 0.35 ? -(t / 0.35) * w * 0.12 : -w * 0.12 - ((t - 0.35) / 0.65) * w * 0.43;
        const at = P(i + rnd(-2, 2), side * (e + dd), h);
        if (r() < 0.55) {
          const sc = rnd(0.9, 1.4);
          Sk.cylinder(at.x, at.y, at.z, 0.13 * sc, 2.4 * sc, 6);
          const sp = new THREE.Sprite(crownMats[Math.floor(r() * crownMats.length)]);
          sp.scale.setScalar(3.4 * sc);
          sp.position.set(at.x, at.y + 3.3 * sc, at.z);
          chunk.add(sp);
        } else {
          const sp = new THREE.Sprite(bushMats[Math.floor(r() * bushMats.length)]);
          sp.scale.set(2.4, 1.2, 1);
          sp.position.set(at.x, at.y + 0.55, at.z);
          chunk.add(sp);
        }
      }
    }
    // case lungo le vie di città
    for (const side of [1, -1] as const) {
      let s = Math.max(s0, HOUSES_FROM);
      while (s < s1) {
        if (ROAD.open[Math.floor(s)]) {
          s += 2;
          continue;
        }
        const len = rnd(8, 13);
        const c = s + len / 2;
        if (c >= s1 + 3 || ROAD.open[Math.min(ROAD.n - 1, Math.floor(s + len))]) {
          s += 2;
          continue;
        }
        const special = SPECIAL_HOUSES.find((h) => h.side === side && Math.abs(h.s - c) < len / 2 + 4);
        if (special) {
          house(chunk, Sk, Dk, special.s, side, special.len, { h: special.h, sign: special.sign, dark: special.dark, neon: special.neon });
          s = special.s + special.len / 2 + rnd(0.4, 1.0);
          continue;
        }
        house(chunk, Sk, Dk, c, side, len, { h: rnd(5.5, 12), sign: r() < 0.28 ? SHOP_NAMES[Math.floor(r() * SHOP_NAMES.length)] : undefined });
        s += len + rnd(0.3, 1.2);
      }
    }
    // i pezzi speciali del percorso
    for (const f of FEATURES) if (f.s >= s0 && f.s < s1) f.draw(chunk, Sk, Dk, Gk);

    if (surf.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(surf, 3));
      geo.computeVertexNormals();
      chunk.add(new THREE.Mesh(geo, fill));
    }
    chunk.add(Sk.build(lmS, fill), Dk.build(lmD, fill), Gk.build(lmG, fill));
    b.group.add(chunk);
    // centro e raggio del pezzo (per non disegnare quelli lontani)
    const box = new THREE.Box3().setFromObject(chunk);
    const c = box.getCenter(new THREE.Vector3());
    const mid = ROAD.at((s0 + s1) / 2);
    c.set(mid.x, mid.y, mid.z);
    REFS.chunks.push({ group: chunk, c, r: CHUNK * 0.75 });
  }

  // una casa affacciata sulla strada (s = centro della facciata, side = lato)
  function house(chunk: THREE.Group, Sk: Sketch, Dk: Sketch, s: number, side: number, len: number, o: { h: number; sign?: string; dark?: boolean; neon?: string }) {
    const p = ROAD.at(s);
    const depth = 9;
    const front = p.hw + 2.6;
    const cpos = P(s, side * (front + depth / 2), 0.15);
    const rot = awayRot(s, side);
    const zf = -depth / 2;
    if (o.dark) {
      // il Parallelepipedo: un blocco nero, lucido, senza finestre
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, o.h - (BASE_Y - cpos.y), depth).translate(0, (o.h + (BASE_Y - cpos.y)) / 2, 0), inkFill);
      m.position.copy(cpos);
      m.rotation.y = rot;
      chunk.add(m);
    }
    Sk.push(cpos.x, cpos.y, cpos.z, rot);
    Dk.push(cpos.x, cpos.y, cpos.z, rot);
    const base = BASE_Y - cpos.y;
    if (!o.dark) Sk.box(0, base, 0, len, o.h - base, depth);
    else Sk.boxEdges(0, 0, 0, len, o.h, depth);
    if (!o.dark) {
      if (r() < 0.5) Sk.roof(0, o.h, 0, len, depth, Math.min(3, depth * 0.33), 'x');
      else {
        Sk.box(0, o.h, 0, len + 0.3, 0.35, depth + 0.3);
        if (r() < 0.5) Sk.box(rnd(-len / 3, len / 3), o.h + 0.35, rnd(-2, 2), 0.7, 1.2, 0.7);
      }
      const dx = rnd(-len / 2 + 1.2, len / 2 - 1.2);
      Dk.rectV(dx - 0.6, 0, zf - 0.03, 1.2, 2.2, 'x');
      Dk.circle(dx + 0.35, 1.05, zf - 0.03, 0.05, 'z', 8);
      const floors = Math.max(1, Math.floor(o.h / 3));
      for (let f = 0; f < floors; f++) {
        const y = f === 0 ? 1.0 : 0.9 + f * 3;
        for (let x = -len / 2 + 1; x + 1.2 < len / 2 - 0.5; x += 2.6) {
          if (f === 0 && Math.abs(x + 0.6 - dx) < 1.6) continue;
          Dk.window(x, y, zf - 0.03, 1.2, 1.4, 'x');
        }
      }
    }
    Sk.pop();
    Dk.pop();
    if (o.sign) {
      const pos = new THREE.Vector3(0, Math.min(o.h - 0.6, 3.1), zf - 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(cpos);
      const sw = Math.min(len - 1.5, 5.5);
      signTo(chunk, o.sign, pos, rot + Math.PI, sw, sw * 0.24, { font: MARKER_FONT });
    }
    if (o.neon) {
      const pos = new THREE.Vector3(0, o.h - 1.2, zf - 0.08).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(cpos);
      const tex = textTexture(o.neon, { w: 1024, h: 220, color: HL_PINK, font: MARKER_FONT, glow: HL_PINK });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len - 1, (len - 1) * 0.215), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
      m.position.copy(pos);
      m.rotation.y = rot + Math.PI;
      chunk.add(m);
    }
  }

  // macchina parcheggiata (disegnata), ostacolo
  function parkedCar(Sk: Sketch, Dk: Sketch, s: number, d: number) {
    const p = P(s, d);
    const th = ROAD.at(s).th;
    Sk.push(p.x, p.y, p.z, th + Math.PI / 2);
    Dk.push(p.x, p.y, p.z, th + Math.PI / 2);
    drawCarShape(Sk, Dk);
    Sk.pop();
    Dk.pop();
    REFS.obstacles.push({ s0: s - 2, s1: s + 2, d0: d - 0.95, d1: d + 0.95, kind: 'car', name: 'una macchina parcheggiata' });
  }

  // cassetta della posta (blu: missione secondaria)
  function mailbox(chunk: THREE.Group, Sk: Sketch, s: number, side: number) {
    const p = ROAD.at(s);
    const d = side * (p.hw + (ROAD.open[Math.floor(s)] ? 1.0 : 1.2));
    const base = P(s, d, ROAD.open[Math.floor(s)] ? 0 : 0.15);
    const g = new THREE.Group();
    g.position.copy(base);
    g.rotation.y = p.th + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.6).translate(0, 1.2, 0), blueFill);
    g.add(boxM);
    const ls = new Sketch();
    ls.style = { jitter: 0.01, over: 0.04 };
    ls.boxEdges(0, 0.99, 0, 0.5, 0.42, 0.6);
    ls.seg(0, 0, 0, 0, 0.99, 0);
    ls.seg(-0.15, 1.2, 0.31, 0.15, 1.2, 0.31, { over: 0 });
    g.add(ls.build(lmD, fill));
    // bandierina: si alza quando arriva la posta
    const flag = new THREE.Group();
    flag.position.set(0.27, 1.1, -0.1);
    const fs = new Sketch();
    fs.seg(0, 0, 0, 0, 0.45, 0, { over: 0 });
    fs.poly([[0, 0.45, 0], [0, 0.45, 0.2], [0, 0.32, 0.2], [0, 0.32, 0]], true, { over: 0 });
    flag.add(fs.build(lmD, fill));
    flag.rotation.x = 1.5;
    g.add(flag);
    chunk.add(g);
    void Sk;
    REFS.mailboxes.push({ s, d, pos: base.clone().setY(base.y + 1.2), flag, done: false });
  }

  function cap(chunk: THREE.Group, s: number, d: number) {
    const sp = new THREE.Sprite(capMats[REFS.caps.length % capMats.length]);
    sp.scale.setScalar(0.55);
    sp.position.copy(P(s, d, 0.45));
    chunk.add(sp);
    REFS.caps.push({ s, d, sprite: sp, taken: false });
  }

  // =========================================================================
  // LA PAGINA (in fondo) E IL CIELO
  // =========================================================================
  // la macchina di Luca e la Scatola dei Pastelli (le muove drive.ts)
  // dentro la macchina il tratteggio è più leggero: ce l'hai a un palmo dal naso
  REFS.car = buildLucaCar(lmS, lmD, makeHatchMaterial({ density: 14, strength: 0.28 }));
  b.group.add(REFS.car.root);
  REFS.scatola = buildScatola(lmS, fill);
  b.group.add(REFS.scatola);
  REFS.lmD = lmD;

  const page = new THREE.PlaneGeometry(1400, 1800);
  page.rotateX(-Math.PI / 2);
  const pageMesh = new THREE.Mesh(page, fill);
  pageMesh.position.set(-100, BASE_Y, 500);
  b.group.add(pageMesh);
  REFS.sky = buildSky(b);
  b.group.add(REFS.sky);

  // =========================================================================
  // LA PIAZZA DEL RIGHELLO (cima di Quadropoli, si cammina)
  // =========================================================================
  buildPiazza(b, fill);

  // =========================================================================
  // IL PARCO DI SAN SCARABOCCHIO (in fondo, dopo gli scatoloni)
  // =========================================================================
  buildPark(b);

  return b.finish({ fog: [45, 200] });
}

// Sagoma di un'auto (per quelle parcheggiate): lungo x, come WorldBuilder.car
function drawCarShape(Sk: Sketch, Dk: Sketch) {
  Sk.box(0, 0.3, 0, 3.9, 0.7, 1.7);
  Sk.box(-0.2, 1.0, 0, 2.1, 0.62, 1.5);
  for (const wx of [-1.25, 1.25]) {
    for (const wz of [-0.87, 0.87]) {
      Sk.circle(wx, 0.36, wz, 0.36, 'z', 14, 0.04);
      Dk.circle(wx, 0.36, wz, 0.12, 'z', 8, 0.05);
    }
  }
  for (const s of [-0.76, 0.76]) {
    Dk.poly([[-1.15, 1.08, s], [-0.3, 1.08, s], [-0.3, 1.52, s], [-1.0, 1.52, s]], true);
    Dk.poly([[-0.15, 1.08, s], [0.7, 1.08, s], [0.55, 1.52, s], [-0.15, 1.52, s]], true);
  }
}

// cono del cantiere (bianco e rosso)
function coneObj(lm: import('three/examples/jsm/lines/LineMaterial.js').LineMaterial) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 10).translate(0, 0.42, 0), new THREE.MeshBasicMaterial({ color: THEME.paperHex }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 10).translate(0, 0.42, 0), new THREE.MeshBasicMaterial({ color: RED_HEX }));
  g.add(body, band);
  const s = new Sketch();
  s.style = { jitter: 0.01, over: 0.03 };
  s.seg(-0.28, 0.05, 0, 0, 0.8, 0).seg(0.28, 0.05, 0, 0, 0.8, 0);
  s.poly([[-0.35, 0.05, -0.35], [0.35, 0.05, -0.35], [0.35, 0.05, 0.35], [-0.35, 0.05, 0.35]], true);
  g.add(s.build(lm, new THREE.MeshBasicMaterial()));
  return g;
}

// tappo di bottiglia visto dall'alto, con i dentini
export function capTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.translate(32, 32);
  ctx.beginPath();
  for (let i = 0; i <= 42; i++) {
    const a = (i / 42) * Math.PI * 2;
    const rad = i % 2 ? 27 : 23;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = THEME.inkHex;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Il cielo segue la camera (così resta "all'infinito" anche su 1300 metri di strada)
function buildSky(b: WorldBuilder) {
  const sky = new THREE.Group();
  const rr = b.rr;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, depthWrite: false }));
  sun.scale.setScalar(30);
  sun.position.set(-110, 95, 170);
  sun.renderOrder = -1;
  sky.add(sun);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(80 + i), fog: false, depthWrite: false, transparent: true }));
    const a = (i / 9) * Math.PI * 2 + rr(-0.2, 0.2);
    const d = rr(190, 230);
    c.position.set(Math.cos(a) * d, rr(50, 85), Math.sin(a) * d);
    c.scale.set(rr(32, 48), rr(12, 17), 1);
    c.renderOrder = -1;
    sky.add(c);
  }
  // montagne lontane (sotto l'orizzonte della cima: le vedi scendendo)
  const far = new Sketch();
  far.style = { jitter: 0.5, over: 1 };
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const h = 6 + Math.abs(Math.sin(a * 4.3)) * 22 + Math.sin(a * 11.1) * 4 + rr(0, 3);
    pts.push([Math.cos(a) * 270, h - 10, Math.sin(a) * 270]);
  }
  far.curve(pts);
  const m = b.lineMat(1.6);
  m.fog = false;
  const g = far.build(m, b.fill);
  g.renderOrder = -1;
  sky.add(g);
  return sky;
}

// =========================================================================
// LA PIAZZA DEL RIGHELLO
// =========================================================================
function buildPiazza(b: WorldBuilder, fill: THREE.Material) {
  const { S: Sk, D, G, col, A, sign } = b;
  const floor = new THREE.PlaneGeometry(46, 50);
  floor.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(floor, fill);
  m.position.set(0, 0, -5);
  b.group.add(m);
  // la strada che esce dalla piazza (segni per terra)
  for (let z = 6; z < 20; z += 6) G.seg(0, 0.02, z, 0, 0.02, z + 3, { over: 0 });
  G.seg(-6, 0.02, 6, -6, 0.02, 20).seg(6, 0.02, 6, 6, 0.02, 20);

  // blocchi di case tutto attorno (base giù fino alla pagina)
  const block = (x0: number, z0: number, x1: number, z1: number, h: number, face: 'n' | 's' | 'e' | 'w', o: { door?: number; sign?: string } = {}) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    Sk.box(cx, BASE_Y, cz, w, h - BASE_Y, d);
    Sk.roof(cx, h, cz, w, d, Math.min(3, Math.min(w, d) * 0.3), w > d ? 'x' : 'z');
    col.rect(x0, z0, x1, z1);
    const floors = Math.floor(h / 3);
    for (let f = 0; f < floors; f++) {
      const y = f === 0 ? 1.0 : 0.9 + f * 3;
      if (face === 'n' || face === 's') {
        const fz = face === 'n' ? z0 - 0.03 : z1 + 0.03;
        for (let x = x0 + 1; x + 1.2 < x1 - 0.5; x += 2.8) if (!(f === 0 && o.door !== undefined && Math.abs(x + 0.6 - o.door) < 1.5)) D.window(x, y, fz, 1.2, 1.4, 'x');
      } else {
        const fx = face === 'w' ? x0 - 0.03 : x1 + 0.03;
        for (let z = z0 + 1; z + 1.2 < z1 - 0.5; z += 2.8) if (!(f === 0 && o.door !== undefined && Math.abs(z + 0.6 - o.door) < 1.5)) D.window(fx, y, z, 1.2, 1.4, 'z');
      }
    }
    if (o.door !== undefined) {
      if (face === 'n' || face === 's') D.rectV(o.door - 0.7, 0, face === 'n' ? z0 - 0.03 : z1 + 0.03, 1.4, 2.3, 'x');
      else D.rectV(face === 'w' ? x0 - 0.03 : x1 + 0.03, 0, o.door - 0.7, 1.4, 2.3, 'z');
    }
    if (o.sign) {
      const f = { n: '-z', s: '+z', e: '+x', w: '-x' } as const;
      if (face === 'n' || face === 's') sign(o.sign, o.door ?? cx, 3.0, face === 'n' ? z0 - 0.08 : z1 + 0.08, Math.min(w - 1, 5.5), 1.1, f[face], { font: MARKER_FONT });
      else sign(o.sign, face === 'w' ? x0 - 0.08 : x1 + 0.08, 3.0, o.door ?? cz, Math.min(d - 1, 5.5), 1.1, f[face], { font: MARKER_FONT });
    }
  };
  // nord: due blocchi e in mezzo la Via della Cera (da lì arrivano i Pastelli)
  block(-23, -40, -5, -30, 10, 'n', { door: -14, sign: 'Pasticceria Squadrata' });
  block(5, -40, 23, -30, 12, 'n', { door: 12 });
  // la via dei Pastelli (chiusa con una transenna, per chi va a piedi)
  block(-12, -80, -5, -40, 9, 'e');
  block(5, -80, 12, -40, 11, 'w');
  for (let x = -4.6; x <= 4.6; x += 0.9) Sk.seg(x, 0, -31, x, 1.0, -31, { over: 0.02 });
  Sk.seg(-5, 1.0, -31, 5, 1.0, -31).seg(-5, 0.55, -31, 5, 0.55, -31);
  col.rect(-5, -31.3, 5, -30.7);
  sign('Via della Cera\nquartiere dei Pastelli', -3.4, 2.4, -30.9, 2.6, 0.9, '+z', { font: HAND_FONT });
  // ovest e est
  block(-33, -30, -23, -8, 9, 'w');
  block(-33, -8, -23, 20, 11, 'w', { door: 6 });
  block(23, -30, 33, -4, 10, 'e', { door: -16 });
  block(23, -4, 33, 20, 8, 'e');
  // sud: ai lati dell'uscita della strada (le case della Via Ripida iniziano dopo)
  block(-23, 20, -8.8, 30, 9, 'n');
  block(8.8, 20, 23, 30, 10, 'n');
  // nessuno va giù a piedi: è lunga
  col.rect(-8.8, 19.7, 8.8, 20.3);

  // monumento: il Righello
  const mx = -11, mz = -8;
  Sk.box(mx, 0, mz, 2.4, 0.9, 2.4);
  Sk.box(mx, 0.9, mz, 0.9, 7, 0.22);
  for (let y = 1.2; y < 7.8; y += 0.5) D.seg(mx - 0.45, y, mz + 0.12, mx - 0.45 + ((y * 2) % 2 < 1 ? 0.35 : 0.2), y, mz + 0.12, { over: 0 });
  sign('AL RIGHELLO\nche ci ha resi dritti', mx, 0.5, mz + 1.23, 2.0, 0.6, '+z', { font: HAND_FONT });
  col.box(mx, mz, 2.4, 2.4);

  // panchine
  b.bench(-15, 4, '+x');
  b.bench(16, -12, '-x');
  // cassetta della posta del postino (blu) e treppiede del geometra
  D.box(15.5, 0, -2.5, 0.5, 1.4, 0.5);
  col.circle(15.5, -2.5, 0.35);
  Sk.seg(9, 0, 13.4, 9.4, 1.5, 14).seg(9.8, 0, 13.4, 9.4, 1.5, 14).seg(9.4, 0, 14.7, 9.4, 1.5, 14);
  D.box(9.4, 1.5, 14, 0.3, 0.25, 0.4);
  // lampioni
  for (const [x, z] of [[-18, -20], [18, 10], [-18, 14]] as const) b.lamp(x, z, x < 0 ? 1 : -1);

  // punti notevoli
  A('spawn', 5, 0, -18);
  A('spawnLook', 1, 1.6, 6);
  A('marco', 3.5, 0, -15.5);
  A('luca', 0.4, 0, 6.3);
  A('postino', 14.2, 0, -3.6);
  A('pasticcera', -14, 0, -28.6);
  A('geometra', 10.2, 0, 13.2);
  A('verde', -14.6, 0, 4);
  A('bimbo', 9, 0, -4);
  A('scatola', 0, 0, -40);
}

// =========================================================================
// IL PARCO DI SAN SCARABOCCHIO (sulla pagina, in fondo)
// =========================================================================
function buildPark(b: WorldBuilder) {
  const { S: Sk, G, col, A } = b;
  const y = BASE_Y;
  // il parco sta oltre gli scatoloni, allineato agli assi
  const end = ROAD.at(ROAD.length);
  const cx = Math.round(end.x + Math.sin(end.th) * 30), cz = Math.round(end.z + Math.cos(end.th) * 30);
  REFS.park.set(cx, y, cz);
  const x0 = cx - 20, x1 = cx + 20, z0 = cz - 20, z1 = cz + 20;
  // siepe tutto attorno (con un cancello chiuso a sud)
  const bushM = [0, 1].map((i) => {
    const m = new THREE.SpriteMaterial({ map: bushTexture(90 + i), alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  });
  const hedge = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.2);
    for (let i = 0; i <= n; i++) {
      const sp = new THREE.Sprite(bushM[i % 2]);
      sp.scale.set(2.6, 1.5, 1);
      sp.position.set(ax + ((bx - ax) * i) / n, y + 0.7, az + ((bz - az) * i) / n);
      b.group.add(sp);
    }
  };
  hedge(x0, z0, x1, z0);
  hedge(x0, z1, x1, z1);
  hedge(x0, z0, x0, z1);
  hedge(x1, z0, x1, z1);
  col.rect(x0 - 1, z0 - 1, x1 + 1, z0 + 0.6);
  col.rect(x0 - 1, z1 - 0.6, x1 + 1, z1 + 1);
  col.rect(x0 - 1, z0, x0 + 0.6, z1);
  col.rect(x1 - 0.6, z0, x1 + 1, z1);
  // case attorno, oltre la siepe
  for (const [hx, hz, w, d, h] of [[cx - 12, z1 + 9, 14, 8, 8], [cx + 10, z1 + 9, 12, 8, 10], [x0 - 9, cz, 8, 16, 7], [x1 + 9, cz - 4, 8, 14, 9], [x1 + 9, cz + 14, 8, 8, 6]] as const) {
    Sk.box(hx, y, hz, w, h, d);
    Sk.roof(hx, y + h, hz, w, d, 2.5, w > d ? 'x' : 'z');
  }
  // vialetti
  G.seg(cx, y + 0.02, z0 + 1, cx, y + 0.02, z1 - 1).seg(cx + 1.6, y + 0.02, z0 + 1, cx + 1.6, y + 0.02, z1 - 1);
  G.seg(x0 + 1, y + 0.02, cz, x1 - 1, y + 0.02, cz).seg(x0 + 1, y + 0.02, cz + 1.6, x1 - 1, y + 0.02, cz + 1.6);
  // alberi
  const crowns = [0, 1, 2].map((i) => {
    const m = new THREE.SpriteMaterial({ map: crownTexture(95 + i), alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  });
  for (const [tx, tz] of [[-14, -12], [-9, 13], [13, -13], [15, 7], [-15, 3], [6, 15], [-4, -15]] as const) {
    Sk.cylinder(cx + tx, y, cz + tz, 0.15, 2.4, 6);
    const sp = new THREE.Sprite(crowns[(tx + 30) % 3]);
    sp.scale.setScalar(3.6);
    sp.position.set(cx + tx, y + 3.4, cz + tz);
    b.group.add(sp);
    col.circle(cx + tx, cz + tz, 0.3);
  }
  // panchine rimaste (una è di Nonna Pina)
  const bench = (x: number, z: number, rot: number) => {
    Sk.push(x, y, z, rot);
    Sk.box(0, 0.42, 0, 1.8, 0.07, 0.5).box(0, 0.55, -0.24, 1.8, 0.45, 0.06);
    for (const bx of [-0.8, 0.8]) Sk.seg(bx, 0, 0.2, bx, 0.42, 0.2).seg(bx, 0, -0.22, bx, 0.42, -0.22);
    Sk.pop();
    col.box(x, z, Math.abs(Math.sin(rot)) > 0.5 ? 0.55 : 1.8, Math.abs(Math.sin(rot)) > 0.5 ? 1.8 : 0.55);
  };
  bench(cx - 9, cz - 6, Math.PI / 2);
  bench(cx + 9, cz + 9, -Math.PI / 2);
  b.lamp(cx - 3, cz - 3, 1);
  // fontana in mezzo al parco e due aiuole
  const fx = cx - 6, fz = cz + 4;
  Sk.cylinder(fx, y, fz, 2.2, 0.55, 18);
  Sk.cylinder(fx, y, fz, 0.25, 1.4, 8);
  Sk.cylinder(fx, y + 1.4, fz, 0.7, 0.18, 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    Sk.curve([[fx, y + 1.6, fz], [fx + Math.cos(a) * 0.9, y + 1.9, fz + Math.sin(a) * 0.9], [fx + Math.cos(a) * 1.6, y + 0.6, fz + Math.sin(a) * 1.6]]);
  }
  col.circle(fx, fz, 2.3);
  A('fontana', fx, y + 1, fz);
  for (const [ax, az] of [[cx + 12, cz - 4], [cx - 13, cz + 12]] as const) {
    Sk.box(ax, y, az, 4, 0.35, 2);
    for (let k = 0; k < 5; k++) {
      const sp = new THREE.Sprite(bushM[k % 2]);
      sp.scale.set(1.1, 0.7, 1);
      sp.position.set(ax - 1.6 + k * 0.8, y + 0.65, az);
      b.group.add(sp);
    }
    col.box(ax, az, 4, 2);
  }
  // la panchina di Arturo: non c'è più. Un rettangolo più bianco del foglio e le briciole di gomma
  const bx = cx + 4, bz = cz + 9;
  REFS.bench.set(bx, y, bz);
  const erased = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), new THREE.MeshBasicMaterial({ map: erasedTexture(), transparent: true, depthWrite: false }));
  erased.rotation.x = -Math.PI / 2;
  erased.position.set(bx, y + 0.025, bz);
  b.group.add(erased);
  const crumbs = new Sketch();
  crumbs.style = { jitter: 0.01, over: 0 };
  const rng = makeRng(7);
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, rad = 0.9 + rng() * 0.9;
    const px = bx + Math.cos(a) * rad * 1.3, pz = bz + Math.sin(a) * rad * 0.8;
    // briciola arricciata: una piccola spirale
    const pts: [number, number, number][] = [];
    for (let k = 0; k < 8; k++) pts.push([px + Math.cos(k * 1.1) * 0.03 * (1 + k * 0.25), y + 0.03, pz + Math.sin(k * 1.1) * 0.03 * (1 + k * 0.25)]);
    crumbs.curve(pts);
  }
  const cg = crumbs.build(b.lineMat(1.4, '#8b8794'), b.fill);
  b.group.add(cg);
  REFS.crumbs = cg;
  A('parkSpawn', cx - 1, y, z0 + 3);
  A('parkLook', bx, y + 1.2, bz);
  A('arturo', bx + 1.7, y, bz - 0.6);
  A('pina', cx - 9, y, cz - 6);
  A('pallino', cx - 7.5, y, cz - 4.8);
}

// macchia di gomma: bianca, con i bordi "strofinati"
function erasedTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 140;
  const ctx = c.getContext('2d')!;
  const rng = makeRng(3);
  ctx.fillStyle = '#fffdf8';
  for (let i = 0; i < 140; i++) {
    const x = 20 + rng() * 216, yy = 16 + rng() * 108;
    ctx.globalAlpha = 0.35 + rng() * 0.5;
    ctx.beginPath();
    ctx.ellipse(x, yy, 18 + rng() * 22, 10 + rng() * 10, rng() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
