import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Sketch } from '../../render/sketch';
import { REFS9 } from './world';

// ---------------------------------------------------------------------------
// IL VASSOIO (capitolo 9): tre bicchieri d'acqua dal bancone al tavolo della squadra.
// Lo porti davanti a te, in equilibrio sul braccio (che è una linea). Il vassoio si inclina con le
// accelerazioni, le curve strette e il capogiro; oltre un certo punto l'acqua esce. Tenendo premuto
// PARA ti concentri: la visuale sta ferma e il vassoio anche. Bicchiere buono = almeno mezzo pieno.
// ---------------------------------------------------------------------------

export const GOOD = 0.5;
const SPILL_AT = 0.1;

export const TRAY = {
  held: false,
  levels: [1, 1, 1],
  tilt: new THREE.Vector2(), // x = di lato, y = avanti/indietro (radianti)
  group: null as THREE.Group | null,
  waters: [] as THREE.Mesh[],
  home: new THREE.Vector3(),
  lastPos: new THREE.Vector3(),
  lastVel: new THREE.Vector2(),
  acc: new THREE.Vector2(),
  lastYaw: 0,
  clinkT: 0,
  spilled: false, // ha appena perso acqua (per il messaggio)
};

const GLASSES: [number, number][] = [[-0.13, 0.05], [0.13, 0.05], [0, -0.1]];

export function setupTray(g: Game, home: THREE.Vector3) {
  const s = new Sketch();
  s.style = { jitter: 0.002, over: 0.006 };
  s.cylinder(0, 0, 0, 0.3, 0.02, 16);
  // i bicchieri: solo il contorno (trasparenti: si vede quanta acqua c'è)
  const glass = new Sketch();
  glass.style = { jitter: 0.002, over: 0.004 };
  for (const [x, z] of GLASSES) {
    glass.circle(x, 0.02, z, 0.05, 'y', 10).circle(x, 0.17, z, 0.056, 'y', 10);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      glass.seg(x + Math.cos(a) * 0.05, 0.02, z + Math.sin(a) * 0.05, x + Math.cos(a) * 0.056, 0.17, z + Math.sin(a) * 0.056);
    }
  }
  const grp = new THREE.Group();
  grp.add(s.build(REFS9.thin!, REFS9.fill!));
  grp.add(glass.build(REFS9.thin!, REFS9.fill!));
  const wm = new THREE.MeshBasicMaterial({ color: '#7fa9d6', transparent: true, opacity: 0.8 });
  TRAY.waters = GLASSES.map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.047, 1, 10).translate(0, 0.5, 0), wm);
    m.position.set(x, 0.025, z);
    grp.add(m);
    return m;
  });
  g.world.group.add(grp);
  TRAY.group = grp;
  TRAY.home.copy(home);
  TRAY.held = false;
  TRAY.levels = [1, 1, 1];
  place();
}

// il vassoio torna sul bancone, coi bicchieri pieni
export function resetTray() {
  TRAY.held = false;
  TRAY.levels = [1, 1, 1];
  place();
}

function place() {
  const grp = TRAY.group;
  if (!grp) return;
  grp.position.copy(TRAY.home);
  grp.rotation.set(0, 0, 0);
  TRAY.waters.forEach((w, i) => (w.scale.y = Math.max(0.001, TRAY.levels[i] * 0.12)));
}

export function pickTray(g: Game) {
  const p = g.player;
  TRAY.held = true;
  TRAY.levels = [1, 1, 1];
  TRAY.tilt.set(0, 0);
  TRAY.lastPos.copy(p.pos);
  TRAY.lastVel.set(0, 0);
  TRAY.acc.set(0, 0);
  TRAY.lastYaw = p.yaw;
  p.carrying = true;
  p.setCrouch(false);
}

export function dropTray(g: Game) {
  TRAY.held = false;
  g.player.carrying = false;
  g.player.speedMul = 1;
}

export const goodGlasses = () => TRAY.levels.filter((l) => l >= GOOD).length;

export function updateTray(g: Game, dt: number) {
  const grp = TRAY.group;
  if (!grp || !TRAY.held || dt <= 0) return;
  const p = g.player;
  // col vassoio si va piano (concentrati, ancora più piano)
  p.speedMul = 0.75 - 0.25 * p.steady;
  // accelerazione (sul piano) e velocità di rotazione; un salto di posizione (ti hanno spostato) non conta
  if (Math.hypot(p.pos.x - TRAY.lastPos.x, p.pos.z - TRAY.lastPos.z) > 1) {
    TRAY.lastPos.copy(p.pos);
    TRAY.lastVel.set(0, 0);
  }
  const vx = (p.pos.x - TRAY.lastPos.x) / dt, vz = (p.pos.z - TRAY.lastPos.z) / dt;
  TRAY.lastPos.copy(p.pos);
  const ax = (vx - TRAY.lastVel.x) / dt, az = (vz - TRAY.lastVel.y) / dt;
  TRAY.lastVel.set(vx, vz);
  // un salto di posizione (teletrasporto, muro) non è un'accelerazione vera: si limita
  TRAY.acc.lerp(new THREE.Vector2(Math.max(-30, Math.min(30, ax)), Math.max(-30, Math.min(30, az))), Math.min(1, dt * 10));
  let dy = p.yaw - TRAY.lastYaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  TRAY.lastYaw = p.yaw;
  const yawRate = dy / dt;
  // nel riferimento del vassoio: avanti e destra
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  const aF = TRAY.acc.x * fx + TRAY.acc.y * fz;
  const aR = TRAY.acc.x * rx + TRAY.acc.y * rz;
  const speed = Math.hypot(vx, vz);
  const d = p.dizzy * (1 - 0.8 * p.steady) * (0.55 + 0.45 * Math.min(1, speed / 2.5)); // da fermi si tiene meglio
  const t = g.time;
  const wobX = d * (0.09 * Math.sin(t * 1.9) + 0.05 * Math.sin(t * 3.7 + 1));
  const wobY = d * (0.07 * Math.sin(t * 1.4 + 2) + 0.04 * Math.sin(t * 4.1));
  const tx = -aR * 0.025 - yawRate * (0.02 + speed * 0.025) + wobX;
  const ty = aF * 0.025 + wobY;
  TRAY.tilt.x += (tx - TRAY.tilt.x) * Math.min(1, dt * 7);
  TRAY.tilt.y += (ty - TRAY.tilt.y) * Math.min(1, dt * 7);
  const mag = TRAY.tilt.length();
  if (mag > SPILL_AT) {
    const loss = (mag - SPILL_AT) * 3.2 * dt;
    // esce di più dal bicchiere che sta dalla parte bassa
    GLASSES.forEach(([gx, gz], i) => {
      const low = 1 + Math.max(0, (gx * Math.sign(TRAY.tilt.x) - gz * Math.sign(TRAY.tilt.y)) * 5);
      TRAY.levels[i] = Math.max(0, TRAY.levels[i] - loss * low);
    });
    TRAY.spilled = true;
  }
  TRAY.clinkT -= dt;
  if (mag > 0.1 && TRAY.clinkT <= 0) {
    g.audio.clink(Math.min(1, mag * 4));
    TRAY.clinkT = 0.35 + Math.random() * 0.4;
  }
  // davanti a te, all'altezza del petto (non segue lo sguardo in su e in giù)
  const e = p.eye;
  grp.position.set(e.x + fx * 0.8, e.y - 0.5, e.z + fz * 0.8);
  grp.rotation.set(0, 0, 0);
  grp.rotateY(p.yaw);
  grp.rotateX(-TRAY.tilt.y);
  grp.rotateZ(-TRAY.tilt.x);
  TRAY.waters.forEach((w, i) => (w.scale.y = Math.max(0.001, TRAY.levels[i] * 0.12)));
}

// quanto è pieno il vassoio, per il riquadro in alto
export const trayText = () =>
  TRAY.levels.map((l) => `<b>${l >= GOOD ? Math.round(l * 100) + '%' : '<s>vuoto</s>'}</b>`).join(' · ');
