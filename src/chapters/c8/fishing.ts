import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Game } from '../../game/game';
import { Sketch } from '../../render/sketch';
import { TOUCH } from '../../touch';
import { FISH, REFS8 } from './world';
import { dots, finishBooth, fireName, type Booth } from './booth';

// ---------------------------------------------------------------------------
// PESCA DEI TAPPI: nella vasca girano i tappi a corona, ognuno su un suo giro e a una sua
// velocità. La canna segue la visuale (l'amo scende dove guardi); un colpo = l'amo va giù e
// torna su. Se l'anello di un tappo è sotto l'amo in quel momento, è tuo: sotto c'è il numero
// (gettoni: 0, 1 o 2). Cinque tentativi. Il tappo con la stella gira al bordo, velocissimo.
// ---------------------------------------------------------------------------

const TRIES = 5;
const CAP_R = 0.08;
const DOWN = 0.2, UP = 0.35; // secondi per scendere e per risalire

interface Cap {
  g: THREE.Group;
  ring: number; // raggio del giro
  a: number; // angolo
  speed: number; // rad/s (col segno)
  value: number;
  star: boolean;
  phase: number;
  caught: boolean;
  gone: number; // secondi prima di ricomparire (dopo essere stato pescato)
}

const S = {
  caps: [] as Cap[],
  left: TRIES,
  state: 'idle' as 'idle' | 'down' | 'up',
  t: 0,
  hook: new THREE.Vector3(),
  held: null as Cap | null,
  got: 0,
  tokens: 0,
  star: false, // preso il tappo con la stella in questa partita
  rod: null as LineSegments2 | null,
  line: null as LineSegments2 | null,
  endT: -1,
  done: false,
  playing: false,
  ripple: null as THREE.Mesh | null,
  rippleT: 1,
  time: 0,
};

function capModel(star: boolean) {
  const s = new Sketch();
  s.style = { jitter: 0.003, over: 0.005 };
  s.geometry(new THREE.CylinderGeometry(CAP_R, CAP_R * 1.05, 0.03, 18), 40);
  // bordo zigrinato e anello da agganciare
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = i % 2 ? CAP_R * 1.12 : CAP_R;
    pts.push([Math.cos(a) * r, 0.0, Math.sin(a) * r]);
  }
  s.curve(pts);
  s.circle(0, 0.016, 0, CAP_R * 0.7, 'y', 14, 0.03);
  s.circle(0, 0.045, 0, 0.022, 'x', 8, 0.05);
  const g = new THREE.Group();
  g.add(s.build(REFS8.thin!, REFS8.fill!));
  if (star) {
    const st = new Sketch();
    st.style = { jitter: 0.002, over: 0 };
    const sp: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.024 : 0.058;
      sp.push([Math.cos(a) * r, 0.018, Math.sin(a) * r]);
    }
    st.curve(sp);
    g.add(st.build(REFS8.red!, REFS8.fill!));
  }
  return g;
}

export function setupFish(g: Game) {
  S.caps = [];
  S.playing = false;
  S.held = null;
  const values = [1, 1, 0, 1, 2, 1, 0, 1, 1, 0, 1];
  values.forEach((v, i) => {
    const m = capModel(false);
    g.world.group.add(m);
    S.caps.push({ g: m, ring: 0.28 + ((i * 0.41) % 0.5), a: i * 2.3, speed: (0.25 + ((i * 0.37) % 0.35)) * (i % 2 ? 1 : -1), value: v, star: false, phase: i, caught: false, gone: 0 });
  });
  // il tappo con la stella: al bordo, il più veloce (se non l'hai già pescato)
  if (!g.has('tappoStella') && !g.questDone('stella')) {
    const m = capModel(true);
    g.world.group.add(m);
    S.caps.push({ g: m, ring: 0.8, a: 0, speed: 0.95, value: 2, star: true, phase: 0.5, caught: false, gone: 0 });
  }
  // increspatura quando l'amo tocca l'acqua
  const rip = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 24), new THREE.MeshBasicMaterial({ color: '#25222c', transparent: true, opacity: 0, depthWrite: false }));
  rip.rotation.x = -Math.PI / 2;
  g.world.group.add(rip);
  S.ripple = rip;
  // canna e lenza (si ridisegnano a ogni frame)
  const mk = (mat: typeof REFS8.lm) => {
    const geo = new LineSegmentsGeometry();
    geo.setPositions([0, 0, 0, 0, 0, 0]);
    const l = new LineSegments2(geo, mat!);
    l.visible = false;
    l.frustumCulled = false;
    g.world.group.add(l);
    return l;
  };
  S.rod = mk(REFS8.lm);
  S.line = mk(REFS8.thin);
}

// i tappi girano sempre, anche quando non gioca nessuno
export function updateFishTub(g: Game, dt: number) {
  S.time += dt;
  for (const c of S.caps) {
    if (c.caught) {
      if (c === S.held) continue;
      c.gone -= dt;
      if (c.gone > 0 || c.star) continue;
      // ricompare un tappo nuovo, con un numero nuovo
      c.caught = false;
      c.g.visible = true;
      c.value = [0, 1, 1, 1, 2][Math.floor(Math.random() * 5)];
      c.a = Math.random() * Math.PI * 2;
    }
    c.a += c.speed * dt;
    c.g.position.set(FISH.x + Math.cos(c.a) * c.ring, FISH.water + 0.012 + Math.sin(S.time * 2.2 + c.phase) * 0.006, FISH.z + Math.sin(c.a) * c.ring);
    c.g.rotation.y = -c.a * 0.6;
    c.g.rotation.z = Math.sin(S.time * 1.7 + c.phase) * 0.06;
  }
  if (S.ripple) {
    S.rippleT = Math.min(1, S.rippleT + dt * 1.6);
    const m = S.ripple.material as THREE.MeshBasicMaterial;
    m.opacity = (1 - S.rippleT) * 0.5;
    S.ripple.scale.setScalar(0.03 + S.rippleT * 0.2);
  }
}

// dove punta la canna: dove la visuale incontra l'acqua (dentro la vasca)
function aim(g: Game, out: THREE.Vector3) {
  const p = g.player;
  const e = p.eye, f = p.forward;
  let x: number, z: number;
  if (f.y < -0.05) {
    const t = (FISH.water - e.y) / f.y;
    x = e.x + f.x * t;
    z = e.z + f.z * t;
  } else {
    x = e.x + f.x * 3;
    z = e.z + f.z * 3;
  }
  const dx = x - FISH.x, dz = z - FISH.z, d = Math.hypot(dx, dz), max = FISH.r - 0.1;
  if (d > max) {
    x = FISH.x + (dx / d) * max;
    z = FISH.z + (dz / d) * max;
  }
  return out.set(x, FISH.water, z);
}

function drawRod(g: Game, hookY: number) {
  const cam = g.player.camera;
  cam.updateMatrixWorld();
  const hand = cam.localToWorld(new THREE.Vector3(0.28, -0.42, -0.35));
  const h = S.hook;
  const tip = new THREE.Vector3(h.x, FISH.water + 0.85, h.z).lerp(hand, 0.12);
  const rod = [hand.x, hand.y, hand.z, tip.x, tip.y, tip.z];
  // lenza e amo (una "J")
  const line = [tip.x, tip.y, tip.z, h.x, hookY + 0.06, h.z];
  const J: [number, number][] = [[0, 0.09], [0, 0.0], [0.03, -0.028], [0.06, -0.008], [0.06, 0.02]];
  for (let i = 0; i < J.length - 1; i++) line.push(h.x + J[i][0], hookY + J[i][1], h.z, h.x + J[i + 1][0], hookY + J[i + 1][1], h.z);
  (S.rod!.geometry as LineSegmentsGeometry).setPositions(rod);
  (S.line!.geometry as LineSegmentsGeometry).setPositions(line);
  S.rod!.visible = S.line!.visible = true;
}

export const FISH_BOOTH: Booth = {
  id: 'fish',
  title: 'PESCA DEI TAPPI',
  fire: 'PESCA',
  help: () => `${TOUCH ? 'Trascina' : 'Muovi il mouse'}: l'amo va dove guardi · <b>${fireName(FISH_BOOTH)}</b>: giù e su (anticipa il tappo!)`,
  spot: FISH.spot,
  look: new THREE.Vector3(FISH.x, FISH.water, FISH.z),
  cone: { yaw: 0.6, up: 0.28, down: 0.4 },
  start() {
    S.left = TRIES;
    S.state = 'idle';
    S.got = 0;
    S.tokens = 0;
    S.star = false;
    S.endT = -1;
    S.done = false;
    S.playing = true;
  },
  update(g, dt, click) {
    const idleY = FISH.water + 0.22;
    if (S.state === 'idle') {
      aim(g, S.hook);
      if (click && S.left > 0 && !S.done) {
        S.state = 'down';
        S.t = 0;
        S.left--;
      }
      drawRod(g, idleY);
    } else if (S.state === 'down') {
      S.t += dt;
      const k = Math.min(1, S.t / DOWN);
      drawRod(g, idleY + (FISH.water - 0.01 - idleY) * k);
      if (k >= 1) {
        g.audio.splash();
        S.rippleT = 0;
        S.ripple!.position.set(S.hook.x, FISH.water + 0.004, S.hook.z);
        // cosa c'è sotto l'amo
        let best: Cap | null = null, bd = CAP_R;
        for (const c of S.caps) {
          if (c.caught) continue;
          const d = Math.hypot(c.g.position.x - S.hook.x, c.g.position.z - S.hook.z);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        if (best) {
          best.caught = true;
          S.held = best;
        }
        S.state = 'up';
        S.t = 0;
      }
    } else {
      S.t += dt;
      const k = Math.min(1, S.t / UP);
      const y = FISH.water - 0.01 + (idleY + 0.25 - FISH.water) * k;
      drawRod(g, y);
      const c = S.held;
      if (c) {
        c.g.position.set(S.hook.x, y - 0.03, S.hook.z);
        c.g.rotation.z = k * Math.PI; // si gira: si vede il numero sotto
      }
      if (k >= 1) {
        if (c) {
          S.got++;
          S.tokens += c.value;
          if (c.star) {
            S.star = true;
            g.hud.popWord(c.g.position.clone(), g.player.camera, '★ LA STELLA!');
            g.audio.ding(true);
          } else {
            g.hud.popWord(c.g.position.clone(), g.player.camera, c.value ? `+${c.value}` : 'ZERO');
            if (c.value) g.audio.ding();
            else g.audio.miss();
          }
          c.g.visible = false;
          c.gone = 2.5;
          S.held = null;
        } else g.audio.miss();
        S.state = 'idle';
        if (S.left === 0) S.endT = 0.6;
      }
    }
    if (S.endT >= 0 && !S.done) {
      S.endT -= dt;
      if (S.endT < 0) {
        S.done = true;
        if (S.star) {
          g.give('tappoStella');
          if (g.questActive('stella')) g.setStep('stella', 1);
        }
        finishBooth(g, S.got ? `<b>${S.got}</b> tappi pescati${S.star ? '<br><small>...e c\'è quello con la stella!</small>' : ''}` : 'Niente. I tappi ti hanno visto arrivare.', S.tokens);
      }
    }
  },
  status: () => `tentativi ${dots(S.left, TRIES)} · pescati: <b>${S.got}</b> (${S.tokens} gettoni)`,
  stop() {
    S.playing = false;
    if (S.rod) S.rod.visible = false;
    if (S.line) S.line.visible = false;
    if (S.held) {
      S.held.caught = false;
      S.held.g.visible = true;
      S.held = null;
    }
  },
};
