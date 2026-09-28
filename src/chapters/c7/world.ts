import * as THREE from 'three';
import { Sketch, makeHatchMaterial } from '../../render/sketch';
import { HAND_FONT, MARKER_FONT } from '../../render/textures';
import { WorldBuilder, type World } from '../../world/builder';
import type { Rect } from '../../world/collision';

// ---------------------------------------------------------------------------
// Capitolo 7: il trasloco. San Scarabocchio, Via delle Matite, su un quaderno a righe.
//
//   la via            z -6..2 (strada), marciapiede z 2..5
//   la palazzina      x -13..9, z 5..21 (due piani, tetto a 6,2 m)
//     scala a U       x -13..-5, z 5..15: atrio (x -13..-9, z 5..7, a terra), rampa A (x -13..-9,
//                     z 7..12, sale verso +z), pianerottolo (z 12..15, a 1,5 m), rampa B (x -9..-5,
//                     z 7..12, sale verso -z), ballatoio (x -9..-5, z 5..7, a 3 m)
//     appartamento    x -5..9, z 5..21, a 3 m: corridoio (z 5..7,6), soggiorno (x -5..3,5),
//                     camera (x 3,5..9). Porta di casa a x = -5, z = 6,1 (larga 1,6).
//   il furgone        x 10..17, z -3,2..-0,8, porte dietro (verso -x)
//   il vicolo storto  x -35..-15: cancellato stanotte
// ---------------------------------------------------------------------------

export const FLOOR1 = 3;
export const LANDING = 1.5;
export const CEIL = 5.8;

// Altezza del pavimento in un punto (scale comprese)
export function floorAt(x: number, z: number) {
  if (x > -5 && x < 9 && z > 5 && z < 21) return FLOOR1;
  if (x > -9 && x <= -5 && z > 5 && z < 7) return FLOOR1;
  if (x > -9 && x < -5 && z >= 7 && z < 12) return LANDING + (LANDING * (12 - z)) / 5;
  if (x > -13 && x < -5 && z >= 12 && z < 15) return LANDING;
  if (x > -13 && x <= -9 && z >= 7 && z < 12) return (LANDING * (z - 7)) / 5;
  return 0;
}

export const inside = (p: THREE.Vector3) => p.x > -13 && p.x < 9 && p.z > 5 && p.z < 21;

// Dove stanno i mobili da portare giù (centro, rotazione)
// (rot = verso dove guardi quando lo sollevi: 0 = verso la porta, cioè -z)
export const FURNITURE_AT: Record<string, { x: number; z: number; rot: number }> = {
  poltrona: { x: -3, z: 17, rot: 0 },
  scala: { x: 2.6, z: 13.5, rot: 0 },
  armadio: { x: 6, z: 15.5, rot: 0 },
  divano: { x: -0.9, z: 19.4, rot: -Math.PI / 2 },
};

export const VAN = { x0: 10, x1: 17, z0: -3.2, z1: -0.8, rear: new THREE.Vector3(9.2, 0, -2) };

export const REFS7 = {
  van: null as THREE.Group | null,
  vanCol: null as Rect | null,
  vanDoors: [] as THREE.Object3D[],
  tacchettoDoor: null as Rect | null,
  lm: null as import('three/examples/jsm/lines/LineMaterial.js').LineMaterial | null,
  fill: null as THREE.Material | null,
};

export function buildTrasloco(): World {
  const b = new WorldBuilder(707);
  const { S, D, G, col, A, sign, wallText } = b;
  const y = 0.02;
  b.ground();
  b.daySky('mountains');
  REFS7.vanDoors = [];
  REFS7.lm = b.lineMat(2.2);
  REFS7.fill = b.fill;

  // muro da y0 a y1 (i muri del primo piano partono da 3 m), con collisione
  const wall = (x0: number, z0: number, x1: number, z1: number, y0 = 0, y1 = CEIL + 0.4, t = 0.25) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = alongX ? Math.abs(x1 - x0) : t, d = alongX ? t : Math.abs(z1 - z0);
    S.box(cx, y0, cz, w, y1 - y0, d);
    return col.box(cx, cz, w, d);
  };
  // muro con una porta (varco largo dw centrato in "at"), architrave sopra
  const wallDoor = (x0: number, z0: number, x1: number, z1: number, at: number, dw: number, y0 = 0, y1 = CEIL + 0.4) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const [a, bb] = alongX ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(z0, z1), Math.max(z0, z1)];
    if (alongX) {
      if (at - dw / 2 > a) wall(a, z0, at - dw / 2, z0, y0, y1);
      if (at + dw / 2 < bb) wall(at + dw / 2, z0, bb, z0, y0, y1);
      S.box(at, y0 + 2.3, z0, dw, y1 - y0 - 2.3, 0.25);
    } else {
      if (at - dw / 2 > a) wall(x0, a, x0, at - dw / 2, y0, y1);
      if (at + dw / 2 < bb) wall(x0, at + dw / 2, x0, bb, y0, y1);
      S.box(x0, y0 + 2.3, at, 0.25, y1 - y0 - 2.3, dw);
    }
  };

  // =========================================================================
  // LA VIA
  // =========================================================================
  G.seg(-15, y, 2, 40, y, 2).seg(-15, y, -6, 40, y, -6);
  G.dashed(-15, y, -2, 40, y, -2, 2, 2);
  D.seg(-15, y, 2.15, 40, y, 2.15).seg(-15, y, -6.15, 40, y, -6.15);
  sign('VIA DELLE MATITE', 11, 2.6, 4.7, 2.6, 0.6, '-z', { font: MARKER_FONT });
  S.seg(11, 0, 4.8, 11, 2.3, 4.8);
  // case accanto (a est) e di fronte (a sud)
  b.building({ x0: 10, x1: 20, z0: 5, z1: 14, h: 7, face: '-z', roof: 'gable', door: 13 });
  b.building({ x0: 21, x1: 32, z0: 5, z1: 13, h: 6, face: '-z', roof: 'flat', door: 26, sign: 'Ferramenta "Il Chiodo"', shopWindow: true });
  b.building({ x0: -8, x1: 4, z0: -20, z1: -9, h: 6.5, face: '+z', roof: 'gable', door: -2, sign: 'Panificio', shopWindow: true });
  b.building({ x0: 6, x1: 18, z0: -21, z1: -9, h: 8, face: '+z', roof: 'flat', door: 12 });
  b.building({ x0: 20, x1: 31, z0: -19, z1: -9, h: 6, face: '+z', roof: 'gable', door: 25 });
  for (const x of [-2, 8, 24]) b.lamp(x, -7, 1);
  b.tree(34, 3.5, 1.1);
  b.tree(35, -7.5, 1.2);
  // fine della via (a est)
  col.rect(36, -22, 40, 22);
  col.rect(-40, -22, 40, -21);
  col.rect(-40, 21.5, 40, 22.5);

  // =========================================================================
  // LA PALAZZINA DI NONNA PINA
  // =========================================================================
  // muri esterni: facciata con il portone (x -11) e la porta del signor Tacchetto (x 3)
  wallDoor(-13, 5, 9, 5, -11, 1.8);
  REFS7.tacchettoDoor = col.box(3, 5, 1.2, 0.3); // la porta di Tacchetto è chiusa
  S.box(3, 0, 4.8, 1.2, 2.3, 0.1);
  D.circle(3.35, 1.1, 4.72, 0.05, 'z', 8);
  wall(-13, 21, 9, 21);
  wall(-13, 5, -13, 21);
  wall(9, 5, 9, 21);
  S.roof(-2, CEIL + 0.4, 13, 22.4, 16.4, 3, 'x');
  // soffitto: tratteggio leggero (visto da sotto sarebbe tutto in ombra)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), makeHatchMaterial({ density: 6, strength: 0.22 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-2, CEIL, 13);
  b.group.add(ceil);
  // finestre in facciata (due piani)
  for (const fy of [1.0, 3.9]) {
    for (const x of [-3.5, -0.5, 5.5, 7.5, -7]) {
      if (fy < 2 && x > 2 && x < 4.5) continue;
      D.window(x - 0.6, fy, 4.86, 1.2, 1.4, 'x');
    }
  }
  sign('Palazzina "La Gomma Pane"\nint. 1: Pina · int. 2: Tacchetto', -11, 2.8, 4.8, 2.4, 0.7, '-z', { font: HAND_FONT });
  sign('SILENZIO\n(firmato: Tacchetto)', 3, 2.75, 4.7, 1.5, 0.55, '-z', { font: HAND_FONT });

  // --- scala a U (larga: i mobili devono passare) ---
  // muro pieno tra l'atrio e il ballatoio, ringhiera tra le due rampe (bassa: i mobili ci passano sopra)
  wall(-9, 5, -9, 7);
  const rail = col.box(-9, 9.4, 0.18, 4.8);
  rail.low = true;
  for (let z = 7.2; z < 11.8; z += 0.5) D.seg(-9, (LANDING * (z - 7)) / 5, z, -9, (LANDING * (z - 7)) / 5 + 1.0, z, { over: 0 });
  S.seg(-9, 1.0, 7, -9, LANDING + 1.0, 11.8);
  // rampa A (sale verso +z), rampa B (sale verso -z), il pianerottolo
  for (let i = 0; i < 10; i++) {
    S.box(-11, 0, 7.25 + i * 0.5, 4, (i + 1) * 0.15, 0.5, i % 2 === 0);
    S.box(-7, 0, 11.75 - i * 0.5, 4, LANDING + (i + 1) * 0.15, 0.5, i % 2 === 0);
  }
  S.box(-9, 0, 13.5, 8, LANDING, 3);
  wall(-13, 15, -5, 15);
  // ballatoio e pavimento dell'appartamento (a 3 m)
  S.box(-7, FLOOR1 - 0.15, 6, 4, 0.15, 2, false);
  S.box(2, FLOOR1 - 0.15, 13, 14, 0.15, 16, false);
  // porta di casa di Nonna Pina: muro x = -5 (ballatoio | appartamento), la porta è al primo piano
  wall(-5, 5, -5, 5.3);
  wall(-5, 6.9, -5, 21);
  S.box(-5, 0, 6.1, 0.25, FLOOR1, 1.6); // sotto la porta: muro pieno
  S.box(-5, FLOOR1 + 2.3, 6.1, 0.25, CEIL + 0.4 - FLOOR1 - 2.3, 1.6);
  sign('PINA\n(e Pallino)', -5.15, FLOOR1 + 2.55, 7.6, 0.9, 0.45, '-x', { font: HAND_FONT });

  // --- appartamento (primo piano) ---
  // corridoio (z 5..7,6): muro con le porte del soggiorno (x -1) e della camera (x 6)
  {
    const zc = 7.6;
    wall(-5, zc, -1.8, zc, FLOOR1);
    wall(-0.2, zc, 5.2, zc, FLOOR1);
    wall(6.8, zc, 9, zc, FLOOR1);
    S.box(-1, FLOOR1 + 2.3, zc, 1.6, CEIL - FLOOR1 - 2.3, 0.25);
    S.box(6, FLOOR1 + 2.3, zc, 1.6, CEIL - FLOOR1 - 2.3, 0.25);
  }
  // muro tra soggiorno e camera
  wall(3.5, 7.6, 3.5, 21, FLOOR1);
  // finestre interne (si vedono da dentro)
  for (const z of [11, 16]) {
    D.window(-4.87, FLOOR1 + 0.9, z, 1.2, 1.4, 'z');
    D.window(8.87, FLOOR1 + 0.9, z, 1.2, 1.4, 'z');
  }
  // arredi che restano (non si portano): tavolo, letto, credenza, tappeto
  const fixed = (x: number, z: number, w: number, d: number, h: number, low = true) => {
    S.box(x, FLOOR1, z, w, h, d);
    const r = col.box(x, z, w, d);
    r.low = low;
    return r;
  };
  fixed(0, 14, 1.8, 1.1, 0.75);
  D.circle(0, FLOOR1 + 0.76, 14, 0.25, 'y', 12);
  fixed(6.2, 19.8, 2.2, 1.9, 0.5);
  S.box(6.2, FLOOR1 + 0.5, 20.8, 2.2, 0.6, 0.12);
  fixed(-4.4, 11, 0.9, 2.4, 1.1, false);
  G.poly([[-3, FLOOR1 + y, 12], [2.5, FLOOR1 + y, 12], [2.5, FLOOR1 + y, 18], [-3, FLOOR1 + y, 18]], true);
  wallText('i quadri di Pina: tutti a matita', 0.5, FLOOR1 + 2.1, 20.84, 3, 0.5, '-z');
  for (const x of [-3, 1.2]) D.rectV(x, FLOOR1 + 1.5, 20.85, 1.2, 0.9, 'x');

  // =========================================================================
  // IL FURGONE DEI FRATELLI SQUADRA
  // =========================================================================
  {
    // il furgone è un gruppo a sé: alla fine parte (con Nonna Pina dentro)
    const { x0, x1, z0, z1 } = VAN;
    const van = new THREE.Group();
    const vs = new Sketch();
    vs.style = { jitter: 0.02, over: 0.08 };
    const vd = new Sketch();
    vd.style = { jitter: 0.012, over: 0.04 };
    const cz = (z0 + z1) / 2, w = z1 - z0;
    vs.box((x0 + 13.6) / 2, 0.45, cz, 13.6 - x0, 2.4, w);
    vs.box((13.6 + x1) / 2, 0.45, cz, x1 - 13.6, 1.6, w - 0.1);
    for (const x of [11.2, 15.8]) for (const z of [z0 - 0.02, z1 + 0.02]) vs.circle(x, 0.42, z, 0.42, 'z', 16, 0.04);
    vd.poly([[14.2, 1.3, z1 + 0.03], [16.6, 1.3, z1 + 0.03], [16.6, 1.9, z1 + 0.03], [14.4, 2.0, z1 + 0.03]], true);
    van.add(vs.build(b.lineMat(2.4), b.fill), vd.build(b.lineMat(1.5), b.fill));
    const t1 = wallText('TRASLOCHI\nF.LLI SQUADRA', 11.8, 1.8, z1 + 0.05, 3, 1.1, '+z');
    const t2 = wallText('noi misuriamo, voi caricate', 11.8, 0.95, z1 + 0.05, 3, 0.35, '+z');
    van.attach(t1);
    van.attach(t2);
    REFS7.vanCol = col.rect(x0, z0, x1, z1);
    // portelloni dietro, aperti
    for (const side of [-1, 1]) {
      const door = new THREE.Group();
      const hz = side < 0 ? z0 : z1;
      door.position.set(x0, 0.45, hz);
      const ds = new Sketch();
      ds.box(0, 0, side * -0.6, 0.06, 2.4, 1.2);
      door.add(ds.build(b.lineMat(2.2), b.fill));
      door.rotation.y = side * 1.9;
      van.add(door);
      REFS7.vanDoors.push(door);
    }
    b.group.add(van);
    REFS7.van = van;
    G.poly([[x0 - 3, y, z0 - 0.6], [x0, y, z0 - 0.6], [x0, y, z1 + 0.6], [x0 - 3, y, z1 + 0.6]], true);
  }

  // =========================================================================
  // IL VICOLO STORTO (cancellato stanotte)
  // =========================================================================
  {
    // foglio più bianco del foglio: niente righe, niente niente
    const blank = new THREE.Mesh(new THREE.PlaneGeometry(20, 42), new THREE.MeshBasicMaterial({ color: '#fffefa' }));
    blank.rotation.x = -Math.PI / 2;
    blank.position.set(-25, 0.015, 0);
    b.group.add(blank);
    // bordo "strofinato" della cancellatura
    for (let z = -21; z < 21; z += 0.6) {
      const x = -15 + Math.sin(z * 1.7) * 0.3 + b.rr(-0.2, 0.2);
      G.seg(x, y, z, -15 + Math.sin((z + 0.6) * 1.7) * 0.3, y, z + 0.6, { over: 0 });
    }
    // restano: una porta (con lo stipite) e mezzo cartello
    S.box(-23, 0, 9, 1.4, 2.4, 0.18, false);
    S.seg(-23.7, 0, 9, -23.7, 2.4, 9).seg(-22.3, 0, 9, -22.3, 2.4, 9).seg(-23.7, 2.4, 9, -22.3, 2.4, 9);
    D.circle(-22.6, 1.1, 8.9, 0.05, 'z', 8);
    col.box(-23, 9, 1.4, 0.3);
    S.seg(-18, 0, 1, -18, 2.4, 1);
    sign('VICOLO ST', -18.4, 2.5, 1, 1.0, 0.45, '+x', { font: MARKER_FONT });
    // briciole di gomma
    const cr = new Sketch();
    cr.style = { jitter: 0.01, over: 0 };
    const rng = b.r;
    for (let i = 0; i < 70; i++) {
      const px = -16 - rng() * 17, pz = -18 + rng() * 36;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < 7; k++) pts.push([px + Math.cos(k * 1.1) * 0.035 * (1 + k * 0.3), y + 0.01, pz + Math.sin(k * 1.1) * 0.035 * (1 + k * 0.3)]);
      cr.curve(pts);
    }
    b.group.add(cr.build(b.lineMat(1.3, '#8b8794'), b.fill));
    // il confine: più in là non si va (non c'è niente)
    col.rect(-40, -22, -34, 22);
    A('vicoloPorta', -23, 1.2, 9.4);
    A('vicoloCartello', -18, 1.2, 1);
    // il mucchietto di briciole rosa (quelle da esaminare): si vede da lontano sul bianco
    const bx = -20.5, bz = 4.2;
    const heap = new Sketch();
    heap.style = { jitter: 0.01, over: 0 };
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * 0.75;
      const px = bx + Math.cos(a) * rad, pz = bz + Math.sin(a) * rad;
      const s = 0.05 + rng() * 0.05;
      const pts: [number, number, number][] = [];
      for (let k = 0; k < 8; k++) pts.push([px + Math.cos(k * 1.1) * s * (1 + k * 0.25), y + 0.02 + rng() * 0.03, pz + Math.sin(k * 1.1) * s * (1 + k * 0.25)]);
      heap.curve(pts);
    }
    b.group.add(heap.build(b.lineMat(2.2, '#e8839f'), b.fill));
    const smudge = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: '#f6c9d6', transparent: true, opacity: 0.55, depthWrite: false }));
    smudge.rotation.x = -Math.PI / 2;
    smudge.position.set(bx, 0.025, bz);
    b.group.add(smudge);
    A('vicoloBriciole', bx, 0.35, bz);
  }

  // =========================================================================
  // PUNTI NOTEVOLI
  // =========================================================================
  A('spawn', 7, 0, 2.2);
  A('spawnLook', -2, 2.6, 8);
  A('pina', -6, 0, 3.4);
  A('marco', 8.5, 0, 0.5);
  A('squadra', 10.4, 0, 1.2);
  A('goniometro', 12.6, 0, 1.6);
  A('tacchetto', 3, 0, 3.8);
  A('filosofo', -14.2, 0, 3.4);
  A('superstite', -23.5, 0, 10.2);
  A('album', 6, FLOOR1 + 0.3, 15.5);
  A('portone', -11, 1.2, 4.6);

  return b.finish({ isIndoor: inside, fog: [40, 120] });
}
