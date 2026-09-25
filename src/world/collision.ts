import type * as THREE from 'three';

// Collisioni 2D sul piano XZ: il mondo è piatto, basta e avanza.
export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Circle { x: number; z: number; r: number }

export class Colliders {
  rects: Rect[] = [];
  circles: Circle[] = [];

  rect(x0: number, z0: number, x1: number, z1: number) {
    this.rects.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  // box centrato
  box(cx: number, cz: number, w: number, d: number) {
    this.rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
  }

  circle(x: number, z: number, r: number) {
    this.circles.push({ x, z, r });
  }

  resolve(p: THREE.Vector3, radius: number) {
    for (let iter = 0; iter < 2; iter++) {
      for (const r of this.rects) {
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
