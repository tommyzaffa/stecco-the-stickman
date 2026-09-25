// Tastiera + mouse. "pressed" vale solo per il frame in cui il tasto è stato premuto.
export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  clicked = false;
  rightDown = false;
  locked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
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
      if (this.locked && e.button === 0) this.clicked = true;
      if (this.locked && e.button === 2) this.rightDown = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rightDown = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.down.clear();
        this.rightDown = false;
      }
    });
  }

  lock() {
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.clicked = false;
  }
}
