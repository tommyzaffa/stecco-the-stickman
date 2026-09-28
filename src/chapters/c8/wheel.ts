import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Stickman } from '../../entities/stickman';
import { FOUNTAIN, REFS8, WHEEL } from './world';

// ---------------------------------------------------------------------------
// LA RUOTA PANORAMICA: gira sempre, piano. Quando ci sali (con Martina) la tua cabina parte
// dal basso, sale fino in cima e lì si ferma ("si è inceppata"): il momento del tappo.
// Da lassù si vede la piazza intera, e si vede un pezzo di piazza che sparisce (la fontana):
// un foglio bianco che si allarga, strofinando, e poi si richiude. La fontana torna, ma
// ridisegnata: tre zampilli invece di quattro. Restano le briciole rosa.
// ---------------------------------------------------------------------------

const TOP = Math.PI / 2, BOTTOM = -Math.PI / 2;
const RIDE_SPEED = 0.3;

export const RIDE = {
  angle: 0, // rotazione della ruota
  cabin: -1, // la tua cabina (-1 = non sei sulla ruota)
  phase: 'idle' as 'idle' | 'up' | 'top' | 'down',
  onTop: null as (() => void) | null,
  onEnd: null as (() => void) | null,
  eraseT: -1, // la cancellatura (secondi da quando è cominciata)
  erased: false,
  time: 0,
};

export function setupWheel() {
  RIDE.angle = 0;
  RIDE.cabin = -1;
  RIDE.phase = 'idle';
  RIDE.eraseT = -1;
  RIDE.erased = false;
}

const cabinAngle = (i: number) => RIDE.angle + (i / WHEEL.n) * Math.PI * 2;
export function cabinPos(i: number, out = new THREE.Vector3()) {
  const a = cabinAngle(i);
  return out.set(WHEEL.x + Math.cos(a) * WHEEL.r, WHEEL.y + Math.sin(a) * WHEEL.r, WHEEL.z);
}

// sali: la cabina più in basso diventa la tua, e parte
export function startRide(g: Game, onTop: () => void, onEnd: () => void) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < WHEEL.n; i++) {
    const d = Math.abs(Math.atan2(Math.sin(cabinAngle(i) - BOTTOM), Math.cos(cabinAngle(i) - BOTTOM)));
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  RIDE.cabin = best;
  RIDE.angle = BOTTOM - (best / WHEEL.n) * Math.PI * 2;
  RIDE.phase = 'up';
  RIDE.onTop = onTop;
  RIDE.onEnd = onEnd;
  const p = g.player;
  p.seated = true;
  g.hideNameTags = true;
  g.interactOff = true;
  g.touchMode = { fire: null, use: null, jump: null, crouch: null };
  const m = g.npc('martina');
  m.setBehavior({ type: 'sit' });
  m.homeRot = 0;
  m.body.root.rotation.y = 0;
  placeRiders(g);
  // si guarda verso la piazza
  p.setLook(new THREE.Vector3(FOUNTAIN.x, 2, FOUNTAIN.z + 8));
  g.audio.playMusic('giostra');
  g.audio.creak();
}

// tu a sinistra, Martina a destra, sulla panca in fondo alla cabina
function placeRiders(g: Game) {
  const c = cabinPos(RIDE.cabin);
  const floor = c.y - WHEEL.drop;
  const p = g.player;
  p.floor = floor;
  p.pos.set(c.x - 0.5, floor, c.z - 0.25);
  p.vy = 0;
  // la visuale segue la cabina in questo stesso frame (il giocatore si è già mosso prima)
  p.camera.position.set(p.pos.x, floor + 1.15, p.pos.z);
  g.npc('martina').pos.set(c.x + 0.55, floor, c.z - 0.38);
}

function endRide(g: Game) {
  const p = g.player;
  p.seated = false;
  p.floor = 0;
  g.hideNameTags = false;
  g.interactOff = false;
  g.touchMode = null;
  RIDE.cabin = -1;
  RIDE.phase = 'idle';
  const cb = RIDE.onEnd;
  RIDE.onEnd = null;
  cb?.();
}

export function updateWheel(g: Game, dt: number) {
  RIDE.time += dt;
  if (RIDE.phase === 'idle') RIDE.angle += 0.1 * dt;
  else if (RIDE.phase === 'up') {
    RIDE.angle += RIDE_SPEED * dt;
    if (cabinAngle(RIDE.cabin) >= TOP) {
      RIDE.angle = TOP - (RIDE.cabin / WHEEL.n) * Math.PI * 2;
      RIDE.phase = 'top';
      g.audio.creak();
      const cb = RIDE.onTop;
      RIDE.onTop = null;
      cb?.();
    }
  } else if (RIDE.phase === 'down') {
    RIDE.angle += RIDE_SPEED * 1.4 * dt;
    if (cabinAngle(RIDE.cabin) >= BOTTOM + Math.PI * 2) {
      RIDE.angle = BOTTOM - (RIDE.cabin / WHEEL.n) * Math.PI * 2;
      endRide(g);
    }
  }
  if (REFS8.wheel) REFS8.wheel.rotation.z = RIDE.angle;
  const tmp = new THREE.Vector3();
  REFS8.cabins.forEach((c, i) => {
    c.position.copy(cabinPos(i, tmp));
    // le cabine dondolano un po' (la tua meno: si sta seduti)
    c.rotation.z = Math.sin(RIDE.time * 1.3 + i) * (i === RIDE.cabin ? 0.01 : 0.035);
  });
  if (RIDE.cabin >= 0) placeRiders(g);
  updateErase(g, dt);
}

// dalla cima si riparte (dopo il tappo e dopo la fontana)
export function rideDown(g: Game) {
  if (RIDE.phase !== 'top') return;
  RIDE.phase = 'down';
  g.audio.creak();
  g.audio.playMusic('giostra');
}

// =========================================================================
// UN PEZZO DI PIAZZA CHE SPARISCE
// =========================================================================
export function startErase(g: Game) {
  if (RIDE.eraseT >= 0 || RIDE.erased) return;
  RIDE.eraseT = 0;
  g.audio.stopMusic();
  g.audio.erase(1.4);
  g.after(1.0, () => g.audio.erase(1.2));
  g.after(2.0, () => g.audio.erase(0.8));
}

function updateErase(g: Game, dt: number) {
  if (RIDE.eraseT < 0) return;
  RIDE.eraseT += dt;
  const t = RIDE.eraseT;
  const blank = REFS8.blank!;
  blank.visible = true;
  const ease = (k: number) => k * k * (3 - 2 * k);
  let s: number;
  if (t < 1.6) s = ease(t / 1.6);
  else if (t < 4.2) s = 1;
  else s = 1 - ease(Math.min(1, (t - 4.2) / 1.4));
  // il bordo della cancellatura "trema": si allarga a strappi, come una gomma che strofina
  blank.scale.setScalar(Math.max(0.001, s * (1 + Math.sin(t * 23) * 0.015)));
  if (t > 0.9 && REFS8.fountainA!.visible) {
    REFS8.fountainA!.visible = false;
    REFS8.crumbs!.visible = true;
  }
  if (t > 4.4 && !REFS8.fountainB!.visible) {
    REFS8.fountainB!.visible = true;
    g.audio.glow();
  }
  if (t > 5.7) {
    blank.visible = false;
    RIDE.eraseT = -1;
    RIDE.erased = true;
  }
}

// alla fine del capitolo (o saltando): la fontana ridisegnata e le briciole, senza animazione
export function setErased() {
  RIDE.erased = true;
  REFS8.fountainA!.visible = false;
  REFS8.fountainB!.visible = true;
  REFS8.crumbs!.visible = true;
}

// Martina seduta accanto: guarda la piazza (o te)
export function martinaLooks(g: Game, atPlayer: boolean) {
  const m = g.npc('martina');
  if (m.body instanceof Stickman) m.homeRot = atPlayer ? -Math.PI / 2 : 0;
}
