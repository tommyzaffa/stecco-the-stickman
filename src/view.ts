import { TOUCH } from './touch';
import { SETTINGS } from './settings';

// ---------------------------------------------------------------------------
// Dimensioni del gioco e rotazione.
//
// Sul telefono il gioco si gioca in orizzontale. Se lo schermo è bloccato in verticale (o il
// telefono è tenuto dritto), invece di chiedere di girarlo disegniamo tutto già ruotato di 90°:
// tenendo il telefono in orizzontale le barre del browser finiscono di lato e il gioco ha più
// altezza. Di default il telefono va girato in senso antiorario (la parte alta a sinistra);
// "Capovolgi lo schermo" nelle impostazioni per l'altro verso.
// ---------------------------------------------------------------------------

export const VIEW = {
  w: typeof innerWidth === 'number' ? innerWidth : 1280, // larghezza del gioco (px CSS)
  h: typeof innerHeight === 'number' ? innerHeight : 720,
  rot: 0 as 0 | 90 | -90, // rotazione applicata alla pagina
};

export function updateView() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const rotate = TOUCH && sh > sw;
  VIEW.rot = rotate ? (SETTINGS.flip ? -90 : 90) : 0;
  VIEW.w = rotate ? sh : sw;
  VIEW.h = rotate ? sw : sh;
  const root = document.documentElement;
  root.classList.toggle('rotated', rotate);
  root.classList.toggle('compact', VIEW.h < 540);
  root.style.setProperty('--gw', `${VIEW.w}px`);
  root.style.setProperty('--gh', `${VIEW.h}px`);
  const b = document.body.style;
  if (rotate) {
    b.width = `${VIEW.w}px`;
    b.height = `${VIEW.h}px`;
    // rotate(90deg): la parte alta del gioco va sul lato destro dello schermo verticale
    b.transform = VIEW.rot === 90 ? `translate(${sw}px, 0) rotate(90deg)` : `translate(0, ${sh}px) rotate(-90deg)`;
  } else {
    b.width = b.height = b.transform = '';
  }
}

// Punto dello schermo (clientX/Y di un tocco) → coordinate del gioco
export function toGame(x: number, y: number): [number, number] {
  if (VIEW.rot === 90) return [y, window.innerWidth - x];
  if (VIEW.rot === -90) return [window.innerHeight - y, x];
  return [x, y];
}
