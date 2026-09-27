import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Il tracciato del capitolo 6: una strada sola, dalla cima di Quadropoli a San Scarabocchio.
// Si descrive "a tartaruga" (tratti dritti e curve con la loro pendenza) e si campiona ogni metro.
// Tutto quello che sta sulla strada si misura in coordinate stradali:
//   s = metri percorsi dall'inizio, d = spostamento laterale (positivo = a sinistra).
// Direzione: heading th → (sin th, cos th) sul piano XZ; sinistra = (cos th, -sin th).
// ---------------------------------------------------------------------------

export interface Seg {
  len: number;
  turn?: number; // quanto gira in tutto il tratto (radianti, positivo = a sinistra)
  grade: number; // pendenza a fine raccordo (-0.1 = scende del 10%)
  hw?: number; // mezza larghezza percorribile (fino al marciapiede o al guardrail)
  ease?: number; // metri per passare dalla pendenza di prima a questa
  name?: string;
  open?: boolean; // tratto in campagna: guardrail e pendii invece delle case
}

export interface RoadPoint {
  x: number;
  z: number;
  y: number;
  th: number;
  grade: number;
  hw: number;
  curv: number; // curvatura (1/raggio), con segno
}

export class Road {
  readonly n: number;
  readonly x: Float64Array;
  readonly z: Float64Array;
  readonly y: Float64Array;
  readonly th: Float64Array;
  readonly grade: Float64Array;
  readonly hw: Float64Array;
  readonly curv: Float64Array;
  readonly open: Uint8Array;
  readonly sections: { name: string; s0: number; s1: number; open: boolean }[] = [];
  readonly length: number;

  constructor(start: { x: number; z: number; y: number; th: number }, segs: Seg[]) {
    const total = segs.reduce((a, s) => a + s.len, 0);
    const n = Math.round(total) + 1;
    this.n = n;
    this.length = n - 1;
    this.x = new Float64Array(n);
    this.z = new Float64Array(n);
    this.y = new Float64Array(n);
    this.th = new Float64Array(n);
    this.grade = new Float64Array(n);
    this.hw = new Float64Array(n);
    this.curv = new Float64Array(n);
    this.open = new Uint8Array(n);
    let x = start.x, z = start.z, y = start.y, th = start.th;
    let g = segs[0].grade;
    let i = 0;
    let s0 = 0;
    for (const sg of segs) {
      const k = (sg.turn ?? 0) / sg.len;
      const ease = Math.min(sg.len, sg.ease ?? 25);
      const g0 = g;
      const steps = Math.round(sg.len);
      for (let j = 0; j < steps && i < n; j++, i++) {
        g = j < ease ? g0 + (sg.grade - g0) * (j / ease) : sg.grade;
        this.x[i] = x;
        this.z[i] = z;
        this.y[i] = y;
        this.th[i] = th;
        this.grade[i] = g;
        this.hw[i] = sg.hw ?? 6;
        this.curv[i] = k;
        this.open[i] = sg.open ? 1 : 0;
        // un metro avanti, girando a metà passo (curva regolare)
        const mid = th + k * 0.5;
        x += Math.sin(mid);
        z += Math.cos(mid);
        y += g;
        th += k;
      }
      if (sg.name) this.sections.push({ name: sg.name, s0, s1: s0 + sg.len, open: !!sg.open });
      s0 += sg.len;
    }
    // ultimo punto
    const last = n - 1;
    this.x[last] = x;
    this.z[last] = z;
    this.y[last] = y;
    this.th[last] = th;
    this.grade[last] = g;
    this.hw[last] = this.hw[last - 1];
    this.curv[last] = 0;
    this.open[last] = this.open[last - 1];
    // la larghezza cambia gradualmente (niente scalini nei muri invisibili)
    const hw = Float64Array.from(this.hw);
    for (let j = 0; j < n; j++) {
      let sum = 0, cnt = 0;
      for (let q = Math.max(0, j - 6); q <= Math.min(n - 1, j + 6); q++) {
        sum += hw[q];
        cnt++;
      }
      this.hw[j] = sum / cnt;
    }
  }

  // punto della strada a s metri (interpolato)
  at(s: number): RoadPoint {
    const c = Math.max(0, Math.min(this.n - 1.0001, s));
    const i = Math.floor(c), t = c - i;
    const lerp = (a: Float64Array) => a[i] + (a[i + 1] - a[i]) * t;
    return { x: lerp(this.x), z: lerp(this.z), y: lerp(this.y), th: lerp(this.th), grade: lerp(this.grade), hw: lerp(this.hw), curv: this.curv[i] };
  }

  // punto nel mondo a (s, d), h metri sopra l'asfalto
  point(s: number, d: number, h = 0, out = new THREE.Vector3()) {
    const p = this.at(s);
    return out.set(p.x + Math.cos(p.th) * d, p.y + h, p.z - Math.sin(p.th) * d);
  }

  // Da posizione nel mondo a coordinate stradali. hint = indice vicino (per cercare solo lì attorno).
  project(x: number, z: number, hint = -1): { s: number; d: number; i: number } {
    let best = -1, bestD = Infinity;
    const from = hint < 0 ? 0 : Math.max(0, hint - 40);
    const to = hint < 0 ? this.n - 1 : Math.min(this.n - 1, hint + 40);
    for (let i = from; i <= to; i++) {
      const dx = x - this.x[i], dz = z - this.z[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) {
        bestD = d2;
        best = i;
      }
    }
    // rifinisce sul segmento verso il vicino giusto
    const i = best;
    const th = this.th[i];
    const fx = Math.sin(th), fz = Math.cos(th);
    const dx = x - this.x[i], dz = z - this.z[i];
    const along = dx * fx + dz * fz;
    const s = Math.max(0, Math.min(this.n - 1, i + along));
    const d = dx * Math.cos(th) - dz * Math.sin(th);
    return { s, d, i };
  }

  heightAt(x: number, z: number, hint = -1) {
    const p = this.project(x, z, hint);
    return this.at(p.s).y;
  }

  section(s: number) {
    return this.sections.find((q) => s >= q.s0 && s < q.s1)?.name ?? '';
  }
}

// ---------------------------------------------------------------------------
// Il percorso vero e proprio
// ---------------------------------------------------------------------------
export const ROAD_START = { x: 0, z: 6, y: 0, th: 0 };

export const SEGS: Seg[] = [
  { len: 32, grade: 0, hw: 6, name: 'piazza' },
  { len: 100, turn: -0.25, grade: -0.08, hw: 6.2, ease: 18, name: 'ripida' },
  { len: 70, turn: 0.45, grade: -0.1, hw: 6.2 },
  { len: 60, turn: -0.35, grade: -0.1, hw: 6.2 },
  { len: 40, grade: -0.025, hw: 7.4, open: true, name: 'piazzola' },
  { len: 30, grade: -0.08, hw: 5.3, open: true, name: 'tornanti' },
  { len: 44, turn: Math.PI, grade: -0.05, hw: 5.6, open: true },
  { len: 60, grade: -0.09, hw: 5.3, open: true },
  { len: 44, turn: -Math.PI, grade: -0.05, hw: 5.6, open: true },
  { len: 55, turn: 0.2, grade: -0.08, hw: 5.3, open: true },
  { len: 150, turn: -0.3, grade: -0.004, hw: 6.4, name: 'mercato' },
  { len: 80, grade: -0.015, hw: 5.2, open: true, name: 'ponte' },
  { len: 115, grade: 0.05, hw: 5.6, ease: 18, open: true, name: 'salita' },
  { len: 20, grade: 0, hw: 5.6, ease: 12, open: true, name: 'cresta' },
  { len: 110, turn: -0.5, grade: -0.11, hw: 5.6, open: true, name: 'discesa' },
  { len: 45, grade: -0.035, hw: 5.6, open: true, name: 'gregge' },
  { len: 60, turn: 0.8, grade: -0.09, hw: 5.6, open: true },
  { len: 60, turn: -0.7, grade: -0.09, hw: 5.6, open: true, name: 'cantiere' },
  { len: 70, grade: -0.03, hw: 7, name: 'arrivo' },
  { len: 55, grade: 0, hw: 7, ease: 20, name: 'fondo' },
];

export const ROAD = new Road(ROAD_START, SEGS);

// Punti notevoli (metri dall'inizio)
export const S = {
  car: 3, // dove è parcheggiata la macchina
  piazzaEnd: 32,
  barnie: 286, // l'autostoppista sulla piazzola
  tornanti: 304,
  mercato: 538,
  ponte: 686,
  salita: 766,
  cresta: 884,
  gregge: 1022,
  cantiere: 1128,
  arrivo: 1176,
  dario: 1222, // il pub, a destra
  fluo: 1266, // il Parallelepipedo, a sinistra: qui ci si ferma
  end: ROAD.length,
};
