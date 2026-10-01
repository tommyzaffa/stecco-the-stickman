import * as THREE from 'three';
import { PAPER, setTheme } from '../render/palette';
import { PaperPost } from '../render/postfx';
import { setLineResolution } from '../render/sketch';
import { coinTexture, pickupTexture } from '../render/textures';
import { Input } from '../input';
import { Player } from '../player';
import { Hud, type IconKind, type MarkerKind } from '../ui/hud';
import type { World } from '../world/builder';
import { NPC, type Behavior } from '../entities/npc';
import { Stickman, StickDog, type Action, type StickmanOpts } from '../entities/stickman';
import { DialogueRunner, type Dialogue, type ParsedLine } from './dialogue';
import type { QuestDef } from './quests';
import { Combat, type FighterOpts } from './combat';
import { Guns, CLIP_SIZE, PISTOL_DMG } from './guns';
import { ITEMS, type ItemId } from '../content/items';
import { VOICES } from '../content/voices';
import { Sound } from '../audio/audio';
import type { Chapter } from '../chapters/types';
import { SETTINGS, keyName, qualityParams } from '../settings';
import { TOUCH } from '../touch';
import { VIEW, updateView } from '../view';
import { TouchUI } from '../ui/touch';
import { resetBooth } from './booth';

export interface Interactable {
  pos: THREE.Vector3;
  radius?: number;
  label: (g: Game) => string | null;
  use: (g: Game) => void;
  icon?: (g: Game) => IconKind | null; // icona sopra l'oggetto (es. indizio da esaminare)
}

export interface ClueDef {
  name: string;
  desc: string;
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
  noTurn?: boolean; // non si gira verso chi gli parla
  barks?: (g: Game) => string[];
  dialogue?: Dialogue;
  talkLabel?: string;
  talkRadius?: number; // distanza da cui si può parlare (es. chi sta su un balcone)
  icon?: (g: Game) => IconKind | null;
  onPunch?: (g: Game, npc: NPC) => void;
  punchLines?: string[];
  fighter?: FighterOpts; // se presente, il PNG può combattere
  hidden?: boolean;
  onShot?: (g: Game, npc: NPC) => void; // colpito dalla pistola (chi non combatte)
  shotLines?: string[];
}

type PickupKind = 'coin' | 'ammo' | 'heal';
interface Pickup {
  sprite: THREE.Sprite;
  kind: PickupKind;
  value: number;
  taken: boolean;
  msg?: string;
}

export interface GameState {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  coins: number;
  clip: number; // colpi nel caricatore
  ammo: number; // colpi di riserva
  items: ItemId[];
  flags: Set<string>;
  quests: Record<string, number>;
}

export const QUEST_DONE = 999;

// Lo stato come si salva (i flag diventano un elenco)
export type RawState = Omit<GameState, 'flags'> & { flags: string[] };
export const serializeState = (s: GameState): RawState => ({ ...s, items: [...s.items], quests: { ...s.quests }, flags: [...s.flags] });
export const deserializeState = (raw: Partial<RawState>): GameState => ({ ...freshState(), ...raw, flags: new Set(raw.flags ?? []) });

const freshState = (): GameState => ({
  hp: 60,
  maxHp: 100,
  xp: 0,
  level: 1,
  coins: 0,
  clip: 0,
  ammo: 0,
  items: [],
  flags: new Set(),
  quests: {},
});

const GENERIC_PUNCH = [
  'Ahia!',
  'Ma sei scemo?',
  'Lo dico a mia madre!',
  'Perché?!',
  'Non ho le costole, ma mi hai fatto male lo stesso.',
  'Ehi! Sono fatto di linee, non di gomma!',
  'Violenza gratuita. Tipico dei videogiochi.',
];

const GENERIC_SHOT = [
  'Mi hai macchiato!',
  'Ehi! Questa camicia era bianca! Come tutto il resto!',
  'Inchiostro?! Ora sembro una firma!',
  'Ahia! Ma sei matto?',
  'Blu?! Io sono in bianco e nero, mi hai rovinato!',
];

const LEVEL_LINES = [
  '',
  '',
  'Sei leggermente più bravo a esistere.',
  'Ora cammini con più convinzione.',
  'Il tuo tratto è più deciso. Si nota.',
  'Sei praticamente un omino a tre dimensioni e mezzo.',
  'Le linee ti rispettano.',
  'Hai il tratto di un pennarello indelebile.',
];

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  post: PaperPost;
  input: Input;
  hud = new Hud();
  audio = new Sound();
  player: Player;
  world!: World;
  chapterDef!: Chapter;
  dialogue: DialogueRunner;
  combat: Combat;
  guns: Guns;

  npcs: NPC[] = [];
  specs = new Map<string, NpcSpec>();
  interactables: Interactable[] = [];
  pickups: Pickup[] = [];
  quests: Record<string, QuestDef> = {};
  clues: Record<string, ClueDef> = {}; // indizi del capitolo (capitolo 3: l'indagine)
  private timers: { t: number; fn: () => void }[] = [];
  private focus: Interactable | null = null;
  private bubblesThisFrame: { pos: THREE.Vector3; text: string }[] = [];
  private checkpoint = { pos: new THREE.Vector3(), look: new THREE.Vector3(), msg: '' };
  private trail: THREE.Vector3[] = []; // le tue tracce (per chi ti segue)

  state: GameState = freshState();

  mode: 'title' | 'play' | 'end' = 'title';
  time = 0;
  playTime = 0;
  chapterTime = 0;
  private damageFx = 0;
  private fainting = false;
  private coinMat: THREE.SpriteMaterial;
  private pickupMats: Partial<Record<PickupKind, THREE.SpriteMaterial>> = {};
  private fireCd = 0;
  private reloadId = 0;
  private lastNoAmmo = -10;
  onUpdate: ((g: Game, dt: number) => void)[] = [];
  // callback dei capitoli
  onKo: (npc: NPC) => void = () => {};
  onFaint: (() => void) | null = null;
  onChapterComplete: ((g: Game, next: number) => void) | null = null;
  onGameOver: ((title: string, text: string, retry: () => void) => void) | null = null;
  onLine: ((l: ParsedLine) => void) | null = null; // ogni nuova riga di dialogo (per effetti sonori a tempo)

  touch: TouchUI | null = null;
  // comandi a schermo speciali di un capitolo (capitolo 6: in macchina). null = quelli normali.
  // Per ogni pulsante: il testo da mostrare, oppure null per nasconderlo.
  touchMode: { fire?: string | null; use?: string | null; jump?: string | null; crouch?: string | null; parry?: string | null } | null = null;
  hideNameTags = false; // niente nomi sopra le teste (es. in macchina, con Marco seduto accanto)
  interactOff = false; // niente "parla con..." / "usa" (es. in macchina: il tasto serve ad altro)

  // c'è qualcosa con cui interagire davanti a te (per il pulsante USA)
  get hasFocus() {
    return this.focus !== null;
  }

  // Gioco in corso (non su titolo, pausa o schermata finale): decide quanti fps servono.
  get active() {
    return this.mode === 'play' && this.input.locked && !this.hud.screenVisible;
  }

  constructor(canvas: HTMLCanvasElement) {
    updateView();
    // niente 'high-performance': sui portatili con due schede grafiche accendeva quella potente
    // (calore e ventola). Il gioco gira bene anche su quella integrata.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
    this.renderer.setSize(VIEW.w, VIEW.h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(PAPER.clone(), 30, 115);

    this.input = new Input(canvas);
    this.player = new Player(VIEW.w / VIEW.h);
    this.scene.add(this.player.camera);
    // sul telefono niente antialiasing e meno pixel: il tratto a matita regge lo stesso
    this.post = new PaperPost(this.renderer, this.scene, this.player.camera, qualityParams(SETTINGS.quality, TOUCH).samples);
    this.dialogue = new DialogueRunner(this);
    this.combat = new Combat(this);
    this.guns = new Guns(this);
    if (TOUCH) this.touch = new TouchUI(this);

    const cm = new THREE.SpriteMaterial({ map: coinTexture(), alphaTest: 0.5 });
    cm.alphaToCoverage = true;
    this.coinMat = cm;

    window.addEventListener('resize', () => this.resize());
    // sui telefoni la misura giusta a volte arriva un attimo dopo la rotazione
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    this.resize();
  }

  // Su schermi Retina disegnare a risoluzione piena costa 4 volte tanto e con il tratto a matita
  // non si nota: limitiamo i pixel disegnati per frame (~2.4 milioni, circa un 1080p).
  resize() {
    updateView();
    const w = VIEW.w, h = VIEW.h;
    // quanti pixel disegnare dipende dalla qualità scelta (vedi settings.ts)
    const q = qualityParams(SETTINGS.quality, TOUCH);
    this.post.setSamples(q.samples);
    const MAX_PIXELS = q.pixels;
    const pr = Math.max(1, Math.min(window.devicePixelRatio, Math.sqrt(MAX_PIXELS / (w * h))));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, pr);
    this.player.camera.aspect = w / h;
    this.player.camera.updateProjectionMatrix();
    setLineResolution(w, h);
  }

  // =========================================================================
  // Capitoli e salvataggi
  // =========================================================================
  get chapterNum() {
    return this.chapterDef?.num ?? 1;
  }

  // Scarica il capitolo corrente e costruisce il nuovo. Lo stato del giocatore resta.
  loadChapter(ch: Chapter) {
    this.unloadChapter();
    this.chapterDef = ch;
    setTheme(ch.theme);
    this.world = ch.build();
    this.scene.add(this.world.group);
    this.scene.background = PAPER.clone();
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(PAPER);
    [fog.near, fog.far] = this.world.fog;
    this.player.applyTheme();
    // l'arma in mano deve essere una che si possiede (saltando tra i capitoli lo stato cambia)
    const w = this.player.weapon;
    if ((w === 'pistol' && !this.has('pistola')) || (w === 'ruler' && !this.has('righello'))) this.player.setWeapon('fist');
    this.quests = ch.quests;
    this.chapterTime = 0;
    const sp = this.world.anchors.spawn;
    this.player.pos.set(sp.x, 0, sp.z);
    this.trail = [];
    this.player.vy = 0;
    this.player.setLook(this.world.anchors.spawnLook ?? sp.clone().add(new THREE.Vector3(0, 1.6, 1)));
    this.setCheckpoint(sp, this.world.anchors.spawnLook ?? sp, 'Ti rialzi. Più o meno intero');
    ch.setup(this);
    this.save();
  }

  // Torna al menu: scarica il capitolo e non disegna più niente finché non se ne carica un altro
  closeChapter() {
    this.unloadChapter();
    (this as { world?: World }).world = undefined;
  }

  private unloadChapter() {
    if (!this.world) return;
    if (this.dialogue.isOpen) this.dialogue.close();
    for (const n of this.npcs) this.scene.remove(n.body.root);
    for (const p of this.pickups) this.scene.remove(p.sprite);
    this.guns.clear();
    this.guns.ceiling = Infinity;
    this.combat.maxAimers = 2;
    this.hud.ammo(null);
    this.hud.meter(null);
    this.scene.remove(this.world.group);
    this.world.dispose();
    this.npcs = [];
    this.specs.clear();
    this.interactables = [];
    this.pickups = [];
    this.onUpdate = [];
    this.timers = [];
    this.onKo = () => {};
    this.onFaint = null;
    this.onLine = null;
    this.clues = {};
    this.combat.restricted = () => false;
    this.combat.nav = [];
    this.audio.clearEmitters();
    this.audio.stopMusic();
    this.audio.setMusicMuffle(20000);
    this.player.setCrouch(false);
    this.player.seated = false;
    // i timer spariscono con il capitolo: niente schermo nero o svenimenti rimasti a metà
    this.fade(false);
    this.fainting = false;
    this.hud.showDiario(null);
    this.minigame = null;
    this.touchMode = null;
    this.hideNameTags = false;
    this.interactOff = false;
    this.player.floor = 0;
    this.player.pos.y = 0;
    this.player.carrying = false;
    this.player.rooted = false;
    this.player.dizzy = 0;
    this.player.steady = 0;
    this.player.speedMul = 1;
    resetBooth();
    // interfacce dei capitoli (ballo, cruscotto...): spariscono con il capitolo
    document.querySelectorAll('.dance, .chapter-ui').forEach((e) => e.remove());
    this.hud.root.classList.remove('packing', 'in-booth');
  }

  // Salvataggio all'inizio di ogni capitolo: dove finisce lo decide il flusso (account o niente,
  // nella modalità capitoli e nella demo non si salva)
  saveHook: ((chapter: number, state: RawState) => void) | null = null;

  save() {
    this.saveHook?.(this.chapterNum, serializeState(this.state));
  }

  resetState(partial?: Chapter['startState']) {
    const s = freshState();
    if (partial) {
      // saltando a un capitolo si parte in forma (la salute bassa è solo la gag del risveglio nel capitolo 1)
      s.hp = s.maxHp;
      Object.assign(s, { ...partial, flags: new Set(partial.flags ?? []) });
    }
    this.state = s;
  }

  // Fine capitolo: riepilogo e passaggio al successivo (gestito dal flusso di gioco)
  completeChapter(teaser: string) {
    if (this.mode === 'end') return;
    this.mode = 'end';
    this.lastTeaser = teaser;
    this.onChapterComplete?.(this, this.chapterNum + 1);
  }
  lastTeaser = '';

  // Game over: schermata con "Riprova". retry rimette le cose a posto per ripartire.
  gameOver(title: string, text: string, retry: () => void) {
    if (this.dialogue.isOpen) this.dialogue.close();
    this.mode = 'end';
    this.audio.faint();
    this.onGameOver?.(title, text, retry);
  }

  // --- indizi ---
  findClue(id: string) {
    if (this.hasClue(id)) return;
    this.flag(`clue_${id}`);
    const c = this.clues[id];
    this.toast(`<span class="ph">🔍</span> Nuovo indizio: <b>${c.name}</b><br><small>${c.desc}</small>`, 'quest', 6500);
    this.audio.clue();
  }

  hasClue(id: string) {
    return this.is(`clue_${id}`);
  }

  get cluesFound() {
    return Object.keys(this.clues).filter((id) => this.hasClue(id));
  }

  setCheckpoint(pos: THREE.Vector3, look: THREE.Vector3, msg: string) {
    this.checkpoint.pos.copy(pos);
    this.checkpoint.look.copy(look);
    this.checkpoint.msg = msg;
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
    if (spec.fighter) this.combat.attach(npc, spec.fighter);
    npc.noTurn = spec.noTurn ?? false;
    if (spec.hidden) this.setHidden(npc, true);
    if (spec.dialogue) {
      const d = spec.dialogue;
      this.interactables.push({
        pos: npc.pos,
        radius: spec.talkRadius ?? 2.4,
        label: () => (npc.hidden || npc.fighter?.ko || npc.fighter?.hostile ? null : spec.talkLabel ?? `Parla con ${spec.name}`),
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

  setHidden(n: NPC, hidden: boolean) {
    n.hidden = hidden;
    n.body.root.visible = !hidden;
  }

  addInteractable(i: Interactable) {
    this.interactables.push(i);
    return i;
  }

  removeInteractable(i: Interactable) {
    this.interactables = this.interactables.filter((x) => x !== i);
  }

  addCoin(x: number, z: number, msg?: string, y = 0.9) {
    const s = new THREE.Sprite(this.coinMat);
    s.scale.setScalar(0.5);
    s.position.set(x, y, z);
    this.scene.add(s);
    this.pickups.push({ sprite: s, kind: 'coin', value: 5, taken: false, msg });
  }

  // cartucce d'inchiostro o merendine da raccogliere
  addPickup(kind: 'ammo' | 'heal', x: number, z: number, value: number, y = 0.6) {
    let m = this.pickupMats[kind];
    if (!m) {
      m = new THREE.SpriteMaterial({ map: pickupTexture(kind), alphaTest: 0.5 });
      m.alphaToCoverage = true;
      this.pickupMats[kind] = m;
    }
    const s = new THREE.Sprite(m);
    s.scale.setScalar(0.6);
    s.position.set(x, y, z);
    this.scene.add(s);
    const p: Pickup = { sprite: s, kind, value, taken: false };
    this.pickups.push(p);
    return p;
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

  // fumetto su un punto del mondo, solo per questo frame
  worldBubble(pos: THREE.Vector3, text: string) {
    this.bubblesThisFrame.push({ pos, text });
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
      const line = LEVEL_LINES[s.level] || 'Continui a migliorare. Più o meno.';
      this.toast(`<b>LIVELLO ${s.level}!</b><br>${line}<br><small>Salute massima +10, salute ripristinata, colpi più forti</small>`, 'level', 5000);
      this.audio.levelUp();
    }
  }

  get xpNext() {
    return 100 * this.state.level;
  }

  // danno dei colpi del giocatore: cresce col livello, ma con un tetto
  get playerDamage() {
    const base = this.player.weapon === 'ruler' ? 30 : this.player.weapon === 'pistol' ? PISTOL_DMG : 20;
    return Math.round(base * (1 + 0.08 * Math.min(this.state.level - 1, 8)));
  }

  // --- pistola ---
  get clipSize() {
    return this.is('caricatoreGrande') ? 12 : CLIP_SIZE;
  }

  addAmmo(n: number, silent = false) {
    this.state.ammo += n;
    if (!silent) this.toast(`+${n} cartucce d'inchiostro`, 'reward', 1800);
    this.audio.ammo();
  }

  private fire() {
    const s = this.state, p = this.player;
    if (this.fireCd > 0 || p.reloadT > 0) return;
    if (s.clip <= 0) {
      this.audio.empty();
      this.fireCd = 0.3;
      if (s.ammo > 0) this.reload();
      else if (this.time - this.lastNoAmmo > 3) {
        this.lastNoAmmo = this.time;
        this.toast('Niente inchiostro. Cerca delle cartucce (o usa i pugni).', 'bad', 2500);
      }
      return;
    }
    s.clip--;
    this.fireCd = 0.2;
    p.kick();
    this.guns.playerShoot();
    if (s.clip === 0 && s.ammo > 0) this.after(0.3, () => this.reload());
  }

  private equipPistol() {
    this.player.setWeapon('pistol');
    this.reloadId++;
    if (this.state.clip === 0) this.reload();
  }

  reload() {
    const s = this.state, p = this.player;
    if (p.weapon !== 'pistol' || p.reloadT > 0 || s.clip >= this.clipSize || s.ammo <= 0) return;
    const id = ++this.reloadId;
    p.startReload(1.1);
    this.audio.reload();
    this.after(1.1, () => {
      if (id !== this.reloadId || p.weapon !== 'pistol') return;
      const n = Math.min(this.clipSize - s.clip, s.ammo);
      s.clip += n;
      s.ammo -= n;
    });
  }

  // colpo di pistola su una persona
  shootNpc(n: NPC, point: THREE.Vector3) {
    const spec = this.specs.get(n.id);
    const head = point.y > n.topY - 0.36 && !(n.body instanceof Stickman && n.body.ko);
    this.hud.hitMark(head);
    this.audio.hitMark();
    this.audio.splat(point);
    if (n.fighter) {
      if (this.dialogue.isOpen) this.dialogue.close();
      this.combat.shot(n, Math.round(this.playerDamage * (head ? 1.6 : 1)), head);
      this.flag(`shot_${n.id}`);
      return;
    }
    if (n.body instanceof Stickman) n.body.punchReaction();
    if (spec?.onShot) spec.onShot(this, n);
    else {
      const lines = spec?.shotLines ?? GENERIC_SHOT;
      n.say(lines[Math.floor(Math.random() * lines.length)], 2.5);
    }
    this.flag(`shot_${n.id}`);
  }

  // colpo di un nemico andato a segno (la parata non serve contro l'inchiostro)
  shootPlayer(dmg: number, from: NPC, color: string) {
    if (this.fainting) return;
    const push = this.player.pos.clone().sub(from.pos).setY(0).normalize();
    this.player.knock.addScaledVector(push, 1.5);
    this.hud.inkSplat(color);
    this.hurt(dmg);
  }

  heal(n: number) {
    const s = this.state;
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + n);
    this.toast(`+${Math.round(s.hp - before)} salute`, 'reward', 2200);
    this.audio.heal();
  }

  hurt(n: number) {
    if (this.fainting) return;
    this.state.hp = Math.max(0, this.state.hp - n);
    this.damageFx = 1;
    this.audio.hurt();
    if (this.state.hp <= 0) this.faint();
  }

  // colpo di un avversario: se stai parando (tasto destro) e lo guardi, lo pari del tutto
  damagePlayer(dmg: number, from: NPC): 'parried' | 'hit' {
    const p = this.player;
    const toEnemy = from.pos.clone().sub(p.pos).setY(0).normalize();
    const f = p.forward.setY(0).normalize();
    const push = p.pos.clone().sub(from.pos).setY(0).normalize();
    if (p.blocking && toEnemy.dot(f) > 0.4) {
      this.audio.parry();
      this.hud.popWord(p.eye.add(f.multiplyScalar(0.8)), p.camera, 'PARATA!');
      p.knock.copy(push.multiplyScalar(1));
      return 'parried';
    }
    p.knock.copy(push.multiplyScalar(6));
    this.hurt(dmg);
    return 'hit';
  }

  give(id: ItemId) {
    if (!this.state.items.includes(id)) this.state.items.push(id);
    const it = ITEMS[id];
    const key = keyName(id === 'pistola' ? 'weapon3' : 'weapon2');
    this.toast(`Nuovo oggetto: <b>${it.name}</b>${it.weapon ? `<br><small>premi ${key} per equipaggiarlo</small>` : ''}`, 'reward', 4200);
    this.audio.item();
  }

  take(id: ItemId) {
    this.state.items = this.state.items.filter((i) => i !== id);
  }

  has(id: ItemId) {
    return this.state.items.includes(id);
  }

  // stato missione: -1 non iniziata, 0..n-1 passo attivo, QUEST_DONE completata
  quest(id: string) {
    return this.state.quests[id] ?? -1;
  }

  questDone(id: string) {
    const q = this.quest(id);
    const def = this.quests[id];
    return q >= QUEST_DONE || (!!def && q >= def.steps.length);
  }

  questActive(id: string) {
    const q = this.quest(id);
    return q >= 0 && !this.questDone(id);
  }

  startQuest(id: string) {
    this.state.quests[id] = 0;
    const q = this.quests[id];
    if (!q.main) {
      this.toast(`Nuova missione: <b>${q.title}</b>`, 'quest');
      this.audio.objective();
    }
  }

  setStep(id: string, step: number, quiet = false) {
    const q = this.quests[id];
    if (step >= q.steps.length) {
      this.state.quests[id] = QUEST_DONE;
      if (!q.main) {
        this.toast(`Missione completata: <b>${q.title}</b>`, 'quest', 4500);
        this.audio.questDone();
      }
      return;
    }
    this.state.quests[id] = step;
    if (!quiet) {
      const s = q.steps[step];
      this.toast(`Obiettivo: ${typeof s.text === 'string' ? s.text : s.text(this)}`, q.main ? 'quest' : 'info');
      this.audio.objective();
    }
  }

  completeQuest(id: string) {
    this.setStep(id, this.quests[id].steps.length);
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
      const c = this.checkpoint;
      this.player.pos.set(c.pos.x, 0, c.pos.z);
      this.player.knock.set(0, 0, 0);
      this.player.setLook(c.look);
      this.state.hp = Math.round(this.state.maxHp / 2);
      const lost = Math.min(5, this.state.coins);
      this.state.coins -= lost;
      this.onFaint?.();
      this.fade(false);
      this.fainting = false;
      this.toast(`${c.msg}${lost ? `. Qualcuno si è preso ${lost} monete per il disturbo` : ''}.`, 'bad', 5000);
    });
  }

  // =========================================================================
  // Ciclo di gioco
  // =========================================================================
  update(dt: number) {
    this.touch?.update(); // i pulsanti a schermo scrivono nell'input prima che venga letto
    if (!this.world) {
      this.input.endFrame();
      return;
    }
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
      this.chapterTime += dt;
      if (this.dialogue.isOpen) {
        canMove = false;
        this.dialogue.update(dt);
        // sul telefono un tocco fa solo scorrere le battute: le risposte si scelgono toccandole
        const tap = inp.clicked && !(TOUCH && this.dialogue.hasChoices);
        if (inp.wasPressed('interact') || inp.pressed.has('Space') || inp.pressed.has('Enter') || tap) this.dialogue.advance();
        for (let i = 0; i < 9; i++) if (inp.pressed.has(`Digit${i + 1}`)) this.dialogue.choose(i);
        if (inp.wasPressed('forward') || inp.pressed.has('ArrowUp')) this.dialogue.moveSel(-1);
        if (inp.wasPressed('back') || inp.pressed.has('ArrowDown')) this.dialogue.moveSel(1);
        // la testa si gira verso chi sta parlando (o verso ciò di cui si parla)
        const f = this.dialogue.focus;
        if (f instanceof NPC) this.player.easeLook(new THREE.Vector3(f.pos.x, f.topY - 0.15, f.pos.z), dt);
        else if (f) this.player.easeLook(f, dt);
      } else if (this.hud.diarioOpen) {
        canMove = false;
        if (inp.wasPressed('journal') || inp.pressed.has('Tab') || inp.wasPressed('interact')) this.hud.showDiario(null);
      } else if (this.minigame) {
        canMove = false;
        this.minigame(dt);
      } else {
        if (inp.wasPressed('interact') && this.focus) this.focus.use(this);
        if (inp.wasPressed('journal') || inp.pressed.has('Tab')) this.hud.showDiario(this.diarioHtml());
        const hands = !this.player.seated && !this.player.carrying && !this.player.rooted;
        if (inp.clicked && !this.player.blocking && hands) {
          if (this.player.weapon === 'pistol') this.fire();
          else if (this.player.attack()) this.audio.swing(this.player.weapon);
        }
        if (inp.wasPressed('reload')) this.reload();
        if (inp.wasPressed('music')) this.toast(this.audio.toggleMusic() ? 'Musica: accesa' : 'Musica: spenta', 'info', 1800);
        if (inp.wasPressed('crouch') && hands) this.player.setCrouch(!this.player.crouching);
        if (inp.wasPressed('weapon1') && hands) this.player.setWeapon('fist');
        if (inp.wasPressed('weapon2') && hands && this.has('righello')) this.player.setWeapon('ruler');
        if (inp.wasPressed('weapon3') && hands && this.has('pistola') && this.player.weapon !== 'pistol') this.equipPistol();
        if (inp.cycleWeapon && hands) {
          // pulsante ARMA (telefono): la prossima arma che hai
          const owned = (['fist', 'ruler', 'pistol'] as const).filter((w) => w === 'fist' || (w === 'ruler' ? this.has('righello') : this.has('pistola')));
          const next = owned[(owned.indexOf(this.player.weapon) + 1) % owned.length];
          if (next === 'pistol') this.equipPistol();
          else this.player.setWeapon(next);
        }
      }
    }

    this.fireCd = Math.max(0, this.fireCd - dt);
    const ev = this.player.update(dt, inp, this.world.colliders, canMove);
    if (ev.hit) this.resolveHit();
    const indoor = this.world.isIndoor(this.player.pos);
    if (ev.stepped) this.audio.footstep(ev.running, indoor, this.player.crouching);
    if (ev.jumped) this.audio.jump();
    if (ev.landed) this.audio.land();
    this.audio.update(dt, { pos: this.player.pos, yaw: this.player.yaw, indoor });

    // PNG
    const pp = this.player.pos;
    this.updateTrail();
    for (const n of this.npcs) {
      if (n.hidden) continue;
      const follows = n.behavior.type === 'follow' && !n.controlled && !n.talking;
      if (follows) this.followWaypoint(n);
      const d = n.update(dt, pp);
      if (follows) this.world.colliders.resolve(n.pos, 0.3);
      // il giocatore non passa attraverso le persone (a meno che non siano KO)
      const min = this.player.radius + (n.isDog ? 0.25 : 0.3);
      if (d < min && d > 1e-4 && !n.fighter?.ko) {
        const dx = pp.x - n.pos.x, dz = pp.z - n.pos.z;
        pp.x = n.pos.x + (dx / d) * min;
        pp.z = n.pos.z + (dz / d) * min;
      }
      // battute spontanee (non mentre si parla con qualcuno: si sovrapporrebbero al dialogo)
      if (playing && !n.talking && !this.dialogue.isOpen && !n.fighter?.hostile && !n.fighter?.ko && d < 8) {
        n.nextBark -= dt;
        if (n.nextBark <= 0) {
          const barks = this.specs.get(n.id)?.barks?.(this) ?? [];
          if (barks.length && !n.bubble) n.say(barks[Math.floor(Math.random() * barks.length)], 4);
          n.nextBark = 7 + Math.random() * 9;
        }
      }
    }
    // durante i dialoghi e i minigiochi la rissa è in pausa: non si prendono pugni mentre si parla
    if (playing && !this.dialogue.isOpen && !this.minigame) this.combat.update(dt);
    this.guns.update(dt);

    // monete, cartucce e merendine per terra
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.sprite.position.y += Math.sin(this.time * 3 + p.sprite.position.x) * 0.002;
      if (p.kind === 'coin') p.sprite.scale.x = 0.5 * Math.max(0.12, Math.abs(Math.cos(this.time * 2.5 + p.sprite.position.z)));
      const d = Math.hypot(pp.x - p.sprite.position.x, pp.z - p.sprite.position.z);
      if (d < 1.1 && playing) {
        // la salute piena non si spreca
        if (p.kind === 'heal' && this.state.hp >= this.state.maxHp) continue;
        p.taken = true;
        this.scene.remove(p.sprite);
        if (p.kind === 'coin') this.addCoins(p.value);
        else if (p.kind === 'ammo') this.addAmmo(p.value);
        else this.heal(p.value);
        if (p.msg) this.toast(p.msg, 'info', 4500);
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken);

    for (const f of this.onUpdate) f(this, dt);

    this.damageFx = Math.max(0, this.damageFx - dt * 1.5);
    this.updateFocus(playing && !this.interactOff && !this.dialogue.isOpen && !this.hud.diarioOpen && !this.minigame);
    this.updateHud();
    this.post.render(this.time, this.damageFx, Math.pow(this.player.dizzy, 1.5) * (1 - 0.6 * this.player.steady));
    inp.endFrame();
  }

  // Tracce del giocatore: un punto ogni 0,7 m (le ultime 120)
  private updateTrail() {
    const p = this.player.pos;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.7) {
      this.trail.push(new THREE.Vector3(p.x, 0, p.z));
      if (this.trail.length > 120) this.trail.shift();
    }
  }

  // Chi ti segue va dritto se ti vede, altrimenti verso il punto più recente delle tue tracce che
  // riesce a vedere (così passa dalle porte come te). Se resta troppo indietro, fuori vista, ti raggiunge.
  private followWaypoint(n: NPC) {
    const b = n.behavior;
    if (b.type !== 'follow') return;
    const t = b.target();
    const col = this.world.colliders;
    const toPlayer = t === this.player.pos;
    n.waypoint = null;
    if (!col.blocked(n.pos.x, n.pos.z, t.x, t.z, false, 0.2) || !toPlayer) return;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const w = this.trail[i];
      if (!col.blocked(n.pos.x, n.pos.z, w.x, w.z, false, 0.2)) {
        n.waypoint = w;
        break;
      }
    }
    // perso del tutto (nessuna traccia visibile o troppo lontano): riappare dietro di te, dove non guardi
    const far = Math.hypot(n.pos.x - t.x, n.pos.z - t.z) > 30;
    if ((!n.waypoint || far) && this.trail.length > 8) {
      const w = this.trail[this.trail.length - 8];
      const f = this.player.forward;
      const behind = (w.x - t.x) * f.x + (w.z - t.z) * f.z < 0;
      if (behind) n.pos.set(w.x, 0, w.z);
    }
  }

  // minigioco attivo (es. sfida di ballo): riceve il dt e blocca il movimento
  minigame: ((dt: number) => void) | null = null;

  private resolveHit() {
    const reach = this.player.weapon === 'ruler' ? 2.5 : 2.1;
    const e = this.player.eye;
    const f = this.player.forward.setY(0).normalize();
    let best: NPC | null = null;
    let bestD = Infinity;
    for (const n of this.npcs) {
      if (n.hidden || n.fighter?.ko) continue;
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
    this.audio.hit(this.player.weapon);
    if (best.fighter) {
      if (this.dialogue.isOpen) this.dialogue.close();
      this.combat.hit(best, this.playerDamage);
      spec?.onPunch?.(this, best);
      this.flag(`punched_${best.id}`);
      return;
    }
    if (best.body instanceof Stickman) best.body.punchReaction();
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
      const floor = this.player.floor;
      if (tmp.y - floor < 0.3) tmp.y = floor + 1.2; // gli NPC hanno pos a terra: mira al busto
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
    const w = this.player.weapon;
    this.hud.setStats({
      hp: s.hp,
      maxHp: s.maxHp,
      coins: s.coins,
      level: s.level,
      xp: s.xp,
      xpNext: this.xpNext,
      weapon: (w === 'ruler' ? 'Righello (30 cm)' : w === 'pistol' ? 'Pistola a inchiostro' : 'Pugni stilizzati') + (this.player.crouching ? ' · accovacciato' : ''),
    });
    this.hud.ammo(w === 'pistol' && this.mode !== 'title' ? { clip: s.clip, size: this.clipSize, ammo: s.ammo, reloading: this.player.reloadT > 0 } : null);
    if (w === 'pistol') this.player.setInk(s.clip / this.clipSize);

    const objs: { text: string; kind: MarkerKind; title?: string }[] = [];
    const cam = this.player.camera;
    cam.updateMatrixWorld();
    this.hud.beginWorld();
    const pp = this.player.pos;
    for (const [id, q] of Object.entries(this.quests)) {
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
        // niente icone o fumetti attraverso i muri
        if (d > 3 && this.world.colliders.blocked(pp.x, pp.z, n.pos.x, n.pos.z, false, 1.0)) continue;
        const f = n.fighter;
        const talking = this.dialogue.npc === n;
        let icon = f?.ko ? null : this.specs.get(n.id)?.icon?.(this) ?? null;
        // furtività: "?" che cresce, "!" quando ti ha scoperto
        if (f && f.state === 'open') icon = 'dizzy';
        else if (f && !f.ko && f.hostile && d < 25) icon = 'alert';
        else if (f && !f.ko && f.suspicion > 0.05) icon = 'suspect';
        if (icon && !talking && !this.minigame) this.hud.npcIcon(tmp.set(n.pos.x, n.topY + 0.45, n.pos.z), cam, icon, f?.suspicion);
        if (n.bubble && !talking) this.hud.bubble(tmp.set(n.pos.x, n.topY + (icon ? 0.85 : 0.3), n.pos.z), cam, n.bubble);
        if (f && f.hostile && !f.ko && f.hp < f.maxHp) this.hud.enemyBar(tmp.set(n.pos.x, n.topY + 0.2, n.pos.z), cam, f.hp / f.maxHp);
        else if (d < 7 && !this.hideNameTags && !this.dialogue.isOpen && !f?.ko) this.hud.nameTag(tmp.set(n.pos.x, n.topY + 0.12, n.pos.z), cam, n.name);
      }
      for (const it of this.interactables) {
        const ic = it.icon?.(this);
        if (!ic) continue;
        const d = Math.hypot(it.pos.x - pp.x, it.pos.z - pp.z);
        if (d > 9 || (d > 2 && this.world.colliders.blocked(pp.x, pp.z, it.pos.x, it.pos.z, false, 1.0))) continue;
        this.hud.npcIcon(tmp.set(it.pos.x, it.pos.y + 0.6, it.pos.z), cam, ic);
      }
      for (const b of this.bubblesThisFrame) this.hud.bubble(b.pos, cam, b.text);
    }
    this.bubblesThisFrame = [];
    this.hud.endWorld();
  }

  private diarioHtml() {
    const s = this.state;
    const qs = Object.entries(this.quests)
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
    const found = this.cluesFound;
    const clues = Object.keys(this.clues).length
      ? `<h3>Indizi (${found.length})</h3><ul>${
          found.map((id) => `<li><b>${this.clues[id].name}</b><br><small>${this.clues[id].desc}</small></li>`).join('') ||
          '<li><small>Nessuno. Guardati intorno, detective.</small></li>'
        }</ul>`
      : '';
    return `<h2>Diario · Capitolo ${this.chapterNum}</h2>
      <div class="cols">
        <div><h3>Missioni</h3><ul>${qs || '<li><small>Nessuna. Per ora.</small></li>'}</ul>${clues}</div>
        <div><h3>Inventario</h3><ul>${items}</ul>
        <h3>Tu</h3><ul><li>Livello ${s.level} · ${s.xp}/${this.xpNext} XP</li><li>Salute ${Math.round(s.hp)}/${s.maxHp}</li><li>${s.coins} monete</li></ul></div>
      </div>
      <div class="hint">${keyName('journal')} per chiudere</div>`;
  }
}
