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
//
// Il ritmo della rissa: gli avversari PARANO SEMPRE. Per colpirli bisogna aspettare che
// attacchino, parare il loro colpo (tasto destro) e colpire finché sono scoperti.
// Alcuni vanno parati più volte prima di scoprirsi (numero casuale in `parries`).
// Attacca un avversario alla volta, e nessuno attacca mentre un altro è scoperto.
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
  // quante parate servono prima che si scopra: [minimo, massimo], estratto a caso ogni volta
  parries?: [number, number];
  // per quanti secondi resta scoperto dopo l'ultima parata
  openTime?: number;
}

type State = 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'open' | 'ko';

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
  parriesLeft = 1;
  strafe = Math.random() > 0.5 ? 1 : -1;

  constructor(o: FighterOpts = {}) {
    this.opts = o;
    this.hp = this.maxHp = o.hp ?? 70;
    this.dmg = o.dmg ?? 11;
    this.speed = o.speed ?? 3.6;
    this.reach = o.reach ?? 1.7;
    this.windup = o.windup ?? 0.6;
    this.cooldown = o.cooldown ?? 1.0;
    this.vision = o.vision;
    this.rollParries();
  }

  rollParries() {
    const [a, b] = this.opts.parries ?? [1, 2];
    this.parriesLeft = a + Math.floor(Math.random() * (b - a + 1));
  }

  get ko() {
    return this.state === 'ko';
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'idle';
    this.hostile = false;
    this.suspicion = 0;
    this.rollParries();
  }
}

const _v = new THREE.Vector3();

export class Combat {
  // zona in cui le guardie ti considerano un intruso
  restricted: (p: THREE.Vector3) => boolean = () => false;
  // punti di passaggio (porte): se un avversario non ti vede, passa da qui per raggiungerti
  nav: THREE.Vector3[] = [];
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
      if (npc.body instanceof Stickman) npc.body.seated = false;
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

  // Colpo del giocatore su un avversario: va a segno solo se è scoperto
  hit(npc: NPC, dmg: number) {
    const f = npc.fighter!;
    if (f.ko) return;
    const g = this.g;
    const head = npc.pos.clone().setY(1.6);
    if (f.state !== 'open') {
      // parato
      g.hud.popWord(head, g.player.camera, 'PARATO!');
      g.audio.block();
      if (npc.body instanceof Stickman) npc.body.blockReaction();
      this.provoke(npc, f.hostile ? 0 : 10);
      if (!g.is('tutParry')) {
        g.flag('tutParry');
        g.toast('Gli Evidenziatori <b>parano sempre</b>.<br>Aspetta che attacchino, <b>para col tasto destro</b>, poi colpisci finché sono scoperti.', 'info', 9000);
      }
      // chi insiste a colpire la guardia alzata si prende una risposta
      if ((f.state === 'chase' || f.state === 'idle') && Math.random() < 0.5 && !this.someoneOpen()) {
        f.state = 'windup';
        f.t = f.windup * 0.85;
      }
      return;
    }
    f.hp -= dmg;
    g.hud.popWord(head, g.player.camera, POW[Math.floor(Math.random() * POW.length)]);
    _v.subVectors(npc.pos, g.player.pos).setY(0).normalize();
    npc.pos.addScaledVector(_v, 0.15);
    g.world.colliders.resolve(npc.pos, 0.3);
    if (npc.body instanceof Stickman) npc.body.punchReaction();
    if (f.hp <= 0) {
      f.state = 'ko';
      f.hostile = false;
      npc.controlled = true;
      npc.ctrlSpeed = 0;
      if (npc.body instanceof Stickman) npc.body.ko = true;
      if (f.opts.koLine) npc.say(f.opts.koLine, 3);
      else npc.say(['Zzz...', 'Ho visto le stelline disegnate...', 'Mamma...', 'Ok. Ok. Hai vinto.'][Math.floor(Math.random() * 4)], 3);
      g.audio.ko();
      g.addXp(15);
      g.onKo(npc);
      return;
    }
    const lines = f.opts.hurtLines ?? ['Ahia!', 'Ugh!', 'Questa me la paghi!', 'Ehi!'];
    if (Math.random() < 0.4) npc.say(lines[Math.floor(Math.random() * lines.length)], 1.8);
  }

  private someoneOpen() {
    return this.fighters.some((n) => n.fighter!.state === 'open');
  }

  // Il colpo di un avversario arriva: parato o incassato
  private strikeLands(n: NPC, f: Fighter) {
    const g = this.g;
    const res = g.damagePlayer(f.dmg, n);
    if (res !== 'parried') return;
    f.parriesLeft--;
    if (f.parriesLeft <= 0) {
      // scoperto: finestra per colpire
      f.state = 'open';
      f.t = f.opts.openTime ?? 1.6;
      g.hud.popWord(n.pos.clone().setY(1.9), g.player.camera, 'SCOPERTO!');
      g.audio.opening();
    } else {
      // para ancora: riprova subito
      f.state = 'recover';
      f.t = 0.35;
      if (Math.random() < 0.6) n.say(['Ancora!', 'Non basta!', 'Di nuovo!', 'Hmpf.'][Math.floor(Math.random() * 4)], 1.2);
    }
  }

  update(dt: number) {
    const g = this.g;
    const p = g.player.pos;
    const list = this.fighters;
    let tokens = list.filter((n) => n.fighter!.state === 'windup' || n.fighter!.state === 'strike').length;
    const open = list.some((n) => n.fighter!.state === 'open');
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
          if (seen) f.suspicion += dt * (0.35 + 1.2 * Math.max(0, 1 - d / f.vision.range)) * (g.player.crouching ? 0.6 : 1);
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
          const tgt = this.chaseTarget(n);
          this.face(n, tgt.x, tgt.z, dt, 8);
          if (d > f.reach * 0.85 || tgt !== p) {
            const tx = tgt.x - n.pos.x, tz = tgt.z - n.pos.z;
            const td = Math.hypot(tx, tz) || 1;
            speed = this.move(n, tx / td, tz / td, f.speed, dt);
          } else if (tokens < 1 && !open && g.mode === 'play' && f.t <= 0) {
            f.state = 'windup';
            f.t = f.windup;
            tokens++;
          } else {
            f.t -= dt;
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
            if (d < f.reach + 0.45 && facing > 0.5 && !g.dialogue.isOpen) this.strikeLands(n, f);
          }
          break;
        case 'strike':
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'recover';
            f.t = f.cooldown * (0.8 + Math.random() * 0.5);
          }
          break;
        case 'open':
          // scoperto e stordito: non si muove, non para
          if (body) body.action = 'dizzy';
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'recover';
            f.t = 0.5;
            f.rollParries();
          }
          break;
        case 'recover':
          if (body) body.action = 'guard';
          this.face(n, p.x, p.z, dt, 6);
          if (d < 1.2) speed = this.move(n, -dx / d, -dz / d, f.speed * 0.5, dt);
          f.t -= dt;
          if (f.t <= 0) {
            f.state = 'chase';
            f.t = 0.25 + Math.random() * 0.5; // piccola pausa prima del prossimo attacco
          }
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
    return !this.g.world.colliders.blocked(n.pos.x, n.pos.z, p.x, p.z, this.g.player.crouching);
  }

  // Dove andare per raggiungere il giocatore: dritto se c'è strada libera, altrimenti verso la porta migliore
  private chaseTarget(n: NPC) {
    const p = this.g.player.pos;
    const col = this.g.world.colliders;
    if (!col.blocked(n.pos.x, n.pos.z, p.x, p.z)) return p;
    let best: THREE.Vector3 | null = null;
    let bestCost = Infinity;
    for (const w of this.nav) {
      if (Math.hypot(w.x - n.pos.x, w.z - n.pos.z) < 0.6) continue;
      if (col.blocked(n.pos.x, n.pos.z, w.x, w.z)) continue;
      const cost = n.pos.distanceTo(w) + w.distanceTo(p) + (col.blocked(w.x, w.z, p.x, p.z) ? 12 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = w;
      }
    }
    return best ?? p;
  }
}
