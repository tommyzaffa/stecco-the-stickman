import { SETTINGS, type Action } from './settings';
import { TOUCH } from './touch';

// Tastiera + mouse. "pressed" vale solo per il frame in cui il tasto è stato premuto.
// Le azioni (avanti, salta, parla...) passano dai tasti scelti nelle impostazioni.
// Sul telefono i comandi a schermo (ui/touch.ts) scrivono qui dentro le stesse cose.
export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  clicked = false;
  rightDown = false;
  locked = false; // in gioco (mouse catturato, o sul telefono: partita in corso)
  moveX = 0; // joystick (-1..1)
  moveY = 0;
  cycleWeapon = false; // pulsante ARMA (telefono)
  onLock: ((locked: boolean) => void)[] = [];
  // se impostato, il prossimo tasto premuto va qui (per riassegnare i comandi)
  captureKey: ((code: string) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (this.captureKey) {
        e.preventDefault();
        const cb = this.captureKey;
        this.captureKey = null;
        cb(e.code);
        return;
      }
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      // sul telefono il browser simula un clic dopo ogni tocco: lo ignoriamo (i tocchi li gestisce ui/touch.ts)
      if (TOUCH) return;
      if (this.locked && e.button === 0) this.clicked = true;
      if (this.locked && e.button === 2) this.rightDown = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightDown = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (TOUCH) return;
      this.setLocked(document.pointerLockElement === this.canvas);
    });
    // app in secondo piano (telefono): pausa
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && TOUCH && this.locked) this.setLocked(false);
    });
  }

  private setLocked(on: boolean) {
    this.locked = on;
    if (!on) {
      this.down.clear();
      this.rightDown = false;
      this.moveX = this.moveY = 0;
    }
    for (const f of this.onLock) f(on);
  }

  // pulsanti a schermo: premi (un frame) o tieni premuta un'azione
  press(a: Action) {
    this.pressed.add(SETTINGS.keys[a]);
  }

  hold(a: Action, on: boolean) {
    if (on) this.down.add(SETTINGS.keys[a]);
    else this.down.delete(SETTINGS.keys[a]);
  }

  isDown(a: Action) {
    return this.down.has(SETTINGS.keys[a]);
  }

  wasPressed(a: Action) {
    return this.pressed.has(SETTINGS.keys[a]);
  }

  lock() {
    if (TOUCH) {
      this.setLocked(true);
      return;
    }
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }

  unlock() {
    if (TOUCH) {
      if (this.locked) this.setLocked(false);
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.clicked = false;
    this.cycleWeapon = false;
  }
}
