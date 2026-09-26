import * as THREE from 'three';
import type { Game } from './game';
import type { NPC } from '../entities/npc';
import { Stickman } from '../entities/stickman';
import { parryName } from '../settings';

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
  // armi da fuoco (dal capitolo 4): chi spara non para, si ripara dietro le casse
  ranged?: RangedOpts;
  // corre verso di te a zig-zag (difficile da colpire da lontano)
  zigzag?: boolean;
}

// Chi spara: si nasconde dietro una copertura, si alza, prende la mira (linea colorata
// ben visibile: è il segnale per abbassarsi) e spara. Poi si riabbassa.
export interface RangedOpts {
  accuracy: number; // probabilità di colpire un bersaglio fermo e scoperto
  dmg: number;
  aim: number; // secondi di mira (quanto resta visibile la linea)
  color: string; // colore della cera (colpi e linea di mira)
  burst?: number; // colpi per ogni volta che si alza
  hide?: [number, number]; // secondi nascosto tra una raffica e l'altra
  sharpenEvery?: number; // (Pastellone) dopo tanti colpi si spunta e deve temperarsi: è il momento buono
  armor?: number; // moltiplicatore del danno quando non si sta temperando
}

type State = 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'open' | 'ko' | 'move' | 'hide' | 'aim' | 'sharpen';

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
  ranged?: RangedOpts;
  cover: THREE.Vector3 | null = null; // dove ripararsi (all'inizio lo decide il capitolo)
  shots = 0;
  burstLeft = 0;
  pinnedT = 0; // da quanto tempo da qui non riesce a colpirti (sei riparato): prima o poi ti aggira

  constructor(o: FighterOpts = {}) {
    this.opts = o;
    this.hp = this.maxHp = o.hp ?? 70;
    this.dmg = o.dmg ?? 11;
    this.speed = o.speed ?? 3.6;
    this.reach = o.reach ?? 1.7;
    this.windup = o.windup ?? 0.6;
    this.cooldown = o.cooldown ?? 1.0;
    this.vision = o.vision;
    this.ranged = o.ranged;
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
    this.shots = 0;
    this.rollParries();
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const SPLAT_WORDS = ['SPLAT!', 'SPLOTCH!', 'SPLASH!', 'CIAF!'];

const _v = new THREE.Vector3();

export class Combat {
  // zona in cui le guardie ti considerano un intruso
  restricted: (p: THREE.Vector3) => boolean = () => false;
  // punti di passaggio (porte): se un avversario non ti vede, passa da qui per raggiungerti
  nav: THREE.Vector3[] = [];
  maxAimers = 2; // quanti nemici possono prendere la mira nello stesso momento
  covers: THREE.Vector3[] = []; // punti dove ripararsi (vedi buildCovers)
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
      f.state = f.ranged ? (f.cover ? 'move' : 'hide') : 'chase';
      f.t = f.ranged ? rand(0.3, 1.2) : 0;
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
    // chi ha la pistola in mano non sa parare i pugni
    if (f.ranged) {
      g.hud.popWord(head, g.player.camera, POW[Math.floor(Math.random() * POW.length)]);
      this.damage(npc, dmg);
      return;
    }
    if (f.state !== 'open') {
      // parato
      g.hud.popWord(head, g.player.camera, 'PARATO!');
      g.audio.block();
      if (npc.body instanceof Stickman) npc.body.blockReaction();
      this.provoke(npc, f.hostile ? 0 : 10);
      if (!g.is('tutParry')) {
        g.flag('tutParry');
        g.toast(`Gli Evidenziatori <b>parano sempre</b>.<br>Aspetta che attacchino, <b>para con ${parryName()}</b>, poi colpisci finché sono scoperti.`, 'info', 9000);
      }
      // chi insiste a colpire la guardia alzata si prende una risposta
      if ((f.state === 'chase' || f.state === 'idle') && Math.random() < 0.5 && !this.someoneOpen()) {
        f.state = 'windup';
        f.t = f.windup * 0.85;
      }
      return;
    }
    g.hud.popWord(head, g.player.camera, POW[Math.floor(Math.random() * POW.length)]);
    this.damage(npc, dmg);
  }

  // Colpo di pistola: niente parate, l'inchiostro arriva e basta
  shot(npc: NPC, dmg: number, headshot = false) {
    const f = npc.fighter!;
    if (f.ko) return;
    const g = this.g;
    const r = f.ranged;
    let d = dmg;
    if (r?.armor && f.state !== 'sharpen') d = Math.round(d * r.armor);
    const top = npc.pos.clone().setY(npc.topY + 0.1);
    g.hud.popWord(top, g.player.camera, headshot ? 'IN TESTA!' : r?.armor && f.state !== 'sharpen' ? 'TOC!' : SPLAT_WORDS[Math.floor(Math.random() * SPLAT_WORDS.length)]);
    this.provoke(npc, f.hostile ? 0 : 10);
    // un colpo in testa scompone chi sta prendendo la mira (il Pastellone no: è troppo grosso)
    if (r && headshot && f.state === 'aim' && !r.sharpenEvery) {
      f.state = 'stagger';
      f.t = 0.4;
    }
    this.damage(npc, d, 0.08);
  }

  // Esplosione (barile d'inchiostro): niente armature, niente parate
  blast(npc: NPC, dmg: number) {
    const f = npc.fighter!;
    if (f.ko) return;
    this.provoke(npc);
    if (f.state === 'aim') {
      f.state = 'stagger';
      f.t = 0.6;
    }
    this.damage(npc, dmg, 0.5);
  }

  private damage(npc: NPC, dmg: number, push = 0.15) {
    const f = npc.fighter!;
    const g = this.g;
    f.hp -= dmg;
    _v.subVectors(npc.pos, g.player.pos).setY(0).normalize();
    npc.pos.addScaledVector(_v, push);
    g.world.colliders.resolve(npc.pos, 0.3);
    if (npc.body instanceof Stickman) npc.body.punchReaction();
    if (f.hp <= 0) {
      this.knockOut(npc);
      return;
    }
    const lines = f.opts.hurtLines ?? ['Ahia!', 'Ugh!', 'Questa me la paghi!', 'Ehi!'];
    if (Math.random() < 0.4) npc.say(lines[Math.floor(Math.random() * lines.length)], 1.8);
  }

  knockOut(npc: NPC) {
    const f = npc.fighter!;
    const g = this.g;
    f.hp = 0;
    f.state = 'ko';
    f.hostile = false;
    npc.controlled = true;
    npc.ctrlSpeed = 0;
    g.guns.aim(npc, 0);
    if (npc.body instanceof Stickman) {
      npc.body.ko = true;
      npc.body.action = 'none';
    }
    if (f.opts.koLine) npc.say(f.opts.koLine, 3);
    else npc.say(['Zzz...', 'Ho visto le stelline disegnate...', 'Mamma...', 'Ok. Ok. Hai vinto.'][Math.floor(Math.random() * 4)], 3);
    g.audio.ko();
    g.addXp(15);
    g.onKo(npc);
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
    const aimers = { count: list.filter((n) => n.fighter!.state === 'aim').length };
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
      if (f.ranged) {
        this.updateRanged(n, f, dt, d, aimers);
        continue;
      }
      const body = n.body instanceof Stickman ? n.body : null;
      let speed = 0;
      switch (f.state) {
        case 'idle':
        case 'chase': {
          if (body) body.action = 'guard';
          const tgt = this.chaseTarget(n);
          this.face(n, tgt.x, tgt.z, dt, 8);
          if (d > f.reach * 0.85 || tgt !== p) {
            let tx = tgt.x - n.pos.x, tz = tgt.z - n.pos.z;
            const td = Math.hypot(tx, tz) || 1;
            tx /= td;
            tz /= td;
            if (f.opts.zigzag && d > 3.5) {
              // zig-zag: un po' a destra, un po' a sinistra
              const w = Math.sin(g.time * 4.5 + f.strafe * 2) * 0.9;
              const zx = tx - tz * w, zz = tz + tx * w;
              const zl = Math.hypot(zx, zz) || 1;
              tx = zx / zl;
              tz = zz / zl;
            }
            speed = this.move(n, tx, tz, f.speed, dt);
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

  private updateRanged(n: NPC, f: Fighter, dt: number, d: number, aimers: { count: number }) {
    const g = this.g;
    const p = g.player.pos;
    const r = f.ranged!;
    const body = n.body instanceof Stickman ? n.body : null;
    const col = g.world.colliders;
    // ti vede? (solo i muri veri contano: da dietro una cassa si spara lo stesso, anche se ci si prende)
    const clear = () => !col.blocked(n.pos.x, n.pos.z, p.x, p.z, false, 0.2);
    const hideTime = () => rand(...(r.hide ?? [1.2, 2.4]));
    let speed = 0;
    switch (f.state) {
      case 'move': {
        if (body) body.action = 'none';
        const tgt = f.cover ?? this.chaseTarget(n);
        const tx = tgt.x - n.pos.x, tz = tgt.z - n.pos.z;
        const td = Math.hypot(tx, tz);
        if (f.cover && td < 0.3) {
          f.state = 'hide';
          f.t = hideTime() * 0.6;
          break;
        }
        // senza copertura: cammina finché non ti vede
        if (!f.cover && clear() && d < 24) {
          f.state = 'hide';
          f.t = 0.3;
          break;
        }
        this.face(n, tgt.x, tgt.z, dt, 8);
        speed = this.move(n, tx / (td || 1), tz / (td || 1), f.speed, dt);
        break;
      }
      case 'hide': {
        if (body) body.action = f.cover ? 'cover' : 'guard';
        this.face(n, p.x, p.z, dt, 4);
        // allo scoperto, avanza verso di te (il Pastellone fa così)
        if (!f.cover && d > 9) speed = this.move(n, (p.x - n.pos.x) / d, (p.z - n.pos.z) / d, f.speed * 0.8, dt);
        // sei riparato rispetto a lui? Allora prima o poi cambia posto per prenderti di fianco
        if (f.cover && this.playerCovered(f.cover)) f.pinnedT += dt;
        else f.pinnedT = Math.max(0, f.pinnedT - dt);
        f.t -= dt;
        if (f.t > 0) break;
        const exposed = f.cover && !this.protects(f.cover);
        const relocate = !clear() || exposed || (f.pinnedT > 2.5 && Math.random() < 0.7) || (!r.sharpenEvery && Math.random() < 0.18);
        if (relocate && !r.sharpenEvery) {
          const c = this.pickCover(n, f.pinnedT > 2.5);
          if (c || !clear()) {
            f.cover = c;
            f.pinnedT = 0;
            f.state = 'move';
            if (c && Math.random() < 0.3) n.say(['Cambio posto!', 'Copritemi!', 'Lo prendo di lato!', 'Mi sposto!'][Math.floor(Math.random() * 4)], 1.5);
            break;
          }
        } else if (!clear()) {
          f.cover = null;
          f.state = 'move';
          break;
        }
        if (aimers.count < this.maxAimers && g.mode === 'play') {
          f.state = 'aim';
          f.t = r.aim * rand(0.9, 1.15);
          f.burstLeft = r.burst ?? 1;
          aimers.count++;
        } else f.t = rand(0.3, 0.8);
        break;
      }
      case 'aim':
        if (body) body.action = 'aim';
        this.face(n, p.x, p.z, dt, 10);
        f.t -= dt;
        g.guns.aim(n, Math.min(1, 1 - f.t / r.aim), r.color);
        if (f.t <= 0) {
          g.guns.enemyShoot(n, r.accuracy, r.dmg, r.color);
          f.shots++;
          f.burstLeft--;
          if (r.sharpenEvery && f.shots % r.sharpenEvery === 0) {
            // spuntato: deve temperarsi, ed è scoperto
            f.state = 'sharpen';
            f.t = 3.2;
            g.hud.popWord(n.pos.clone().setY(n.topY + 0.3), g.player.camera, 'SPUNTATO!');
            g.audio.sharpen(n.pos);
            g.audio.opening();
          } else if (f.burstLeft > 0) f.t = 0.2;
          else {
            f.state = 'hide';
            f.t = hideTime();
          }
        }
        break;
      case 'sharpen':
        if (body) body.action = 'sharpen';
        f.t -= dt;
        if (f.t <= 0) {
          f.state = 'hide';
          f.t = 0.6;
          n.say(['Appuntito!', 'Di nuovo a punta!', 'Ora sì che si ragiona.'][Math.floor(Math.random() * 3)], 2);
        }
        break;
      case 'stagger':
        if (body) body.action = 'none';
        f.t -= dt;
        if (f.t <= 0) {
          f.state = 'hide';
          f.t = rand(0.5, 1.0);
        }
        break;
      default:
        f.state = 'hide';
        f.t = 0.5;
    }
    if (f.state !== 'aim') g.guns.aim(n, 0);
    n.ctrlSpeed = speed;
  }

  // --- coperture ---------------------------------------------------------------

  // Punti di copertura attorno agli ostacoli bassi (casse, banconi) dentro una zona
  buildCovers(inside: (x: number, z: number) => boolean) {
    const col = this.g.world.colliders;
    const out: THREE.Vector3[] = [];
    const free = (x: number, z: number) =>
      !col.rects.some((r) => x > r.x0 - 0.4 && x < r.x1 + 0.4 && z > r.z0 - 0.4 && z < r.z1 + 0.4) &&
      !col.circles.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.4);
    for (const r of col.rects) {
      if (!r.low || !r.h || r.h < 0.8) continue;
      const w = r.x1 - r.x0, dz = r.z1 - r.z0;
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const along = (len: number) => (len > 1.5 ? [-(len / 2 - 0.45), len / 2 - 0.45] : [0]);
      const pts: [number, number][] = [];
      for (const o of along(dz)) pts.push([r.x0 - 0.6, cz + o], [r.x1 + 0.6, cz + o]);
      for (const o of along(w)) pts.push([cx + o, r.z0 - 0.6], [cx + o, r.z1 + 0.6]);
      for (const [x, z] of pts) if (inside(x, z) && free(x, z)) out.push(new THREE.Vector3(x, 0, z));
    }
    return out;
  }

  // accovacciato lì, l'ostacolo accanto lo nasconde a te?
  private protects(c: THREE.Vector3) {
    const p = this.g.player.pos;
    const d = Math.hypot(p.x - c.x, p.z - c.z) || 1;
    const k = Math.min(1.6, d * 0.5) / d;
    return this.g.world.colliders.blocked(c.x, c.z, c.x + (p.x - c.x) * k, c.z + (p.z - c.z) * k, true, 0.2);
  }

  // da lì, tu sei riparato dietro qualcosa di basso (se ti abbassi)?
  private playerCovered(c: THREE.Vector3) {
    const p = this.g.player.pos;
    const d = Math.hypot(p.x - c.x, p.z - c.z) || 1;
    const k = Math.min(1.8, d * 0.5) / d;
    return this.g.player.crouching && this.g.world.colliders.blocked(p.x, p.z, p.x + (c.x - p.x) * k, p.z + (c.z - p.z) * k, true, 0.2);
  }

  // Sceglie una nuova copertura: riparata, da cui ti si vede stando in piedi, raggiungibile in linea retta.
  // flank: preferisce i punti da cui tu NON sei riparato (ti prende di fianco)
  private pickCover(n: NPC, flank: boolean) {
    const g = this.g;
    const p = g.player.pos;
    const col = g.world.colliders;
    let best: THREE.Vector3 | null = null;
    let bestScore = Infinity;
    for (const c of this.covers) {
      const dp = Math.hypot(c.x - p.x, c.z - p.z);
      if (dp < 6 || dp > 22) continue;
      const travel = Math.hypot(c.x - n.pos.x, c.z - n.pos.z);
      if (travel < 1.5 || travel > 15) continue;
      if (this.fighters.some((o) => o !== n && !o.fighter!.ko && o.fighter!.cover && o.fighter!.cover.distanceTo(c) < 1.3)) continue;
      if (g.npcs.some((o) => !o.fighter && !o.hidden && o.pos.distanceTo(c) < 1.1)) continue;
      if (!this.protects(c)) continue;
      if (col.blocked(c.x, c.z, p.x, p.z, false, 0.2)) continue;
      if (col.blocked(n.pos.x, n.pos.z, c.x, c.z, false, 0.2)) continue;
      let score = travel * 0.45 + Math.abs(dp - 12) * 0.35 + Math.random() * 4;
      const covered = g.world.colliders.blocked(p.x, p.z, p.x + (c.x - p.x) * (1.8 / dp), p.z + (c.z - p.z) * (1.8 / dp), true, 0.2);
      if (flank && !covered) score -= 8;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
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
    // colonne e casse non contano (ci si gira intorno strisciando): solo i muri veri
    if (!col.blocked(n.pos.x, n.pos.z, p.x, p.z, false, 1.5)) return p;
    let best: THREE.Vector3 | null = null;
    let bestCost = Infinity;
    for (const w of this.nav) {
      if (Math.hypot(w.x - n.pos.x, w.z - n.pos.z) < 0.6) continue;
      if (col.blocked(n.pos.x, n.pos.z, w.x, w.z, false, 1.5)) continue;
      const cost = n.pos.distanceTo(w) + w.distanceTo(p) + (col.blocked(w.x, w.z, p.x, p.z, false, 1.5) ? 12 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = w;
      }
    }
    return best ?? p;
  }
}
