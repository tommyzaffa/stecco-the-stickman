import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { Stickman } from '../../entities/stickman';
import { HALL_H } from './world';
import type { Dialogue } from '../../game/dialogue';

// ---------------------------------------------------------------------------
// L'asta di mezzanotte: stacco sull'ultima fila, l'assistente che mostra il tappo,
// lo porta al tubo della posta pneumatica e... FIUUU.
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'toLot' | 'lift' | 'held' | 'toTube' | 'hatch' | 'up' | 'back' | 'done';
const A = { phase: 'idle' as Phase, t: 0 };

export function resetAuction() {
  A.phase = 'idle';
  A.t = 0;
}

// Buio, e riapri gli occhi seduto in ultima fila (con Marco accanto)
export function auctionCut(g: Game, dialogue: Dialogue) {
  const W = g.world.anchors;
  g.fade(true);
  g.after(0.8, () => {
    g.player.pos.set(W.seat.x, 0, W.seat.z);
    g.player.seated = true;
    g.player.setCrouch(false);
    const ban = g.npc('banditore');
    g.player.setLook(new THREE.Vector3(ban.pos.x, ban.topY - 0.3, ban.pos.z));
    const marco = g.npc('marco');
    marco.pos.set(W.seatMarco.x, 0, W.seatMarco.z);
    marco.homeRot = 0;
    marco.body.root.rotation.y = 0;
    marco.setBehavior({ type: 'sit' });
    g.fade(false);
    g.after(0.9, () => g.talk(dialogue, ban));
  });
}

// il banditore batte il martelletto a ogni "TOC"
export function auctionLine(g: Game, text: string) {
  if (text.includes('TOC')) {
    g.audio.gavel();
    const b = g.npc('banditore');
    b.baseAction = 'gavel';
    g.after(0.6, () => (b.baseAction = 'none'));
  }
}

export const presentLot = () => (A.phase = 'toLot');
export const sendLot = () => (A.phase = 'toTube');

function walk(n: NPC, x: number, z: number, speed: number, dt: number) {
  const dx = x - n.pos.x, dz = z - n.pos.z;
  const d = Math.hypot(dx, dz);
  n.controlled = true;
  if (n.body instanceof Stickman) n.body.faceTowards(x, z, dt, 8);
  if (d < 0.08) {
    n.ctrlSpeed = 0;
    return true;
  }
  const step = Math.min(d, speed * dt);
  n.pos.x += (dx / d) * step;
  n.pos.z += (dz / d) * step;
  n.ctrlSpeed = speed;
  return false;
}

// punto della "mano" dell'assistente (davanti al petto)
function hand(n: NPC, up = 0) {
  const r = n.body.root.rotation.y;
  return new THREE.Vector3(n.pos.x + Math.sin(r) * 0.35, n.pos.y + 1.35 + up, n.pos.z + Math.cos(r) * 0.35);
}

export function updateAuction(g: Game, dt: number) {
  if (A.phase === 'idle' || A.phase === 'done') return;
  const W = g.world.anchors;
  const pn = g.npc('pneumatica');
  const cap = g.world.props.lotto;
  const body = pn.body instanceof Stickman ? pn.body : null;
  A.t += dt;
  cap.rotation.y += dt * 2;
  switch (A.phase) {
    case 'toLot':
      if (body) body.action = 'none';
      if (walk(pn, W.lotto.x + 0.75, W.lotto.z + 0.5, 1.8, dt)) {
        A.phase = 'lift';
        A.t = 0;
      }
      break;
    case 'lift': {
      // solleva il tappo sopra la testa
      if (body) {
        body.faceTowards(g.player.pos.x, g.player.pos.z, dt, 5);
        body.action = 'wave';
      }
      const k = Math.min(1, A.t / 0.8);
      cap.position.lerpVectors(new THREE.Vector3(W.lotto.x, 2.12, W.lotto.z), hand(pn, 0.9), k * k * (3 - 2 * k));
      if (k >= 1) A.phase = 'held';
      break;
    }
    case 'held':
      if (body) body.faceTowards(g.player.pos.x, g.player.pos.z, dt, 5);
      cap.position.copy(hand(pn, 0.9 + Math.sin(A.t * 3) * 0.05));
      break;
    case 'toTube':
      if (body) body.action = 'none';
      cap.position.copy(hand(pn));
      if (walk(pn, W.tubeHatch.x - 0.2, W.tubeHatch.z - 0.75, 2.4, dt)) {
        A.phase = 'hatch';
        A.t = 0;
        g.hud.popWord(W.tubeHatch.clone(), g.player.camera, 'CLAC!');
      }
      break;
    case 'hatch': {
      // dentro lo sportello...
      const k = Math.min(1, A.t / 0.35);
      cap.position.lerpVectors(hand(pn), W.tubeHatch, k);
      if (k >= 1) {
        A.phase = 'up';
        A.t = 0;
        g.audio.tube();
      }
      break;
    }
    case 'up': {
      // ...e su per il tubo di vetro, sempre più veloce
      const k = Math.min(1, A.t / 0.7);
      cap.position.set(W.tubeHatch.x, 1.6 + (HALL_H + 0.5 - 1.6) * k * k, W.tubeHatch.z + 0.3);
      cap.rotation.y += dt * 20;
      if (A.t > 0.15 && A.t < 0.2) g.hud.popWord(new THREE.Vector3(W.tubeHatch.x, 3.5, W.tubeHatch.z), g.player.camera, 'FIUUUU!');
      if (k >= 1) {
        cap.visible = false;
        A.phase = 'back';
      }
      break;
    }
    case 'back':
      if (walk(pn, W.pneumatica.x, W.pneumatica.z, 1.6, dt)) {
        pn.controlled = false;
        pn.baseAction = 'phone';
        A.phase = 'done';
      }
      break;
  }
}
