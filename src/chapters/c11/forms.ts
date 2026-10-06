import type { Game } from '../../game/game';
import { TOUCH } from '../../touch';
import { keyName } from '../../settings';
import { VIEW } from '../../view';

// ---------------------------------------------------------------------------
// I MODULI (capitolo 11): un foglio sullo schermo, a righe verdi come i tabulati, con le domande e le
// caselle da barrare. Sul computer si muove una penna col mouse (il mouse resta "catturato" dal gioco);
// sul telefono si tocca la casella. Una risposta sbagliata va cancellata col correttore: costa tempo
// (lo decide chi apre il modulo). Le istruzioni in piccolo, sotto le domande, aiutano.
// USA per lasciarlo a metà (le risposte restano).
// ---------------------------------------------------------------------------

export interface Field {
  q: string;
  hint?: string;
  opts: string[];
  ok: number | number[]; // la casella giusta (o le caselle: es. le foto venute bene)
  why?: string; // cosa dice il correttore se sbagli
}

export interface FormDef {
  id: string;
  title: string;
  note: string;
  fields: Field[];
}

interface FormState {
  answers: (number | null)[];
  wrong: Set<string>;
}

const STATES = new Map<string, FormState>();
export const resetForms = () => STATES.clear();
// una risposta da rifare (es. il campo della foto, dopo una fototessera nuova)
export function clearAnswer(id: string, field: number) {
  const st = STATES.get(id);
  if (st) st.answers[field] = null;
}
const good = (f: Field, a: number | null) => a !== null && (Array.isArray(f.ok) ? f.ok.includes(a) : a === f.ok);

const F = {
  def: null as FormDef | null,
  st: null as FormState | null,
  el: null as HTMLElement | null,
  cursor: null as HTMLElement | null,
  x: 0,
  y: 0,
  done: 0, // >0: compilato, si chiude da solo
  msg: '',
  msgT: 0,
  onMistake: null as (() => void) | null,
  onDone: null as ((complete: boolean) => void) | null,
};

export const formOpen = () => !!F.def;

export function openForm(g: Game, def: FormDef, onMistake: () => void, onDone: (complete: boolean) => void) {
  if (F.def) return;
  let st = STATES.get(def.id);
  if (!st) {
    st = { answers: def.fields.map(() => null), wrong: new Set() };
    STATES.set(def.id, st);
  }
  F.def = def;
  F.st = st;
  F.done = 0;
  F.msg = '';
  F.onMistake = onMistake;
  F.onDone = onDone;
  const el = document.createElement('div');
  el.className = 'chapter-ui modulo';
  g.hud.root.appendChild(el);
  F.el = el;
  if (!TOUCH) {
    const c = document.createElement('div');
    c.className = 'chapter-ui fakecursor';
    // la penna (disegnata: niente emoji)
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 34 34"><path d="M3 31 L7 21 L25 3 L31 9 L13 27 Z" fill="#f7f8f1" stroke="#1f2629" stroke-width="2.4" stroke-linejoin="round"/><path d="M3 31 L7 21 L13 27 Z" fill="#1f2629"/></svg>';
    g.hud.root.appendChild(c);
    F.cursor = c;
    F.x = VIEW.w * 0.5;
    F.y = VIEW.h * 0.55;
  } else {
    el.addEventListener('click', (e) => {
      const o = (e.target as HTMLElement).closest<HTMLElement>('[data-f]');
      if (o) choose(g, +o.dataset.f!, +o.dataset.o!);
    });
  }
  g.touchMode = { fire: null, use: 'LASCIA', jump: null, crouch: null, parry: null };
  g.interactOff = true;
  g.minigame = (dt) => update(g, dt);
  g.audio.select();
  render();
}

// chiuso dal capitolo (es. a mezzogiorno l'ufficio chiude): le risposte restano
export function closeForm(g: Game) {
  if (F.def) close(g, false);
}

function close(g: Game, complete: boolean) {
  F.el?.remove();
  F.cursor?.remove();
  F.el = F.cursor = null;
  F.def = null;
  g.minigame = null;
  g.touchMode = null;
  g.interactOff = false;
  const cb = F.onDone;
  F.onDone = null;
  cb?.(complete);
}

// per le prove (in sviluppo): barra una casella
export const pickForm = (g: Game, fi: number, oi: number) => choose(g, fi, oi);

function choose(g: Game, fi: number, oi: number) {
  const def = F.def, st = F.st;
  if (!def || !st || F.done > 0) return;
  const f = def.fields[fi];
  if (!f || good(f, st.answers[fi])) return;
  if (good(f, oi)) {
    st.answers[fi] = oi;
    g.audio.tick();
    if (def.fields.every((ff, i) => good(ff, st.answers[i]))) {
      F.done = 1.3;
      g.audio.ding(true);
    }
  } else if (!st.wrong.has(`${fi}:${oi}`)) {
    st.wrong.add(`${fi}:${oi}`);
    F.msg = f.why ?? 'Correttore. Il campo va riscritto (e il tempo passa).';
    F.msgT = 3.5;
    g.audio.bad();
    F.onMistake?.();
  }
  render();
}

function update(g: Game, dt: number) {
  const inp = g.input;
  if (F.done > 0) {
    F.done -= dt;
    if (F.done <= 0) close(g, true);
    return;
  }
  if (inp.wasPressed('interact')) return close(g, false);
  if (F.msgT > 0) {
    F.msgT -= dt;
    if (F.msgT <= 0) {
      F.msg = '';
      render();
    }
  }
  if (!TOUCH && F.cursor) {
    F.x = Math.max(0, Math.min(VIEW.w, F.x + inp.mouseDX));
    F.y = Math.max(0, Math.min(VIEW.h, F.y + inp.mouseDY));
    F.cursor.style.transform = `translate(${F.x - 3}px, ${F.y - 31}px)`;
    // la casella sotto la punta della penna
    const under = document.elementFromPoint(F.x, F.y) as HTMLElement | null;
    const o = under?.closest<HTMLElement>('[data-f]') ?? null;
    F.el?.querySelectorAll('.opt.hover').forEach((e) => e !== o && e.classList.remove('hover'));
    o?.classList.add('hover');
    if (inp.clicked && o) choose(g, +o.dataset.f!, +o.dataset.o!);
  }
}

function render() {
  const def = F.def, st = F.st, el = F.el;
  if (!def || !st || !el) return;
  const rows = def.fields
    .map((f, fi) => {
      const done = good(f, st.answers[fi]);
      const opts = f.opts
        .map((o, oi) => {
          const cls = done && oi === st.answers[fi] ? 'ok' : st.wrong.has(`${fi}:${oi}`) ? 'no' : '';
          return `<span class="opt ${cls}" data-f="${fi}" data-o="${oi}"><i></i>${o}</span>`;
        })
        .join('');
      return `<div class="f ${done ? 'done' : ''}"><div class="q">${fi + 1}. ${f.q}${f.hint ? `<small>${f.hint}</small>` : ''}</div><div class="o">${opts}</div></div>`;
    })
    .join('');
  const left = def.fields.filter((f, i) => !good(f, st.answers[i])).length;
  el.innerHTML = `<div class="t">${def.title}</div><div class="n">${def.note}</div>${rows}
    <div class="msg">${F.msg}</div>
    <div class="h">${F.done > 0 ? '' : left ? `campi da compilare: ${left} · <b>${TOUCH ? 'LASCIA' : keyName('interact')}</b> per lasciarlo a metà` : ''}</div>
    ${F.done > 0 ? '<div class="stamp">COMPILATO</div>' : ''}`;
}
