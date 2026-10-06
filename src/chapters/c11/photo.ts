import * as THREE from 'three';
import type { Game } from '../../game/game';
import { BOOTH, dots, finishBooth, openBooth, type Booth } from '../../game/booth';
import { BOOTH_AT, REFS11 } from './world';

// ---------------------------------------------------------------------------
// LA FOTOTESSERA (capitolo 11): quattro pose, due monete. Sei seduto sullo sgabello; la macchina
// conta 3, 2, 1 e scatta. La foto è buona se in quel momento guardi l'obiettivo (il pallino nero:
// il mirino sopra) e stai fermo. L'obiettivo si sposta un po' (è vecchio), e dopo la seconda posa lo
// sgabello gira e scende di un giro: bisogna rimettersi in posizione.
// Per il Modulo 27-B serve almeno una foto buona.
// ---------------------------------------------------------------------------

export type Shot = 'ok' | 'storta' | 'mossa';

export const PH = {
  results: [] as Shot[],
  shot: 0,
  phase: 'prep' as 'prep' | 'count' | 'after' | 'done',
  t: 0,
  flash: 0,
  lastYaw: 0,
  lastPitch: 0,
  motion: 0, // quanto ti stai muovendo (rad/s, smorzato)
  aim: 0, // quanto sei lontano dall'obiettivo (rad)
  lastCount: 0,
};

const SHOTS = 4;
const STOOL = 0.3;
const lensBase = () => new THREE.Vector3(BOOTH_AT.x + 0.7, 1.45, BOOTH_AT.z);

export function openPhoto(g: Game, onEnd: (good: number) => void) {
  const booth: Booth = {
    id: 'foto',
    title: 'Fototessera',
    fire: '',
    help: () => 'Guarda il pallino nero (l\'obiettivo) e stai fermo quando scatta',
    spot: new THREE.Vector3(BOOTH_AT.x + 0.05, 0, BOOTH_AT.z),
    look: lensBase(),
    cone: { yaw: 0.55, up: 0.5, down: 0.45 },
    start(g) {
      PH.results = [];
      PH.shot = 0;
      PH.phase = 'prep';
      PH.t = 1.8;
      PH.flash = 0;
      PH.motion = 0;
      PH.lastCount = 0;
      const p = g.player;
      p.seated = true;
      p.floor = STOOL;
      p.pos.y = STOOL;
      // seduto, l'obiettivo è all'altezza degli occhi: il cono della visuale parte da lì
      p.pitch = 0;
      BOOTH.basePitch = 0;
      PH.lastYaw = p.yaw;
      PH.lastPitch = p.pitch;
      // niente pulsante per colpire: qui si guarda e basta
      g.touchMode = { fire: null, use: 'ESCI', jump: null, crouch: null, parry: null };
    },
    update(g, dt) {
      update(g, dt);
    },
    status() {
      const res = PH.results.map((r) => (r === 'ok' ? '<b>buona</b>' : r)).join(' · ');
      if (PH.phase === 'done') return 'Sviluppo in corso...';
      const big = PH.phase === 'count' ? `<span class="big">${Math.ceil(PH.t)}</span>` : PH.phase === 'after' ? '<span class="big">CLIC!</span>' : 'Pronti...';
      return `Posa ${Math.min(SHOTS, PH.shot + 1)} di ${SHOTS} ${dots(SHOTS - PH.shot, SHOTS)}<br>${big}${res ? `<br>${res}` : ''}`;
    },
    stop(g) {
      const p = g.player;
      p.seated = false;
      p.floor = 0;
      p.pos.y = 0;
      REFS11.lens?.position.copy(lensBase());
      if (REFS11.flash) (REFS11.flash.material as THREE.MeshBasicMaterial).opacity = 0;
    },
  };
  openBooth(g, booth, (r) => {
    if (r >= 0) onEnd(r);
  });
}

const tmp = new THREE.Vector3();
const dir = new THREE.Vector3();

function update(g: Game, dt: number) {
  const p = g.player;
  // il lampo
  if (PH.flash > 0) PH.flash = Math.max(0, PH.flash - dt * 2.6);
  if (REFS11.flash) (REFS11.flash.material as THREE.MeshBasicMaterial).opacity = Math.min(1, PH.flash * 1.4);
  // l'obiettivo si sposta un po' (sempre di più)
  const lens = REFS11.lens;
  const amp = 0.018 + PH.shot * 0.012;
  const tt = g.time;
  if (lens) lens.position.copy(lensBase()).add(tmp.set(0, Math.sin(tt * 0.9) * amp, Math.sin(tt * 0.67 + 1) * amp * 1.3));
  // quanto ti muovi e dove guardi
  const dy = Math.atan2(Math.sin(p.yaw - PH.lastYaw), Math.cos(p.yaw - PH.lastYaw));
  const sp = (Math.abs(dy) + Math.abs(p.pitch - PH.lastPitch)) / Math.max(dt, 1e-3);
  PH.motion += (sp - PH.motion) * Math.min(1, dt * 8);
  PH.lastYaw = p.yaw;
  PH.lastPitch = p.pitch;
  if (lens) {
    p.camera.getWorldDirection(dir);
    tmp.copy(lens.position).sub(p.camera.position).normalize();
    PH.aim = Math.acos(Math.max(-1, Math.min(1, dir.dot(tmp))));
  }
  if (PH.phase === 'done') return;
  PH.t -= dt;
  if (PH.phase === 'prep' && PH.t <= 0) {
    PH.phase = 'count';
    PH.t = 3;
    PH.lastCount = 4;
  }
  if (PH.phase === 'count') {
    const c = Math.ceil(PH.t);
    if (c !== PH.lastCount && c > 0) {
      PH.lastCount = c;
      g.audio.tick();
    }
    if (PH.t <= 0) {
      // CLIC
      const shot: Shot = PH.motion > 0.6 ? 'mossa' : PH.aim > 0.075 ? 'storta' : 'ok';
      PH.results.push(shot);
      PH.flash = 1;
      g.audio.shutter();
      PH.shot++;
      PH.phase = 'after';
      PH.t = 1.1;
    }
  }
  if (PH.phase === 'after' && PH.t <= 0) {
    if (PH.shot >= SHOTS) {
      PH.phase = 'done';
      const good = PH.results.filter((r) => r === 'ok').length;
      finishBooth(g, `${strip(PH.results)}${good ? `Foto buone: ${good}` : 'Nessuna foto buona'}`, good);
      return;
    }
    // dopo la seconda posa lo sgabello gira e scende
    if (PH.shot === 2) {
      g.audio.creak();
      p.floor = STOOL - 0.17;
      p.pos.y = p.floor;
      g.toast('Cric cric: lo sgabello gira da solo e scende di un giro. Rimettiti in posizione.', 'info', 3200);
    }
    PH.phase = 'prep';
    PH.t = 1.3;
  }
}

// la striscia delle quattro foto (disegnate)
export function strip(rs: Shot[]) {
  const face = (r: Shot) => {
    const cx = r === 'storta' ? 44 : 30;
    const head = `<circle cx="${cx}" cy="30" r="14" fill="none" stroke="#1f2629" stroke-width="2.4"/>`;
    const eyes = r === 'storta' ? `<circle cx="${cx + 5}" cy="28" r="1.8" fill="#1f2629"/><circle cx="${cx + 11}" cy="28" r="1.8" fill="#1f2629"/>` : `<circle cx="${cx - 5}" cy="28" r="1.8" fill="#1f2629"/><circle cx="${cx + 5}" cy="28" r="1.8" fill="#1f2629"/>`;
    const ghost = r === 'mossa' ? `<circle cx="${cx + 6}" cy="32" r="14" fill="none" stroke="#1f2629" stroke-width="1.6" opacity=".45"/><circle cx="${cx - 5}" cy="27" r="14" fill="none" stroke="#1f2629" stroke-width="1.4" opacity=".35"/>` : '';
    const body = `<path d="M${cx} 44 L${cx} 70 M${cx - 18} 70 Q${cx} 52 ${cx + 18} 70" fill="none" stroke="#1f2629" stroke-width="2.4"/>`;
    return `<div><svg width="60" height="72" viewBox="0 0 60 72">${head}${eyes}${ghost}${body}</svg><br>${r === 'ok' ? 'buona' : r}</div>`;
  };
  return `<div class="fotostrip">${rs.map(face).join('')}</div>`;
}
