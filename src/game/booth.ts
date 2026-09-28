import * as THREE from 'three';
import type { Game } from './game';
import { attackName, keyName } from '../settings';
import { TOUCH } from '../touch';

// ---------------------------------------------------------------------------
// BANCONI (minigiochi "da fermo": le bancarelle della sagra, le freccette del pub...).
// Ti metti in un punto e giochi: non cammini, non salti, non tiri pugni; ti guardi intorno
// (entro un certo angolo, o la visuale la guida il gioco) e clicchi. Ogni partita finisce con
// un risultato; USA (E) / ESCI per andartene prima.
// Ogni minigioco implementa Booth; qui c'è quello che hanno in comune: il posto, la visuale,
// il riquadro in alto con titolo, stato e comandi, i pulsanti sul telefono.
// ---------------------------------------------------------------------------

export interface Booth {
  id: string;
  title: string;
  fire: string; // testo del pulsante COLPISCI sul telefono
  parry?: string; // se c'è: il pulsante PARA sul telefono, con questo testo (il tasto destro sul computer)
  help: () => string;
  footer?: () => string; // riga in fondo al riquadro (es. i gettoni della sagra)
  spot: THREE.Vector3; // dove ti metti
  look: THREE.Vector3; // dove guardi all'inizio
  cone?: { yaw: number; up: number; down: number }; // quanto ti puoi girare (radianti)
  fixed?: boolean; // visuale decisa dal gioco (lookAt)
  start(g: Game): void;
  update(g: Game, dt: number, click: boolean): void;
  status(): string;
  stop(g: Game): void;
}

export const BOOTH = {
  cur: null as Booth | null,
  el: null as HTMLElement | null,
  endT: -1, // partita finita: si chiude da sola tra un attimo
  result: '',
  baseYaw: 0,
  basePitch: 0,
  lookAt: new THREE.Vector3(), // per le visuali ferme
  onEnd: null as ((result: number) => void) | null,
  lastHtml: '',
  age: 0, // secondi da quando sei al bancone (il tasto che ha chiuso il dialogo non deve farti uscire o tirare)
};

// il capitolo viene scaricato: niente bancone a metà
export function resetBooth() {
  BOOTH.cur = null;
  BOOTH.el = null;
  BOOTH.onEnd = null;
  BOOTH.endT = -1;
}

export function openBooth(g: Game, b: Booth, onEnd: (result: number) => void) {
  if (BOOTH.cur) return;
  const p = g.player;
  BOOTH.cur = b;
  BOOTH.onEnd = onEnd;
  BOOTH.endT = -1;
  BOOTH.result = '';
  BOOTH.lastHtml = '';
  BOOTH.age = 0;
  p.pos.set(b.spot.x, p.floor, b.spot.z);
  p.setCrouch(false);
  p.rooted = true;
  p.setLook(b.look);
  BOOTH.baseYaw = p.yaw;
  BOOTH.basePitch = p.pitch;
  BOOTH.lookAt.copy(b.look);
  g.touchMode = { fire: b.fire, use: 'ESCI', jump: null, crouch: null, parry: b.parry ?? null };
  g.interactOff = true;
  g.hideNameTags = true;
  g.hud.root.classList.add('in-booth');
  const el = document.createElement('div');
  el.className = 'chapter-ui booth paper';
  g.hud.root.appendChild(el);
  BOOTH.el = el;
  b.start(g);
  g.audio.select();
}

// fine della partita: il risultato (html) resta nel riquadro un attimo, poi si torna a girare.
// "result" arriva a onEnd (es. i gettoni vinti, i punti fatti).
export function finishBooth(g: Game, html: string, result = 0) {
  if (!BOOTH.cur || BOOTH.endT >= 0) return;
  BOOTH.result = html;
  BOOTH.endT = 2.8;
  const cb = BOOTH.onEnd;
  BOOTH.onEnd = null;
  cb?.(result);
}

export function leaveBooth(g: Game) {
  const b = BOOTH.cur;
  if (!b) return;
  b.stop(g);
  BOOTH.cur = null;
  BOOTH.el?.remove();
  BOOTH.el = null;
  const p = g.player;
  p.rooted = false;
  g.touchMode = null;
  g.interactOff = false;
  g.hideNameTags = false;
  g.hud.root.classList.remove('in-booth');
  // un passo indietro dal bancone, così non riparte subito
  const back = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)).multiplyScalar(-0.5);
  p.pos.add(back);
  const cb = BOOTH.onEnd;
  BOOTH.onEnd = null;
  cb?.(-1); // uscito prima della fine
}

export function updateBooth(g: Game, dt: number) {
  const b = BOOTH.cur;
  if (!b) return;
  const p = g.player;
  const inp = g.input;
  BOOTH.age += dt;
  const busy = g.dialogue.isOpen || !inp.locked || BOOTH.age < 0.35;
  // visuale: ferma (la guida il gioco) o libera entro un cono
  if (b.fixed) {
    p.easeLook(BOOTH.lookAt, dt * 1.6);
  } else if (b.cone) {
    const c = b.cone;
    let d = p.yaw - BOOTH.baseYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.yaw = BOOTH.baseYaw + Math.max(-c.yaw, Math.min(c.yaw, d));
    p.pitch = Math.max(BOOTH.basePitch - c.down, Math.min(BOOTH.basePitch + c.up, p.pitch));
  }
  p.applyView();
  if (BOOTH.endT >= 0) {
    b.update(g, dt, false);
    BOOTH.endT -= dt;
    if (BOOTH.endT < 0) leaveBooth(g);
  } else {
    if (!busy && inp.wasPressed('interact')) return leaveBooth(g);
    b.update(g, dt, !busy && inp.clicked);
  }
  // riquadro: titolo, stato (o risultato), comandi
  const help = BOOTH.endT >= 0 ? '' : `<div class="h">${b.help()} · <b>${TOUCH ? 'ESCI' : keyName('interact')}</b> per andartene</div>`;
  const foot = b.footer ? `<div class="g">${b.footer()}</div>` : '';
  const html = `<div class="t">${b.title}</div><div class="s">${BOOTH.endT >= 0 ? BOOTH.result : b.status()}</div>${help}${foot}`;
  if (html !== BOOTH.lastHtml && BOOTH.el) {
    BOOTH.el.innerHTML = html;
    BOOTH.lastHtml = html;
  }
}

// il comando del minigioco nei testi: il pulsante sul telefono, il click sul computer
export const fireName = (b: Booth) => (TOUCH ? b.fire : attackName());

// pallini pieni / vuoti (palline rimaste, tentativi)
export const dots = (left: number, total: number) => Array.from({ length: total }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
