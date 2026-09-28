import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { TOUCH } from '../../touch';
import { attackName, keyName, parryName } from '../../settings';
import { DREFS, HALF, Z } from './world';

// ---------------------------------------------------------------------------
// La demo: un comando alla volta, dal più semplice. Ogni tappa ha il suo testo (obiettivo in
// rosso), il suo controllo ("fatto?") e il Tutorial che ti aspetta già lì (è sempre un passo
// avanti: è il Tutorial). Circa tre minuti; alla fine si torna al menu.
// ---------------------------------------------------------------------------

export const STATUS = { text: '', target: null as THREE.Vector3 | null };

interface Step {
  id: string;
  text: () => string;
  target?: () => THREE.Vector3 | null;
  at: [number, number]; // dove aspetta il Tutorial
  enter?: (g: Game) => void;
  check: (g: Game, dt: number) => boolean;
  done?: (g: Game) => void;
}

const D = {
  i: 0,
  wait: 0, // pausa tra una tappa e l'altra
  runT: -1, // cronometro della corsa (-1 = non partito)
  punches: 0,
  diarioVisto: false,
  talked: false,
  fired: new Set<string>(),
};

const wasd = () => `${keyName('forward')} ${keyName('left')} ${keyName('back')} ${keyName('right')}`;
const say = (g: Game, text: string, t = 4) => g.npc('tutorial').say(text, t);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const STEPS: Step[] = [
  {
    id: 'guarda',
    at: [-2.2, -3.5],
    text: () => (TOUCH ? 'Trascina il dito sulla metà destra dello schermo e guarda il palloncino rosso' : 'Muovi il mouse e guarda il palloncino rosso'),
    target: () => DREFS.balloon?.position.clone().add(V(0, 1.2, 0)) ?? null,
    enter: (g) => say(g, 'Ciao! Sono il Tutorial. Esisto solo qui, e solo per tre minuti.', 5),
    check: (g) => {
      const b = DREFS.balloon!;
      const to = b.position.clone().sub(g.player.eye).normalize();
      return to.angleTo(g.player.forward) < 0.2;
    },
    done: (g) => {
      DREFS.balloon!.visible = false;
      g.audio.pop();
      say(g, 'Bravo. Guardarsi intorno è gratis.');
    },
  },
  {
    id: 'cammina',
    at: [-2.6, -9],
    text: () => (TOUCH ? 'Appoggia il pollice sinistro e spingi: cammina fino alla X' : `Cammina fino alla X: ${wasd()}`),
    target: () => V(0, 0.8, Z.x),
    check: (g) => Math.hypot(g.player.pos.x, g.player.pos.z - Z.x) < 1.3,
    done: (g) => say(g, 'Come ho fatto ad arrivare prima di te? Sono il Tutorial. Sono sempre un passo avanti.', 5),
  },
  {
    id: 'corri',
    at: [-2.8, Z.flag - 1],
    text: () =>
      D.runT >= 0
        ? `CORRI! ${Math.max(0, 3 - D.runT).toFixed(1)} secondi`
        : TOUCH
          ? 'Corri fino alla bandiera: spingi il joystick fino in fondo. Dalla linea del VIA hai 3 secondi'
          : `Corri fino alla bandiera: tieni premuto ${keyName('run')}. Dalla linea del VIA hai 3 secondi`,
    target: () => V(0, 3.6, Z.flag),
    check: (g, dt) => {
      const z = g.player.pos.z;
      if (D.runT < 0 && z < Z.runStart) D.runT = 0;
      if (D.runT < 0) return false;
      D.runT += dt;
      if (z < Z.flag) {
        g.hud.meter(null);
        return true;
      }
      g.hud.meter({ label: `${Math.max(0, 3 - D.runT).toFixed(1)} s`, value: Math.max(0, 1 - D.runT / 3), color: '#d6333a' });
      if (D.runT > 3) {
        // troppo piano: si torna alla linea
        D.runT = -1;
        g.hud.meter(null);
        g.player.pos.set(0, 0, Z.runStart + 2.5);
        g.audio.bad();
        say(g, 'Quella era una passeggiata. Di corsa!', 3);
        g.toast(TOUCH ? 'Troppo piano! Spingi il joystick <b>fino in fondo</b>.' : `Troppo piano! Tieni premuto <b>${keyName('run')}</b> mentre cammini.`, 'bad', 4000);
      }
      return false;
    },
    done: (g) => say(g, 'Veloce! Quasi quanto me.'),
  },
  {
    id: 'salta',
    at: [-2.8, Z.puddle1 - 2.5],
    text: () => `Salta la pozzanghera: ${keyName('jump')}`,
    target: () => V(0, 1, Z.puddle1 - 1),
    check: (g) => {
      const p = g.player.pos;
      if (p.z < Z.puddle0 && p.z > Z.puddle1 && p.y < 0.12) {
        // dentro coi piedi: si torna indietro
        p.set(p.x, 0, Z.puddle0 + 2.6);
        g.audio.splat(p);
        g.toast(`Splash! Piedi bagnati. Disegnati, ma bagnati. Prendi la rincorsa e salta con <b>${keyName('jump')}</b>.`, 'bad', 4000);
        return false;
      }
      return p.z < Z.puddle1 - 0.4;
    },
    done: (g) => say(g, 'Asciutto! Più o meno.'),
  },
  {
    id: 'giu',
    at: [-2.8, Z.bar - 2.5],
    text: () => `Passa sotto la sbarra accovacciato: ${keyName('crouch')} (poi ${keyName('crouch')} di nuovo per rialzarti)`,
    target: () => V(0, 1.8, Z.bar),
    check: (g) => {
      const p = g.player.pos;
      if (Math.abs(p.z - Z.bar) < 0.45 && !g.player.crouching) {
        p.z = Z.bar + 0.9;
        g.audio.bump(0.6);
        g.hud.popWord(V(p.x, 1.4, Z.bar), g.player.camera, 'BONK!');
        if (!D.fired.has('bonk')) {
          D.fired.add('bonk');
          say(g, 'Accovacciati PRIMA della sbarra. Dopo è tardi.', 3.5);
        }
        return false;
      }
      return p.z < Z.bar - 0.8;
    },
    done: (g) => {
      say(g, `Ora rialzati (${keyName('crouch')}). Stare giù tutto il giorno fa male alla schiena. Disegnata, ma fa male.`, 5);
    },
  },
  {
    id: 'parla',
    at: [0, Z.tutorial],
    text: () => `Parla con il Tutorial: guardalo e premi ${keyName('interact')}`,
    target: () => V(0, 2.6, Z.tutorial),
    check: () => D.talked,
  },
  {
    id: 'monete',
    at: [-2.8, Z.coins[2] - 2],
    text: () => 'Raccogli le tre monete: basta passarci sopra',
    enter: (g) => {
      g.addCoin(-2, Z.coins[0]);
      g.addCoin(2, Z.coins[1]);
      g.addCoin(-1.4, Z.coins[2]);
    },
    check: (g) => g.state.coins >= 15,
    done: (g) => say(g, 'Con le monete si comprano cose. A volte anche cose utili.'),
  },
  {
    id: 'diario',
    at: [-2.8, Z.diario - 2],
    text: () => `Apri il diario (${keyName('journal')}): ci sono missioni e oggetti. Poi richiudilo (${keyName('journal')})`,
    check: (g) => {
      if (g.hud.diarioOpen) D.diarioVisto = true;
      return D.diarioVisto && !g.hud.diarioOpen;
    },
    done: (g) => say(g, 'Nel diario c\'è tutto. Anche cose che non ti ricordavi di sapere.'),
  },
  {
    id: 'colpisci',
    at: [-2.8, Z.dummy + 1.5],
    text: () => `Colpisci il manichino tre volte: ${attackName()} (${D.punches}/3)`,
    target: () => V(0, 2.6, Z.dummy),
    check: () => D.punches >= 3,
    done: (g) => {
      g.npc('manichino').say('Ok. Basta. Ho capito.', 3);
      say(g, 'Adesso uno che si difende.');
    },
  },
  {
    id: 'para',
    at: [-3.2, Z.sparring + 5],
    text: () => `Lo Sparring ti attacca. Quando carica il pugno, para: ${parryName()}. Dopo la parata è scoperto: colpiscilo (${attackName()})`,
    target: () => {
      const n = g_.npc('sparring');
      return n.fighter?.ko ? null : n.pos.clone().setY(n.topY + 1);
    },
    enter: (g) => g.combat.provoke(g.npc('sparring')),
    check: (g) => !!g.npc('sparring').fighter?.ko,
    done: (g) => say(g, 'Qui tutti parano sempre. Si colpisce dopo aver parato. È educazione.', 5),
  },
  {
    id: 'righello',
    at: [-2.8, Z.ruler - 2],
    text: () =>
      TOUCH ? 'Hai un righello! Tocca ARMA (in alto) per prenderlo in mano' : `Hai un righello! Premi ${keyName('weapon2')} per prenderlo in mano (${keyName('weapon1')} per tornare ai pugni)`,
    enter: (g) => g.give('righello'),
    check: (g) => g.player.weapon === 'ruler',
    done: (g) => say(g, 'Trenta centimetri di rispetto.'),
  },
  {
    id: 'pistola',
    at: [-3.2, Z.pistol - 1],
    text: () =>
      TOUCH
        ? `Ecco una pistola a inchiostro: ARMA di nuovo, poi colpisci le tre sagome (SPARA) (${DREFS.targets.filter((t) => t.down).length}/3)`
        : `Ecco una pistola a inchiostro: premi ${keyName('weapon3')} e colpisci le tre sagome, ${attackName()} (${DREFS.targets.filter((t) => t.down).length}/3)`,
    target: () => V(0, 2.8, Z.targets),
    enter: (g) => {
      g.give('pistola');
      g.state.clip = 4;
      g.state.ammo = 12;
    },
    check: () => DREFS.targets.every((t) => t.down),
    done: (g) => say(g, 'Mira da pittore. Da imbianchino, via.'),
  },
  {
    id: 'ricarica',
    at: [-3.2, Z.pistol - 1],
    text: () => `Ricarica: ${keyName('reload')}. Il serbatoio blu sulla pistola dice quanto inchiostro resta`,
    check: (g) => g.input.wasPressed('reload') || (g.player.reloadT > 0 && D.fired.has('ricaricaVista')),
    enter: () => D.fired.add('ricaricaVista'),
    done: (g) => say(g, 'Adesso vai al traguardo. Io sono già lì. Ovviamente.'),
  },
  {
    id: 'fine',
    at: [0, Z.end - 1.5],
    text: () => 'Vai al traguardo',
    target: () => V(0, 1.2, Z.end),
    check: (g) => g.player.pos.z < Z.end + 1.5,
  },
];

let g_: Game;

export function setupDemo(g: Game) {
  g_ = g;
  Object.assign(D, { i: 0, wait: 0, runT: -1, punches: 0, diarioVisto: false, talked: false, fired: new Set<string>() });
  const A = g.world.anchors;
  g.state.hp = g.state.maxHp;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi sulla pagina di prova');

  // il Tutorial: fischietto, cappellino, sempre un passo avanti
  const t = g.addNpc({
    id: 'tutorial',
    name: 'Il Tutorial',
    pos: STEPS[0].at,
    face: [0, 5],
    look: { hat: 'cap', mustache: true },
    faceWhenNear: true,
    barks: () => [],
    dialogue: tutorialDialogue(),
    talkLabel: 'Parla con il Tutorial',
  });
  if (t.body instanceof Stickman) {
    const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.12), new THREE.MeshBasicMaterial({ color: '#1e1d24' }));
    t.body.prop.add(whistle);
  }
  // il manichino (si colpisce) e lo sparring (si difende)
  g.addNpc({
    id: 'manichino',
    name: 'Il manichino',
    pos: [0, Z.dummy],
    face: [0, 0],
    look: { eyes: false },
    faceWhenNear: false,
    barks: () => [],
    onPunch: (g, n) => {
      if (STEPS[D.i]?.id !== 'colpisci') {
        n.say('Non ancora. Aspetto il mio turno.', 2);
        return;
      }
      D.punches++;
      n.say(['Ahi.', 'Ahi!', 'AHI.'][Math.min(2, D.punches - 1)], 1.5);
    },
  });
  g.addNpc({
    id: 'sparring',
    name: 'Lo Sparring',
    pos: [0, Z.sparring],
    face: [0, 0],
    look: { hat: 'beanie' },
    faceWhenNear: false,
    barks: () => [],
    fighter: {
      hp: 38,
      dmg: 3,
      speed: 2.2,
      windup: 1.0,
      cooldown: 1.4,
      parries: [1, 1],
      openTime: 2.4,
      alertLine: 'In guardia!',
      hurtLines: ['Ahia!', 'Buona questa!', 'Ok, ok!'],
      koLine: 'Bravo. Mi sdraio un attimo.',
    },
  });
  // le sagome: cadono quando le colpisci
  for (const tg of DREFS.targets) {
    g.guns.targets.push({
      x: tg.x,
      z: tg.z,
      r: 0.5,
      y0: 0.05,
      y1: 2,
      alive: () => !tg.down,
      hit: () => {
        tg.down = true;
        g.audio.good();
      },
    });
  }

  g.onUpdate.push((g, dt) => update(g, dt));
}

function update(g: Game, dt: number) {
  for (const t of DREFS.targets) if (t.down && t.fall < 1) t.pivot.rotation.x = -(t.fall = Math.min(1, t.fall + dt * 4)) * (Math.PI / 2);
  if (D.i >= STEPS.length) return;
  const s = STEPS[D.i];
  STATUS.text = s.text();
  STATUS.target = s.target?.() ?? null;
  if (!(g.mode === 'play' && g.input.locked)) return;
  if (D.wait > 0) {
    D.wait -= dt;
    if (D.wait <= 0) enterStep(g);
    return;
  }
  if (s.check(g, dt)) {
    s.done?.(g);
    g.audio.good();
    D.i++;
    if (D.i >= STEPS.length) return finish(g);
    D.wait = 0.7;
  }
}

function enterStep(g: Game) {
  const s = STEPS[D.i];
  const t = g.npc('tutorial');
  // il Tutorial è già alla tappa dopo (quando non lo guardi, possibilmente)
  t.pos.set(s.at[0], 0, s.at[1]);
  t.homeRot = Math.PI * 0; // guarda verso chi arriva (+z)
  t.body.root.rotation.y = 0;
  s.enter?.(g);
  g.setCheckpoint(g.player.pos.clone(), g.player.pos.clone().add(V(0, 1.6, -5)), 'Ti rialzi. Il Tutorial fa finta di niente');
}

export function startDemo(g: Game) {
  g.startQuest('demo');
  g.audio.playMusic('paese');
  g.after(0.6, () => g.chapter('DEMO', 'La pagina di prova'));
  g.after(1.5, () => enterStep(g));
}

function tutorialDialogue(): Dialogue {
  const end = { do: () => (D.talked = true) };
  return {
    name: 'Il Tutorial',
    start: () => (D.talked ? 'dopo' : 'a'),
    nodes: {
      a: {
        say: [
          'Eccoti. Questo è un dialogo.',
          TOUCH ? 'Per andare avanti, tocca lo schermo.' : `Per andare avanti: ${keyName('interact')}, spazio o click.`,
          'Quando ci sono delle risposte, scegli quella che vuoi. Tanto sono tutte giuste. Quasi.',
        ],
        choices: [
          { t: 'Ho capito.', next: 'ok' },
          { t: 'Non ho capito.', next: 'no' },
          { t: 'Chi sei?', next: 'chi' },
        ],
      },
      ok: { say: ['Perfetto. Sei già più bravo di quasi tutti. Quasi tutti sono io.'], ...end },
      no: { say: ['Non importa: nessuno capisce i tutorial. Si va avanti lo stesso.'], ...end },
      chi: { say: ['Sono il Tutorial. Mi hanno disegnato per spiegarti i comandi, poi mi cancellano. Non ti affezionare.'], ...end },
      dopo: { say: ['Vai, vai. Io ti aspetto più avanti. Sono già lì, in un certo senso.'] },
    },
  };
}

function finish(g: Game) {
  g.hud.meter(null);
  g.talk(
    {
      name: 'Il Tutorial',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Finito. Adesso sai fare tutto.',
            'Più o meno.',
            'Il resto lo impari giocando: ogni capitolo ha qualcosa di nuovo. Io adesso sparisco.',
            '* Il Tutorial si cancella da solo. Con molta dignità.',
          ],
          do: () => {},
        },
      },
    },
    g.npc('tutorial'),
    () => {
      g.setHidden(g.npc('tutorial'), true);
      g.audio.erase(0.7);
      g.completeQuest('demo');
      g.fade(true);
      g.after(1.2, () => g.completeChapter(''));
    },
  );
}

void HALF;
