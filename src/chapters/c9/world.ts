import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch } from '../../render/sketch';
import { HAND_FONT, MARKER_FONT, moonTexture, textTexture } from '../../render/textures';
import { BLUE_HEX, RED_HEX, THEME } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Capitolo 9: Da Dario. Il pub, di sera, su carta da musica (pentagrammata).
//
//   il pub            x -10..10, z -8..8 (soffitto a 4 m), porta a sud (x 6, z 8)
//     bancone         a nord (x -8..2), Dario dietro
//     freccette       parete est: bersaglio in (9,86; 1,73; -1,5), linea di tiro a x 7,55
//     jukebox         parete ovest (x -9,6, z 2)
//     tavoli          la squadra (-4, 2,5), i Pastelli (-6,5, 5,6), le Biro Blu (0,5, 5,6),
//                     quello in fondo (-8,3, -2,6: briciole rosa)
//   la strada         Via del Pentagramma, x -14..132, carreggiata z 10..16, marciapiedi 8..10 e 16..18
//     casa di Martina a sud, porta in x 55
//     Via dei Temperini 4, 6, 8: tre lotti bianchi (x 68..98, a nord). Case cancellate.
//     il canale       x 104..112, con il ponte
//     casa di Marco   a nord, porta in x 123
// ---------------------------------------------------------------------------

export const PUB = { x0: -10, x1: 10, z0: -8, z1: 8, h: 4, door: 6 };
export const BOARD = { x: 9.86, y: 1.73, z: -1.5, r: 0.45 };
export const OCHE = 7.55; // la linea di tiro
export const TABLE = { x: 1.6, z: -1.2 }; // il tavolo della squadra (vicino al palco: Dario si vede bene)
export const TABLES = { team: TABLE, pastelli: { x: -6.5, z: 5.6 }, biro: { x: 0.5, z: 5.6 } };
export const HOMES = { martina: new THREE.Vector3(55, 0, 18.4), marco: new THREE.Vector3(123, 0, 7.6) };
export const LOTS = { x0: 68, x1: 98 };
// il palco del quiz (nell'angolo nord-est, a destra del bancone) e il microfono sull'asta
export const STAGE = { x: 4.9, z: -6.95, w: 3.4, d: 1.9, h: 0.35 };
export const MIC = { x: STAGE.x, y: STAGE.h + 1.6, z: STAGE.z };
// la Gazzosa Gigante: per terra, accanto al tavolo della squadra (è più alta di Pennino)
export const GAZ = { x: TABLE.x + 1.3, z: TABLE.z - 0.3, r: 0.42 };
export const CANAL = { x0: 104, x1: 112 };

export const REFS9 = {
  lm: null as LineMaterial | null,
  thin: null as LineMaterial | null,
  fill: null as THREE.Material | null,
  jukeboxGlow: null as THREE.Mesh | null,
  gazzosa: null as THREE.Group | null,
  gazLiquid: null as THREE.Mesh | null, // quanta gazzosa resta (scala in altezza)
  martinaWin: null as THREE.Mesh | null, // la finestra di Martina (si accende quando entra)
  tappo: null as THREE.Mesh | null, // il tappo giallo che saluta dalla finestra
};

export const inPub = (p: THREE.Vector3) => p.x > PUB.x0 && p.x < PUB.x1 && p.z > PUB.z0 && p.z < PUB.z1;

// Il bersaglio delle freccette di Dario: disegnato grande (i numeri si leggono anche col capogiro).
// Settori alternati inchiostro/carta, anelli doppio e triplo a penna rossa e blu.
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGS = { bull: 0.03, outer: 0.07, t0: 0.2, t1: 0.25, d0: 0.4, d1: 0.45 };

function dartboardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  const S = 1024 / 1.04; // pixel per metro
  const cx = 512, cy = 512;
  ctx.fillStyle = THEME.paperHex;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.52 * S, 0, Math.PI * 2);
  ctx.fill();
  const seg = (Math.PI * 2) / 20;
  // angolo 0 = in alto, in senso orario (come lo vedi)
  const wedge = (r0: number, r1: number, i: number, fill: string) => {
    const a0 = -Math.PI / 2 + i * seg - seg / 2, a1 = a0 + seg;
    ctx.beginPath();
    ctx.arc(cx, cy, r1 * S, a0, a1);
    ctx.arc(cx, cy, r0 * S, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0;
    const base = dark ? '#3a3129' : '#efe2c6';
    wedge(RINGS.outer, RINGS.d1, i, base);
    wedge(RINGS.t0, RINGS.t1, i, dark ? RED_HEX : BLUE_HEX);
    wedge(RINGS.d0, RINGS.d1, i, dark ? RED_HEX : BLUE_HEX);
  }
  ctx.fillStyle = BLUE_HEX;
  ctx.beginPath();
  ctx.arc(cx, cy, RINGS.outer * S, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RED_HEX;
  ctx.beginPath();
  ctx.arc(cx, cy, RINGS.bull * S, 0, Math.PI * 2);
  ctx.fill();
  // fili di ferro (a inchiostro)
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 3;
  for (const r of [RINGS.bull, RINGS.outer, RINGS.t0, RINGS.t1, RINGS.d0, RINGS.d1, 0.52]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * S, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + i * seg - seg / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * RINGS.outer * S, cy + Math.sin(a) * RINGS.outer * S);
    ctx.lineTo(cx + Math.cos(a) * RINGS.d1 * S, cy + Math.sin(a) * RINGS.d1 * S);
    ctx.stroke();
  }
  // i numeri
  ctx.fillStyle = THEME.inkHex;
  ctx.font = `${Math.round(0.055 * S)}px ${MARKER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  SECTORS.forEach((n, i) => {
    const a = -Math.PI / 2 + i * seg;
    ctx.fillText(String(n), cx + Math.cos(a) * 0.485 * S, cy + Math.sin(a) * 0.485 * S);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildPub(): World {
  const b = new WorldBuilder(909);
  const { S, D, G, col, A, sign, wallText, rr } = b;
  const y = 0.02;
  b.ground();
  REFS9.lm = b.lineMat(2.2);
  REFS9.thin = b.lineMat(1.5);
  REFS9.fill = b.fill;

  // =========================================================================
  // IL CIELO DI SERA: la carta si scurisce verso l'alto (color lavagna), luna e stelle
  // =========================================================================
  {
    const sky = new THREE.SphereGeometry(280, 24, 12);
    const col = new Float32Array(sky.getAttribute('position').count * 3);
    const lo = new THREE.Color(THEME.paperHex), hi = new THREE.Color('#8f8797'), c = new THREE.Color();
    const pos = sky.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = Math.max(0, Math.min(1, pos.getY(i) / 150));
      c.copy(lo).lerp(hi, Math.pow(k, 0.7)).toArray(col, i * 3);
    }
    sky.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.position.set(60, 0, 13);
    dome.renderOrder = -2;
    b.group.add(dome);
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false }));
    moon.scale.setScalar(24);
    moon.position.set(120, 75, -150);
    b.group.add(moon);
    const stars = new Sketch();
    stars.style = { jitter: 0, over: 0 };
    for (let i = 0; i < 110; i++) {
      const a = rr(0, Math.PI * 2), e = rr(0.25, 1.2), d = 200;
      const x = 60 + Math.cos(a) * Math.cos(e) * d, yy = Math.sin(e) * d, z = Math.sin(a) * Math.cos(e) * d;
      const s = rr(0.6, 1.5);
      stars.seg(x - s, yy, z, x + s, yy, z).seg(x, yy - s, z, x, yy + s, z);
    }
    const m = b.lineMat(1.3);
    m.fog = false;
    b.group.add(stars.build(m, b.fill));
  }

  // =========================================================================
  // IL PUB
  // =========================================================================
  const { x0, x1, z0, z1, h } = PUB;
  b.wall(x0, z0, x1, z0, h);
  b.wall(x0, z0, x0, z1, h);
  b.wall(x1, z0, x1, z1, h);
  b.wallDoor(x0, z1, x1, z1, PUB.door, 1.8, h, 2.5);
  b.ceiling(x0, z0, x1, z1, h - 0.01);
  S.roof(0, h, 0, 20.4, 16.4, 2.4, 'x');
  // pavimento di legno: assi
  for (let x = x0 + 0.6; x < x1; x += 0.6) G.seg(x, y, z0 + 0.1, x, y, z1 - 0.1, { over: 0 });
  // travi e lampade appese (con la lampadina)
  for (let x = -7.5; x <= 7.5; x += 5) {
    S.box(x, h - 0.25, 0, 0.25, 0.25, 16);
    for (const z of [-3.5, 3.5]) {
      D.seg(x, h - 0.25, z, x, 2.9, z);
      D.poly([[x - 0.25, 2.9, z], [x + 0.25, 2.9, z], [x + 0.12, 3.08, z], [x - 0.12, 3.08, z]], true);
      D.circle(x, 2.82, z, 0.07, 'x', 8);
    }
  }
  // --- il bancone (a nord): piano di legno scuro, pannelli a doghe davanti, poggiapiedi ---
  b.solid(-3, -5.75, 10, 0.9, 1.05);
  {
    const top = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: '#7a5436' }));
    top.position.set(-3, 1.1, -5.75);
    b.group.add(top);
    D.poly([[-8.2, 1.155, -6.35], [2.2, 1.155, -6.35], [2.2, 1.155, -5.15], [-8.2, 1.155, -5.15]], true);
    D.seg(-8.2, 1.045, -5.145, 2.2, 1.045, -5.145).seg(-8.2, 1.045, -5.145, -8.2, 1.155, -5.145).seg(2.2, 1.045, -5.145, 2.2, 1.155, -5.145);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.05), new THREE.MeshBasicMaterial({ color: '#d9c092' }));
    front.position.set(-3, 0.525, -5.285);
    b.group.add(front);
    for (let x = -7.65; x < 2; x += 0.35) D.seg(x, 0.04, -5.27, x, 1.0, -5.27, { over: 0 });
    // il poggiapiedi (una sbarra con i sostegni)
    S.seg(-8, 0.24, -5.05, 2, 0.24, -5.05);
    for (let x = -7.5; x <= 1.6; x += 1.5) S.seg(x, 0.02, -5.28, x, 0.24, -5.05);
  }
  for (let x = -7.4; x <= 1.8; x += 1.3) b.stool(x, -4.6);
  // spine della gazzosa e mensole con le bottiglie
  for (const x of [-5, -4, -3]) {
    S.seg(x, 1.18, -6.0, x, 1.55, -6.0).seg(x, 1.55, -6.0, x, 1.55, -5.8);
    D.box(x, 1.55, -6.0, 0.12, 0.2, 0.12);
  }
  for (const sy of [1.5, 2.2]) {
    S.box(-3, sy, -7.75, 11, 0.06, 0.4);
    for (let i = 0; i < 16; i++) S.cylinder(-8.2 + i * 0.68, sy + 0.06, -7.75, 0.07, 0.3 + (i % 3) * 0.06, 6);
  }
  wallText('GAZZOSA ALLA SPINA\nfrizzante · molto frizzante · Gigante', -3, 3.25, -7.86, 5, 0.8, '+z');
  // --- il palco del quiz: pedana, gradino, asta col microfono (grande: si vede dal tavolo), faro ---
  {
    const { x: sx, z: sz, w: sw, d: sd, h: sh } = STAGE;
    b.solid(sx, sz, sw, sd, sh);
    for (let x = sx - sw / 2 + 0.3; x < sx + sw / 2; x += 0.4) D.seg(x, 0.02, sz + sd / 2 + 0.005, x, sh - 0.02, sz + sd / 2 + 0.005, { over: 0 });
    S.box(sx - sw / 2 + 0.45, 0, sz + sd / 2 + 0.25, 0.7, 0.17, 0.5);
    // l'asta
    S.circle(MIC.x, sh + 0.01, MIC.z, 0.2, 'y', 12);
    S.seg(MIC.x, sh, MIC.z, MIC.x, MIC.y - 0.2, MIC.z);
    // il microfono: impugnatura e testa a griglia (scura)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.24, 8), new THREE.MeshBasicMaterial({ color: '#3a3129' }));
    handle.position.set(MIC.x, MIC.y - 0.1, MIC.z + 0.03);
    handle.rotation.x = -0.35;
    b.group.add(handle);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshBasicMaterial({ color: '#4a4038' }));
    head.position.set(MIC.x, MIC.y + 0.04, MIC.z - 0.02);
    b.group.add(head);
    D.circle(MIC.x, MIC.y + 0.04, MIC.z - 0.02, 0.105, 'x', 12).circle(MIC.x, MIC.y + 0.04, MIC.z - 0.02, 0.105, 'z', 12);
    // il filo, per terra
    D.curve([[MIC.x, sh + 0.02, MIC.z], [MIC.x + 0.5, sh + 0.02, MIC.z + 0.3], [MIC.x + 1.0, sh + 0.02, MIC.z - 0.2], [sx + sw / 2 - 0.1, sh + 0.02, MIC.z + 0.4]]);
    // il faro dal soffitto: un cono di luce sul palco
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.25, h - 0.1 - sh, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: '#f5dc9a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    cone.position.set(sx, (h - 0.1 + sh) / 2, sz - 0.1);
    b.group.add(cone);
    D.circle(sx, h - 0.12, sz - 0.1, 0.14, 'y', 10);
    sign('QUIZ DELLA SERATA\nsquadre da tre', sx, 2.95, -7.85, 2.2, 0.9, '+z', { font: HAND_FONT });
  }
  // --- il bersaglio (parete est) e la linea di tiro ---
  {
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.52, 48), new THREE.MeshBasicMaterial({ map: dartboardTexture() }));
    board.rotation.y = -Math.PI / 2;
    board.position.set(BOARD.x, BOARD.y, BOARD.z);
    // la texture è quadrata, il cerchio usa le sue coordinate: le rimappo sul quadrato
    const uv = board.geometry.getAttribute('uv');
    const pos = board.geometry.getAttribute('position');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / 1.04, 0.5 + pos.getY(i) / 1.04);
    b.group.add(board);
    S.box(BOARD.x + 0.07, BOARD.y - 0.6, BOARD.z, 0.1, 1.2, 1.2); // il pannello di sughero dietro
    // il pannello è chiaro (niente tratteggio): le freccette si devono vedere
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.18), new THREE.MeshBasicMaterial({ color: THEME.paperHex }));
    panel.rotation.y = -Math.PI / 2;
    panel.position.set(BOARD.x + 0.015, BOARD.y, BOARD.z);
    b.group.add(panel);
    G.seg(OCHE, y, BOARD.z - 1, OCHE, y, BOARD.z + 1, { over: 0 });
    b.groundText('OCHE', OCHE - 0.35, BOARD.z, 1.2, 0.35, Math.PI / 2);
    // la lavagna dei punti
    sign('FRECCETTE\nfinale: Barnie contro tutti', 9.86, 2.1, BOARD.z + 2.1, 1.6, 0.8, '-x', { font: HAND_FONT });
    sign('CAMPIONE DA 11 SERATE:\nBARNIE', 9.86, 2.1, BOARD.z - 2.1, 1.6, 0.8, '-x', { font: HAND_FONT });
  }
  // --- il jukebox (parete ovest) ---
  {
    const jx = x0 + 0.45, jz = 2;
    S.box(jx, 0, jz, 0.8, 1.35, 1.1);
    S.push(jx, 1.35, jz, Math.PI / 2);
    const arc: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      arc.push([Math.cos(a) * 0.55, Math.sin(a) * 0.35, 0.4]);
    }
    S.curve(arc);
    S.pop();
    for (let i = 0; i < 4; i++) D.seg(jx + 0.41, 0.3 + i * 0.22, jz - 0.35, jx + 0.41, 0.3 + i * 0.22, jz + 0.35, { over: 0 });
    D.circle(jx + 0.41, 1.1, jz, 0.14, 'x', 12);
    // la luce del jukebox (si accende quando lo aggiusti)
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#f2b84b', transparent: true, opacity: 0.35, depthWrite: false }));
    glow.rotation.y = Math.PI / 2;
    glow.position.set(jx + 0.42, 1.35, jz);
    glow.scale.set(1.08, 0.68, 1);
    b.group.add(glow);
    REFS9.jukeboxGlow = glow;
    col.box(jx, jz, 0.8, 1.1);
    wallText('JUKEBOX\n(un pugno e riparte)', jx + 0.44, 2.3, jz, 1.2, 0.5, '+x');
  }
  // --- i tavoli ---
  // i tavoli, con gli sgabelli attorno (a = angolo del primo sgabello)
  const table = (x: number, z: number, r = 0.75, chairs = 3, a0 = 0.4) => {
    b.roundTable(x, z, r);
    const st: [number, number][] = [];
    for (let i = 0; i < chairs; i++) {
      const a = (i / chairs) * Math.PI * 2 + a0;
      st.push([x + Math.cos(a) * (r + 0.45), z + Math.sin(a) * (r + 0.45)]);
      b.stool(st[i][0], st[i][1]);
    }
    return st;
  };
  // la squadra: tu a nord (verso il bancone), Marco a sud-ovest, Martina a sud-est
  const team = table(TABLE.x, TABLE.z, 0.8, 3, -Math.PI / 2);
  const pastelli = table(TABLES.pastelli.x, TABLES.pastelli.z, 0.75, 3, -Math.PI / 2);
  const biro = table(TABLES.biro.x, TABLES.biro.z, 0.75, 3, -Math.PI / 2);
  table(4.5, 2.2, 0.6, 2);
  table(-4, 2.5, 0.6, 2);
  // la Gazzosa Gigante (arriva dopo il quiz): per terra, alta più di Pennino, una cannuccia sola
  {
    const gz = new Sketch();
    gz.style = { jitter: 0.004, over: 0.01 };
    const R = GAZ.r;
    gz.cylinder(0, 0, 0, R, 1.45, 18);
    // spalla, collo, tappo
    gz.circle(0, 1.75, 0, 0.16, 'y', 12);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gz.seg(Math.cos(a) * R, 1.45, Math.sin(a) * R, Math.cos(a) * 0.16, 1.75, Math.sin(a) * 0.16);
    }
    gz.cylinder(0, 1.75, 0, 0.16, 0.25, 10);
    gz.cylinder(0, 2.0, 0, 0.19, 0.08, 10);
    // bollicine sulla bottiglia
    const r = b.r;
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, yy = 0.15 + r() * 1.2;
      const ax = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z';
      gz.circle(Math.cos(a) * (R + 0.005), yy, Math.sin(a) * (R + 0.005), 0.02 + r() * 0.025, ax, 6);
    }
    const grp = new THREE.Group();
    grp.add(gz.build(REFS9.lm!, b.fill));
    // la gazzosa dentro (quanta ne resta)
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(R - 0.03, R - 0.03, 1, 20).translate(0, 0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#e3d77e', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    liquid.position.y = 0.03;
    liquid.scale.y = 1.38;
    grp.add(liquid);
    REFS9.gazLiquid = liquid;
    // l'etichetta tutto intorno
    const lt = textTexture('GAZZOSA GIGANTE  ·  3 LITRI (DICE)  ·  ', { w: 1024, h: 128, size: 58, font: MARKER_FONT, bg: '#f4ead0', color: '#b03a32' });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.34, 28, 1, true), new THREE.MeshBasicMaterial({ map: lt }));
    label.position.y = 0.72;
    grp.add(label);
    // la cannuccia: esce dal collo, sale, e a zig-zag arriva sopra il tavolo
    const straw: [number, number, number][] = [[0.03, 1.85, 0], [0.04, 2.4, 0.01]];
    const tx = TABLE.x - GAZ.x, tz = TABLE.z - GAZ.z, tl = Math.hypot(tx, tz);
    for (let k = 1; k <= 6; k++) {
      const f = (k / 6) * 0.97, side = k % 2 ? 0.09 : -0.09;
      straw.push([0.04 + tx * f - (tz / tl) * side, 2.4 + (k % 2 ? 0.08 : -0.02), 0.01 + tz * f + (tx / tl) * side]);
    }
    straw.push([tx * 0.97, 1.3, tz * 0.97]);
    const sk = new Sketch();
    sk.style = { jitter: 0.004, over: 0 };
    sk.curve(straw);
    grp.add(sk.build(b.lineMat(4.5, RED_HEX), b.fill));
    grp.position.set(GAZ.x, 0, GAZ.z);
    grp.visible = false;
    b.group.add(grp);
    REFS9.gazzosa = grp;
  }
  // il tavolo in fondo: vuoto, con le briciole rosa e un sottobicchiere mezzo cancellato
  {
    const fx = -8.3, fz = -2.6;
    table(fx, fz, 0.55, 2);
    const cr = new Sketch();
    cr.style = { jitter: 0.005, over: 0 };
    const r = b.r;
    for (let i = 0; i < 22; i++) {
      const px = fx + (r() - 0.5) * 1.8, pz = fz + (r() - 0.5) * 1.8;
      const s = 0.025 + r() * 0.03;
      const yy = Math.hypot(px - fx, pz - fz) < 0.55 ? 0.8 : y + 0.01;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < 7; k++) pts.push([px + Math.cos(k * 1.1) * s * (1 + k * 0.3), yy, pz + Math.sin(k * 1.1) * s * (1 + k * 0.3)]);
      cr.curve(pts);
    }
    b.group.add(cr.build(b.lineMat(2, '#e8839f'), b.fill));
    // sottobicchiere: mezzo cerchio (l'altra metà non c'è)
    const half: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) half.push([fx + 0.12 + Math.cos((i / 10) * Math.PI) * 0.09, 0.795, fz + Math.sin((i / 10) * Math.PI) * 0.09]);
    D.curve(half);
  }
  // bagno (porta chiusa) e un attaccapanni
  D.rectV(x0 + 0.03, 0, -6.5, 1.1, 2.2, 'z');
  sign('BAGNO\n(disegnato)', x0 + 0.05, 2.45, -5.95, 0.9, 0.4, '+x', { font: HAND_FONT });
  S.seg(-9.6, 0, 6.6, -9.6, 1.9, 6.6).seg(-9.8, 1.9, 6.6, -9.4, 1.9, 6.6);
  // finestre (da dentro): si vede la sera
  for (const x of [-6, -2, 2]) D.window(x - 0.7, 1.1, z1 - 0.13, 1.4, 1.3, 'x');

  // =========================================================================
  // FUORI: VIA DEL PENTAGRAMMA (di sera)
  // =========================================================================
  G.seg(-14, y, 10, 132, y, 10).seg(-14, y, 16, 132, y, 16);
  G.dashed(-14, y, 13, 132, y, 13, 2, 2);
  D.seg(-14, y, 8, 132, y, 8).seg(-14, y, 18, 132, y, 18);
  // l'insegna del pub (al neon, calda)
  b.neon('DA DARIO', 0, h + 0.6, z1 + 0.15, 5, 1.2, '+z', '#f2b84b');
  sign('pub · gazzosa · freccette', -4, 2.9, z1 + 0.14, 3.2, 0.5, '+z', { font: HAND_FONT });
  // le finestre del pub, da fuori: cornice disegnata e dentro la luce accesa
  for (const x of [-6, -2, 2]) {
    D.window(x - 0.7, 1.1, z1 + 0.145, 1.4, 1.3, 'x');
    b.litPane(x, 1.75, z1 + 0.13, 1.36, 1.26, 0);
  }
  // finestre accese qua e là, sempre dentro finestre vere (poche: è sera, non tutti sono a casa)
  const litAt = (seed: number) => (f: number, i: number) => (seed * 7 + i * 5 + f * 3) % 9 < 3;
  // case a nord (dietro il marciapiede) e a sud; lasciano il posto ai lotti e al canale
  const north: [number, number, number, 'flat' | 'gable'][] = [
    [-14, -10.5, 6, 'gable'], [10.5, 22, 7, 'flat'], [22.5, 36, 6, 'gable'], [36.5, 50, 8, 'flat'], [50.5, 67, 6.5, 'gable'],
    [99, 103.5, 6, 'flat'], [113, 118, 6, 'gable'], [118.5, 128, 7, 'gable'], [128.5, 134, 6, 'flat'],
  ];
  for (const [bx0, bx1, bh, roof] of north) {
    const isMarco = bx0 === 118.5;
    // a casa di Marco la mamma aspetta sveglia: la luce del piano terra è accesa
    const lit = isMarco ? (f: number, i: number) => f === 0 && i === 0 : litAt(Math.round(bx0));
    b.building({ x0: bx0, x1: bx1, z0: -4, z1: 7.8, h: bh, face: '+z', roof, door: isMarco ? HOMES.marco.x : undefined, sign: isMarco ? 'Famiglia di Marco\n(bussare piano)' : undefined, signW: 3, lit });
  }
  const south: [number, number, number, 'flat' | 'gable'][] = [
    [-14, 4, 6, 'flat'], [4.5, 20, 7, 'gable'], [20.5, 34, 6, 'flat'], [34.5, 49.5, 7, 'gable'], [50, 60, 6, 'gable'],
    [60.5, 76, 8, 'flat'], [76.5, 92, 6, 'gable'], [92.5, 103.5, 7, 'flat'], [113, 124, 6, 'flat'], [124.5, 134, 7, 'gable'],
  ];
  for (const [bx0, bx1, bh, roof] of south) {
    const isMartina = bx0 === 50;
    // da Martina è tutto spento: si accende la sua camera (primo piano, la prima a sinistra) quando entra
    const lit = isMartina ? () => false : litAt(Math.round(bx1) + 3);
    b.building({ x0: bx0, x1: bx1, z0: 18.2, z1: 30, h: bh, face: '-z', roof, door: isMartina ? HOMES.martina.x : undefined, sign: isMartina ? 'Martina\n(e la sua collezione)' : undefined, signW: 3, lit });
  }
  {
    const win = b.litPane(51.8, 4.6, 18.185, 1.14, 1.34, Math.PI, new THREE.MeshBasicMaterial({ color: '#f7c9dc', transparent: true, opacity: 0.75 }));
    win.visible = false;
    REFS9.martinaWin = win;
    const tappo = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), new THREE.MeshBasicMaterial({ color: '#f2c200', side: THREE.DoubleSide }));
    tappo.position.set(51.8, 4.45, 18.165);
    tappo.rotation.y = Math.PI;
    tappo.visible = false;
    b.group.add(tappo);
    REFS9.tappo = tappo;
  }
  // lampioni
  for (let x = -8; x < 132; x += 12) {
    if (x > CANAL.x0 - 1 && x < CANAL.x1 + 1) continue;
    b.lamp(x, 9.1, 1);
    b.lamp(x + 6, 16.9, -1);
  }
  // --- Via dei Temperini 4, 6, 8: tre lotti bianchi ---
  {
    const blank = new THREE.Mesh(new THREE.PlaneGeometry(LOTS.x1 - LOTS.x0, 11.5), new THREE.MeshBasicMaterial({ color: '#fffdf6' }));
    blank.rotation.x = -Math.PI / 2;
    blank.position.set((LOTS.x0 + LOTS.x1) / 2, 0.012, 2);
    b.group.add(blank);
    for (let z = -3.8; z < 7.8; z += 0.5) {
      for (const bx of [LOTS.x0, LOTS.x1]) G.seg(bx + Math.sin(z * 2.1) * 0.25, y, z, bx + Math.sin((z + 0.5) * 2.1) * 0.25, y, z + 0.5, { over: 0 });
    }
    // i numeri civici sono rimasti: pali col numero, e dietro niente
    [4, 6, 8].forEach((n, i) => {
      const nx = LOTS.x0 + 5 + i * 10;
      S.seg(nx, 0, 7.6, nx, 1.5, 7.6);
      sign(`Via dei Temperini, ${n}`, nx, 1.75, 7.62, 1.6, 0.45, '+z', { font: HAND_FONT });
    });
    const cr = new Sketch();
    cr.style = { jitter: 0.01, over: 0 };
    const r = b.r;
    for (let i = 0; i < 60; i++) {
      const px = LOTS.x0 + 1 + r() * (LOTS.x1 - LOTS.x0 - 2), pz = -3 + r() * 10;
      const s = 0.04 + r() * 0.05;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < 7; k++) pts.push([px + Math.cos(k * 1.1) * s * (1 + k * 0.3), y + 0.02, pz + Math.sin(k * 1.1) * s * (1 + k * 0.3)]);
      cr.curve(pts);
    }
    b.group.add(cr.build(b.lineMat(2, '#e8839f'), b.fill));
    sign('QUARTIERE TEMPERINI', LOTS.x0 - 1.2, 2.6, 8.6, 2.2, 0.5, '+z', { font: MARKER_FONT });
    S.seg(LOTS.x0 - 1.2, 0, 8.6, LOTS.x0 - 1.2, 2.35, 8.6);
    col.rect(LOTS.x0, -6, LOTS.x1, 7.6); // sul niente non si cammina (si "sbatte" contro il bianco)
  }
  // --- il canale, col ponte ---
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CANAL.x1 - CANAL.x0, 70), new THREE.MeshBasicMaterial({ color: '#4a4f5c' }));
    water.rotation.x = -Math.PI / 2;
    water.position.set((CANAL.x0 + CANAL.x1) / 2, 0.01, 12);
    b.group.add(water);
    const wv = new Sketch();
    wv.style = { jitter: 0.02, over: 0 };
    for (let i = 0; i < 30; i++) {
      const wx = CANAL.x0 + 0.6 + (i % 5) * 1.5, wz = -20 + i * 2.2;
      if (wz > 9 && wz < 17) continue;
      wv.curve([[wx, 0.02, wz], [wx + 0.3, 0.02, wz + 0.15], [wx + 0.6, 0.02, wz], [wx + 0.9, 0.02, wz + 0.15]]);
    }
    b.group.add(wv.build(b.lineMat(1.4, '#d8dce6'), b.fill));
    // il ponte: la strada ci passa sopra, con le spallette
    S.box((CANAL.x0 + CANAL.x1) / 2, 0, 13, CANAL.x1 - CANAL.x0 + 1, 0.12, 8.4);
    for (const z of [8.9, 17.1]) {
      S.box((CANAL.x0 + CANAL.x1) / 2, 0.12, z, CANAL.x1 - CANAL.x0 + 1, 0.8, 0.25);
      col.rect(CANAL.x0 - 0.5, z - 0.12, CANAL.x1 + 0.5, z + 0.12);
    }
    sign('Canale dell\'Inchiostro', CANAL.x0 - 0.8, 1.9, 9.5, 2, 0.45, '+z', { font: HAND_FONT });
    S.seg(CANAL.x0 - 0.8, 0, 9.5, CANAL.x0 - 0.8, 1.68, 9.5);
    col.rect(CANAL.x0, -40, CANAL.x1, 8.8);
    col.rect(CANAL.x0, 17.2, CANAL.x1, 60);
  }
  // fine della via: muretti (di qua e di là non si esce)
  col.rect(-18, -8, -14, 34);
  col.rect(132, -8, 136, 34);
  S.box(132, 0, 13, 0.3, 1.1, 10);
  sign('FINE DEL FOGLIO\n(si torna indietro)', 131.8, 1.6, 13, 2, 0.7, '-x', { font: HAND_FONT });
  // dietro le case non si va (il pub no: arriva fino a z -8, bancone compreso)
  col.rect(-18, -8, PUB.x0 - 0.15, -4);
  col.rect(PUB.x1 + 0.15, -8, 136, -4);
  col.rect(-18, 30, 136, 34);

  // =========================================================================
  // PUNTI NOTEVOLI
  // =========================================================================
  A('spawn', PUB.door + 3, 0, 16);
  A('spawnLook', PUB.door - 4, 2.8, 8);
  A('dario', -3, 0, -7);
  A('barnie', 7.0, 0, -4.3); // dietro la spalla di chi tira: non copre il bersaglio
  // seduti sugli sgabelli (alti: si sta 25 cm più su)
  A('seat', team[0][0], 0.25, team[0][1]);
  A('martina', team[1][0], 0.25, team[1][1]);
  A('marco', team[2][0], 0.25, team[2][1]);
  A('pBlu', pastelli[0][0], 0.25, pastelli[0][1]);
  A('pGiallo', pastelli[1][0], 0.25, pastelli[1][1]);
  A('pRosso', pastelli[2][0], 0.25, pastelli[2][1]);
  A('penna', biro[1][0], 0.25, biro[1][1]);
  A('pennino', biro[2][0], 0.25, biro[2][1]);
  A('teamTable', TABLE.x, 0.8, TABLE.z);
  A('mic', MIC.x, MIC.y, MIC.z);
  A('darioMic', MIC.x, STAGE.h, MIC.z - 0.42);
  A('darioGaz', GAZ.x + 0.6, 0, GAZ.z - 0.75); // dove si ferma Dario, accanto alla bottiglia
  A('martinaDoor', HOMES.martina.x, 0, HOMES.martina.z - 0.55);
  A('tray', -0.4, 1.16, -5.45);
  A('tavolo7', -8.3, 0.8, -2.6);
  A('jukebox', x0 + 0.45, 1.1, 2);
  A('dartSpot', OCHE - 0.25, 0, BOARD.z);
  A('board', BOARD.x, BOARD.y, BOARD.z);
  A('door', PUB.door, 1.2, z1);
  A('mamma', HOMES.marco.x, 0, 8.4);

  return b.finish({ isIndoor: inPub, fog: [35, 120] });
}
