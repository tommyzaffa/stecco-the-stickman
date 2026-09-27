import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch } from '../../render/sketch';
import { MARKER_FONT, textTexture } from '../../render/textures';
import { CERA, THEME } from '../../render/palette';

// ---------------------------------------------------------------------------
// La macchina di Luca: "un rettangolo con quattro cerchi, più un altro rettangolo sopra".
// Niente motore. Coordinate locali: +z avanti, +x a sinistra (lato guida), y in alto.
// Dentro si vede tutto: cruscotto, volante, sedili. Alcuni pezzi si staccano negli urti.
// ---------------------------------------------------------------------------

export type PieceId = 'specchietto' | 'paraurti' | 'portiera' | 'fanale';
export const PIECE_NAMES: Record<PieceId, string> = {
  specchietto: 'lo specchietto',
  paraurti: 'il paraurti',
  portiera: 'la portiera',
  fanale: 'un fanale',
};
export const PIECE_ORDER: PieceId[] = ['specchietto', 'paraurti', 'fanale', 'portiera'];

export interface CarModel {
  root: THREE.Group; // posizione e rotazione della macchina (ordine YXZ: imbardata, beccheggio)
  wheels: THREE.Group[];
  steering: THREE.Group;
  pieces: Record<PieceId, THREE.Group>;
  eye: THREE.Vector3; // occhi del guidatore (locale)
  seats: { passenger: THREE.Vector3; backL: THREE.Vector3; backR: THREE.Vector3 };
}

export function buildLucaCar(lmS: LineMaterial, lmD: LineMaterial, fill: THREE.Material): CarModel {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const S = new Sketch();
  S.style = { jitter: 0.012, over: 0.05 };
  const D = new Sketch();
  D.style = { jitter: 0.008, over: 0.03 };
  // scocca: pavimento, cofano, bagagliaio, fiancata sinistra, cruscotto
  S.box(0, 0.26, 0, 1.6, 0.06, 3.7);
  S.box(0, 0.3, 1.4, 1.7, 0.62, 1.1);
  S.box(0, 0.3, -1.55, 1.7, 0.62, 0.8);
  S.box(0.82, 0.3, -0.15, 0.06, 0.62, 2.0);
  S.box(0, 0.86, 0.74, 1.6, 0.16, 0.22);
  // sedili
  for (const x of [0.38, -0.38]) {
    S.box(x, 0.32, -0.15, 0.55, 0.25, 0.55);
    S.box(x, 0.57, -0.47, 0.55, 0.62, 0.1);
  }
  S.box(0, 0.32, -0.85, 1.5, 0.25, 0.5);
  S.box(0, 0.57, -1.12, 1.5, 0.56, 0.1);
  // montanti e tetto: il "rettangolo sopra"
  for (const x of [0.8, -0.8]) {
    S.seg(x, 0.92, 0.85, x * 0.94, 1.72, 0.3, { over: 0.02 });
    S.seg(x, 0.92, -1.15, x * 0.94, 1.72, -0.9, { over: 0.02 });
  }
  S.box(0, 1.72, -0.3, 1.52, 0.05, 1.25);
  // vetro del parabrezza: due riflessi disegnati
  D.seg(-0.55, 1.05, 0.78, -0.35, 1.35, 0.6, { over: 0 }).seg(-0.45, 1.02, 0.8, -0.3, 1.24, 0.66, { over: 0 });
  // tachimetro disegnato: la lancetta è sullo zero (ed è disegnata lì)
  D.circle(-0.05, 0.94, 0.625, 0.07, 'z', 16, 0.03);
  D.seg(-0.05, 0.94, 0.624, -0.1, 0.905, 0.624, { over: 0 });
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * 1.15 - (k / 6) * Math.PI * 1.3;
    D.seg(-0.05 + Math.cos(a) * 0.055, 0.94 + Math.sin(a) * 0.055, 0.624, -0.05 + Math.cos(a) * 0.07, 0.94 + Math.sin(a) * 0.07, 0.624, { over: 0 });
  }
  // cofano: la scritta LUCA (a matita) e le linee del cofano
  D.seg(-0.6, 0.93, 1.0, -0.6, 0.93, 1.85, { over: 0 }).seg(0.6, 0.93, 1.0, 0.6, 0.93, 1.85, { over: 0 });
  root.add(S.build(lmS, fill), D.build(lmD, fill));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.2),
    new THREE.MeshBasicMaterial({ map: textTexture('LUCA', { w: 256, h: 72, font: MARKER_FONT }), transparent: true, depthWrite: false }),
  );
  label.rotation.set(-Math.PI / 2, 0, Math.PI);
  label.position.set(0, 0.935, 1.5);
  root.add(label);

  // ruote (girano)
  const wheels: THREE.Group[] = [];
  for (const wx of [0.87, -0.87]) {
    for (const wz of [1.25, -1.25]) {
      const w = new THREE.Group();
      w.position.set(wx, 0.36, wz);
      const ws = new Sketch();
      ws.circle(0, 0, 0, 0.36, 'x', 16, 0.04);
      ws.circle(0, 0, 0, 0.12, 'x', 8, 0.05);
      ws.seg(0, -0.34, 0, 0, 0.34, 0, { over: 0 });
      w.add(ws.build(lmS, fill));
      root.add(w);
      wheels.push(w);
    }
  }

  // volante (gira con lo sterzo)
  const steering = new THREE.Group();
  steering.position.set(0.38, 0.95, 0.5);
  steering.rotation.x = -0.75;
  const st = new Sketch();
  st.style = { jitter: 0.004, over: 0 };
  st.circle(0, 0, 0, 0.16, 'z', 20, 0.02);
  st.seg(-0.15, 0, 0, 0.15, 0, 0, { over: 0 }).seg(0, 0, 0, 0, -0.15, 0, { over: 0 });
  st.seg(0, 0, 0.02, 0, 0, 0.2, { over: 0 });
  steering.add(st.build(lmS, fill));
  root.add(steering);

  // pezzi che si possono staccare
  const piece = (draw: (s: Sketch) => void) => {
    const g = new THREE.Group();
    const s = new Sketch();
    s.style = { jitter: 0.01, over: 0.04 };
    draw(s);
    g.add(s.build(lmS, fill));
    root.add(g);
    return g;
  };
  const pieces: Record<PieceId, THREE.Group> = {
    specchietto: piece((s) => {
      s.seg(0.84, 0.92, 0.82, 0.98, 1.05, 0.78);
      s.box(1.0, 1.0, 0.78, 0.08, 0.16, 0.22);
    }),
    paraurti: piece((s) => s.box(0, 0.24, 2.0, 1.78, 0.16, 0.12)),
    fanale: piece((s) => {
      s.circle(0.55, 0.68, 1.96, 0.13, 'z', 12, 0.03);
      s.circle(-0.55, 0.68, 1.96, 0.13, 'z', 12, 0.03);
    }),
    portiera: piece((s) => {
      s.box(-0.82, 0.3, -0.15, 0.06, 0.62, 2.0);
      s.seg(-0.86, 0.75, 0.2, -0.86, 0.75, 0.45, { over: 0 });
    }),
  };

  return {
    root,
    wheels,
    steering,
    pieces,
    eye: new THREE.Vector3(0.4, 1.38, -0.2),
    // dietro il guidatore il posto resta libero: guardando indietro si vedono i Pastelli
    seats: { passenger: new THREE.Vector3(-0.42, 0.0, -0.15), backL: new THREE.Vector3(-0.45, 0.0, -0.85), backR: new THREE.Vector3(0.05, 0.0, -0.9) },
  };
}

// ---------------------------------------------------------------------------
// La Scatola da 24: la macchina dei Pastelli. Nemmeno lei ha il motore: la spingono loro.
// Coordinate locali come la macchina di Luca (+z avanti).
// ---------------------------------------------------------------------------
export function buildScatola(lmS: LineMaterial, fill: THREE.Material) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const S = new Sketch();
  S.style = { jitter: 0.015, over: 0.06 };
  S.box(0, 0.45, 0, 2.3, 1.3, 3.2);
  // il coperchio aperto, all'indietro
  S.poly([[-1.15, 1.75, -1.6], [1.15, 1.75, -1.6], [1.15, 2.5, -2.3], [-1.15, 2.5, -2.3]], true);
  for (const x of [1.0, -1.0]) for (const z of [1.1, -1.1]) S.circle(x + Math.sign(x) * 0.18, 0.3, z, 0.3, 'x', 12, 0.05);
  root.add(S.build(lmS, fill));
  // etichetta sul davanti e sui fianchi
  const tex = textTexture('PASTELLI A CERA\n24 colori · tutti arrabbiati', { w: 512, h: 256, bg: '#f4e2b8', border: true, font: MARKER_FONT });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshBasicMaterial({ map: tex }));
  lab.position.set(0, 1.1, 1.61);
  root.add(lab);
  for (const side of [1, -1]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.05), new THREE.MeshBasicMaterial({ map: tex }));
    l.position.set(side * 1.16, 1.1, 0);
    l.rotation.y = (side * Math.PI) / 2;
    root.add(l);
  }
  // i pastelli che spuntano dalla scatola
  const colors = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.viola, CERA.marrone, '#e0b400', '#47a7d8', '#34302c', '#e8e2d0', '#f4a3c4', '#2f9e44'];
  colors.forEach((c, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: c });
    const x = -0.9 + (i % 6) * 0.36, z = i < 6 ? 0.9 : 0.3;
    const h = 0.5 + ((i * 7) % 5) * 0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h, 8).translate(0, 1.75 + h / 2, 0), mat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 8).translate(0, 1.75 + h + 0.11, 0), mat);
    body.position.set(x, 0, z);
    tip.position.set(x, 0, z);
    root.add(body, tip);
  });
  void THEME;
  return root;
}
