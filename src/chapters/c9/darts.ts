import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Sketch } from '../../render/sketch';
import { TOUCH } from '../../touch';
import { parryName } from '../../settings';
import { dots, finishBooth, fireName, openBooth, type Booth } from '../../game/booth';
import { BOARD, OCHE, REFS9, RINGS, SECTORS } from './world';

// ---------------------------------------------------------------------------
// FRECCETTE (da Dario): tre turni da tre freccette. Nella finale tira prima Barnie, poi tu;
// vince chi fa più punti. La freccetta va dove punta il mirino, ma col capogiro la visuale
// ondeggia: tenendo premuto PARA (tasto destro) ti concentri e la visuale si ferma, finché hai
// fiato. Il bersaglio è quello vero (settori da 1 a 20, doppio, triplo, centro), disegnato grande.
// ---------------------------------------------------------------------------

type Hit = [number, 1 | 2 | 3]; // valore del settore (25/50 = centro), moltiplicatore
interface Dart {
  m: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  aim: THREE.Vector3; // dove punta, piantata
  t: number;
  score: number;
  label: string;
  who: 'barnie' | 'player';
}

const TURNS = 3;
const FLIGHT = 0.17;
// Barnie: il campione. Nell'ultimo turno sbadiglia. Ogni rivincita persa da te lo stanca un po'.
const BARNIE_PLAN: Hit[][] = [
  [[20, 3], [20, 1], [5, 1]],
  [[20, 1], [1, 1], [20, 3]],
  [[20, 1], [20, 1], [18, 1]],
];
const TIRED: Hit[][] = [
  [[20, 1], [20, 1], [5, 1]],
  [[20, 1], [1, 1], [20, 1]],
  [[20, 1], [5, 1], [18, 1]],
];

const S = {
  mode: 'final' as 'final' | 'practice',
  round: 0,
  turn: 'barnie' as 'barnie' | 'player' | 'pause' | 'done',
  next: 'player' as 'barnie' | 'player' | 'end',
  thrown: 0,
  darts: [] as Dart[],
  barnie: [0, 0, 0],
  player: [0, 0, 0],
  timer: 0,
  breath: 1,
  last: '',
  losses: 0, // rivincite perse (Barnie si stanca)
  lucky: false, // la freccetta portafortuna di Barnie (dal capitolo 6)
  models: null as { player: THREE.Group; barnie: THREE.Group } | null,
};

// una freccetta: punta, fusto a inchiostro, alette colorate (rosse le tue, blu quelle di Barnie).
// Grande il doppio del vero, come il bersaglio.
function dartModel(color: string) {
  const s = new Sketch();
  s.style = { jitter: 0.002, over: 0.005 };
  s.seg(0, 0, 0, 0, 0, -0.05).seg(0, 0, -0.05, 0, 0, -0.17);
  s.circle(0, 0, -0.06, 0.008, 'z', 6);
  const g = new THREE.Group();
  g.add(s.build(REFS9.lm!, REFS9.fill!));
  const fl = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0, 0.035, -0.175), new THREE.Vector3(0, 0, -0.17),
    new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0, -0.035, -0.175), new THREE.Vector3(0, 0, -0.17),
    new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(0.035, 0, -0.175), new THREE.Vector3(0, 0, -0.17),
    new THREE.Vector3(0, 0, -0.12), new THREE.Vector3(-0.035, 0, -0.175), new THREE.Vector3(0, 0, -0.17),
  ]);
  g.add(new THREE.Mesh(fl, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
  g.scale.setScalar(1.8);
  return g;
}

export function setupDarts(g: Game) {
  S.darts = [];
  S.losses = 0;
  S.models = { player: dartModel('#d6333a'), barnie: dartModel('#2f5bd3') };
}

// punto del bersaglio per un tiro (settore, anello)
function pointFor([v, mul]: Hit) {
  let r: number, i = 0;
  if (v === 50) r = RINGS.bull * 0.5;
  else if (v === 25) r = (RINGS.bull + RINGS.outer) / 2;
  else {
    i = SECTORS.indexOf(v);
    r = mul === 3 ? (RINGS.t0 + RINGS.t1) / 2 : mul === 2 ? (RINGS.d0 + RINGS.d1) / 2 : 0.31;
  }
  const a = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
  return new THREE.Vector3(BOARD.x - 0.01, BOARD.y + Math.cos(a) * r, BOARD.z + Math.sin(a) * r);
}

// quanto vale un punto del bersaglio (guardato da chi tira: a destra = +z)
export function scoreAt(p: THREE.Vector3): { score: number; label: string } {
  const dy = p.y - BOARD.y, dz = p.z - BOARD.z;
  const r = Math.hypot(dy, dz);
  if (r < RINGS.bull) return { score: 50, label: 'CENTRO! 50' };
  if (r < RINGS.outer) return { score: 25, label: '25' };
  if (r > RINGS.d1) return { score: 0, label: r > 0.55 ? 'MURO' : 'FUORI' };
  const seg = (Math.PI * 2) / 20;
  let a = Math.atan2(dz, dy) + seg / 2;
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const v = SECTORS[Math.floor(a / seg) % 20];
  const mul = r > RINGS.t0 && r < RINGS.t1 ? 3 : r > RINGS.d0 ? 2 : 1;
  return { score: v * mul, label: mul === 3 ? `TRIPLO ${v}! ${v * 3}` : mul === 2 ? `DOPPIO ${v}: ${v * 2}` : String(v) };
}

function throwDart(g: Game, from: THREE.Vector3, to: THREE.Vector3, who: Dart['who']) {
  const m = S.models![who].clone();
  m.position.copy(from);
  g.world.group.add(m);
  const { score, label } = scoreAt(to);
  // piantata: la punta un po' in su e di lato (la coda pende), così da qui si vede
  const aim = to.clone().add(new THREE.Vector3(1, 0.22, (Math.random() - 0.5) * 0.3));
  S.darts.push({ m, from: from.clone(), to: to.clone(), aim, t: 0, score, label, who });
  g.audio.whoosh();
}

function clearDarts(g: Game) {
  for (const d of S.darts) g.world.group.remove(d.m);
  S.darts = [];
}

const total = (a: number[]) => a.reduce((s, x) => s + x, 0);

// la mano di Barnie: più o meno all'altezza della sua spalla, verso il bersaglio
function barnieHand(g: Game) {
  const n = g.npc('barnie');
  return new THREE.Vector3(n.pos.x + 0.3, 2.3, n.pos.z + 0.4);
}

// il tuo tiro: dove punta il mirino (visuale compresa di ondeggiamento), più un errore
function playerThrow(g: Game) {
  const p = g.player;
  const cam = p.camera;
  cam.updateMatrixWorld();
  const o = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  const d = cam.getWorldDirection(new THREE.Vector3());
  if (d.x < 0.05) return;
  const t = (BOARD.x - 0.01 - o.x) / d.x;
  const to = o.clone().addScaledVector(d, t);
  const first = S.thrown === 0;
  const sigma = S.lucky && first ? 0.004 : 0.007 + 0.022 * p.dizzy * (1 - p.steady);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;
  to.y += gauss() * sigma;
  to.z += gauss() * sigma;
  const from = cam.localToWorld(new THREE.Vector3(0.25, -0.2, -0.45));
  throwDart(g, from, to, 'player');
  S.thrown++;
}

function startTurn(who: 'barnie' | 'player') {
  S.turn = who;
  S.thrown = 0;
  S.timer = who === 'barnie' ? 1.0 : 0;
}

function barnieHits(): Hit[] {
  const plan = S.losses > 0 ? TIRED : BARNIE_PLAN;
  return plan[S.round];
}

export const DARTS_BOOTH: Booth = {
  id: 'darts',
  title: 'FRECCETTE',
  fire: 'TIRA',
  parry: 'FIATO',
  help: () =>
    `<b>${fireName(DARTS_BOOTH)}</b> per tirare · tieni premuto <b>${TOUCH ? 'FIATO' : parryName()}</b> per trattenere il fiato: la visuale sta ferma (finché ne hai)`,
  spot: new THREE.Vector3(OCHE - 0.25, 0, BOARD.z),
  look: new THREE.Vector3(BOARD.x, BOARD.y, BOARD.z),
  cone: { yaw: 0.35, up: 0.3, down: 0.3 },
  start(g) {
    clearDarts(g);
    S.round = 0;
    S.barnie = [0, 0, 0];
    S.player = [0, 0, 0];
    S.breath = 1;
    S.last = '';
    S.lucky = g.has('freccetta');
    if (S.mode === 'final') startTurn('barnie');
    else startTurn('player');
  },
  update(g, dt, click) {
    const p = g.player;
    // fiato: tenendo premuto PARA ti concentri (la visuale si ferma), finché dura
    const hold = g.input.rightDown && S.breath > 0 && S.turn === 'player';
    p.steady += ((hold ? 1 : 0) - p.steady) * Math.min(1, dt * 8);
    S.breath = hold ? Math.max(0, S.breath - dt / 2.4) : Math.min(1, S.breath + dt * 0.33);
    // turni
    if (S.turn === 'barnie') {
      S.timer -= dt;
      if (S.timer <= 0 && S.thrown < 3) {
        const n = g.npc('barnie');
        n.baseAction = 'strike';
        g.after(0.3, () => (n.baseAction = 'drink'));
        throwDart(g, barnieHand(g), pointFor(barnieHits()[S.thrown]), 'barnie');
        S.thrown++;
        S.timer = 1.0;
      }
      if (S.thrown >= 3 && S.timer <= 0 && S.darts.every((d) => d.t >= 1)) {
        S.turn = 'pause';
        S.next = 'player';
        S.timer = 1.3;
      }
    } else if (S.turn === 'player') {
      if (click && S.thrown < 3 && S.darts.every((d) => d.t >= 1)) playerThrow(g);
      if (S.thrown >= 3 && S.darts.every((d) => d.t >= 1)) {
        S.turn = 'pause';
        S.next = S.round < TURNS - 1 && S.mode === 'final' ? 'barnie' : 'end';
        S.timer = 1.3;
      }
    } else if (S.turn === 'pause') {
      S.timer -= dt;
      if (S.timer <= 0) {
        clearDarts(g);
        if (S.next === 'end') {
          S.turn = 'done';
          const me = total(S.player), bar = total(S.barnie);
          if (S.mode === 'practice') finishBooth(g, `Allenamento: <b>${me}</b> punti con tre freccette`, me);
          else {
            const win = me > bar;
            if (!win) S.losses++;
            finishBooth(g, `${win ? '<b>HAI VINTO!</b>' : me === bar ? '<b>PAREGGIO</b> (vince il campione)' : '<b>Ha vinto Barnie</b>'}<br>Tu ${me} · Barnie ${bar}`, win ? 1 : 0);
          }
        } else {
          if (S.next === 'barnie') S.round++;
          startTurn(S.next);
        }
      }
    }
    // freccette in volo
    for (const d of S.darts) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt / FLIGHT);
      const k = d.t;
      d.m.position.lerpVectors(d.from, d.to, k);
      d.m.position.y += Math.sin(k * Math.PI) * 0.12;
      d.m.lookAt(d.to.x + 1, d.to.y, d.to.z);
      if (d.t >= 1) {
        d.m.position.copy(d.to);
        d.m.lookAt(d.aim);
        g.audio.dart(d.score > 0);
        g.hud.popWord(d.to.clone(), p.camera, d.label);
        S.last = `${d.who === 'barnie' ? 'Barnie' : 'Tu'}: ${d.label}`;
        if (d.who === 'barnie') S.barnie[S.round] += d.score;
        else S.player[S.round] += d.score;
      }
    }
  },
  status: () => {
    const turn = S.mode === 'practice' ? 'Allenamento' : `Turno ${Math.min(S.round + 1, TURNS)}/${TURNS} · ${S.turn === 'barnie' ? 'tira Barnie' : S.turn === 'player' ? 'tocca a te' : '...'}`;
    const score = S.mode === 'final' ? ` · Barnie <b>${total(S.barnie)}</b> · Tu <b>${total(S.player)}</b>` : ` · punti <b>${total(S.player)}</b>`;
    const darts = S.turn === 'player' ? `<br>freccette ${dots(3 - S.thrown, 3)} · fiato ${dots(Math.ceil(S.breath * 5), 5)}` : '';
    return `${turn}${score}${darts}${S.last ? `<br><small>${S.last}</small>` : ''}`;
  },
  stop(g) {
    clearDarts(g);
    g.player.steady = 0;
    const n = g.npc('barnie');
    n.baseAction = 'drink';
  },
};

export function playDarts(g: Game, mode: 'final' | 'practice', onEnd: (result: number) => void) {
  S.mode = mode;
  DARTS_BOOTH.title = mode === 'final' ? 'FINALE DI FRECCETTE: TU CONTRO BARNIE' : 'FRECCETTE: ALLENAMENTO';
  openBooth(g, DARTS_BOOTH, onEnd);
}

export const dartsLosses = () => S.losses;
