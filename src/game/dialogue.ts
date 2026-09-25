import type { Game } from './game';
import type { NPC } from '../entities/npc';
import { VOICES } from '../content/voices';

// ---------------------------------------------------------------------------
// Formato dei dialoghi
//
//   'testo'        → parla il personaggio
//   '> testo'      → parli tu
//   '* testo'      → narratore (corsivo)
//   '@Nome| testo' → parla qualcun altro
//
// Il testo può essere una funzione (g) => string per valori dinamici.
// ---------------------------------------------------------------------------

export type Txt = string | ((g: Game) => string);

export interface Choice {
  t: Txt;
  next?: string;
  do?: (g: Game) => void;
  if?: (g: Game) => boolean;
}

export interface DNode {
  say: Txt[];
  do?: (g: Game) => void; // eseguito entrando nel nodo
  choices?: Choice[];
  next?: string | ((g: Game) => string | undefined);
}

export interface Dialogue {
  name: string;
  start: string | ((g: Game) => string);
  nodes: Record<string, DNode>;
}

export interface ParsedLine {
  who: string;
  text: string;
  kind: 'npc' | 'player' | 'narrator';
}

export function parseLine(raw: string, defaultName: string): ParsedLine {
  if (raw.startsWith('> ')) return { who: 'Tu', text: raw.slice(2), kind: 'player' };
  if (raw.startsWith('* ')) return { who: '', text: raw.slice(2), kind: 'narrator' };
  if (raw.startsWith('@')) {
    const i = raw.indexOf('|');
    return { who: raw.slice(1, i), text: raw.slice(i + 1).trim(), kind: 'npc' };
  }
  return { who: defaultName, text: raw, kind: 'npc' };
}

export class DialogueRunner {
  active: Dialogue | null = null;
  npc: NPC | null = null;
  private node: DNode | null = null;
  private lineIdx = 0;
  private line: ParsedLine | null = null;
  private shown = 0; // caratteri mostrati (effetto macchina da scrivere)
  private choices: Choice[] | null = null;
  private sel = 0;
  private onEnd: (() => void) | null = null;

  constructor(private g: Game) {}

  get isOpen() {
    return this.active !== null;
  }

  start(d: Dialogue, npc: NPC | null = null, onEnd?: () => void) {
    this.active = d;
    this.npc = npc;
    this.onEnd = onEnd ?? null;
    if (npc) npc.talking = true;
    this.g.audio.dialogueOpen();
    const id = typeof d.start === 'string' ? d.start : d.start(this.g);
    this.enter(id);
  }

  private txt(t: Txt) {
    return typeof t === 'string' ? t : t(this.g);
  }

  private enter(id: string | undefined) {
    if (!this.active) return;
    const node = id ? this.active.nodes[id] : undefined;
    if (!node) return this.close();
    this.node = node;
    this.lineIdx = 0;
    this.choices = null;
    node.do?.(this.g);
    if (!this.active) return; // node.do può chiudere il dialogo
    this.showLine();
  }

  private showLine() {
    const n = this.node!;
    if (this.lineIdx < n.say.length) {
      this.line = parseLine(this.txt(n.say[this.lineIdx]), this.active!.name);
      this.shown = 0;
      this.choices = null;
      if (this.npc) this.npc.speaking = this.line.kind === 'npc';
      if (this.npc?.isDog && this.line.kind === 'npc') this.g.audio.bark(this.npc.pos);
      this.render();
      return;
    }
    const ch = n.choices?.filter((c) => !c.if || c.if(this.g));
    if (ch && ch.length) {
      this.choices = ch;
      this.sel = 0;
      if (this.npc) this.npc.speaking = false;
      this.render();
      return;
    }
    const next = typeof n.next === 'function' ? n.next(this.g) : n.next;
    this.enter(next);
  }

  private render() {
    const hud = this.g.hud;
    if (!this.line) return;
    hud.dialogue(
      this.line.who,
      this.line.text.slice(0, Math.floor(this.shown)),
      this.line.kind,
      this.choices ? this.choices.map((c) => this.txt(c.t)) : null,
      this.sel,
    );
  }

  update(dt: number) {
    if (!this.active || !this.line) return;
    if (!this.choices && this.shown < this.line.text.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.line.text.length, this.shown + dt * 55);
      for (let i = before; i < Math.floor(this.shown); i++) this.blip(i);
      this.render();
    }
  }

  // "voce" del personaggio: un bip ogni tot lettere
  private blip(i: number) {
    const line = this.line!;
    const ch = line.text[i];
    if (!/[a-zàèéìòù0-9]/i.test(ch)) return;
    if (line.kind === 'narrator') {
      if (i % 3 === 0) this.g.audio.pencil();
      return;
    }
    if (this.npc?.isDog && line.kind === 'npc') return;
    const v = line.kind === 'player' ? VOICES.player : line.who === this.active?.name && this.npc ? VOICES[this.npc.id] : undefined;
    if (i % (v?.every ?? 2) === 0) this.g.audio.voice(v, ch);
  }

  // E / Spazio / click
  advance() {
    if (!this.active || !this.line) return;
    if (this.choices) return this.choose(this.sel);
    if (this.shown < this.line.text.length) {
      this.shown = this.line.text.length;
      this.render();
      return;
    }
    this.lineIdx++;
    this.showLine();
  }

  moveSel(d: number) {
    if (!this.choices) return;
    this.sel = (this.sel + d + this.choices.length) % this.choices.length;
    this.g.audio.tick();
    this.render();
  }

  choose(i: number) {
    if (!this.choices || i < 0 || i >= this.choices.length) return;
    const c = this.choices[i];
    this.choices = null;
    this.g.audio.select();
    c.do?.(this.g);
    if (!this.active) return;
    this.enter(c.next);
  }

  close() {
    if (this.npc) {
      this.npc.talking = false;
      this.npc.speaking = false;
    }
    this.active = null;
    this.npc = null;
    this.node = null;
    this.line = null;
    this.choices = null;
    this.g.hud.hideDialogue();
    const cb = this.onEnd;
    this.onEnd = null;
    cb?.();
  }
}
