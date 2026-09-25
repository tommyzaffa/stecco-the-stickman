import * as THREE from 'three';
import type { Game } from './game';
import type { NPC } from '../entities/npc';
import { Stickman } from '../entities/stickman';

// ---------------------------------------------------------------------------
// Risse e furtività.
//
// Un "Fighter" si attacca a un PNG e lo trasforma in un possibile avversario:
//  - finché non è ostile segue il suo comportamento normale (fermo, pattuglia...)
//  - se è una guardia (vision) e il giocatore entra in una zona vietata, lo può notare
//  - da ostile insegue, carica il colpo (ben visibile), colpisce, recupera
//  - al massimo due avversari caricano il colpo nello stesso momento: le risse
//    restano leggibili anche contro tanti nemici
// ---------------------------------------------------------------------------

export interface FighterOpts {
  hp?: number;
  dmg?: number;
  speed?: number;
  reach?: number;
  windup?: number;
  cooldown?: number;
  vision?: { range: number; fov: number };
  hurtLines?: string[];
  alertLine?: string;
  koLine?: string;
}

type State = 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'ko';

const POW = ['POW!', 'SBAM!', 'STOC!', 'PAF!', 'TUNF!', 'ZOK!'];

export class Fighter {
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  reach: number;
  windup: number;
  cooldown: number;
  vision?: { range: number; fov: number };
  state: State = 'idle';
  t = 0;
  hostile = false;
  suspicion = 0;
  opts: FighterOpts;
  strafe = Math.random() > 0.5 ? 1 : -1;

  constructor(o: FighterOpts = {}) {
    this.opts = o;
    this.hp = this.maxHp = o.hp ?? 70;
    this.dmg = o.dmg ?? 11;
    this.speed = o.speed ?? 3.6;
    this.reach = o.reach ?? 1.7;
    this.windup = o.windup ?? 0.5;
    this.cooldown = o.cooldown ?? 0.8;
    this.vision = o.vision;
  }

  get ko() {
    return this.state === 'ko';
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'idle';
    this.hostile = false;
    this.suspicion = 0;
  }
}

const _v = new THREE.Vector3();

export class Combat {
  // zona in cui le guardie ti considerano un intruso
  restricted: (p: THREE.Vector3) => boolean = () => false;
  private lastAlert = -10;

  constructor(private g: Game) {}

  attach(npc: NPC, o: FighterOpts = {}) {
    npc.fighter = new Fighter(o);
    return npc.fighter;
  }

  get fighters() {
    return this.g.npcs.filter((n) => n.fighter && !n.hidden);
  }

  get anyHostile() {
    return this.fighters.some((n) => n.fighter!.hostile && !n.fighter!.ko);
  }

  // Rende ostile un PNG (e chi gli sta vicino, se richiesto)
  provoke(npc: NPC, spread = 0) {
    const f = npc.fighter;
    if (!f || f.ko) return;
    if (!f.hostile) {
      f.hostile = true;
      f.state = 'chase';
      npc.controlled = true;
      if (f.opts.alertLine) npc.say(f.opts.alertLine, 2.5);
      if (this.g.time - this.lastAlert > 1.5) {
        this.g.audio.alert();
        this.lastAlert = this.g.time;
      }
    }
    if (spread > 0) {
      for (const o of this.fighters) {
        if (o !== npc && o.pos.distanceTo(npc.pos) < spread) this.provoke(o);
      }
    }
  }

  calmAll() {
    for (const n of this.fighters) {
      const f = n.fighter!;
      if (f.ko) continue;
      f.hostile = false;
      f.state = 'idle';
      f.suspicion = 0;
      n.controlled = false;
    }
  }

  // Colpo del giocatore su un avversario
  hit(npc: NPC, dmg: number) {
    const f = npc.fighter!;
    if (f.ko) return;
    f.hp -= dmg;
    const g = this.g;
    g.hud.popWord(npc.pos.clone().setY(1.6), g.player.camera, POW[Math.floor(Math.random() * POW.length)]);
    // spinta all'indietro
    _v.subVectors(npc.pos, g.player.pos).setY(0).normalize();
    npc.pos.addScaledVector(_v, 0.35);
    g.world.colliders.resolve(npc.pos, 0.3);
    if (f.hp <= 0) {
      f.state = 'ko';
      f.hostile = false;
      npc.controlled = true;
      npc.ctrlSpeed = 0;
      if (npc.body instanceof Stickman) npc.body.ko = true;
      if (f.opts.koLine) npc.say(f.opts.koLine, 3);
      else npc.say(['Zzz...', 'Ho visto le stelline disegnate...', 'Mamma...', 'Ok. Ok. Hai vinto.'][Math.floor(Math.random() * 4)], 3);
      g.audio.ko();
      g.onKo(npc);
      return;
    }
    const wasHostile = f.hostile;
    this.provoke(npc, wasHostile ? 0 : 10);
    f.state = 'stagger';
    f.t = 0.35;
    if (npc.body instanceof Stickman) npc.body.punchReaction();
    const lines = f.opts.hurtLines ?? ['Ahia!', 'Ugh!', 'Questa me la paghi!', 'Ehi!'];
    if (Math.random() < 0.4) npc.say(lines[Math.floor(Math.random() * lines.length)], 1.8);
  }

  update(dt: number) {
    const g = this.g;
    const p = g.player.pos;
    const list = this.fighters;
    let tokens = list.filter((n) => n.fighter!.state === 'windup' || n.fighter!.state === 'strike').length;
    const inRestricted = this.restricted(p);

    for (const n of list) {
      const f = n.fighter!;
      if (f.ko) {
        n.ctrlSpeed = 0;
        continue;
      }
      const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
      const d = Math.hypot(dx, dz);

      // --- furtività: le guardie notano chi entra dove non deve ---
      if (!f.hostile) {
        if (f.vision && g.mode === 'play' && !g.dialogue.isOpen) {
          const seen = inRestricted && this.canSee(n, f.vision.range * (g.player.crouching ? 0.55 : 1), f.vision.fov);
          if (seen) f.suspicion += dt * (0.55 + 1.8 * Math.max(0, 1 - d / f.vision.range)) * (g.player.crouching ? 0.6 : 1);
          else f.suspicion = Math.max(0, f.suspicion - dt * 0.2);
          // insospettito: si ferma e si gira verso di te
          n.controlled = f.suspicion > 0.3;
          if (n.controlled) {
            n.ctrlSpeed = 0;
            this.face(n, p.x, p.z, dt, 3);
          }
          if (f.suspicion >= 1) {
            f.suspicion = 1;
            this.provoke(n, 12);
          }
        }
        continue;
      }

      // --- ostile ---
      n.controlled = true;
      const body = n.body instanceof Stickman ? n.body : null;
      let speed = 0;
      switch (f.state) {
        case 'idle':
        case 'chase': {
          if (body) body.action = 'guard';
          this.face(n, p.x, p.z, dt, 8);
          if (d > f.reach * 0.85) {
            speed = this.move(n, dx / d, dz / d, f.speed, dt);
          } else if (tokens < 2 && g.mode === 'play') {
            f.state = 'windup';
            f.t = f.windup;
            tokens++;
          } else {
            // aspetta il suo turno girandoti intorno
            speed = this.move(n, (-dz / d) * f.strafe, (dx / d) * f.strafe, f.speed * 0.35, dt);
          }
          break;
        }
        case 'windup':
          if (body) body.action = 'windup';
          this.face(n, p.x, p.z, dt, 10);
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'strike';
            f.t = 0.18;
            if (body) body.action = 'strike';
            g.audio.swing('fist');
            // il colpo arriva se sei ancora a portata e davanti
            const fwdX = Math.sin(n.body.root.rotation.y), fwdZ = Math.cos(n.body.root.rotation.y);
            const facing = (dx * fwdX + dz * fwdZ) / (d || 1);
            if (d < f.reach + 0.45 && facing > 0.5 && !g.dialogue.isOpen) g.damagePlayer(f.dmg, n);
          }
          break;
        case 'strike':
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'recover';
            f.t = f.cooldown * (0.8 + Math.random() * 0.5);
          }
          break;
        case 'recover':
          if (body) body.action = 'guard';
          this.face(n, p.x, p.z, dt, 6);
          if (d < 1.2) speed = this.move(n, -dx / d, -dz / d, f.speed * 0.5, dt);
          f.t -= dt;
          if (f.t <= 0) f.state = 'chase';
          break;
        case 'stagger':
          f.t -= dt;
          if (f.t <= 0) f.state = 'chase';
          break;
      }
      n.ctrlSpeed = speed;
    }

    // gli avversari non si ammucchiano uno dentro l'altro
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.fighter!.ko || b.fighter!.ko) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7 && d > 1e-4) {
          const push = (0.7 - d) / 2;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push;
          b.pos.z += (dz / d) * push;
        }
      }
    }
  }

  private move(n: NPC, dx: number, dz: number, speed: number, dt: number) {
    n.pos.x += dx * speed * dt;
    n.pos.z += dz * speed * dt;
    this.g.world.colliders.resolve(n.pos, 0.3);
    return speed;
  }

  private face(n: NPC, x: number, z: number, dt: number, rate: number) {
    if (n.body instanceof Stickman) n.body.faceTowards(x, z, dt, rate);
  }

  // Campo visivo + linea di vista (i muri bloccano)
  canSee(n: NPC, range: number, fov: number) {
    const p = this.g.player.pos;
    const dx = p.x - n.pos.x, dz = p.z - n.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return false;
    const rot = n.body.root.rotation.y;
    const dot = (dx * Math.sin(rot) + dz * Math.cos(rot)) / (d || 1);
    if (dot < Math.cos((fov * Math.PI) / 360)) return false;
    return !this.g.world.colliders.blocked(n.pos.x, n.pos.z, p.x, p.z);
  }
}
