import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { Stickman } from '../../entities/stickman';
import { CERA, THEME } from '../../render/palette';
import { Sketch } from '../../render/sketch';
import { cloudTexture } from '../../render/textures';
import { VOICES } from '../../content/voices';
import { attackName, keyName } from '../../settings';
import { TOUCH } from '../../touch';
import { VIEW } from '../../view';
import { ROAD, S } from './road';
import { REFS, type Cone } from './world';
import { PIECE_NAMES, PIECE_ORDER, type PieceId } from './car';

// ---------------------------------------------------------------------------
// LA GUIDA (capitolo 6). La macchina di Luca non ha il motore: va solo in discesa.
//  - pendenza, attrito e aria decidono la velocità; si sterza e si frena, niente acceleratore
//  - quando si ferma (in piano o in salita) Marco e Luca scendono e spingono, piano
//  - troppo veloci in curva le gomme non tengono: si va lunghi contro il muro e si perdono pezzi
//  - dietro c'è la Scatola da 24 dei Pastelli: in discesa la semini, in piano e in salita ti prende
//  - i Pastelli tirano la cera sul parabrezza: il tergicristallo è il braccio di Marco
//  - si lancia la posta nelle cassette blu, si raccolgono i tappi per Martina, si carica Barnie
// ---------------------------------------------------------------------------

const G = 9.8;
const ROLL = 0.1; // attrito delle ruote di cartone (m/s²)
const DRAG = 0.0028; // aria (per v²)
const BRAKE = 7;
const PUSH_ACC = 2.4;
const WHEELBASE = 2.6;
const MAX_STEER = 0.55;
const GRIP = 9; // accelerazione laterale massima prima di andare lunghi
const HALF_L = 1.95, HALF_W = 0.9;
const PIECES_MAX = 4;

export type Barnie = 'none' | 'aboard' | 'dropped' | 'missed';

export const DRIVE = {
  active: false, // si è in macchina
  started: false, // partiti (i Pastelli inseguono)
  finished: false, // arrivati da Don Fluo
  x: 0, z: 0, y: 0, th: 0, v: 0, steer: 0, s: 0, d: 0, idx: 0, pitch: 0,
  brake: 0, skid: 0, shake: 0,
  pieces: PIECES_MAX,
  lost: [] as PieceId[],
  pushing: true, // Marco e Luca fuori a spingere
  pushT: 0,
  chaseOn: false,
  chaseS: -46,
  chaseV: 0,
  chaseD: 0,
  grab: 0,
  waxT: 2,
  letters: 0,
  delivered: 0,
  caps: 0,
  torta: -1, // piani della torta (-1 = niente torta)
  barnie: 'none' as Barnie,
  crashes: 0,
  honkT: 0,
  wipeCd: 0,
  throwCd: 0,
  fired: new Set<string>(),
  cp: null as Snapshot | null,
  prevTh: 0,
  backT: 0, // da quanto tieni il freno da fermo (poi si spinge indietro)
};

interface Snapshot { s: number; v: number; pieces: number; torta: number; name: string }

// scene gestite dalla storia (story.ts)
export const DRIVE_HOOKS: {
  arrive?: (g: Game) => void;
  barnieUp?: (g: Game) => void;
  barnieDown?: (g: Game) => void;
} = {};

// oggetti che volano (lettere, pezzi persi, coni)
interface Flying { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; kind: 'letter' | 'debris'; t: number; rest: boolean }
let flying: Flying[] = [];
let envelopeMat: THREE.SpriteMaterial | null = null;
let shield: Windshield | null = null;
let hudEl: HTMLElement | null = null;
let subEl: HTMLElement | null = null;
let subQueue: { who: string; id: string; text: string; t: number }[] = [];
let subT = 0;

// pecore e nonna: si muovono in coordinate stradali
interface Sheep { obj: THREE.Group; s: number; d: number; vd: number; vs: number; flee: number; gone: boolean; bleatT: number; hop: number }
let sheep: Sheep[] = [];
const NONNA = { s: S.mercato + 72, d: -8.5, state: 'wait' as 'wait' | 'cross' | 'done', speed: 0.9 };

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function resetDrive() {
  Object.assign(DRIVE, {
    active: false, started: false, finished: false,
    v: 0, steer: 0, brake: 0, skid: 0, shake: 0,
    pieces: PIECES_MAX, lost: [], pushing: true, pushT: 0,
    chaseOn: false, chaseS: -46, chaseV: 0, chaseD: 0, grab: 0, waxT: 2,
    letters: 0, delivered: 0, caps: 0, torta: -1, barnie: 'none', crashes: 0,
    honkT: 0, wipeCd: 0, throwCd: 0, fired: new Set<string>(), cp: null, backT: 0,
  });
  flying = [];
  sheep = [];
  subQueue = [];
  subT = 0;
  shield = null;
  hudEl = subEl = null;
  envelopeMat = null;
  NONNA.state = 'wait';
  NONNA.d = -8.5;
  NONNA.speed = 0.9;
  placeCarAt(S.car, 0, 0);
}

// mette la macchina sulla strada a (s, d), ferma o lanciata
function placeCarAt(s: number, d: number, v: number) {
  const p = ROAD.point(s, d);
  const th = ROAD.at(s).th;
  Object.assign(DRIVE, { x: p.x, z: p.z, y: p.y, th, v, s, d, idx: Math.round(s), steer: 0, prevTh: th });
  syncCarModel(0);
}

function syncCarModel(dt: number) {
  const car = REFS.car;
  if (!car) return;
  const p = ROAD.at(DRIVE.s);
  const rel = DRIVE.th - p.th;
  // beccheggio: pendenza nella direzione di marcia (in discesa il muso va giù)
  const want = -Math.atan(p.grade * Math.cos(rel));
  DRIVE.pitch += (want - DRIVE.pitch) * Math.min(1, dt * 8 || 1);
  car.root.position.set(DRIVE.x, DRIVE.y, DRIVE.z);
  car.root.rotation.set(DRIVE.pitch, DRIVE.th, 0);
  // le ruote girano, il volante segue lo sterzo
  for (const w of car.wheels) w.rotation.x += (DRIVE.v / 0.36) * dt;
  car.steering.rotation.z = -DRIVE.steer * 2.2;
  car.root.updateMatrixWorld(true);
}

// =========================================================================
// SALIRE E SCENDERE
// =========================================================================
export function enterCar(g: Game) {
  DRIVE.active = true;
  const p = g.player;
  p.seated = true;
  p.setCrouch(false);
  p.setWeapon('fist');
  g.hideNameTags = true;
  g.interactOff = true;
  placeCarAt(S.car, 0, 0);
  p.yaw = DRIVE.th + Math.PI;
  p.pitch = -0.03;
  DRIVE.pushing = true;
  for (const id of ['marco', 'luca']) {
    const n = g.npc(id);
    n.controlled = true;
    n.faceWhenNear = false;
  }
  buildUi(g);
  g.touchMode = { fire: null, use: 'TERGI', jump: 'BIP' };
  placePassengers(g, 0);
}

export function leaveCar(g: Game) {
  DRIVE.active = false;
  g.player.seated = false;
  g.hideNameTags = false;
  g.interactOff = false;
  g.touchMode = null;
  g.hud.meter(null);
  hudEl?.remove();
  subEl?.remove();
  shield?.remove();
  hudEl = subEl = null;
  shield = null;
  g.audio.stopCar();
}

// =========================================================================
// AGGIORNAMENTO
// =========================================================================
export function updateDrive(g: Game, dt: number) {
  if (!DRIVE.active) return;
  const inp = g.input;
  const live = g.mode === 'play' && inp.locked && !g.hud.screenVisible && !g.dialogue.isOpen && !g.hud.diarioOpen;
  if (live) {
    simulate(g, dt);
    if (DRIVE.started && !DRIVE.finished) {
      updateChase(g, dt);
      updateLetters(g, dt);
      updateCaps(g);
      updateSheep(g, dt);
      updateNonna(g, dt);
      events(g);
      checkpoints(g);
      // clacson: Stecco dice "bip"
      DRIVE.honkT = Math.max(0, DRIVE.honkT - dt);
      if (inp.wasPressed('jump') && DRIVE.honkT <= 0) honk(g);
      // tergicristallo: il braccio di Marco
      DRIVE.wipeCd = Math.max(0, DRIVE.wipeCd - dt);
      if (inp.wasPressed('interact') && DRIVE.wipeCd <= 0) wipe(g);
      // la posta si lancia dove guardi
      DRIVE.throwCd = Math.max(0, DRIVE.throwCd - dt);
      if (inp.clicked && DRIVE.letters > 0 && DRIVE.throwCd <= 0) throwLetter(g);
    }
  } else {
    g.audio.car(0, 0, 0);
  }
  updateFlying(dt);
  updateCones(dt);
  syncCarModel(live ? dt : 0);
  placePassengers(g, live ? dt : 0);
  placeScatola(g, live ? dt : 0);
  placeCamera(g, dt);
  updateUi(g, dt);
  // il cielo segue la camera
  REFS.sky?.position.copy(g.player.camera.position);
  // i pezzi di strada lontani non si disegnano
  cullChunks(g.player.camera.position, g);
  // tocco: LANCIA solo se hai posta da lanciare
  if (g.touchMode) g.touchMode.fire = DRIVE.letters > 0 && DRIVE.started ? 'LANCIA' : null;
}

// Quello che è lontano non si disegna: pezzi di strada e omini (la nebbia li nasconderebbe comunque)
export function cullChunks(cam: THREE.Vector3, g?: Game) {
  for (const c of REFS.chunks) c.group.visible = c.c.distanceTo(cam) < 175 + c.r;
  if (g) for (const n of g.npcs) if (!n.hidden) n.body.root.visible = n.pos.distanceTo(cam) < 170;
}

function simulate(g: Game, dt: number) {
  const inp = g.input;
  const D = DRIVE;
  // --- comandi ---
  let steerIn = 0, brakeIn = 0;
  if (D.started && !D.finished) {
    if (inp.isDown('left') || inp.down.has('ArrowLeft')) steerIn += 1;
    if (inp.isDown('right') || inp.down.has('ArrowRight')) steerIn -= 1;
    if (Math.abs(inp.moveX) > 0.12) steerIn -= inp.moveX;
    if (inp.isDown('back') || inp.down.has('ArrowDown')) brakeIn = 1;
    if (inp.moveY > 0.35) brakeIn = Math.min(1, (inp.moveY - 0.35) / 0.4);
    if ((inp.wasPressed('forward') || inp.pressed.has('ArrowUp')) && !D.fired.has('gas')) {
      D.fired.add('gas');
      g.toast("Non c'è l'acceleratore. C'è la discesa.", 'info', 3000);
    }
  }
  if (D.finished) brakeIn = 1;
  // freno tenuto da fermi: Marco e Luca scendono e spingono all'indietro (per uscire dagli incastri)
  if (brakeIn > 0 && Math.abs(D.v) < 0.4 && D.started && !D.finished) D.backT += dt;
  else if (brakeIn === 0) D.backT = 0;
  const reverse = D.backT > 0.6;
  if (reverse && !D.pushing) {
    D.pushing = true;
    D.pushT = 0;
    sub(g, 'marco', 'Indietro! Spingiamo indietro!');
  }
  steerIn = clamp(steerIn, -1, 1);
  D.steer += (steerIn - D.steer) * Math.min(1, dt * 5);
  D.brake = brakeIn;

  // --- forze ---
  const p = ROAD.at(D.s);
  const rel = wrap(D.th - p.th);
  const slope = p.grade * Math.cos(rel); // pendenza nella direzione di marcia
  const sgn = Math.sign(D.v);
  const heavy = D.barnie === 'aboard' ? 0.85 : 1; // con Barnie a bordo l'aria frena meno
  let a = -G * slope - sgn * (ROLL + DRAG * heavy * D.v * D.v);
  if (brakeIn > 0 && !reverse) a -= sgn * BRAKE * brakeIn;
  if (reverse) {
    // spingono all'indietro, piano (e tengono ferma la macchina contro la discesa)
    a = (-1.4 - D.v) * 3;
  }
  // chi spinge (solo se sono scesi)
  D.pushT += dt;
  // quanto forte riescono a spingere (in salita meno; con Barnie di più)
  const pushV = (D.barnie === 'aboard' ? 6.4 : 5.2) - Math.max(0, slope) * 30;
  if (D.pushing && D.started && !D.finished && brakeIn === 0 && !reverse) {
    if (D.v < pushV) a += PUSH_ACC + Math.max(0, slope) * G; // spingono anche contro la salita
  }
  const v0 = D.v;
  D.v += a * dt;
  // il freno ferma, non fa andare all'indietro
  if (brakeIn > 0 && !reverse && Math.sign(D.v) !== Math.sign(v0) && v0 !== 0) D.v = 0;
  if (Math.abs(D.v) < 0.03 && Math.abs(a) < 0.2) D.v = 0;

  // --- sterzo: le gomme tengono fino a GRIP ---
  const demand = (D.v * Math.tan(D.steer * MAX_STEER)) / WHEELBASE;
  const maxYaw = GRIP / Math.max(Math.abs(D.v), 0.5);
  const yaw = clamp(demand, -maxYaw, maxYaw);
  D.skid = Math.abs(demand) > maxYaw ? Math.min(1, (Math.abs(demand) - maxYaw) / maxYaw) : 0;
  D.th += yaw * dt;

  // --- movimento ---
  D.x += Math.sin(D.th) * D.v * dt;
  D.z += Math.cos(D.th) * D.v * dt;
  project();

  // --- bordi della strada (marciapiedi, guardrail) ---
  walls(g);
  // --- ostacoli ---
  obstacles(g);
  const q = ROAD.at(D.s);
  D.y = q.y;

  // --- pushers: scendono quando si ferma, risalgono quando va ---
  if (D.started && !D.finished) {
    if (reverse) {
      // stanno già spingendo indietro
    } else if (!D.pushing && D.v < pushV - 1.0 && slope > -0.03 && brakeIn === 0 && D.pushT > 1.2) {
      D.pushing = true;
      D.pushT = 0;
      if (!D.fired.has('primaSpinta') && D.s > 40) {
        D.fired.add('primaSpinta');
        sub(g, 'marco', 'Si ferma! Giù tutti, si spinge!');
        sub(g, 'luca', 'Finalmente. Mi mancava.');
      } else sub(g, 'marco', pick(['Spingiamo!', 'Giù! Spinta!', 'Forza Luca!', 'Ancora tu, salita?']));
      g.audio.land();
    } else if (D.pushing && (D.v > pushV + 0.8 || (slope < -0.05 && D.v > 3.2)) && D.pushT > 1.0) {
      D.pushing = false;
      D.pushT = 0;
      if (!D.fired.has('vaDaSola')) {
        D.fired.add('vaDaSola');
        sub(g, 'luca', 'Si muove... SI MUOVE DA SOLA!');
        sub(g, 'marco', 'SALTATE SU!');
        sub(g, 'luca', 'Tutta la vita che la spingo. TUTTA LA VITA.');
      } else sub(g, 'marco', pick(['Su, su!', 'Saltate dentro!', 'Va! Va!']));
      g.audio.land();
    }
  }
  g.audio.car(D.v, brakeIn, D.skid);
  D.shake = Math.max(0, D.shake - dt * 2.5);
}

function project() {
  const D = DRIVE;
  const pr = ROAD.project(D.x, D.z, D.idx);
  D.s = pr.s;
  D.d = pr.d;
  D.idx = pr.i;
}

// ingombro laterale della macchina messa di traverso
const extent = (rel: number) => HALF_W * Math.abs(Math.cos(rel)) + HALF_L * Math.abs(Math.sin(rel));

function walls(g: Game) {
  const D = DRIVE;
  const p = ROAD.at(D.s);
  let rel = wrap(D.th - p.th);
  const lim = p.hw - extent(rel);
  if (Math.abs(D.d) <= lim) return;
  const side = Math.sign(D.d);
  const lateral = D.v * Math.sin(rel) * side; // velocità verso il muro
  D.d = side * lim;
  const q = ROAD.point(D.s, D.d);
  D.x = q.x;
  D.z = q.z;
  if (lateral > 5.5) {
    crash(g, `contro ${ROAD.open[Math.floor(D.s)] ? 'il guardrail' : 'il marciapiede'}`);
    D.v *= 0.4;
    rel *= 0.15;
  } else if (lateral > 2.2) {
    bump(g, lateral);
    D.v *= 0.78;
    rel *= 0.4;
  } else {
    // strisci contro il bordo: rallenti e ti raddrizzi
    D.v *= 1 - 0.02;
    rel *= 0.9;
    if (Math.random() < 0.08 && Math.abs(D.v) > 2) g.audio.scrape();
  }
  // ruota verso la strada (mai dentro il muro)
  if (Math.sign(rel) === side && Math.abs(D.v) > 0.1) rel *= 0.5;
  D.th = p.th + rel;
}

function obstacles(g: Game) {
  const D = DRIVE;
  const rel = wrap(D.th - ROAD.at(D.s).th);
  const ext = extent(rel);
  const halfS = HALF_L * Math.abs(Math.cos(rel)) + HALF_W * Math.abs(Math.sin(rel));
  for (const o of REFS.obstacles) {
    if (D.s + halfS < o.s0 || D.s - halfS > o.s1 || D.d + ext < o.d0 || D.d - ext > o.d1) continue;
    // di quanto siamo dentro: di fronte o di lato?
    const penS = D.v >= 0 ? D.s + halfS - o.s0 : o.s1 - (D.s - halfS);
    const penD = Math.min(D.d + ext - o.d0, o.d1 - (D.d - ext));
    if (penS < penD && penS < 3) {
      const impact = Math.abs(D.v * Math.cos(rel));
      D.s = D.v >= 0 ? o.s0 - halfS - 0.02 : o.s1 + halfS + 0.02;
      const q = ROAD.point(D.s, D.d);
      D.x = q.x;
      D.z = q.z;
      if (o.kind === 'barrier') {
        // gli scatoloni in fondo: morbidi
        if (impact > 4) bump(g, impact * 0.6);
        D.v = 0;
      } else if (impact > 5) {
        crash(g, `contro ${o.name}`);
        D.v = -0.15 * D.v;
      } else {
        if (impact > 1.5) bump(g, impact);
        D.v = -0.1 * D.v;
      }
    } else {
      const side = D.d < (o.d0 + o.d1) / 2 ? -1 : 1;
      D.d = side < 0 ? o.d0 - ext - 0.02 : o.d1 + ext + 0.02;
      const q = ROAD.point(D.s, D.d);
      D.x = q.x;
      D.z = q.z;
      const lateral = Math.abs(D.v * Math.sin(rel));
      if (lateral > 5.5) crash(g, `contro ${o.name}`);
      else if (lateral > 2.2) bump(g, lateral);
      D.v *= 0.85;
      D.th = ROAD.at(D.s).th + rel * 0.4;
    }
  }
  // coni del cantiere: volano via
  for (const c of REFS.cones) {
    if (c.hit || Math.abs(c.s - D.s) > halfS + 0.3 || Math.abs(c.d - D.d) > ext + 0.3) continue;
    c.hit = true;
    const f = new THREE.Vector3(Math.sin(D.th), 0, Math.cos(D.th));
    c.vel.copy(f.multiplyScalar(Math.max(3, D.v * 0.9))).add(new THREE.Vector3((Math.random() - 0.5) * 4, 3.5, (Math.random() - 0.5) * 4));
    c.spin = (Math.random() - 0.5) * 14;
    D.v *= 0.94;
    g.audio.bump(0.5);
    if (!D.fired.has('cono')) {
      D.fired.add('cono');
      sub(g, 'luca', 'Un cono! Adesso sono tre cerchi e un cono.');
    }
  }
}

// urto forte: si perde un pezzo (e la torta un piano)
function crash(g: Game, where: string) {
  const D = DRIVE;
  g.audio.crash();
  D.shake = 1;
  g.hud.inkSplat(THEME.inkHex);
  D.crashes++;
  cakeHit(g);
  if (D.pieces <= 0) {
    fail(g, 'La macchina di Luca è tornata un rettangolo', `Hai preso ${where} una volta di troppo. Luca raccoglie i cerchi, uno per uno, e non dice niente. È peggio di quando dice qualcosa.`);
    return;
  }
  const id = PIECE_ORDER.find((p) => !D.lost.includes(p))!;
  D.lost.push(id);
  D.pieces--;
  detachPiece(g, id);
  g.toast(`SBAM! Hai perso <b>${PIECE_NAMES[id]}</b>. ${D.pieces === 0 ? 'Al prossimo urto la macchina è finita.' : `Restano ${D.pieces} pezzi da perdere.`}`, 'bad', 3800);
  sub(g, 'luca', pick(['Ahia! Cioè: ahia per lei.', `${cap1(PIECE_NAMES[id])}! Era il mio preferito!`, 'La sto sentendo, sai. Soffre.', 'Piano! È di cartone!']));
}

function bump(g: Game, k: number) {
  g.audio.bump(Math.min(1, k / 5));
  DRIVE.shake = Math.max(DRIVE.shake, Math.min(0.6, k / 8));
  if (k > 3.5) cakeHit(g);
}

function cakeHit(g: Game) {
  if (DRIVE.torta <= 0) return;
  DRIVE.torta--;
  g.toast(DRIVE.torta > 0 ? `La torta di Nonna Pina ha perso un piano. Ne restano ${DRIVE.torta}.` : 'La torta di Nonna Pina è diventata una crostata.', 'bad', 3000);
}

function detachPiece(g: Game, id: PieceId) {
  const car = REFS.car!;
  const orig = car.pieces[id];
  orig.visible = false;
  // una copia vola via dalla macchina e resta per strada
  const deb = orig.clone();
  deb.visible = true;
  car.root.updateMatrixWorld(true);
  deb.applyMatrix4(car.root.matrixWorld);
  g.world.group.add(deb);
  const f = new THREE.Vector3(Math.sin(DRIVE.th), 0, Math.cos(DRIVE.th));
  flying.push({
    obj: deb,
    vel: f.multiplyScalar(DRIVE.v * 0.6).add(new THREE.Vector3((Math.random() - 0.5) * 3, 3.5, (Math.random() - 0.5) * 3)),
    spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    kind: 'debris',
    t: 0,
    rest: false,
  });
}

// =========================================================================
// PASSEGGERI E SPINTE
// =========================================================================
function riders(g: Game): NPC[] {
  const out = [g.npc('marco'), g.npc('luca')];
  if (DRIVE.barnie === 'aboard') out.push(g.npc('barnie'));
  return out;
}

function placePassengers(g: Game, dt: number) {
  const car = REFS.car;
  if (!car) return;
  const D = DRIVE;
  const f = new THREE.Vector3(Math.sin(D.th), 0, Math.cos(D.th));
  const left = new THREE.Vector3(Math.cos(D.th), 0, -Math.sin(D.th));
  const list = riders(g);
  list.forEach((n, i) => {
    const body = n.body instanceof Stickman ? n.body : null;
    n.controlled = true;
    if (D.pushing && !D.finished) {
      // dietro la macchina, a spingere (davanti, se spingono all'indietro)
      const lat = list.length === 3 ? [0.55, -0.55, 0][i] : [0.45, -0.45][i];
      const back = (i === 2 ? 2.55 : 2.3) * (D.backT > 0.6 ? -1 : 1);
      const x = D.x - f.x * back + left.x * lat, z = D.z - f.z * back + left.z * lat;
      n.pos.set(x, ROAD.heightAt(x, z, D.idx), z);
      n.body.root.rotation.y = D.th + (D.backT > 0.6 ? Math.PI : 0);
      n.ctrlSpeed = Math.abs(D.v) > 0.3 ? Math.abs(D.v) : 0;
      if (body) {
        body.seated = false;
        body.action = 'push';
      }
    } else {
      const seat = i === 0 ? car.seats.passenger : i === 1 ? car.seats.backL : car.seats.backR;
      const local = seat.clone();
      local.y = i === 2 ? -0.16 : 0.08;
      n.pos.copy(local.applyMatrix4(car.root.matrixWorld));
      n.body.root.rotation.y = D.th;
      n.ctrlSpeed = 0;
      if (body) {
        body.seated = true;
        body.action = 'none';
      }
    }
  });
  void dt;
}

// =========================================================================
// L'INSEGUIMENTO: la Scatola da 24
// =========================================================================
const PASTELLI = ['px0', 'px1', 'px2', 'px3', 'px4', 'px5'];

export function startChase(g: Game) {
  DRIVE.chaseOn = true;
  DRIVE.chaseS = -46;
  DRIVE.chaseV = 0;
  for (const id of [...PASTELLI, 'pastellone']) {
    const n = g.npc(id);
    g.setHidden(n, false);
    n.controlled = true;
  }
  REFS.scatola!.visible = true;
  // la transenna della Via della Cera: i Pastelli la tolgono di mezzo
  if (REFS.transenna) REFS.transenna.visible = false;
  if (REFS.transennaCol) g.world.colliders.remove(REFS.transennaCol);
}

function chasePoint(s: number, d: number) {
  if (s >= 0) return ROAD.point(s, d);
  // prima della strada: arrivano dritti dalla Via della Cera
  return new THREE.Vector3(d, 0, 6 + s);
}

function updateChase(g: Game, dt: number) {
  const D = DRIVE;
  if (!D.chaseOn) return;
  const gap = D.s - D.chaseS;
  const cp = D.chaseS >= 0 ? ROAD.at(D.chaseS) : { grade: 0, curv: 0 };
  // in discesa vanno meno forte di te (sono in 24 ma la scatola frena), in piano e in salita di più
  let vt = cp.grade < -0.01 ? 7 + -cp.grade * 25 : 6.2 - Math.max(0, cp.grade) * 40;
  vt = Math.min(vt, 11);
  if (Math.abs(cp.curv) > 0.01) vt = Math.min(vt, Math.sqrt(8 / Math.abs(cp.curv)));
  if (gap > 110) vt *= 1.3; // prendono le scorciatoie
  if (gap < 25) vt = Math.min(vt, Math.max(D.v, 0) + 2.2);
  D.chaseV += clamp(vt - D.chaseV, -4 * dt, 3 * dt);
  D.chaseS += D.chaseV * dt;
  if (gap > 170) D.chaseS = D.s - 170;
  D.chaseD += ((gap < 30 ? D.d : 0) - D.chaseD) * Math.min(1, dt * 1.5);
  // attaccati al paraurti
  if (gap < 5.6) {
    D.chaseS = Math.min(D.chaseS, D.s - 4.4);
    D.grab += dt / 2.8;
    if (!D.fired.has('grab')) {
      D.fired.add('grab');
      sub(g, 'marco', 'Ci hanno preso il paraurti! Vai, VAI!');
    }
    if (D.grab >= 1) {
      fail(g, 'Vi hanno presi!', "La Scatola da 24 vi raggiunge. Ventiquattro Pastelli vi colorano tutti, dentro e fuori. Ci vorranno giorni per tornare in bianco e nero.");
      return;
    }
  } else D.grab = Math.max(0, D.grab - dt / 1.5);
  if (gap < 32 && !D.fired.has('vicini')) {
    D.fired.add('vicini');
    sub(g, 'luca', 'Sono dietro di noi!');
  }
  // tirano la cera sul vetro
  if (gap < 22 && gap > 3) {
    D.waxT -= dt;
    if (D.waxT <= 0) {
      D.waxT = 1.3 + Math.random() * 1.4;
      const pl = g.npc('pastellone');
      if (Math.random() < 0.72) {
        const col = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.viola][Math.floor(Math.random() * 5)];
        shield?.splat(col);
        g.audio.splat(g.player.camera.position);
        if (!D.fired.has('cera')) {
          D.fired.add('cera');
          sub(g, 'marco', 'Mi hanno colorato il vetro! TERGICRISTALLO!');
          g.toast(`<b>${keyName('interact')}</b>: Marco pulisce il vetro. Col braccio. È il tergicristallo.`, 'info', 5000);
        }
      }
      if (Math.random() < 0.5) pl.say(pick(['A CERA!', 'Fermatevi!', 'Il tappo!', 'Ti coloro il parabrezza!', 'Prendete questo! È verde!', 'Ridateci la dignità!']), 2.2);
    }
  }
}

function placeScatola(g: Game, dt: number) {
  const box = REFS.scatola;
  if (!box || !DRIVE.chaseOn) return;
  const D = DRIVE;
  const p = chasePoint(D.chaseS, D.chaseD);
  const th = D.chaseS >= 0 ? ROAD.at(D.chaseS).th : 0;
  const grade = D.chaseS >= 0 ? ROAD.at(D.chaseS).grade : 0;
  box.position.copy(p);
  box.rotation.set(-Math.atan(grade), th, 0);
  box.updateMatrixWorld(true);
  const f = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
  const left = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
  const riding = D.chaseV > 7.5 && grade < -0.02;
  PASTELLI.forEach((id, i) => {
    const n = g.npc(id);
    const body = n.body instanceof Stickman ? n.body : null;
    n.controlled = true;
    if (riding) {
      // seduti sul bordo della scatola
      const local = new THREE.Vector3(-0.9 + (i % 3) * 0.9, 1.45, i < 3 ? -1.2 : 0.1);
      n.pos.copy(local.applyMatrix4(box.matrixWorld));
      n.ctrlSpeed = 0;
      if (body) {
        body.seated = true;
        body.action = 'none';
      }
    } else {
      const lat = -1.0 + (i % 3) * 1.0;
      const back = i < 3 ? 2.2 : 2.9;
      const x = p.x - f.x * back + left.x * lat, z = p.z - f.z * back + left.z * lat;
      n.pos.set(x, D.chaseS - back >= 0 ? ROAD.heightAt(x, z, Math.max(0, Math.round(D.chaseS))) : 0, z);
      n.ctrlSpeed = D.chaseV;
      if (body) {
        body.seated = false;
        body.action = 'push';
      }
    }
    n.body.root.rotation.y = th;
  });
  const pl = g.npc('pastellone');
  pl.controlled = true;
  pl.pos.copy(new THREE.Vector3(0, 1.75, 0.9).applyMatrix4(box.matrixWorld));
  pl.body.root.rotation.y = th;
  pl.ctrlSpeed = 0;
  if (pl.body instanceof Stickman) pl.body.action = D.chaseV > 1 ? 'talk' : 'crossed';
  void dt;
}

// =========================================================================
// CAMERA: gli occhi di Stecco al posto di guida
// =========================================================================
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
function placeCamera(g: Game, dt: number) {
  const car = REFS.car;
  if (!car) return;
  const D = DRIVE;
  const pl = g.player;
  const eye = car.eye.clone().applyMatrix4(car.root.matrixWorld);
  if (D.shake > 0) eye.add(new THREE.Vector3((Math.random() - 0.5) * D.shake * 0.12, (Math.random() - 0.5) * D.shake * 0.08, (Math.random() - 0.5) * D.shake * 0.12));
  // un po' di vibrazione della strada (le ruote sono di cartone)
  eye.y += Math.sin(g.time * 23) * Math.min(0.012, Math.abs(D.v) * 0.0008);
  pl.pos.set(eye.x, eye.y - 1.15, eye.z);
  pl.floor = pl.pos.y;
  pl.vy = 0;
  // lo sguardo gira insieme alla macchina
  pl.yaw += wrap(D.th - D.prevTh);
  D.prevTh = D.th;
  let rel = wrap(pl.yaw - (D.th + Math.PI));
  rel = clamp(rel, -2.8, 2.8);
  pl.yaw = D.th + Math.PI + rel;
  pl.pitch = clamp(pl.pitch, -1.0, 0.9);
  const cam = pl.camera;
  cam.position.copy(eye);
  _e.set(pl.pitch, Math.PI + rel, 0, 'YXZ');
  _q.setFromEuler(_e);
  cam.quaternion.copy(car.root.quaternion).multiply(_q);
  // il parabrezza si vede solo guardando avanti
  shield?.update(dt, clamp(1 - (Math.abs(rel) - 0.5) / 0.7, 0, 1));
}

// =========================================================================
// CLACSON, TERGICRISTALLO, POSTA, TAPPI
// =========================================================================
function honk(g: Game) {
  DRIVE.honkT = 0.6;
  g.audio.horn();
  if (!DRIVE.fired.has('bip')) {
    DRIVE.fired.add('bip');
    sub(g, 'player', 'Bip.');
    sub(g, 'luca', 'Il clacson non ce l\'ha. Però lo dici bene.');
  } else sub(g, 'player', pick(['Bip.', 'BIP.', 'Bip bip.', 'Biiip.']), 1.2);
  // chi è davanti si sposta
  for (const sh of sheep) if (!sh.gone && sh.s > DRIVE.s - 5 && sh.s < DRIVE.s + 45) sh.flee = Math.sign(sh.d || Math.random() - 0.5);
  if (NONNA.state === 'cross' && NONNA.s - DRIVE.s < 50) {
    NONNA.speed = 2.3;
    g.npc('nonnaMercato').say('Sì, sì! Vado! Che fretta!', 2.5);
  }
}

function wipe(g: Game) {
  DRIVE.wipeCd = 0.8;
  shield?.wipe();
  g.audio.wiper();
}

function throwLetter(g: Game) {
  DRIVE.throwCd = 0.35;
  DRIVE.letters--;
  if (!envelopeMat) envelopeMat = new THREE.SpriteMaterial({ map: envelopeTexture(), alphaTest: 0.5 });
  const sp = new THREE.Sprite(envelopeMat);
  sp.scale.set(0.42, 0.3, 1);
  const cam = g.player.camera;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  sp.position.copy(cam.position).addScaledVector(dir, 0.6);
  g.world.group.add(sp);
  const carV = new THREE.Vector3(Math.sin(DRIVE.th), 0, Math.cos(DRIVE.th)).multiplyScalar(DRIVE.v * 0.5);
  let vel = carV.add(dir.clone().multiplyScalar(13)).add(new THREE.Vector3(0, 2.2, 0));
  // mira aiutata: se guardi abbastanza vicino a una cassetta, la lettera ci va
  const assist = TOUCH ? 0.3 : 0.18;
  let best: { mb: (typeof REFS.mailboxes)[number]; a: number } | null = null;
  for (const mb of REFS.mailboxes) {
    if (mb.done) continue;
    const to = mb.pos.clone().sub(sp.position);
    const dist = to.length();
    if (dist > 22 || dist < 1) continue;
    const a = to.normalize().angleTo(dir);
    if (a < assist && (!best || a < best.a)) best = { mb, a };
  }
  if (best) {
    const to = best.mb.pos.clone().add(new THREE.Vector3(0, 0.1, 0)).sub(sp.position);
    const T = Math.max(0.35, to.length() / 14);
    vel = to.divideScalar(T).add(new THREE.Vector3(0, (G * T) / 2, 0));
  }
  flying.push({ obj: sp, vel, spin: new THREE.Vector3(), kind: 'letter', t: 0, rest: false });
  g.audio.whoosh();
}

function updateLetters(g: Game, dt: number) {
  void dt;
  for (const f of flying) {
    if (f.kind !== 'letter' || f.rest) continue;
    for (const mb of REFS.mailboxes) {
      if (mb.done) continue;
      const p = f.obj.position;
      if (Math.hypot(p.x - mb.pos.x, p.z - mb.pos.z) < 1.35 && Math.abs(p.y - mb.pos.y) < 1.0) {
        mb.done = true;
        f.rest = true;
        f.obj.visible = false;
        DRIVE.delivered++;
        g.audio.mailbox();
        g.addCoins(3, true);
        g.toast(`✉ Posta consegnata! <b>${DRIVE.delivered}</b> su ${REFS.mailboxes.length} <small>(+3 monete)</small>`, 'reward', 2600);
      }
    }
  }
  // bandierine alzate
  for (const mb of REFS.mailboxes) if (mb.done) mb.flag.rotation.x += (0 - mb.flag.rotation.x) * Math.min(1, dt * 6);
  if (g.questActive('posta') && !DRIVE.fired.has('posta') && DRIVE.s > 56 && DRIVE.letters > 0) {
    DRIVE.fired.add('posta');
    g.toast(`Cassette blu! Guarda di lato e lancia la posta con <b>${attackName() === 'click' ? 'il click' : 'LANCIA'}</b>.`, 'quest', 5500);
  }
}

function updateFlying(dt: number) {
  for (const f of flying) {
    if (f.rest) continue;
    f.t += dt;
    f.vel.y -= G * dt;
    f.obj.position.addScaledVector(f.vel, dt);
    f.obj.rotation.x += f.spin.x * dt;
    f.obj.rotation.y += f.spin.y * dt;
    f.obj.rotation.z += f.spin.z * dt;
    const ground = ROAD.heightAt(f.obj.position.x, f.obj.position.z, DRIVE.idx);
    if (f.obj.position.y < ground + (f.kind === 'letter' ? 0.05 : 0.2)) {
      f.obj.position.y = ground + (f.kind === 'letter' ? 0.05 : 0.2);
      f.rest = true;
      if (f.kind === 'letter') setTimeout(() => (f.obj.visible = false), 1500);
    }
  }
}

function updateCones(dt: number) {
  for (const c of REFS.cones as Cone[]) {
    if (!c.hit || c.vel.lengthSq() === 0) continue;
    c.vel.y -= G * dt;
    c.obj.position.addScaledVector(c.vel, dt);
    c.obj.rotation.x += c.spin * dt;
    c.obj.rotation.z += c.spin * 0.6 * dt;
    const ground = ROAD.heightAt(c.obj.position.x, c.obj.position.z, Math.round(c.s));
    if (c.obj.position.y < ground) {
      c.obj.position.y = ground;
      c.vel.set(0, 0, 0);
      c.obj.rotation.set(Math.PI / 2, c.obj.rotation.y, 0);
    }
  }
}

function updateCaps(g: Game) {
  const D = DRIVE;
  for (const c of REFS.caps) {
    if (c.taken) continue;
    c.sprite.scale.x = 0.55 * Math.max(0.15, Math.abs(Math.cos(g.time * 3 + c.s)));
    if (Math.abs(c.s - D.s) < 2.3 && Math.abs(c.d - D.d) < 1.5) {
      c.taken = true;
      c.sprite.visible = false;
      D.caps++;
      g.audio.pop();
      if (g.questActive('tappi')) g.toast(`Tappo! <b>${D.caps}</b> per Martina`, 'reward', 1600);
    }
  }
}

// =========================================================================
// PECORE (nuvole con le gambe) E LA NONNA SULLE STRISCE
// =========================================================================
export function spawnSheep(g: Game) {
  const tex = cloudTexture(501);
  const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.3 });
  for (let i = 0; i < 7; i++) {
    const o = new THREE.Group();
    const body = new THREE.Sprite(mat);
    body.scale.set(1.5, 0.95, 1);
    body.position.y = 0.95;
    o.add(body);
    const sk = new Sketch();
    sk.style = { jitter: 0.01, over: 0 };
    for (const [x, z] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) sk.seg(x, 0, z, x, 0.6, z);
    sk.circle(0.72, 1.05, 0, 0.16, 'z', 10, 0.05);
    o.add(sk.build(REFS.lmD!, new THREE.MeshBasicMaterial()));
    g.world.group.add(o);
    sheep.push({ obj: o, s: S.gregge - 8 + i * 5 + Math.random() * 3, d: (Math.random() - 0.5) * 8, vd: 0, vs: 0, flee: 0, gone: false, bleatT: Math.random() * 3, hop: 0 });
  }
  placeSheep();
}

function placeSheep() {
  for (const sh of sheep) {
    const p = ROAD.point(sh.s, sh.d);
    sh.obj.position.set(p.x, p.y + Math.max(0, Math.sin(sh.hop) * 0.8), p.z);
    sh.obj.rotation.y = ROAD.at(sh.s).th + (sh.flee ? (sh.flee > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2);
    sh.obj.visible = !sh.gone;
  }
}

function updateSheep(g: Game, dt: number) {
  if (!sheep.length || Math.abs(DRIVE.s - S.gregge) > 120) return;
  if (!DRIVE.fired.has('gregge') && DRIVE.s > S.gregge - 70) {
    DRIVE.fired.add('gregge');
    g.toast(`Un gregge in mezzo alla strada! Suona il clacson: <b>${keyName('jump')}</b>`, 'quest', 5000);
    sub(g, 'marco', 'Pecore! Sono nuvole con le gambe! Suona!');
  }
  const D = DRIVE;
  for (const sh of sheep) {
    if (sh.gone) continue;
    if (sh.flee) {
      sh.d += sh.flee * 3.2 * dt;
      sh.hop += dt * 9;
      if (Math.abs(sh.d) > 9) sh.gone = true;
    } else {
      // brucano girando a caso
      sh.vd += (Math.random() - 0.5) * dt * 2;
      sh.vd = clamp(sh.vd, -0.6, 0.6);
      sh.d = clamp(sh.d + sh.vd * dt, -4.6, 4.6);
    }
    sh.bleatT -= dt;
    if (sh.bleatT <= 0) {
      sh.bleatT = 2.5 + Math.random() * 4;
      if (Math.abs(sh.s - D.s) < 40) g.audio.bleat(sh.obj.position);
    }
    // urto: la pecora rimbalza (è una nuvola), la macchina rallenta
    if (!sh.flee && Math.abs(sh.s - D.s) < 2.4 && Math.abs(sh.d - D.d) < 1.5) {
      sh.flee = Math.sign(sh.d - D.d) || 1;
      sh.hop = 0;
      D.v *= 0.5;
      g.audio.bump(0.4);
      g.audio.bleat(sh.obj.position);
      sub(g, 'luca', pick(['Era soffice, almeno.', 'Scusi, signora pecora!', 'È rimbalzata. Le nuvole rimbalzano.']));
    }
  }
  placeSheep();
}

function updateNonna(g: Game, dt: number) {
  const n = g.npcs.find((x) => x.id === 'nonnaMercato');
  if (!n) return;
  const D = DRIVE;
  if (NONNA.state === 'wait' && D.s > NONNA.s - 65) {
    NONNA.state = 'cross';
    n.say('Attraverso! Sulle strisce!', 3);
  }
  if (NONNA.state === 'cross') {
    NONNA.d += NONNA.speed * dt;
    if (NONNA.d > 8.5) NONNA.state = 'done';
    // davanti alla macchina: la nonna ti ferma col bastone
    if (Math.abs(NONNA.s - D.s) < 2.6 && Math.abs(NONNA.d - D.d) < 1.4 && D.v > 0.5) {
      D.v *= 0.35;
      D.s = NONNA.s - 2.65;
      NONNA.speed = 2.3;
      const q = ROAD.point(D.s, D.d);
      D.x = q.x;
      D.z = q.z;
      g.audio.bump(0.8);
      D.shake = 0.5;
      n.say('GIOVANOTTO! LE STRISCE!', 3);
      if (!D.fired.has('nonnaColpo')) {
        D.fired.add('nonnaColpo');
        g.toast('La nonna ferma la macchina col bastone. Da ferma. Le nonne di Quadropoli sono così.', 'bad', 4500);
      }
    }
  }
  const p = ROAD.point(NONNA.s, NONNA.d, NONNA.d < -6.4 || NONNA.d > 6.4 ? 0.15 : 0);
  n.controlled = true;
  n.pos.copy(p);
  n.ctrlSpeed = NONNA.state === 'cross' ? NONNA.speed : 0;
  n.body.root.rotation.y = ROAD.at(NONNA.s).th + Math.PI / 2;
}

// =========================================================================
// MOMENTI DEL PERCORSO, TAPPE E FALLIMENTI
// =========================================================================
function once(id: string, cond: boolean, fn: () => void) {
  if (cond && !DRIVE.fired.has(id)) {
    DRIVE.fired.add(id);
    fn();
  }
}

function events(g: Game) {
  const D = DRIVE;
  const s = D.s;
  once('comandi', s > 8, () =>
    g.toast(
      TOUCH
        ? 'Il joystick sterza (in giù frena). Il volante è quello rotondo.'
        : `Sterzi con <b>${keyName('left')}</b>/<b>${keyName('right')}</b>, freni con <b>${keyName('back')}</b>. L'acceleratore non c'è: c'è la discesa.`,
      'quest',
      7000,
    ),
  );
  once('tachimetro', s > 70, () => sub(g, 'luca', 'Il tachimetro è disegnato. Segna zero. Sempre. Però è preciso.'));
  once('barnieVisto', s > S.barnie - 55 && D.barnie === 'none', () => {
    g.npc('barnie').say('Passaggio? Vado giù.', 4);
    g.toast("Un autostoppista gigante sulla piazzola, a destra: frena e fermati accanto a lui per caricarlo.", 'quest', 5500);
  });
  // Barnie sale se ti fermi accanto a lui
  if (D.barnie === 'none' && Math.abs(D.s - S.barnie) < 7 && D.d < -1 && Math.abs(D.v) < 0.8) {
    D.barnie = 'aboard';
    DRIVE_HOOKS.barnieUp?.(g);
  }
  once('barniePerso', D.barnie === 'none' && s > S.barnie + 14, () => {
    D.barnie = 'missed';
    g.npc('barnie').say("Sarà per un'altra volta.", 4);
  });
  once('tornanti', s > S.tornanti - 12, () => {
    sub(g, 'luca', 'I tornanti! Da spingere erano bellissimi.');
    g.toast(`Frena <b>prima</b> delle curve (${keyName('back')}): troppo veloce e le gomme non tengono.`, 'quest', 5500);
  });
  once('mercato', s > S.mercato + 2, () => sub(g, 'marco', 'Qui è in piano! Non perdere lo slancio!'));
  once('ponte', s > S.ponte + 6, () => {
    sub(g, 'luca', 'Non guardate giù.');
    sub(g, 'marco', 'Perché?');
    sub(g, 'luca', "Non c'è niente. Non l'hanno ancora disegnato.");
  });
  once('salita', s > S.salita + 2, () => sub(g, 'marco', 'Salita! Più veloce arrivi, meno spingiamo!'));
  once('cresta', s > S.cresta + 6, () => sub(g, 'luca', 'Da qui è tutta discesa. Lo so perché stanotte era tutta salita.'));
  once('cantiere', s > S.cantiere - 40, () => {
    sub(g, 'marco', 'Hanno cancellato un pezzo di strada?!');
    sub(g, 'luca', 'Chi è che cancella una strada?');
    g.toast('Metà strada non c\'è più: resta a destra dei coni.', 'quest', 4500);
  });
  once('arrivo', s > S.arrivo + 4, () => {
    sub(g, 'marco', 'San Scarabocchio! Il Parallelepipedo è in fondo a sinistra: frena lì!');
    g.toast('Fermati davanti al Parallelepipedo (a sinistra, dopo il pub).', 'quest', 5000);
  });
  once('dario', D.barnie === 'aboard' && s > S.dario - 45, () => sub(g, 'barnie', 'Il pub di Dario è lì a destra. Se ti fermi, scendo.'));
  // Barnie scende da Dario
  if (D.barnie === 'aboard' && Math.abs(D.s - S.dario) < 9 && Math.abs(D.v) < 0.8) {
    D.barnie = 'dropped';
    DRIVE_HOOKS.barnieDown?.(g);
  }
  // arrivati: fermi davanti al Parallelepipedo (o contro gli scatoloni in fondo)
  if (!D.finished && D.s > S.fluo - 12 && Math.abs(D.v) < 0.6) {
    D.finished = true;
    D.chaseOn = true;
    g.audio.car(0, 0, 0);
    DRIVE_HOOKS.arrive?.(g);
  }
}

const CHECKPOINTS = [
  { s: S.tornanti, name: 'I tornanti' },
  { s: S.mercato + 6, name: 'Il mercato' },
  { s: S.cresta + 4, name: 'La cresta' },
  { s: S.gregge - 60, name: 'La grande discesa' },
];

function checkpoints(g: Game) {
  const D = DRIVE;
  for (const c of CHECKPOINTS) {
    if (D.s < c.s || D.fired.has(`cp_${c.s}`)) continue;
    D.fired.add(`cp_${c.s}`);
    // Luca ridisegna al volo un pezzo perso
    if (D.lost.length) {
      const id = D.lost.pop()!;
      D.pieces++;
      REFS.car!.pieces[id].visible = true;
      g.toast(`${c.name}. Luca ridisegna ${PIECE_NAMES[id]} al volo, sporgendosi dal finestrino.`, 'info', 4000);
    }
    D.cp = { s: c.s, v: clamp(D.v, 4, 12), pieces: D.pieces, torta: D.torta, name: c.name };
  }
}

function fail(g: Game, title: string, text: string) {
  g.audio.car(0, 0, 0);
  g.gameOver(title, text, () => retry(g));
}

// Si riparte dall'ultima tappa (o dalla piazza)
function retry(g: Game) {
  const D = DRIVE;
  const cp = D.cp;
  const s = cp ? cp.s : S.car;
  placeCarAt(s, cp ? -1.5 : 0, cp ? cp.v : 0);
  D.pieces = Math.max(2, cp ? cp.pieces : PIECES_MAX);
  D.lost = PIECE_ORDER.slice(0, PIECES_MAX - D.pieces);
  for (const id of PIECE_ORDER) REFS.car!.pieces[id].visible = !D.lost.includes(id);
  if (cp) D.torta = D.torta < 0 ? -1 : Math.max(D.torta, cp.torta);
  D.chaseS = s - (cp ? 70 : 49);
  D.chaseV = cp ? 6 : 0;
  D.chaseD = 0;
  D.grab = 0;
  D.waxT = 3;
  D.pushing = !cp;
  D.pushT = 0;
  D.shake = 0;
  // pezzi per terra e coni: rimessi a posto
  for (const f of flying) if (f.kind === 'debris') f.obj.removeFromParent();
  flying = flying.filter((f) => f.kind !== 'debris');
  for (const c of REFS.cones) {
    if (c.s < s) continue;
    c.hit = false;
    c.vel.set(0, 0, 0);
    c.obj.position.copy(ROAD.point(c.s, c.d));
    c.obj.rotation.set(0, 0, 0);
  }
  for (const sh of sheep) {
    if (sh.s < s) continue;
    sh.gone = false;
    sh.flee = 0;
    sh.hop = 0;
    sh.d = (Math.random() - 0.5) * 8;
  }
  placeSheep();
  if (s < NONNA.s) {
    NONNA.state = 'wait';
    NONNA.d = -8.5;
    NONNA.speed = 0.9;
  }
  shield?.clear();
  g.player.yaw = D.th + Math.PI;
  g.player.pitch = -0.03;
  subQueue = [];
  if (subEl) subEl.style.opacity = '0';
  g.toast(cp ? `Si riparte da: ${cp.name}.` : 'Si riparte dalla piazza.', 'info', 3000);
}

// =========================================================================
// INTERFACCIA: cruscotto, sottotitoli, parabrezza
// =========================================================================
function buildUi(g: Game) {
  hudEl?.remove();
  subEl?.remove();
  shield?.remove();
  shield = new Windshield(g.hud.root);
  hudEl = document.createElement('div');
  hudEl.className = 'chapter-ui drive-hud paper';
  g.hud.root.appendChild(hudEl);
  subEl = document.createElement('div');
  subEl.className = 'chapter-ui drive-sub';
  g.hud.root.appendChild(subEl);
}

let lastHud = '';
function updateUi(g: Game, dt: number) {
  const D = DRIVE;
  if (hudEl) {
    const kmh = Math.round(Math.abs(D.v) * 3.6);
    const pieces = '■'.repeat(D.pieces) + '□'.repeat(PIECES_MAX - D.pieces);
    const rows = [
      `<div class="speed"><b>${kmh}</b> km/h</div>`,
      `<div class="row">Macchina <span class="pz">${pieces}</span></div>`,
    ];
    if (g.questActive('posta')) rows.push(`<div class="row">✉ Posta <b>${D.delivered}</b>/${REFS.mailboxes.length} <small>(${D.letters} in mano)</small></div>`);
    if (g.questActive('tappi')) rows.push(`<div class="row">Tappi <b>${D.caps}</b></div>`);
    if (D.torta >= 0) rows.push(`<div class="row">Torta ${'▲'.repeat(D.torta)}${'△'.repeat(3 - D.torta)}</div>`);
    if (D.pushing && D.started && !D.finished) rows.push('<div class="row push">spingono Marco e Luca…</div>');
    const html = rows.join('');
    if (html !== lastHud) {
      hudEl.innerHTML = html;
      lastHud = html;
    }
    hudEl.style.display = D.started && !D.finished && !g.dialogue.isOpen ? '' : 'none';
  }
  // distanza dai Pastelli
  if (D.chaseOn && D.started && !D.finished) {
    const gap = Math.max(0, D.s - D.chaseS);
    g.hud.meter({
      label: D.grab > 0 ? `TI HANNO PRESO IL PARAURTI! (${Math.round(D.grab * 100)}%)` : `I Pastelli: ${Math.round(gap)} m dietro`,
      value: D.grab > 0 ? D.grab : clamp(1 - gap / 150, 0, 1),
      color: CERA.rosso,
    });
  }
  // sottotitoli
  if (subEl) {
    subT -= dt;
    if (subT <= 0 && subQueue.length) {
      const l = subQueue.shift()!;
      subEl.innerHTML = `<b>${l.who}</b> ${l.text}`;
      subEl.style.opacity = '1';
      subT = l.t;
      if (l.id !== 'player') g.audio.mumble(VOICES[l.id], l.text, g.player.camera.position);
    } else if (subT <= 0) subEl.style.opacity = '0';
    if (g.dialogue.isOpen) subEl.style.opacity = '0';
  }
}

const NAMES: Record<string, string> = { marco: 'Marco', luca: 'Luca', barnie: 'Barnie', player: 'Stecco' };
export function sub(g: Game, id: string, text: string, t = 2.6) {
  if (subQueue.length > 4) subQueue.shift();
  subQueue.push({ who: NAMES[id] ?? id, id, text, t: Math.max(t, 1 + text.length * 0.045) });
  void g;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const cap1 = (s: string) => s[0].toUpperCase() + s.slice(1);

// Il parabrezza: la cera dei Pastelli ci resta attaccata finché Marco non la pulisce col braccio
class Windshield {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  wiper: HTMLElement;
  wipeT = -1;
  private lastA = -1.4;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    this.el.className = 'chapter-ui windshield';
    parent.prepend(this.el);
    this.ctx = this.el.getContext('2d')!;
    this.wiper = document.createElement('div');
    this.wiper.className = 'chapter-ui wiper';
    parent.prepend(this.wiper);
    this.fit();
  }

  private fit() {
    const w = Math.round(VIEW.w), h = Math.round(VIEW.h);
    if (this.el.width !== w || this.el.height !== h) {
      this.el.width = w;
      this.el.height = h;
    }
  }

  // uno scarabocchio a pastello: più passate storte, con i buchi della cera
  splat(color: string) {
    this.fit();
    const { ctx } = this;
    const w = this.el.width, h = this.el.height;
    const cx = w * (0.2 + Math.random() * 0.6), cy = h * (0.15 + Math.random() * 0.45);
    const R = w * (0.06 + Math.random() * 0.05);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const kind = Math.floor(Math.random() * 3);
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = 0.55 + Math.random() * 0.25;
      ctx.lineWidth = Math.max(4, w * (0.006 + Math.random() * 0.006));
      ctx.setLineDash([w * 0.03 + Math.random() * w * 0.02, w * 0.004 + Math.random() * w * 0.006]);
      ctx.beginPath();
      const n = 10 + Math.floor(Math.random() * 8);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let x: number, y: number;
        if (kind === 0) {
          // groviglio: giri che si allargano
          const a = t * Math.PI * 5 + pass;
          x = cx + Math.cos(a) * R * (0.3 + t * 0.9) + (Math.random() - 0.5) * R * 0.3;
          y = cy + Math.sin(a) * R * 0.7 * (0.3 + t * 0.9) + (Math.random() - 0.5) * R * 0.3;
        } else if (kind === 1) {
          // zig-zag storto
          x = cx - R * 1.4 + t * R * 2.8 + (Math.random() - 0.5) * R * 0.25;
          y = cy + (i % 2 ? 1 : -1) * R * (0.4 + Math.random() * 0.6) + pass * R * 0.15;
        } else {
          // una specie di sole (disegnato da un Pastello arrabbiato)
          const a = t * Math.PI * 2;
          const rr = i % 2 ? R : R * 0.45;
          x = cx + Math.cos(a) * rr + (Math.random() - 0.5) * R * 0.2;
          y = cy + Math.sin(a) * rr + (Math.random() - 0.5) * R * 0.2;
        }
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  wipe() {
    if (this.wipeT < 0) {
      this.wipeT = 0;
      this.lastA = -1.4;
      this.wiper.style.display = 'block';
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
  }

  update(dt: number, opacity: number) {
    this.el.style.opacity = String(opacity);
    if (this.wipeT < 0) return;
    this.wipeT += dt / 0.6;
    const t = Math.min(1, this.wipeT);
    // il braccio va da sinistra a destra, perno in basso al centro
    const a = -1.4 + t * 2.8;
    const { ctx } = this;
    const w = this.el.width, h = this.el.height;
    const px = w / 2, py = h * 1.05, R = Math.hypot(w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(this.lastA) * R, py - Math.cos(this.lastA) * R);
    ctx.lineTo(px + Math.sin(a) * R, py - Math.cos(a) * R);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.lastA = a;
    this.wiper.style.transform = `translateX(-50%) rotate(${a}rad)`;
    if (this.wipeT >= 1) {
      this.wipeT = -1;
      this.clear();
      this.wiper.style.display = 'none';
    }
  }

  remove() {
    this.el.remove();
    this.wiper.remove();
  }
}

function envelopeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 46;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 3;
  ctx.fillRect(4, 4, 56, 38);
  ctx.strokeRect(4, 4, 56, 38);
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(32, 26);
  ctx.lineTo(60, 4);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
