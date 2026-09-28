import type { Game } from '../../game/game';
import { TOUCH } from '../../touch';
import { VIEW, toGame } from '../../view';
import { makeRng } from '../../render/palette';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// IL CASSONE DEL FURGONE (capitolo 7): un incastro visto dall'alto, 5 × 9 caselle.
// Tutto quello di Nonna Pina ci sta, e ci sta esatto (45 caselle su 45): i mobili grandi arrivano
// uno alla volta (portati giù), gli scatoloni tutti insieme alla fine. Marco nel frattempo
// "aiuta": carica roba che non è di Nonna Pina, e va tolta. I pezzi si ruotano, non si ribaltano
// (il divano si piega solo a destra).
// Comandi: computer = puntatore col mouse, click prendi/metti, R o tasto destro ruota, E chiude.
// Telefono = trascina i pezzi col dito, pulsante RUOTA, pulsante FATTO.
// ---------------------------------------------------------------------------

export const COLS = 5, ROWS = 9;
type Cell = [number, number];

export interface PPiece {
  id: string;
  name: string;
  cells: Cell[]; // forma di base
  kind: 'mobile' | 'scatola' | 'intruso';
  at: { x: number; y: number; rot: number } | null; // nel cassone (null = fuori)
  inTray: boolean;
}

const SHAPES: Record<string, { name: string; cells: Cell[]; kind: PPiece['kind'] }> = {
  armadio: { name: 'armadio a L', kind: 'mobile', cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]] },
  divano: { name: 'divano', kind: 'mobile', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [2, 2]] },
  scala: { name: 'scala', kind: 'mobile', cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  poltrona: { name: 'poltrona', kind: 'mobile', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  pentole: { name: 'PENTOLE', kind: 'scatola', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  libri: { name: 'LIBRI', kind: 'scatola', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  lampada: { name: 'lampada', kind: 'scatola', cells: [[0, 0], [0, 1], [0, 2]] },
  attaccapanni: { name: 'attaccapanni', kind: 'scatola', cells: [[0, 0], [0, 1], [0, 2]] },
  centrini: { name: 'CENTRINI', kind: 'scatola', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  cuccia: { name: 'cuccia di Pallino', kind: 'scatola', cells: [[0, 0], [1, 0], [1, 1]] },
  bottoni: { name: 'BOTTONI', kind: 'scatola', cells: [[0, 0], [1, 0]] },
  foto: { name: 'FOTO', kind: 'scatola', cells: [[0, 0], [1, 0]] },
  cassetta: { name: 'cassetta della posta', kind: 'intruso', cells: [[0, 0]] },
  gatto: { name: 'il gatto del vicino', kind: 'intruso', cells: [[0, 0], [1, 0]] },
  stop: { name: 'cartello STOP', kind: 'intruso', cells: [[0, 0]] },
};
export const BOXES = ['pentole', 'libri', 'lampada', 'attaccapanni', 'centrini', 'cuccia', 'bottoni', 'foto'];
export const JUNK = ['cassetta', 'gatto', 'stop'];

// una soluzione (per i suggerimenti): x, y, rotazione
const SOLUTION: Record<string, [number, number, number]> = {
  armadio: [0, 0, 0],
  divano: [0, 1, 0],
  scala: [4, 0, 0],
  poltrona: [0, 3, 0],
  centrini: [2, 2, 0],
  lampada: [4, 4, 0],
  pentole: [0, 5, 0],
  libri: [2, 5, 0],
  attaccapanni: [0, 7, 1],
  cuccia: [3, 7, 0],
  bottoni: [0, 8, 0],
  foto: [2, 8, 0],
};

export const PACK = {
  pieces: [] as PPiece[],
  open: false,
  mode: 'view' as 'one' | 'all' | 'view',
  held: null as PPiece | null,
  heldFrom: null as { x: number; y: number; rot: number } | null,
  heldRot: 0,
  cursor: { x: 0, y: 0 },
  msg: '',
  msgT: 0,
  hint: null as { p: PPiece; t: number } | null,
  doneT: -1,
  onDone: null as (() => void) | null,
  canvas: null as HTMLCanvasElement | null,
  lastRight: false,
  touchPiece: false,
  onRemoved: null as ((id: string) => void) | null, // un intruso buttato fuori dal cassone
};

export function resetPack() {
  PACK.pieces = [];
  PACK.open = false;
  PACK.held = null;
}

export function addPiece(id: string, inTray = true) {
  const s = SHAPES[id];
  const p: PPiece = { id, name: s.name, cells: s.cells, kind: s.kind, at: null, inTray };
  PACK.pieces.push(p);
  return p;
}

// --- geometria ---
function rotCells(cells: Cell[], rot: number): Cell[] {
  let out = cells.map(([x, y]) => [x, y] as Cell);
  for (let k = 0; k < ((rot % 4) + 4) % 4; k++) out = out.map(([x, y]) => [-y, x] as Cell);
  const mx = Math.min(...out.map((c) => c[0])), my = Math.min(...out.map((c) => c[1]));
  return out.map(([x, y]) => [x - mx, y - my] as Cell);
}

function occupancy(except?: PPiece) {
  const occ: (PPiece | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (const p of PACK.pieces) {
    if (!p.at || p === except) continue;
    for (const [cx, cy] of rotCells(p.cells, p.at.rot)) occ[p.at.y + cy][p.at.x + cx] = p;
  }
  return occ;
}

function fits(p: PPiece, x: number, y: number, rot: number) {
  const occ = occupancy(p);
  for (const [cx, cy] of rotCells(p.cells, rot)) {
    const gx = x + cx, gy = y + cy;
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS || occ[gy][gx]) return false;
  }
  return true;
}

// Marco carica un intruso in un posto libero a caso
export function addJunk(id: string) {
  const p = addPiece(id, false);
  const rng = makeRng(Math.floor(Math.random() * 1e6));
  for (let t = 0; t < 200; t++) {
    const rot = Math.floor(rng() * 4), x = Math.floor(rng() * COLS), y = Math.floor(rng() * ROWS);
    if (fits(p, x, y, rot)) {
      p.at = { x, y, rot };
      return p;
    }
  }
  PACK.pieces.splice(PACK.pieces.indexOf(p), 1);
  return null;
}

export const junkInVan = () => PACK.pieces.filter((p) => p.kind === 'intruso' && p.at);
export const allPacked = () => PACK.pieces.every((p) => (p.kind === 'intruso' ? !p.at : !!p.at)) && PACK.pieces.filter((p) => p.kind === 'scatola').length === BOXES.length;

// =========================================================================
// APERTURA E CHIUSURA
// =========================================================================
export function openPack(g: Game, mode: 'one' | 'all' | 'view', hold: PPiece | null, onDone: () => void) {
  PACK.open = true;
  PACK.mode = mode;
  PACK.onDone = onDone;
  PACK.doneT = -1;
  PACK.hint = null;
  PACK.msg = '';
  PACK.cursor = { x: VIEW.w * 0.3, y: VIEW.h * 0.45 };
  PACK.held = null;
  if (hold) pick(hold, null);
  const c = document.createElement('canvas');
  c.className = 'chapter-ui pack';
  g.hud.root.appendChild(c);
  g.hud.root.classList.add('packing');
  PACK.canvas = c;
  if (TOUCH) bindTouch(g, c);
  g.minigame = (dt) => update(g, dt);
  g.audio.select();
}

function close(g: Game) {
  PACK.open = false;
  PACK.canvas?.remove();
  PACK.canvas = null;
  g.hud.root.classList.remove('packing');
  // quello che hai in mano torna dov'era
  if (PACK.held) drop();
  g.minigame = null;
  const cb = PACK.onDone;
  PACK.onDone = null;
  cb?.();
}

function pick(p: PPiece, from: { x: number; y: number; rot: number } | null) {
  PACK.held = p;
  PACK.heldFrom = from;
  PACK.heldRot = from ? from.rot : p.at?.rot ?? 0;
  p.at = null;
  p.inTray = false;
}

// rimette il pezzo che hai in mano dov'era (o nel vassoio)
function drop() {
  const p = PACK.held!;
  if (PACK.heldFrom) p.at = PACK.heldFrom;
  else p.inTray = p.kind !== 'intruso';
  PACK.held = null;
}

function say(text: string, t = 2.6) {
  PACK.msg = text;
  PACK.msgT = t;
}

// =========================================================================
// LAYOUT (in pixel del gioco)
// =========================================================================
function layout() {
  const w = VIEW.w, h = VIEW.h;
  const cs = Math.floor(Math.min(h * 0.075, w * 0.055));
  const gx = Math.floor(w * 0.34 - (COLS * cs) / 2), gy = Math.floor(h * 0.5 - (ROWS * cs) / 2 + cs * 0.2);
  const tx = Math.floor(w * 0.58), ty = Math.floor(h * 0.2);
  return { w, h, cs, gx, gy, tx, ty, ts: cs * 0.62 };
}

// posizioni dei pezzi nel vassoio
function trayRects() {
  const L = layout();
  const out: { p: PPiece; x: number; y: number; w: number; h: number }[] = [];
  let x = L.tx, y = L.ty, rowH = 0;
  const maxW = L.w * 0.38;
  for (const p of PACK.pieces) {
    if (!p.inTray || p === PACK.held) continue;
    const cells = rotCells(p.cells, 0);
    const pw = (Math.max(...cells.map((c) => c[0])) + 1) * L.ts, ph = (Math.max(...cells.map((c) => c[1])) + 1) * L.ts;
    if (x + pw > L.tx + maxW) {
      x = L.tx;
      y += rowH + L.ts * 0.6;
      rowH = 0;
    }
    out.push({ p, x, y, w: pw, h: ph });
    x += pw + L.ts * 0.6;
    rowH = Math.max(rowH, ph);
  }
  return out;
}

function buttons() {
  const L = layout();
  const bw = Math.max(110, L.cs * 2.2), bh = Math.max(44, L.cs * 0.9);
  const y = L.gy + ROWS * L.cs - bh;
  return {
    ruota: { x: L.tx, y, w: bw, h: bh, label: TOUCH ? 'RUOTA' : `RUOTA (${keyName('reload')})` },
    aiuto: { x: L.tx + bw + 14, y, w: bw, h: bh, label: 'AIUTO' },
    fatto: { x: L.tx + 2 * (bw + 14), y, w: bw, h: bh, label: TOUCH ? 'FATTO' : `FATTO (${keyName('interact')})` },
  };
}

const inRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

// cella del cassone sotto il cursore (con il pezzo tenuto per il suo centro)
function gridTarget(px: number, py: number) {
  const L = layout();
  const p = PACK.held!;
  const cells = rotCells(p.cells, PACK.heldRot);
  const pw = Math.max(...cells.map((c) => c[0])) + 1, ph = Math.max(...cells.map((c) => c[1])) + 1;
  const x = Math.round((px - L.gx) / L.cs - pw / 2), y = Math.round((py - L.gy) / L.cs - ph / 2);
  const over = px > L.gx - L.cs && px < L.gx + (COLS + 1) * L.cs && py > L.gy - L.cs && py < L.gy + (ROWS + 1) * L.cs;
  return { x, y, over };
}

// =========================================================================
// AZIONI (click / tocco)
// =========================================================================
function press(g: Game, px: number, py: number) {
  const L = layout();
  const B = buttons();
  if (inRect(px, py, B.ruota)) return rotate(g);
  if (inRect(px, py, B.aiuto)) return help();
  if (inRect(px, py, B.fatto)) return finishTry(g);
  if (PACK.held) return place(g, px, py);
  // prendere un pezzo: dal vassoio o dal cassone
  for (const r of trayRects()) {
    if (inRect(px, py, r)) {
      pick(r.p, null);
      g.audio.tick();
      return;
    }
  }
  const cx = Math.floor((px - L.gx) / L.cs), cy = Math.floor((py - L.gy) / L.cs);
  if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) {
    const p = occupancy()[cy][cx];
    if (p) {
      pick(p, p.at);
      g.audio.tick();
    }
  }
}

function place(g: Game, px: number, py: number) {
  const p = PACK.held!;
  const t = gridTarget(px, py);
  if (t.over && fits(p, t.x, t.y, PACK.heldRot)) {
    p.at = { x: t.x, y: t.y, rot: PACK.heldRot };
    PACK.held = null;
    g.audio.bump(0.35);
    if (PACK.mode === 'one' && p.kind === 'mobile') {
      say(`${cap(p.name)}: sistemato.`);
      PACK.doneT = 0.9;
    }
    return;
  }
  if (!t.over) {
    // fuori dal cassone: gli intrusi si buttano fuori, il resto torna nel vassoio
    if (p.kind === 'intruso') {
      PACK.held = null;
      PACK.pieces.splice(PACK.pieces.indexOf(p), 1);
      PACK.onRemoved?.(p.id);
      say(p.id === 'gatto' ? 'Il gatto scende dal furgone. Offeso.' : `${cap(p.name)}: fuori dal furgone. Non era di Nonna Pina.`);
      g.audio.good();
      return;
    }
    p.inTray = true;
    PACK.held = null;
    if (PACK.mode === 'one') say(`${cap(p.name)}: lo lasciamo qui accanto, lo sistemiamo alla fine. (${keyName('interact')} per chiudere)`, 3.5);
    return;
  }
  say('Lì non ci sta. Prova a girarlo.', 1.6);
  g.audio.miss();
}

function rotate(g: Game) {
  if (!PACK.held) {
    say('Prima prendi un pezzo.', 1.4);
    return;
  }
  PACK.heldRot = (PACK.heldRot + 1) % 4;
  g.audio.tick();
}

function help() {
  // il primo pezzo che non è dove dovrebbe: te lo fa vedere
  const intr = junkInVan()[0];
  if (intr) {
    say(`Prima togli ${intr.name}: trascinalo fuori dal cassone.`, 3);
    PACK.hint = { p: intr, t: 3 };
    return;
  }
  const wrong = PACK.pieces.find((p) => {
    const s = SOLUTION[p.id];
    if (!s) return false;
    return !p.at || p.at.x !== s[0] || p.at.y !== s[1] || rotCells(p.cells, p.at.rot).join() !== rotCells(p.cells, s[2]).join();
  });
  if (!wrong) {
    say('È già tutto giusto. Il geometra sarebbe fiero.');
    return;
  }
  PACK.hint = { p: wrong, t: 3.5 };
  say(`Il signor Goniometro indica dove va ${wrong.name}.`, 3);
}

function finishTry(g: Game) {
  if (PACK.mode === 'one') {
    if (PACK.held) return say('Prima metti giù quello che hai in mano.');
    const m = PACK.pieces.find((p) => p.kind === 'mobile' && !p.at && !p.inTray);
    if (m) return say(`Manca ${m.name}.`);
    return close(g);
  }
  if (PACK.mode === 'view') {
    if (PACK.held) drop();
    return close(g);
  }
  // alla fine: tutto dentro, niente intrusi
  if (junkInVan().length) return say(`Dentro c'è ancora ${junkInVan()[0].name}. Non è di Nonna Pina.`, 3);
  const left = PACK.pieces.filter((p) => p.kind !== 'intruso' && !p.at);
  if (left.length || PACK.held) return say(`Manca ancora ${(PACK.held ?? left[0]).name}.`, 2.5);
  close(g);
}

// =========================================================================
// AGGIORNAMENTO E DISEGNO
// =========================================================================
function update(g: Game, dt: number) {
  const inp = g.input;
  if (!TOUCH) {
    PACK.cursor.x = Math.max(0, Math.min(VIEW.w, PACK.cursor.x + inp.mouseDX));
    PACK.cursor.y = Math.max(0, Math.min(VIEW.h, PACK.cursor.y + inp.mouseDY));
    if (inp.clicked) press(g, PACK.cursor.x, PACK.cursor.y);
    if (inp.rightDown && !PACK.lastRight) rotate(g);
    PACK.lastRight = inp.rightDown;
  }
  if (inp.wasPressed('reload')) rotate(g);
  if (inp.wasPressed('interact')) finishTry(g);
  PACK.msgT = Math.max(0, PACK.msgT - dt);
  if (PACK.hint) {
    PACK.hint.t -= dt;
    if (PACK.hint.t <= 0) PACK.hint = null;
  }
  // "tutto a posto" (fine partita: si chiude da solo quando è pieno e pulito)
  if (PACK.mode === 'all' && !PACK.held && allPacked() && PACK.doneT < 0) {
    PACK.doneT = 1.4;
    say('Pieno. Perfettamente. Il signor Goniometro si commuove.', 3);
    g.audio.good();
  }
  if (PACK.doneT > 0) {
    PACK.doneT -= dt;
    if (PACK.doneT <= 0) {
      PACK.doneT = -1;
      if (PACK.mode !== 'view') close(g);
    }
  }
  draw();
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const INK = '#23222b';
const RED = '#d6333a';
const BLUE = '#2f5bd3';

function draw() {
  const c = PACK.canvas;
  if (!c) return;
  const L = layout();
  if (c.width !== Math.round(L.w) || c.height !== Math.round(L.h)) {
    c.width = Math.round(L.w);
    c.height = Math.round(L.h);
  }
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  // foglio sopra la scena
  ctx.fillStyle = 'rgba(251, 248, 239, 0.985)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(157, 187, 224, 0.5)';
  ctx.lineWidth = 1;
  for (let y = 40; y < c.height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(L.cs * 0.62)}px 'Permanent Marker', cursive`;
  ctx.fillText('IL CASSONE DEL FURGONE', L.gx + (COLS * L.cs) / 2, L.gy - L.cs * 1.15);
  ctx.font = `${Math.round(L.cs * 0.36)}px 'Patrick Hand', cursive`;
  ctx.fillText('cabina', L.gx + (COLS * L.cs) / 2, L.gy - L.cs * 0.25);
  ctx.fillText('porte dietro', L.gx + (COLS * L.cs) / 2, L.gy + ROWS * L.cs + L.cs * 0.55);

  // il cassone
  ctx.strokeStyle = 'rgba(157, 187, 224, 0.9)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= COLS; i++) line(ctx, L.gx + i * L.cs, L.gy, L.gx + i * L.cs, L.gy + ROWS * L.cs, 0.6);
  for (let j = 0; j <= ROWS; j++) line(ctx, L.gx, L.gy + j * L.cs, L.gx + COLS * L.cs, L.gy + j * L.cs, 0.6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  rrect(ctx, L.gx - 6, L.gy - 6, COLS * L.cs + 12, ROWS * L.cs + 12);

  // pezzi nel cassone (prima tutti i corpi, poi tutti i nomi: così nessun nome finisce sotto un altro pezzo)
  for (const p of PACK.pieces) if (p.at) drawPiece(ctx, p, L.gx + p.at.x * L.cs, L.gy + p.at.y * L.cs, L.cs, p.at.rot, 1, INK, 'body');
  for (const p of PACK.pieces) if (p.at) drawPiece(ctx, p, L.gx + p.at.x * L.cs, L.gy + p.at.y * L.cs, L.cs, p.at.rot, 1, INK, 'label');
  // suggerimento
  if (PACK.hint) {
    const s = SOLUTION[PACK.hint.p.id];
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(performance.now() / 150) * 0.2;
    if (s && PACK.hint.p.kind !== 'intruso') drawPiece(ctx, PACK.hint.p, L.gx + s[0] * L.cs, L.gy + s[1] * L.cs, L.cs, s[2], 1, BLUE);
    else if (PACK.hint.p.at) drawPiece(ctx, PACK.hint.p, L.gx + PACK.hint.p.at.x * L.cs, L.gy + PACK.hint.p.at.y * L.cs, L.cs, PACK.hint.p.at.rot, 1, RED);
    ctx.restore();
  }
  // vassoio
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = `${Math.round(L.cs * 0.42)}px 'Patrick Hand', cursive`;
  const tray = trayRects();
  ctx.fillText(tray.length ? 'Da caricare:' : PACK.mode === 'all' ? 'Niente da caricare. Controlla il cassone.' : '', L.tx, L.ty - L.ts * 0.5);
  for (const r of tray) drawPiece(ctx, r.p, r.x, r.y, L.ts, 0, 0.8);
  // pulsanti
  const B = buttons();
  for (const b of Object.values(B)) {
    ctx.fillStyle = 'rgba(250, 247, 238, 1)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    rrect(ctx, b.x, b.y, b.w, b.h, true);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.font = `${Math.round(Math.min(b.h * 0.42, 18))}px 'Permanent Marker', cursive`;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.64);
  }
  // istruzioni e messaggi
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `${Math.round(L.cs * 0.38)}px 'Patrick Hand', cursive`;
  const help = TOUCH ? 'Trascina i pezzi nel cassone · RUOTA gira quello che hai preso' : `Click: prendi e metti · ${keyName('reload')} o tasto destro: ruota · fuori dal cassone: lo togli`;
  wrap(ctx, help, L.tx, B.ruota.y - L.cs * 1.3, L.w * 0.38, L.cs * 0.45);
  if (PACK.msgT > 0) {
    ctx.fillStyle = RED;
    ctx.font = `${Math.round(L.cs * 0.46)}px 'Patrick Hand', cursive`;
    wrap(ctx, PACK.msg, L.tx, B.ruota.y - L.cs * 0.55, L.w * 0.38, L.cs * 0.5);
  }
  // il pezzo in mano
  if (PACK.held) {
    const cur = PACK.cursor;
    const t = gridTarget(cur.x, cur.y);
    const ok = t.over && fits(PACK.held, t.x, t.y, PACK.heldRot);
    if (t.over) drawPiece(ctx, PACK.held, L.gx + t.x * L.cs, L.gy + t.y * L.cs, L.cs, PACK.heldRot, 0.75, ok ? INK : RED);
    else {
      const cells = rotCells(PACK.held.cells, PACK.heldRot);
      const pw = (Math.max(...cells.map((c) => c[0])) + 1) * L.cs, ph = (Math.max(...cells.map((c) => c[1])) + 1) * L.cs;
      drawPiece(ctx, PACK.held, cur.x - pw / 2, cur.y - ph / 2, L.cs, PACK.heldRot, 0.75, PACK.held.kind === 'intruso' ? RED : INK);
    }
  }
  // puntatore (matita)
  if (!TOUCH) {
    const { x, y } = PACK.cursor;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y + 26);
    ctx.lineTo(x + 24, y + 20);
    ctx.closePath();
    ctx.fillStyle = '#f2c14e';
    ctx.fill();
    ctx.stroke();
  }
}

// un pezzo: forma a caselle con il contorno a inchiostro, tratteggio e nome
function drawPiece(ctx: CanvasRenderingContext2D, p: PPiece, x: number, y: number, cs: number, rot: number, alpha: number, stroke = INK, part: 'all' | 'body' | 'label' = 'all') {
  const cells = rotCells(p.cells, rot);
  const set = new Set(cells.map((c) => c.join()));
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (part !== 'label') drawBody(ctx, p, cells, set, x, y, cs, stroke);
  if (part !== 'body') drawLabel(ctx, p, cells, set, x, y, cs, stroke);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, p: PPiece, cells: Cell[], set: Set<string>, x: number, y: number, cs: number, stroke: string) {
  ctx.fillStyle = p.kind === 'intruso' ? '#f6d9d6' : p.kind === 'mobile' ? '#efe6d2' : '#f3ecd9';
  for (const [cx, cy] of cells) ctx.fillRect(x + cx * cs, y + cy * cs, cs, cs);
  // tratteggio dei mobili, nastro adesivo sugli scatoloni
  ctx.strokeStyle = p.kind === 'intruso' ? RED : 'rgba(35, 34, 43, 0.35)';
  ctx.lineWidth = 1.2;
  for (const [cx, cy] of cells) {
    const ox = x + cx * cs, oy = y + cy * cs;
    if (p.kind === 'mobile') {
      for (let k = 0.25; k < 1; k += 0.25) line(ctx, ox + cs * k, oy + cs * 0.1, ox + cs * 0.1, oy + cs * k, 0.4);
    } else if (p.kind === 'scatola') line(ctx, ox + cs * 0.5, oy + 2, ox + cs * 0.5, oy + cs - 2, 0.4);
  }
  // contorno (solo i lati esterni)
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, cs * 0.06);
  for (const [cx, cy] of cells) {
    const ox = x + cx * cs, oy = y + cy * cs;
    if (!set.has([cx, cy - 1].join())) line(ctx, ox, oy, ox + cs, oy, 1);
    if (!set.has([cx, cy + 1].join())) line(ctx, ox, oy + cs, ox + cs, oy + cs, 1);
    if (!set.has([cx - 1, cy].join())) line(ctx, ox, oy, ox, oy + cs, 1);
    if (!set.has([cx + 1, cy].join())) line(ctx, ox + cs, oy, ox + cs, oy + cs, 1);
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, p: PPiece, cells: Cell[], set: Set<string>, x: number, y: number, cs: number, stroke: string) {
  const mx = Math.max(...cells.map((c) => c[0])) + 1, my = Math.max(...cells.map((c) => c[1])) + 1;
  ctx.fillStyle = stroke;
  ctx.textAlign = 'center';
  const fs = Math.max(9, Math.round(cs * 0.3));
  ctx.font = `${fs}px 'Patrick Hand', cursive`;
  const [cx0, cy0] = cells.reduce((a, c) => (set.has([c[0] + 1, c[1]].join()) || cells.length === 1 ? c : a), cells[0]);
  const lx = mx >= 2 && my >= 2 ? x + (mx * cs) / 2 : x + (cx0 + 0.5) * cs;
  const ly = mx >= 2 && my >= 2 ? y + (my * cs) / 2 : y + (cy0 + 0.5) * cs;
  if (my > mx && mx === 1) {
    ctx.save();
    ctx.translate(x + cs / 2, y + (my * cs) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(p.name, 0, fs * 0.35);
    ctx.restore();
  } else ctx.fillText(p.name, lx, ly + fs * 0.35);
}

// linea "a mano": leggermente storta
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, wob: number) {
  const mx = (x0 + x1) / 2 + Math.sin(x0 * 0.7 + y1) * wob, my = (y0 + y1) / 2 + Math.cos(y0 * 0.7 + x1) * wob;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = false) {
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + w - 5, y + 1);
  ctx.quadraticCurveTo(x + w, y, x + w, y + 6);
  ctx.lineTo(x + w - 1, y + h - 5);
  ctx.quadraticCurveTo(x + w, y + h, x + w - 6, y + h);
  ctx.lineTo(x + 5, y + h - 1);
  ctx.quadraticCurveTo(x, y + h, x, y + h - 6);
  ctx.lineTo(x + 1, y + 5);
  ctx.quadraticCurveTo(x, y, x + 6, y);
  if (fill) ctx.fill();
  ctx.stroke();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let lineTxt = '';
  let yy = y;
  for (const w of words) {
    const t = lineTxt ? `${lineTxt} ${w}` : w;
    if (ctx.measureText(t).width > maxW && lineTxt) {
      ctx.fillText(lineTxt, x, yy);
      lineTxt = w;
      yy += lh;
    } else lineTxt = t;
  }
  if (lineTxt) ctx.fillText(lineTxt, x, yy);
}

// --- telefono: si trascina col dito ---
function bindTouch(g: Game, c: HTMLCanvasElement) {
  const pos = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    const [x, y] = toGame(t.clientX, t.clientY);
    return { x, y };
  };
  c.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const p = pos(e);
    PACK.cursor = { x: p.x, y: p.y - layout().cs * 0.8 };
    const had = !!PACK.held;
    if (!had) press(g, p.x, p.y);
    PACK.touchPiece = !had && !!PACK.held;
    if (had) press(g, p.x, p.y);
  }, { passive: false });
  c.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const p = pos(e);
    PACK.cursor = { x: p.x, y: p.y - layout().cs * 0.8 };
  }, { passive: false });
  c.addEventListener('touchend', (e) => {
    const p = pos(e);
    if (PACK.touchPiece && PACK.held) place(g, p.x, p.y - layout().cs * 0.8);
    PACK.touchPiece = false;
  });
}
