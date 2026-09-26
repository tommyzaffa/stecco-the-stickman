import * as THREE from 'three';
import { Sketch } from '../../render/sketch';
import { HAND_FONT } from '../../render/textures';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Quadropoli, la città a quadretti. Tutto è ad angolo retto, persino le persone.
//
// Pianta:
//   piazza del Quadretto   x -15..15, z -15..15   (monumento all'Angolo Retto)
//   strada ad anello       |x| o |z| tra 15 e 23  (auto spinte a mano)
//   lato nord (z > 25)     Palazzo del Balcone, MONTE DEI TAPPI (banco dei pegni), Cartoleria Colla
//   vicolo sul retro       x -8..16, z 33..40
//   strada sud             x -4..4 (Viale dell'Ordinata) con la metropolitana
//   strada est             z -4..4 (Via dell'Ascissa) fino al bordo del foglio
// ---------------------------------------------------------------------------

export const ZONES = {
  shop: (p: THREE.Vector3) => p.x > -6 && p.x < 6 && p.z > 25 && p.z < 33,
  alley: (p: THREE.Vector3) => p.x > -8 && p.x < 16 && p.z > 33 && p.z < 40,
};

export function buildQuadropoli(): World {
  const b = new WorldBuilder(303);
  const { S, D, G, col, group, A, sign, groundText, tree, lamp, bench, building, wall, wallDoor, solid, rr } = b;
  const y = 0.02;
  b.ground();
  b.daySky('skyline');

  // =========================================================================
  // STRADE
  // =========================================================================
  // anello attorno alla piazza
  for (const s of [15, 23]) G.poly([[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]], true, { over: 0.3 });
  for (const s of [15.2, 22.8]) D.poly([[-s, y, -s], [s, y, -s], [s, y, s], [-s, y, s]], true, { over: 0 });
  G.dashed(-19, y, -19, 19, y, -19, 1.6, 1.6).dashed(19, y, -19, 19, y, 19, 1.6, 1.6);
  G.dashed(19, y, 19, -19, y, 19, 1.6, 1.6).dashed(-19, y, 19, -19, y, -19, 1.6, 1.6);
  // strada sud (Viale dell'Ordinata)
  for (const x of [-4, 4]) G.seg(x, y, -23, x, y, -58);
  G.dashed(0, y, -23, 0, y, -58, 1.6, 1.6);
  for (const x of [-6, 6]) D.seg(x, y, -25, x, y, -58);
  // strada est (Via dell'Ascissa)
  for (const z of [-4, 4]) G.seg(23, y, z, 58, y, z);
  G.dashed(23, y, 0, 58, y, 0, 1.6, 1.6);
  for (const z of [-6, 6]) D.seg(25, y, z, 58, y, z);
  // strisce pedonali verso la piazza
  for (let x = -3; x <= 2.6; x += 1) D.poly([[x, y, -22.5], [x + 0.5, y, -22.5], [x + 0.5, y, -15.5], [x, y, -15.5]], true);
  for (let z = -3; z <= 2.6; z += 1) D.poly([[15.5, y, z], [22.5, y, z], [22.5, y, z + 0.5], [15.5, y, z + 0.5]], true);
  for (let x = -3; x <= 2.6; x += 1) D.poly([[x, y, 15.5], [x + 0.5, y, 15.5], [x + 0.5, y, 22.5], [x, y, 22.5]], true);

  // cartelli delle vie (matematica da quadretti)
  const streetSign = (text: string, x: number, z: number, facing: '+z' | '-z' | '+x' | '-x') => {
    S.seg(x, 0, z, x, 2.6, z, { over: 0.03 });
    sign(text, x, 2.75, z, 1.9, 0.42, facing, { font: HAND_FONT });
    col.circle(x, z, 0.12);
  };
  streetSign('Viale dell\'Ordinata', -5, -24.5, '+z');
  streetSign('Via dell\'Ascissa', 24.5, -5, '-x');
  streetSign('Piazza del Quadretto', -14.5, -14.5, '-z');

  // bordo del foglio
  for (const [ax, az, bx, bz] of [[-58, -58, 58, -58], [58, -58, 58, 58], [58, 58, -58, 58], [-58, 58, -58, -58]] as const) G.dashed(ax, y, az, bx, y, bz, 1.2, 0.8);
  groundText('✂ - - ritagliare qui - -', 56.9, 9, 9, 1.1, Math.PI / 2);
  col.rect(-80, -80, -58, 80);
  col.rect(58, -80, 80, 80);
  col.rect(-80, -80, 80, -58);
  col.rect(-80, 58, 80, 80);
  A('mime', 57.1, 0, 1.5);
  {
    const erased = new THREE.Group();
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5), new THREE.MeshBasicMaterial({ color: '#f2f3f0' }));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(58, 0.035, 1.5);
    erased.add(patch);
    const crumbs = new Sketch();
    crumbs.style = { jitter: 0.01, over: 0 };
    for (let i = 0; i < 16; i++) {
      const x = 57.2 + rr(0, 1.6), z = rr(-0.8, 3.8), s = rr(0.05, 0.12);
      crumbs.circle(x, 0.045, z, s, 'y', 6, 0.3);
    }
    erased.add(crumbs.build(b.lineMat(1.2), b.fill));
    erased.visible = false;
    group.add(erased);
    b.props.erased = erased;
  }

  // =========================================================================
  // PIAZZA DEL QUADRETTO
  // =========================================================================
  // Monumento all'Angolo Retto
  solid(0, 0, 3.4, 3.4, 0.8);
  S.box(-0.9, 0.8, -0.9, 0.9, 5, 0.9).box(0.45, 0.8, -0.9, 1.8, 0.9, 0.9);
  D.poly([[-0.2, 1.8, -0.43], [-0.2, 2.1, -0.43], [0.1, 2.1, -0.43]]);
  sign('ALL\'ANGOLO RETTO\n90 gradi di pura gloria', 0, 0.45, 1.72, 2.4, 0.6, '+z', { font: HAND_FONT });
  A('monument', 0, 1, 1.9);
  // aiuole, alberi, panchine
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]] as const) {
    G.poly([[x - 2, y, z - 2], [x + 2, y, z - 2], [x + 2, y, z + 2], [x - 2, y, z + 2]], true);
    tree(x, z, 0.95);
  }
  bench(-7, 7.5, '+x');
  A('benchTemperino', -7, 0, 7.5);
  bench(7.5, -7, '-z');
  A('benchInsonne', 7.5, 0, -7);
  bench(-7.5, -7, '-z');
  for (const [x, z] of [[-13.5, 0], [13.5, 0], [0, 13.5], [0, -13.5]] as const) lamp(x, z, 1);
  // chiosco dei fiori
  S.box(-12, 0, -3, 1.8, 1.1, 1.2);
  S.roof(-12, 2.2, -3, 1.8, 1.2, 0.5, 'x', 0.3);
  S.seg(-12.85, 1.1, -3.55, -12.85, 2.2, -3.55).seg(-11.15, 1.1, -3.55, -11.15, 2.2, -3.55);
  for (let i = 0; i < 5; i++) D.circle(-12.6 + i * 0.3, 1.25, -3.3, 0.09, 'y', 8);
  sign('FIORI DISEGNATI', -12, 2.05, -3.62, 1.7, 0.3, '-z', { font: HAND_FONT });
  col.box(-12, -3, 1.8, 1.2);
  A('fioraio', -12, 0, -4.3);
  // campionato di pisolini
  S.seg(7.5, 0, 4.5, 7.5, 2.4, 4.5).seg(13, 0, 4.5, 13, 2.4, 4.5);
  sign('CAMPIONATO DI PISOLINI\nfinale regionale', 10.25, 2.2, 4.5, 5, 0.9, '-z');
  for (const x of [8.4, 10.2, 12]) G.poly([[x - 0.45, y, 5.5], [x + 0.45, y, 5.5], [x + 0.45, y, 7.7], [x - 0.45, y, 7.7]], true);
  A('pisolini', 10.2, 0, 3.6);

  // =========================================================================
  // LATO NORD: il luogo del delitto
  // =========================================================================
  // Palazzo del Balcone (il testimone sta al primo piano, sul retro)
  building({ x0: -24, x1: -8, z0: 25, z1: 40, h: 14, face: '-z', door: -16, sign: 'PALAZZO "BELLA VISTA"', signW: 5 });
  S.box(-7.55, 4.0, 35.5, 1.0, 0.12, 2.4);
  for (const z of [34.3, 35.5, 36.7]) S.seg(-7.1, 4.1, z, -7.1, 5.0, z, { over: 0.02 });
  S.seg(-7.1, 5.0, 34.3, -7.1, 5.0, 36.7);
  D.rectV(-7.97, 4.1, 34.8, 1.3, 2.2, 'z');
  A('balcony', -7.4, 4.1, 35.5);

  // MONTE DEI TAPPI: il banco dei pegni (con interni)
  {
    const X0 = -6, X1 = 6, Z0 = 25, Z1 = 33, H = 5.5;
    wallDoor(X0, Z0, X1, Z0, -2, 1.4, H, 2.5); // facciata con porta
    wallDoor(X0, Z1, X1, Z1, 2, 1.2, H, 2.4); // retro con porta sul vicolo
    wall(X0, Z0, X0, Z1, H);
    wall(X1, Z0, X1, Z1, H);
    S.box(0, H, 29, 12.4, 0.3, 8.4);
    sign('MONTE DEI TAPPI\nbanco dei pegni', 0, 3.9, Z0 - 0.08, 5.2, 1.2, '-z');
    // vetrina rotta (da dentro!)
    D.rectV(1, 0.8, Z0 - 0.14, 3.5, 1.7, 'x');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      D.seg(3.1, 1.7, Z0 - 0.15, 3.1 + Math.cos(a) * rr(0.5, 1.1), 1.7 + Math.sin(a) * rr(0.4, 0.8), Z0 - 0.15, { over: 0 });
    }
    // cocci sul marciapiede, fuori
    for (let i = 0; i < 14; i++) {
      const x = rr(1.4, 4.6), z = rr(23.7, 24.8), s = rr(0.08, 0.2);
      D.poly([[x, y, z], [x + s, y, z + s * 0.4], [x + s * 0.3, y, z + s]], true, { over: 0 });
    }
    A('glass', 3, 0.4, 24.4);
    A('prints', 4.1, 1.5, 24.7);
    A('lock', -1.45, 1.1, 24.75);
    A('shopDoor', -2, 1.2, 24.6);
    // interno
    solid(0, 31, 6, 0.8, 1.1);
    solid(-5.6, 29, 0.6, 6, 2.2, 0, true, false);
    solid(5.6, 29.8, 0.6, 4, 2.2, 0, true, false);
    for (const yy of [0.8, 1.6]) {
      S.seg(-5.3, yy, 26.2, -5.3, yy, 31.8);
      S.seg(5.3, yy, 28, 5.3, yy, 31.6);
    }
    for (let z = 26.6; z < 31.6; z += 0.9) D.circle(-5.35, 1.0, z, 0.15, 'x', 8);
    for (let z = 28.4; z < 31.4; z += 0.8) D.box(5.3, 1.6, z, 0.25, 0.3, 0.3);
    sign('Un\'ombra usata\n3 monete', -5.25, 2.5, 27.4, 1.0, 0.5, '+x', { font: HAND_FONT });
    sign('Tre sospiri\n1 moneta', -5.25, 2.5, 30.2, 1.0, 0.5, '+x', { font: HAND_FONT });
    sign('Ritratto di nessuno\n(somiglia a tutti)', 5.25, 2.6, 29.8, 1.2, 0.55, '-x', { font: HAND_FONT });
    // teca vuota
    solid(-3.6, 27.8, 0.9, 0.9, 1.1, 0, true, false);
    D.boxEdges(-3.6, 1.1, 27.8, 0.8, 0.6, 0.8);
    D.box(-3.6, 1.1, 27.8, 0.4, 0.06, 0.4);
    A('case', -3.6, 1.3, 27.8);
    for (let x = X0 + 0.6; x < X1; x += 0.6) D.dashed(x, y, Z0 + 0.2, x, y, Z1 - 0.2, rr(1.5, 3), 0.15);
    A('pegno', 0, 0, 31.9);
    A('gustavo', 3.2, 0, 26.6);
  }

  // Cartoleria Colla
  building({ x0: 8, x1: 16, z0: 25, z1: 33, h: 6, face: '-z', door: 12, sign: 'CARTOLERIA COLLA', signW: 5, shopWindow: true });
  sign('CERCO TAPPI RARI.\nPago bene. — M.', 14.4, 1.6, 24.9, 1.4, 0.8, '-z', { font: HAND_FONT });
  A('colla', 12, 0, 23.9);
  A('poster', 14.4, 1.6, 24.8);

  // vicolo sul retro e il bidone
  building({ x0: -24, x1: 30, z0: 40, z1: 50, h: 8, face: '-z', door: 22, sign: 'MAGAZZINO', signW: 4 });
  solid(3.6, 36.8, 1.4, 1.0, 1.2, 0, true, false);
  D.seg(2.9, 1.25, 36.3, 4.3, 1.4, 36.3);
  sign('SOLO CARTA\n(cioè tutto)', 3.6, 0.7, 36.28, 0.9, 0.45, '-z', { font: HAND_FONT });
  A('bin', 3.6, 1.0, 36.1);
  for (const [x, z] of [[-6.8, 38.5], [10, 38.4], [14.5, 34.5]] as const) solid(x, z, 1.1, 1.1, 1.0);
  A('backDoor', 2, 1.2, 33.4);

  // macero della carta: qui finisce tutto quello che si butta a Quadropoli
  {
    const mx = 15, mz = -51;
    solid(mx, mz, 5, 2.4, 2.2, 0, true, false);
    D.seg(mx - 2.5, 2.25, mz - 1.2, mx + 2.5, 2.25, mz - 1.2).seg(mx - 2.5, 2.25, mz + 1.2, mx + 2.5, 2.25, mz + 1.2);
    for (let i = 0; i < 12; i++) D.circle(mx + rr(-2.2, 2.2), 2.3 + rr(0, 0.35), mz + rr(-0.9, 0.9), rr(0.12, 0.3), 'y', 8, 0.4);
    sign('MACERO\ntutta la carta finisce qui', mx, 1.35, mz + 1.23, 3.2, 0.9, '+z', { font: HAND_FONT });
    for (const [x, z] of [[mx - 4, mz + 0.5], [mx + 3.8, mz + 1.2]] as const) solid(x, z, 1.2, 1.2, 1.0);
    A('macero', mx, 1.2, mz + 1.3);
  }

  // =========================================================================
  // IL RESTO DELLA CITTÀ
  // =========================================================================
  building({ x0: 18, x1: 30, z0: 25, z1: 38, h: 20, face: '-z', door: 24, sign: 'HOTEL A QUADRETTI', signW: 5 });
  building({ x0: 32, x1: 50, z0: 25, z1: 40, h: 15, face: '-z', door: 41, sign: 'UFFICIO PROTOCOLLO\nsportello 1 di 1', signW: 6 });
  building({ x0: 25, x1: 42, z0: 7, z1: 22, h: 18, face: '-z', door: 33 });
  building({ x0: 44, x1: 56, z0: 7, z1: 22, h: 11, face: '-z', door: 50, sign: 'PALESTRA "SQUADRETTA"', signW: 5 });
  building({ x0: 25, x1: 42, z0: -22, z1: -7, h: 13, face: '+z', door: 33, sign: 'BANCA DEI QUADRETTI', signW: 5 });
  building({ x0: 44, x1: 56, z0: -22, z1: -7, h: 22, face: '+z', door: 50 });
  building({ x0: 6, x1: 24, z0: -44, z1: -25, h: 16, face: '+z', door: 15, sign: 'GRANDI MAGAZZINI RIGHELLO', signW: 6.5 });
  building({ x0: -26, x1: -10, z0: -44, z1: -30, h: 12, face: '+z', door: -18 });
  building({ x0: -42, x1: -25, z0: -22, z1: 22, h: 18, face: '-z', door: -34 });
  building({ x0: -56, x1: -44, z0: -40, z1: 20, h: 24, face: '-z', door: -50 });
  building({ x0: 30, x1: 56, z0: -56, z1: -26, h: 9, face: '+z', door: 42, sign: 'PARCHEGGIO (vuoto: le auto sono tutte spinte)', signW: 9 });
  building({ x0: -56, x1: -30, z0: -56, z1: -46, h: 10, face: '+z', door: -40 });
  building({ x0: -56, x1: -26, z0: 24, z1: 56, h: 14, face: '-z', door: -40 });
  building({ x0: 32, x1: 56, z0: 42, z1: 56, h: 12, face: '-z', door: 44 });
  for (const [x, z] of [[-26, -25], [26, 23.5], [-27, 23.5]] as const) lamp(x, z, 1);

  // metropolitana
  {
    const mx = -9, mz = -28;
    S.box(mx - 1.6, 0, mz, 0.2, 1.0, 4);
    S.box(mx + 1.6, 0, mz, 0.2, 1.0, 4);
    S.box(mx, 0, mz - 2, 3.4, 1.0, 0.2);
    // tutta l'entrata è bloccata: niente passeggiate sopra il buco delle scale
    col.rect(mx - 1.7, mz - 2.1, mx + 1.7, mz + 2.05);
    for (let i = 0; i < 7; i++) G.seg(mx - 1.4, y, mz + 1.6 - i * 0.5, mx + 1.4, y, mz + 1.6 - i * 0.5, { over: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), new THREE.MeshBasicMaterial({ color: '#1d2233' }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(mx, 0.01, mz - 1.1);
    group.add(m);
    S.seg(mx + 2.2, 0, mz + 2, mx + 2.2, 3, mz + 2);
    sign('M', mx + 2.2, 3.3, mz + 2, 0.7, 0.7, '+z');
    sign('METRO A QUADRETTI\ntutte le linee sono dritte', mx, 1.35, mz + 2.05, 3, 0.55, '+z', { font: HAND_FONT });
    A('metro', mx, 1.2, mz + 2);
    A('turista', mx + 3.2, 0, mz + 3.6);
  }

  // =========================================================================
  // PUNTI
  // =========================================================================
  A('spawn', -9, 0, -24.8);
  A('spawnLook', -2, 1.6, 0);
  A('ispettore', -4.2, 0, 23.4);
  A('marcoStart', -7.5, 0, -24);
  A('poeta', 2.4, 0, 2.2);
  A('coinA', -7, 0, 38.6);
  A('coinB', 54, 0, -5.4);
  A('coinC', 12.5, 0, 6.6);
  A('coinD', -20, 0, -24.5);

  // auto spinte a mano: tre sagome mobili (le muove la storia)
  for (let i = 0; i < 3; i++) {
    const s = new Sketch();
    s.style = { jitter: 0.015, over: 0.05 };
    s.push(0, 0, 0, -Math.PI / 2); // il muso guarda verso +z, come gli omini
    s.box(0, 0.3, 0, 3.9, 0.7, 1.7);
    s.box(-0.2, 1.0, 0, 2.1, 0.62, 1.5);
    for (const wx of [-1.25, 1.25]) for (const wz of [-0.87, 0.87]) s.circle(wx, 0.36, wz, 0.36, 'z', 14, 0.04);
    for (const sd of [-0.76, 0.76]) {
      s.poly([[-1.15, 1.08, sd], [-0.3, 1.08, sd], [-0.3, 1.52, sd], [-1.0, 1.52, sd]], true);
      s.poly([[-0.15, 1.08, sd], [0.7, 1.08, sd], [0.55, 1.52, sd], [-0.15, 1.52, sd]], true);
    }
    s.circle(1.96, 0.7, 0.55, 0.12, 'x', 10).circle(1.96, 0.7, -0.55, 0.12, 'x', 10);
    s.pop();
    const car = s.build(b.lineMat(2), b.fill);
    group.add(car);
    b.props[`car${i}`] = car;
  }

  return b.finish({ isIndoor: ZONES.shop, fog: [40, 150] });
}

// Il giro delle auto spinte a mano, in senso orario lungo l'anello
export const CAR_LOOP: [number, number][] = [
  [-19, 19], [19, 19], [19, -19], [-19, -19],
];
