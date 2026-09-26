import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch, makeHatchMaterial, makeLineMaterial, releaseLineMaterial } from '../render/sketch';
import { Colliders } from './collision';
import { bushTexture, cloudTexture, crownTexture, sunTexture, textTexture, HAND_FONT, MARKER_FONT } from '../render/textures';
import { THEME, makeRng } from '../render/palette';

// ---------------------------------------------------------------------------
// Attrezzi per costruire i luoghi di un capitolo. Ogni capitolo crea un
// WorldBuilder, ci disegna dentro e chiama finish() per ottenere un World.
// ---------------------------------------------------------------------------

export type Facing = '-z' | '+z' | '-x' | '+x';
export const FACING_ROT: Record<Facing, number> = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

export interface World {
  group: THREE.Group;
  colliders: Colliders;
  anchors: Record<string, THREE.Vector3>;
  props: Record<string, THREE.Object3D>;
  isIndoor: (p: THREE.Vector3) => boolean;
  fog: [number, number];
  dispose(): void;
}

export interface BuildingOpts {
  x0: number; x1: number; z0: number; z1: number; h: number;
  face: '-z' | '+z';
  roof?: 'flat' | 'gable';
  door?: number;
  doorW?: number;
  sign?: string;
  signW?: number;
  shopWindow?: boolean;
  noCollider?: boolean;
}

export class WorldBuilder {
  group = new THREE.Group();
  col = new Colliders();
  anchors: Record<string, THREE.Vector3> = {};
  props: Record<string, THREE.Object3D> = {};
  S = new Sketch(); // tratti principali
  D = new Sketch(); // dettagli sottili
  G = new Sketch(); // segni per terra
  fill: THREE.ShaderMaterial;
  r: () => number;
  private lineMats: LineMaterial[] = [];
  private crownMats: THREE.SpriteMaterial[] | null = null;
  private bushMats: THREE.SpriteMaterial[] | null = null;

  constructor(seed = 2024) {
    this.D.style = { jitter: 0.015, over: 0.06 };
    this.G.style = { jitter: 0.02, over: 0.1 };
    this.fill = makeHatchMaterial();
    this.r = makeRng(seed);
  }

  rr = (a: number, b: number) => a + (b - a) * this.r();

  lineMat = (width: number, color?: THREE.ColorRepresentation) => {
    const m = makeLineMaterial(width, color);
    this.lineMats.push(m);
    return m;
  };

  A = (name: string, x: number, y: number, z: number) => (this.anchors[name] = new THREE.Vector3(x, y, z));

  // cartello scritto a mano
  sign = (text: string, x: number, y: number, z: number, w: number, h: number, facing: Facing, opts: Parameters<typeof textTexture>[1] = {}) => {
    const tex = textTexture(text, { w: 512, h: Math.round((512 * h) / w), border: true, bg: THEME.paperHex, ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = FACING_ROT[facing];
    this.group.add(m);
    // retro del cartello: carta bianca con il bordo (altrimenti da dietro sparirebbe)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: THEME.paperHex }));
    back.rotation.y = FACING_ROT[facing] + Math.PI;
    back.position.copy(m.position);
    back.translateZ(0.01); // leggermente dietro al fronte
    this.group.add(back);
    this.D.push(x, y, z, FACING_ROT[facing]);
    // il bordo sta un filo dietro il fronte: così non si confonde con la superficie del retro
    const bz = -0.02;
    this.D.poly([[-w / 2, -h / 2, bz], [w / 2, -h / 2, bz], [w / 2, h / 2, bz], [-w / 2, h / 2, bz]], true, { over: 0.03 });
    this.D.pop();
    return m;
  };

  // insegna al neon: testo colorato che non sente la nebbia
  neon = (text: string, x: number, y: number, z: number, w: number, h: number, facing: Facing, color: string) => {
    const tex = textTexture(text, { w: 1024, h: Math.round((1024 * h) / w), color, font: MARKER_FONT, glow: color });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = FACING_ROT[facing];
    this.group.add(m);
    return m;
  };

  // scritta per terra (tipo gesso)
  groundText = (text: string, x: number, z: number, w: number, h: number, rotY = 0, color?: string) => {
    const tex = textTexture(text, { w: 512, h: Math.round((512 * h) / w), font: HAND_FONT, color });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    m.rotation.set(-Math.PI / 2, 0, rotY);
    m.position.set(x, 0.03, z);
    this.group.add(m);
    return m;
  };

  // scritta su un muro (graffiti, scritte col pennarello): solo testo, niente cartello
  wallText = (text: string, x: number, y: number, z: number, w: number, h: number, facing: Facing, color?: string) => {
    const tex = textTexture(text, { w: 512, h: Math.round((512 * h) / w), font: MARKER_FONT, color });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = FACING_ROT[facing];
    this.group.add(m);
    return m;
  };

  // soffitto (al chiuso): un piano tratteggiato che guarda in basso
  ceiling = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.fill);
    m.rotation.x = Math.PI / 2;
    m.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
    this.group.add(m);
    return m;
  };

  ground = (size = 400) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    this.group.add(new THREE.Mesh(g, this.fill));
  };

  private spriteMat(map: THREE.Texture) {
    const m = new THREE.SpriteMaterial({ map, alphaTest: 0.5 });
    m.alphaToCoverage = true;
    return m;
  }

  tree = (x: number, z: number, s = 1) => {
    this.crownMats ??= [0, 1, 2, 3].map((i) => this.spriteMat(crownTexture(10 + i)));
    const S = this.S;
    S.cylinder(x, 0, z, 0.14 * s, 2.3 * s, 6);
    S.seg(x, 1.7 * s, z, x + 0.5 * s, 2.4 * s, z + 0.1);
    S.seg(x, 1.9 * s, z, x - 0.4 * s, 2.6 * s, z - 0.1);
    const sp = new THREE.Sprite(this.crownMats[Math.floor(this.r() * this.crownMats.length)]);
    sp.scale.setScalar(3.4 * s);
    sp.position.set(x, 3.3 * s, z);
    this.group.add(sp);
    this.col.circle(x, z, 0.3);
  };

  bush = (x: number, z: number, s = 1) => {
    this.bushMats ??= [0, 1].map((i) => this.spriteMat(bushTexture(20 + i)));
    const sp = new THREE.Sprite(this.bushMats[Math.floor(this.r() * this.bushMats.length)]);
    sp.scale.set(2.4 * s, 1.2 * s, 1);
    sp.position.set(x, 0.58 * s, z);
    this.group.add(sp);
    this.col.circle(x, z, 0.8 * s);
  };

  lamp = (x: number, z: number, toward: 1 | -1) => {
    const { S, D } = this;
    S.seg(x, 0, z, x, 4.2, z, { over: 0.05 });
    S.seg(x - 0.12, 0, z, x + 0.12, 0, z);
    S.seg(x, 4.2, z, x, 4.3, z + toward * 0.9, { over: 0.03 });
    D.box(x, 3.95, z + toward * 0.9, 0.35, 0.3, 0.35);
    D.seg(x - 0.18, 3.95, z + toward * 0.9, x + 0.18, 3.95, z + toward * 0.9);
    this.col.circle(x, z, 0.15);
  };

  bench = (x: number, z: number, facing: Facing) => {
    const S = this.S;
    S.push(x, 0, z, FACING_ROT[facing]);
    S.box(0, 0.42, 0, 1.8, 0.07, 0.5);
    S.box(0, 0.55, -0.24, 1.8, 0.45, 0.06);
    for (const bx of [-0.8, 0.8]) {
      S.seg(bx, 0, 0.2, bx, 0.42, 0.2);
      S.seg(bx, 0, -0.22, bx, 0.42, -0.22);
    }
    S.pop();
    if (facing === '+z' || facing === '-z') this.col.box(x, z, 1.8, 0.55);
    else this.col.box(x, z, 0.55, 1.8);
  };

  car = (x: number, z: number, rot: number) => {
    const { S, D } = this;
    S.push(x, 0, z, rot);
    D.push(x, 0, z, rot);
    S.box(0, 0.3, 0, 3.9, 0.7, 1.7);
    S.box(-0.2, 1.0, 0, 2.1, 0.62, 1.5);
    for (const wx of [-1.25, 1.25]) {
      for (const wz of [-0.87, 0.87]) {
        S.circle(wx, 0.36, wz, 0.36, 'z', 16, 0.04);
        D.circle(wx, 0.36, wz, 0.12, 'z', 10, 0.05);
      }
    }
    for (const s of [-0.76, 0.76]) {
      D.poly([[-1.15, 1.08, s], [-0.3, 1.08, s], [-0.3, 1.52, s], [-1.0, 1.52, s]], true);
      D.poly([[-0.15, 1.08, s], [0.7, 1.08, s], [0.55, 1.52, s], [-0.15, 1.52, s]], true);
    }
    D.circle(1.96, 0.7, 0.55, 0.12, 'x', 10);
    D.circle(1.96, 0.7, -0.55, 0.12, 'x', 10);
    D.seg(-1.95, 0.45, -0.7, -1.95, 0.45, 0.7).seg(1.95, 0.45, -0.7, 1.95, 0.45, 0.7);
    for (const s of [-0.86, 0.86]) D.seg(-0.5, 0.85, s, -0.3, 0.85, s, { over: 0 }).seg(0.35, 0.85, s, 0.55, 0.85, s, { over: 0 });
    S.pop();
    D.pop();
    const along = Math.abs(Math.cos(rot)) > 0.5;
    if (along) this.col.box(x, z, 4, 1.8);
    else this.col.box(x, z, 1.8, 4);
  };

  building = (o: BuildingOpts) => {
    const { S, D } = this;
    const w = o.x1 - o.x0, d = o.z1 - o.z0, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    S.box(cx, 0, cz, w, o.h, d);
    if (!o.noCollider) this.col.rect(o.x0, o.z0, o.x1, o.z1);
    if (o.roof === 'gable') S.roof(cx, o.h, cz, w, d, Math.min(3.2, d * 0.35), 'x');
    else S.box(cx, o.h, cz, w + 0.3, 0.35, d + 0.3);

    const fz = o.face === '-z' ? o.z0 - 0.03 : o.z1 + 0.03;
    const bz = o.face === '-z' ? o.z1 + 0.03 : o.z0 - 0.03;
    const dx = o.door ?? cx;
    const dw = o.doorW ?? 1.3;
    D.rectV(dx - dw / 2, 0, fz, dw, 2.3, 'x');
    D.circle(dx + dw * 0.3, 1.1, fz, 0.05, 'z', 8);
    const floors = Math.max(1, Math.floor(o.h / 3));
    for (let f = 0; f < floors; f++) {
      const y = f === 0 ? 1.0 : 0.9 + f * 3;
      if (f === 0 && o.shopWindow) {
        const sw = Math.min(3.2, (w - dw) / 2 - 1.2);
        if (sw > 1) {
          D.window(o.x0 + 0.8, 0.8, fz, sw, 1.7, 'x', false);
          D.window(o.x1 - 0.8 - sw, 0.8, fz, sw, 1.7, 'x', false);
        }
        continue;
      }
      for (let x = o.x0 + 1.2; x + 1.2 < o.x1 - 0.6; x += 2.8) {
        if (f === 0 && Math.abs(x + 0.6 - dx) < dw) continue;
        D.window(x, y, fz, 1.2, 1.4, 'x');
      }
      for (let x = o.x0 + 2; x + 1.2 < o.x1 - 1; x += 4) D.window(x, y, bz, 1.2, 1.4, 'x');
      for (let z = o.z0 + 2; z + 1.2 < o.z1 - 1; z += 4) {
        D.window(o.x0 - 0.03, y, z, 1.2, 1.4, 'z');
        D.window(o.x1 + 0.03, y, z, 1.2, 1.4, 'z');
      }
    }
    if (o.sign) {
      const sw = o.signW ?? Math.min(w - 1, 6);
      this.sign(o.sign, dx, Math.min(o.h - 0.6, 3.0), fz + (o.face === '-z' ? -0.05 : 0.05), sw, sw * 0.22, o.face);
    }
  };

  // Cielo di giorno: sole con la faccina, nuvole, e all'orizzonte montagne o palazzi
  daySky = (horizon: 'mountains' | 'skyline' = 'mountains') => {
    const rr = this.rr;
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, depthWrite: false }));
    sun.scale.setScalar(26);
    sun.position.set(90, 85, -150);
    sun.renderOrder = -1;
    this.group.add(sun);
    for (let i = 0; i < 9; i++) {
      const cm = new THREE.SpriteMaterial({ map: cloudTexture(40 + i), fog: false, depthWrite: false, transparent: true });
      const c = new THREE.Sprite(cm);
      const a = (i / 9) * Math.PI * 2 + rr(-0.2, 0.2);
      const d = rr(170, 210);
      c.position.set(Math.cos(a) * d, rr(45, 75), Math.sin(a) * d);
      c.scale.set(rr(30, 45), rr(12, 16), 1);
      c.renderOrder = -1;
      this.group.add(c);
    }
    const far = new Sketch();
    far.style = { jitter: 0.5, over: 1 };
    if (horizon === 'mountains') {
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        const hgt = 8 + Math.abs(Math.sin(a * 5.3)) * 16 + Math.sin(a * 13.1) * 4 + rr(0, 3);
        pts.push([Math.cos(a) * 240, hgt, Math.sin(a) * 240]);
      }
      far.curve(pts);
      for (let i = 0; i < 30; i++) {
        const top = pts[Math.round((rr(0, Math.PI * 2) / (Math.PI * 2)) * 90)];
        far.seg(top[0], top[1] - 1, top[2], top[0] * 0.99, top[1] * 0.35, top[2] * 0.99, { over: 0 });
      }
    } else {
      // skyline: grattacieli lontani, solo contorni
      let a = 0;
      while (a < Math.PI * 2) {
        const w = rr(0.05, 0.11), h = rr(20, 60), d = 230;
        const x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, x1 = Math.cos(a + w) * d, z1 = Math.sin(a + w) * d;
        far.poly([[x0, 0, z0], [x0, h, z0], [x1, h, z1], [x1, 0, z1]]);
        for (let yy = 6; yy < h - 3; yy += rr(5, 8)) far.seg(x0, yy, z0, x1, yy, z1, { over: 0, jitter: 0.3 });
        a += w + rr(0, 0.03);
      }
    }
    const m = this.lineMat(1.6);
    m.fog = false;
    const g = far.build(m, this.fill);
    g.renderOrder = -1;
    this.group.add(g);
  };

  // --- interni --------------------------------------------------------------------

  // Muro sottile da (x0,z0) a (x1,z1), allineato a un asse, con collisione.
  wall = (x0: number, z0: number, x1: number, z1: number, h = 4, t = 0.25) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = alongX ? Math.abs(x1 - x0) : t;
    const d = alongX ? t : Math.abs(z1 - z0);
    this.S.box(cx, 0, cz, w, h, d);
    this.col.box(cx, cz, w, d);
  };

  // Muro con una porta (varco) centrata in "at", larga dw. Architrave sopra.
  wallDoor = (x0: number, z0: number, x1: number, z1: number, at: number, dw: number, h = 4, doorH = 2.5) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    if (alongX) {
      const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)];
      if (at - dw / 2 > a) this.wall(a, z0, at - dw / 2, z0, h);
      if (at + dw / 2 < b) this.wall(at + dw / 2, z0, b, z0, h);
      this.S.box(at, doorH, z0, dw, h - doorH, 0.25);
    } else {
      const [a, b] = [Math.min(z0, z1), Math.max(z0, z1)];
      if (at - dw / 2 > a) this.wall(x0, a, x0, at - dw / 2, h);
      if (at + dw / 2 < b) this.wall(x0, at + dw / 2, x0, b, h);
      this.S.box(x0, doorH, at, 0.25, h - doorH, dw);
    }
  };

  // Blocco pieno (mobili, banconi, casse...) con collisione. y = base.
  // low: nasconde alla vista delle guardie solo chi è accovacciato (casse, banconi)
  solid = (x: number, z: number, w: number, d: number, h: number, y = 0, collide = true, low = h < 1.5) => {
    this.S.box(x, y, z, w, h, d);
    if (collide) {
      const r = this.col.box(x, z, w, d);
      if (low) r.low = true;
      r.h = y + h; // per i colpi: sopra si passa
      return r;
    }
    return null;
  };

  // Tavolino rotondo
  roundTable = (x: number, z: number, r = 0.5) => {
    this.S.cylinder(x, 0.74, z, r, 0.05, 14);
    this.S.seg(x, 0, z, x, 0.74, z);
    this.S.seg(x - 0.3, 0, z, x + 0.3, 0, z);
    this.col.circle(x, z, r + 0.05);
  };

  stool = (x: number, z: number) => {
    this.S.cylinder(x, 0.7, z, 0.22, 0.06, 10);
    this.S.seg(x, 0, z, x, 0.7, z);
    this.D.circle(x, 0.3, z, 0.18, 'y', 10);
  };

  // Divanetto: schienale verso "facing" opposto (ci si siede guardando facing)
  sofa = (x: number, z: number, len: number, facing: Facing) => {
    const S = this.S;
    S.push(x, 0, z, FACING_ROT[facing]);
    S.box(0, 0, 0, len, 0.45, 0.8);
    S.box(0, 0.45, -0.32, len, 0.6, 0.16);
    S.box(-len / 2 + 0.1, 0.45, 0, 0.2, 0.25, 0.8);
    S.box(len / 2 - 0.1, 0.45, 0, 0.2, 0.25, 0.8);
    S.pop();
    const along = facing === '+z' || facing === '-z';
    this.col.box(x, z, along ? len : 0.8, along ? 0.8 : len).low = true;
  };

  // --- fine costruzione ------------------------------------------------------------
  finish(o: { isIndoor?: (p: THREE.Vector3) => boolean; fog?: [number, number]; mainWidth?: number } = {}): World {
    this.group.add(this.S.build(this.lineMat(o.mainWidth ?? 2.4), this.fill));
    this.group.add(this.D.build(this.lineMat(1.5), this.fill));
    this.group.add(this.G.build(this.lineMat(1.8), this.fill));
    const group = this.group;
    const mats = this.lineMats;
    return {
      group,
      colliders: this.col,
      anchors: this.anchors,
      props: this.props,
      isIndoor: o.isIndoor ?? (() => false),
      fog: o.fog ?? [30, 115],
      dispose: () => {
        disposeObject(group);
        for (const m of mats) releaseLineMaterial(m);
      },
    };
  }
}

// Libera geometrie, materiali e texture di un intero albero di oggetti.
// Gli oggetti con userData.shared (es. gli omini, che condividono geometrie) vengono saltati.
export function disposeObject(root: THREE.Object3D) {
  const visit = (o: THREE.Object3D) => {
    if (o.userData.shared) return;
    for (const c of o.children) visit(c);
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  };
  visit(root);
}
