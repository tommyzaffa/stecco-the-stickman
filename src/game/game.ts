import * as THREE from 'three';
import { PAPER } from '../render/palette';
import { PaperPost } from '../render/postfx';
import { setLineResolution } from '../render/sketch';
import { coinTexture } from '../render/textures';
import { Input } from '../input';
import { Player } from '../player';
import { Hud, type IconKind, type MarkerKind } from '../ui/hud';
import { buildTown, type Town } from '../world/town';
import { NPC, type Behavior } from '../entities/npc';
import { Stickman, StickDog, type Action, type StickmanOpts } from '../entities/stickman';
import { DialogueRunner, type Dialogue } from './dialogue';
import { ITEMS, type ItemId } from '../content/items';
import { QUESTS } from '../content/quests';
import { VOICES } from '../content/voices';
import { Sound } from '../audio/audio';

export interface Interactable {
  pos: THREE.Vector3;
  radius?: number;
  label: (g: Game) => string | null;
  use: (g: Game) => void;
}

export interface NpcSpec {
  id: string;
  name: string;
  pos: [number, number];
  face?: [number, number]; // punto verso cui guardare all'inizio
  look?: StickmanOpts;
  dog?: boolean;
  behavior?: Behavior;
  action?: Action;
  faceWhenNear?: boolean;
  barks?: (g: Game) => string[];
  dialogue?: Dialogue;
  talkLabel?: string;
  icon?: (g: Game) => IconKind | null;
  onPunch?: (g: Game, npc: NPC) => void;
  punchLines?: string[];
}

interface Pickup {
  sprite: THREE.Sprite;
  value: number;
  taken: boolean;
  msg?: string;
}

const GENERIC_PUNCH = [
  'Ahia!',
  'Ma sei scemo?',
  'Lo dico a mia madre!',
  'Perché?!',
  'Non ho le costole, ma mi hai fatto male lo stesso.',
  'Ehi! Sono fatto di linee, non di gomma!',
  'Violenza gratuita. Tipico dei videogiochi.',
];

const LEVEL_LINES = [
  '',
  '',
  'Sei leggermente più bravo a esistere.',
  'Ora cammini con più convinzione.',
  'Il tuo tratto è più deciso. Si nota.',
  'Sei praticamente un omino a tre dimensioni e mezzo.',
];

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  post: PaperPost;
  input: Input;
  hud = new Hud();
  audio = new Sound();
  player: Player;
  town: Town;
  dialogue: DialogueRunner;

  npcs: NPC[] = [];
  specs = new Map<string, NpcSpec>();
  interactables: Interactable[] = [];
  pickups: Pickup[] = [];
  private timers: { t: number; fn: () => void }[] = [];
  private focus: Interactable | null = null;

  state = {
    hp: 60,
    maxHp: 100,
    xp: 0,
    level: 1,
    coins: 0,
    items: [] as ItemId[],
    flags: new Set<string>(),
    quests: {} as Record<string, number>,
  };

  mode: 'title' | 'play' | 'end' = 'title';

  // Gioco in corso (non su titolo, pausa o schermata finale): decide quanti fps servono.
  get active() {
    return this.mode === 'play' && this.input.locked && !this.hud.screenVisible;
  }
  time = 0;
  playTime = 0;
  private damageFx = 0;
  private fainting = false;
  private coinMat: THREE.SpriteMaterial;
  onUpdate: ((g: Game, dt: number) => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = PAPER.clone();
    this.scene.fog = new THREE.Fog(PAPER.clone(), 30, 115);

    this.input = new Input(canvas);
    this.player = new Player(window.innerWidth / window.innerHeight);
    this.scene.add(this.player.camera);
    this.town = buildTown();
    this.scene.add(this.town.group);
    this.post = new PaperPost(this.renderer, this.scene, this.player.camera);
    this.dialogue = new DialogueRunner(this);

    const cm = new THREE.SpriteMaterial({ map: coinTexture(), alphaTest: 0.5 });
    cm.alphaToCoverage = true;
    this.coinMat = cm;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // Su schermi Retina disegnare a risoluzione piena costa 4 volte tanto e con il tratto a matita
  // non si nota: limitiamo i pixel disegnati per frame (~2.4 milioni, circa un 1080p).
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const MAX_PIXELS = 2.4e6;
    const pr = Math.max(1, Math.min(window.devicePixelRatio, Math.sqrt(MAX_PIXELS / (w * h))));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, pr);
    this.player.camera.aspect = w / h;
    this.player.camera.updateProjectionMatrix();
    setLineResolution(w, h);
  }

  // =========================================================================
  // API per i contenuti (dialoghi, missioni, oggetti)
  // =========================================================================
  addNpc(spec: NpcSpec) {
    const body = spec.dog ? new StickDog() : new Stickman(spec.look);
    body.root.position.set(spec.pos[0], 0, spec.pos[1]);
    const rot = spec.face ? Math.atan2(spec.face[0] - spec.pos[0], spec.face[1] - spec.pos[1]) : 0;
    const npc = new NPC(spec.id, spec.name, body, spec.behavior ?? { type: 'stand' }, spec.action ?? 'none', rot, spec.faceWhenNear ?? true);
    this.scene.add(body.root);
    this.npcs.push(npc);
    this.specs.set(spec.id, spec);
    npc.onSay = (text) => (npc.isDog ? this.audio.bark(npc.pos) : this.audio.mumble(VOICES[npc.id], text, npc.pos));
    if (spec.dialogue) {
      const d = spec.dialogue;
      this.interactables.push({
        pos: npc.pos,
        radius: 2.4,
        label: () => (npc.hidden ? null : spec.talkLabel ?? `Parla con ${spec.name}`),
        use: (g) => g.talk(d, npc),
      });
    }
    return npc;
  }

  npc(id: string) {
    const n = this.npcs.find((n) => n.id === id);
    if (!n) throw new Error(`NPC sconosciuto: ${id}`);
    return n;
  }

  addInteractable(i: Interactable) {
    this.interactables.push(i);
  }

  addCoin(x: number, z: number, msg?: string, y = 0.9) {
    const s = new THREE.Sprite(this.coinMat);
    s.scale.setScalar(0.5);
    s.position.set(x, y, z);
    this.scene.add(s);
    this.pickups.push({ sprite: s, value: 5, taken: false, msg });
  }

  talk(d: Dialogue, npc: NPC | null = null, onEnd?: () => void) {
    this.dialogue.start(d, npc, onEnd);
  }

  after(sec: number, fn: () => void) {
    this.timers.push({ t: this.time + sec, fn });
  }

  toast(text: string, kind: Parameters<Hud['toast']>[1] = 'info', ms?: number) {
    this.hud.toast(text, kind, ms);
  }

  phone(from: string, text: string) {
    this.hud.toast(`<span class="ph">✉</span> <b>${from}</b>: ${text}`, 'phone', 7000);
    this.audio.phone();
  }

  flag(f: string) {
    this.state.flags.add(f);
  }

  is(f: string) {
    return this.state.flags.has(f);
  }

  addCoins(n: number, silent = false) {
    this.state.coins = Math.max(0, this.state.coins + n);
    if (!silent) this.toast(n >= 0 ? `+${n} monete` : `${n} monete`, n >= 0 ? 'reward' : 'bad', 2200);
    if (n > 0) this.audio.coin();
    else if (n < 0) this.audio.pay();
  }

  addXp(n: number) {
    const s = this.state;
    s.xp += n;
    this.toast(`+${n} XP`, 'reward', 2200);
    while (s.xp >= this.xpNext) {
      s.xp -= this.xpNext;
      s.level++;
      s.maxHp += 10;
      s.hp = s.maxHp;
      const line = LEVEL_LINES[Math.min(s.level, LEVEL_LINES.length - 1)] || 'Continui a migliorare. Più o meno.';
      this.toast(`<b>LIVELLO ${s.level}!</b><br>${line}<br><small>Salute massima +10, salute ripristinata</small>`, 'level', 5000);
      this.audio.levelUp();
    }
  }

  get xpNext() {
    return 100 * this.state.level;
  }

  heal(n: number) {
    const s = this.state;
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + n);
    this.toast(`+${Math.round(s.hp - before)} salute`, 'reward', 2200);
    this.audio.heal();
  }

  hurt(n: number) {
    this.state.hp = Math.max(0, this.state.hp - n);
    this.damageFx = 1;
    this.audio.hurt();
    if (this.state.hp <= 0) this.faint();
  }

  give(id: ItemId) {
    if (!this.state.items.includes(id)) this.state.items.push(id);
    const it = ITEMS[id];
    this.toast(`Nuovo oggetto: <b>${it.name}</b>${it.weapon ? '<br><small>premi 2 per equipaggiarlo</small>' : ''}`, 'reward', 4200);
    this.audio.item();
  }

  take(id: ItemId) {
    this.state.items = this.state.items.filter((i) => i !== id);
  }

  has(id: ItemId) {
    return this.state.items.includes(id);
  }

  // stato missione: -1 non iniziata, 0..n-1 passo attivo, >= n completata
  quest(id: string) {
    return this.state.quests[id] ?? -1;
  }

  questDone(id: string) {
    return this.quest(id) >= QUESTS[id].steps.length;
  }

  questActive(id: string) {
    const q = this.quest(id);
    return q >= 0 && q < QUESTS[id].steps.length;
  }

  startQuest(id: string) {
    this.state.quests[id] = 0;
    const q = QUESTS[id];
    if (!q.main) {
      this.toast(`Nuova missione: <b>${q.title}</b>`, 'quest');
      this.audio.objective();
    }
  }

  setStep(id: string, step: number, quiet = false) {
    this.state.quests[id] = step;
    const q = QUESTS[id];
    if (step >= q.steps.length) {
      if (!q.main) {
        this.toast(`Missione completata: <b>${q.title}</b>`, 'quest', 4500);
        this.audio.questDone();
      }
    } else if (!quiet) {
      const s = q.steps[step];
      this.toast(`Obiettivo: ${typeof s.text === 'string' ? s.text : s.text(this)}`, q.main ? 'quest' : 'info');
      this.audio.objective();
    }
  }

  completeQuest(id: string) {
    this.setStep(id, QUESTS[id].steps.length);
  }

  chapter(title: string, sub: string) {
    this.hud.chapter(title, sub);
    this.audio.chapter();
  }

  fade(black: boolean) {
    this.hud.fadeEl.classList.toggle('on', black);
  }

  private faint() {
    if (this.fainting) return;
    this.fainting = true;
    if (this.dialogue.isOpen) this.dialogue.close();
    this.fade(true);
    this.toast('Sei svenuto.', 'bad', 2500);
    this.audio.faint();
    this.after(1.8, () => {
      const sp = this.town.anchors.spawn;
      this.player.pos.set(sp.x, 0, sp.z);
      this.player.setLook(this.town.anchors.alarm);
      this.state.hp = Math.round(this.state.maxHp / 2);
      const lost = Math.min(5, this.state.coins);
      this.state.coins -= lost;
      this.fade(false);
      this.fainting = false;
      this.toast(
        `Ti risvegli a casa. Qualcuno ti ha riportato qui${lost ? ` e si è preso ${lost} monete per il disturbo` : ''}.`,
        'bad',
        5000,
      );
    });
  }

  // =========================================================================
  // Ciclo di gioco
  // =========================================================================
  update(dt: number) {
    this.time += dt;
    const inp = this.input;
    const playing = this.mode !== 'title' && inp.locked && !this.fainting;
    for (const t of this.timers.filter((t) => t.t <= this.time)) {
      this.timers.splice(this.timers.indexOf(t), 1);
      t.fn();
    }

    let canMove = playing;
    if (playing) {
      this.playTime += dt;
      if (this.dialogue.isOpen) {
        canMove = false;
        this.dialogue.update(dt);
        if (inp.pressed.has('KeyE') || inp.pressed.has('Space') || inp.pressed.has('Enter') || inp.clicked) this.dialogue.advance();
        for (let i = 0; i < 4; i++) if (inp.pressed.has(`Digit${i + 1}`)) this.dialogue.choose(i);
        if (inp.pressed.has('KeyW') || inp.pressed.has('ArrowUp')) this.dialogue.moveSel(-1);
        if (inp.pressed.has('KeyS') || inp.pressed.has('ArrowDown')) this.dialogue.moveSel(1);
        const n = this.dialogue.npc;
        if (n) this.player.easeLook(new THREE.Vector3(n.pos.x, n.headY - 0.15, n.pos.z), dt);
      } else if (this.hud.diarioOpen) {
        canMove = false;
        if (inp.pressed.has('KeyQ') || inp.pressed.has('Tab') || inp.pressed.has('KeyE')) this.hud.showDiario(null);
      } else {
        if (inp.pressed.has('KeyE') && this.focus) this.focus.use(this);
        if (inp.pressed.has('KeyQ') || inp.pressed.has('Tab')) this.hud.showDiario(this.diarioHtml());
        if (inp.clicked && this.player.attack()) this.audio.swing(this.player.weapon);
        if (inp.pressed.has('KeyM')) this.toast(this.audio.toggleMusic() ? 'Musica: accesa' : 'Musica: spenta', 'info', 1800);
        if (inp.pressed.has('Digit1')) this.player.setWeapon('fist');
        if (inp.pressed.has('Digit2') && this.has('righello')) this.player.setWeapon('ruler');
      }
    }

    const ev = this.player.update(dt, inp, this.town.colliders, canMove && !this.hud.diarioOpen);
    if (ev.hit) this.resolveHit();
    const indoor = this.town.isInsideHouse(this.player.pos);
    if (ev.stepped) this.audio.footstep(ev.running, indoor);
    if (ev.jumped) this.audio.jump();
    if (ev.landed) this.audio.land();
    this.audio.update(dt, {
      pos: this.player.pos,
      yaw: this.player.yaw,
      indoor,
      alarmOn: this.quest('main') === 0 && this.mode === 'play',
      alarmPos: this.town.anchors.alarm,
      fountainPos: this.town.anchors.fountain,
      time: this.time,
    });

    // NPC
    const pp = this.player.pos;
    for (const n of this.npcs) {
      if (n.hidden) continue;
      const d = n.update(dt, pp);
      // il giocatore non passa attraverso le persone
      const min = this.player.radius + (n.isDog ? 0.25 : 0.3);
      if (d < min && d > 1e-4) {
        const dx = pp.x - n.pos.x, dz = pp.z - n.pos.z;
        pp.x = n.pos.x + (dx / d) * min;
        pp.z = n.pos.z + (dz / d) * min;
      }
      // battute spontanee
      if (playing && !n.talking && d < 8) {
        n.nextBark -= dt;
        if (n.nextBark <= 0) {
          const barks = this.specs.get(n.id)?.barks?.(this) ?? [];
          if (barks.length && !n.bubble) n.say(barks[Math.floor(Math.random() * barks.length)], 4);
          n.nextBark = 7 + Math.random() * 9;
        }
      }
    }

    // monete per terra
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.sprite.position.y += Math.sin(this.time * 3 + p.sprite.position.x) * 0.002;
      p.sprite.scale.x = 0.5 * Math.max(0.12, Math.abs(Math.cos(this.time * 2.5 + p.sprite.position.z)));
      const d = Math.hypot(pp.x - p.sprite.position.x, pp.z - p.sprite.position.z);
      if (d < 1.1 && playing) {
        p.taken = true;
        this.scene.remove(p.sprite);
        this.addCoins(p.value);
        if (p.msg) this.toast(p.msg, 'info', 4500);
      }
    }

    for (const f of this.onUpdate) f(this, dt);

    this.damageFx = Math.max(0, this.damageFx - dt * 1.5);
    this.updateFocus(playing && !this.dialogue.isOpen && !this.hud.diarioOpen);
    this.updateHud();
    this.post.render(this.time, this.damageFx);
    inp.endFrame();
  }

  private resolveHit() {
    const reach = this.player.weapon === 'ruler' ? 2.4 : 1.8;
    const e = this.player.eye;
    const f = this.player.forward.setY(0).normalize();
    let best: NPC | null = null;
    let bestD = Infinity;
    for (const n of this.npcs) {
      if (n.hidden) continue;
      const dx = n.pos.x - e.x, dz = n.pos.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + 0.3) continue;
      const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (dot < 0.75) continue;
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    if (!best) return;
    const spec = this.specs.get(best.id);
    if (best.body instanceof Stickman) best.body.punchReaction();
    this.audio.hit(this.player.weapon);
    if (spec?.onPunch) spec.onPunch(this, best);
    else {
      const lines = spec?.punchLines ?? GENERIC_PUNCH;
      best.say(lines[Math.floor(Math.random() * lines.length)], 2.5);
    }
    this.flag(`punched_${best.id}`);
  }

  private updateFocus(active: boolean) {
    this.focus = null;
    if (!active) {
      this.hud.prompt(null);
      return;
    }
    const e = this.player.eye;
    const f = this.player.forward;
    let best: Interactable | null = null;
    let bestScore = Infinity;
    const tmp = new THREE.Vector3();
    for (const it of this.interactables) {
      const label = it.label(this);
      if (!label) continue;
      const r = it.radius ?? 2.2;
      const hd = Math.hypot(it.pos.x - e.x, it.pos.z - e.z);
      if (hd > r) continue;
      tmp.copy(it.pos);
      if (tmp.y < 0.3) tmp.y = 1.2; // gli NPC hanno pos a terra: mira al busto
      tmp.sub(e);
      const ang = tmp.angleTo(f);
      const flat = Math.acos(Math.max(-1, Math.min(1, (tmp.x * f.x + tmp.z * f.z) / (Math.hypot(tmp.x, tmp.z) * Math.hypot(f.x, f.z) || 1))));
      if (Math.min(ang, flat + 0.15) > 0.6 && hd > 0.9) continue;
      const score = ang + hd * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    this.focus = best;
    this.hud.prompt(best ? best.label(this) : null);
  }

  private updateHud() {
    const s = this.state;
    this.hud.setStats({
      hp: s.hp,
      maxHp: s.maxHp,
      coins: s.coins,
      level: s.level,
      xp: s.xp,
      xpNext: this.xpNext,
      weapon: this.player.weapon === 'ruler' ? 'Righello (30 cm)' : 'Pugni stilizzati',
    });

    const objs: { text: string; kind: MarkerKind; title?: string }[] = [];
    const cam = this.player.camera;
    cam.updateMatrixWorld();
    this.hud.beginWorld();
    const pp = this.player.pos;
    for (const [id, q] of Object.entries(QUESTS)) {
      if (!this.questActive(id)) continue;
      const step = q.steps[this.quest(id)];
      const text = typeof step.text === 'string' ? step.text : step.text(this);
      objs.push({ text, kind: q.main ? 'main' : 'side', title: q.main ? q.title : undefined });
      const t = step.target?.(this);
      if (t && this.mode !== 'title' && !this.dialogue.isOpen) this.hud.worldMarker(t, cam, q.main ? 'main' : 'side', Math.hypot(t.x - pp.x, t.z - pp.z));
    }
    objs.sort((a, b) => (a.kind === 'main' ? -1 : b.kind === 'main' ? 1 : 0));
    this.hud.setObjectives(objs);

    if (this.mode !== 'title') {
      const tmp = new THREE.Vector3();
      for (const n of this.npcs) {
        if (n.hidden) continue;
        const d = Math.hypot(n.pos.x - pp.x, n.pos.z - pp.z);
        const icon = this.specs.get(n.id)?.icon?.(this);
        const talking = this.dialogue.npc === n;
        if (icon && !talking) this.hud.npcIcon(tmp.set(n.pos.x, n.headY + 0.45, n.pos.z), cam, icon);
        if (n.bubble && !talking) this.hud.bubble(tmp.set(n.pos.x, n.headY + (icon ? 0.85 : 0.3), n.pos.z), cam, n.bubble);
        if (d < 7 && !this.dialogue.isOpen) this.hud.nameTag(tmp.set(n.pos.x, n.headY + 0.12, n.pos.z), cam, n.name);
      }
      if (this.quest('main') === 0) {
        this.hud.bubble(tmp.copy(this.town.anchors.alarm).setY(1.2), cam, 'DRIIIN! DRIIIN!');
      }
    }
    this.hud.endWorld();
  }

  private diarioHtml() {
    const s = this.state;
    const qs = Object.entries(QUESTS)
      .filter(([id]) => this.quest(id) >= 0)
      .map(([id, q]) => {
        const done = this.questDone(id);
        const step = done ? '' : q.steps[this.quest(id)];
        const st = typeof step === 'string' ? step : typeof step.text === 'string' ? step.text : step.text(this);
        return `<li class="${done ? 'done' : ''} ${q.main ? 'main' : ''}"><b>${q.title}</b>${done ? ' ✓' : `<br><small>${st}</small>`}</li>`;
      })
      .join('');
    const items = s.items.length
      ? s.items.map((i) => `<li><b>${ITEMS[i].name}</b>${ITEMS[i].weapon ? ' <small>(arma)</small>' : ''}<br><small>${ITEMS[i].desc}</small></li>`).join('')
      : '<li><small>Niente. Neanche le tasche.</small></li>';
    return `<h2>Diario</h2>
      <div class="cols">
        <div><h3>Missioni</h3><ul>${qs || '<li><small>Nessuna. Per ora.</small></li>'}</ul></div>
        <div><h3>Inventario</h3><ul>${items}</ul>
        <h3>Tu</h3><ul><li>Livello ${s.level} · ${s.xp}/${this.xpNext} XP</li><li>Salute ${Math.round(s.hp)}/${s.maxHp}</li><li>${s.coins} monete</li></ul></div>
      </div>
      <div class="hint">Q per chiudere</div>`;
  }
}
