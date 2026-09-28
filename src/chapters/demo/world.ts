import * as THREE from 'three';
import { HAND_FONT, targetTexture } from '../../render/textures';
import { BLUE_HEX, RED_HEX } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';
import { Sketch } from '../../render/sketch';

// ---------------------------------------------------------------------------
// La demo: "la pagina di prova". Un foglio a righe (come quello del menu) con un percorso dritto
// verso -z, recintato, e una tappa per ogni comando.
//
//   z   0   partenza               z -40  il Tutorial (parla)      z -74  lo sparring (para)
//   z  -6   il palloncino (guarda) z -46..-56  monete              z -80  il righello (arma 2)
//   z -10   la X (cammina)         z -60  il diario                z -86  la pistola, sagome a -97
//   z -13..-27  corsa a tempo      z -66  il manichino (colpisci)  z -104 fine
//   z -31   la pozzanghera (salta) z -37  la sbarra (accovacciati)
// ---------------------------------------------------------------------------

export const Z = {
  balloon: -6,
  x: -10,
  runStart: -13,
  flag: -27,
  puddle0: -30.6,
  puddle1: -32.4,
  bar: -37.2,
  tutorial: -42,
  coins: [-47, -51, -55],
  diario: -59,
  dummy: -66,
  sparring: -74,
  ruler: -80,
  pistol: -86,
  targets: -97,
  end: -104,
};
export const HALF = 4; // mezza larghezza del percorso

export const DREFS = {
  balloon: null as THREE.Sprite | null,
  targets: [] as { pivot: THREE.Group; x: number; z: number; down: boolean; fall: number }[],
};

export function buildDemo(): World {
  DREFS.targets = [];
  const b = new WorldBuilder(707);
  const { S, D, G, col, A, sign } = b;
  b.ground();
  b.daySky('mountains');
  const y = 0.02;

  // il foglio a righe: righe azzurre e il margine rosso (come la pagina del menu)
  const rows = b.lineMat(1.4, '#9fb8d6');
  const margin = b.lineMat(2.2, RED_HEX);
  const lines = new Sketch();
  lines.style = { jitter: 0.02, over: 0 };
  for (let z = 6; z > Z.end - 8; z -= 1.4) lines.seg(-40, y, z, 40, y, z);
  b.group.add(lines.build(rows, b.fill));
  const m = new Sketch();
  m.style = { jitter: 0.02, over: 0 };
  m.seg(-HALF - 2.5, y + 0.01, 8, -HALF - 2.5, y + 0.01, Z.end - 8);
  b.group.add(m.build(margin, b.fill));

  // recinto ai lati e in fondo (lo steccato disegnato)
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      S.seg(x, 0, z, x, 1.05, z, { over: 0.02 });
    }
    S.seg(x0, 0.85, z0, x1, 0.85, z1).seg(x0, 0.45, z0, x1, 0.45, z1);
    col.rect(Math.min(x0, x1) - 0.15, Math.min(z0, z1) - 0.15, Math.max(x0, x1) + 0.15, Math.max(z0, z1) + 0.15);
  };
  fence(-HALF, 4, -HALF, Z.end - 4);
  fence(HALF, 4, HALF, Z.end - 4);
  fence(-HALF, 4, HALF, 4);
  fence(-HALF, Z.end - 4, HALF, Z.end - 4);
  // qualche albero fuori dal recinto, e le colline
  for (let z = 0; z > Z.end; z -= 11) {
    b.tree(-HALF - 6 - (Math.abs(z) % 5), z - 3, 1.1);
    b.tree(HALF + 7 + (Math.abs(z) % 4), z - 8, 1.2);
  }

  // cartello d'ingresso
  sign('LA PAGINA DI PROVA\nqui si impara. poi si cancella.', 0, 3.0, -2, 3.4, 1.2, '+z', { font: HAND_FONT });
  S.seg(-1.7, 0, -2, -1.7, 2.4, -2).seg(1.7, 0, -2, 1.7, 2.4, -2);

  // 1. il palloncino (rosso, come gli obiettivi), in alto a destra
  const bc = document.createElement('canvas');
  bc.width = bc.height = 128;
  const ctx = bc.getContext('2d')!;
  ctx.fillStyle = RED_HEX;
  ctx.strokeStyle = '#1e1d24';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(64, 54, 38, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 100);
  ctx.quadraticCurveTo(54, 112, 66, 126);
  ctx.stroke();
  const bt = new THREE.CanvasTexture(bc);
  bt.colorSpace = THREE.SRGBColorSpace;
  const balloon = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, alphaTest: 0.4 }));
  balloon.scale.setScalar(1.6);
  balloon.position.set(7.5, 4.2, Z.balloon);
  b.group.add(balloon);
  DREFS.balloon = balloon;
  S.seg(7.5, 0, Z.balloon, 7.5, 3.4, Z.balloon, { over: 0 });

  // 2. la X per terra
  G.seg(-0.8, y, Z.x - 0.8, 0.8, y, Z.x + 0.8, { over: 0.05 }).seg(-0.8, y, Z.x + 0.8, 0.8, y, Z.x - 0.8, { over: 0.05 });
  const redG = b.lineMat(3, RED_HEX);
  const xs = new Sketch();
  xs.circle(0, y + 0.01, Z.x, 1.2, 'y', 24, 0.05);
  b.group.add(xs.build(redG, b.fill));

  // 3. la corsa: linea di partenza e bandiera
  G.seg(-HALF, y, Z.runStart, HALF, y, Z.runStart).seg(-HALF, y, Z.runStart - 0.4, HALF, y, Z.runStart - 0.4);
  b.groundText('VIA!', 0, Z.runStart + 1.2, 2, 0.8, 0);
  S.seg(0, 0, Z.flag, 0, 3.2, Z.flag, { over: 0.05 });
  S.poly([[0, 3.2, Z.flag], [1.3, 2.85, Z.flag], [0, 2.5, Z.flag]], true);
  G.seg(-HALF, y, Z.flag, HALF, y, Z.flag);

  // 4. la pozzanghera (blu): tutta la larghezza, si salta
  const puddle = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, Z.puddle0 - Z.puddle1),
    new THREE.MeshBasicMaterial({ color: '#9ec3ea', transparent: true, opacity: 0.8, depthWrite: false }),
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0, 0.03, (Z.puddle0 + Z.puddle1) / 2);
  b.group.add(puddle);
  const pw = b.lineMat(2, BLUE_HEX);
  const ps = new Sketch();
  ps.style = { jitter: 0.06, over: 0.1 };
  for (const z of [Z.puddle0, Z.puddle1]) ps.seg(-HALF, 0.04, z, HALF, 0.04, z);
  for (let x = -3; x <= 3; x += 1.5) ps.curve([[x - 0.4, 0.04, (Z.puddle0 + Z.puddle1) / 2], [x, 0.04, (Z.puddle0 + Z.puddle1) / 2 + 0.15], [x + 0.4, 0.04, (Z.puddle0 + Z.puddle1) / 2]]);
  b.group.add(ps.build(pw, b.fill));

  // 5. la sbarra: ci si passa sotto solo accovacciati
  S.seg(-HALF, 0, Z.bar, -HALF, 1.25, Z.bar).seg(HALF, 0, Z.bar, HALF, 1.25, Z.bar);
  S.box(0, 1.2, Z.bar, HALF * 2, 0.12, 0.12);
  for (let x = -HALF + 0.5; x < HALF; x += 1) D.seg(x, 1.2, Z.bar + 0.07, x + 0.5, 1.32, Z.bar + 0.07, { over: 0 });

  // 7. le monete le mette la storia; 8. cartello del diario
  // 9. il manichino lo mette la storia (è un PNG da colpire)
  // 12. le sagome, in fondo
  const tMat = new THREE.MeshBasicMaterial({ map: targetTexture('bad'), transparent: true, alphaTest: 0.4 });
  const tGeo = new THREE.PlaneGeometry(1, 2).translate(0, 1, 0);
  for (const x of [-2.4, 0, 2.4]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, Z.targets);
    pivot.add(new THREE.Mesh(tGeo, tMat));
    b.group.add(pivot);
    D.seg(x - 0.4, 0.05, Z.targets - 0.1, x + 0.4, 0.05, Z.targets - 0.1);
    DREFS.targets.push({ pivot, x, z: Z.targets, down: false, fall: 0 });
  }
  // il bancone del tiro a segno
  // il bancone del tiro a segno: a destra resta un passaggio per andare al traguardo
  S.box(-1.1, 0, Z.pistol - 3.2, 5.8, 1.0, 0.5);
  const counter = col.box(-1.1, Z.pistol - 3.2, 5.8, 0.5);
  counter.low = true;
  counter.h = 1.0; // basso: i colpi ci passano sopra

  // traguardo
  G.seg(-HALF, y, Z.end, HALF, y, Z.end).seg(-HALF, y, Z.end - 0.5, HALF, y, Z.end - 0.5);
  for (let x = -HALF; x < HALF; x += 1) G.seg(x, y, Z.end, x + 0.5, y, Z.end - 0.5, { over: 0 });
  sign('FINE\n(della pagina)', 0, 2.2, Z.end - 3.6, 2.6, 1.0, '+z', { font: HAND_FONT });
  S.seg(-1.1, 0, Z.end - 3.6, -1.1, 1.7, Z.end - 3.6).seg(1.1, 0, Z.end - 3.6, 1.1, 1.7, Z.end - 3.6);

  A('spawn', 0, 0, 1.5);
  A('spawnLook', 0, 1.6, -10);
  return b.finish({ fog: [40, 140] });
}
