import type * as THREE from 'three';

// Collisioni 2D sul piano XZ: il mondo è piatto, basta e avanza.
// lv: il piano a cui appartiene l'ostacolo (palazzi a più piani sovrapposti, capitolo 10): conta
// solo quando `Colliders.level` è quel piano. Senza lv vale per tutti i piani.
export interface Rect { x0: number; z0: number; x1: number; z1: number; noSight?: boolean; low?: boolean; h?: number; lv?: number }
export interface Circle { x: number; z: number; r: number; lv?: number }

export class Colliders {
  rects: Rect[] = [];
  circles: Circle[] = [];
  tag: number | undefined = undefined; // se impostato, i nuovi ostacoli appartengono a quel piano
  level = 0; // il piano su cui si sta (lo aggiorna il capitolo)

  // noSight: blocca il passaggio ma non la vista (es. banconi bassi, cordoni)
  rect(x0: number, z0: number, x1: number, z1: number, noSight = false) {
    const r: Rect = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) };
    if (noSight) r.noSight = true;
    if (this.tag !== undefined) r.lv = this.tag;
    this.rects.push(r);
    return r;
  }

  remove(r: Rect) {
    const i = this.rects.indexOf(r);
    if (i >= 0) this.rects.splice(i, 1);
  }

  // box centrato
  box(cx: number, cz: number, w: number, d: number, noSight = false) {
    return this.rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, noSight);
  }

  circle(x: number, z: number, r: number) {
    const c: Circle = { x, z, r };
    if (this.tag !== undefined) c.lv = this.tag;
    this.circles.push(c);
    return c;
  }

  removeCircle(c: Circle) {
    const i = this.circles.indexOf(c);
    if (i >= 0) this.circles.splice(i, 1);
  }

  // true se il segmento A→B attraversa un ostacolo (muri, mobili). Usato per la vista delle guardie.
  // Gli ostacoli "low" (casse, banconi) nascondono solo chi è accovacciato.
  blocked(ax: number, az: number, bx: number, bz: number, crouching = false, minSize = 0.2) {
    const dx = bx - ax, dz = bz - az;
    for (const r of this.rects) {
      if (r.lv !== undefined && r.lv !== this.level) continue;
      // ostacoli bassi o minuscoli (es. gambe dei tavoli) non contano
      if (r.x1 - r.x0 < minSize && r.z1 - r.z0 < minSize) continue;
      if (r.noSight || (r.low && !crouching)) continue;
      // slab test
      let t0 = 0, t1 = 1;
      const clip = (p: number, q: number) => {
        if (Math.abs(p) < 1e-9) return q >= 0;
        const t = q / p;
        if (p < 0) {
          if (t > t1) return false;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return false;
          if (t < t1) t1 = t;
        }
        return true;
      };
      if (clip(-dx, ax - r.x0) && clip(dx, r.x1 - ax) && clip(-dz, az - r.z0) && clip(dz, r.z1 - az) && t0 < t1 && t0 < 0.999 && t1 > 0.001) {
        // se partiamo da dentro l'ostacolo (es. guardia appoggiata) ignoriamolo
        if (!(ax > r.x0 && ax < r.x1 && az > r.z0 && az < r.z1)) return true;
      }
    }
    return false;
  }

  resolve(p: THREE.Vector3, radius: number) {
    for (let iter = 0; iter < 2; iter++) {
      for (const r of this.rects) {
        if (r.lv !== undefined && r.lv !== this.level) continue;
        if (p.x < r.x0 - radius || p.x > r.x1 + radius || p.z < r.z0 - radius || p.z > r.z1 + radius) continue;
        const cx = Math.max(r.x0, Math.min(p.x, r.x1));
        const cz = Math.max(r.z0, Math.min(p.z, r.z1));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          if (d < radius) {
            p.x += (dx / d) * (radius - d);
            p.z += (dz / d) * (radius - d);
          }
        } else {
          // dentro il rettangolo: esci dal lato più vicino
          const opts = [p.x - r.x0, r.x1 - p.x, p.z - r.z0, r.z1 - p.z];
          const m = Math.min(...opts);
          if (m === opts[0]) p.x = r.x0 - radius;
          else if (m === opts[1]) p.x = r.x1 + radius;
          else if (m === opts[2]) p.z = r.z0 - radius;
          else p.z = r.z1 + radius;
          dx = dz = 0;
        }
      }
      for (const c of this.circles) {
        if (c.lv !== undefined && c.lv !== this.level) continue;
        const dx = p.x - c.x, dz = p.z - c.z;
        const min = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (min - d);
          p.z += (dz / d) * (min - d);
        }
      }
    }
  }
}
