import type { Game } from '../game/game';
import type { Action } from '../settings';
import { VIEW, toGame } from '../view';

// ---------------------------------------------------------------------------
// Comandi a schermo per il telefono (in orizzontale):
//  - metà sinistra: joystick che compare dove appoggi il pollice
//  - metà destra: trascina per guardarti intorno
//  - un tocco veloce sulla metà destra = colpisci (o spari) dove punta il mirino, un colpo per tocco
//  - pulsanti trasparenti: SALTA, PARA (tieni premuto), GIÙ, USA, RICARICA, ARMA, DIARIO, pausa
//  - nei dialoghi: tocca per andare avanti, tocca una risposta per sceglierla
// Scrive tutto dentro Input, come se fossero tasti e mouse.
// ---------------------------------------------------------------------------

const LOOK_SPEED = 1.9; // pixel di trascinamento → come pixel di mouse
// un tocco è un "colpo" se è breve e il dito non si è quasi mosso
const TAP_MS = 280;
const TAP_MOVE = 12;
const STICK_R = 56;

const el = (tag: string, cls: string, parent: HTMLElement, html = '') => {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
};

export class TouchUI {
  private root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private looks = new Map<number, { x: number; y: number; t: number; moved: number }>();
  private btn: Record<string, HTMLElement> = {};

  constructor(private g: Game) {
    document.body.classList.add('touch');
    this.root = el('div', 'touch-ui', document.body);
    // iPhone girato senza blocco rotazione: si gioca solo col blocco attivo (vedi view.ts)
    el(
      'div',
      'lock-need',
      document.body,
      `<div class="card paper">
        <div class="phone"><span>🔒</span></div>
        <div class="title small">Attiva il blocco rotazione</div>
        <div class="sub">Su iPhone il gioco si gioca con il telefono girato ma lo schermo bloccato: così le barre di Safari finiscono di lato e hai tutto lo schermo.</div>
        <div class="steps">Apri il <b>Centro di Controllo</b> (scorri giù dall'angolo in alto a destra) e tocca il <b>lucchetto con la freccia</b>. Poi gira il telefono: il gioco si gira da solo.</div>
        <div class="alt">Oppure: <b>Condividi → Aggiungi alla schermata Home</b>, e da lì giochi a tutto schermo come preferisci.</div>
      </div>`,
    );

    // zone: sinistra = joystick, destra = visuale (i pulsanti stanno sopra)
    const left = el('div', 'tz tz-left', this.root);
    const right = el('div', 'tz tz-right', this.root);
    this.stick = el('div', 'stick', this.root);
    this.knob = el('div', 'knob', this.stick);

    left.addEventListener('touchstart', (e) => this.stickStart(e), { passive: false });
    left.addEventListener('touchmove', (e) => this.stickMove(e), { passive: false });
    left.addEventListener('touchend', (e) => this.stickEnd(e));
    left.addEventListener('touchcancel', (e) => this.stickEnd(e));
    right.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    right.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    right.addEventListener('touchend', (e) => this.lookEnd(e));
    right.addEventListener('touchcancel', (e) => this.lookEnd(e));

    const inp = g.input;
    // pulsanti (per colpire basta toccare lo schermo: si colpisce dove punta il mirino)
    const parry = this.button('parry', 'PARA', 'b-parry');
    parry.addEventListener('touchstart', (e) => {
      e.preventDefault();
      inp.rightDown = true;
    }, { passive: false });
    const parryEnd = () => (inp.rightDown = false);
    parry.addEventListener('touchend', parryEnd);
    parry.addEventListener('touchcancel', parryEnd);

    this.tap(this.button('jump', 'SALTA', 'b-jump'), () => inp.press('jump'));
    this.tap(this.button('crouch', 'GIÙ', 'b-crouch'), () => inp.press('crouch'));
    this.tap(this.button('use', 'USA', 'b-use'), () => inp.press('interact'));
    this.tap(this.button('reload', 'RICARICA', 'b-reload'), () => inp.press('reload'));
    this.tap(this.button('weapon', 'ARMA', 'b-weapon'), () => (inp.cycleWeapon = true));
    this.tap(this.button('journal', 'DIARIO', 'b-journal'), () => inp.press('journal'));
    this.tap(this.button('pause', '❚❚', 'b-pause'), () => inp.unlock());
    // frecce per il minigioco di ballo
    const pad = el('div', 'dpad', this.root);
    for (const [a, label] of [['forward', '▲'], ['left', '◀'], ['right', '▶'], ['back', '▼']] as [Action, string][]) {
      this.tap(el('div', `tb d-${a}`, pad, label), () => inp.press(a));
    }
    this.btn.dpad = pad;

    // nei dialoghi toccare lo schermo = andare avanti (le risposte si toccano da sole)
    document.addEventListener('touchstart', (e) => {
      if (!g.dialogue.isOpen || !inp.locked || g.hud.screenVisible) return;
      if ((e.target as HTMLElement).closest('.choice')) return;
      inp.clicked = true;
    }, { passive: true });

    // HUD: risposte, suggerimento "USA" e diario si toccano
    g.hud.onChoice = (i) => g.dialogue.choose(i);
    g.hud.onPrompt = () => inp.press('interact');
    g.hud.onDiario = () => inp.press('journal');
  }

  private button(id: string, label: string, cls: string) {
    const b = el('div', `tb ${cls}`, this.root, label);
    this.btn[id] = b;
    return b;
  }

  private tap(b: HTMLElement, fn: () => void) {
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.add('down');
      fn();
    }, { passive: false });
    const up = () => b.classList.remove('down');
    b.addEventListener('touchend', up);
    b.addEventListener('touchcancel', up);
  }

  // --- joystick ---
  private stickStart(e: TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    const [x, y] = toGame(t.clientX, t.clientY);
    this.stickId = t.identifier;
    this.stickOrigin = { x, y };
    this.stick.style.transform = `translate(${x}px, ${y}px)`;
    this.stick.classList.add('on');
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private stickMove(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      const [x, y] = toGame(t.clientX, t.clientY);
      let dx = x - this.stickOrigin.x, dy = y - this.stickOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) {
        dx = (dx / d) * STICK_R;
        dy = (dy / d) * STICK_R;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.g.input.moveX = dx / STICK_R;
      this.g.input.moveY = dy / STICK_R;
    }
  }

  private stickEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      this.stickId = null;
      this.stick.classList.remove('on');
      this.g.input.moveX = this.g.input.moveY = 0;
    }
  }

  // --- visuale ---
  private trackLook(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      const [x, y] = toGame(t.clientX, t.clientY);
      this.looks.set(t.identifier, { x, y, t: performance.now(), moved: 0 });
    }
  }

  private lookStart(e: TouchEvent) {
    e.preventDefault();
    this.trackLook(e);
  }

  private lookMove(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const l = this.looks.get(t.identifier);
      if (!l) continue;
      const [x, y] = toGame(t.clientX, t.clientY);
      const dx = x - l.x, dy = y - l.y;
      this.g.input.mouseDX += dx * LOOK_SPEED;
      this.g.input.mouseDY += dy * LOOK_SPEED;
      l.moved += Math.abs(dx) + Math.abs(dy);
      l.x = x;
      l.y = y;
    }
  }

  private lookEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      const l = this.looks.get(t.identifier);
      this.looks.delete(t.identifier);
      // tocco veloce e fermo: colpisci
      if (l && l.moved < TAP_MOVE && performance.now() - l.t < TAP_MS && this.root.classList.contains('free')) this.g.input.clicked = true;
    }
  }

  // chiamato a ogni frame: quali pulsanti mostrare
  update() {
    const g = this.g;
    const inp = g.input;
    // girato senza blocco rotazione: il gioco va in pausa finché non lo attivi
    if (VIEW.needLock && inp.locked) inp.unlock();
    const playing = g.mode === 'play' && inp.locked && !g.hud.screenVisible;
    const talk = playing && g.dialogue.isOpen;
    const dance = playing && !!g.minigame && !talk;
    const free = playing && !talk && !dance && !g.hud.diarioOpen;
    const r = this.root.classList;
    r.toggle('on', playing);
    r.toggle('free', free);
    r.toggle('talk', talk);
    r.toggle('dance', dance);
    const p = g.player;
    // sul telefono le munizioni stanno dentro il pulsante RICARICA (niente riquadro a parte)
    this.btn.reload.classList.toggle('hide', p.weapon !== 'pistol');
    if (p.weapon === 'pistol') {
      const st = g.state;
      const reloading = p.reloadT > 0;
      const html = `<span><b>${st.clip}</b>/${g.clipSize}<small>${reloading ? 'ricarico…' : `+${st.ammo} · RICARICA`}</small></span>`;
      if (this.btn.reload.innerHTML !== html) this.btn.reload.innerHTML = html;
      this.btn.reload.classList.toggle('empty', st.clip === 0 && !reloading);
    }
    this.btn.weapon.classList.toggle('hide', !(g.has('righello') || g.has('pistola')));
    this.btn.use.classList.toggle('hide', !g.hasFocus);
    this.btn.crouch.classList.toggle('down', p.crouching);
    if (!free) {
      if (this.stickId !== null) {
        this.stickId = null;
        this.stick.classList.remove('on');
      }
      inp.moveX = inp.moveY = 0;
    }
  }
}
