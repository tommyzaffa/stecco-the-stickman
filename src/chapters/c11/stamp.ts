import type { Game } from '../../game/game';
import { TOUCH } from '../../touch';
import { attackName } from '../../settings';

// ---------------------------------------------------------------------------
// I TIMBRI (sportello C, capitolo 11). Tampona timbra solo quando glielo dici tu: "io non sono
// responsabile di dove cade". Il timbro va avanti e indietro sopra il foglio; tu dici ORA! (il tasto
// per colpire) quando è sopra la casella giusta. Le caselle vanno timbrate in ordine (1, 2, 3...), ma
// sul foglio sono sparse. Ogni timbro giusto, lei va più veloce (si scalda). Tre timbri storti: il
// modulo è ANNULLATO e bisogna rifare la fila.
// ---------------------------------------------------------------------------

export interface StampBox {
  n: number; // l'ordine
  label: string;
  x: number; // centro (0..1 sul foglio)
  w: number; // larghezza (0..1)
}

export interface StampDef {
  title: string;
  boxes: StampBox[];
  speed: number;
}

const S = {
  def: null as StampDef | null,
  el: null as HTMLElement | null,
  phase: 0, // angolo dell'oscillazione
  x: 0.5,
  drop: 0, // >0: il timbro sta scendendo / risalendo
  done: [] as number[], // caselle timbrate
  marks: [] as { x: number; ok: boolean }[],
  errors: 0,
  end: 0, // >0: finito (si chiude da solo)
  ok: false,
  onEnd: null as ((ok: boolean) => void) | null,
  stamper: null as HTMLElement | null,
};

const MAX_ERR = 3;

export function openStamps(g: Game, def: StampDef, onEnd: (ok: boolean) => void) {
  S.def = def;
  S.phase = -Math.PI / 2;
  S.x = 0.06;
  S.drop = 0;
  S.done = [];
  S.marks = [];
  S.errors = 0;
  S.end = 0;
  S.ok = false;
  S.onEnd = onEnd;
  const el = document.createElement('div');
  el.className = 'chapter-ui timbri';
  g.hud.root.appendChild(el);
  S.el = el;
  g.touchMode = { fire: 'ORA!', use: null, jump: null, crouch: null, parry: null };
  g.interactOff = true;
  g.minigame = (dt) => update(g, dt);
  render();
}

function close(g: Game) {
  S.el?.remove();
  S.el = S.stamper = null;
  S.def = null;
  g.minigame = null;
  g.touchMode = null;
  g.interactOff = false;
  const cb = S.onEnd;
  S.onEnd = null;
  cb?.(S.ok);
}

export function closeStamps(g: Game) {
  if (S.def) {
    S.ok = false;
    close(g);
  }
}

const nextBox = () => S.def!.boxes.filter((b) => !S.done.includes(b.n)).sort((a, b) => a.n - b.n)[0];

function update(g: Game, dt: number) {
  const def = S.def!;
  if (S.end > 0) {
    S.end -= dt;
    if (S.end <= 0) close(g);
    return;
  }
  if (S.drop > 0) {
    const was = S.drop;
    S.drop -= dt;
    // a metà discesa: TUNF
    if (was > 0.28 && S.drop <= 0.28) hit(g);
    position();
    return;
  }
  S.phase += dt * def.speed * (1 + 0.16 * S.done.length);
  S.x = 0.5 - 0.46 * Math.cos(S.phase);
  if (g.input.clicked) {
    S.drop = 0.45;
    g.audio.swing('fist');
  }
  position();
}

function hit(g: Game) {
  const def = S.def!;
  const tgt = nextBox();
  const ok = !!tgt && Math.abs(S.x - tgt.x) <= tgt.w / 2;
  g.audio.stamp(1);
  if (ok) {
    S.done.push(tgt.n);
    if (S.done.length === def.boxes.length) {
      S.ok = true;
      S.end = 1.6;
      g.audio.ding(true);
    } else g.audio.tick();
  } else {
    S.marks.push({ x: S.x, ok: false });
    S.errors++;
    g.audio.bad();
    if (S.errors >= MAX_ERR) {
      S.ok = false;
      S.end = 2.4;
    }
  }
  render();
}

function position() {
  const st = S.stamper;
  if (!st) return;
  const down = S.drop > 0 ? Math.sin((1 - S.drop / 0.45) * Math.PI) : 0;
  st.style.left = `${S.x * 100}%`;
  st.style.transform = `translate(-50%, ${down * 96}px)`;
}

function render() {
  const def = S.def, el = S.el;
  if (!def || !el) return;
  const tgt = nextBox();
  const boxes = def.boxes
    .map((b) => {
      const done = S.done.includes(b.n);
      return `<div class="bx ${done ? 'done' : ''} ${tgt && tgt.n === b.n && !S.end ? 'next' : ''}" style="left:${(b.x - b.w / 2) * 100}%;width:${b.w * 100}%"><span>${b.n}</span><small>${b.label}</small>${done ? '<em>VISTO</em>' : ''}</div>`;
    })
    .join('');
  const marks = S.marks.map((m) => `<div class="mk" style="left:${m.x * 100}%">storto</div>`).join('');
  const errs = Array.from({ length: MAX_ERR }, (_, i) => `<i class="${i < S.errors ? 'on' : ''}"></i>`).join('');
  const how = TOUCH ? 'ORA!' : attackName();
  el.innerHTML = `<div class="t">${def.title}</div>
    <div class="n">Spazio riservato all'ufficio. Timbrare in ordine: ${def.boxes
      .slice()
      .sort((a, b) => a.n - b.n)
      .map((b) => b.n)
      .join(', ')}.</div>
    <div class="area"><div class="stamper"><div class="hd"></div><div class="ft">TIMBRO</div></div>${boxes}${marks}</div>
    <div class="h">${S.end > 0 ? '' : `<b>${how}</b> = "ORA!": Tampona abbassa il timbro · storti: <span class="err">${errs}</span>`}</div>
    ${S.end > 0 ? `<div class="stamp ${S.ok ? '' : 'bad'}">${S.ok ? 'TIMBRATO' : 'ANNULLATO'}</div>` : ''}`;
  S.stamper = el.querySelector('.stamper');
  position();
}
