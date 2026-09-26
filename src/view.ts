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
  needLock: false, // iPhone in Safari girato in orizzontale: si gioca solo col blocco rotazione
};

// ?iphone=1 nell'indirizzo simula un iPhone (per provare l'avviso sul computer)
export const IPHONE = /iPhone|iPod/.test(navigator.userAgent) || new URLSearchParams(location.search).has('iphone');
// aperto dalla schermata Home: già a tutto schermo, in qualunque verso
export const STANDALONE =
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches;

export function updateView() {
  const sw = window.innerWidth, sh = window.innerHeight;
  const rotate = TOUCH && sh > sw;
  // Su iPhone in Safari l'orizzontale "vero" ha le barre del browser sopra e sotto: si gioca
  // girando il telefono con il blocco rotazione attivo (lo schermo resta verticale e il gioco
  // si disegna girato). Su Android e dalla schermata Home si è già a tutto schermo: niente blocco.
  VIEW.needLock = TOUCH && IPHONE && !STANDALONE && sw > sh;
  document.documentElement.classList.toggle('need-lock', VIEW.needLock);
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
