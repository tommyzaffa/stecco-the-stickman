import * as THREE from 'three';
import type { Game } from './game';
import type { NPC } from '../entities/npc';
import { splatTexture } from '../render/textures';
import { Stickman } from '../entities/stickman';

// ---------------------------------------------------------------------------
// Armi da fuoco (dal capitolo 4). Colpi istantanei lungo un raggio che si ferma
// su muri, persone e pavimento; scie, macchie d'inchiostro e linee di mira dei nemici.
// ---------------------------------------------------------------------------

export const CLIP_SIZE = 8;
export const PISTOL_DMG = 34;
const RANGE = 45;

export interface RayHit {
  t: number;
  point: THREE.Vector3;
  npc: NPC | null;
  target: Target | null;
  kind: 'npc' | 'target' | 'wall' | 'floor' | 'none';
  normal?: THREE.Vector3; // per le macchie sui muri
}

// Qualcosa a cui si può sparare che non è una persona (sagome del poligono, barili...)
export interface Target {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
  alive: () => boolean;
  hit: (point: THREE.Vector3) => void;
}

export const PLAYER_INK = '#2f4bd8';

interface Streak {
  mesh: THREE.Mesh;
  life: number;
}

const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5); // da z=0 a z=1
const SPLAT_GEO = new THREE.PlaneGeometry(1, 1);

export class Guns {
  private splats: THREE.Mesh[] = [];
  private splatMats = new Map<string, THREE.MeshBasicMaterial[]>();
  private streaks: Streak[] = [];
  private aimLines = new Map<NPC, THREE.Mesh>();
  private group = new THREE.Group();
  private _p = new THREE.Vector3();
  targets: Target[] = [];

  ceiling = Infinity; // soffitto (al chiuso i colpi si fermano lì)

  constructor(private g: Game) {
    g.scene.add(this.group);
  }

  // cancella tutto (cambio capitolo)
  clear() {
    for (const s of this.splats) this.group.remove(s);
    for (const s of this.streaks) this.group.remove(s.mesh);
    for (const m of this.aimLines.values()) this.group.remove(m);
    this.splats = [];
    this.streaks = [];
    this.aimLines.clear();
    this.targets = [];
  }

  // Raggio da origin lungo dir (normalizzata). Salta chi spara (ignore).
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, ignore: NPC | null = null, maxT = RANGE): RayHit {
    const col = this.g.world.colliders;
    const p = this._p;
    const step = 0.15;
    for (let t = 0.3; t < maxT; t += step) {
      p.copy(origin).addScaledVector(dir, t);
      if (p.y <= 0.02) return { t, point: p.clone().setY(0.03), npc: null, target: null, kind: 'floor', normal: new THREE.Vector3(0, 1, 0) };
      if (p.y >= this.ceiling) return { t, point: p.clone().setY(this.ceiling - 0.03), npc: null, target: null, kind: 'wall', normal: new THREE.Vector3(0, -1, 0) };
      for (const n of this.g.npcs) {
        if (n === ignore || n.hidden || n.fighter?.ko) continue;
        const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
        const r = 0.36 * (n.body instanceof Stickman ? n.body.body.scale.x : 1);
        if (dx * dx + dz * dz < r * r && p.y > n.pos.y && p.y < n.topY + 0.2) return { t, point: p.clone(), npc: n, target: null, kind: 'npc' };
      }
      for (const tg of this.targets) {
        if (!tg.alive()) continue;
        const dx = p.x - tg.x, dz = p.z - tg.z;
        if (dx * dx + dz * dz < tg.r * tg.r && p.y > tg.y0 && p.y < tg.y1) return { t, point: p.clone(), npc: null, target: tg, kind: 'target' };
      }
      const back = () => origin.clone().addScaledVector(dir, t - step * 0.5);
      for (const r of col.rects) {
        if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && p.y < (r.h ?? Infinity) && !r.noSight) {
          const b = back();
          // da che lato siamo entrati?
          const n = new THREE.Vector3();
          if (b.y >= (r.h ?? Infinity)) n.set(0, 1, 0);
          else if (b.x <= r.x0) n.set(-1, 0, 0);
          else if (b.x >= r.x1) n.set(1, 0, 0);
          else if (b.z <= r.z0) n.set(0, 0, -1);
          else n.set(0, 0, 1);
          // la macchia sta sulla superficie
          if (n.x) b.x = n.x < 0 ? r.x0 - 0.02 : r.x1 + 0.02;
          else if (n.z) b.z = n.z < 0 ? r.z0 - 0.02 : r.z1 + 0.02;
          else b.y = (r.h ?? 0) + 0.02;
          return { t, point: b, npc: null, target: null, kind: 'wall', normal: n };
        }
      }
      for (const c of col.circles) {
        const dx = p.x - c.x, dz = p.z - c.z;
        if (dx * dx + dz * dz < c.r * c.r && p.y < 4) {
          const n = new THREE.Vector3(dx, 0, dz).normalize();
          return { t, point: new THREE.Vector3(c.x + n.x * (c.r + 0.02), p.y, c.z + n.z * (c.r + 0.02)), npc: null, target: null, kind: 'wall', normal: n };
        }
      }
    }
    return { t: maxT, point: origin.clone().addScaledVector(dir, maxT), npc: null, target: null, kind: 'none' };
  }

  // Sparo del giocatore
  playerShoot() {
    const g = this.g;
    const pl = g.player;
    const dir = pl.forward.normalize();
    const hit = this.raycast(pl.eye, dir);
    pl.camera.updateMatrixWorld();
    this.streak(pl.muzzle(), hit.point, PLAYER_INK, 0.012);
    g.audio.gunshot();
    if (hit.kind === 'npc' && hit.npc) {
      g.shootNpc(hit.npc, hit.point);
    } else if (hit.kind === 'target' && hit.target) {
      hit.target.hit(hit.point);
      g.hud.hitMark();
      g.audio.hitMark();
    } else if (hit.kind !== 'none') {
      this.splat(hit.point, PLAYER_INK, hit.normal);
      g.audio.splat(hit.point);
    }
  }

  // Sparo di un nemico: colpisce o manca in base a movimento, copertura, distanza
  enemyShoot(n: NPC, accuracy: number, dmg: number, color: string) {
    const g = this.g;
    const pl = g.player;
    const from = n.pos.clone().setY(n.pos.y + 1.35);
    const target = pl.eye.add(new THREE.Vector3(0, -0.35, 0));
    const d = from.distanceTo(target);
    const col = g.world.colliders;
    // un muro vero in mezzo: il colpo si ferma lì
    const wall = col.blocked(from.x, from.z, target.x, target.z, false, 0.2);
    // riparato dietro una cassa, accovacciato
    const covered = !wall && pl.crouching && col.blocked(from.x, from.z, target.x, target.z, true, 0.2);
    let p = accuracy;
    if (pl.speed > 5) p -= 0.4;
    else if (pl.speed > 0) p -= 0.22;
    p -= Math.max(0, d - 8) * 0.025;
    if (covered) p = 0.04;
    const hits = !wall && Math.random() < p;
    g.audio.enemyShot(from);
    g.hud.popWord(from.clone().add(new THREE.Vector3(0, 0.3, 0)), pl.camera, 'PLOC!');
    if (hits) {
      this.streak(from, target, color, 0.02);
      g.shootPlayer(dmg, n, color);
      return;
    }
    // mancato: il colpo finisce da qualche parte vicino a te
    const miss = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.3) * 1.2, (Math.random() - 0.5) * 2.2));
    const dir = miss.sub(from).normalize();
    const res = this.raycast(from, dir, n);
    this.streak(from, res.point, color, 0.02);
    if (res.kind === 'wall' || res.kind === 'floor') this.splat(res.point, color, res.normal);
    if (res.kind === 'npc' && res.npc && res.npc !== n) res.npc.say(['Ehi! Attenti!', 'Mi hai colorato!', 'Non sono io il bersaglio!'][Math.floor(Math.random() * 3)], 2);
    // ti è passato vicino?
    const closest = new THREE.Line3(from, res.point).closestPointToPoint(pl.eye, true, new THREE.Vector3());
    if (closest.distanceTo(pl.eye) < 1.5) g.audio.whiz();
  }

  // Linea di mira di un nemico (0 = spenta). Si vede crescere mentre carica il colpo.
  aim(n: NPC, amount: number, color = '#ff3b3b') {
    let m = this.aimLines.get(n);
    if (amount <= 0) {
      if (m) m.visible = false;
      return;
    }
    if (!m) {
      m = new THREE.Mesh(UNIT_CYL, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, fog: false }));
      m.renderOrder = 5;
      this.group.add(m);
      this.aimLines.set(n, m);
    }
    const from = n.pos.clone().setY(n.pos.y + 1.35);
    const eye = this.g.player.eye.add(new THREE.Vector3(0, -0.35, 0));
    // la linea si ferma un po' prima di te: da vicino coprirebbe mezzo schermo
    const d = from.distanceTo(eye);
    const to = from.clone().lerp(eye, Math.max(0.2, (d - 1.6) / d));
    this.placeCyl(m, from, to, 0.008 + amount * 0.01);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.15 + amount * 0.6 * (0.7 + 0.3 * Math.sin(this.g.time * 30));
    m.visible = true;
  }

  private placeCyl(m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, r: number) {
    m.position.copy(from);
    m.lookAt(to);
    m.scale.set(r, r, from.distanceTo(to));
  }

  private streak(from: THREE.Vector3, to: THREE.Vector3, color: string, r: number) {
    const m = new THREE.Mesh(UNIT_CYL, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    this.placeCyl(m, from, to, r);
    this.group.add(m);
    this.streaks.push({ mesh: m, life: 0.09 });
  }

  // macchia d'inchiostro dove arriva il colpo (appiccicata alla superficie)
  splat(point: THREE.Vector3, color: string, normal?: THREE.Vector3, size = 0.3 + Math.random() * 0.2) {
    let mats = this.splatMats.get(color);
    if (!mats) {
      mats = [0, 1, 2].map((i) => new THREE.MeshBasicMaterial({ map: splatTexture(color, 70 + i), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      this.splatMats.set(color, mats);
    }
    const m = new THREE.Mesh(SPLAT_GEO, mats[Math.floor(Math.random() * mats.length)]);
    m.scale.setScalar(size);
    m.position.copy(point);
    const nrm = normal ?? this.g.player.eye.sub(point).normalize();
    m.lookAt(point.clone().add(nrm));
    m.rotateZ(Math.random() * Math.PI * 2);
    m.renderOrder = 3;
    this.group.add(m);
    this.splats.push(m);
    if (this.splats.length > 80) this.group.remove(this.splats.shift()!);
  }

  update(dt: number) {
    for (const s of this.streaks) {
      s.life -= dt;
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / 0.09);
    }
    for (const s of this.streaks.filter((s) => s.life <= 0)) {
      this.group.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.streaks = this.streaks.filter((s) => s.life > 0);
    for (const [n, m] of this.aimLines) {
      if (n.hidden || n.fighter?.ko || !n.fighter?.hostile) m.visible = false;
    }
  }
}
