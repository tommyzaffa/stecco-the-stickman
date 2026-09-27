import * as THREE from 'three';
import { Sketch } from '../../render/sketch';
import { HAND_FONT, glowTexture } from '../../render/textures';
import { CERA } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Il quartiere dei Pastelli a Cera e il ristorante "Da Pastello". Cartoncino color prugna:
// di sera, a lume di candela. Le case sono disegnate come le disegnano i bambini.
//
// Pianta:
//   la via             x -10..10, z -36..-8   (si arriva da sud)
//   il ristorante      x -12..12, z -8..16    (ingresso a z = -8, finestra a destra della porta)
//   il nostro tavolo   (0, 4): Stecco a sud, Martina a nord
// ---------------------------------------------------------------------------

export const ZONES = {
  inside: (p: THREE.Vector3) => p.x > -12 && p.x < 12 && p.z > -8 && p.z < 16,
};

// Dove può spuntare Marco durante la cena (tutti nel campo visivo di Martina, alle tue spalle o di lato)
export interface MarcoSpot {
  id: string;
  pos: [number, number];
  y?: number;
  face: [number, number];
}
export const MARCO_SPOTS: MarcoSpot[] = [
  { id: 'pianta', pos: [-4.3, -2.4], face: [0, 3] },
  { id: 'finestra', pos: [4.25, -8.85], face: [0, 3] },
  { id: 'attaccapanni', pos: [6.5, -6.2], face: [0, 3] },
  { id: 'acquario', pos: [-10.95, 3.0], face: [0, 3] },
  { id: 'lampadario', pos: [-2.8, -3.4], y: 2.15, face: [0, 3] },
];

export function buildPastello(): World {
  const b = new WorldBuilder(505);
  const { S, D, G, col, group, A, sign, neon, wall, solid, rr } = b;
  const y = 0.02;
  b.ground();

  // colori a cera (per gli scarabocchi dei Pastelli)
  const wax = (color: string, width = 2.6) => b.lineMat(width, color);
  const scribble = (color: string, draw: (s: Sketch) => void) => {
    const s = new Sketch();
    s.style = { jitter: 0.04, over: 0.08 };
    draw(s);
    group.add(s.build(wax(color), b.fill));
  };

  // =========================================================================
  // LA VIA (quartiere dei Pastelli)
  // =========================================================================
  G.seg(-10, y, -36, -10, y, -8).seg(10, y, -36, 10, y, -8);
  for (let z = -34; z < -9; z += 2.4) G.seg(0, y, z, 0, y, z + 1.2, { over: 0 });
  // case disegnate dai bambini
  const house = (x0: number, x1: number, z0: number, z1: number, h: number) => {
    b.building({ x0, x1, z0, z1, h, face: '-z', roof: 'gable', door: (x0 + x1) / 2 });
  };
  house(-24, -11, -34, -26, 6);
  house(-24, -11, -24, -14, 7);
  house(11, 24, -34, -24, 6.5);
  house(11, 24, -22, -12, 5.5);
  // soli, fumo dai camini, scarabocchi colorati sui muri
  scribble(CERA.arancione, (s) => {
    for (const [x, z] of [[-17, -30], [17, -29]] as const) s.curve([[x, 9.2, z], [x + 0.6, 9.8, z], [x + 0.2, 10.4, z], [x + 0.9, 11, z], [x + 0.5, 11.6, z]]);
  });
  scribble(CERA.verde, (s) => {
    for (let i = 0; i < 7; i++) s.seg(-10.9, 0.3, -32 + i * 0.5, -10.9, 0.7 + rr(0, 0.4), -31.8 + i * 0.5, { over: 0 });
  });
  scribble(CERA.blu, (s) => s.curve([[10.9, 2.5, -20], [10.9, 3.2, -18.5], [10.9, 2.4, -17], [10.9, 3.1, -15.5]]));
  b.wallText('W I PASTELLI', -10.87, 2.4, -19, 3, 0.8, '+x', CERA.rosso);
  b.wallText('vietato ai grigi\n(scherzo) (non scherzo)', 10.87, 1.7, -29, 3.2, 0.9, '-x', CERA.viola);
  // campana disegnata col gesso colorato
  scribble(CERA.rosso, (s) => {
    const cells: [number, number][] = [[-5, -22], [-5, -21], [-5.5, -20], [-4.5, -20], [-5, -19], [-5.5, -18], [-4.5, -18], [-5, -17]];
    for (const [x, z] of cells) s.poly([[x - 0.45, y, z - 0.45], [x + 0.45, y, z - 0.45], [x + 0.45, y, z + 0.45], [x - 0.45, y, z + 0.45]], true);
  });
  b.groundText('CIELO', -5, -16.2, 1.2, 0.4, Math.PI, CERA.rosso);
  // fondo della via: uno steccato
  for (let x = -10; x <= 10; x += 0.8) S.seg(x, 0, -36, x, 1.1, -36, { over: 0.02 });
  S.seg(-10, 0.8, -36, 10, 0.8, -36);
  col.rect(-12, -38, 12, -36);
  col.rect(-12, -38, -10, -8);
  col.rect(10, -38, 12, -8);
  // lampioni
  for (const [x, z] of [[-8.5, -30], [8.5, -22], [-8.5, -14]] as const) b.lamp(x, z, x < 0 ? 1 : -1);
  // carretto della fioraia
  S.box(6.3, 0.4, -18.5, 1.8, 0.7, 1.0);
  for (const wx of [5.6, 7.0]) S.circle(wx, 0.35, -17.95, 0.3, 'z', 12);
  for (let i = 0; i < 6; i++) D.circle(5.7 + i * 0.25, 1.25 + (i % 2) * 0.1, -18.5, 0.1, 'z', 8);
  col.box(6.3, -18.5, 1.9, 1.1);
  A('fioraia', 6.3, 0, -19.6);

  // =========================================================================
  // IL RISTORANTE "DA PASTELLO"
  // =========================================================================
  const H = 4.2;
  b.ceiling(-12, -8, 12, 16, H);
  // facciata con porta e finestra (dalla finestra si vede dentro... e da dentro si vede fuori)
  const fz = -8;
  S.box(-7, 0, fz, 10, H, 0.25); // x -12..-2
  S.box(1.5, 0, fz, 3, H, 0.25); // x 0..3 (porta disegnata)
  S.box(4.25, 0, fz, 2.5, 1.0, 0.25).box(4.25, 2.4, fz, 2.5, H - 2.4, 0.25); // sotto e sopra la finestra
  S.box(8.75, 0, fz, 6.5, H, 0.25); // x 5.5..12
  S.box(-1, 0, fz, 2, 2.4, 0.25); // porta
  S.box(-1, 2.4, fz, 2, H - 2.4, 0.25);
  D.circle(-0.4, 1.1, fz - 0.15, 0.06, 'z', 8);
  col.rect(-12, fz - 0.15, 12, fz + 0.15);
  // insegna
  neon('Da Pastello', 0, H + 0.8, fz - 0.2, 5, 1.2, '-z', '#ff8fbf');
  sign('cucina a cera · dal cuore tenero', 0, H + 0.05, fz - 0.16, 3.6, 0.45, '-z', { font: HAND_FONT });
  sign('MENÙ DEL GIORNO\ncera fusa al sugo\nspaghetti alla gomma pane\ntorta di gomma pane', -6, 1.6, fz - 0.16, 2.2, 1.3, '-z', { font: HAND_FONT });
  A('maitre', 1.7, 0, -9.2);
  A('door', -1, 1.2, -8.3);
  // muri interni
  wall(-12, -8, -12, 16, H);
  wall(12, -8, 12, 16, H);
  wall(-12, 16, 12, 16, H);
  // pavimento a scacchi (solo le righe)
  for (let x = -11; x <= 11; x += 2) G.seg(x, y, -7.8, x, y, 15.8, { over: 0, jitter: 0.03 });
  for (let z = -6; z <= 14; z += 2) G.seg(-11.8, y, z, 11.8, y, z, { over: 0, jitter: 0.03 });

  const candles: [number, number][] = [];
  const table = (x: number, z: number, r = 0.75, candle: [number, number] = [0, 0]) => {
    b.roundTable(x, z, r);
    // tovaglia
    D.circle(x, 0.72, z, r + 0.08, 'y', 18);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      D.seg(x + Math.cos(a) * (r + 0.08), 0.72, z + Math.sin(a) * (r + 0.08), x + Math.cos(a) * (r + 0.1), 0.45, z + Math.sin(a) * (r + 0.1), { over: 0 });
    }
    // candela
    D.cylinder(x + candle[0], 0.76, z + candle[1], 0.03, 0.14, 6);
    candles.push([x + candle[0], z + candle[1]]);
  };
  const chair = (x: number, z: number, faceZ: 1 | -1) => {
    S.box(x, 0.45, z, 0.5, 0.05, 0.48);
    const back = z - faceZ * 0.24;
    for (const dx of [-0.21, 0.21]) {
      S.seg(x + dx, 0, z + faceZ * 0.2, x + dx, 0.45, z + faceZ * 0.2, { over: 0.02 });
      S.seg(x + dx, 0, back, x + dx, 1.05, back, { over: 0.02 });
    }
    D.seg(x - 0.21, 0.95, back, x + 0.21, 0.95, back).seg(x - 0.21, 0.75, back, x + 0.21, 0.75, back);
  };
  // il nostro tavolo (la candela di lato, sennò copre Martina)
  table(0, 4, 0.75, [0.45, 0.25]);
  chair(0, 2.95, 1);
  chair(0, 5.05, -1);
  A('seat', 0, 0, 2.95);
  A('martina', 0, 0, 5.05);
  A('tableSide', 1.15, 0, 4.2);
  A('maitreTable', -1.2, 0, 4.1); // il maître quando viene al tavolo
  A('maitrePost', 8.6, 0, -2.2); // il maître dentro, vicino all'ingresso
  A('violinSpot', -1.25, 0, 5.2);
  // gli altri tavoli (coppie di Pastelli)
  const others: [number, number][] = [[-6, 1], [6, 1], [-6, 8], [6, 8.5], [-4, 12.5], [4, 12.5]];
  others.forEach(([x, z], i) => {
    table(x, z, 0.65);
    chair(x, z - 1, 1);
    chair(x, z + 1, -1);
    A(`t${i}a`, x, 0, z - 1);
    A(`t${i}b`, x, 0, z + 1);
  });
  // candele accese (alone caldo)
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,140,0.8)'), transparent: true, depthWrite: false });
  for (const [x, z] of candles) {
    const s = new THREE.Sprite(glowMat);
    s.scale.setScalar(0.4);
    s.position.set(x, 0.96, z);
    group.add(s);
  }
  // la pianta (buon nascondiglio per chi ha un cappellino)
  b.bush(-4.3, -1.6, 0.75);
  S.cylinder(-4.3, 0, -1.6, 0.35, 0.5, 10);
  // l'attaccapanni
  S.seg(6.5, 0, -5.6, 6.5, 2.0, -5.6);
  S.seg(6.2, 0, -5.6, 6.8, 0, -5.6).seg(6.5, 0, -5.9, 6.5, 0, -5.3);
  for (const a of [0, 2.1, 4.2]) D.seg(6.5, 1.9, -5.6, 6.5 + Math.cos(a) * 0.3, 1.75, -5.6 + Math.sin(a) * 0.3);
  D.poly([[6.3, 1.85, -5.55], [6.7, 1.85, -5.55], [6.8, 0.9, -5.55], [6.2, 0.9, -5.55]], true);
  col.circle(6.5, -5.6, 0.2);
  // l'acquario (con un pesce disegnato che guarda tutti con aria di giudizio)
  solid(-11.3, 3.8, 0.9, 2.2, 0.8);
  {
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 2.1), new THREE.MeshBasicMaterial({ color: '#5a7fa0', transparent: true, opacity: 0.25, depthWrite: false }));
    tank.position.set(-11.3, 1.3, 3.8);
    group.add(tank);
    D.boxEdges(-11.3, 0.8, 3.8, 0.85, 1.0, 2.1);
    D.poly([[-10.85, 1.3, 3.4], [-10.85, 1.45, 3.7], [-10.85, 1.3, 4.0], [-10.85, 1.15, 3.7]], true);
    D.seg(-10.85, 1.3, 4.0, -10.85, 1.42, 4.2).seg(-10.85, 1.3, 4.0, -10.85, 1.18, 4.2);
  }
  // il lampadario (ci si può appendere: c'è chi lo farà)
  {
    const lx = -2.8, lz = -3.4;
    D.seg(lx, H, lz, lx, 3.5, lz);
    D.circle(lx, 3.5, lz, 0.6, 'y', 16);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      D.seg(lx + Math.cos(a) * 0.6, 3.5, lz + Math.sin(a) * 0.6, lx + Math.cos(a) * 0.6, 3.3, lz + Math.sin(a) * 0.6);
    }
    const s = new THREE.Sprite(glowMat);
    s.scale.setScalar(1.6);
    s.position.set(lx, 3.4, lz);
    group.add(s);
  }
  // quadri dei Pastelli (disegni da bambini, incorniciati)
  scribble(CERA.verde, (s) => {
    s.poly([[11.85, 1.6, -3], [11.85, 1.6, -1], [11.85, 2.8, -1], [11.85, 2.8, -3]], true);
    s.circle(11.85, 2.4, -2.4, 0.2, 'x', 10);
    s.seg(11.85, 1.8, -1.8, 11.85, 2.5, -1.8);
  });
  scribble(CERA.blu, (s) => {
    s.poly([[-11.85, 1.6, 8], [-11.85, 1.6, 10], [-11.85, 2.8, 10], [-11.85, 2.8, 8]], true);
    s.curve([[-11.85, 1.9, 8.3], [-11.85, 2.4, 8.9], [-11.85, 2.0, 9.5], [-11.85, 2.5, 9.8]]);
  });
  sign('RITRATTO DI FAMIGLIA', 11.82, 1.35, -2, 1.6, 0.3, '-x', { font: HAND_FONT });
  // porta della cucina e dei bagni
  D.rectV(8, 0, 15.85, 1.6, 2.4, 'x');
  sign('CUCINA', 8.8, 2.7, 15.83, 1.2, 0.35, '-z', { font: HAND_FONT });
  D.rectV(-11.85, 0, 11.4, 1.4, 2.4, 'z');
  sign('BAGNI\n(per incipriarsi il naso)', -11.82, 2.8, 12.1, 1.6, 0.5, '+x', { font: HAND_FONT });
  A('kitchen', 8.8, 0, 15.2);
  A('toilet', -11.1, 0, 12.1);
  A('violinist', 3, 0, 10.5);

  // =========================================================================
  // PUNTI
  // =========================================================================
  A('spawn', 0, 0, -31);
  A('spawnLook', 0, 1.8, -8);
  A('marcoStart', -2.2, 0, -29);
  A('coinA', -8.9, 0, -34.8);
  A('coinB', 9.1, 0, -10.2);

  return b.finish({ isIndoor: ZONES.inside, fog: [18, 60] });
}

// punto dove guarda chi entra (per lo stacco al tavolo)
export const MARTINA_LOOK = new THREE.Vector3(0, 1.3, 5.05);
