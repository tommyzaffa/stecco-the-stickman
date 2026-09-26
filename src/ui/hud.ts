import * as THREE from 'three';

// HUD in HTML sopra il canvas: più facile da stilizzare "a mano" che in WebGL.

export type MarkerKind = 'main' | 'side';
export type IconKind = 'main' | 'main-turnin' | 'side' | 'turnin' | 'suspect' | 'alert' | 'dizzy' | 'clue';

const el = (tag: string, cls = '', parent?: HTMLElement) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
};

class Pool {
  private items: HTMLElement[] = [];
  private used = 0;
  constructor(private parent: HTMLElement, private cls: string) {}
  get() {
    let e = this.items[this.used];
    if (!e) {
      e = el('div', this.cls, this.parent);
      this.items.push(e);
    }
    this.used++;
    e.style.display = '';
    return e;
  }
  reset() {
    this.used = 0;
  }
  finish() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].style.display = 'none';
  }
}

const _v = new THREE.Vector3();

export class Hud {
  root: HTMLElement;
  private hpFill: HTMLElement;
  private hpNum: HTMLElement;
  private coins: HTMLElement;
  private level: HTMLElement;
  private xpFill: HTMLElement;
  private weapon: HTMLElement;
  private objectives: HTMLElement;
  private toasts: HTMLElement;
  private promptEl: HTMLElement;
  private crosshair: HTMLElement;
  private dlg: HTMLElement;
  private dlgWho: HTMLElement;
  private dlgText: HTMLElement;
  private dlgChoices: HTMLElement;
  private dlgHint: HTMLElement;
  private chapterEl: HTMLElement;
  fadeEl: HTMLElement;
  private diarioEl: HTMLElement;
  screen: HTMLElement;
  private markers: Pool;
  private icons: Pool;
  private bubbles: Pool;
  private tags: Pool;
  private bars: Pool;
  private layer: HTMLElement;
  private arrow: HTMLElement;
  private lastCoins = -1;
  private lastStats = '';

  constructor() {
    this.root = el('div', '', document.body);
    this.root.id = 'hud';

    const stats = el('div', 'stats paper', this.root);
    const hpRow = el('div', 'hp-row', stats);
    el('span', 'lbl', hpRow).textContent = 'Salute';
    const bar = el('div', 'bar', hpRow);
    this.hpFill = el('div', 'fill', bar);
    this.hpNum = el('span', 'num', hpRow);
    const row = el('div', 'row', stats);
    this.coins = el('span', 'coins', row);
    this.level = el('span', 'level', row);
    const xp = el('div', 'xp', stats);
    this.xpFill = el('div', 'fill', xp);
    this.weapon = el('div', 'weapon', stats);

    this.objectives = el('div', 'objectives', this.root);
    this.toasts = el('div', 'toasts', this.root);
    this.promptEl = el('div', 'prompt', this.root);
    this.crosshair = el('div', 'crosshair', this.root);

    const layer = el('div', 'markers', this.root);
    this.layer = layer;
    this.tags = new Pool(layer, 'nametag');
    this.bars = new Pool(layer, 'enemy-bar');
    this.icons = new Pool(layer, 'npc-icon');
    this.markers = new Pool(layer, 'marker');
    this.bubbles = new Pool(layer, 'bubble');
    this.arrow = el('div', 'edge-arrow', layer);
    this.arrow.innerHTML = '<svg viewBox="0 0 60 60"><path d="M8 30 L48 30 M34 14 L50 30 L34 46" /></svg>';

    this.dlg = el('div', 'dialogue paper', this.root);
    this.dlgWho = el('div', 'who', this.dlg);
    this.dlgText = el('div', 'text', this.dlg);
    this.dlgChoices = el('div', 'choices', this.dlg);
    this.dlgHint = el('div', 'hint', this.dlg);

    this.chapterEl = el('div', 'chapter', this.root);
    this.fadeEl = el('div', 'fade', this.root);
    this.diarioEl = el('div', 'diario paper', this.root);
    this.screen = el('div', 'screen', this.root);
  }

  // --- statistiche ------------------------------------------------------------
  get screenVisible() {
    return this.screen.style.display === 'flex';
  }

  setStats(s: { hp: number; maxHp: number; coins: number; level: number; xp: number; xpNext: number; weapon: string }) {
    const key = `${Math.round(s.hp)}|${s.maxHp}|${s.coins}|${s.level}|${s.xp}|${s.xpNext}|${s.weapon}`;
    if (key === this.lastStats) return;
    this.lastStats = key;
    this.hpFill.style.width = `${(100 * s.hp) / s.maxHp}%`;
    this.hpFill.classList.toggle('low', s.hp / s.maxHp < 0.35);
    this.hpNum.textContent = `${Math.round(s.hp)}/${s.maxHp}`;
    this.coins.textContent = `● ${s.coins} monete`;
    if (this.lastCoins !== -1 && s.coins !== this.lastCoins) {
      this.coins.classList.remove('pop');
      void this.coins.offsetWidth;
      this.coins.classList.add('pop');
    }
    this.lastCoins = s.coins;
    this.level.textContent = `Livello ${s.level}`;
    this.xpFill.style.width = `${(100 * s.xp) / s.xpNext}%`;
    this.weapon.textContent = `Arma: ${s.weapon}`;
  }

  setObjectives(list: { text: string; kind: MarkerKind; title?: string }[]) {
    const html = list
      .map((o) => `<div class="obj ${o.kind}">${o.title ? `<div class="t">${o.title}</div>` : ''}<div class="s">${o.kind === 'main' ? '➜' : '○'} ${o.text}</div></div>`)
      .join('');
    if (this.objectives.innerHTML !== html) this.objectives.innerHTML = html;
  }

  prompt(text: string | null) {
    const disp = text ? '' : 'none';
    if (this.promptEl.style.display !== disp) this.promptEl.style.display = disp;
    if (text && this.promptEl.dataset.t !== text) {
      this.promptEl.dataset.t = text;
      this.promptEl.innerHTML = `<b>E</b> ${text}`;
    }
  }

  toast(text: string, kind: 'info' | 'reward' | 'quest' | 'level' | 'phone' | 'bad' = 'info', ms = 3800) {
    const t = el('div', `toast ${kind}`, this.toasts);
    t.innerHTML = text;
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 600);
  }

  chapter(title: string, sub: string) {
    this.chapterEl.innerHTML = `<div class="c1">${title}</div><div class="c2">${sub}</div>`;
    this.chapterEl.classList.remove('show');
    void this.chapterEl.offsetWidth;
    this.chapterEl.classList.add('show');
  }

  // --- dialoghi ----------------------------------------------------------------
  dialogue(who: string, text: string, kind: string, choices: string[] | null, sel: number) {
    this.dlg.style.display = 'block';
    this.crosshair.style.display = 'none';
    this.dlg.className = `dialogue paper ${kind}`;
    this.dlgWho.textContent = who;
    this.dlgWho.style.display = who ? '' : 'none';
    this.dlgText.textContent = text;
    if (choices) {
      const html = choices.map((c, i) => `<div class="choice ${i === sel ? 'sel' : ''}"><b>${i + 1}</b> ${c}</div>`).join('');
      this.dlgChoices.innerHTML = html;
      this.dlgChoices.style.display = '';
      this.dlgHint.textContent = 'tasti numerici oppure W/S + E per scegliere';
    } else {
      this.dlgChoices.style.display = 'none';
      this.dlgHint.textContent = 'E / Spazio / Click per continuare';
    }
  }

  hideDialogue() {
    this.dlg.style.display = 'none';
    this.crosshair.style.display = '';
  }

  // --- diario ------------------------------------------------------------------
  showDiario(html: string | null) {
    this.diarioEl.style.display = html ? 'block' : 'none';
    if (html) this.diarioEl.innerHTML = html;
  }

  get diarioOpen() {
    return this.diarioEl.style.display === 'block';
  }

  // --- marker nel mondo ----------------------------------------------------------
  beginWorld() {
    this.markers.reset();
    this.icons.reset();
    this.bubbles.reset();
    this.tags.reset();
    this.bars.reset();
    this.arrow.style.display = 'none';
  }

  endWorld() {
    this.markers.finish();
    this.icons.finish();
    this.bubbles.finish();
    this.tags.finish();
    this.bars.finish();
  }

  private project(p: THREE.Vector3, cam: THREE.Camera) {
    _v.copy(p).applyMatrix4(cam.matrixWorldInverse);
    const behind = _v.z > -0.1;
    const depth = -_v.z;
    _v.copy(p).project(cam);
    return {
      x: (_v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_v.y * 0.5 + 0.5) * window.innerHeight,
      behind,
      depth,
      on: !behind && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1,
    };
  }

  worldMarker(p: THREE.Vector3, cam: THREE.Camera, kind: MarkerKind, dist: number) {
    const s = this.project(p, cam);
    if (s.on) {
      const m = this.markers.get();
      m.className = `marker ${kind}`;
      m.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      m.innerHTML = `<span class="v">▼</span><span class="d">${Math.round(dist)}m</span>`;
      return;
    }
    if (kind !== 'main') return;
    // fuori schermo: freccia rossa sul bordo che punta verso l'obiettivo
    _v.copy(p).applyMatrix4(cam.matrixWorldInverse);
    let ang = Math.atan2(-_v.y, _v.x);
    if (s.behind && Math.abs(_v.x) < 0.001) ang = Math.PI / 2;
    const w = window.innerWidth, h = window.innerHeight;
    const cx = w / 2, cy = h / 2;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const k = Math.min((cx - 60) / Math.abs(dx || 1e-6), (cy - 60) / Math.abs(dy || 1e-6));
    this.arrow.style.display = '';
    this.arrow.style.transform = `translate(${cx + dx * k}px, ${cy + dy * k}px) translate(-50%, -50%) rotate(${ang}rad)`;
  }

  npcIcon(p: THREE.Vector3, cam: THREE.Camera, kind: IconKind, level = 1) {
    const s = this.project(p, cam);
    if (!s.on || s.depth > 60) return;
    const e = this.icons.get();
    e.className = `npc-icon ${kind}`;
    e.textContent = kind === 'dizzy' ? '✶ ✶' : kind === 'clue' ? '?' : kind.endsWith('turnin') || kind === 'suspect' ? '?' : '!';
    let sc = Math.max(0.55, Math.min(1.3, 9 / s.depth));
    if (kind === 'suspect') {
      sc *= 0.5 + level * 0.7;
      e.style.opacity = String(0.35 + level * 0.65);
    } else e.style.opacity = '';
    e.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%) scale(${sc})`;
  }

  bubble(p: THREE.Vector3, cam: THREE.Camera, text: string) {
    const s = this.project(p, cam);
    if (!s.on || s.depth > 22) return;
    const e = this.bubbles.get();
    if (e.textContent !== text) e.textContent = text;
    e.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, calc(-100% - 12px))`;
    e.style.opacity = String(Math.min(1, (22 - s.depth) / 6));
  }

  enemyBar(p: THREE.Vector3, cam: THREE.Camera, frac: number) {
    const s = this.project(p, cam);
    if (!s.on || s.depth > 30) return;
    const e = this.bars.get();
    if (!e.firstChild) e.appendChild(document.createElement('div'));
    (e.firstChild as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`;
    e.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
  }

  // Scritta da fumetto (POW! SBAM!) che esplode e sparisce
  popWord(p: THREE.Vector3, cam: THREE.Camera, text: string) {
    const s = this.project(p, cam);
    if (!s.on) return;
    const e = el('div', 'popword', this.layer);
    e.textContent = text;
    e.style.left = `${s.x + (Math.random() - 0.5) * 40}px`;
    e.style.top = `${s.y + (Math.random() - 0.5) * 30}px`;
    e.style.setProperty('--rot', `${(Math.random() - 0.5) * 30}deg`);
    setTimeout(() => e.remove(), 800);
  }

  nameTag(p: THREE.Vector3, cam: THREE.Camera, text: string) {
    const s = this.project(p, cam);
    if (!s.on) return;
    const e = this.tags.get();
    if (e.textContent !== text) e.textContent = text;
    e.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
  }
}
