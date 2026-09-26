import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import { Stickman } from '../../entities/stickman';
import { PLAYER_INK } from '../../game/guns';
import { COVERS, REFS, type Barrel } from './world';
import { RAID } from './quests';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// La sparatoria del Mercato Nero: i Pastelli a Cera arrivano a ondate dai tunnel.
// Tre ondate: quattro da ovest, quattro da est, poi il Pastellone con due di scorta.
// ---------------------------------------------------------------------------

interface WaveEnemy {
  id: string;
  from: 'W' | 'E';
  cover: [number, number] | null;
  delay?: number; // secondi prima di attaccare (i coltelli arrivano quando meno te lo aspetti)
}

// Tre ondate. Chi ha la pistola si ripara e cambia nascondiglio; gli Appuntiti corrono a zig-zag
// col temperino in mano. Nella seconda ondata qualcuno arriva anche dall'altro tunnel.
export const WAVES: WaveEnemy[][] = [
  [
    { id: 'pRosso', from: 'W', cover: COVERS.west[0] },
    { id: 'pBlu', from: 'W', cover: COVERS.west[1] },
    { id: 'pVerde', from: 'W', cover: COVERS.west[2] },
    { id: 'pArancione', from: 'W', cover: COVERS.west[3] },
    { id: 'aGiallo', from: 'W', cover: null, delay: 6 },
  ],
  [
    { id: 'pMarrone', from: 'E', cover: COVERS.east[0] },
    { id: 'pNero', from: 'E', cover: COVERS.east[1] },
    { id: 'pCeleste', from: 'E', cover: COVERS.east[2] },
    { id: 'pOcra', from: 'E', cover: COVERS.east[3] },
    { id: 'aBianco', from: 'E', cover: null, delay: 4 },
    { id: 'pRame', from: 'W', cover: COVERS.west[1], delay: 9 },
  ],
  [
    { id: 'pastellone', from: 'W', cover: null },
    { id: 'pRosso2', from: 'E', cover: COVERS.east[0] },
    { id: 'pVerde2', from: 'E', cover: COVERS.east[2] },
    { id: 'aNero', from: 'W', cover: null, delay: 5 },
    { id: 'aRosso', from: 'E', cover: null, delay: 10 },
  ],
];

// i civili che durante la sparatoria si riparano dietro il bancone
export const VENDORS = ['riflesso', 'vocabolo', 'tarocco', 'boccetta', 'bossolo', 'grigia', 'controluce'];
// chi scappa su per le scale
const RUNNERS = ['collezionista', 'pelliccia', 'salutatore', 'cliente1', 'cliente2'];

const state = { active: false, done: false, nextWaveAt: -1, crate: 0 };

export function resetRaid() {
  state.active = false;
  state.done = false;
  state.nextWaveAt = -1;
  state.crate = 0;
  RAID.wave = 0;
  RAID.left = 0;
}

export const raidActive = () => state.active;

// in fondo al tunnel (i = posizione tra quelli che arrivano dallo stesso lato)
const spawnPoint = (from: 'W' | 'E', i: number) => new THREE.Vector3((from === 'W' ? -1 : 1) * (31.5 - i * 1.2), 0, 0.2 + (i % 2) * 1.6);

function crash(g: Game, side: 'W' | 'E') {
  const prop = g.world.props[side === 'W' ? 'barrierW' : 'barrierE'];
  if (!prop.visible) return;
  prop.visible = false;
  const r = side === 'W' ? REFS.tunnelW : REFS.tunnelE;
  if (r) g.world.colliders.remove(r);
  const pos = new THREE.Vector3(side === 'W' ? -27 : 27, 1.2, 1);
  g.audio.barrel(pos);
  g.hud.popWord(pos, g.player.camera, 'CRASH!');
}

// Mostra i Pastelli di un'ondata all'imbocco del tunnel (non ancora all'attacco)
function place(g: Game, w: number) {
  const side = { W: 0, E: 0 };
  WAVES[w - 1].forEach((e) => {
    const i = side[e.from]++;
    const n = g.npc(e.id);
    const f = n.fighter!;
    f.reset();
    f.cover = e.cover ? new THREE.Vector3(e.cover[0], 0, e.cover[1]) : null;
    if (n.body instanceof Stickman) {
      n.body.ko = false;
      n.body.action = 'none';
    }
    n.controlled = true;
    n.ctrlSpeed = 0;
    n.pos.copy(spawnPoint(e.from, i));
    n.body.root.rotation.y = e.from === 'W' ? Math.PI / 2 : -Math.PI / 2;
    g.setHidden(n, false);
  });
}

function attack(g: Game, w: number) {
  for (const e of WAVES[w - 1]) {
    const n = g.npc(e.id);
    const go = () => {
      if (RAID.wave !== w || n.fighter!.ko || n.fighter!.hostile) return;
      g.combat.provoke(n);
      if (n.fighter!.opts.zigzag && !g.is('tutAppuntito')) {
        g.flag('tutAppuntito');
        g.toast(`Un <b>Appuntito</b> corre verso di te col temperino!<br>Sparagli prima che arrivi, oppure para (tasto destro) e colpiscilo quando è scoperto.`, 'bad', 6500);
      }
    };
    if (e.delay) g.after(e.delay, go);
    else go();
  }
}

// Il tunnel ovest salta: i primi Pastelli si affacciano (durante il dialogo dell'asta)
export function raidCrash(g: Game) {
  crash(g, 'W');
  place(g, 1);
}

export function startRaid(g: Game) {
  const A = g.world.anchors;
  state.active = true;
  RAID.wave = 1;
  RAID.left = WAVES[0].length;
  g.player.seated = false;
  g.setStep('c4', 6);
  // tre possono mirare insieme; le coperture si calcolano adesso (i venditori sono ai loro posti)
  g.combat.maxAimers = 3;
  g.combat.covers = g.combat.buildCovers((x, z) => x > -25.5 && x < 25.5 && z > -35.5 && z < 13.6);
  g.audio.playMusic('sparatoria');
  g.audio.clearEmitters();
  g.setCheckpoint(A.checkpointRaid, A.checkpointLook, 'Ti rialzi dietro le casse. I Pastelli ricominciano da capo, e anche tu');
  // pistola in mano e un minimo di cartucce: nessuno deve restare a secco
  if (g.has('pistola')) {
    g.player.setWeapon('pistol');
    const s = g.state;
    if (s.clip + s.ammo < 24) {
      s.ammo = 24 - s.clip;
      g.toast('Bossolo ti lancia una scatola di cartucce: «Offre la casa! Anzi, il mercato!»', 'reward', 4000);
      g.audio.ammo();
    }
    if (s.clip === 0) g.reload();
  }
  // civili: chi si nasconde e chi scappa
  for (const id of VENDORS) {
    const n = g.npc(id);
    n.baseAction = 'cover';
  }
  RUNNERS.forEach((id, i) => {
    const n = g.npc(id);
    n.faceWhenNear = false;
    n.baseAction = 'none';
    n.setBehavior({ type: 'patrol', path: [[i % 2 ? 1.2 : -1.2, -33], [0, -44]], speed: 6, once: true });
    n.say(['AIUTO!', 'Io non c\'ero!', 'Non sparate, sono di carta riciclata!', 'Ciao a tutti! Cioè, addio!', 'Il mio calzino!'][i], 2);
    g.after(9, () => g.setHidden(n, true));
  });
  for (const id of ['banditore', 'pneumatica']) g.setHidden(g.npc(id), true);
  const marco = g.npc('marco');
  marco.setBehavior({ type: 'patrol', path: [[A.marcoHide.x, A.marcoHide.z]], speed: 6, once: true });
  marco.baseAction = 'none';
  g.after(3, () => (marco.baseAction = 'cover'));
  // cure e cartucce sparse tra le casse
  for (const [x, z] of [[-6, 5.6], [6, 5.6], [0, -12]] as const) g.addPickup('ammo', x, z, 6);
  for (const [x, z] of [[-2, -1], [2, 12.5], [7.5, -18], [-7.5, -18]] as const) g.addPickup('heal', x, z, 25);
  // mentre il Pastello Rosso parlava, gli altri hanno già preso posizione dietro le casse
  for (const e of WAVES[0]) {
    const n = g.npc(e.id);
    const f = n.fighter!;
    if (f.cover) n.pos.copy(f.cover);
  }
  attack(g, 1);
  for (const e of WAVES[0]) {
    const f = g.npc(e.id).fighter!;
    if (f.ranged && f.cover) {
      f.state = 'hide';
      f.t = 0.8 + Math.random() * 1.5;
    }
  }
  g.toast(`<b>Sparatoria!</b><br>Accovacciati (${keyName('crouch')}) dietro le casse quando vedi una linea colorata puntata su di te. Mira alla testa.`, 'quest', 7000);
}

export function updateRaid(g: Game) {
  if (!state.active) return;
  const wave = WAVES[RAID.wave - 1];
  RAID.left = wave.filter((e) => !g.npc(e.id).fighter!.ko).length;
  if (RAID.left > 0 || state.nextWaveAt > 0) {
    if (state.nextWaveAt > 0 && g.time >= state.nextWaveAt) {
      state.nextWaveAt = -1;
      RAID.wave++;
      if (RAID.wave === 2) crash(g, 'E');
      place(g, RAID.wave);
      attack(g, RAID.wave);
      if (RAID.wave === 3) {
        g.after(3, () =>
          g.toast('Il <b>Pastellone</b> è troppo spesso per l\'inchiostro. Ma ogni tanto <b>si spunta</b> e deve temperarsi: è il momento di colpirlo.', 'info', 8000),
        );
      }
    }
    return;
  }
  // ondata finita
  if (RAID.wave < WAVES.length) {
    state.nextWaveAt = g.time + 4;
    const marco = g.npc('marco');
    marco.say(RAID.wave === 1 ? 'Finito? Dimmi che è finito.' : 'Ancora?! Quanti ne stanno in un astuccio?', 3);
    g.after(2, () => g.toast(RAID.wave === 1 ? 'Rumore di cera dal tunnel est...' : 'Qualcosa di GROSSO arriva dal tunnel ovest...', 'bad', 3500));
    return;
  }
  endRaid(g);
}

function endRaid(g: Game) {
  state.active = false;
  state.done = true;
  g.flag('raidDone');
  g.audio.playMusic('mercato');
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 1, -12), 30, 0.4);
  for (const id of VENDORS) g.npc(id).baseAction = 'none';
  g.setHidden(g.npc('banditore'), false);
  const marco = g.npc('marco');
  marco.baseAction = 'none';
  marco.setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2.6, speed: 4.4 });
  marco.say('È finita! Ho coperto le retrovie benissimo.', 4);
  g.setStep('c4', 7);
  g.after(1.5, () => g.npc('banditore').say('Psst! Sono qui! Sotto il leggio!', 4));
}

// Svenuto durante la sparatoria: l'ondata ricomincia da capo
export function raidFaint(g: Game) {
  if (!state.active) return;
  const s = g.state;
  s.ammo = Math.max(s.ammo, 24);
  s.hp = s.maxHp; // si riparte dall'ondata intera: almeno in forma
  if (RAID.left === 0) return; // tra un'ondata e l'altra: la prossima arriva comunque
  state.nextWaveAt = -1;
  const w = RAID.wave;
  place(g, w);
  g.after(2.5, () => attack(g, w));
}

// cera che cade dai Pastelli spuntati: cartucce, a volte una merendina
export function raidDrop(g: Game, n: NPC) {
  if (!n.fighter?.ranged && !n.fighter?.opts.zigzag) return;
  g.addPickup('ammo', n.pos.x + 0.4, n.pos.z, n.id === 'pastellone' ? 12 : 5);
  if (Math.random() < 0.45) g.addPickup('heal', n.pos.x - 0.4, n.pos.z + 0.3, 20);
}

// cassa di cartucce di Bossolo: durante la sparatoria è gratis (ogni tanto)
export function crateLabel(g: Game) {
  if (!state.active || !g.has('pistola')) return null;
  return g.time < state.crate ? 'Cassa di cartucce (ricarica...)' : 'Prendi cartucce (offre Bossolo)';
}

export function crateUse(g: Game) {
  if (!state.active || g.time < state.crate) return;
  state.crate = g.time + 8;
  g.addAmmo(8);
}

// Barili d'inchiostro: un colpo e SPLASH, chi è vicino finisce tinto di blu
export function setupBarrels(g: Game) {
  for (const b of REFS.barrels) {
    g.guns.targets.push({ x: b.x, z: b.z, r: 0.45, y0: 0, y1: 1.12, alive: () => b.alive, hit: () => explode(g, b) });
  }
}

function explode(g: Game, b: Barrel) {
  if (!b.alive) return;
  b.alive = false;
  b.mesh.visible = false;
  g.world.colliders.removeCircle(b.circle);
  const c = new THREE.Vector3(b.x, 0.03, b.z);
  g.audio.barrel(c);
  g.hud.popWord(c.clone().setY(1.2), g.player.camera, 'SPLASH!');
  const up = new THREE.Vector3(0, 1, 0);
  g.guns.splat(c, PLAYER_INK, up, 2.4);
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, d = 0.8 + Math.random() * 1.8;
    g.guns.splat(new THREE.Vector3(b.x + Math.cos(a) * d, 0.035 + i * 0.001, b.z + Math.sin(a) * d), PLAYER_INK, up, 0.4 + Math.random() * 0.6);
  }
  for (const n of g.npcs) {
    if (n.hidden) continue;
    const d = Math.hypot(n.pos.x - b.x, n.pos.z - b.z);
    if (d > 3.4) continue;
    if (n.fighter && !n.fighter.ko) g.combat.blast(n, n.id === 'pastellone' ? 120 : 90);
    else if (!n.fighter) n.say('Mi hai tinto di blu!', 2.5);
  }
  if (Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z) < 2.6) {
    g.hud.inkSplat(PLAYER_INK);
    g.hurt(15);
    g.toast('Ti sei inchiostrato da solo. Succede.', 'bad', 2500);
  }
}
