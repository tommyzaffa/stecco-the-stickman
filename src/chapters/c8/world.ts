import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch } from '../../render/sketch';
import { HAND_FONT, MARKER_FONT } from '../../render/textures';
import { CERA } from '../../render/palette';
import { FACING_ROT, WorldBuilder, type Facing, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Capitolo 8: la sagra. La piazza di San Scarabocchio in festa, su carta a puntini.
//
//   la piazza          x -28..28, z -26..26, chiusa dalle case
//   l'ingresso         a sud: la via (x -4..4, z 26..40) e l'arco con lo striscione (z 26)
//   la ruota           a nord: centro (0, 9, -17), raggio 7, otto cabine
//   la fontana         al centro (0, 4): il pezzo di piazza che sparisce
//   bancarelle         ovest: tiro ai barattoli (i Pastelli), pesca dei tappi
//                      est: gara di torte (Nonna Pina), banco dei premi (Don Fluo)
//                      nord-ovest: la gazzosa di Dario; nord-est: il palco della banda
// ---------------------------------------------------------------------------

export const WHEEL = { x: 0, y: 10, z: -17, r: 7, n: 8, drop: 2.5 }; // drop: dal perno al pavimento della cabina
// tiro ai barattoli: la mensola (centro, piano d'appoggio) e dove si mette chi tira
export const CANS = { x: -21.4, z: -4, y: 1.05, spot: new THREE.Vector3(-16.3, 0, -4) };
// pesca dei tappi: la vasca (centro, pelo dell'acqua, raggio)
export const FISH = { x: -19.6, z: 9, water: 0.62, r: 0.95, spot: new THREE.Vector3(-18.05, 0, 9) };
// gara di torte: il piatto (centro, altezza) e dove si mette chi impila
export const CAKE = { x: 20.2, z: -4.4, y: 0.95, spot: new THREE.Vector3(19.25, 0, -3.35) };
export const FOUNTAIN = { x: 0, z: 4 };

export const REFS8 = {
  wheel: null as THREE.Group | null, // la ruota (gira attorno a z)
  cabins: [] as THREE.Group[], // le cabine (restano dritte)
  fountainA: null as THREE.Group | null, // la fontana di prima (quattro zampilli)
  fountainB: null as THREE.Group | null, // quella ridisegnata (tre zampilli, un po' storta)
  blank: null as THREE.Mesh | null, // il foglio bianco della cancellatura
  crumbs: null as THREE.Group | null, // briciole rosa (dopo)
  lm: null as LineMaterial | null,
  thin: null as LineMaterial | null,
  red: null as LineMaterial | null, // la stella del tappo raro, la ciliegina
  fill: null as THREE.Material | null,
};

export function buildSagra(): World {
  const b = new WorldBuilder(808);
  const { S, D, G, col, A, sign, wallText } = b;
  const y = 0.02;
  b.ground();
  b.daySky('mountains');
  REFS8.lm = b.lineMat(2.2);
  REFS8.thin = b.lineMat(1.5);
  REFS8.red = b.lineMat(2, '#d6333a');
  REFS8.fill = b.fill;
  REFS8.cabins = [];

  // da coordinate "della bancarella" (x di lato, z verso chi guarda) al mondo
  const toWorld = (ox: number, oz: number, rot: number, lx: number, lz: number): [number, number] => [
    ox + lx * Math.cos(rot) + lz * Math.sin(rot),
    oz - lx * Math.sin(rot) + lz * Math.cos(rot),
  ];
  // rettangolo in coordinate della bancarella → collisione (rotazioni di 90°)
  const colLocal = (ox: number, oz: number, rot: number, x0: number, z0: number, x1: number, z1: number, low = false) => {
    const a = toWorld(ox, oz, rot, x0, z0), c = toWorld(ox, oz, rot, x1, z1);
    const r = col.rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1]));
    r.low = low;
    return r;
  };

  // tendone a strisce (quadrilatero diviso in strisce, una sì e una no colorata)
  const stripeMat = new Map<string, THREE.MeshBasicMaterial>();
  const colorMat = (c: string) => {
    let m = stripeMat.get(c);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      stripeMat.set(c, m);
    }
    return m;
  };
  const awning = (p: THREE.Vector3[], stripes: number, color: string) => {
    // p: 0 dietro-sinistra, 1 dietro-destra, 2 davanti-destra, 3 davanti-sinistra
    for (let i = 0; i < stripes; i++) {
      const t0 = i / stripes, t1 = (i + 1) / stripes;
      const q = [p[0].clone().lerp(p[1], t0), p[0].clone().lerp(p[1], t1), p[3].clone().lerp(p[2], t1), p[3].clone().lerp(p[2], t0)];
      const g = new THREE.BufferGeometry().setFromPoints([q[0], q[1], q[2], q[0], q[2], q[3]]);
      g.computeVertexNormals();
      b.group.add(new THREE.Mesh(g, i % 2 ? b.fill : colorMat(color)));
      D.seg(q[1].x, q[1].y, q[1].z, q[2].x, q[2].y, q[2].z, { over: 0.02 });
    }
    S.poly([[p[0].x, p[0].y, p[0].z], [p[1].x, p[1].y, p[1].z], [p[2].x, p[2].y, p[2].z], [p[3].x, p[3].y, p[3].z]], true);
    // bordo davanti a festoni
    const n = stripes * 2;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n * 6; i++) {
      const t = i / (n * 6);
      const q = p[3].clone().lerp(p[2], t);
      pts.push([q.x, q.y - Math.abs(Math.sin(t * n * Math.PI)) * 0.18, q.z]);
    }
    D.curve(pts);
  };

  // bancarella: larga w, profonda d, aperta verso "facing". (x, z) = centro del lato davanti.
  const stall = (x: number, z: number, facing: Facing, w: number, d: number, title: string, color: string, counter = true) => {
    const rot = FACING_ROT[facing];
    S.push(x, 0, z, rot);
    for (const [lx, lz] of [[-w / 2, 0], [w / 2, 0], [-w / 2, -d], [w / 2, -d]]) S.seg(lx, 0, lz, lx, lz === 0 ? 2.6 : 2.9, lz, { over: 0.04 });
    // retro e fianchi di tela (fino a 2,2 m)
    D.push(x, 0, z, rot);
    S.box(0, 0, -d, w, 2.4, 0.06);
    D.box(-w / 2, 0.9, -d / 2, 0.04, 1.3, d, true);
    D.box(w / 2, 0.9, -d / 2, 0.04, 1.3, d, true);
    if (counter) {
      S.box(0, 0, -0.3, w - 0.1, 1.0, 0.55);
      D.seg(-w / 2 + 0.1, 0.5, 0.0, w / 2 - 0.1, 0.5, 0.0, { over: 0 });
    }
    D.pop();
    S.pop();
    const P = (lx: number, ly: number, lz: number) => {
      const [wx, wz] = toWorld(x, z, rot, lx, lz);
      return new THREE.Vector3(wx, ly, wz);
    };
    awning([P(-w / 2 - 0.2, 2.95, -d), P(w / 2 + 0.2, 2.95, -d), P(w / 2 + 0.2, 2.55, 0.35), P(-w / 2 - 0.2, 2.55, 0.35)], Math.max(4, Math.round(w / 0.6)), color);
    const sp = P(0, 3.35, 0.4);
    sign(title, sp.x, sp.y, sp.z, Math.min(w, 4.2), 0.62, facing, { font: MARKER_FONT });
    // collisioni: bancone davanti e tela dietro (dentro non si entra)
    if (counter) colLocal(x, z, rot, -w / 2, -d, w / 2, 0.0);
    else {
      colLocal(x, z, rot, -w / 2, -d - 0.05, w / 2, -d + 0.05);
      colLocal(x, z, rot, -w / 2 - 0.05, -d, -w / 2 + 0.05, 0);
      colLocal(x, z, rot, w / 2 - 0.05, -d, w / 2 + 0.05, 0);
    }
    return { rot, P };
  };

  // =========================================================================
  // LE CASE ATTORNO E LA VIA D'INGRESSO
  // =========================================================================
  b.building({ x0: -34, x1: -13, z0: -40, z1: -27, h: 9, face: '+z', roof: 'gable', door: -24, sign: 'MUNICIPIO', shopWindow: false });
  wallText('(il sindaco è alla sagra)', -24, 2.6, -26.9, 4, 0.5, '+z');
  b.building({ x0: -12, x1: 12, z0: -42, z1: -30, h: 6, face: '+z', roof: 'flat', door: 7 });
  b.building({ x0: 13, x1: 34, z0: -40, z1: -27, h: 8, face: '+z', roof: 'gable', door: 20, sign: 'Scuola Elementare', shopWindow: false });
  b.building({ x0: -34, x1: -4.5, z0: 27, z1: 38, h: 7, face: '-z', roof: 'gable', door: -12, sign: 'Tabacchi', shopWindow: true });
  b.building({ x0: 4.5, x1: 34, z0: 27, z1: 38, h: 8, face: '-z', roof: 'flat', door: 14, sign: 'Merceria', shopWindow: true });
  b.building({ x0: -42, x1: -29, z0: -26, z1: 1, h: 7, face: '+z', roof: 'flat', door: -35 });
  b.building({ x0: -42, x1: -29, z0: 1.5, z1: 26, h: 8, face: '-z', roof: 'gable', door: -35 });
  b.building({ x0: 29, x1: 42, z0: -26, z1: 1, h: 8, face: '+z', roof: 'gable', door: 35 });
  b.building({ x0: 29, x1: 42, z0: 1.5, z1: 26, h: 7, face: '-z', roof: 'flat', door: 35 });
  // la via d'ingresso: finisce contro una transenna ("strada chiusa per la sagra")
  G.seg(-4.3, y, 26, -4.3, y, 40).seg(4.3, y, 26, 4.3, y, 40);
  S.box(0, 0, 39.6, 7, 1.0, 0.12);
  for (const x of [-3.4, 3.4]) S.seg(x, 0, 39.6, x, 1.0, 39.6);
  sign('STRADA CHIUSA\nper sagra', 0, 1.45, 39.5, 2.4, 0.7, '-z', { font: HAND_FONT });
  // muri invisibili: la sagra finisce dove finisce la piazza (davanti alle case: niente varchi tra
  // un palazzo e l'altro) e la via finisce alla transenna
  col.rect(-46, -46, 46, -27); // nord (municipio, scuola, e il palazzo dietro la ruota)
  col.rect(-46, -46, -29, 46); // ovest
  col.rect(29, -46, 46, 46); // est
  col.rect(-46, 26.9, -4.4, 46); // sud, a sinistra della via
  col.rect(4.4, 26.9, 46, 46); // sud, a destra della via
  col.rect(-5, 39.5, 5, 46); // la transenna in fondo alla via

  // l'arco d'ingresso con lo striscione
  for (const x of [-3.7, 3.7]) {
    S.cylinder(x, 0, 26, 0.16, 5.4, 8);
    col.circle(x, 26, 0.25);
  }
  S.seg(-3.7, 5.2, 26, 3.7, 5.2, 26);
  sign('SAGRA DI SAN SCARABOCCHIO', 0, 4.55, 26.05, 7, 1.1, '+z', { font: MARKER_FONT });
  sign('arrivederci (non andate via)', 0, 4.55, 25.95, 5.5, 0.8, '-z', { font: HAND_FONT });

  // =========================================================================
  // LA PIAZZA: selciato e pali delle bandierine
  // =========================================================================
  // lastre del selciato (qualche linea qua e là, non tutte: si stancava anche chi le disegnava)
  for (let i = -24; i <= 24; i += 4) {
    G.dashed(-27, y, i, 27, y, i, 1.4, 1.2);
    G.dashed(i, y, -24, i, y, 24, 1.4, 1.2);
  }
  // pali (con la lampadina in cima): reggono le bandierine
  const POLES: [number, number][] = [[-12, 18], [12, 18], [-12, -9], [12, -9], [-23, 4], [23, 4]];
  for (const [px, pz] of POLES) {
    S.seg(px, 0, pz, px, 6, pz, { over: 0.05 });
    S.seg(px - 0.15, 0, pz, px + 0.15, 0, pz);
    D.circle(px, 6.15, pz, 0.15, 'x', 10);
    col.circle(px, pz, 0.15);
  }
  // bandierine: le hanno colorate i Pastelli, di notte, senza chiedere
  const flagCols: number[] = [];
  const flagPos: number[] = [];
  const palette = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.viola, '#e8c93a'].map((c) => new THREE.Color(c));
  let fc = 0;
  const festoon = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    const sag = Math.min(1.4, len * 0.06);
    const n = Math.max(6, Math.round(len / 0.55));
    const pt = (t: number): [number, number, number] => [ax + (bx - ax) * t, ay + (by - ay) * t - sag * 4 * t * (1 - t), az + (bz - az) * t];
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) pts.push(pt(i / n));
    D.curve(pts);
    for (let i = 1; i < n - 1; i += 1) {
      const p0 = pt(i / n), p1 = pt((i + 0.7) / n);
      const mid: [number, number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.36, (p0[2] + p1[2]) / 2];
      D.poly([p0, mid, p1], false, { over: 0, jitter: 0.01 });
      flagPos.push(...p0, ...mid, ...p1);
      const c = palette[fc++ % palette.length];
      for (let k = 0; k < 3; k++) flagCols.push(c.r, c.g, c.b);
    }
  };
  const F = (i: number): [number, number, number] => [POLES[i][0], 5.9, POLES[i][1]];
  const lines: [[number, number, number], [number, number, number]][] = [
    [[-3.7, 5.2, 26], F(0)], [[3.7, 5.2, 26], F(1)], [F(0), F(3)], [F(1), F(2)], [F(4), F(2)], [F(5), F(3)],
    [F(4), F(0)], [F(5), F(1)], [F(2), [-3.2, 7.5, -15.7]], [F(3), [3.2, 7.5, -15.7]], [F(0), F(1)],
  ];
  for (const [a, c] of lines) festoon(a[0], a[1], a[2], c[0], c[1], c[2]);
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(flagPos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(flagCols, 3));
    b.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })));
  }

  // alberi negli angoli
  for (const [tx, tz] of [[-26, 23], [26, 23], [-26, -23], [26, -23]]) b.tree(tx, tz, 1.1);

  // =========================================================================
  // LA FONTANA (quella di prima e quella ridisegnata)
  // =========================================================================
  const fountain = (version: 'A' | 'B') => {
    const fs = new Sketch();
    const fd = new Sketch();
    // la B è ridisegnata in fretta: tratto più tremolante, tre zampilli, una panchina storta
    fs.style = version === 'A' ? { jitter: 0.02, over: 0.1 } : { jitter: 0.06, over: 0.22 };
    fd.style = version === 'A' ? { jitter: 0.012, over: 0.05 } : { jitter: 0.04, over: 0.12 };
    const { x, z } = FOUNTAIN;
    // vasca ottagonale
    const R = 2.3;
    const oct = (r: number, yy: number): [number, number, number][] =>
      Array.from({ length: 8 }, (_, i) => [x + Math.cos((i + 0.5) * (Math.PI / 4)) * r, yy, z + Math.sin((i + 0.5) * (Math.PI / 4)) * r] as [number, number, number]);
    const geo = new THREE.CylinderGeometry(R, R, 0.6, 8);
    geo.rotateY(Math.PI / 8);
    geo.translate(x, 0.3, z);
    fs.geometry(geo, 20);
    fd.curve(oct(R - 0.25, 0.61), true);
    // acqua: cerchi
    for (const r of [0.8, 1.4, 1.9]) fd.circle(x, 0.5, z, r, 'y', 24, 0.05);
    // colonna e vaschetta in cima
    fs.cylinder(x, 0.6, z, 0.3, 1.3, 10);
    fs.cylinder(x + (version === 'B' ? 0.08 : 0), 1.9, z, 0.85, 0.22, 14);
    fs.cylinder(x, 2.12, z, 0.12, 0.35, 8);
    // zampilli: archi dalla vaschetta alla vasca
    const jets = version === 'A' ? 4 : 3;
    for (let j = 0; j < jets; j++) {
      const a = (j / jets) * Math.PI * 2 + Math.PI / 4;
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const r = 0.85 + t * 1.0;
        pts.push([x + Math.cos(a) * r, 2.1 + Math.sin(t * Math.PI * 0.9) * 0.55 - t * 1.6, z + Math.sin(a) * r]);
      }
      fd.curve(pts);
      // gocce
      for (let k = 0; k < 3; k++) fd.circle(x + Math.cos(a) * (1.95 + k * 0.08), 0.62, z + Math.sin(a) * (1.95 + k * 0.08), 0.06 + k * 0.04, 'y', 8);
    }
    // panchine attorno (la B ne ha una storta) e due lampioni
    const benches: [number, number, number][] = [[x - 4.4, z, Math.PI / 2], [x + 4.4, z, -Math.PI / 2], [x, z - 4.4, 0], [x, z + 4.4, Math.PI]];
    benches.forEach(([bx, bz, r], i) => {
      fs.push(bx, 0, bz, r + (version === 'B' && i === 2 ? 0.25 : 0));
      fs.box(0, 0.42, 0, 1.8, 0.07, 0.5);
      fs.box(0, 0.55, -0.24, 1.8, 0.45, 0.06);
      for (const lx of [-0.8, 0.8]) fs.seg(lx, 0, 0.2, lx, 0.42, 0.2).seg(lx, 0, -0.22, lx, 0.42, -0.22);
      fs.pop();
    });
    for (const [lx, lz] of [[x - 3.2, z - 3.2], [x + 3.2, z + 3.2]]) {
      const lean = version === 'B' && lx > x ? 0.35 : 0;
      fs.seg(lx, 0, lz, lx + lean, 3.6, lz, { over: 0.05 });
      fd.box(lx + lean, 3.4, lz, 0.3, 0.3, 0.3);
    }
    // fioriere
    for (const [px, pz] of [[x + 3.3, z - 3.3], [x - 3.3, z + 3.3]]) {
      fs.cylinder(px, 0, pz, 0.35, 0.5, 8);
      for (let k = 0; k < 5; k++) fd.circle(px + Math.cos(k * 1.3) * 0.15, 0.62 + (k % 2) * 0.08, pz + Math.sin(k * 1.3) * 0.15, 0.09, 'z', 8);
    }
    const grp = new THREE.Group();
    grp.add(fs.build(b.lineMat(2.3), b.fill), fd.build(b.lineMat(1.4), b.fill));
    b.group.add(grp);
    return grp;
  };
  REFS8.fountainA = fountain('A');
  REFS8.fountainB = fountain('B');
  REFS8.fountainB.visible = false;
  col.circle(FOUNTAIN.x, FOUNTAIN.z, 2.35);
  for (const [bx, bz, along] of [[-4.4, 0, false], [4.4, 0, false], [0, -4.4, true], [0, 4.4, true]] as [number, number, boolean][]) {
    const r = col.box(FOUNTAIN.x + bx, FOUNTAIN.z + bz, along ? 1.8 : 0.55, along ? 0.55 : 1.8);
    r.low = true;
  }
  for (const [lx, lz] of [[-3.2, -3.2], [3.2, 3.2]]) col.circle(FOUNTAIN.x + lx, FOUNTAIN.z + lz, 0.15);
  // la cancellatura: un foglio più bianco del foglio (all'inizio non c'è)
  {
    const blank = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false, transparent: true, opacity: 0.98, fog: false }));
    blank.rotation.x = -Math.PI / 2;
    blank.position.set(FOUNTAIN.x, 0.04, FOUNTAIN.z);
    blank.scale.setScalar(0.001);
    blank.visible = false;
    blank.renderOrder = 3;
    b.group.add(blank);
    REFS8.blank = blank;
    // briciole rosa: restano dopo (quelle che nessuno nota)
    const cr = new Sketch();
    cr.style = { jitter: 0.01, over: 0 };
    const rng = b.r;
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2, rad = 5.4 + rng() * 1.6;
      const px = FOUNTAIN.x + Math.cos(a) * rad, pz = FOUNTAIN.z + Math.sin(a) * rad;
      const s = 0.04 + rng() * 0.05;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < 7; k++) pts.push([px + Math.cos(k * 1.1) * s * (1 + k * 0.3), y + 0.02, pz + Math.sin(k * 1.1) * s * (1 + k * 0.3)]);
      cr.curve(pts);
    }
    const crumbs = new THREE.Group();
    crumbs.add(cr.build(b.lineMat(2, '#e8839f'), b.fill));
    crumbs.visible = false;
    b.group.add(crumbs);
    REFS8.crumbs = crumbs;
  }

  // =========================================================================
  // LA RUOTA PANORAMICA
  // =========================================================================
  {
    const { x, y: wy, z, r: R, n } = WHEEL;
    // gambe ad A e basamento (fermi)
    for (const s of [-1, 1]) {
      for (const lx of [-3.9, 3.9]) {
        S.seg(x, wy, z + s * 1.25, x + lx, 0, z + s * 2.3, { over: 0.1 });
        col.circle(x + lx, z + s * 2.3, 0.25);
      }
      S.seg(x - 2.6, 3, z + s * 1.95, x + 2.6, 3, z + s * 1.95);
      S.seg(x, wy, z + s * 1.25, x, wy, z + s * 0.95);
    }
    S.box(x, 0, z, 3.6, 0.16, 2.8);
    // la ruota: gira tutta insieme
    const ws = new Sketch();
    ws.style = { jitter: 0.03, over: 0.12 };
    const wd = new Sketch();
    wd.style = { jitter: 0.015, over: 0.04 };
    for (const s of [-0.95, 0.95]) {
      ws.circle(0, 0, s, R, 'z', 56, 0.008);
      wd.circle(0, 0, s, R * 0.55, 'z', 36, 0.01);
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        ws.seg(0, 0, s, Math.cos(a) * R, Math.sin(a) * R, s, { over: 0.05 });
      }
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ws.seg(Math.cos(a) * R, Math.sin(a) * R, -0.95, Math.cos(a) * R, Math.sin(a) * R, 0.95, { over: 0.05 });
      // lampadine sul bordo
      for (let k = 0; k < 3; k++) {
        const aa = a + ((k + 1) / 4) * ((Math.PI * 2) / n);
        wd.circle(Math.cos(aa) * (R + 0.18), Math.sin(aa) * (R + 0.18), 0.95, 0.09, 'z', 8);
      }
    }
    const hub = new THREE.CylinderGeometry(0.4, 0.4, 2.3, 12);
    hub.rotateX(Math.PI / 2);
    ws.geometry(hub, 25);
    wd.circle(0, 0, 1.16, 0.25, 'z', 10);
    const wheel = new THREE.Group();
    wheel.position.set(x, wy, z);
    wheel.add(ws.build(b.lineMat(2.3), b.fill), wd.build(b.lineMat(1.4), b.fill));
    b.group.add(wheel);
    REFS8.wheel = wheel;
    // cabine: appese al bordo, restano dritte (le muove story.ts)
    const roofCols = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.viola, '#e8c93a', CERA.rosso, CERA.blu];
    for (let i = 0; i < n; i++) {
      const cs = new Sketch();
      cs.style = { jitter: 0.012, over: 0.05 };
      const dr = WHEEL.drop;
      cs.seg(-0.2, 0, 0, 0, -0.35, 0).seg(0.2, 0, 0, 0, -0.35, 0);
      const fl = -dr; // pavimento
      cs.box(0, fl - 0.08, 0, 1.7, 0.08, 1.4);
      // sponde basse e panca sul fondo; davanti solo un corrimano (da lassù si deve vedere la piazza)
      cs.box(0, fl, 0.68, 1.7, 0.12, 0.04);
      cs.seg(-0.85, fl + 0.5, 0.68, 0.85, fl + 0.5, 0.68, { over: 0.02 });
      for (const px of [-0.4, 0.4]) cs.seg(px, fl + 0.12, 0.68, px, fl + 0.5, 0.68, { over: 0 });
      cs.box(0, fl, -0.68, 1.7, 0.55, 0.04);
      cs.box(-0.83, fl, 0, 0.04, 0.55, 1.4);
      cs.box(0.83, fl, 0, 0.04, 0.55, 1.4);
      cs.box(0, fl, -0.45, 1.5, 0.45, 0.4);
      for (const [px, pz] of [[-0.83, 0.68], [0.83, 0.68], [-0.83, -0.68], [0.83, -0.68]]) cs.seg(px, fl + 0.55, pz, px * 0.4, -0.45, pz * 0.4);
      // tettuccio a spicchi colorati
      const roof = new THREE.ConeGeometry(1.05, 0.42, 8);
      roof.translate(0, -0.42, 0);
      const grp = new THREE.Group();
      const roofMesh = new THREE.Mesh(roof, new THREE.MeshBasicMaterial({ color: roofCols[i], transparent: true, opacity: 0.8 }));
      cs.circle(0, -0.63, 0, 1.05, 'y', 16, 0.02);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        cs.seg(0, -0.21, 0, Math.cos(a) * 1.05, -0.63, Math.sin(a) * 1.05, { over: 0 });
      }
      grp.add(roofMesh, cs.build(b.lineMat(2), b.fill));
      b.group.add(grp);
      REFS8.cabins.push(grp);
    }
    // recinto basso davanti (col cancelletto dove sta il signor Perno)
    for (const [x0, x1] of [[-5, -1.1], [1.1, 5]]) {
      S.box((x0 + x1) / 2, 0, z + 3.2, x1 - x0, 0.9, 0.06);
      const rr = col.rect(x0, z + 3.15, x1, z + 3.25);
      rr.low = true;
    }
    for (const sx of [-5, 5]) {
      S.box(sx, 0, z + 0.2, 0.06, 0.9, 6);
      col.rect(sx - 0.05, z - 2.8, sx + 0.05, z + 3.2).low = true;
    }
    // casotto della ruota con il cartello dei prezzi
    S.box(6.8, 0, z + 4.2, 1.6, 2.3, 1.4);
    S.roof(6.8, 2.3, z + 4.2, 1.8, 1.6, 0.6, 'x', 0.1);
    col.rect(6, z + 3.5, 7.6, z + 4.9);
    sign('RUOTA PANORAMICA\n6 gettoni (in due)', 6.8, 1.7, z + 4.95, 1.5, 0.75, '+z', { font: HAND_FONT });
  }

  // =========================================================================
  // LE BANCARELLE
  // =========================================================================
  // --- tiro ai barattoli (i Pastelli a Cera): profonda, la mensola in fondo ---
  {
    const bx = -16.8, bz = CANS.z;
    stall(bx, bz, '+x', 3.4, 5.2, 'TIRO AI BARATTOLI', CERA.rosso);
    // la mensola (in coordinate del mondo: la bancarella guarda verso +x)
    S.box(CANS.x, 0, CANS.z, 0.7, CANS.y, 1.3);
    D.seg(CANS.x + 0.35, CANS.y - 0.12, CANS.z - 0.65, CANS.x + 0.35, CANS.y - 0.12, CANS.z + 0.65, { over: 0 });
    wallText('3 palline\ngiù tutto = 3 gettoni', bx - 5.1, 1.9, bz + 1.1, 1.4, 0.7, '+x');
    wallText('I PASTELLI A CERA\n(dal vivo)', bx - 5.1, 1.9, bz - 1.2, 1.4, 0.7, '+x', CERA.viola);
    // barattoli di scorta per terra
    for (const [cx, cz] of [[-20.6, -5.8], [-20.3, -5.5], [-20.7, -5.2]]) D.circle(cx, 0.02, cz, 0.1, 'y', 10);
  }
  // --- pesca dei tappi: la vasca rotonda ---
  {
    const bx = -17.4, bz = FISH.z;
    stall(bx, bz, '+x', 3.6, 4.4, 'PESCA DEI TAPPI', CERA.blu, false);
    const { x, z, r } = FISH;
    // vasca aperta sopra (i tappi galleggiano dentro) e l'acqua
    const tub = new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.72, 28, 1, true);
    tub.translate(x, 0.36, z);
    S.geometry(tub, 90);
    S.circle(x, 0.72, z, r + 0.08, 'y', 32, 0.01);
    S.circle(x, 0.01, z, r + 0.08, 'y', 32, 0.01);
    for (const a of [0.3, 0.3 + Math.PI, 1.9, 1.9 + Math.PI]) S.seg(x + Math.cos(a) * (r + 0.08), 0, z + Math.sin(a) * (r + 0.08), x + Math.cos(a) * (r + 0.08), 0.72, z + Math.sin(a) * (r + 0.08), { over: 0.02 });
    D.circle(x, 0.72, z, r - 0.02, 'y', 32, 0.01);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r + 0.05, 32), new THREE.MeshBasicMaterial({ color: '#e7ecef' }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, FISH.water, z);
    b.group.add(water);
    for (const rr of [0.3, 0.55]) D.circle(x + 0.1, FISH.water + 0.003, z - 0.05, rr, 'y', 20, 0.08);
    col.circle(x, z, r + 0.15);
    wallText('ogni tappo ha un numero sotto\n(anche zero)', bx - 4.3, 1.9, bz + 0.9, 1.6, 0.6, '+x');
    // canne appese
    for (let i = 0; i < 3; i++) D.seg(bx - 4.2, 2.3, bz - 1.5 + i * 0.2, bx - 3.4, 0.4, bz - 1.4 + i * 0.25);
  }
  // --- gara di torte (Nonna Pina): tavolo lungo con le torte degli altri ---
  {
    const bx = 17.6, bz = -4;
    stall(bx, bz, '-x', 4.4, 4.2, 'GARA DI TORTE', CERA.arancione, false);
    S.box(CAKE.x, 0, CAKE.z + 0.4, 1.1, CAKE.y - 0.03, 3.4);
    col.rect(CAKE.x - 0.55, CAKE.z - 1.3, CAKE.x + 0.55, CAKE.z + 2.1);
    // piatto
    D.circle(CAKE.x, CAKE.y + 0.005, CAKE.z, 0.55, 'y', 20, 0.02);
    // le torte degli avversari (basse: a nessuno viene in mente di farle alte)
    for (const [cz, h, rr] of [[-2.9, 0.25, 0.3], [-5.3, 0.38, 0.26]] as [number, number, number][]) {
      S.cylinder(CAKE.x, CAKE.y - 0.03, cz, rr, h, 12);
      D.circle(CAKE.x, CAKE.y - 0.03 + h + 0.01, cz, rr * 0.6, 'y', 10);
    }
    wallText('vince la torta più alta', bx + 4.1, 2.0, bz, 2.4, 0.5, '-x');
    sign('Giuria:\nla maestra Crostata', 19.7, 1.35, bz + 1.95, 1.1, 0.5, '-x', { font: HAND_FONT });
  }
  // --- banco dei premi (Don Fluo) ---
  {
    const bx = 17.6, bz = 10;
    stall(bx, bz, '-x', 4.2, 2.6, 'BANCO DEI PREMI', '#e8e33a');
    // mensole con i premi: orsacchiotto, pesce nel sacchetto, fischietti, palloncini
    S.box(bx + 2.4, 1.2, bz, 0.4, 0.05, 3.8);
    S.box(bx + 2.4, 1.9, bz, 0.4, 0.05, 3.8);
    // orsacchiotto gigante
    D.push(bx + 2.35, 1.25, bz - 1.2);
    D.circle(0, 0.35, 0, 0.3, 'x', 14);
    D.circle(0, 0.85, 0, 0.22, 'x', 12);
    D.circle(0, 1.05, -0.17, 0.08, 'x', 8);
    D.circle(0, 1.05, 0.17, 0.08, 'x', 8);
    D.pop();
    // pesce nel sacchetto
    D.circle(bx + 2.3, 1.45, bz + 0.2, 0.2, 'x', 12);
    D.poly([[bx + 2.25, 1.42, bz + 0.1], [bx + 2.25, 1.5, bz + 0.25], [bx + 2.25, 1.38, bz + 0.3]], true);
    // fischietti e palloncini
    for (let i = 0; i < 3; i++) D.box(bx + 2.35, 1.96, bz + 0.8 + i * 0.25, 0.1, 0.08, 0.16);
    for (let i = 0; i < 3; i++) {
      D.seg(bx + 2.3, 1.95, bz + 1.5 + i * 0.12, bx + 2.3, 2.5, bz + 1.4 + i * 0.2);
      D.circle(bx + 2.3, 2.7, bz + 1.4 + i * 0.2, 0.18, 'x', 12);
    }
    wallText('premi evidenziati = premi migliori', bx + 3.9, 2.45, bz, 2.6, 0.4, '-x', '#b5ae00');
  }
  // --- la gazzosa di Dario, con le tavolate ---
  {
    stall(-15, -16.5, '+z', 4, 2.4, 'GAZZOSA DA DARIO', CERA.verde);
    for (let i = 0; i < 7; i++) S.cylinder(-16.5 + i * 0.45, 1.0, -16.8, 0.07, 0.34, 6);
    wallText('stasera il pub è aperto', -15, 2.3, -18.8, 2.6, 0.4, '+z');
    // tavolate: tavolo lungo e due panche
    for (const [tx, tz] of [[-12, -6], [-4, -6]]) {
      b.solid(tx, tz, 5, 0.9, 0.75, 0, true, true);
      for (const s of [-1, 1]) {
        S.box(tx, 0, tz + s * 0.85, 5, 0.45, 0.35);
        col.box(tx, tz + s * 0.85, 5, 0.35).low = true;
      }
      for (let k = 0; k < 4; k++) D.circle(tx - 1.8 + k * 1.2, 0.77, tz + (k % 2 ? 0.2 : -0.2), 0.12, 'y', 10);
    }
  }
  // --- il palco della banda ---
  {
    const px = 15, pz = -17;
    S.box(px, 0, pz, 7, 1.0, 4.4);
    col.rect(px - 3.5, pz - 2.2, px + 3.5, pz + 2.2);
    // scaletta di lato
    for (let i = 0; i < 3; i++) S.box(px + 3.75, 0, pz + 1.2 - i * 0.3, 0.5, (i + 1) * 0.33, 0.3);
    S.box(px, 1.0, pz - 2.1, 7, 2.8, 0.1);
    sign('BANDA DI SAN SCARABOCCHIO', px, 3.3, pz - 2.0, 5.2, 0.7, '+z', { font: MARKER_FONT });
    // leggii davanti alla tuba e al clarinetto, il microfono del sindaco
    for (const lx of [-2, 2]) {
      D.seg(px + lx, 1.0, pz + 1.5, px + lx, 2.0, pz + 1.5);
      D.box(px + lx, 2.0, pz + 1.5, 0.5, 0.35, 0.04);
    }
    D.seg(px + 2.9, 1.0, pz + 2.05, px + 2.9, 2.5, pz + 2.05);
    D.circle(px + 2.9, 2.55, pz + 2.05, 0.06, 'x', 8);
    // tamburo (davanti al tamburino)
    S.cylinder(px, 1.0, pz - 0.15, 0.3, 0.7, 12);
  }
  // --- il kebab di Rocco (anche alla sagra) ---
  {
    stall(10, 20.5, '-z', 2.6, 1.8, 'KEBAB ESISTENZIALE', CERA.marrone);
    S.cylinder(10, 1.0, 21.6, 0.2, 0.8, 10);
  }

  // =========================================================================
  // PUNTI NOTEVOLI
  // =========================================================================
  A('spawn', 0, 0, 34);
  A('spawnLook', 0, 3, 10);
  A('marco', 1.6, 0, 27.5);
  A('marcoTorte', 16.2, 0, -6.4);
  A('martina', -17.3, 0, 10.9);
  // i Pastelli stanno ai lati, in fondo: non in mezzo al tiro
  A('pastellone', -20.9, 0, -5.5);
  A('pastello', -20.9, 0, -2.5);
  A('penna', 7.5, 0, 12);
  A('pina', 18.3, 0, -2.3); // dentro la bancarella, lontana dal telo di lato (z -1,8)
  A('pallino', 16.5, 0, -1.2);
  A('crostata', 21.2, 0, -5.8); // dietro il tavolo, dentro la bancarella
  A('fluo', 19.6, 0, 10);
  A('bruno', 15.6, 0, 13.2);
  A('perno', 1.7, 0, WHEEL.z + 3.7);
  A('dario', -15, 0, -18);
  A('barnie', -13.1, 0, -14.3);
  A('sindaco', 17.9, 1.0, -15.4);
  A('banda0', 13, 1.0, -16.2);
  A('banda1', 15, 1.0, -17.6);
  A('banda2', 17, 1.0, -16.2);
  A('filosofo', -6.5, 0, 9.5);
  A('fabio', FOUNTAIN.x, 0, FOUNTAIN.z);
  A('rocco', 10, 0, 21.5);
  A('ruotaIn', 0, 0, WHEEL.z + 4.6);
  A('ruotaLook', 0, 6, WHEEL.z);
  A('fontanaLook', FOUNTAIN.x, 0.8, FOUNTAIN.z);
  A('dopoRuota', 0, 0, WHEEL.z + 5.4);

  return b.finish({ fog: [45, 140] });
}
