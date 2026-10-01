import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue, DNode } from '../../game/dialogue';
import { TOUCH } from '../../touch';
import { parryName } from '../../settings';
import { BOOTH, updateBooth } from '../../game/booth';
import { dartsLosses, playDarts, setupDarts } from './darts';
import { Q9 } from './quests';
import { GOOD, TRAY, dropTray, goodGlasses, pickTray, placeTray, resetTray, setupTray, updateTray } from './tray';
import { BOARD, GAZ, HOMES, LOTS, OCHE, REFS9, STAGE, inPub } from './world';
import { seatedLook } from './characters';

// Capitolo 9: da Dario. Il pub → il quiz a squadre (Dario al microfono) → la Gazzosa Gigante (capogiro)
// → la finale di freccette contro Barnie → Dario chiude e racconta dei Temperini → a casa Martina,
// poi Marco, per Via del Pentagramma (e davanti ai tre lotti bianchi).

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });
const concentrati = () => `tieni premuto <b>${TOUCH ? 'PARA' : parryName()}</b>`;

export function setupStory(g: Game) {
  const A = g.world.anchors;
  Object.assign(Q9, { fizz: 0, target: 0, team: 'Gli Stecchini', score: 0, hicT: 9, inside: 0, carry: false, leaving: [], martinaIn: false, marcoIn: false });
  BOOTH.cur = null;
  BOOTH.el = null;
  setupDarts(g);
  setupTray(g, new THREE.Vector3(A.tray.x, A.tray.y, A.tray.z));
  REFS9.jukeboxGlow!.visible = false;
  g.audio.birds = false;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi davanti al pub');
  g.audio.addEmitter('crowd', new THREE.Vector3(-1, 1.5, 1), 13, 0.55);
  g.audio.addEmitter('hum', new THREE.Vector3(-3, 1, -7.6), 5, 0.6);
  if (import.meta.env.DEV) Object.assign(window, { __c9: { Q9, TRAY, BOOTH, REFS9, playDarts, sitDown, afterDarts, closing, pickTray } });

  g.addCoin(-9.3, -7.2, 'Una moneta davanti al bagno. Il bagno è disegnato: la moneta no.');
  g.addCoin(30, 9.1, 'Una moneta sul marciapiede. Qualcuno è uscito dal pub con le tasche. Che non ha.');
  g.addCoin(86, 16.8, 'Una moneta davanti ai Temperini. Almeno lei non l\'hanno cancellata.');

  // --- il tavolo della squadra: ci si siede e parte il quiz ---
  g.addInteractable({
    pos: new THREE.Vector3(A.seat.x, 1.0, A.seat.z),
    radius: 2.4,
    label: (g) => (g.quest('c9') === 1 && !g.player.seated && !TRAY.held ? 'Siediti con Marco e Martina' : null),
    use: (g) => sitDown(g),
  });
  // --- il jukebox: un pugno di lato ---
  g.addInteractable({
    pos: new THREE.Vector3(A.jukebox.x, A.jukebox.y, A.jukebox.z),
    radius: 2.3,
    label: (g) => (!g.is('c9JukeboxOk') && !TRAY.held && !g.player.seated ? 'Dai un pugno al jukebox (di lato)' : null),
    use: (g) => {
      g.player.attack();
      g.after(0.15, () => fixJukebox(g));
    },
  });
  // --- il vassoio: si prende dal bancone, si posa al tavolo ---
  g.addInteractable({
    pos: new THREE.Vector3(A.tray.x, A.tray.y, A.tray.z),
    radius: 2.4,
    label: (g) => (g.questActive('acqua') && !TRAY.held && !g.player.seated && !BOOTH.cur ? "Prendi il vassoio (tre bicchieri d'acqua)" : null),
    use: (g) => {
      pickTray(g);
      if (g.quest('acqua') === 0) g.setStep('acqua', 1, true);
      g.toast(`Piano, senza correre e senza girarti di colpo: l'acqua esce. Per stare dritto ${concentrati()}.`, 'quest', 6000);
    },
  });
  g.addInteractable({
    pos: new THREE.Vector3(A.teamTable.x, 0.8, A.teamTable.z),
    radius: 2.7,
    label: (g) => (TRAY.held ? 'Posa il vassoio sul tavolo' : null),
    use: (g) => deliverTray(g),
  });
  // --- la linea di tiro: allenamento ---
  g.addInteractable({
    pos: new THREE.Vector3(OCHE, 1.3, BOARD.z),
    radius: 2.1,
    label: (g) => (!BOOTH.cur && !TRAY.held && !g.player.seated && g.quest('c9') >= 1 && g.quest('c9') <= 2 ? 'Allenati: tre freccette' : null),
    use: (g) =>
      playDarts(g, 'practice', (pts) => {
        if (pts < 0) return;
        g.after(3.3, () => g.npc('barnie').say(pts >= 100 ? 'Mh. Bene. Mh.' : pts >= 40 ? 'Non male. Io però faccio centro.' : 'Il bersaglio è quello tondo.', 3));
      }),
  });
  // --- il tavolo in fondo: briciole rosa ---
  g.addInteractable({
    pos: new THREE.Vector3(A.tavolo7.x, 0.8, A.tavolo7.z),
    radius: 2.4,
    icon: (g) => (g.quest('fragola') === 0 ? 'clue' : null),
    label: (g) => (g.quest('fragola') <= 0 && !TRAY.held && !g.player.seated ? 'Guarda il tavolo in fondo' : null),
    use: (g) =>
      g.talk(
        narr([
          'Il tavolo in fondo, vicino al bagno. Vuoto. Sugli sgabelli nessuno si è seduto: la carta sotto è ancora liscia.',
          'Sul tavolo, briciole rosa. Tante. Come quando si cancella forte, con la gomma nuova.',
          'Profumano di fragola.',
          'E un sottobicchiere. Mezzo. Il bordo non è strappato: finisce e basta, come se l\'altra metà non fosse mai stata disegnata.',
        ]),
        null,
        () => {
          if (g.quest('fragola') === -1) g.startQuest('fragola');
          g.setStep('fragola', 1);
        },
      ),
  });

  g.onUpdate.push((g, dt) => update(g, dt));
}

export function startChapter9(g: Game) {
  if (g.quest('c9') === -1) g.startQuest('c9');
  g.audio.playMusic(g.is('c9JukeboxOk') ? 'pub' : 'pubRotto');
  g.after(0.6, () => g.chapter('CAPITOLO 9', 'Da Dario'));
  g.after(5, () => g.toast('Via del Pentagramma, di sera. Dal pub arriva musica (un po\' rigata). Marco e Martina sono già dentro.', 'info', 6000));
}

// =========================================================================
// A OGNI FRAME
// =========================================================================
function update(g: Game, dt: number) {
  const p = g.player;
  const A = g.world.anchors;
  updateBooth(g, dt);
  updateTray(g, dt);

  // il capogiro: dopo aver bevuto le bollicine salgono piano (ci vuole quasi un minuto), poi
  // scendono pianissimo (stasera non del tutto); l'acqua le fa scendere prima
  if (Q9.target > 0.25) Q9.target = Math.max(0.25, Q9.target - dt / 600);
  const dF = Q9.target - Q9.fizz;
  Q9.fizz += Math.sign(dF) * Math.min(Math.abs(dF), dt / (dF > 0 ? 70 : 30));
  p.dizzy = Q9.fizz;
  // concentrarsi (PARA tenuto): la visuale sta ferma e si va dritti (le freccette lo gestiscono da sé)
  if (!BOOTH.cur) {
    const hold = g.input.rightDown && !p.seated && !g.dialogue.isOpen && Q9.fizz > 0;
    p.steady += ((hold ? 1 : 0) - p.steady) * Math.min(1, dt * 6);
  }
  p.lurched = false;
  // singhiozzi
  if (Q9.fizz > 0.4 && !g.dialogue.isOpen) {
    Q9.hicT -= dt;
    if (Q9.hicT <= 0) {
      Q9.hicT = 8 + Math.random() * 10;
      g.audio.hic();
      p.pitch += 0.05 * (1 - 0.7 * p.steady);
    }
  }
  // la barra in alto: le bollicine (o i bicchieri sul vassoio)
  if (TRAY.held) {
    const n = goodGlasses();
    g.hud.meter({ label: `VASSOIO: ${n} ${n === 1 ? 'bicchiere pieno' : 'bicchieri pieni'} su 3`, value: TRAY.levels.reduce((s, l) => s + l, 0) / 3, color: '#4f86b8' });
  } else {
    const show = Q9.target > 0 && !BOOTH.cur && !g.is('c9Fine');
    g.hud.meter(show ? { label: 'BOLLICINE (capogiro)', value: Q9.fizz, color: '#b8942a' } : null);
  }
  // vassoio vuoto: si torna al bancone
  if (TRAY.held && goodGlasses() === 0) {
    dropTray(g);
    resetTray(new THREE.Vector3(A.tray.x, A.tray.y, A.tray.z));
    g.audio.bad();
    g.toast('Il vassoio è arrivato. L\'acqua no. Dario ha già riempito altri tre bicchieri: sono sul bancone.', 'bad', 5000);
  }

  // il pugno "vero" al jukebox (col tasto per colpire, guardandolo da vicino)
  if (!g.is('c9JukeboxOk') && g.input.clicked && !g.dialogue.isOpen && !p.seated && !p.carrying && !p.rooted && p.weapon !== 'pistol') {
    const e = p.eye, f = p.forward;
    const dx = A.jukebox.x - e.x, dz = A.jukebox.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.2 && (dx * f.x + dz * f.z) / d > 0.7) g.after(0.15, () => fixJukebox(g));
  }

  // la musica: da fuori si sente attraverso i muri
  if (!g.is('c9Notte')) g.audio.setMusicMuffle(inPub(p.pos) ? 20000 : 800);

  // entri nel pub
  if (g.quest('c9') === 0 && inPub(p.pos)) {
    g.setStep('c9', 1);
    Q9.inside = g.chapterTime;
    g.npc('marco').say('Stecco! Qui! Il tavolo della vittoria!', 3.5);
  }
  // poco dopo: Martina sente profumo di fragola (non mentre si gioca o si parla)
  if (g.quest('c9') >= 1 && g.quest('fragola') === -1 && g.chapterTime - Q9.inside > 7 && !g.dialogue.isOpen && !p.seated && !BOOTH.cur && !g.is('c9Chiuso')) {
    g.npc('martina').say('Senti anche tu? Profumo di fragola. Viene dal tavolo in fondo, vicino al bagno.', 4.5);
    g.startQuest('fragola');
  }

  // Dario porta la Gazzosa Gigante (la spinge accanto a sé); arrivato, la posa
  if (Q9.carry) {
    const d = g.npc('dario');
    REFS9.gazzosa!.position.set(d.pos.x + GAZ.x - A.darioGaz.x, 0, d.pos.z + GAZ.z - A.darioGaz.z);
    if (Math.hypot(d.pos.x - A.darioGaz.x, d.pos.z - A.darioGaz.z) < 0.15) placeBottle(g);
  }
  // i clienti escono dalla porta, e fuori spariscono (vanno a casa)
  for (const id of Q9.leaving) {
    const n = g.npc(id);
    if (!n.hidden && n.pos.z > 11.5) g.setHidden(n, true);
  }
  // Martina entra in casa: arrivata alla porta sparisce dentro; poi si accende la sua finestra
  if (Q9.martinaIn) {
    const m = g.npc('martina');
    if (!m.hidden && m.pos.z > HOMES.martina.z - 0.3) martinaInside(g);
  }
  if (REFS9.tappo!.visible) REFS9.tappo!.position.x = 51.8 + Math.sin(g.time * 3.2) * 0.28;
  // Marco e la mamma entrano: la porta si chiude dietro di loro
  if (Q9.marcoIn) {
    for (const id of ['marco', 'mamma']) {
      const n = g.npc(id);
      if (!n.hidden && n.pos.z < HOMES.marco.z + 0.25) g.setHidden(n, true);
    }
    if (g.npc('marco').hidden && g.npc('mamma').hidden) {
      Q9.marcoIn = false;
      g.audio.door();
    }
  }

  // i due della squadra, a piedi: ondeggiano (e vanno un po' a zig-zag)
  for (const id of ['marco', 'martina']) {
    const n = g.npc(id);
    if (n.hidden || n.behavior.type !== 'follow') continue;
    const k = Math.sin(g.time * (id === 'marco' ? 1.3 : 1.05) + (id === 'marco' ? 0 : 2)) * 0.5 * dt;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    n.pos.x += -fz * k;
    n.pos.z += fx * k;
  }

  // fuori dal pub, a fine serata: la ninna nanna
  if (g.is('c9Chiuso') && !inPub(p.pos) && !g.is('c9Notte')) {
    g.flag('c9Notte');
    g.audio.setMusicMuffle(20000);
    g.audio.playMusic('notte');
    g.after(1.5, () => g.npc('marco').say('Che bella la notte. È tutta a righe. Come un quaderno a letto.', 4));
  }
  if (g.dialogue.isOpen) return;
  const near = (v: THREE.Vector3, r: number) => Math.hypot(p.pos.x - v.x, p.pos.z - v.z) < r;
  const withMe = (id: string) => {
    const n = g.npc(id);
    return !n.hidden && Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z) < 7;
  };
  // a casa di Martina: lei va al portone (il dialogo non la ferma: cammina mentre parla)
  if (g.quest('c9') === 3 && !g.is('c9MartinaCasa') && near(HOMES.martina, 5.5) && withMe('martina')) {
    g.flag('c9MartinaCasa');
    const m = g.npc('martina');
    m.setBehavior({ type: 'patrol', path: [[A.martinaDoor.x, A.martinaDoor.z]], speed: 1.3, once: true });
    g.talk(martinaHome(), null);
  }
  // i Temperini (solo con Marco)
  if (g.quest('c9') === 4 && !g.is('c9Temperini') && p.pos.x > LOTS.x0 + 3 && withMe('marco')) {
    g.flag('c9Temperini');
    g.talk(temperini(), g.npc('marco'));
  }
  // a casa di Marco: la mamma apre la porta (era sveglia: la luce è accesa), Marco le va incontro
  if (g.quest('c9') === 4 && !g.is('c9MarcoCasa') && near(HOMES.marco, 5.8) && withMe('marco')) {
    g.flag('c9MarcoCasa');
    const mm = g.npc('mamma');
    g.setHidden(mm, false);
    mm.pos.set(A.mamma.x - 0.3, 0, HOMES.marco.z + 0.35);
    mm.setBehavior({ type: 'patrol', path: [[A.mamma.x - 0.3, A.mamma.z]], speed: 1, once: true });
    g.audio.door();
    const marco = g.npc('marco');
    marco.setBehavior({ type: 'patrol', path: [[A.mamma.x + 0.7, A.mamma.z + 0.5]], speed: 1.3, once: true });
    g.talk(marcoHome(), null);
  }
  // fine
  if (g.is('c9Fine') && !g.is('c9Via')) {
    g.flag('c9Via');
    g.after(2.5, () => {
      g.completeQuest('c9');
      g.fade(true);
      g.after(1.3, () =>
        g.completeChapter('Prossimamente: Il condominio. Un pacco finito al piano sbagliato, di notte: pavimenti di carta che scricchiolano, vicini che dormono. Non svegliare nessuno.'),
      );
    });
  }
}

// =========================================================================
// IL JUKEBOX
// =========================================================================
function fixJukebox(g: Game) {
  if (g.is('c9JukeboxOk')) return;
  g.flag('c9JukeboxOk');
  g.audio.hit('fist');
  g.audio.scratch();
  REFS9.jukeboxGlow!.visible = true;
  g.hud.popWord(new THREE.Vector3(g.world.anchors.jukebox.x, 1.4, g.world.anchors.jukebox.z), g.player.camera, 'SBONK!');
  if (!g.is('c9Chiuso')) g.after(0.6, () => g.audio.playMusic('pub'));
  if (g.quest('jukebox') === -1) g.startQuest('jukebox');
  g.addXp(30);
  g.addCoins(10);
  g.completeQuest('jukebox');
  g.after(1.2, () => g.npc('righetti').say('La musica! E il mio pacifismo è salvo: il pugno l\'hai dato tu.', 4));
}

// =========================================================================
// IL VASSOIO
// =========================================================================
export function startWater(g: Game) {
  if (g.quest('acqua') === -1) g.startQuest('acqua');
}

function deliverTray(g: Game) {
  const n = goodGlasses();
  const levels = TRAY.levels.slice();
  dropTray(g);
  const A = g.world.anchors;
  if (n === 0) {
    resetTray(new THREE.Vector3(A.tray.x, A.tray.y, A.tray.z));
    return;
  }
  // il vassoio resta sul tavolo, coi bicchieri com'erano arrivati
  placeTray(new THREE.Vector3(A.teamTable.x + 0.1, 0.795, A.teamTable.z - 0.15), levels);
  const perfect = levels.every((l) => l >= GOOD);
  g.talk(
    {
      name: 'Martina',
      start: 'a',
      nodes: {
        a: {
          say: [
            n === 3 ? '* Posi il vassoio sul tavolo. Tre bicchieri, tre pieni. Nemmeno una goccia sul pavimento a righe.' : `* Posi il vassoio sul tavolo. ${n === 1 ? 'Un bicchiere pieno' : 'Due bicchieri pieni'}, il resto è sul pavimento. Il pavimento ringrazia.`,
            'Acqua! Stecco, sei un cameriere nato. Senza mani, poi.',
            '@Marco| Acqua? Io volevo la gazzosa. ...No, hai ragione. Acqua.',
          ],
          next: 'bevete',
        },
        bevete: {
          do: (g) => {
            // si beve: i bicchieri si svuotano, le bollicine scendono (piano)
            placeTray(new THREE.Vector3(A.teamTable.x + 0.1, 0.795, A.teamTable.z - 0.15), [0, 0, 0]);
            Q9.target = Math.max(0.2, Q9.target - 0.1 * n);
            g.audio.glug(n);
            for (const id of ['marco', 'martina']) g.npc(id).baseAction = 'drink';
            g.after(2.5, () => {
              for (const id of ['marco', 'martina']) g.npc(id).baseAction = g.is('c9Gazzosa') ? 'tipsy' : 'none';
            });
          },
          say: ['* Bevete. Le bollicine scendono un po\'. Il pub gira meno. Gira ancora, ma più educato.'],
          next: 'fine',
        },
        fine: {
          say: [],
          do: (g) => {
            g.hud.meterPop(`-${n * 10}% bollicine`, true);
            g.addXp(20 + n * 10);
            g.addCoins(n * 3);
            g.completeQuest('acqua');
            if (perfect) g.flag('c9VassoioPerfetto');
          },
        },
      },
    },
    g.npc('martina'),
  );
}

// =========================================================================
// IL QUIZ (seduti al tavolo della squadra, Dario al microfono)
// =========================================================================
export function sitDown(g: Game) {
  const A = g.world.anchors;
  const p = g.player;
  g.fade(true);
  g.after(0.8, () => {
    p.pos.set(A.seat.x, A.seat.y, A.seat.z);
    p.floor = A.seat.y;
    p.seated = true;
    p.setCrouch(false);
    p.setWeapon('fist');
    // Dario sale sul palco, dietro l'asta del microfono; tutti si girano verso di lui
    const d = g.npc('dario');
    d.pos.set(A.darioMic.x, A.darioMic.y, A.darioMic.z);
    d.setBehavior({ type: 'stand' });
    d.homeRot = Math.atan2(A.teamTable.x - d.pos.x, A.teamTable.z - d.pos.z) * 0.4;
    d.body.root.rotation.y = d.homeRot;
    d.faceWhenNear = false;
    seatedLook(g, 'stage');
    p.setLook(new THREE.Vector3(A.mic.x, A.mic.y, A.mic.z));
    g.setCheckpoint(A.seat, A.mic, 'Ti rialzi vicino al tavolo');
    g.fade(false);
    g.after(1.0, () => g.talk(quiz(), d, () => g.talk(gazzosa(), d, () => standUp(g))));
  });
}

function standUp(g: Game) {
  const p = g.player;
  p.seated = false;
  p.floor = 0;
  g.setStep('c9', 2);
  seatedLook(g, 'table');
  // Dario torna dietro il bancone (dal fondo, passando accanto al palco)
  const d = g.npc('dario');
  const A = g.world.anchors;
  d.pos.y = 0;
  d.setBehavior({ type: 'patrol', path: [[2.5, -6.9], [A.dario.x, A.dario.z]], speed: 2.4, once: true });
  g.after(9, () => {
    d.pos.set(A.dario.x, 0, A.dario.z);
    d.homeRot = 0;
    d.faceWhenNear = true;
    d.setBehavior({ type: 'stand' });
  });
  g.after(1.5, () => g.npc('barnie').say('Freccette! Stecco, vieni. Il bersaglio ti aspetta. Anch\'io, ma meno.', 4));
}

const ding = (g: Game) => {
  Q9.score++;
  g.audio.ding(true);
};
const buzz = (g: Game) => g.audio.bad();

// una domanda: righe di Dario (e dei compagni), risposte, e cosa succede se non rispondi (risponde Marco)
function question(id: string, next: string, q: { say: string[]; choices: [string, boolean][]; yes: string[]; no: string[]; marco: string[]; marcoRight?: boolean; noDo?: (g: Game) => void }) {
  const nodes: Record<string, DNode> = {
    [id]: {
      say: q.say,
      timer: 10,
      timeout: `${id}t`,
      choices: q.choices.map(([t, ok]) => ({ t, next: ok ? `${id}si` : `${id}no` })),
    },
    [`${id}si`]: { do: ding, say: q.yes, next },
    [`${id}no`]: {
      do: (g) => {
        buzz(g);
        q.noDo?.(g);
      },
      say: q.no,
      next,
    },
    [`${id}t`]: {
      do: q.marcoRight ? ding : buzz,
      say: q.marco,
      next,
    },
  };
  return nodes;
}

function quiz(): Dialogue {
  const team = () => `"${Q9.team}"`;
  const name = (t: string) => (g: Game) => {
    Q9.team = t;
    g.audio.select();
  };
  return {
    name: 'Dario',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* Dario batte sul microfono. TOC, TOC. Il pub si zittisce. Il jukebox no.',
          'Buonasera, San Scarabocchio! Il quiz della serata! Tre squadre, cinque domande, un premio.',
          'Prima squadra: le Biro Blu. Nome?',
          '@Ispettore Penna| "Verbale Unico". Presenti. Verbalizzato.',
          'Seconda squadra: i Pastelli a Cera.',
          '@Pastello Rosso| "I TEMPERATI"! APPUNTITI!',
          'E la terza squadra: il tavolo sotto il palco. Come vi chiamate?',
          '@Marco| Un attimo! Abbiamo tre nomi. Decide Stecco.',
        ],
        choices: [
          { t: '"Gli Stecchini."', do: name('Gli Stecchini'), next: 'stecchini' },
          { t: '"Marco e gli altri due."', do: name('Marco e gli altri due'), next: 'marcoAltri' },
          { t: '"I Tappi."', do: name('I Tappi'), next: 'tappi' },
        ],
      },
      stecchini: { say: ['@Marco| Il mio preferito! Cioè, erano tutti miei.'], next: 'regole' },
      marcoAltri: { say: ['@Martina| Stecco. Davvero?', '@Marco| È il nome più bello del mondo. L\'ho pensato io.'], next: 'regole' },
      tappi: { say: ['@Martina| I Tappi! Stecco, ti adoro. Cioè: adoro il nome.'], next: 'regole' },
      regole: {
        say: [
          (_g) => `${team()}. Scritto. Con la penna dell'Ispettore, che me la sono fatta prestare con un modulo.`,
          'Le regole: dieci secondi per rispondere. Se non rispondete, vale la prima cosa che urla qualcuno del tavolo.',
          '@Martina| Cioè Marco.',
          'Cioè Marco. Si comincia!',
        ],
        next: 'q1',
      },
      ...question('q1', 'q2', {
        say: [
          'Prima domanda. Quanti abitanti ha San Scarabocchio?',
          '@Marco| Quarantotto! Contando me due volte: io valgo doppio.',
          '@Martina| Quarantasette. Lo dice il cartello all\'ingresso del paese.',
        ],
        choices: [['Quarantasei.', false], ['Quarantasette.', true], ['Quarantotto.', false]],
        yes: ['Quarantasette! Giusto. Un punto!'],
        no: ['No! Quarantasette. Lo dice il cartello, e il cartello non sbaglia: l\'ha scritto il Sindaco. Col righello.'],
        marco: ['@Marco| QUARANTOTTO!', 'Quarantotto? No: quarantasette. Marco, tu vali uno. Come tutti.'],
      }),
      ...question('q2', 'q3', {
        say: [
          'Seconda domanda. Quanti litri tiene la Gazzosa Gigante?',
          '@Marco| Dipende dalla cannuccia!',
          '@Martina| Tre. C\'è scritto sulla lavagna: "tre litri, una cannuccia".',
        ],
        choices: [['Uno.', false], ['Tre.', true], ['Dipende dalla cannuccia.', false]],
        yes: ['Tre! Tre litri, una cannuccia. Punto!'],
        no: ['Tre litri! È sulla lavagna da quando ho aperto. Leggete le lavagne, ragazzi. Sono lì per quello.'],
        marco: ['@Marco| DIPENDE DALLA CANNUCCIA!', 'No, Marco. Dipendono tre litri da una cannuccia. È diverso.'],
      }),
      ...question('q3', 'q4', {
        say: [
          'Terza domanda. Facile. Quanti zampilli ha la fontana della piazza?',
          '@Martina| Tre. L\'abbiamo vista oggi, alla sagra.',
          '@Marco| Tre. Sempre stati tre.',
          '* Tu ne ricordi quattro. Li ricordi benissimo: quattro.',
        ],
        choices: [['Tre.', true], ['Quattro.', false]],
        yes: ['Tre! Giusto. Tre zampilli, da sempre.', '* Da sempre. Lo dicono tutti. Anche tu, adesso.'],
        no: [
          'Quattro?',
          '* Il pub si zittisce. Anche il jukebox, per un attimo.',
          '* Dario ti guarda. Un secondo di troppo.',
          'No. Tre. Sul cartoncino c\'è scritto tre.',
          '@Ispettore Penna| Tre. Da sempre. Verbalizzato.',
        ],
        noDo: (g) => g.flag('quattroZampilli'),
        marco: ['@Marco| TRE!', 'Tre! Giusto. Marco ha preso un punto. Segnatevelo: succede.'],
        marcoRight: true,
      }),
      ...question('q4', 'q5', {
        say: [
          'Quarta domanda. Cosa NON ha un omino stilizzato?',
          '@Marco| Le tasche! Per questo perdo sempre le chiavi.',
          '@Martina| Le mani. Ma anche le tasche. E i colori. Ehm.',
        ],
        choices: [['Le mani.', false], ['Le tasche.', false], ['I colori.', false], ['Tutte e tre.', true]],
        yes: ['Tutte e tre! Niente mani, niente tasche, niente colori. Siamo gente semplice. Punto!'],
        no: ['No: tutte e tre. Niente mani, niente tasche, niente colori. Siamo gente semplice.'],
        marco: ['@Marco| LE TASCHE!', 'Anche. Ma anche le mani e i colori. Tutte e tre. Niente punto.'],
      }),
      ...question('q5', 'conta', {
        say: [
          'Ultima domanda. La più difficile. Chi ha disegnato San Scarabocchio?',
          '@Marco| Il Sindaco! Lo dice sempre lui, nei discorsi.',
          '@Martina| Non lo sa nessuno. Però ci sarà una risposta sul cartoncino, no?',
        ],
        choices: [['Il Sindaco.', false], ['L\'Autore.', true], ['Nessuno: c\'era già.', false]],
        yes: ['L\'Autore! Giusto. Sul cartoncino c\'è scritto "L\'Autore". E sotto, a matita, piccolo: "quello che ha finito la matita".', '* Nessuno ride. Poi ridono tutti, un po\' in ritardo.'],
        no: ['No. Sul cartoncino c\'è scritto "L\'Autore". E sotto, a matita, piccolo: "quello che ha finito la matita". Chi l\'ha scritto? Non io.'],
        marco: ['@Marco| IL SINDACO!', '@Il Sindaco| (da fuori, dalla finestra) GRAZIE!', 'No. L\'Autore. E il Sindaco non è neanche qui.'],
      }),
      conta: {
        say: [
          '* Dario conta i punti. Con le dita. Non ha le dita: ci mette un po\'.',
          '"I Temperati": due punti. Hanno risposto "blu" a tutto.',
          '@Pastello Giallo| Il blu funziona!',
          '"Verbale Unico": quattro punti.',
          (_g) => `${team()}: ${Q9.score} ${Q9.score === 1 ? 'punto' : 'punti'}.`,
        ],
        next: () => (Q9.score >= 5 ? 'vinto' : Q9.score === 4 ? 'pari' : 'perso'),
      },
      vinto: {
        say: [
          (_g) => `Vince ${team()}! Cinque su cinque!`,
          '@Ispettore Penna| Ricorso! ...No. Niente ricorso. È tutto regolare. Purtroppo.',
          '@Marco| Abbiamo vinto! Io ho vinto! Cioè: noi. Cioè: io, un po\'.',
        ],
        do: (g) => {
          g.flag('c9Quiz');
          g.flag('c9QuizVinto');
          g.addXp(60);
          g.addCoins(15);
        },
      },
      pari: {
        say: [
          (_g) => `Pareggio! Quattro a quattro tra "Verbale Unico" e ${team()}!`,
          '@Ispettore Penna| Regolamento del quiz, articolo tre: a parità di punti vince la calligrafia migliore.',
          '@Pennino| Abbiamo la calligrafia migliore. Abbiamo solo quella.',
          'Vince "Verbale Unico". Mi dispiace. Il regolamento l\'hanno scritto loro.',
          (g) =>
            g.is('quattroZampilli')
              ? '@Martina| Se dicevi tre, vincevamo. ...Però li ricordi quattro. Lo so. Te lo leggo in faccia.'
              : '@Marco| Calligrafia! Io scrivo malissimo! È colpa mia! Cioè, di chi ha disegnato la mia mano. Che non c\'è.',
        ],
        do: (g) => {
          g.flag('c9Quiz');
          g.addXp(35);
        },
      },
      perso: {
        say: [
          'Vince "Verbale Unico"! Come l\'anno scorso. E quello prima.',
          '@Marco| Abbiamo perso con dignità.',
          '@Martina| Abbiamo perso e basta, Marco.',
        ],
        do: (g) => {
          g.flag('c9Quiz');
          g.addXp(25);
        },
      },
    },
  };
}

// =========================================================================
// LA GAZZOSA GIGANTE (tre litri, una cannuccia)
// =========================================================================
function gazzosa(): Dialogue {
  // quanta gazzosa resta nella bottiglia (0..1)
  const level = (k: number) => (REFS9.gazLiquid!.scale.y = Math.max(0.02, 1.38 * k));
  const drinker = (id: string, on: boolean) => (g: Game) => (g.npc(id).baseAction = on ? 'drink' : 'none');
  const sip = (v: number, left: number) => (g: Game) => {
    Q9.target = v;
    level(left);
    g.audio.glug(v > 0.8 ? 6 : v > 0.5 ? 4 : 2);
  };
  return {
    name: 'Dario',
    start: 'a',
    nodes: {
      a: {
        do: (g) => {
          // Dario scende dal palco e va a prendere la bottiglia: la porta accanto a sé fino al tavolo
          const d = g.npc('dario');
          const A = g.world.anchors;
          d.pos.y = 0;
          d.setBehavior({ type: 'patrol', path: [[STAGE.x - 1.3, STAGE.z + 1.4], [A.darioGaz.x, A.darioGaz.z]], speed: 2.2, once: true });
          REFS9.gazzosa!.visible = true;
          level(1);
          Q9.carry = true;
        },
        say: [
          'E adesso, la tradizione della casa.',
          (g) => (g.is('c9QuizVinto') ? 'Il premio per i vincitori: la Gazzosa Gigante! Ve la porto io.' : 'Il premio di consolazione per il tavolo sotto il palco: la Gazzosa Gigante! Da Dario non perde nessuno. Si perde e basta, ma con le bollicine.'),
          '@Marco| Arriva! Arriva!',
        ],
        next: 'arriva',
      },
      arriva: {
        do: (g) => placeBottle(g),
        look: () => new THREE.Vector3(GAZ.x, 1.4, GAZ.z),
        say: [
          '* Dario arriva spingendo una bottiglia più alta di Pennino. Sull\'etichetta c\'è scritto "3 litri". L\'etichetta mente.',
          '* Una cannuccia sola, lunga, rossa, a zig-zag, arriva fino al centro del tavolo.',
          'Tre litri, una cannuccia. Nessun rimpianto. Qualche singhiozzo.',
          '@Marco| Prima io! Sono il capitano!',
          '@Martina| Non abbiamo un capitano.',
          '@Marco| Adesso sì.',
        ],
        next: 'marco',
      },
      marco: {
        do: (g) => {
          drinker('marco', true)(g);
          level(0.8);
          g.audio.glug(5);
        },
        look: () => new THREE.Vector3(GAZ.x, 1.4, GAZ.z),
        say: ['* Marco beve. Tanto. La gazzosa nella bottiglia scende di un palmo.'],
        next: 'martina',
      },
      martina: {
        do: (g) => {
          drinker('marco', false)(g);
          drinker('martina', true)(g);
          level(0.68);
          g.audio.glug(3);
        },
        say: ['* Poi Martina: un sorso educato. Poi due. Poi tre.', '@Martina| È buonissima. È pericolosa. È buonissima.'],
        next: 'tu',
      },
      tu: {
        do: drinker('martina', false),
        say: ['* Tocca a te. La cannuccia ti guarda.'],
        choices: [
          { t: 'Un sorso. Educato.', do: sip(0.35, 0.62), next: 'poco' },
          { t: 'Mezzo litro. Sportivo.', do: sip(0.6, 0.45), next: 'medio' },
          { t: 'Tutto quello che resta.', do: sip(0.85, 0.02), next: 'tanto' },
        ],
      },
      poco: {
        say: ['* Un sorso. Frizzante, dolce, niente di che.', '@Marco| Un sorso? UN SORSO? Allora finisco io.'],
        next: 'finisce',
      },
      medio: {
        say: ['* Mezzo litro. Frizzante, dolce. Per ora non succede niente.', '@Marco| Sportivo! Il resto è mio.'],
        next: 'finisce',
      },
      finisce: {
        do: (g) => {
          drinker('marco', true)(g);
          level(0.02);
          g.audio.glug(6);
        },
        look: () => new THREE.Vector3(GAZ.x, 1.2, GAZ.z),
        say: ['* Marco finisce la bottiglia. Tutta. La bottiglia fa un rumore di bottiglia vuota.'],
        next: 'dopo',
      },
      tanto: {
        say: ['* Bevi tutto quello che resta. Un litro e mezzo. Di cannuccia.', '* La bottiglia fa uno sbuffo, come un applauso.', '@Marco| Stecco... sei il mio eroe. Però io non avevo finito.', '@Martina| Stecco! Oddio.'],
        next: 'dopo',
      },
      dopo: {
        do: (g) => {
          drinker('marco', false)(g);
          g.flag('c9Gazzosa');
          // le bollicine arrivano anche a loro, piano
          g.after(25, () => {
            for (const id of ['marco', 'martina']) if (g.npc(id).baseAction === 'none') g.npc(id).baseAction = 'tipsy';
          });
        },
        say: [
          '* Per un attimo non succede niente.',
          '* Poi le bollicine cominciano a salire. Piano. Tra un po\' le righe della carta si metteranno a ondeggiare. Prima un pochino, poi di più.',
          (_g) => `* Quando ti girerà la testa: tieni premuto ${TOUCH ? 'PARA' : parryName()} per concentrarti. Vai più piano, ma dritto.`,
          '@Barnie| Finale di freccette. Io contro tutti. Quando vuoi.',
        ],
        next: 'fine',
      },
      fine: { say: [], do: (g) => g.addXp(20) },
    },
  };
}

// la bottiglia arriva accanto al tavolo (anche se chi legge è stato più veloce di Dario)
function placeBottle(g: Game) {
  const A = g.world.anchors;
  const d = g.npc('dario');
  if (Q9.carry) {
    Q9.carry = false;
    d.pos.set(A.darioGaz.x, 0, A.darioGaz.z);
    d.setBehavior({ type: 'stand' });
    d.homeRot = Math.atan2(A.teamTable.x - d.pos.x, A.teamTable.z - d.pos.z);
    REFS9.gazzosa!.position.set(GAZ.x, 0, GAZ.z);
    g.world.colliders.circle(GAZ.x, GAZ.z, GAZ.r + 0.05);
    g.audio.fizz(1.4);
  }
}

// =========================================================================
// LE FRECCETTE: com'è andata
// =========================================================================
export function afterDarts(g: Game, r: number) {
  if (r < 0) return;
  if (r === 1) {
    g.after(3.4, () => g.talk(barnieWin(), g.npc('barnie'), () => g.after(1.2, () => closing(g))));
    return;
  }
  g.after(3.4, () => {
    g.npc('barnie').say(pickLine(['Ho vinto. Scusa. Rivincita quando vuoi.', 'Ancora io. Il centro mi vuole bene. Rivincita?', 'Vinto. Sono stanco però. Rivincita?']), 4);
    if (dartsLosses() === 1) {
      g.toast(
        `Barnie comincia a stancarsi: alla rivincita tirerà peggio. Trattieni il fiato (${concentrati()}) e tira quando la visuale è ferma.${g.questDone('acqua') ? '' : " E un po' d'acqua aiuta: chiedi a Dario."}`,
        'quest',
        7000,
      );
    }
  });
}

const pickLine = (a: string[]) => a[Math.floor(Math.random() * a.length)];

function barnieWin(): Dialogue {
  return {
    name: 'Barnie',
    start: 'a',
    nodes: {
      a: {
        do: (g) => {
          // festa: Marco balla in piedi sullo sgabello, Martina sbraccia
          const m = g.npc('marco');
          m.setBehavior({ type: 'stand' });
          m.pos.y = 0.28;
          m.baseAction = 'dance';
          g.npc('martina').baseAction = 'wave';
          g.audio.tokens(6);
        },
        say: [
          'Hai vinto.',
          '* Il pub esplode. Marco sale in piedi sullo sgabello e balla. Martina agita le braccia come se chiamasse un taxi.',
          'Undici serate. Poi tu. Col capogiro.',
          'Tieni: il Sottobicchiere d\'Oro. Tienilo lontano dall\'acqua: è di cartone.',
          (g) => (g.has('freccetta') ? 'E la freccetta tienila. Sa la strada. Adesso la sai anche tu.' : 'Domani mi alleno. Dopodomani lo rivinco. Oggi però è tuo.'),
        ],
        next: 'premio',
      },
      premio: {
        say: [],
        do: (g) => {
          g.give('sottobicchiereOro');
          g.flag('c9Barnie');
          g.addXp(80);
          g.addCoins(20);
        },
      },
    },
  };
}

// Dario chiude, e racconta dei Temperini
export function closing(g: Game) {
  const d = g.npc('dario');
  g.talk(
    {
      name: 'Dario',
      start: 'a',
      nodes: {
        a: {
          say: [
            '* Dario batte due volte sul bancone. TOC, TOC.',
            'Si chiude! Si chiude, gente. Le Biro Blu, fuori. I Temperati, fuori. Barnie... Barnie resta, Barnie è l\'arredamento.',
          ],
          next: 'b',
        },
        b: {
          do: (g) => customersLeave(g),
          say: [
            '* Le Biro Blu si alzano ed escono in fila per due. I Pastelli escono in fila per colore. Il signor Righetti esce per ultimo, piano.',
            'Stecco. Aspetta. Te lo dico perché tu mi sembri uno che ascolta.',
            'Stamattina ho portato le casse di gazzosa in Via dei Temperini. Numero 4, 6 e 8. Come ogni martedì.',
            'Le case non c\'erano più. Né le case, né i giardini. Solo i pali coi numeri. E dietro, bianco.',
            'Ho chiesto in giro. Tutti mi rispondono: "Temperini 4? Ma lì non c\'è mai stato niente".',
            (g) =>
              g.is('quattroZampilli')
                ? 'Tu al quiz hai detto quattro zampilli. Te lo dico piano: anch\'io me li ricordo quattro.'
                : 'Tu te le ricordi, le cose che spariscono? Io sì. È una condanna. Come ricordarsi i debiti degli altri.',
            (g) => (g.has('mezzoSottobicchiere') ? '> La signora alla fragola. Quella del tavolo in fondo.' : '> Chi è stato?'),
            (g) =>
              g.has('mezzoSottobicchiere')
                ? 'Lei. Mi ha chiesto la strada per i Temperini. E io gliel\'ho data. Io.'
                : 'Non lo so. Stasera al tavolo in fondo c\'era una cliente nuova. Profumava di fragola. E mi ha chiesto dei Temperini.',
            'Passate di là, tornando. Guardate. E poi ditemi che sono io quello che ha bevuto troppa gazzosa.',
            'Adesso vai: riporta a casa quei due. Prima la signorina, poi Marco. Casa sua è di là dal canale.',
          ],
          next: 'fine',
        },
        fine: {
          say: [],
          do: (g) => {
            g.flag('c9Chiuso');
            g.addXp(30);
            leavePub(g);
          },
        },
      },
    },
    d,
  );
}

// a fine serata i clienti si alzano ed escono dalla porta (fuori spariscono: vanno a casa)
function customersLeave(g: Game) {
  const out: [string, [number, number][]][] = [
    ['penna', [[5.2, 7.1]]],
    ['pennino', [[5.2, 7.1]]],
    ['pBlu', [[-6.5, 7.3], [5.2, 7.3]]],
    ['pGiallo', [[-5, 7.3], [5.2, 7.3]]],
    ['pRosso', [[-7.5, 7.3], [5.2, 7.3]]],
    ['righetti', [[-2, 0.2], [3.3, 3.9], [5.2, 7.1]]],
  ];
  out.forEach(([id, path], i) =>
    g.after(0.2 + i * 0.7, () => {
      const n = g.npc(id);
      if (n.hidden) return;
      n.pos.y = 0;
      n.baseAction = 'none';
      n.setBehavior({ type: 'patrol', path: [...path, [6, 8], [6 + (i % 3) * 0.4 - 0.4, 10], [4 + i * 1.5, 13]], speed: 1.7, once: true });
      Q9.leaving.push(id);
    }),
  );
}

function leavePub(g: Game) {
  // chi non è ancora uscito (se hai letto più in fretta di loro) esce adesso
  for (const id of ['penna', 'pennino', 'pRosso', 'pGiallo', 'pBlu', 'righetti']) if (!Q9.leaving.includes(id)) g.setHidden(g.npc(id), true);
  g.after(0.5, () => {
    g.setStep('c9', 3);
    const p = g.player;
    const follow = (id: string, dist: number, speed: number) => {
      const n = g.npc(id);
      n.pos.y = 0;
      n.setBehavior({ type: 'follow', target: () => p.pos, dist, speed });
      n.baseAction = 'tipsy';
    };
    follow('martina', 1.8, 3.9);
    follow('marco', 2.8, 3.9);
    const A = g.world.anchors;
    g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi davanti al pub. Marco e Martina ti aspettano (ondeggiando).');
    g.after(1.5, () => g.npc('martina').say('Si va? Si va. Il pavimento viene con noi?', 3.5));
  });
}

// =========================================================================
// A CASA
// =========================================================================
function martinaHome(): Dialogue {
  return {
    name: 'Martina',
    start: 'a',
    nodes: {
      a: {
        say: [
          'Eccola. Casa mia. Quella coi tappi in finestra.',
          '* Martina arriva al portone e ci si appoggia. Il portone la tiene su, gentile.',
          'Stasera mi sono divertita. Il quiz, la gazzosa, tu contro Barnie.',
          (g) => (g.is('c9Barnie') ? 'Hai battuto un gigante. Col capogiro. Lo racconto alla mia collezione: i tappi adorano le storie.' : 'Anche Marco si è divertito. Lo si capisce da come cammina.'),
          'Stecco. Da camera mia si vedono i Temperini. Le finestre accese, la sera. Mi facevano compagnia.',
        ],
        next: 'est',
      },
      est: {
        // si gira verso est, dove c'erano le case (e ci guardi anche tu)
        do: (g) => {
          const m = g.npc('martina');
          m.setBehavior({ type: 'stand' });
          m.faceWhenNear = false;
          m.homeRot = Math.PI / 2;
        },
        look: () => new THREE.Vector3(LOTS.x0 + 6, 3, 4),
        say: ['* Martina guarda verso est, oltre i tetti. Laggiù, dove c\'erano le finestre, non c\'è buio. C\'è bianco.', 'Stasera non le vedo. Sarà la gazzosa.'],
        choices: [
          { t: 'Sarà la gazzosa.', next: 'gazzosa' },
          { t: 'Non è la gazzosa. Sono sparite.', next: 'sparite' },
        ],
      },
      gazzosa: {
        do: (g) => (g.npc('martina').faceWhenNear = true),
        say: ['Sì. Sarà la gazzosa. Buonanotte, Stecco.'],
        next: 'entra',
      },
      sparite: {
        do: (g) => {
          g.npc('martina').faceWhenNear = true;
          g.flag('martinaSa');
        },
        say: ['Sparite. Come la panchina di Arturo. Come il vicolo di Nonna Pina.', 'Domani ne parliamo. Da sgasati.', 'Buonanotte, Stecco.'],
        next: 'entra',
      },
      entra: {
        // apre il portone ed entra (sparisce quando ci arriva: vedi update)
        do: (g) => {
          const m = g.npc('martina');
          m.faceWhenNear = false;
          m.setBehavior({ type: 'patrol', path: [[HOMES.martina.x, HOMES.martina.z]], speed: 1, once: true });
          Q9.martinaIn = true;
        },
        say: ['* Martina apre il portone ed entra. Il portone si richiude piano, dietro di lei.'],
        next: 'finestra',
      },
      finestra: {
        do: (g) => martinaInside(g, true),
        look: () => new THREE.Vector3(51.8, 4.6, 18.2),
        say: ['* Al primo piano si accende una finestra. Un tappo giallo ti saluta, di qua e di là: è lei che lo muove.', '@Marco| E io? Chi mi porta a casa, a me?', '> Io. Andiamo.'],
        next: 'fine',
      },
      fine: {
        say: [],
        do: (g) => {
          g.setStep('c9', 4);
          g.addXp(30);
        },
      },
    },
  };
}

// Martina è dentro: portone chiuso, e dopo un attimo la sua finestra si accende (col tappo che saluta)
function martinaInside(g: Game, now = false) {
  if (Q9.martinaIn) {
    Q9.martinaIn = false;
    const m = g.npc('martina');
    m.faceWhenNear = true;
    g.setHidden(m, true);
    g.audio.door();
  }
  const light = () => {
    REFS9.martinaWin!.visible = true;
    REFS9.tappo!.visible = true;
  };
  if (now) light();
  else g.after(1.6, light);
}

function temperini(): Dialogue {
  return {
    name: 'Marco',
    start: 'a',
    nodes: {
      a: {
        look: () => new THREE.Vector3((LOTS.x0 + LOTS.x1) / 2, 1, 2),
        say: [
          '* Via dei Temperini. I pali coi numeri ci sono: 4, 6, 8. Dietro i pali, niente.',
          '* Non macerie, non buchi: carta bianca. Pulita. Come un foglio nuovo.',
          'Stecco... qui cosa c\'era?',
          '> Tre case. Dario portava la gazzosa al numero 6.',
          'Tre case? Io qui ci passo sempre. Qui c\'è sempre stato... il niente.',
          'Il niente è un classico. Io al niente sono affezionato. ...No, aspetta.',
          'Al numero 8 abitava il mio compagno di banco. Tito. Mi prestava la gomma. Una gomma bianca, di quelle serie.',
          '* Marco si ferma. Ci pensa. Si vede che fa fatica, come spingere un armadio su per le scale.',
          'O me lo sto inventando? Non me lo ricordo. Perché non me lo ricordo?',
          '* Per terra, tra i pali, briciole rosa. Profumano di fragola.',
          (g) =>
            g.has('briciola') || g.is('fragolaPub')
              ? '* La stessa fragola del Vicolo Storto. La stessa del tavolo in fondo, da Dario.'
              : '* Una gomma da cancellare. Alla fragola. Di quelle per bambini.',
          'Andiamo a casa, Stecco. Qui mi viene freddo. Un freddo bianco.',
        ],
        do: (g) => g.addXp(30),
      },
    },
  };
}

function marcoHome(): Dialogue {
  return {
    name: 'La mamma di Marco',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* La porta si apre prima che tu bussi. La mamma di Marco era sveglia: la luce era accesa.',
          '@Marco| Mamma! Sono a casa! Sono... quasi a casa.',
          'MARCO. Sai che ore sono?',
          '@Marco| Tardi, mamma. Ma tardi disegnato. Non conta.',
          'Conta. E tu chi sei? Ah: Stecco. Quello della macchina senza motore. E del trasloco. E della sagra.',
          'Grazie per averlo riportato. Tutto intero, mi pare. Conto le linee: ci sono tutte.',
          '@Marco| Stecco. Grazie. Hic. Per il quiz, e per Barnie, e per... non mi ricordo. Per tutto.',
          '@Marco| E Tito. Domani cerchiamo Tito. Se c\'era.',
          'A letto.',
        ],
        next: 'dentro',
      },
      dentro: {
        // entrano: prima Marco (ondeggiando), poi la mamma, e la porta si chiude (vedi update)
        do: (g) => {
          const door = HOMES.marco;
          const marco = g.npc('marco');
          marco.faceWhenNear = false;
          marco.setBehavior({ type: 'patrol', path: [[door.x + 0.1, door.z + 0.7], [door.x + 0.1, door.z]], speed: 1.1, once: true });
          const mm = g.npc('mamma');
          mm.faceWhenNear = false;
          g.after(0.9, () => mm.setBehavior({ type: 'patrol', path: [[door.x - 0.2, door.z + 0.6], [door.x - 0.2, door.z]], speed: 1.1, once: true }));
          Q9.marcoIn = true;
        },
        look: () => new THREE.Vector3(HOMES.marco.x, 1.4, HOMES.marco.z),
        say: ['* Marco entra, ondeggiando. La mamma lo segue e chiude la porta.'],
        next: 'notte',
      },
      notte: {
        do: (g) => {
          // se hai letto più in fretta di loro: sono dentro adesso
          for (const id of ['marco', 'mamma']) if (!g.npc(id).hidden) g.setHidden(g.npc(id), true);
          if (Q9.marcoIn) {
            Q9.marcoIn = false;
            g.audio.door();
          }
        },
        say: ['* Via del Pentagramma è silenziosa. Da qualche parte, lontano, qualcosa strofina.'],
        next: 'fine',
      },
      fine: {
        say: [],
        do: (g) => {
          g.flag('c9Fine');
          g.addXp(60);
          g.addCoins(15);
        },
      },
    },
  };
}
