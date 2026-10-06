import { TOUCH } from './touch';

// ---------------------------------------------------------------------------
// Schermo intero sul computer. Il problema: ESC fa uscire dallo schermo intero (e solo dopo, una volta
// rimpicciolito, compare la pausa). Invece ESC deve aprire la pausa e lo schermo restare intero.
// - Chrome/Edge: Keyboard Lock su ESC (a schermo intero ESC arriva al gioco; per uscire si tiene premuto).
// - Firefox/Safari (niente Keyboard Lock): ESC esce comunque, ma quando riprendi si torna a schermo
//   intero (serve un clic, e "Riprendi" lo è).
// ---------------------------------------------------------------------------

type KB = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };
const keyboard = () => (navigator as unknown as { keyboard?: KB }).keyboard;
const canLockEsc = () => !!keyboard()?.lock;

export const FS = { want: false };

export const isFull = () => !!document.fullscreenElement;

export function enterFull() {
  FS.want = true;
  const p = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  p?.then(() => keyboard()?.lock?.(['Escape']).catch(() => {})).catch(() => {});
  return p;
}

export function exitFull() {
  FS.want = false;
  keyboard()?.unlock?.();
  if (isFull()) document.exitFullscreen?.().catch(() => {});
}

export function toggleFull() {
  if (isFull()) exitFull();
  else enterFull();
}

// quando riprendi a giocare: se eri a schermo intero e ESC ti ha fatto uscire, ci torni
export function restoreFull() {
  if (FS.want && !isFull() && !TOUCH) enterFull();
}

document.addEventListener('fullscreenchange', () => {
  if (isFull()) {
    keyboard()?.lock?.(['Escape']).catch(() => {});
    return;
  }
  keyboard()?.unlock?.();
  // con ESC bloccato, si esce solo apposta (ESC tenuto premuto): allora non ci si torna da soli
  if (canLockEsc() && !TOUCH) FS.want = false;
});
