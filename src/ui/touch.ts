import type { Game } from '../game/game';
import type { Action } from '../settings';

// ---------------------------------------------------------------------------
// Comandi a schermo per il telefono (in orizzontale):
//  - metà sinistra: joystick che compare dove appoggi il pollice
//  - metà destra: trascina per guardarti intorno
//  - pulsanti trasparenti: COLPISCI (tieni premuto = a raffica, e trascinando giri la visuale),
//    PARA (tieni premuto), SALTA, GIÙ, USA, RICARICA, ARMA, DIARIO, pausa
//  - nei dialoghi: tocca per andare avanti, tocca una risposta per sceglierla
// Scrive tutto dentro Input, come se fossero tasti e mouse.
// ---------------------------------------------------------------------------

const LOOK_SPEED = 1.9; // pixel di trascinamento → come pixel di mouse
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
  private fireHeld = false;
  private fireNext = 0;
  private btn: Record<string, HTMLElement> = {};

  constructor(private g: Game) {
    document.body.classList.add('touch');
    this.root = el('div', 'touch-ui', document.body);
    el('div', 'rotate', document.body, '<div class="phone"></div><div>Gira il telefono in orizzontale</div>');

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
    // pulsanti
    const fire = this.button('fire', 'COLPISCI', 'b-fire');
    fire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.fireHeld = true;
      this.fireNext = 0;
      this.trackLook(e);
    }, { passive: false });
    fire.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    const fireEnd = (e: TouchEvent) => {
      this.fireHeld = false;
      this.lookEnd(e);
    };
    fire.addEventListener('touchend', fireEnd);
    fire.addEventListener('touchcancel', fireEnd);

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
    this.stickId = t.identifier;
    this.stickOrigin = { x: t.clientX, y: t.clientY };
    this.stick.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
    this.stick.classList.add('on');
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private stickMove(e: TouchEvent) {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      let dx = t.clientX - this.stickOrigin.x, dy = t.clientY - this.stickOrigin.y;
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
    for (const t of Array.from(e.changedTouches)) this.looks.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now(), moved: 0 });
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
      const dx = t.clientX - l.x, dy = t.clientY - l.y;
      this.g.input.mouseDX += dx * LOOK_SPEED;
      this.g.input.mouseDY += dy * LOOK_SPEED;
      l.moved += Math.abs(dx) + Math.abs(dy);
      l.x = t.clientX;
      l.y = t.clientY;
    }
  }

  private lookEnd(e: TouchEvent) {
    for (const t of Array.from(e.changedTouches)) this.looks.delete(t.identifier);
  }

  // chiamato a ogni frame: quali pulsanti mostrare
  update() {
    const g = this.g;
    const inp = g.input;
    // telefono girato in verticale: pausa (c'è l'avviso "gira il telefono")
    if (inp.locked && g.mode === 'play' && matchMedia('(orientation: portrait)').matches) inp.unlock();
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
    this.btn.reload.classList.toggle('hide', p.weapon !== 'pistol');
    this.btn.weapon.classList.toggle('hide', !(g.has('righello') || g.has('pistola')));
    this.btn.use.classList.toggle('hide', !g.hasFocus);
    this.btn.crouch.classList.toggle('down', p.crouching);
    this.btn.fire.textContent = p.weapon === 'pistol' ? 'SPARA' : 'COLPISCI';
    if (!free) {
      this.fireHeld = false;
      if (this.stickId !== null) {
        this.stickId = null;
        this.stick.classList.remove('on');
      }
      inp.moveX = inp.moveY = 0;
      return;
    }
    // COLPISCI tenuto premuto: un colpo ogni tanto (i pugni e la pistola hanno già il loro ritmo)
    if (this.fireHeld && g.time >= this.fireNext) {
      inp.clicked = true;
      this.fireNext = g.time + (p.weapon === 'pistol' ? 0.28 : 0.35);
    }
  }
}
