import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { SETTINGS, keyName } from '../../settings';
import { TOUCH } from '../../touch';
import { arrowSvg } from '../../ui/touch';

// ---------------------------------------------------------------------------
// Sfida di ballo: compare un tasto (W A S D), un cerchio rosso si stringe e va
// premuto quando si chiude, a tempo col battito della musica del club.
// ---------------------------------------------------------------------------

// i quattro tasti di movimento (quelli scelti nelle impostazioni)
// sul telefono al posto del nome del tasto c'è la freccia disegnata (terzo elemento: la direzione)
const keys = (): [string, string, string][] =>
  (['forward', 'left', 'back', 'right'] as const).map((a) => [SETTINGS.keys[a], keyName(a), a]);
const STEPS = 10;
const NEED = 7;
const WINDOW = 0.2; // secondi di tolleranza

export function startDanceOff(g: Game, rival: NPC, onEnd: (won: boolean) => void) {
  const bpm = 124;
  const beat = 60 / bpm;
  const audioClock = g.audio.ready && g.audio.music?.playing;
  const clock = () => (audioClock ? g.audio.now : g.time);

  // primo passo tra 4 battiti, poi uno ogni 2 battiti
  let t0: number;
  if (audioClock) {
    const b = g.audio.beat();
    t0 = g.audio.music!.beatTime(b.index + 4);
  } else {
    t0 = clock() + 4 * beat;
  }
  const KEYS = keys();
  const seq = Array.from({ length: STEPS }, () => KEYS[Math.floor(Math.random() * 4)]);
  const times = seq.map((_, i) => t0 + i * 2 * beat);

  const ui = document.createElement('div');
  ui.className = 'dance';
  ui.innerHTML = `<div class="key"><span class="k"></span><div class="ring"></div></div><div class="info"></div>`;
  g.hud.root.appendChild(ui);
  ui.style.display = 'block';
  const keyEl = ui.querySelector('.key') as HTMLElement;
  const kEl = ui.querySelector('.k') as HTMLElement;
  const ring = ui.querySelector('.ring') as HTMLElement;
  const info = ui.querySelector('.info') as HTMLElement;

  let i = 0;
  let hits = 0;
  let judged = false;
  let flash = 0;
  const look = new THREE.Vector3();

  const judge = (ok: boolean) => {
    judged = true;
    if (ok) {
      hits++;
      g.audio.good();
      keyEl.className = 'key ok';
    } else {
      g.audio.miss();
      keyEl.className = 'key bad';
    }
    flash = 0.25;
  };

  g.minigame = (dt) => {
    const now = clock();
    look.set(rival.pos.x, rival.headY - 0.3, rival.pos.z);
    g.player.easeLook(look, dt);

    if (i >= STEPS) {
      finish();
      return;
    }
    const t = times[i];
    const before = t - now;
    // conto alla rovescia prima del primo passo
    if (i === 0 && before > 2 * beat) {
      const n = Math.ceil((before - 2 * beat) / beat);
      kEl.textContent = n > 0 ? String(n) : 'VIA!';
      kEl.dataset.dir = '';
      ring.style.setProperty('--s', '1');
      ring.style.setProperty('--o', '0');
      info.textContent = TOUCH ? 'Rey ti sfida! Tocca la freccia giusta quando il cerchio si chiude.' : 'Rey ti sfida! Premi il tasto quando il cerchio si chiude.';
      return;
    }
    if (TOUCH) {
      if (kEl.dataset.dir !== seq[i][2]) {
        kEl.innerHTML = arrowSvg(seq[i][2], 72);
        kEl.dataset.dir = seq[i][2];
      }
    } else kEl.textContent = seq[i][1];
    const k = Math.max(0, before) / (2 * beat);
    ring.style.setProperty('--s', String(1 + k * 1.6));
    ring.style.setProperty('--o', String(0.9 - k * 0.6));
    info.textContent = `Passo ${i + 1}/${STEPS} · giusti: ${hits} (ne servono ${NEED})`;

    if (!judged) {
      for (const [code] of KEYS) {
        if (!g.input.pressed.has(code)) continue;
        if (Math.abs(now - t) <= WINDOW && code === seq[i][0]) judge(true);
        else if (before < 2 * beat * 0.6) judge(false); // premuto troppo presto o tasto sbagliato
        break;
      }
    }
    if (now > t + WINDOW) {
      if (!judged) judge(false);
      i++;
      judged = false;
    }
    if (flash > 0) {
      flash -= dt;
      if (flash <= 0) keyEl.className = 'key';
    }
  };

  const finish = () => {
    g.minigame = null;
    ui.remove();
    const won = hits >= NEED;
    g.toast(`Passi giusti: <b>${hits}/${STEPS}</b>${won ? ' · Hai vinto!' : ' · Rey vince.'}`, won ? 'reward' : 'bad', 4000);
    onEnd(won);
  };
}
