import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { CHAIRS, COUNTER_Z, REFS11, WINDOWS, setDisplay } from './world';

// ---------------------------------------------------------------------------
// L'UFFICIO (capitolo 11): l'orologio, gli sportelli, i numeri.
//
// Il tempo: si parte alle 9:00, lo sportello A chiude alle 12:00. Due secondi veri = un minuto
// dell'ufficio. Mentre parli l'orologio si ferma (anche gli impiegati ascoltano); mentre compili un
// modulo, fai una fototessera o timbri, no.
// Ogni sportello ha i suoi orari e le sue pause (scritti sul muro). Il tabellone mostra l'ultimo
// numero chiamato. Chi ha preso un numero (i clienti seduti, tu, e anche chi se n'è andato: i
// "fantasmi") aspetta il suo turno; quando chiamano il tuo numero hai un po' di tempo per presentarti,
// poi passano al prossimo e il numero è perso.
// I clienti sono PNG veri: si alzano, vanno allo sportello, se ne vanno, tornano con un numero nuovo.
// ---------------------------------------------------------------------------

export type WinId = 'A' | 'B' | 'C' | 'D';
export const WIN_IDS: WinId[] = ['A', 'B', 'C', 'D'];
export const SEC_PER_MIN = 2;
export const END_MIN = 180; // le 12:00
export const GRACE = 30; // secondi veri per presentarti quando chiamano il tuo numero

export interface Customer {
  npc: NPC;
  state: 'seat' | 'go' | 'serve' | 'leave' | 'gone' | 'enter';
  chair: number;
  t: number;
  dest: [number, number] | null; // dove sta andando (l'ultimo punto della strada)
}

interface Ticket {
  n: number;
  who: 'npc' | 'ghost' | 'player';
  c?: Customer;
  tag?: string; // es. 'attesa': il numero del signor Attesa
}

interface Pause {
  from: number;
  to: number;
  label: string;
  walk: boolean; // l'impiegato va nell'angolo del personale (in fondo, dietro il bancone)
  skip?: () => boolean; // pausa saltata (es. il caffè portato a Tampona)
}

export interface Win {
  id: WinId;
  clerk: string;
  served: number;
  issued: number;
  queue: Ticket[];
  cur: Ticket | null;
  phase: 'idle' | 'call' | 'serve' | 'player' | 'away';
  t: number;
  service: number;
  open: number;
  close: number;
  pauses: Pause[];
  pause: Pause | null; // la pausa in corso
  back: boolean; // l'impiegato sta tornando dalla pausa
}

export const OFF = {
  min: 0,
  running: false,
  day: 1,
  wins: {} as Record<WinId, Win>,
  mine: { A: [], B: [], C: [], D: [] } as Record<WinId, number[]>,
  customers: [] as Customer[],
  arriveT: 8,
  blink: 0,
  coffee: false, // Tampona ha avuto il caffè: niente pausa
  panel: null as HTMLElement | null,
  panelHtml: '',
  steps: (() => []) as () => { t: string; on: boolean }[],
  onCall: null as ((w: Win, n: number) => void) | null,
  onSkip: null as ((w: Win, n: number) => void) | null,
  onGhost: null as ((w: Win, t: Ticket) => void) | null,
  warned: new Set<string>(),
};

// l'angolo del personale: in fondo a est, dietro il bancone (un tavolino e il bollitore)
export const STAFF: [number, number][] = [
  [13.7, -8.75],
  [14.9, -8.6],
];
const SEAT_Z = -7.85;
const CLERK_Y = 0.3; // gli impiegati stanno sugli sgabelli alti (si vedono sopra il bancone)
const EXIT: [number, number] = [0, 11.9];

export const hhmm = (min: number) => {
  const m = Math.max(0, Math.floor(min));
  const h = 9 + Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// la mattina (si ricomincia anche così, il giorno dopo)
// ---------------------------------------------------------------------------
export function setupOffice(g: Game, customers: NPC[]) {
  OFF.min = 0;
  OFF.running = false;
  OFF.mine = { A: [], B: [], C: [], D: [] };
  OFF.arriveT = 8;
  OFF.warned = new Set();
  const mk = (id: WinId, clerk: string, served: number, service: number, open: number, close: number, pauses: Pause[]): Win => ({
    id, clerk, served, issued: served, queue: [], cur: null, phase: 'idle', t: 1 + Math.random(), service, open, close, pauses, pause: null, back: false,
  });
  OFF.wins = {
    A: mk('A', 'cartella', 1, 8, 90, END_MIN, []),
    B: mk('B', 'spillatrice', 31, 9, 0, 210, [{ from: 120, to: 135, label: 'PAUSA MERENDA', walk: true }]),
    C: mk('C', 'tampona', 12, 7, 0, 210, [{ from: 60, to: 80, label: 'PAUSA CAFFÈ', walk: true, skip: () => OFF.coffee }]),
    D: mk('D', 'spiccioli', 50, 6, 0, 210, [{ from: 150, to: 165, label: 'CHIUSURA CASSA', walk: false }]),
  };
  // i clienti seduti, ognuno col suo numero; in mezzo i fantasmi (hanno preso il numero e se ne sono andati)
  const plan: [WinId, 'npc' | 'ghost' | 'attesa'][] = [
    ['A', 'attesa'], ['A', 'npc'], ['A', 'ghost'], ['A', 'npc'], ['A', 'ghost'],
    ['B', 'npc'], ['B', 'ghost'], ['B', 'npc'], ['B', 'npc'], ['B', 'ghost'],
    ['C', 'npc'], ['C', 'ghost'], ['C', 'npc'],
    ['D', 'npc'], ['D', 'ghost'],
  ];
  const chairs = [2, 9, 15, 20, 27, 4, 30, 12, 17, 24, 6, 33];
  OFF.customers = customers.map((npc) => ({ npc, state: 'gone' as const, chair: -1, t: 0, dest: null }));
  let ci = 0;
  for (const [w, kind] of plan) {
    const win = OFF.wins[w];
    const n = ++win.issued;
    if (kind === 'npc' && ci < OFF.customers.length) {
      const c = OFF.customers[ci];
      sitAt(g, c, chairs[ci]);
      ci++;
      win.queue.push({ n, who: 'npc', c });
    } else win.queue.push({ n, who: 'ghost', tag: kind === 'attesa' ? 'attesa' : undefined });
  }
  // chi non ha un numero è fuori: entra più tardi
  OFF.customers.forEach((c, i) => {
    if (c.state === 'gone') {
      g.setHidden(c.npc, true);
      c.t = 6 + i * 9;
    }
  });
  // gli impiegati al loro posto
  for (const w of Object.values(OFF.wins)) {
    const n = g.npc(w.clerk);
    n.pos.set(WINDOWS[w.id].x, CLERK_Y, SEAT_Z);
    n.setBehavior({ type: 'sit' });
    n.homeRot = 0;
    n.body.root.rotation.y = 0;
    n.baseAction = w.id === 'A' ? 'read' : 'none';
  }
  for (const id of WIN_IDS) setDisplay(id, `${id} ${OFF.wins[id].served}`);
}

// le sedie del signor Attesa (prima fila) e dell'Ispettore Penna (ultima fila) sono occupate
const TAKEN = new Set([1, 34]);
function free(i: number) {
  return !TAKEN.has(i) && !OFF.customers.some((c) => c.chair === i && c.state !== 'gone');
}

function sitAt(g: Game, c: Customer, chair: number) {
  const [x, z] = CHAIRS[chair];
  c.chair = chair;
  c.state = 'seat';
  c.dest = null;
  g.setHidden(c.npc, false);
  c.npc.pos.set(x, 0, z);
  c.npc.setBehavior({ type: 'sit' });
  c.npc.homeRot = Math.PI;
  c.npc.body.root.rotation.y = Math.PI;
  c.npc.baseAction = 'none';
}

function walk(c: Customer, path: [number, number][], speed = 1.35) {
  c.dest = path[path.length - 1];
  c.npc.setBehavior({ type: 'patrol', path, speed, once: true });
  c.npc.baseAction = 'none';
}

const arrived = (n: NPC, p: [number, number] | null, r = 0.15) => !!p && Math.hypot(n.pos.x - p[0], n.pos.z - p[1]) < r;

// dalla sedia allo sportello (davanti alla fila, poi il corridoio in mezzo)
function toWindow(c: Customer, w: WinId) {
  const [cx, cz] = CHAIRS[c.chair];
  const wx = WINDOWS[w].x - 0.35;
  const path: [number, number][] = [[cx, cz - 1.3]];
  if (cz > 0) path.push([0, cz - 1.3], [0, -2.3]);
  path.push([wx, COUNTER_Z + 0.75]);
  c.chair = -1;
  c.state = 'go';
  walk(c, path, 1.55);
}

function leave(c: Customer) {
  c.state = 'leave';
  walk(c, [[c.npc.pos.x * 0.5, -2.6], [0, -2.3], [0, 8], EXIT], 1.5);
}

function enter(g: Game, c: Customer) {
  // una sedia libera (preferisce le prime file)
  const order = CHAIRS.map((_, i) => i).sort(() => Math.random() - 0.5).sort((a, b) => CHAIRS[a][1] - CHAIRS[b][1] + (Math.random() - 0.5) * 3);
  const chair = order.find(free);
  // il numero lo prende all'eliminacode (anche lui): uno sportello ancora aperto e con poca fila
  const wins = WIN_IDS.filter((id) => OFF.min < OFF.wins[id].close - 25 && OFF.wins[id].queue.length < (id === 'A' ? 3 : 4));
  if (chair === undefined || !wins.length) return false;
  const [cx, cz] = CHAIRS[chair];
  g.setHidden(c.npc, false);
  c.npc.pos.set(EXIT[0], 0, EXIT[1]);
  c.chair = chair;
  c.state = 'enter';
  walk(c, [[-2.3, 9.75], [0, 7.5], [0, cz - 1.3], [cx, cz - 1.3], [cx, cz]], 1.3);
  const id = wins[Math.floor(Math.random() * wins.length)];
  const win = OFF.wins[id];
  win.queue.push({ n: ++win.issued, who: 'npc', c });
  return true;
}

// ---------------------------------------------------------------------------
// i numeri: il tuo
// ---------------------------------------------------------------------------
export function takeTicket(id: WinId) {
  const w = OFF.wins[id];
  const n = ++w.issued;
  w.queue.push({ n, who: 'player' });
  OFF.mine[id].push(n);
  return n;
}

// il numero del signor Attesa passa a te (se non l'hanno già chiamato)
export function giftAttesa() {
  const t = OFF.wins.A.queue.find((q) => q.tag === 'attesa');
  if (!t) return 0;
  t.who = 'player';
  OFF.mine.A.push(t.n);
  OFF.mine.A.sort((a, b) => a - b);
  return t.n;
}

// quanti prima di te (per il tuo numero più basso a quello sportello)
export function ahead(id: WinId) {
  const w = OFF.wins[id];
  const mine = OFF.mine[id];
  if (!mine.length) return -1;
  const m = Math.min(...mine);
  return w.queue.findIndex((q) => q.n === m);
}

export const calling = (id: WinId) => {
  const w = OFF.wins[id];
  return w.phase === 'call' && w.cur?.who === 'player' ? w.cur.n : 0;
};

// ti presenti allo sportello: lo sportello aspetta te (finché non finisce il dialogo)
export function present(id: WinId) {
  const w = OFF.wins[id];
  if (!calling(id)) return false;
  w.phase = 'player';
  OFF.mine[id] = OFF.mine[id].filter((n) => n !== w.cur!.n);
  return true;
}

export function served(id: WinId) {
  const w = OFF.wins[id];
  if (w.phase !== 'player') return;
  w.phase = 'idle';
  w.cur = null;
  w.t = 1.2;
}

export const isOpen = (id: WinId) => {
  const w = OFF.wins[id];
  return OFF.min >= w.open && OFF.min < w.close && w.phase !== 'away';
};

const pauseNow = (w: Win) => w.pauses.find((p) => OFF.min >= p.from && OFF.min < p.to && !p.skip?.()) ?? null;

// ---------------------------------------------------------------------------
// a ogni frame
// ---------------------------------------------------------------------------
export function updateOffice(g: Game, dt: number) {
  // le lancette (anche quando l'orologio è fermo)
  const m = OFF.min;
  if (REFS11.minHand) REFS11.minHand.rotation.z = -((m % 60) / 60) * Math.PI * 2;
  if (REFS11.hourHand) REFS11.hourHand.rotation.z = -(((9 + m / 60) % 12) / 12) * Math.PI * 2;
  OFF.blink += dt;
  if (OFF.running) {
    OFF.min += dt / SEC_PER_MIN;
    for (const w of Object.values(OFF.wins)) updateWin(g, w, dt);
    updateCustomers(g, dt);
  }
  for (const w of Object.values(OFF.wins)) display(w);
  renderPanel(g);
}

function display(w: Win) {
  if (OFF.min < w.open) return setDisplay(w.id, `${w.id} --`, `apre alle ${hhmm(w.open)}`);
  if (OFF.min >= w.close) return setDisplay(w.id, `${w.id} --`, 'CHIUSO');
  if (w.phase === 'away') return setDisplay(w.id, `${w.id} ${w.served}`, w.pause?.label ?? (w.back ? 'TORNO SUBITO' : 'CHIUSO'));
  if (w.phase === 'call') return setDisplay(w.id, `${w.id} ${w.served}`, Math.floor(OFF.blink * 2.5) % 2 ? 'AVANTI' : '');
  setDisplay(w.id, `${w.id} ${w.served}`);
}

function updateWin(g: Game, w: Win, dt: number) {
  const clerk = g.npc(w.clerk);
  switch (w.phase) {
    case 'idle': {
      if (OFF.min < w.open || OFF.min >= w.close) {
        clerk.baseAction = OFF.min < w.open ? 'read' : 'none';
        return;
      }
      const p = pauseNow(w);
      if (p) {
        w.phase = 'away';
        w.pause = p;
        w.back = false;
        if (p.walk) {
          const x = WINDOWS[w.id].x + 1.3;
          const spot = STAFF[w.id === 'B' ? 1 : 0];
          clerk.setBehavior({ type: 'patrol', path: [[x, SEAT_Z], [x, -9.5], [13.2, -9.5], [13.2, -8.6], spot], speed: 1.5, once: true });
          clerk.pos.y = 0;
          clerk.baseAction = 'none';
        } else clerk.baseAction = 'think';
        return;
      }
      clerk.baseAction = 'none';
      w.t -= dt;
      if (w.t > 0) return;
      const tk = w.queue.shift();
      if (!tk) return;
      w.served = tk.n;
      w.cur = tk;
      w.phase = 'call';
      w.t = 0;
      g.audio.chime(tk.who === 'player');
      if (tk.who === 'npc' && tk.c) {
        if (tk.c.state === 'seat' || tk.c.state === 'enter') toWindow(tk.c, w.id);
        else {
          // si è alzato o non è ancora seduto: è come un fantasma
          tk.who = 'ghost';
          tk.c = undefined;
        }
      }
      if (tk.who === 'player') OFF.onCall?.(w, tk.n);
      if (tk.who === 'ghost') OFF.onGhost?.(w, tk);
      return;
    }
    case 'call': {
      w.t += dt;
      const tk = w.cur!;
      if (tk.who === 'ghost' && w.t > 3.5) return next(w, 0.6);
      if (tk.who === 'npc') {
        const c = tk.c!;
        if (c.state === 'go' && arrived(c.npc, c.dest)) {
          c.state = 'serve';
          c.npc.setBehavior({ type: 'stand' });
          c.npc.homeRot = Math.PI;
          c.npc.baseAction = 'talk';
          w.phase = 'serve';
          w.t = w.service * (0.7 + Math.random() * 0.6);
          clerk.baseAction = w.id === 'C' ? 'gavel' : 'talk';
        } else if (w.t > 25) {
          leave(c);
          next(w, 0.6);
        }
      }
      if (tk.who === 'player' && w.t > GRACE) {
        OFF.mine[w.id] = OFF.mine[w.id].filter((n) => n !== tk.n);
        OFF.onSkip?.(w, tk.n);
        next(w, 0.6);
      }
      return;
    }
    case 'serve': {
      w.t -= dt;
      if (w.t > 0) {
        // il timbro, a tempo
        if (w.id === 'C' && Math.random() < dt * 1.3) g.audio.stamp(0.35);
        return;
      }
      const c = w.cur?.c;
      if (c) leave(c);
      clerk.baseAction = 'none';
      return next(w, 1.2);
    }
    case 'player':
      return;
    case 'away': {
      const p = w.pause;
      if (!w.back) {
        if (!p || OFF.min >= p.to || p.skip?.()) {
          w.back = true;
          w.pause = null;
          if (p?.walk) {
            const x = WINDOWS[w.id].x + 1.3;
            clerk.setBehavior({ type: 'patrol', path: [[13.2, -8.6], [13.2, -9.5], [x, -9.5], [x, SEAT_Z], [WINDOWS[w.id].x, SEAT_Z]], speed: 1.5, once: true });
            clerk.baseAction = 'none';
          }
        } else if (p.walk && arrived(clerk, STAFF[w.id === 'B' ? 1 : 0])) {
          // arrivata nell'angolo: caffè (o merenda), girata verso il tavolino
          if (clerk.behavior.type !== 'stand') {
            clerk.setBehavior({ type: 'stand' });
            clerk.homeRot = Math.atan2(14.3 - clerk.pos.x, -9.4 - clerk.pos.z);
          }
          clerk.baseAction = 'drink';
        }
        return;
      }
      // di ritorno: riapre quando è seduta
      const home: [number, number] = [WINDOWS[w.id].x, SEAT_Z];
      if (clerk.behavior.type === 'patrol' && !arrived(clerk, home)) return;
      clerk.setBehavior({ type: 'sit' });
      clerk.homeRot = 0;
      clerk.baseAction = 'none';
      clerk.pos.set(WINDOWS[w.id].x, CLERK_Y, SEAT_Z);
      w.back = false;
      w.phase = 'idle';
      w.t = 1;
      return;
    }
  }
}

function next(w: Win, gap: number) {
  w.phase = 'idle';
  w.cur = null;
  w.t = gap;
}

function updateCustomers(g: Game, dt: number) {
  for (const c of OFF.customers) {
    switch (c.state) {
      case 'enter':
        if (arrived(c.npc, c.dest)) sitAt(g, c, c.chair);
        break;
      case 'leave':
        if (arrived(c.npc, c.dest, 0.3)) {
          c.state = 'gone';
          c.t = 12 + Math.random() * 20;
          g.setHidden(c.npc, true);
        }
        break;
      case 'gone':
        c.t -= dt;
        if (c.t <= 0 && OFF.min < END_MIN - 25) c.t = enter(g, c) ? 0 : 6;
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// il foglietto in basso a sinistra: l'ora, i tuoi numeri, la pratica
// ---------------------------------------------------------------------------
export function createPanel(g: Game) {
  OFF.panel?.remove();
  const el = document.createElement('div');
  el.className = 'chapter-ui pratica paper';
  g.hud.root.appendChild(el);
  OFF.panel = el;
  OFF.panelHtml = '';
}

function renderPanel(g: Game) {
  const el = OFF.panel;
  if (!el) return;
  const hide = g.dialogue.isOpen || !OFF.running;
  el.style.display = hide ? 'none' : '';
  if (hide) return;
  const tks: string[] = [];
  for (const id of WIN_IDS) {
    for (const n of OFF.mine[id]) {
      const w = OFF.wins[id];
      if (w.phase === 'call' && w.cur?.n === n) tks.push(`<span class="call"><b>${id} ${n}</b>: TOCCA A TE!</span>`);
      else {
        const k = w.queue.findIndex((q) => q.n === n);
        const st = OFF.min < w.open ? `apre alle ${hhmm(w.open)}` : w.phase === 'away' ? 'in pausa' : k <= 0 ? 'tra poco' : `${k} prima di te`;
        tks.push(`<b>${id} ${n}</b> (${st})`);
      }
    }
  }
  const left = END_MIN - OFF.min;
  const steps = OFF.steps()
    .map((s) => `<div class="c ${s.on ? 'on' : ''}"><i></i>${s.t}</div>`)
    .join('');
  const html = `<div class="ora">${hhmm(OFF.min)}<small>${left < 30 ? `<b>A chiude tra ${Math.ceil(left)} minuti!</b>` : 'A chiude alle 12:00'}${OFF.day > 1 ? ` · giorno ${OFF.day}` : ''}</small></div>
    <div class="tk">${tks.length ? `I tuoi numeri: ${tks.join(' · ')}` : 'Nessun numero (eliminacode, all\'ingresso)'}</div>${steps}`;
  if (html !== OFF.panelHtml) {
    el.innerHTML = html;
    OFF.panelHtml = html;
  }
}

// un punto davanti allo sportello (per i bersagli delle missioni)
export const winSpot = (id: WinId) => new THREE.Vector3(WINDOWS[id].x, 1.2, COUNTER_Z + 0.6);
