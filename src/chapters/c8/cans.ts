import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Sketch } from '../../render/sketch';
import { CERA, THEME } from '../../render/palette';
import { TOUCH } from '../../touch';
import { CANS, REFS8 } from './world';
import { dots, finishBooth, fireName, type Booth } from './booth';

// ---------------------------------------------------------------------------
// TIRO AI BARATTOLI (i Pastelli a Cera): sei barattoli a piramide su una mensola, tre palline
// di carta appallottolata. La pallina parte dove guardi e scende (gravità): si mira un po' sopra.
// I barattoli sono corpi veri (più o meno): li colpisci, volano, cadono; chi sta sopra un
// barattolo che se ne va cade anche lui. Contano quelli finiti giù dalla mensola.
// Quello di mezzo in basso è incollato (missione "Il barattolo incollato"), finché c'è la colla.
// ---------------------------------------------------------------------------

const BALL_R = 0.075, CAN_R = 0.1, CAN_H = 0.24, SPEED = 12.5, GRAV = 9.8, BALLS = 3;
const HALF = CAN_H / 2 - CAN_R * 0.35; // semiasse della "capsula" con cui si calcolano gli urti
const SHELF = { hx: 0.35, hz: 0.65 };
const BACK_X = CANS.x - 0.55; // il telo in fondo alla bancarella
const SIDE_Z = 1.6; // i teli di lato

interface Can {
  g: THREE.Group;
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  w: THREE.Vector3;
  home: THREE.Vector3;
  dyn: boolean;
  glued: boolean;
  supports: number[];
  down: boolean;
  rest: number;
}
interface Ball {
  m: THREE.Object3D;
  p: THREE.Vector3;
  v: THREE.Vector3;
  t: number;
  tonked: boolean;
}

const S = {
  cans: [] as Can[],
  balls: [] as Ball[],
  left: BALLS,
  cd: 0,
  endT: -1,
  done: false,
  hand: null as THREE.Object3D | null,
  preview: [] as THREE.Mesh[],
  ballModel: null as THREE.Group | null,
  glued: true,
  hits: 0,
};

// un barattolo: latta a inchiostro con la fascia colorata (è dei Pastelli)
function canModel(color: string) {
  const s = new Sketch();
  s.style = { jitter: 0.004, over: 0.015 };
  s.geometry(new THREE.CylinderGeometry(CAN_R, CAN_R, CAN_H, 14), 30);
  for (const z of [-CAN_R, CAN_R]) s.seg(0, -CAN_H / 2, z, 0, CAN_H / 2, z, { over: 0 });
  s.circle(0, CAN_H / 2 - 0.02, 0, CAN_R * 0.8, 'y', 12, 0.02);
  const g = new THREE.Group();
  g.add(s.build(REFS8.thin!, REFS8.fill!));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(CAN_R * 1.03, CAN_R * 1.03, 0.08, 14, 1, true), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  g.add(band);
  return g;
}

// pallina di carta appallottolata: poliedro storto
function ballModel() {
  const s = new Sketch();
  s.style = { jitter: 0.004, over: 0.01 };
  const geo = new THREE.IcosahedronGeometry(BALL_R, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.85 + ((i * 37) % 7) * 0.05), pos.getY(i) * (0.85 + ((i * 11) % 5) * 0.06), pos.getZ(i));
  s.geometry(geo, 10);
  const g = new THREE.Group();
  g.add(s.build(REFS8.thin!, REFS8.fill!));
  return g;
}

// i barattoli sulla mensola ci sono sempre (anche quando nessuno gioca)
export function setupCans(g: Game) {
  S.cans = [];
  const colors = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.viola, '#e8c93a'];
  const layout: [number, number, number[]][] = [
    [0, -0.22, []], [0, 0, []], [0, 0.22, []],
    [1, -0.11, [0, 1]], [1, 0.11, [1, 2]],
    [2, 0, [3, 4]],
  ];
  layout.forEach(([row, dz, sup], i) => {
    const home = new THREE.Vector3(CANS.x, CANS.y + CAN_H / 2 + row * CAN_H, CANS.z + dz);
    const m = canModel(colors[i]);
    g.world.group.add(m);
    S.cans.push({ g: m, p: home.clone(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), home, dyn: false, glued: false, supports: sup, down: false, rest: 0 });
  });
  // il modello della pallina (le copie condividono geometria e materiali): sta nel mondo, così si libera con lui
  S.ballModel = ballModel();
  S.ballModel.visible = false;
  g.world.group.add(S.ballModel);
  S.balls = [];
  S.preview = [];
  S.hand = null;
  resetCans(true);
}

function resetCans(glued: boolean) {
  S.cans.forEach((c, i) => {
    c.p.copy(c.home);
    c.v.set(0, 0, 0);
    c.w.set(0, 0, 0);
    c.q.identity();
    c.dyn = false;
    c.down = false;
    c.rest = 0;
    c.glued = glued && i === 1;
    c.g.position.copy(c.p);
    c.g.quaternion.copy(c.q);
  });
}

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), axis = new THREE.Vector3();

// punto dell'asse del barattolo più vicino a p
function closestOnCan(c: Can, p: THREE.Vector3, out: THREE.Vector3) {
  axis.set(0, 1, 0).applyQuaternion(c.q);
  const t = Math.max(-HALF, Math.min(HALF, tmp2.copy(p).sub(c.p).dot(axis)));
  return out.copy(c.p).addScaledVector(axis, t);
}

// metà dell'altezza del barattolo in verticale (dritto: 12 cm; sdraiato: 10)
function halfY(c: Can) {
  axis.set(0, 1, 0).applyQuaternion(c.q);
  const ay = Math.abs(axis.y);
  return ay * (CAN_H / 2) + Math.sqrt(Math.max(0, 1 - ay * ay)) * CAN_R;
}

function wake(c: Can, v?: THREE.Vector3) {
  if (c.glued || c.dyn) return;
  c.dyn = true;
  c.rest = 0;
  if (v) c.v.copy(v);
  c.w.set((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
}

function stepCans(g: Game, dt: number) {
  for (const c of S.cans) {
    if (!c.dyn || c.rest > 0.6) continue;
    c.v.y -= GRAV * dt;
    c.p.addScaledVector(c.v, dt);
    // rotazione
    const wl = c.w.length();
    if (wl > 1e-4) {
      const dq = new THREE.Quaternion().setFromAxisAngle(tmp.copy(c.w).divideScalar(wl), wl * dt);
      c.q.premultiply(dq).normalize();
    }
    // mensola, pavimento, teli
    const hy = halfY(c);
    const onShelf = Math.abs(c.p.x - CANS.x) < SHELF.hx && Math.abs(c.p.z - CANS.z) < SHELF.hz;
    const floor = onShelf && c.p.y > CANS.y - 0.05 ? CANS.y : 0;
    if (c.p.y - hy < floor) {
      c.p.y = floor + hy;
      if (c.v.y < -1.2 && floor === 0 && !c.down) g.audio.canDrop();
      c.v.y = Math.abs(c.v.y) > 0.6 ? -c.v.y * 0.25 : 0;
      c.v.x *= 0.82;
      c.v.z *= 0.82;
      c.w.multiplyScalar(0.8);
      // per terra, se si ferma, si "addormenta"
      if (c.v.lengthSq() < 0.02) c.rest += dt;
    } else c.rest = 0;
    if (c.p.x < BACK_X + CAN_R) {
      c.p.x = BACK_X + CAN_R;
      c.v.x = Math.abs(c.v.x) * 0.3;
    }
    const dz = c.p.z - CANS.z;
    if (Math.abs(dz) > SIDE_Z) {
      c.p.z = CANS.z + Math.sign(dz) * SIDE_Z;
      c.v.z *= -0.3;
    }
    if (!c.down && c.p.y < CANS.y - 0.02) c.down = true;
  }
  // chi resta senza appoggio cade
  for (const c of S.cans) {
    if (c.dyn || c.glued) continue;
    for (const si of c.supports) {
      const s = S.cans[si];
      if (s.dyn && s.p.distanceTo(s.home) > 0.025) {
        wake(c, tmp.set(0, 0, 0).addScaledVector(s.v, 0.3));
        break;
      }
    }
  }
  // barattoli tra loro (sfere: bastano)
  for (let i = 0; i < S.cans.length; i++) {
    for (let j = i + 1; j < S.cans.length; j++) {
      const a = S.cans[i], b = S.cans[j];
      if (!a.dyn && !b.dyn) continue;
      const d = a.p.distanceTo(b.p);
      const R = CAN_R * 2.15;
      if (d >= R || d < 1e-5) continue;
      const n = tmp.copy(b.p).sub(a.p).divideScalar(d);
      const ma = a.dyn ? 1 : 0, mb = b.dyn ? 1 : 0;
      const pen = R - d;
      if (ma + mb > 0) {
        a.p.addScaledVector(n, (-pen * ma) / (ma + mb));
        b.p.addScaledVector(n, (pen * mb) / (ma + mb));
      }
      const vn = tmp2.copy(a.v).sub(b.v).dot(n);
      if (vn <= 0) continue;
      // chi era fermo (e non incollato) parte
      if (!b.dyn && !b.glued) wake(b);
      if (!a.dyn && !a.glued) wake(a);
      const ia = a.dyn ? 1 : 0, ib = b.dyn ? 1 : 0;
      if (ia + ib === 0) continue;
      const j2 = (1.3 * vn) / (ia + ib);
      a.v.addScaledVector(n, -j2 * ia);
      b.v.addScaledVector(n, j2 * ib);
      a.rest = b.rest = 0;
      if (vn > 1) g.audio.clang(Math.min(1, vn / 6) * 0.6);
    }
  }
}

function stepBalls(g: Game, dt: number) {
  const c0 = new THREE.Vector3();
  for (const b of S.balls) {
    b.t += dt;
    if (b.p.y <= BALL_R + 0.001 && b.v.lengthSq() < 0.05) continue;
    b.v.y -= GRAV * dt;
    b.p.addScaledVector(b.v, dt);
    // barattoli
    for (const c of S.cans) {
      closestOnCan(c, b.p, c0);
      const d = b.p.distanceTo(c0);
      const R = CAN_R + BALL_R;
      if (d >= R || d < 1e-5) continue;
      const n = tmp.copy(b.p).sub(c0).divideScalar(d);
      b.p.addScaledVector(n, R - d);
      const vn = tmp2.copy(b.v).sub(c.v).dot(n);
      if (vn >= 0) continue;
      if (c.glued) {
        // TONK: non si muove di un millimetro
        b.v.addScaledVector(n, -1.3 * vn);
        if (!b.tonked) {
          b.tonked = true;
          g.audio.tonk();
          g.flag('c8Tonk');
        }
        continue;
      }
      wake(c);
      c.rest = 0;
      const j = (-1.35 * vn) / (1 + 1 / 1.2);
      b.v.addScaledVector(n, j);
      c.v.addScaledVector(n, -j / 1.2);
      c.v.y += 0.5;
      // un colpo di lato lo fa girare
      const r = c0.sub(c.p).addScaledVector(n, -CAN_R);
      const torque = new THREE.Vector3().crossVectors(r, n.clone().multiplyScalar(-j));
      c.w.addScaledVector(torque, 1 / 0.01);
      if (c.w.length() > 22) c.w.setLength(22);
      g.audio.clang(Math.min(1, -vn / 8));
      S.hits++;
    }
    // mensola (piano e davanti), teli, pavimento
    const inShelf = Math.abs(b.p.x - CANS.x) < SHELF.hx + BALL_R && Math.abs(b.p.z - CANS.z) < SHELF.hz;
    if (inShelf && b.p.y < CANS.y + BALL_R && b.p.y > CANS.y - 0.15 && b.v.y < 0 && Math.abs(b.p.x - CANS.x) < SHELF.hx) {
      b.p.y = CANS.y + BALL_R;
      b.v.y *= -0.35;
      b.v.x *= 0.7;
      b.v.z *= 0.7;
    } else if (inShelf && b.p.y < CANS.y && b.v.x < 0) {
      b.p.x = CANS.x + SHELF.hx + BALL_R;
      b.v.x *= -0.3;
    }
    if (b.p.x < BACK_X + BALL_R) {
      b.p.x = BACK_X + BALL_R;
      b.v.x = Math.abs(b.v.x) * 0.25;
      b.v.y *= 0.5;
    }
    if (Math.abs(b.p.z - CANS.z) > SIDE_Z + 0.1) b.v.z *= -0.3;
    if (b.p.y < BALL_R) {
      b.p.y = BALL_R;
      b.v.y = Math.abs(b.v.y) > 0.8 ? -b.v.y * 0.35 : 0;
      b.v.x *= 0.7;
      b.v.z *= 0.7;
    }
    b.m.position.copy(b.p);
    b.m.rotation.x += dt * 8;
    b.m.rotation.z += dt * 5;
  }
}

function clearBalls(g: Game) {
  for (const b of S.balls) g.world.group.remove(b.m);
  S.balls = [];
}

// la pallina in mano: in basso a destra nella visuale
const HAND = new THREE.Vector3(0.36, -0.3, -0.85);
function handPos(g: Game, out: THREE.Vector3) {
  const cam = g.player.camera;
  cam.updateMatrixWorld();
  return cam.localToWorld(out.copy(HAND));
}

// la pallina parte dalla mano ma va dove punta il mirino (all'altezza della mensola)
function launch(g: Game, from: THREE.Vector3) {
  const p = g.player;
  const e = p.eye, f = p.forward;
  const d = f.x < -0.1 ? Math.min(12, (CANS.x - e.x) / f.x) : 5;
  const aim = e.addScaledVector(f, d);
  return aim.sub(from).normalize().multiplyScalar(SPEED);
}

function throwBall(g: Game) {
  const from = handPos(g, new THREE.Vector3());
  const m = S.ballModel!.clone();
  m.visible = true;
  g.world.group.add(m);
  const v = launch(g, from);
  S.balls.push({ m, p: from, v, t: 0, tonked: false });
  S.left--;
  S.cd = 0.55;
  g.audio.whoosh();
  if (S.left === 0) S.endT = 3.2;
}

const count = () => S.cans.filter((c) => c.down).length;

export const CANS_BOOTH: Booth = {
  id: 'cans',
  title: 'TIRO AI BARATTOLI',
  fire: 'LANCIA',
  help: () => `${TOUCH ? 'Trascina per mirare' : 'Mira col mouse'} (la pallina scende: mira un po' sopra) · <b>${fireName(CANS_BOOTH)}</b> per lanciare`,
  spot: CANS.spot,
  look: new THREE.Vector3(CANS.x, CANS.y + 0.55, CANS.z),
  cone: { yaw: 0.45, up: 0.5, down: 0.35 },
  start(g) {
    S.glued = !g.is('scollato');
    resetCans(S.glued);
    clearBalls(g);
    S.left = BALLS;
    S.cd = 0.3;
    S.endT = -1;
    S.done = false;
    S.hits = 0;
    // la pallina in mano (sta nel mondo, davanti alla visuale) e i puntini della traiettoria
    const hand = S.ballModel!.clone();
    hand.visible = true;
    hand.scale.setScalar(0.8); // vicina agli occhi sembrerebbe enorme
    g.world.group.add(hand);
    S.hand = hand;
    const mat = new THREE.MeshBasicMaterial({ color: THEME.inkHex });
    const geo = new THREE.SphereGeometry(0.014, 6, 4);
    S.preview = Array.from({ length: 9 }, () => {
      const d = new THREE.Mesh(geo, mat);
      g.world.group.add(d);
      return d;
    });
    g.npc('pastellone').say('Tre palline! Giù tutto, tre gettoni! Giù niente, grazie lo stesso!', 3.5);
  },
  update(g, dt, click) {
    S.cd -= dt;
    const ready = S.left > 0 && S.cd <= 0 && !S.done;
    if (click && ready) throwBall(g);
    // la pallina in mano e la traiettoria: solo il primo tratto (il resto lo indovini)
    const from = handPos(g, new THREE.Vector3());
    if (S.hand) {
      S.hand.visible = ready;
      S.hand.position.copy(from);
    }
    const v = launch(g, from);
    S.preview.forEach((d, i) => {
      const t = 0.03 + i * 0.022;
      d.visible = ready;
      d.position.set(from.x + v.x * t, from.y + v.y * t - 0.5 * GRAV * t * t, from.z + v.z * t);
    });
    // fisica a passi piccoli (la pallina è veloce)
    const n = 5;
    for (let k = 0; k < n; k++) {
      stepBalls(g, dt / n);
      stepCans(g, dt / n);
    }
    for (const c of S.cans) {
      c.g.position.copy(c.p);
      c.g.quaternion.copy(c.q);
    }
    // fine: tutti giù, o finite le palline e passato un po'
    if (!S.done && count() === S.cans.length && (S.endT < 0 || S.endT > 1.2)) S.endT = 1.2;
    if (S.endT >= 0 && !S.done) {
      S.endT -= dt;
      if (S.endT < 0) {
        S.done = true;
        const down = count();
        const tokens = down >= 6 ? 3 : down >= 4 ? 2 : down >= 2 ? 1 : 0;
        const glueNote = S.glued && !S.cans[1].down && g.is('c8Tonk') ? '<br><small>Quello di mezzo non si è mosso. Ha fatto TONK.</small>' : '';
        finishBooth(g, `${down === 6 ? '<b>TUTTI GIÙ!</b>' : `<b>${down}</b> barattoli giù su 6`}${glueNote}`, tokens);
        const pl = g.npc('pastellone');
        pl.say(down >= 6 ? 'Tutti?! Chi ti ha insegnato? Un Evidenziatore?' : down === 0 ? 'Zero! Il mio numero preferito.' : 'Bravo. Cioè, abbastanza. Cioè, torna.', 3.5);
      }
    }
  },
  status: () => `palline ${dots(S.left, BALLS)} · barattoli giù: <b>${count()}</b>/6`,
  stop(g) {
    if (S.hand) g.world.group.remove(S.hand);
    S.hand = null;
    for (const d of S.preview) g.world.group.remove(d);
    if (S.preview.length) {
      S.preview[0].geometry.dispose();
      (S.preview[0].material as THREE.Material).dispose();
    }
    S.preview = [];
    // le palline restano per terra: le raccolgono i Pastelli (cioè spariscono)
    clearBalls(g);
  },
};

export const cansDown = count;
export const CANS_DEBUG = S;
export const cansGlued = () => S.glued;
