import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { Stickman } from '../../entities/stickman';
import { Sketch } from '../../render/sketch';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { keyName } from '../../settings';
import { floorAt, FURNITURE_AT, VAN } from './world';

// ---------------------------------------------------------------------------
// PORTARE I MOBILI (capitolo 7). Tu tieni un capo, Marco l'altro.
// Il mobile sta davanti a te e gira con la visuale: la sua sagoma a terra (rettangoli, anche a L)
// non passa attraverso i muri. Se una mossa lo farebbe entrare in un muro, si prova a scivolare
// (solo avanti, solo di lato, solo girare); se non va, resta com'era. Le ringhiere basse non
// contano: il mobile ci passa sopra. Il divano si può mettere in piedi (più corto, più lento).
// Arrivati al furgone, il mobile va sistemato nel cassone (pack.ts).
// ---------------------------------------------------------------------------

export type FurnId = 'poltrona' | 'scala' | 'armadio' | 'divano';
type R4 = [number, number, number, number]; // x0, z0, x1, z1 (locali: +z = davanti a te, +x = a sinistra)

export interface Furniture {
  id: FurnId;
  name: string; // "la poltrona"
  rects: R4[];
  upRects?: R4[]; // in piedi (solo il divano)
  speed: number;
  group: THREE.Group; // perno (dove sei tu) con imbardata e inclinazione
  flipG: THREE.Group; // girato dall'altro capo ("cambia capo")
  upG: THREE.Group; // in piedi (solo il divano)
  model: THREE.Group;
  flipped: boolean;
  colliders: import('../../world/collision').Rect[];
  state: 'home' | 'carried' | 'van';
  up: boolean;
}

const NEAR = 0.3; // il mobile comincia a 30 cm da te
export const FURN: Record<FurnId, Omit<Furniture, 'group' | 'flipG' | 'upG' | 'model' | 'colliders' | 'state' | 'up' | 'flipped'>> = {
  poltrona: { id: 'poltrona', name: 'la poltrona', rects: [[-0.45, NEAR, 0.45, NEAR + 0.9]], speed: 0.8 },
  scala: { id: 'scala', name: 'la scala', rects: [[-0.21, NEAR, 0.21, NEAR + 2.6]], speed: 0.75 },
  armadio: { id: 'armadio', name: "l'armadio a L", rects: [[-0.32, NEAR, 0.32, NEAR + 1.8], [0.32, NEAR + 1.2, 0.9, NEAR + 1.8]], speed: 0.62 },
  divano: {
    id: 'divano',
    name: 'il divano',
    rects: [[-0.45, NEAR, 0.45, NEAR + 2.2], [0.45, NEAR + 1.55, 1.05, NEAR + 2.2]],
    upRects: [[-0.45, NEAR, 0.45, NEAR + 0.9]],
    speed: 0.62,
  },
};

// --- modelli (a inchiostro, coordinate locali: y = 0 all'altezza delle mani) ---
function drawModel(id: FurnId, lm: LineMaterial, fill: THREE.Material) {
  const s = new Sketch();
  s.style = { jitter: 0.012, over: 0.05 };
  const z0 = NEAR;
  if (id === 'poltrona') {
    s.box(0, -0.35, z0 + 0.45, 0.85, 0.42, 0.85);
    s.box(0, 0.07, z0 + 0.84, 0.85, 0.55, 0.12);
    for (const x of [-0.42, 0.42]) s.box(x, 0.07, z0 + 0.45, 0.1, 0.28, 0.85);
  } else if (id === 'scala') {
    for (const x of [-0.18, 0.18]) s.box(x, -0.03, z0 + 1.3, 0.05, 0.06, 2.6);
    for (let z = z0 + 0.15; z < z0 + 2.6; z += 0.3) s.seg(-0.18, 0, z, 0.18, 0, z, { over: 0.02 });
  } else if (id === 'armadio') {
    // sdraiato sulla schiena: lungo, con il pezzo ad angolo in fondo a destra
    s.box(0, -0.3, z0 + 0.9, 0.62, 0.55, 1.8);
    s.box(0.61, -0.3, z0 + 1.5, 0.58, 0.55, 0.6);
    s.seg(0, 0.25, z0 + 0.1, 0, 0.25, z0 + 1.7, { over: 0 });
    for (const z of [z0 + 0.8, z0 + 1.0]) s.circle(0.1 * (z > z0 + 0.9 ? 1 : -1), 0.26, z, 0.03, 'y', 6);
  } else {
    // divano con la penisola a destra (si piega solo da quella parte)
    s.box(0, -0.35, z0 + 1.1, 0.9, 0.42, 2.2);
    s.box(-0.38, 0.07, z0 + 1.1, 0.14, 0.45, 2.2);
    for (const z of [z0 + 0.05, z0 + 2.15]) s.box(0, 0.07, z, 0.9, 0.22, 0.1);
    s.box(0.75, -0.35, z0 + 1.875, 0.6, 0.42, 0.65);
    for (const z of [z0 + 0.75, z0 + 1.45]) s.seg(-0.3, 0.08, z, 0.45, 0.08, z, { over: 0 });
  }
  return s.build(lm, fill);
}

// =========================================================================
// STATO
// =========================================================================
export const CARRY = {
  items: {} as Record<FurnId, Furniture>,
  current: null as Furniture | null,
  prev: { x: 0, z: 0, yaw: 0, pen: 0 },
  bumpT: 0,
  scratches: 0,
  lastSpeed: 0,
  stuckT: 0,
  stuckAt: { x: 0, z: 0 },
  stuckHint: false,
  onArrive: null as ((g: Game, f: Furniture) => void) | null,
};

export function setupFurniture(g: Game, lm: LineMaterial, fill: THREE.Material) {
  CARRY.current = null;
  CARRY.scratches = 0;
  for (const id of Object.keys(FURN) as FurnId[]) {
    const def = FURN[id];
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    const flipG = new THREE.Group();
    const upG = new THREE.Group();
    const model = drawModel(id, lm, fill);
    group.add(flipG);
    flipG.add(upG);
    upG.add(model);
    g.world.group.add(group);
    const f: Furniture = { ...def, rects: def.rects, group, flipG, upG, model, colliders: [], state: 'home', up: false, flipped: false };
    CARRY.items[id] = f;
    placeHome(g, f);
  }
}

// a riposo, a casa di Nonna Pina: il mobile appoggiato per terra, con la sua collisione
function placeHome(g: Game, f: Furniture) {
  const at = FURNITURE_AT[f.id];
  // il gruppo usa come "perno" il punto dove staresti tu: lo mettiamo in modo che il mobile sia centrato su "at"
  const c = center(f.rects);
  const yaw = at.rot;
  const left = new THREE.Vector2(-Math.cos(yaw), Math.sin(yaw));
  const fwd = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
  const px = at.x - left.x * c.x - fwd.x * c.z, pz = at.z - left.y * c.x - fwd.y * c.z;
  f.group.position.set(px, floorAt(at.x, at.z) + 0.45, pz);
  f.group.rotation.set(0, yaw + Math.PI, 0);
  f.flipG.rotation.set(0, 0, 0);
  f.flipG.position.set(0, 0, 0);
  f.upG.rotation.set(0, 0, 0);
  f.upG.position.set(0, 0, 0);
  for (const r of worldRects(f.rects, px, pz, yaw)) {
    const rect = g.world.colliders.rect(r.x0, r.z0, r.x1, r.z1);
    f.colliders.push(rect);
  }
}

// i rettangoli di adesso: in piedi o sdraiato, e girati se hai cambiato capo
function eff(f: Furniture): R4[] {
  const rs = f.up && f.upRects ? f.upRects : f.rects;
  if (!f.flipped) return rs;
  const zs = NEAR + Math.max(...rs.map((r) => r[3]));
  return rs.map(([a, b, c, d]) => [-c, zs - d, -a, zs - b] as R4);
}

const center = (rs: R4[]) => {
  const r = rs[0];
  return { x: (r[0] + r[2]) / 2, z: (r[1] + r[3]) / 2 };
};

// rettangoli locali → rettangoli nel mondo allineati agli assi (per le rotazioni multiple di 90°)
function worldRects(rs: R4[], px: number, pz: number, yaw: number) {
  const out: { x0: number; z0: number; x1: number; z1: number }[] = [];
  for (const [a, b, c, d] of rs) {
    const pts = [[a, b], [c, b], [c, d], [a, d]].map(([lx, lz]) => toWorld(lx, lz, px, pz, yaw));
    out.push({ x0: Math.min(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), z1: Math.max(...pts.map((p) => p.y)) });
  }
  return out;
}

// locale → mondo, con il giocatore in (px, pz) che guarda con "yaw". Locale: z davanti, x A SINISTRA
// (è come ruota il gruppo del disegno, con yaw + PI: così quello che vedi è quello che sbatte)
function toWorld(lx: number, lz: number, px: number, pz: number, yaw: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new THREE.Vector2(px - c * lx - s * lz, pz + s * lx - c * lz);
}

// =========================================================================
// SOLLEVARE E PORTARE
// =========================================================================
export function lift(g: Game, id: FurnId) {
  const f = CARRY.items[id];
  if (CARRY.current || f.state !== 'home') return;
  for (const r of f.colliders) g.world.colliders.remove(r);
  f.colliders = [];
  f.state = 'carried';
  f.up = false;
  f.flipped = false;
  CARRY.current = f;
  CARRY.stuckT = 0;
  CARRY.stuckHint = false;
  const p = g.player;
  // ti metti dove serve per prenderlo per un capo: il perno diventa la tua posizione
  const piv = f.group.position;
  p.pos.set(piv.x, p.pos.y, piv.z);
  p.yaw = f.group.rotation.y - Math.PI;
  p.carrying = true;
  p.speedMul = f.speed;
  CARRY.prev = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, pen: penetration(g, f, p.pos.x, p.pos.z, p.yaw) };
  const m = g.npc('marco');
  m.controlled = true;
  g.touchMode = { fire: null, use: 'GIRA', jump: f.upRects ? 'ALZA' : null, crouch: 'POSA' };
  g.interactOff = true;
}

// "Posa": il mobile torna al suo posto in casa (per ricominciare da capo)
export function putBack(g: Game, f: Furniture) {
  f.state = 'home';
  f.up = false;
  f.flipped = false;
  placeHome(g, f);
  release(g);
  g.npc('marco').say('Rimesso a posto. Come se non fosse successo niente. Il muro però se lo ricorda.', 3.5);
  g.audio.bump(0.4);
}

function release(g: Game) {
  CARRY.current = null;
  const p = g.player;
  p.carrying = false;
  p.speedMul = 1;
  g.touchMode = null;
  g.interactOff = false;
  const m = g.npc('marco');
  m.controlled = false;
  if (m.body instanceof Stickman) m.body.action = 'none';
}

// il mobile è nel cassone: sparisce dalla scena, Marco torna libero
export function stow(g: Game, f: Furniture) {
  f.state = 'van';
  f.group.visible = false;
  release(g);
}

// quanto il mobile è "dentro" i muri (somma delle sovrapposizioni minime): 0 = libero
function penetration(g: Game, f: Furniture, px: number, pz: number, yaw: number) {
  const rs = eff(f);
  const col = g.world.colliders;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ux = -c, uz = s; // x locale: a sinistra
  const vx = -s, vz = -c; // davanti
  let pen = 0;
  for (const [a, b, cc, d] of rs) {
    const hx = (cc - a) / 2, hz = (d - b) / 2;
    const lcx = (a + cc) / 2, lcz = (b + d) / 2;
    const ox = px + ux * lcx + vx * lcz, oz = pz + uz * lcx + vz * lcz;
    const ex = Math.abs(ux) * hx + Math.abs(vx) * hz, ez = Math.abs(uz) * hx + Math.abs(vz) * hz; // mezzo ingombro AABB
    for (const r of col.rects) {
      if (r.low) continue; // ringhiere, tavoli, letti: il mobile ci passa sopra
      if (ox + ex < r.x0 || ox - ex > r.x1 || oz + ez < r.z0 || oz - ez > r.z1) continue;
      // SAT: assi del mondo e assi del mobile
      const rcx = (r.x0 + r.x1) / 2, rcz = (r.z0 + r.z1) / 2, rhx = (r.x1 - r.x0) / 2, rhz = (r.z1 - r.z0) / 2;
      const dx = rcx - ox, dz = rcz - oz;
      let m = Infinity;
      const axis = (ax: number, az: number, ha: number) => {
        const projB = rhx * Math.abs(ax) + rhz * Math.abs(az);
        const o = ha + projB - Math.abs(dx * ax + dz * az);
        if (o < m) m = o;
      };
      axis(1, 0, ex);
      axis(0, 1, ez);
      axis(ux, uz, hx);
      axis(vx, vz, hz);
      if (m > 0) pen += m;
    }
    for (const ci of col.circles) {
      const dx = ci.x - ox, dz = ci.z - oz;
      const lx = Math.max(-hx, Math.min(hx, dx * ux + dz * uz)), lz = Math.max(-hz, Math.min(hz, dx * vx + dz * vz));
      const qx = ox + ux * lx + vx * lz, qz = oz + uz * lx + vz * lz;
      const dd = Math.hypot(ci.x - qx, ci.z - qz);
      if (dd < ci.r) pen += ci.r - dd;
    }
  }
  return pen;
}

// Chiamato a ogni frame DOPO il movimento del giocatore: se il mobile finirebbe nel muro, si torna indietro
export function updateCarry(g: Game, dt: number) {
  const f = CARRY.current;
  CARRY.bumpT = Math.max(0, CARRY.bumpT - dt);
  if (!f) return;
  const p = g.player;
  const pv = CARRY.prev;
  // alza / abbassa il divano
  if (f.upRects && g.input.wasPressed('jump') && !g.dialogue.isOpen) toggleUp(g, f);
  if (g.input.wasPressed('interact') && !g.dialogue.isOpen) swapEnds(g, f);
  if (g.input.wasPressed('crouch') && !g.dialogue.isOpen) return putBack(g, f);
  // incastrati da un po': Marco suggerisce di ricominciare
  CARRY.stuckT = Math.hypot(p.pos.x - CARRY.stuckAt.x, p.pos.z - CARRY.stuckAt.z) > 1 ? 0 : CARRY.stuckT + dt;
  if (CARRY.stuckT === 0) CARRY.stuckAt = { x: p.pos.x, z: p.pos.z };
  if (CARRY.stuckT > 20 && !CARRY.stuckHint) {
    CARRY.stuckHint = true;
    g.npc('marco').say('Siamo incastrati. Lo rimettiamo giù e riproviamo?', 4);
    g.toast(`Incastrati? <b>${keyName('crouch')}</b>: rimettete il mobile al suo posto e riprovate. (O cambiate capo: <b>${keyName('interact')}</b>.)`, 'info', 7000);
  }

  const nx = p.pos.x, nz = p.pos.z, nyaw = p.yaw;
  const eps = 0.003;
  const tries: [number, number, number][] = [
    [nx, nz, nyaw],
    [nx, nz, pv.yaw],
    [pv.x, pv.z, nyaw],
    [nx, pv.z, pv.yaw],
    [pv.x, nz, pv.yaw],
    [pv.x, pv.z, pv.yaw],
  ];
  let ok = tries[tries.length - 1];
  let okPen = pv.pen;
  for (const t of tries) {
    const pen = penetration(g, f, t[0], t[1], t[2]);
    if (pen <= pv.pen + eps) {
      ok = t;
      okPen = pen;
      break;
    }
  }
  const blocked = ok[0] !== nx || ok[1] !== nz || ok[2] !== nyaw;
  if (blocked) {
    const moved = Math.hypot(nx - pv.x, nz - pv.z) / Math.max(dt, 1e-3) + Math.abs(nyaw - pv.yaw) * 2 / Math.max(dt, 1e-3);
    if (moved > 2.2 && CARRY.bumpT <= 0) bump(g, f);
    p.pos.x = ok[0];
    p.pos.z = ok[1];
    p.yaw = ok[2];
    p.camera.position.x = p.pos.x;
    p.camera.position.z = p.pos.z;
    p.camera.rotation.y = p.yaw;
  }
  CARRY.prev = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, pen: okPen };
  CARRY.lastSpeed = p.speed;
  place(g, f);
  // arrivati al furgone
  const c = center(eff(f));
  const w = toWorld(c.x, c.z, p.pos.x, p.pos.z, p.yaw);
  if (Math.hypot(w.x - VAN.rear.x, w.y - VAN.rear.z) < 3.4 && !g.dialogue.isOpen) CARRY.onArrive?.(g, f);
}

function toggleUp(g: Game, f: Furniture) {
  const p = g.player;
  const was = f.up;
  f.up = !f.up;
  const pen = penetration(g, f, p.pos.x, p.pos.z, p.yaw);
  if (pen > CARRY.prev.pen + 0.003) {
    f.up = was;
    g.npc('marco').say('Non c\'è spazio per girarlo!', 2);
    return;
  }
  CARRY.prev.pen = pen;
  p.speedMul = f.speed * (f.up ? 0.7 : 1);
  g.npc('marco').say(f.up ? pick(['In piedi! Pesa il doppio! Non so perché!', 'Su! Su! Occhio al lampadario!']) : pick(['Giù! Piano!', 'Sdraiato. Come piace a me.']), 2);
  g.audio.bump(0.4);
}

// mobile e Marco al loro posto (altezze delle scale comprese)
function place(g: Game, f: Furniture) {
  const p = g.player;
  const rs = eff(f);
  const len = Math.max(...rs.map((r) => r[3]));
  const far = toWorld(0, len, p.pos.x, p.pos.z, p.yaw);
  const yNear = floorAt(p.pos.x, p.pos.z) + 0.8;
  const yFar = floorAt(far.x, far.y) + 0.8;
  f.group.position.set(p.pos.x, yNear, p.pos.z);
  f.group.rotation.set(Math.atan2(yNear - yFar, len), p.yaw + Math.PI, 0);
  // in piedi: il divano si alza sulla sua testata (appoggiato per terra, davanti a te)
  f.upG.rotation.set(f.up ? -Math.PI / 2 : 0, 0, 0);
  f.upG.position.set(0, f.up ? -0.8 - NEAR : 0, f.up ? NEAR + 0.5 : 0);
  // girato: specchio rispetto al centro (è lo stesso mobile, visto dall'altro capo)
  const zs = NEAR + len;
  f.flipG.rotation.set(0, f.flipped ? Math.PI : 0, 0);
  f.flipG.position.set(0, 0, f.flipped ? zs : 0);
  // Marco all'altro capo, che ti guarda (e cammina all'indietro)
  const m = g.npc('marco');
  const mp = toWorld(0, len + 0.35, p.pos.x, p.pos.z, p.yaw);
  m.controlled = true;
  m.pos.set(mp.x, floorAt(mp.x, mp.y), mp.y);
  m.body.root.rotation.y = p.yaw;
  m.ctrlSpeed = p.speed > 0.1 ? p.speed : 0;
  if (m.body instanceof Stickman) {
    m.body.action = 'push';
    m.body.seated = false;
  }
}

// "Cambia capo": tu vai dove sta Marco e lui dove stavi tu. Il mobile resta dov'è.
function swapEnds(g: Game, f: Furniture) {
  const p = g.player;
  const rs = eff(f);
  const zs = NEAR + Math.max(...rs.map((r) => r[3]));
  const np = toWorld(0, zs, p.pos.x, p.pos.z, p.yaw);
  // c'è posto per te dall'altra parte?
  const test = new THREE.Vector3(np.x, 0, np.y);
  const before = test.clone();
  g.world.colliders.resolve(test, p.radius);
  if (test.distanceTo(before) > 0.05) {
    g.npc('marco').say('Di qua non c\'è posto per te!', 2);
    g.audio.miss();
    return;
  }
  f.flipped = !f.flipped;
  p.pos.x = np.x;
  p.pos.z = np.y;
  p.yaw += Math.PI;
  CARRY.prev = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, pen: penetration(g, f, p.pos.x, p.pos.z, p.yaw) };
  g.npc('marco').say(pick(['Scambio! Io davanti, tu dietro. Cioè al contrario.', 'Cambio capo! Adesso comando io. No.', 'Giro io! Cioè, giri tu.']), 2);
  g.audio.tick();
}

function bump(g: Game, f: Furniture) {
  CARRY.bumpT = 0.7;
  CARRY.scratches++;
  g.audio.bump(0.7);
  g.player.knock.set(0, 0, 0);
  const m: NPC = g.npc('marco');
  m.say(pick(['PIVOT!', 'Piano!', 'Il mio dito!', 'Gira! Dall\'altra parte!', 'Era il muro portante?', 'Nonna Pina non lo deve sapere.', 'Indietro, indietro!', 'Storto! Più storto!']), 1.8);
  if (CARRY.scratches === 1) g.toast(`Sbatte! Torna un po' indietro e giralo, o cambia capo con Marco (<b>${keyName('interact')}</b>).${f.upRects ? ` Il divano si può mettere in piedi: <b>${keyName('jump')}</b>.` : ''}`, 'info', 5000);
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
