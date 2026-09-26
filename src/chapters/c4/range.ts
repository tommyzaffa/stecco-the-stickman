import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { REFS } from './world';
import { RECORD_TIME } from './quests';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// Il tiro a segno del Calamaio: sei sagome da colpire, due nonne da risparmiare.
// Le sagome si alzano una alla volta (al massimo due insieme) e restano su poco:
// quelle mancate tornano in fondo alla fila. Colpire una nonna costa 3 secondi.
// ---------------------------------------------------------------------------

const UP_TIME = 2.4;
const POP_EVERY = 1.1;
const NONNA_PENALTY = 3;

interface T {
  raise: number; // 0 giù, 1 su
  want: 0 | 1;
  upT: number;
  hit: boolean;
}

const R = {
  running: false,
  countdown: 0,
  t: 0,
  hits: 0,
  nonne: 0,
  queue: [] as number[],
  nextPop: 0,
  ts: [] as T[],
};

export const rangeRunning = () => R.running || R.countdown > 0;

export function setupRange(g: Game) {
  R.running = false;
  R.countdown = 0;
  R.ts = REFS.targets.map(() => ({ raise: 0, want: 0, upT: 0, hit: false }));
  REFS.targets.forEach((tg, i) => {
    g.guns.targets.push({
      x: tg.x,
      z: tg.z,
      r: 0.5,
      y0: 0.05,
      y1: 2.0,
      alive: () => R.ts[i].raise > 0.6 && !R.ts[i].hit,
      hit: () => onHit(g, i),
    });
  });
  g.addInteractable({
    pos: g.world.anchors.rangeStart,
    radius: 2.2,
    label: (g) => (g.has('pistola') && g.quest('c4') >= 2 && !rangeRunning() ? 'Inizia il tiro a segno' : null),
    use: (g) => start(g),
  });
  g.onUpdate.push((g, dt) => update(g, dt));
}

function start(g: Game) {
  const s = g.state;
  R.countdown = 2.4;
  R.t = 0;
  R.hits = 0;
  R.nonne = 0;
  R.nextPop = 0;
  R.queue = shuffle(REFS.targets.map((_, i) => i));
  // la nonna mai per prima: sarebbe cattiveria
  while (REFS.targets[R.queue[0]].kind === 'nonna') R.queue.push(R.queue.shift()!);
  for (const t of R.ts) Object.assign(t, { want: 0, upT: 0, hit: false });
  // le cartucce del poligono le offre la casa
  s.clip = g.clipSize;
  s.ammo = Math.max(s.ammo, 40);
  g.player.setWeapon('pistol');
  g.player.setLook(g.world.anchors.rangeLook);
  g.audio.gavel();
}

function onHit(g: Game, i: number) {
  const t = R.ts[i];
  if (!R.running || t.hit) return;
  t.hit = true;
  t.want = 0;
  const tg = REFS.targets[i];
  const p = new THREE.Vector3(tg.x, 1.9, tg.z);
  if (tg.kind === 'nonna') {
    R.nonne++;
    g.hud.popWord(p, g.player.camera, 'LA NONNA NO!');
    g.audio.bad();
    g.npc('calamaio').say(pick(['LA NONNA!', 'Ma è una nonna!', 'Tre secondi di penalità. E di vergogna.']), 2);
  } else {
    R.hits++;
    g.hud.popWord(p, g.player.camera, pick(['PRESO!', 'CENTRO!', 'TOC!']));
    g.audio.good();
    if (R.hits >= 6) finish(g);
  }
}

function update(g: Game, dt: number) {
  // animazione delle sagome (anche fuori dalla prova, per farle riabbassare)
  REFS.targets.forEach((tg, i) => {
    const t = R.ts[i];
    t.raise += (t.want - t.raise) * Math.min(1, dt * (t.want ? 9 : 6));
    tg.pivot.rotation.z = (1 - t.raise) * (Math.PI / 2);
  });
  const calamaio = g.npc('calamaio');
  const bubble = calamaio.pos.clone().setY(calamaio.topY + 0.3);
  if (R.countdown > 0) {
    R.countdown -= dt;
    g.worldBubble(bubble, R.countdown > 1.6 ? 'Pronti...' : R.countdown > 0.8 ? 'Partenza...' : 'VIA!');
    if (R.countdown <= 0) R.running = true;
    return;
  }
  if (!R.running) return;
  R.t += dt;
  g.worldBubble(bubble, `${(R.t + R.nonne * NONNA_PENALTY).toFixed(1)} s`);
  // sagome su: dopo un po' si riabbassano (se mancate, tornano in fila)
  let up = 0;
  REFS.targets.forEach((tg, i) => {
    const t = R.ts[i];
    if (t.want !== 1) return;
    up++;
    t.upT -= dt;
    if (t.upT <= 0) {
      t.want = 0;
      if (tg.kind === 'bad') R.queue.push(i);
    }
  });
  R.nextPop -= dt;
  if (R.nextPop <= 0 && up < 2 && R.queue.length) {
    const i = R.queue.shift()!;
    const t = R.ts[i];
    Object.assign(t, { want: 1, upT: UP_TIME, hit: false });
    R.nextPop = POP_EVERY;
    g.audio.tick();
  }
}

function finish(g: Game) {
  R.running = false;
  const time = R.t + R.nonne * NONNA_PENALTY;
  for (const t of R.ts) t.want = 0;
  const first = !g.is('rangeDone');
  const record = time < RECORD_TIME && !g.questDone('record');
  const tStr = time.toFixed(1).replace('.', ',');
  const say: string[] = [
    first ? 'Sei su sei! Promosso!' : 'Sei su sei. Il cartone ringrazia.',
    `Tempo: ${tStr} secondi${R.nonne ? `, compresi ${R.nonne * NONNA_PENALTY} di penalità` : ''}.`,
  ];
  if (R.nonne) say.push(R.nonne > 1 ? 'Hai colpito tutte e due le nonne. Non lo diranno a nessuno. Io sì.' : 'Hai colpito la nonna. Lei non lo dirà a nessuno. Io sì.');
  const d: Dialogue = { name: 'Calamaio', start: 'a', nodes: { a: { say, next: first ? 'porto' : record ? 'record' : 'altro' } } };
  d.nodes.porto = {
    say: [
      '* Il Calamaio scrive qualcosa su un foglietto, con una calligrafia bellissima.',
      '"PORTO D\'ARMI. Il portatore porta armi. Firmato: Calamaio."',
      'Ultima lezione, la più importante. Là fuori le sagome sparano.',
      'Quando qualcuno ti prende la mira vedi una linea colorata puntata su di te. Quando la vedi, abbassati dietro qualcosa.',
      `Accovacciato (${keyName('crouch')}) dietro una cassa non ti prende nessuno. In piedi e fermo ti prendono tutti. Correndo, un po' meno.`,
      'E mira alla testa: vale di più. Anche nella vita.',
    ],
    next: record ? 'record' : 'sfida',
  };
  d.nodes.sfida = {
    say: [`Se vuoi battere il record della nonna, ${RECORD_TIME} secondi, torna quando vuoi. C'è un premio.`],
    do: (g) => {
      g.flag('rangeDone');
      g.setStep('c4', 3);
      g.addXp(20);
      if (g.quest('record') === -1) g.startQuest('record');
    },
  };
  d.nodes.record = {
    say: [
      `Meno di ${RECORD_TIME} secondi?! Hai battuto la nonna!`,
      '* Il Calamaio si toglie il tappo. È il suo modo di togliersi il cappello.',
      'Tieni: caricatore grande, da dodici. E dieci monete. La nonna voleva un mazzo di fiori, ma tu sei più simpatico.',
    ],
    do: (g) => {
      if (first) {
        g.flag('rangeDone');
        g.setStep('c4', 3);
        g.addXp(20);
      }
      if (g.quest('record') === -1) g.startQuest('record');
      g.flag('caricatoreGrande');
      g.completeQuest('record');
      g.addCoins(10);
      g.addXp(30);
      g.toast('Caricatore grande: <b>12 colpi</b> invece di 8', 'reward', 4000);
    },
  };
  d.nodes.altro = {
    say: [g.questDone('record') ? 'Il record ormai è tuo. La nonna è in lutto.' : `Il record della nonna resiste: ${RECORD_TIME} secondi. Riprova quando vuoi.`],
  };
  g.after(0.6, () => g.talk(d, g.npc('calamaio')));
}

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
