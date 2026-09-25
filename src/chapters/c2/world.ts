import * as THREE from 'three';
import { Sketch } from '../../render/sketch';
import { moonTexture, HAND_FONT } from '../../render/textures';
import { HL, THEME } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';
import type { Rect } from '../../world/collision';

// ---------------------------------------------------------------------------
// Il Parallelepipedo, di notte. Gesso su carta nera; gli unici colori sono
// quelli degli Evidenziatori, che il club lo possiedono.
//
// Pianta (x = est/ovest, z = nord/sud):
//   strada            z -40..-26
//   ingresso          x -6..6,   z -26..-18   (guardaroba)
//   sala principale   x -18..18, z -18..8     (pista, DJ, bar, divanetti)
//   bagni             x -18..-6, z 8..16      → porta "SOLO PERSONALE"
//   zona VIP          x -6..18,  z 8..16      (cordone a x 6..10)
//   corridoio         x -18..6,  z 16..20     (guardia, casse) → uscita sul retro
//   ufficio           x 6..18,   z 16..22     (la teca)
//   vicolo            x -32..-18, z 10..26
// ---------------------------------------------------------------------------

export interface Door {
  group: THREE.Group;
  rect: Rect;
  open: boolean;
}

export const ZONES = {
  inside: (p: THREE.Vector3) => p.x > -18 && p.x < 18 && p.z > -26 && p.z < 22,
  entrance: (p: THREE.Vector3) => p.x > -6 && p.x < 6 && p.z > -26 && p.z < -18,
  hall: (p: THREE.Vector3) => p.x > -18 && p.x < 18 && p.z > -18 && p.z < 8,
  bathroom: (p: THREE.Vector3) => p.x > -18 && p.x < -6 && p.z > 8 && p.z < 16,
  vip: (p: THREE.Vector3) => p.x > -6 && p.x < 18 && p.z > 8 && p.z < 16,
  corridor: (p: THREE.Vector3) => p.x > -18 && p.x < 6 && p.z > 16 && p.z < 20,
  office: (p: THREE.Vector3) => p.x > 6 && p.x < 18 && p.z > 16 && p.z < 22,
  alley: (p: THREE.Vector3) => p.x < -18.2 && p.z > 10 && p.z < 26,
};

export function buildClub(): World {
  const b = new WorldBuilder(77);
  const { S, D, G, col, group, A, sign, neon, groundText, wall, wallDoor, solid, sofa, roundTable, stool, lamp, car, rr } = b;
  const y = 0.02;
  const H = 5.5; // altezza interni
  b.ground();

  // piccolo aiuto: pezzo che si può nascondere (porte, cordone, oggetti raccoglibili)
  const prop = (name: string, draw: (s: Sketch) => void, width = 2) => {
    const s = new Sketch();
    s.style = { jitter: 0.01, over: 0.04 };
    draw(s);
    const g = s.build(b.lineMat(width), b.fill);
    group.add(g);
    b.props[name] = g;
    return g;
  };
  // Porta chiusa (con collisione). Si apre con openDoor() dal capitolo.
  const door = (name: string, x: number, z: number, w: number, alongX: boolean, h = 2.6): Door => {
    const g = prop(name, (s) => {
      if (alongX) s.box(x, 0, z, w, h, 0.12);
      else s.box(x, 0, z, 0.12, h, w);
      // maniglia
      s.circle(alongX ? x + w * 0.35 : x, 1.1, alongX ? z : z + w * 0.35, 0.06, alongX ? 'z' : 'x', 8);
    });
    const rect = alongX ? col.box(x, z, w, 0.3) : col.box(x, z, 0.3, w);
    const d: Door = { group: g, rect, open: false };
    (b.props[name] as THREE.Object3D).userData.door = d;
    return d;
  };

  // =========================================================================
  // STRADA (fuori)
  // =========================================================================
  G.seg(-40, y, -33, 40, y, -33).seg(-40, y, -40.5, 40, y, -40.5);
  D.seg(-40, y, -32.8, 40, y, -32.8);
  G.dashed(-40, y, -36.8, 40, y, -36.8, 2, 2);
  for (let i = 0; i < 20; i++) {
    const x = rr(-38, 38), z = rr(-32.5, -26.5);
    D.poly([[x, y, z], [x + rr(-0.3, 0.3), y, z + rr(-0.3, 0.3)], [x + rr(-0.5, 0.5), y, z + rr(-0.3, 0.3)]]);
  }
  lamp(-12, -32.6, -1);
  lamp(12, -32.6, -1);
  car(15, -35, 0);
  car(-20, -38.6, Math.PI);
  // edifici vicini (solo sagome)
  b.building({ x0: -40, x1: -19, z0: -26, z1: 10, h: 8, face: '-z' });
  b.building({ x0: 19, x1: 40, z0: -26, z1: 22, h: 9, face: '-z' });
  // confini invisibili
  col.rect(-60, -60, -40, 60);
  col.rect(40, -60, 60, 60);
  col.rect(-60, -60, 60, -41);

  // cielo: luna e stelle
  {
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, depthWrite: false }));
    moon.scale.setScalar(22);
    moon.position.set(-70, 70, -160);
    group.add(moon);
    const stars = new Sketch();
    stars.style = { jitter: 0, over: 0 };
    for (let i = 0; i < 90; i++) {
      const a = rr(0, Math.PI * 2), e = rr(0.25, 1.2), d = 190;
      const x = Math.cos(a) * Math.cos(e) * d, yy = Math.sin(e) * d, z = Math.sin(a) * Math.cos(e) * d;
      const s = rr(0.6, 1.4);
      stars.seg(x - s, yy, z, x + s, yy, z).seg(x, yy - s, z, x, yy + s, z);
    }
    const m = b.lineMat(1.3);
    m.fog = false;
    group.add(stars.build(m, b.fill));
  }

  // =========================================================================
  // FACCIATA E MURI ESTERNI
  // =========================================================================
  wallDoor(-18, -26, 18, -26, 0, 2.4, 6.5, 2.8);
  wallDoor(-18, -26, -18, 22, 18, 2, 6.5, 2.6);
  wall(18, -26, 18, 22, 6.5);
  wall(-18, 22, 18, 22, 6.5);
  S.box(0, 6.5, -2, 36.6, 0.3, 48.6); // cornicione (anche soffitto visto da sotto)
  neon('PARALLELEPIPEDO', 0, 4.6, -26.2, 11, 1.6, '-z', HL.pink);
  sign('Dress code: stilizzato\nVietato l\'ingresso ai triangoli', 6.5, 2.2, -26.16, 3.4, 1.0, '-z', { font: HAND_FONT });
  // cordone della fila
  for (const px of [2.2, 9.5]) {
    S.seg(px, 0, -28.4, px, 0.95, -28.4);
    D.circle(px, 0.97, -28.4, 0.07, 'y', 8);
  }
  D.curve([[2.2, 0.9, -28.4], [4, 0.6, -28.4], [5.85, 0.55, -28.4], [7.7, 0.6, -28.4], [9.5, 0.9, -28.4]]);
  col.rect(2.1, -28.5, 9.6, -28.3, true);
  const frontDoor = door('frontDoor', 0, -26, 2.4, true, 2.8);
  A('frontDoor', 0, 1.4, -26.2);

  // =========================================================================
  // INGRESSO E GUARDAROBA
  // =========================================================================
  wall(-6, -26, -6, -18, H);
  wall(6, -26, 6, -18, H);
  wallDoor(-18, -18, 18, -18, 0, 3, H, 3);
  solid(-4.4, -22, 0.8, 3.4, 1.1);
  S.seg(-5.75, 2.1, -24, -5.75, 2.1, -20);
  for (let z = -23.6; z < -20; z += 0.5) D.poly([[-5.75, 2.1, z], [-5.6, 1.85, z - 0.15], [-5.6, 1.85, z + 0.15]], true);
  sign('GUARDAROBA', -5.84, 3.0, -22, 2.6, 0.55, '+x');
  sign('(custodiamo tutto.\nanche il niente)', -5.84, 2.45, -22, 1.8, 0.45, '+x', { font: HAND_FONT });
  neon('→ PISTA', 3.8, 3.3, -18.2, 2.6, 0.8, '-z', HL.cyan);
  A('ornella', -5.3, 0, -22);

  // =========================================================================
  // SALA PRINCIPALE
  // =========================================================================
  // pista: piastrelle colorate che si accendono a tempo
  {
    const tiles = new THREE.Group();
    const cols = [HL.pink, HL.yellow, HL.cyan, HL.green, HL.orange];
    const geo = new THREE.PlaneGeometry(1.92, 1.92);
    geo.rotateX(-Math.PI / 2);
    let i = 0;
    for (let ix = 0; ix < 7; ix++) {
      for (let iz = 0; iz < 6; iz++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[(ix * 2 + iz) % cols.length], transparent: true, opacity: 0.15, depthWrite: false, fog: false }));
        m.position.set(-6 + ix * 2, 0.03, -11 + iz * 2);
        m.userData.ix = ix;
        m.userData.iz = iz;
        m.userData.i = i++;
        tiles.add(m);
      }
    }
    group.add(tiles);
    b.props.tiles = tiles;
    for (let x = -7; x <= 7; x += 2) G.seg(x, y, -12, x, y, 0, { over: 0 });
    for (let z = -12; z <= 0; z += 2) G.seg(-7, y, z, 7, y, z, { over: 0 });
  }
  // DJ
  solid(0, 3.5, 7, 2.6, 0.6);
  S.box(0, 0.6, 2.75, 3.2, 0.55, 0.7);
  D.circle(-0.8, 1.16, 2.75, 0.24, 'y', 14).circle(0.8, 1.16, 2.75, 0.24, 'y', 14);
  for (const sx of [-5.4, 5.4]) {
    solid(sx, 3.5, 1.3, 1.1, 2.4, 0, true, false);
    D.circle(sx, 0.8, 2.93, 0.36, 'z', 16).circle(sx, 1.75, 2.93, 0.22, 'z', 12);
  }
  neon('PARALLELEPIPEDO', 0, 4.4, 7.8, 8, 1.2, '-z', HL.yellow);
  A('dj', 0, 0.6, 4.1);
  // palla da discoteca
  {
    const ball = new Sketch();
    ball.style = { jitter: 0, over: 0 };
    ball.geometry(new THREE.IcosahedronGeometry(0.7, 1), 1);
    const g = ball.build(b.lineMat(1.4), b.fill);
    const holder = new THREE.Group();
    holder.position.set(0, 5.0, -6);
    holder.add(g);
    group.add(holder);
    b.props.ball = holder;
    S.seg(0, 6.5, -6, 0, 5.7, -6, { over: 0 });
  }
  // fasci di luce
  {
    const beams = new THREE.Group();
    const cols = [HL.pink, HL.cyan, HL.yellow, HL.green];
    [[-5, -10], [5, -10], [-5, -1], [5, -1]].forEach(([x, z], i) => {
      const cone = new THREE.ConeGeometry(1.5, 6, 18, 1, true);
      cone.translate(0, -3, 0);
      const m = new THREE.Mesh(
        cone,
        new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      );
      const pivot = new THREE.Group();
      pivot.position.set(x, 6.3, z);
      pivot.add(m);
      pivot.userData.phase = i * 1.7;
      beams.add(pivot);
      S.box(x, 6.1, z, 0.4, 0.3, 0.4);
    });
    group.add(beams);
    b.props.beams = beams;
  }
  // bar
  solid(-14.6, -6, 1.0, 12, 1.15);
  solid(-17.5, -6, 0.6, 10, 2.4, 0, true, false);
  for (const shelfY of [1.0, 1.8]) {
    S.seg(-17.2, shelfY, -11, -17.2, shelfY, -1);
    for (let z = -10.5; z < -1.2; z += 0.55) {
      const hh = rr(0.35, 0.55);
      D.seg(-17.25, shelfY, z, -17.25, shelfY + hh, z, { over: 0 }).seg(-17.25, shelfY + hh, z, -17.25, shelfY + hh + 0.12, z + 0.05, { over: 0 });
    }
  }
  for (const z of [-11, -9, -7, -5, -1]) stool(-13.5, z);
  neon('BAR', -17.8, 3.5, -6, 2.4, 1.0, '+x', HL.cyan);
  sign('Cocktail della casa:\n"IL TRATTEGGIO"', -14.05, 1.5, -10.3, 1.2, 0.5, '+x', { font: HAND_FONT });
  A('nando', -16.4, 0, -6);
  A('marco', -13.3, 0, -3);
  // divanetti
  for (const z of [-14, -9, -4]) {
    sofa(17.1, z, 3, '-x');
    roundTable(15.5, z, 0.55);
  }
  // sottobicchiere (si raccoglie)
  prop('coaster', (s) => s.cylinder(15.5, 0.8, -9.15, 0.12, 0.02, 12), 1.4);
  A('coaster', 15.5, 0.85, -9.15);
  // muro nord della sala, con porta dei bagni e varco VIP
  wall(-18, 8, -16, 8, H);
  wall(-14, 8, 6, 8, H);
  wall(10, 8, 18, 8, H);
  S.box(-15, 3, 8, 2, H - 3, 0.25);
  S.box(8, 3.2, 8, 4, H - 3.2, 0.25);
  neon('BAGNI', -15, 3.6, 7.8, 2.2, 0.8, '-z', HL.green);
  neon('VIP', 8, 3.9, 7.8, 2.2, 1.0, '-z', HL.pink);
  // cordone VIP
  for (const px of [6.4, 9.6]) {
    S.seg(px, 0, 7.6, px, 0.95, 7.6);
    D.circle(px, 0.97, 7.6, 0.07, 'y', 8);
  }
  prop('rope', (s) => s.curve([[6.4, 0.9, 7.6], [7.2, 0.6, 7.6], [8, 0.55, 7.6], [8.8, 0.6, 7.6], [9.6, 0.9, 7.6]]), 2.2);
  const ropeRect = col.rect(6.3, 7.45, 9.7, 7.75, true);
  (b.props.rope as THREE.Object3D).userData.rect = ropeRect;
  A('rope', 8, 1.0, 7.4);
  A('rosa', 8, 0, 6.9);
  // moneta dietro la consolle
  A('coinDj', 2.6, 0, 6.6);

  // =========================================================================
  // BAGNI
  // =========================================================================
  wall(-6, 8, -6, 16, H);
  solid(-17.3, 12, 0.9, 4, 0.9);
  D.rectV(-17.84, 1.3, 10.2, 3.6, 1.3, 'z');
  for (const z of [10.8, 12, 13.2]) D.circle(-17.1, 0.92, z, 0.25, 'y', 12).seg(-17.7, 0.9, z, -17.7, 1.15, z);
  for (const z of [9, 12, 15]) wall(-9.6, z, -6, z, 2.3, 0.08);
  for (const z of [10.5, 13.5]) {
    S.box(-6.5, 0, z, 0.6, 0.45, 0.55);
    S.box(-6.2, 0.45, z, 0.25, 0.5, 0.55);
    D.circle(-6.55, 0.47, z, 0.22, 'y', 12);
    col.box(-6.45, z, 0.75, 0.6).low = true;
  }
  prop('sock', (s) => {
    s.poly([[-7.9, 0.03, 13.3], [-7.9, 0.03, 13.75], [-7.5, 0.03, 13.95], [-7.4, 0.03, 13.8], [-7.7, 0.03, 13.65], [-7.7, 0.03, 13.3]], true);
    s.seg(-7.9, 0.03, 13.42, -7.7, 0.03, 13.42, { over: 0 });
  }, 1.6);
  A('sock', -7.6, 0.4, 13.6);
  sign('ACQUA DISEGNATA\nnon potabile', -17.84, 2.9, 12, 1.6, 0.5, '+x', { font: HAND_FONT });
  A('coinBath', -8.2, 0, 10.4);

  // muro z=16 (bagni / VIP → corridoio e ufficio): porta di servizio e porta dell'ufficio
  wall(-18, 16, -14, 16, H);
  wall(-12.5, 16, 12.2, 16, H);
  wall(13.8, 16, 18, 16, H);
  S.box(-13.25, 2.6, 16, 1.5, H - 2.6, 0.25);
  S.box(13, 2.6, 16, 1.6, H - 2.6, 0.25);
  const staffDoor = door('staffDoor', -13.25, 16, 1.5, true);
  sign('SOLO PERSONALE', -13.25, 2.3, 15.82, 1.5, 0.35, '-z');
  A('staffDoor', -13.25, 1.2, 15.6);

  // =========================================================================
  // CORRIDOIO DI SERVIZIO
  // =========================================================================
  wall(-18, 20, 6, 20, H);
  const crate = (x: number, z: number, w: number, d: number, h: number) => {
    solid(x, z, w, d, h, 0, true, true);
    D.seg(x - w / 2, 0, z - d / 2 - 0.02, x + w / 2, h, z - d / 2 - 0.02).seg(x + w / 2, 0, z - d / 2 - 0.02, x - w / 2, h, z - d / 2 - 0.02);
    D.seg(x - w / 2, 0, z + d / 2 + 0.02, x + w / 2, h, z + d / 2 + 0.02).seg(x + w / 2, 0, z + d / 2 + 0.02, x - w / 2, h, z + d / 2 + 0.02);
  };
  crate(-11, 19.2, 1.3, 1.1, 1.2);
  crate(-5.5, 16.75, 1.2, 1.0, 1.2);
  crate(1, 19.2, 1.4, 1.1, 1.3);
  crate(-15.8, 19.3, 1.0, 1.0, 1.0);
  for (const x of [-14, -6, 2]) {
    D.seg(x, H, 18, x, 4.4, 18, { over: 0 });
    D.circle(x, 4.3, 18, 0.12, 'z', 10);
  }
  const backExit = door('backExit', -18, 18, 2, false);
  neon('USCITA', -17.8, 3.2, 18, 1.8, 0.6, '+x', HL.green);
  A('backExit', -17.6, 1.2, 18);
  groundText('conta le casse: 1, 2, 3...', -4, 18.3, 3.4, 0.6, 0, THEME.inkHex);

  // =========================================================================
  // ZONA VIP
  // =========================================================================
  sofa(0, 15.3, 4.2, '-z');
  sofa(-5.3, 12, 3.4, '+x');
  sofa(15, 15.3, 3.4, '-z');
  sofa(17.3, 11, 3.4, '-x');
  solid(0, 13.5, 2.2, 1.0, 0.45);
  solid(15, 13.5, 1.8, 0.9, 0.45);
  for (const [x, z] of [[-0.5, 13.4], [0.4, 13.6], [15.2, 13.4]] as const) {
    D.seg(x, 0.45, z, x, 0.85, z, { over: 0 }).seg(x, 0.85, z, x, 1.0, z, { over: 0 });
    D.circle(x, 0.62, z, 0.07, 'y', 8);
  }
  G.poly([[-3, y, 9.5], [12, y, 9.5], [12, y, 14], [-3, y, 14]], true);
  sign('UFFICIO\n(bussare. tanto non apriamo)', 13, 3.2, 15.82, 2.2, 0.7, '-z', { font: HAND_FONT });
  A('officeFront', 13, 1.2, 15.6);

  // =========================================================================
  // UFFICIO DI DON FLUO
  // =========================================================================
  wallDoor(6, 16, 6, 22, 18, 1.4, H, 2.6);
  solid(12.5, 20.2, 3.2, 1.1, 0.8);
  S.box(12.5, 0, 21.3, 1.1, 1.8, 0.7);
  col.box(12.5, 21.3, 1.1, 0.7);
  sign('DON FLUO\n~ il più brillante ~', 12.5, 3.1, 21.84, 2.6, 1.3, '-z');
  solid(17, 21, 1.1, 1.1, 1.3, 0, true, false);
  D.circle(16.43, 0.75, 21, 0.2, 'x', 12);
  // la teca
  solid(16.6, 17.4, 0.8, 0.8, 1.1, 0, true, false);
  D.boxEdges(16.6, 1.1, 17.4, 0.7, 0.6, 0.7);
  D.box(16.6, 1.1, 17.4, 0.4, 0.06, 0.4);
  sign('(vuota da ieri)', 16.1, 1.35, 17.4, 0.9, 0.25, '-x', { font: HAND_FONT });
  A('teca', 16.6, 1.3, 17.4);
  G.poly([[8, y, 17], [16, y, 17], [16, y, 21], [8, y, 21]], true);
  A('officeCenter', 11, 0, 18);
  A('fluoDoor', 13, 0, 14.6);

  // =========================================================================
  // VICOLO
  // =========================================================================
  wall(-32, 10, -32, 26, 3.2);
  wall(-32, 10, -18, 10, 3.2);
  wall(-32, 26, -18, 26, 3.2);
  solid(-29, 23.6, 2.4, 1.3, 1.3, 0, true, false);
  D.seg(-30.2, 1.35, 22.9, -27.8, 1.55, 22.9);
  solid(-20, 11.4, 1.2, 1.2, 1.2);
  for (const [x, z] of [[-27, 24.3], [-26.2, 23.9], [-31, 14]] as const) D.circle(x, 0.35, z, 0.35, 'z', 12);
  A('alleyMarco', -24, 0, 16);
  A('coinAlley', -29, 0, 22.4);
  A('fluoAlley', -19.3, 0, 18);

  // =========================================================================
  // PUNTI DI PARTENZA E DI PASSAGGIO
  // =========================================================================
  A('spawn', 0, 0, -37.5);
  A('spawnLook', 0, 2.2, -26);
  A('marcoOut', -5, 0, -30);
  A('bruno', -1.9, 0, -27.3);
  A('hallCenter', 0, 0, -8);

  void frontDoor;
  void staffDoor;
  void backExit;
  return b.finish({ isIndoor: ZONES.inside, fog: [18, 80] });
}

// Nodi di passaggio per gli avversari che ti inseguono (le porte, da entrambi i lati)
export const NAV: [number, number][] = [
  [0, -24.8], [0, -27.2], [0, -17], [0, -19],
  [8, 6.8], [8, 9.2], [-15, 7], [-15, 9],
  [-13.25, 15], [-13.25, 17], [13, 15], [13, 17],
  [5, 18], [7, 18], [-17, 18], [-19, 18],
];

// Apre una porta costruita con door(): sparisce il pannello e la collisione.
export function openDoor(world: World, name: string) {
  const g = world.props[name];
  const d = g?.userData.door as Door | undefined;
  if (!d || d.open) return false;
  d.open = true;
  g.visible = false;
  world.colliders.remove(d.rect);
  return true;
}
