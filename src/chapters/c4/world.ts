import * as THREE from 'three';
import { Sketch } from '../../render/sketch';
import { HAND_FONT, silhouetteTexture, targetTexture, textTexture } from '../../render/textures';
import { CERA, HL, THEME } from '../../render/palette';
import { WorldBuilder, type Facing, type World } from '../../world/builder';
import type { Circle, Rect } from '../../world/collision';

// ---------------------------------------------------------------------------
// Il Mercato Nero, sotto la stazione di Quadropoli. Tutto è incartato in carta da pacchi.
//
// Pianta (si arriva da sud, dalle scale della metro):
//   corridoio d'ingresso   x -3..3,   z -53..-36  (buttafuori al cancello, z = -36)
//   armeria Calamaio       x -22..-3, z -53..-40  (poligono: si spara verso ovest)
//   il mercato             x -26..26, z -36..24   (bancarelle ai lati, colonne, casse)
//   l'asta                 palco x -8..8, z 14..22
//   tunnel della metro     ovest x -40..-26 e est x 26..40, z -2..4 (chiusi: lavori in corso)
// ---------------------------------------------------------------------------

export const HALL_H = 6.5;

export const ZONES = {
  hall: (p: THREE.Vector3) => p.x > -26 && p.x < 26 && p.z > -36 && p.z < 24,
  range: (p: THREE.Vector3) => p.x > -22 && p.x < -3 && p.z > -53 && p.z < -40,
};

// Cose che la storia deve poter cambiare (cancello, barriere dei tunnel, barili)
export interface Barrel {
  x: number;
  z: number;
  circle: Circle;
  mesh: THREE.Object3D;
  alive: boolean;
}
export const REFS: {
  gate: Rect | null;
  tunnelW: Rect | null;
  tunnelE: Rect | null;
  barrels: Barrel[];
  targets: { pivot: THREE.Group; x: number; z: number; kind: 'bad' | 'nonna' }[];
} = { gate: null, tunnelW: null, tunnelE: null, barrels: [], targets: [] };

// Coperture dei Pastelli: dietro le casse, dal lato dei tunnel
export const COVERS = {
  west: [[-14.4, 8], [-16.4, -2], [-13.4, -14], [-15.4, 16]] as [number, number][],
  east: [[14.4, 8], [16.4, -2], [13.4, -14], [15.4, 16]] as [number, number][],
};

export function buildMercato(): World {
  const b = new WorldBuilder(404);
  const { S, D, G, col, group, A, sign, wall, wallDoor, solid, rr } = b;
  const y = 0.02;
  b.ground();
  REFS.barrels = [];
  REFS.targets = [];

  // =========================================================================
  // CORRIDOIO D'INGRESSO (dalle scale della metro)
  // =========================================================================
  b.ceiling(-3, -53, 3, -36, 4.5);
  wallDoor(-3, -53, -3, -36, -45, 2.4, 4.5);
  wall(3, -53, 3, -36, 4.5);
  wall(-3, -53.2, 3, -53.2, 4.5);
  // le scale salgono verso la stazione (non si torna indietro: il tappo è davanti)
  for (let i = 0; i < 11; i++) S.box(0, 0, -49.8 - i * 0.3, 5.9, 0.25 + i * 0.25, 0.3);
  col.rect(-3, -53.2, 3, -49.6);
  sign('USCITA\n(ma non è ancora il momento)', 0, 3.4, -49.7, 2.6, 0.6, '+z', { font: HAND_FONT });
  // piastrelle della metro sulle pareti
  for (const x of [-2.86, 2.86]) {
    for (let yy = 0.6; yy < 4.4; yy += 0.6) D.seg(x, yy, -49.5, x, yy, -36.2, { over: 0 });
  }
  sign('ARMERIA CALAMAIO\narmi a inchiostro · tiro a segno', -2.85, 3.35, -45, 2.4, 0.7, '+x');
  // cancello col metal detector (al contrario)
  wallDoor(-3, -36, 3, -36, 0, 1.8, HALL_H, 2.6);
  S.box(-1.05, 0, -36.3, 0.18, 2.7, 0.3).box(1.05, 0, -36.3, 0.18, 2.7, 0.3).box(0, 2.6, -36.3, 2.3, 0.2, 0.3);
  for (let i = 0; i < 5; i++) D.seg(-1.05, 0.4 + i * 0.45, -36.46, -0.96, 0.4 + i * 0.45, -36.46, { over: 0 });
  sign('METAL DETECTOR\nvietato entrare disarmati', 0, 3.3, -36.2, 2.4, 0.55, '-z');
  REFS.gate = col.rect(-0.9, -36.35, 0.9, -35.65);
  A('gate', 0, 1.2, -36.6);
  A('tornello', 1.7, 0, -37.4);
  A('marcoStart', -1.5, 0, -38.8);
  A('spawn', 0.6, 0, -49.1);
  A('spawnLook', 0, 1.6, -30);

  // =========================================================================
  // ARMERIA CALAMAIO: il poligono (si spara verso ovest)
  // =========================================================================
  b.ceiling(-22, -53.2, -3, -40, 4.5);
  wall(-22, -53.2, -3, -53.2, 4.5);
  wall(-22, -40, -3, -40, 4.5);
  wall(-22, -53.2, -22, -40, 4.5);
  // bancone della linea di tiro (basso: ci si spara sopra)
  solid(-7.2, -46.6, 0.6, 12.6, 1.05);
  G.seg(-6.4, y, -52.8, -6.4, y, -40.4);
  G.poly([[-6.4, y, -52.8], [-6.0, y, -52.8], [-6.0, y, -40.4], [-6.4, y, -40.4]], true, { over: 0 });
  b.groundText('LINEA DI TIRO', -5.4, -44.2, 2.6, 0.5, Math.PI / 2);
  // corsie
  for (const z of [-50.2, -47.2, -44.2]) G.dashed(-7.6, y, z, -21.6, y, z, 1, 0.8);
  // parete di fondo con i pacchi di carta per fermare i colpi
  for (let z = -52.6; z < -40.4; z += 1.3) {
    const h = rr(1.2, 2.4);
    S.box(-21.3, 0, z + 0.65, 1.2, h, 1.2);
  }
  sign('NON SPARATE ALLA NONNA\n(è di cartone, ma ci resta male)', -21.85, 3.3, -46.6, 3.6, 0.8, '+x', { font: HAND_FONT });
  sign('RECORD DEL POLIGONO: 14 secondi\ndetenuto da: la nonna', -12, 3.2, -40.15, 3.8, 0.7, '-z', { font: HAND_FONT });
  // rastrelliera delle pistole dietro al Calamaio
  S.box(-4.6, 1.0, -52.9, 2.4, 1.6, 0.25);
  for (let i = 0; i < 4; i++) {
    const x = -5.5 + i * 0.6;
    D.box(x, 1.6, -52.72, 0.1, 0.3, 0.08).box(x + 0.07, 1.85, -52.72, 0.25, 0.08, 0.08);
  }
  sign('Pistole a inchiostro\n"sparano blu, ma non è colpa nostra"', -4.6, 2.9, -52.95, 2.6, 0.55, '+z', { font: HAND_FONT });
  A('calamaio', -4.4, 0, -51.4);
  A('rangeStart', -5, 1.1, -46.6);
  A('rangeLook', -18, 1.2, -46.6);
  // sagome (si alzano e si abbassano)
  const tMats = { bad: new THREE.MeshBasicMaterial({ map: targetTexture('bad'), transparent: true, alphaTest: 0.4 }), nonna: new THREE.MeshBasicMaterial({ map: targetTexture('nonna'), transparent: true, alphaTest: 0.4 }) };
  const tGeo = new THREE.PlaneGeometry(1, 2).translate(0, 1, 0).rotateY(Math.PI / 2);
  const tSpots: [number, number, 'bad' | 'nonna'][] = [
    [-11, -51.2, 'bad'], [-13.5, -48.6, 'bad'], [-16, -45.7, 'nonna'], [-12, -42.6, 'bad'],
    [-18.5, -49.4, 'bad'], [-15, -41.8, 'bad'], [-19.5, -44.4, 'bad'], [-10.5, -47.4, 'nonna'],
  ];
  for (const [x, z, kind] of tSpots) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, z);
    const m = new THREE.Mesh(tGeo, tMats[kind]);
    pivot.add(m);
    pivot.rotation.z = Math.PI / 2; // giù
    group.add(pivot);
    D.seg(x - 0.1, 0.05, z - 0.4, x - 0.1, 0.05, z + 0.4); // cerniera per terra
    REFS.targets.push({ pivot, x, z, kind });
  }

  // =========================================================================
  // IL MERCATO
  // =========================================================================
  b.ceiling(-26, -36, 26, 24, HALL_H);
  wall(-26, -36, -3, -36, HALL_H);
  wall(3, -36, 26, -36, HALL_H);
  wall(-26, 24, 26, 24, HALL_H);
  for (const x of [-26, 26]) {
    wall(x, -36, x, -2, HALL_H);
    wall(x, 4, x, 24, HALL_H);
    S.box(x, 4, 1, 0.25, HALL_H - 4, 6);
  }
  // pavimento a piastrelle grandi
  for (let x = -24; x <= 24; x += 4) G.seg(x, y, -35.8, x, y, 13.8, { over: 0, jitter: 0.03 });
  for (let z = -32; z <= 12; z += 4) G.seg(-25.8, y, z, 25.8, y, z, { over: 0, jitter: 0.03 });
  // colonne (coperture vere: da dietro non ti vede nessuno)
  for (const x of [-9, 9]) {
    for (const z of [-26, -12, 2]) {
      solid(x, z, 1.1, 1.1, HALL_H);
      D.box(x, HALL_H - 0.5, z, 1.5, 0.5, 1.5).box(x, 0, z, 1.5, 0.4, 1.5);
    }
  }
  // lampadine appese
  for (const x of [-4.5, 4.5]) {
    for (const z of [-30, -20, -10, 0, 10]) {
      D.seg(x, HALL_H, z, x, 5.1, z, { over: 0 });
      D.circle(x, 4.95, z, 0.16, 'z', 10);
      D.circle(x, 4.95, z, 0.16, 'x', 10);
    }
  }
  // regolamento accanto al cancello
  sign(
    'REGOLAMENTO DEL MERCATO NERO\n1. Non si ruba (senza permesso)\n2. Tutto è originale, tranne il falso\n3. Vietato sparare. Salvo emergenze e antipatie\n4. I reclami si fanno all\'uscita. L\'uscita è l\'entrata',
    -6.5, 2.3, -35.84, 4.6, 2.1, '+z', { font: HAND_FONT },
  );
  A('rules', -6.5, 1.4, -35.2);
  sign('MERCATO NERO\nsi vende tutto, si garantisce niente', 6.5, 3.6, -35.84, 5, 1.1, '+z');

  // --- bancarelle ---
  const stall = (x: number, z: number, facing: '+x' | '-x', title: string, id: string) => {
    const s = facing === '+x' ? 1 : -1;
    solid(x, z, 1.0, 4, 1.05);
    const bx = x - s * 2.1, fx = x + s * 0.5;
    for (const px of [bx, fx]) for (const pz of [z - 2.05, z + 2.05]) S.seg(px, 0, pz, px, 2.75, pz, { over: 0.03 });
    S.roof((bx + fx) / 2, 2.75, z, 3.0, 4.4, 0.55, 'z', 0.25);
    // frangia della tenda
    for (let i = 0; i < 9; i++) {
      const z0 = z - 2.2 + i * 0.49;
      D.curve([[fx + s * 0.35, 2.75, z0], [fx + s * 0.35, 2.58, z0 + 0.245], [fx + s * 0.35, 2.75, z0 + 0.49]]);
    }
    sign(title, x + s * 0.53, 2.3, z, 3.2, 0.62, facing, { font: HAND_FONT });
    A(id, x - s * 1.25, 0, z);
    A(`${id}C`, x + s * 1.6, 0, z);
    return s;
  };
  const card = (text: string, x: number, h: number, z: number, facing: Facing, w = 0.55) => sign(text, x, 1.05 + h / 2 + 0.02, z, w, h, facing, { font: HAND_FONT });

  // OMBRE & RIFLESSI: ombre stese ad asciugare
  stall(-20, -28, '+x', 'OMBRE & RIFLESSI\nombre usate · riflessi seminuovi', 'riflesso');
  {
    const mat = new THREE.MeshBasicMaterial({ map: silhouetteTexture(THEME.inkHex), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    S.seg(-22.6, 2.2, -30, -22.6, 2.2, -26, { over: 0 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), mat);
      m.position.set(-22.55, 1.62, -29.5 + i * 1.0);
      m.rotation.y = Math.PI / 2;
      m.rotation.z = rr(-0.08, 0.08);
      group.add(m);
      D.seg(-22.6, 2.2, -29.5 + i, -22.6, 2.15, -29.5 + i, { over: 0 });
    }
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.8), mat);
    flat.rotation.set(-Math.PI / 2, 0, 0.3);
    flat.position.set(-20, 1.08, -27.4);
    group.add(flat);
    b.props.ombraSale = flat;
    card('Un\'ombra usata\n12 monete', -19.47, 0.32, -28.9, '+x');
  }
  // PAROLE USATE: cartellini con le parole
  stall(-20, -18, '+x', 'PAROLE USATE\ndi seconda mano, come nuove', 'vocabolo');
  card('"comunque"\n1 moneta', -19.47, 0.3, -19.4, '+x');
  card('"ti amo"\nprezzo da trattare', -19.47, 0.3, -18.2, '+x', 0.6);
  card('"scusa"\nquasi nuova · 3 m.', -19.47, 0.3, -17, '+x', 0.6);
  // COLORI VERI: barattoli grigi con etichette colorate
  stall(-20, -8, '+x', 'COLORI VERI\ngarantiti (in bianco e nero)', 'tarocco');
  for (let i = 0; i < 5; i++) {
    const z = -9.4 + i * 0.7;
    D.cylinder(-20, 1.05, z, 0.16, 0.34, 10);
    card(['ROSSO', 'VERDE', 'GIALLO', 'BLU', 'ROSA'][i], -19.82, 0.12, z, '+x', 0.3);
  }
  sign('ROSSO FERRARI\n(quasi)', -22.3, 1.8, -8, 1.2, 0.5, '+x', { font: HAND_FONT });
  // PROFUMERIA BOCCETTA
  stall(20, -28, '-x', 'PROFUMERIA BOCCETTA\neau de temperino', 'boccetta');
  for (let i = 0; i < 6; i++) {
    const z = -29.3 + i * 0.5;
    D.cylinder(20, 1.05, z, 0.1, 0.22 + (i % 3) * 0.06, 8);
    D.box(20, 1.3 + (i % 3) * 0.06, z, 0.07, 0.08, 0.07);
  }
  card('"Quaderno Nuovo"\n15 monete', 19.47, 0.32, -26.8, '-x', 0.6);
  // BOSSOLO: cartucce e merendine
  stall(20, -18, '-x', 'BOSSOLO\ncartucce & merendine', 'bossolo');
  for (let i = 0; i < 4; i++) D.box(20, 1.05, -19.4 + i * 0.5, 0.35, 0.25, 0.35);
  card('Cartucce ×8\n3 monete', 19.47, 0.3, -17.6, '-x');
  card('Merendina\n4 monete', 19.47, 0.3, -16.8, '-x');
  S.box(20.9, 0, -15.2, 1.0, 0.8, 0.8);
  sign('INK', 20.9, 0.45, -15.62, 0.5, 0.25, '-x');
  A('ammoCrate', 19.6, 0.8, -15.2);
  // OGGETTI SMARRITI (chiuso)
  stall(20, -8, '-x', 'OGGETTI SMARRITI\nritrovati da noi prima di voi', 'smarriti');
  card('CHIUSO\nper rapina (la nostra)', 19.47, 0.4, -8, '-x', 0.8);
  for (let i = 0; i < 3; i++) D.circle(20, 1.1, -9.3 + i * 0.35, 0.1, 'x', 8);

  // --- telefono pubblico ---
  S.box(-23.6, 0, -32.6, 1.4, 2.5, 1.4);
  D.rectV(-22.87, 0.1, -33.2, 1.2, 2.2, 'z');
  D.box(-23.9, 1.3, -32.6, 0.15, 0.4, 0.3);
  sign('TELEFONO\na gettoni immaginari', -22.86, 2.75, -32.6, 1.5, 0.45, '+x');
  col.box(-23.6, -32.6, 1.4, 1.4);
  A('phone', -22.4, 1.3, -32.6);

  // --- casse (coperture basse) ---
  const crate = (x: number, z: number, w = 1.4, d = 1.0, h = 1.25) => {
    solid(x, z, w, d, h);
    D.seg(x - w / 2, h * 0.5, z - d / 2 - 0.01, x + w / 2, h * 0.5, z - d / 2 - 0.01, { over: 0 });
    D.seg(x - w / 2, h * 0.5, z + d / 2 + 0.01, x + w / 2, h * 0.5, z + d / 2 + 0.01, { over: 0 });
    D.seg(x - w / 2 + 0.05, 0.05, z - d / 2 - 0.01, x + w / 2 - 0.05, h - 0.05, z - d / 2 - 0.01, { over: 0 });
  };
  // coperture dei Pastelli (lato tunnel)
  for (const s of [-1, 1]) {
    crate(s * 13, 8, 1.0, 1.6);
    crate(s * 15, -2, 1.0, 1.6);
    crate(s * 12, -14, 1.0, 1.6);
    crate(s * 14, 16, 1.0, 1.6);
  }
  // coperture per te (al centro): lunghe verso i tunnel, da dove arrivano i colpi
  crate(-6.6, 10, 1.0, 1.8);
  crate(6.6, 10, 1.0, 1.8);
  crate(-4, 3, 1.0, 1.8);
  crate(4, 3, 1.0, 1.8);
  crate(0, -7, 1.8, 1.0);
  crate(-4.5, -19, 1.2, 1.2);
  crate(4.5, -19, 1.2, 1.2);
  crate(0, -27, 1.8, 1.0);
  sign('FRAGILE\n(come tutti)', 0, 0.62, -7.52, 1.0, 0.4, '-z', { font: HAND_FONT });

  // --- barili d'inchiostro: sparaci e fanno SPLASH ---
  for (const [x, z] of [[-14.4, 9.7], [-16.4, -0.2], [14.4, 9.7], [16.4, -0.2]] as const) {
    const bs = new Sketch();
    bs.style = { jitter: 0.012, over: 0.04 };
    bs.cylinder(x, 0, z, 0.42, 1.1, 14);
    bs.circle(x, 0.35, z, 0.43, 'y', 16).circle(x, 0.75, z, 0.43, 'y', 16);
    const mesh = bs.build(b.lineMat(1.8), b.fill);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), new THREE.MeshBasicMaterial({ color: '#2f4bd8' }));
    label.position.set(x, 0.55, z + (z > 5 ? -0.43 : 0.43));
    if (z > 5) label.rotation.y = Math.PI;
    mesh.add(label);
    group.add(mesh);
    REFS.barrels.push({ x, z, circle: col.circle(x, z, 0.45), mesh, alive: true });
  }

  // =========================================================================
  // L'ASTA (palco a nord)
  // =========================================================================
  solid(0, 18, 16, 8, 0.9);
  for (let x = -7.5; x <= 7.5; x += 1.5) D.seg(x, 0.02, 13.99, x, 0.88, 13.99, { over: 0 });
  // leggio del banditore
  S.box(0, 0.9, 16.2, 0.9, 1.15, 0.6);
  sign('BANDITORE', 0, 1.6, 15.88, 0.8, 0.25, '-z', { font: HAND_FONT });
  A('banditore', 0, 0.9, 16.9);
  // piedistallo del lotto e il tappo
  S.cylinder(3.2, 0.9, 16, 0.32, 1.0, 12);
  D.box(3.2, 1.9, 16, 0.5, 0.1, 0.5);
  {
    const cap = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 16), new THREE.MeshBasicMaterial({ color: HL.yellow }));
    c.position.set(3.2, 2.07, 16);
    cap.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 20), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(3.2, 2.13, 16);
    cap.add(ring);
    group.add(cap);
    b.props.lotto = cap;
  }
  A('lotto', 3.2, 2.1, 16);
  // tubo della posta pneumatica
  S.cylinder(6.6, 0.9, 19.6, 0.35, HALL_H - 0.9, 12);
  D.rectV(6.35, 1.3, 19.24, 0.5, 0.6, 'x');
  sign('POSTA PNEUMATICA\nconsegna in 3 secondi', 6.6, 2.6, 19.2, 1.4, 0.45, '-z', { font: HAND_FONT });
  A('tube', 6.6, 1.7, 18.9);
  A('pneumatica', 5.4, 0.9, 18.4);
  // sipario
  for (let x = -7.8; x <= 7.8; x += 0.5) D.seg(x + rr(-0.05, 0.05), 0.9, 21.7, x, HALL_H - 0.3, 21.8, { over: 0 });
  S.seg(-8, HALL_H - 0.3, 21.8, 8, HALL_H - 0.3, 21.8);
  sign('ASTA DI MEZZANOTTE\n(anche prima, se c\'è gente)', 0, 4.6, 21.6, 5.2, 1.1, '-z');
  // sedie pieghevoli per chi offre (guardano il palco)
  const chair = (x: number, z: number) => {
    S.box(x, 0.42, z, 0.48, 0.05, 0.45);
    for (const dx of [-0.2, 0.2]) {
      S.seg(x + dx, 0, z + 0.2, x + dx, 0.42, z + 0.2, { over: 0.02 });
      S.seg(x + dx, 0, z - 0.2, x + dx, 0.95, z - 0.22, { over: 0.02 });
    }
    D.seg(x - 0.2, 0.9, z - 0.22, x + 0.2, 0.9, z - 0.22).seg(x - 0.2, 0.72, z - 0.22, x + 0.2, 0.72, z - 0.22);
  };
  for (const x of [-5, -2.5, 0, 2.5, 5]) for (const z of [8, 10.5]) chair(x, z);
  A('collezionista', -2.5, 0, 10.5);
  A('pelliccia', 2.5, 0, 10.5);
  A('salutatore', 7.8, 0, 7.4);
  A('auction', 0, 0, 6.5);

  // =========================================================================
  // TUNNEL DELLA METRO (da qui arrivano i Pastelli)
  // =========================================================================
  for (const s of [-1, 1]) {
    const x0 = s * 26, x1 = s * 40;
    wall(x0, -2, x1, -2, 4);
    wall(x0, 4, x1, 4, 4);
    wall(x1, -2, x1, 4, 4);
    b.ceiling(Math.min(x0, x1), -2, Math.max(x0, x1), 4, 4);
    // binari e traversine
    for (const z of [0.3, 1.7]) G.seg(x0, y, z, x1, y, z, { over: 0 });
    for (let x = Math.min(x0, x1) + 0.5; x < Math.max(x0, x1); x += 0.9) G.seg(x, y, -0.2, x, y, 2.2, { over: 0 });
    // archi
    for (let x = Math.min(x0, x1) + 2; x < Math.max(x0, x1); x += 3) D.curve([[x, 0, -1.9], [x, 3.2, -1.9], [x, 3.95, 1], [x, 3.2, 3.9], [x, 0, 3.9]]);
    // in fondo: buio
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
    dark.position.set(s * 39.8, 2, 1);
    dark.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(dark);
    // barriera "lavori in corso"
    const bar = new Sketch();
    bar.style = { jitter: 0.015, over: 0.05 };
    const bx = s * 27.2;
    for (const z of [-1.4, 3.4]) bar.seg(bx, 0, z, bx, 1.2, z);
    bar.box(bx, 0.8, 1, 0.1, 0.35, 5.4);
    for (let z = -1.5; z < 3.6; z += 0.6) bar.seg(bx - 0.06, 0.82, z, bx - 0.06, 1.13, z + 0.4, { over: 0 });
    const barG = bar.build(b.lineMat(2), b.fill);
    const barSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.6),
      new THREE.MeshBasicMaterial({ map: textTexture('LAVORI IN CORSO\ntunnel chiuso per troppo buio', { w: 512, h: 118, border: true, bg: THEME.paperHex, font: HAND_FONT }), side: THREE.DoubleSide }),
    );
    barSign.position.set(bx - s * 0.1, 1.65, 1);
    barSign.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    barG.add(barSign);
    group.add(barG);
    b.props[s < 0 ? 'barrierW' : 'barrierE'] = barG;
    const r = col.rect(bx - 0.3, -2, bx + 0.3, 4);
    if (s < 0) REFS.tunnelW = r;
    else REFS.tunnelE = r;
    A(s < 0 ? 'tunnelW' : 'tunnelE', s * 36, 0, 1);
  }
  // scritte dei Pastelli sul muro accanto al tunnel ovest (un avvertimento, nessuno l'ha letto)
  b.wallText('PASTELLI A CERA\nZONA NOSTRA', -25.85, 3.2, -6, 3.6, 1.5, '+x', CERA.rosso);
  b.wallText('♥ tappi ♥', 25.85, 2.2, 9, 1.8, 0.7, '-x', CERA.viola);
  // (il cuore l'ha disegnato qualcuno con la M... sotto, piccolo: "M.")
  b.wallText('M.', 25.85, 1.7, 9.6, 0.5, 0.4, '-x', CERA.viola);

  // =========================================================================
  // PUNTI
  // =========================================================================
  A('marcoHide', -9.6, 0, 19.2);
  A('checkpointRaid', 0, 0, 0);
  A('checkpointLook', 0, 1.4, 14);
  A('grigia', -16.2, 0, -10.2);
  A('controluce', -15.5, 0, -31);
  A('cliente1', 6, 0, -24);
  A('cliente2', -6, 0, -12);
  A('coinA', -24.5, 0, 22.5);
  A('coinB', 24.4, 0, -34.5);
  A('coinC', -6.2, 0, -40.8);
  A('coinD', 7.5, 0, 22.8);

  return b.finish({ isIndoor: () => true, fog: [16, 58] });
}
