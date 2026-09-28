import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INK, PAPER, THEME, rng } from './palette';
import { VIEW } from '../view';

// ---------------------------------------------------------------------------
// Materiali
// ---------------------------------------------------------------------------

const lineMaterials: LineMaterial[] = [];

export function makeLineMaterial(width: number, color?: THREE.ColorRepresentation): LineMaterial {
  const m = new LineMaterial({ color: color ?? INK.clone(), linewidth: width, worldUnits: false });
  m.fog = true;
  m.resolution.set(VIEW.w, VIEW.h);
  lineMaterials.push(m);
  return m;
}

export function releaseLineMaterial(m: LineMaterial) {
  const i = lineMaterials.indexOf(m);
  if (i >= 0) lineMaterials.splice(i, 1);
  m.dispose();
}

export function setLineResolution(w: number, h: number) {
  for (const m of lineMaterials) m.resolution.set(w, h);
}

// Riempimento "carta" con tratteggio a matita sulle facce in ombra.
// Il tratteggio è in coordinate mondo, così resta "disegnato" sull'oggetto.
export function makeHatchMaterial(opts: { density?: number; strength?: number } = {}) {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uPaper: { value: PAPER.clone() },
        uInk: { value: INK.clone() },
        uLight: { value: new THREE.Vector3(0.55, 0.75, 0.35).normalize() },
        uDensity: { value: opts.density ?? 8 },
        uStrength: { value: opts.strength ?? 0.55 },
        uGrid: { value: THEME.grid?.size ?? 0 },
        uGridColor: { value: new THREE.Color(THEME.grid?.color ?? '#000000') },
        uGridMajor: { value: THEME.grid?.major ?? 0 },
        uGridRows: { value: THEME.grid?.rows ? 1 : 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPaper;
      uniform vec3 uInk;
      uniform vec3 uLight;
      uniform float uDensity;
      uniform float uStrength;
      uniform float uGrid;
      uniform vec3 uGridColor;
      uniform float uGridMajor;
      uniform float uGridRows;
      varying vec3 vN;
      varying vec3 vW;
      #include <fog_pars_fragment>

      float hatch(float c, float width) {
        float d = abs(fract(c) - 0.5);
        float aa = fwidth(c) * 1.2;
        float line = smoothstep(0.5 - width - aa, 0.5 - width + aa, d);
        // oltre una certa distanza le linee diventano un grigio uniforme
        return mix(line, width * 2.0, clamp(aa * 1.5, 0.0, 1.0));
      }

      void main() {
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float l = dot(n, uLight) * 0.5 + 0.5;
        vec3 an = abs(n);
        vec2 p = an.y > max(an.x, an.z) ? vW.xz : (an.x > an.z ? vW.zy : vW.xy);
        // piccola ondulazione: sembra fatto a mano
        float wob = sin(p.y * 2.3 + p.x * 0.7) * 0.18;
        float ink = 0.0;
        if (l < 0.6) ink = max(ink, hatch((p.x + p.y) * uDensity + wob, 0.09) * smoothstep(0.6, 0.5, l));
        if (l < 0.33) ink = max(ink, hatch((p.x - p.y) * uDensity + wob, 0.08) * smoothstep(0.33, 0.25, l));
        vec3 base = uPaper;
        if (uGrid > 0.0) {
          // quadretti: linee sottili ogni uGrid metri, che sfumano da lontano
          vec2 g = p / uGrid;
          vec2 w = fwidth(g);
          vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-4));
          // quaderno a righe: solo le righe "orizzontali" (per terra lungo z, sui muri in altezza)
          if (uGridRows > 0.5) d.x = 1e4;
          float line = 1.0 - clamp(min(d.x, d.y) - 0.3, 0.0, 1.0);
          float fade = 1.0 - clamp(max(w.x, w.y) * 3.0, 0.0, 1.0);
          float a = line * fade * (uGridMajor > 0.0 ? 0.4 : 0.8);
          if (uGridMajor > 0.0) {
            // carta millimetrata: ogni N righe una più marcata, che si vede anche da lontano
            vec2 G = p / (uGrid * uGridMajor);
            vec2 W = fwidth(G);
            vec2 D = abs(fract(G - 0.5) - 0.5) / max(W, vec2(1e-4));
            float L = 1.0 - clamp(min(D.x, D.y) - 0.7, 0.0, 1.0);
            float F = 1.0 - clamp(max(W.x, W.y) * 2.5, 0.0, 1.0);
            a = max(a, L * F * 0.85);
          }
          base = mix(base, uGridColor, a);
        }
        gl_FragColor = vec4(mix(base, uInk, ink * uStrength), 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

// ---------------------------------------------------------------------------
// Sketch: accumula linee e riempimenti, poi li unisce in pochi draw call.
// ---------------------------------------------------------------------------

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

export interface InkStyle {
  jitter?: number; // imprecisione del tratto (metri)
  over?: number; // quanto la linea "sborda" oltre gli angoli (metri)
}

export class Sketch {
  private pos: number[] = [];
  private fills: THREE.BufferGeometry[] = [];
  private stack: THREE.Matrix4[] = [];
  private m = new THREE.Matrix4();
  style: Required<InkStyle> = { jitter: 0.025, over: 0.14 };

  // --- trasformazioni -------------------------------------------------------
  push(x = 0, y = 0, z = 0, rotY = 0, scale = 1) {
    this.stack.push(this.m.clone());
    const t = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(scale, scale, scale),
    );
    this.m.multiply(t);
    return this;
  }
  pop() {
    this.m = this.stack.pop() ?? new THREE.Matrix4();
    return this;
  }

  // --- linee -------------------------------------------------------------------
  seg(ax: number, ay: number, az: number, bx: number, by: number, bz: number, style?: InkStyle) {
    const j = style?.jitter ?? this.style.jitter;
    const o = style?.over ?? this.style.over;
    _a.set(ax, ay, az).applyMatrix4(this.m);
    _b.set(bx, by, bz).applyMatrix4(this.m);
    _d.subVectors(_b, _a);
    const len = _d.length();
    if (len < 1e-5) return this;
    _d.divideScalar(len);
    const oa = Math.min(o * (0.2 + rng() * 0.9), len * 0.25);
    const ob = Math.min(o * (0.2 + rng() * 0.9), len * 0.25);
    this.pos.push(
      _a.x - _d.x * oa + (rng() - 0.5) * j,
      _a.y - _d.y * oa + (rng() - 0.5) * j,
      _a.z - _d.z * oa + (rng() - 0.5) * j,
      _b.x + _d.x * ob + (rng() - 0.5) * j,
      _b.y + _d.y * ob + (rng() - 0.5) * j,
      _b.z + _d.z * ob + (rng() - 0.5) * j,
    );
    return this;
  }

  line(a: THREE.Vector3Like, b: THREE.Vector3Like, style?: InkStyle) {
    return this.seg(a.x, a.y, a.z, b.x, b.y, b.z, style);
  }

  poly(pts: [number, number, number][], closed = false, style?: InkStyle) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      this.seg(p[0], p[1], p[2], q[0], q[1], q[2], style);
    }
    if (closed && pts.length > 2) {
      const p = pts[pts.length - 1], q = pts[0];
      this.seg(p[0], p[1], p[2], q[0], q[1], q[2], style);
    }
    return this;
  }

  // Poligono "morbido": niente sbordature, per curve e cerchi.
  curve(pts: [number, number, number][], closed = false) {
    return this.poly(pts, closed, { over: 0, jitter: this.style.jitter * 0.5 });
  }

  circle(cx: number, cy: number, cz: number, r: number, axis: 'x' | 'y' | 'z' = 'y', segs = 20, wobble = 0.04) {
    const pts: [number, number, number][] = [];
    const start = rng() * Math.PI * 2;
    const turns = 1.08; // come un cerchio fatto a mano: chiude un po' oltre
    for (let i = 0; i <= segs * turns; i++) {
      const t = start + (i / segs) * Math.PI * 2;
      const rr = r * (1 + (rng() - 0.5) * wobble);
      const u = Math.cos(t) * rr, v = Math.sin(t) * rr;
      if (axis === 'y') pts.push([cx + u, cy, cz + v]);
      else if (axis === 'x') pts.push([cx, cy + u, cz + v]);
      else pts.push([cx + u, cy + v, cz]);
    }
    return this.curve(pts);
  }

  dashed(ax: number, ay: number, az: number, bx: number, by: number, bz: number, dash = 1, gap = 1) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const step = dash + gap;
    for (let t = 0; t < len; t += step) {
      const t1 = Math.min(t + dash, len);
      this.seg(ax + (dx * t) / len, ay + (dy * t) / len, az + (dz * t) / len,
        ax + (dx * t1) / len, ay + (dy * t1) / len, az + (dz * t1) / len, { over: 0 });
    }
    return this;
  }

  // Rettangolo su una faccia verticale (finestre, porte, cartelli).
  // (x, y, z) = angolo in basso a sinistra, lungo l'asse "along", alto h.
  rectV(x: number, y: number, z: number, w: number, h: number, along: 'x' | 'z') {
    const ux = along === 'x' ? w : 0, uz = along === 'z' ? w : 0;
    return this.poly([[x, y, z], [x + ux, y, z + uz], [x + ux, y + h, z + uz], [x, y + h, z]], true);
  }

  window(x: number, y: number, z: number, w: number, h: number, along: 'x' | 'z', cross = true) {
    this.rectV(x, y, z, w, h, along);
    if (cross) {
      const ux = along === 'x' ? w : 0, uz = along === 'z' ? w : 0;
      this.seg(x + ux / 2, y, z + uz / 2, x + ux / 2, y + h, z + uz / 2, { over: 0.02 });
      this.seg(x, y + h / 2, z, x + ux, y + h / 2, z + uz, { over: 0.02 });
    }
    // davanzale
    const ux = along === 'x' ? w : 0, uz = along === 'z' ? w : 0;
    const ox = along === 'x' ? 0.15 : 0, oz = along === 'z' ? 0.15 : 0;
    this.seg(x - ox, y - 0.08, z - oz, x + ux + ox, y - 0.08, z + uz + oz, { over: 0.05 });
    return this;
  }

  // --- solidi --------------------------------------------------------------------
  private addFill(g: THREE.BufferGeometry, local?: THREE.Matrix4) {
    const geo = g.index ? g.toNonIndexed() : g;
    const clean = new THREE.BufferGeometry();
    clean.setAttribute('position', geo.getAttribute('position').clone());
    clean.setAttribute('normal', geo.getAttribute('normal').clone());
    const mat = local ? this.m.clone().multiply(local) : this.m;
    clean.applyMatrix4(mat);
    this.fills.push(clean);
    g.dispose();
  }

  boxEdges(x: number, y: number, z: number, w: number, h: number, d: number) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    for (const yy of [y, y1]) {
      this.seg(x0, yy, z0, x1, yy, z0).seg(x1, yy, z0, x1, yy, z1)
        .seg(x1, yy, z1, x0, yy, z1).seg(x0, yy, z1, x0, yy, z0);
    }
    this.seg(x0, y, z0, x0, y1, z0).seg(x1, y, z0, x1, y1, z0)
      .seg(x1, y, z1, x1, y1, z1).seg(x0, y, z1, x0, y1, z1);
    return this;
  }

  // Box pieno con bordi a inchiostro. y = base.
  box(x: number, y: number, z: number, w: number, h: number, d: number, edges = true) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y + h / 2, z);
    this.addFill(g);
    if (edges) this.boxEdges(x, y, z, w, h, d);
    return this;
  }

  // Tetto a due falde: il colmo corre lungo "ridge". y = base del tetto.
  roof(x: number, y: number, z: number, w: number, d: number, h: number, ridge: 'x' | 'z', overhang = 0.4) {
    const W = w + overhang * 2, D = d + overhang * 2;
    const shape = new THREE.Shape();
    const span = ridge === 'x' ? D : W;
    const len = ridge === 'x' ? W : D;
    shape.moveTo(-span / 2, 0);
    shape.lineTo(span / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    if (ridge === 'x') g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    this.addFill(g);
    // bordi
    const ex = ridge === 'x' ? len / 2 : span / 2;
    const ez = ridge === 'x' ? span / 2 : len / 2;
    if (ridge === 'x') {
      for (const sx of [-ex, ex]) this.poly([[x + sx, y, z - ez], [x + sx, y + h, z], [x + sx, y, z + ez]], true);
      this.seg(x - ex, y + h, z, x + ex, y + h, z);
      this.seg(x - ex, y, z - ez, x + ex, y, z - ez).seg(x - ex, y, z + ez, x + ex, y, z + ez);
      // tegole: qualche linea parallela al colmo
      for (let i = 1; i < 4; i++) {
        const f = i / 4;
        for (const s of [-1, 1]) this.dashed(x - ex, y + h * f, z + s * ez * (1 - f), x + ex, y + h * f, z + s * ez * (1 - f), 2.2, 0.6);
      }
    } else {
      for (const sz of [-ez, ez]) this.poly([[x - ex, y, z + sz], [x, y + h, z + sz], [x + ex, y, z + sz]], true);
      this.seg(x, y + h, z - ez, x, y + h, z + ez);
      this.seg(x - ex, y, z - ez, x - ex, y, z + ez).seg(x + ex, y, z - ez, x + ex, y, z + ez);
      for (let i = 1; i < 4; i++) {
        const f = i / 4;
        for (const s of [-1, 1]) this.dashed(x + s * ex * (1 - f), y + h * f, z - ez, x + s * ex * (1 - f), y + h * f, z + ez, 2.2, 0.6);
      }
    }
    return this;
  }

  cylinder(x: number, y: number, z: number, r: number, h: number, segs = 14, edges = true) {
    const g = new THREE.CylinderGeometry(r, r, h, segs);
    g.translate(x, y + h / 2, z);
    this.addFill(g);
    if (edges) {
      this.circle(x, y, z, r, 'y', segs + 4, 0.02);
      this.circle(x, y + h, z, r, 'y', segs + 4, 0.02);
      // "silhouette" finta: due linee verticali ai lati, come farebbe un disegnatore
      for (const a of [0.3, 0.3 + Math.PI]) {
        this.seg(x + Math.cos(a) * r, y, z + Math.sin(a) * r, x + Math.cos(a) * r, y + h, z + Math.sin(a) * r, { over: 0.03 });
      }
    }
    return this;
  }

  // Aggiunge una geometria qualsiasi con i suoi spigoli.
  geometry(g: THREE.BufferGeometry, threshold = 30) {
    const e = new THREE.EdgesGeometry(g, threshold);
    const p = e.getAttribute('position');
    for (let i = 0; i < p.count; i += 2) {
      this.seg(p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), { over: 0.03 });
    }
    e.dispose();
    this.addFill(g);
    return this;
  }

  // --- output ------------------------------------------------------------------
  build(lineMat: LineMaterial, fillMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    if (this.fills.length) {
      const merged = mergeGeometries(this.fills, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, fillMat);
        group.add(mesh);
      }
      for (const f of this.fills) f.dispose();
    }
    if (this.pos.length) {
      const lg = new LineSegmentsGeometry();
      lg.setPositions(this.pos);
      const lines = new LineSegments2(lg, lineMat);
      lines.computeLineDistances();
      group.add(lines);
    }
    this.pos = [];
    this.fills = [];
    return group;
  }
}
