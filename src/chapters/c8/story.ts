import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { TOUCH } from '../../touch';
import { attackName } from '../../settings';
import { BOOTH, openBooth, updateBooth } from './booth';
import { CANS_BOOTH, CANS_DEBUG, cansGlued, setupCans } from './cans';
import { FISH_BOOTH, setupFish, updateFishTub } from './fishing';
import { CAKE_BOOTH, cakeHeight, setupCake } from './cake';
import { RIDE, martinaLooks, rideDown, setErased, setupWheel, startErase, startRide, updateWheel } from './wheel';
import { Q8, RIDE_COST } from './quests';
import { CAKE, CANS, FISH, FOUNTAIN, REFS8 } from './world';

// Capitolo 8: la sagra. Martina vuole il tappo in cima alla ruota → sei gettoni dalle bancarelle
// → la ruota → dalla cima, la fontana sparisce e torna ridisegnata → Arturo.

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

export function setupStory(g: Game) {
  const A = g.world.anchors;
  Q8.tokens = 0;
  Q8.won = 0;
  Q8.played = new Set();
  BOOTH.cur = null;
  BOOTH.el = null;
  setupCans(g);
  setupFish(g);
  setupCake();
  setupWheel();
  g.audio.birds = true;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi davanti allo striscione');
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 0, 2), 45, 1);
  g.audio.addEmitter('fountain', new THREE.Vector3(FOUNTAIN.x, 0, FOUNTAIN.z), 14, 0.7);
  if (import.meta.env.DEV) Object.assign(window, { __playCans: playCans, __c8: { Q8, BOOTH, RIDE, REFS8, CANS_DEBUG, openBooth, CANS_BOOTH, FISH_BOOTH, CAKE_BOOTH, rideWheel, startErase } });

  g.addCoin(-24, 20, 'Una moneta sotto le bandierine. È caduta dall\'alto: qualcuno ha lanciato i soldi alla banda.');
  g.addCoin(24, -21, 'Una moneta dietro l\'albero. La sagra paga chi guarda dietro gli alberi.');
  g.addCoin(-2.5, 37, 'Una moneta davanti alla transenna. Strada chiusa, monete aperte.');

  // --- le bancarelle ---
  booth(g, new THREE.Vector3(CANS.spot.x - 0.5, 1.0, CANS.spot.z), 'Gioca al tiro ai barattoli', playCans);
  booth(g, new THREE.Vector3(FISH.x + 1.0, 0.8, FISH.z), 'Pesca un tappo', playFish);
  booth(g, new THREE.Vector3(CAKE.x - 0.7, 1.0, CAKE.z), (g) => (g.questDone('torta') ? 'Fai una torta a piani' : 'Fai la torta a piani (per Nonna Pina)'), playCake);
  // il barattolo incollato: si guarda dal bancone
  g.addInteractable({
    pos: new THREE.Vector3(CANS.x, CANS.y + 0.15, CANS.z),
    radius: 6,
    icon: (g) => (g.quest('incollato') === 0 ? 'clue' : null),
    label: (g) => (g.quest('incollato') === 0 && !BOOTH.cur ? 'Guarda da vicino il barattolo di mezzo' : null),
    use: (g) =>
      g.talk(
        narr([
          'Ti sporgi sul bancone. Il barattolo di mezzo, quello in basso, ha una riga lucida tutto intorno.',
          'Colla. Colla stick, quella della scuola. Il barattolo è incollato alla mensola.',
          'Nessuno lo butterà mai giù. È la regola non scritta del tiro ai barattoli: uno è incollato. Ma di solito non è scritta perché è vietata.',
        ]),
        null,
        () => g.setStep('incollato', 1),
      ),
  });

  g.onUpdate.push((g, dt) => {
    updateWheel(g, dt);
    updateFishTub(g, dt);
    updateBooth(g, dt);
    // i gettoni (sopra, al centro): quanti ne hai, e quanti ne servono per la ruota
    const need = g.quest('c8') <= 1;
    const show = g.quest('c8') >= 0 && !BOOTH.cur && RIDE.cabin < 0 && !g.is('c8Fine') && (need || Q8.tokens > 0 || Q8.won > 0);
    g.hud.meter(show ? { label: `GETTONI: ${Q8.tokens}${need ? ` / ${RIDE_COST} per la ruota` : ''}`, value: need ? Math.min(1, Q8.tokens / RIDE_COST) : Math.min(1, Q8.tokens / 10), color: '#9a7b1f' } : null);
    // intro: Marco all'ingresso
    if (!g.is('c8Intro') && g.chapterTime > 1.2 && !g.dialogue.isOpen) {
      g.flag('c8Intro');
      g.talk(g.specs.get('marco')!.dialogue!, g.npc('marco'));
    }
    // abbastanza gettoni: si va alla ruota
    if (g.quest('c8') === 1 && Q8.tokens >= RIDE_COST && !BOOTH.cur) {
      g.setStep('c8', 2);
      g.after(1, () => g.npc('martina').say('Sei gettoni! Ti aspetto alla ruota. Cioè: vado io alla ruota? No: ci vediamo là.', 4));
    }
    // fine
    if (g.is('c8Fine') && !g.dialogue.isOpen && !g.is('c8Via')) {
      g.flag('c8Via');
      g.after(2.5, () => {
        g.completeQuest('c8');
        g.fade(true);
        g.after(1.3, () =>
          g.completeChapter('Prossimamente: Da Dario. Serata al pub con Marco e Martina: quiz, freccette con Barnie e la Gazzosa Gigante (tre litri, una cannuccia).'),
        );
      });
    }
  });
}

export function startChapter8(g: Game) {
  if (g.quest('c8') === -1) g.startQuest('c8');
  g.audio.playMusic('sagra');
  g.after(0.6, () => g.chapter('CAPITOLO 8', 'La sagra'));
}

// davanti a ogni bancarella: "Gioca"
function booth(g: Game, pos: THREE.Vector3, label: string | ((g: Game) => string), play: (g: Game) => void) {
  g.addInteractable({
    pos,
    radius: 2.6,
    label: (g) => (BOOTH.cur || RIDE.cabin >= 0 || g.is('c8Fine') ? null : typeof label === 'string' ? label : label(g)),
    use: (g) => play(g),
  });
}

// =========================================================================
// LE PARTITE
// =========================================================================
export function playCans(g: Game) {
  const go = () =>
    openBooth(g, CANS_BOOTH, () => {
      // il barattolo di mezzo non cade mai: qualcuno se ne accorge
      if (cansGlued() && g.is('c8Tonk') && g.quest('incollato') === -1) {
        g.after(3.2, () => {
          g.startQuest('incollato');
          g.npc('marco').say('Hai sentito? TONK. Le latte non fanno TONK. Fanno TLAN.', 4);
        });
      }
    });
  if (!g.is('c8Pastellone')) {
    g.flag('c8Pastellone');
    g.talk(g.specs.get('pastellone')!.dialogue!, g.npc('pastellone'), go);
  } else go();
}

export function playFish(g: Game) {
  const go = () => openBooth(g, FISH_BOOTH, () => {});
  if (!Q8.played.has('fish')) {
    g.toast(`Il tappo gira: fai scendere l'amo <b>un po' prima</b> che ci passi sotto. Cinque tentativi, <b>${TOUCH ? 'PESCA' : attackName()}</b> per pescare.`, 'quest', 6500);
  }
  go();
}

export function playCake(g: Game) {
  const go = () =>
    openBooth(g, CAKE_BOOTH, (tokens) => {
      if (tokens < 0) return;
      const n = cakeHeight();
      if (n >= 10 && g.questActive('torta')) {
        g.after(3.2, () => g.talk(g.specs.get('pina')!.dialogue!, g.npc('pina')));
      }
    });
  if (!g.is('c8Pina')) {
    g.flag('c8Pina');
    g.talk(g.specs.get('pina')!.dialogue!, g.npc('pina'), go);
  } else go();
}

// =========================================================================
// LA RUOTA
// =========================================================================
export function rideWheel(g: Game) {
  Q8.tokens -= RIDE_COST;
  g.audio.pay();
  g.fade(true);
  g.after(1.0, () => {
    startRide(g, () => g.talk(topOfTheWheel(), g.npc('martina')), () => afterRide(g));
    g.fade(false);
    g.after(2.2, () => g.npc('martina').say('Si sale! Non guardare giù. Cioè, guarda: è bellissimo.', 3.5));
    g.after(6.5, () => g.npc('martina').say('Da quassù San Scarabocchio sembra disegnata bene.', 3.5));
  });
}

function afterRide(g: Game) {
  const A = g.world.anchors;
  g.fade(true);
  g.after(0.9, () => {
    if (!RIDE.erased) setErased();
    const p = g.player;
    p.pos.set(A.dopoRuota.x, 0, A.dopoRuota.z);
    p.setLook(A.fontanaLook);
    const m = g.npc('martina');
    m.pos.set(A.dopoRuota.x + 1.3, 0, A.dopoRuota.z - 0.6);
    m.setBehavior({ type: 'patrol', path: [[A.martina.x + 1.5, A.martina.z - 2.5], [A.martina.x, A.martina.z]], speed: 1.6, once: true });
    if (m.body instanceof Stickman) m.body.seated = false;
    // Arturo è andato a guardare la fontana da vicino
    const ar = g.npc('filosofo');
    ar.pos.set(FOUNTAIN.x + 1.2, 0, FOUNTAIN.z + 6.6);
    ar.homeRot = Math.PI;
    ar.body.root.rotation.y = Math.PI;
    g.setStep('c8', 3);
    g.audio.playMusic('sagra');
    g.fade(false);
    g.after(1.5, () => m.say('Grazie. È stato un momento. Adesso torno a pescare, prima che finiscano i tappi.', 4));
    g.after(4, () => ar.say('Stecco! Vieni qui. Guarda.', 4));
  });
}

// in cima: il tappo. Poi la fontana.
function topOfTheWheel(): Dialogue {
  const fontana = (g: Game) => g.world.anchors.fontanaLook.clone();
  return {
    name: 'Martina',
    start: 'a',
    nodes: {
      a: {
        do: (g) => {
          martinaLooks(g, true);
          g.take('tappoVero');
          g.flag('tappoRestituito');
        },
        say: [
          'Siamo in cima.',
          '@Il signor Perno| SI È INCEPPATA! DUE MINUTI! CIOÈ, VENTI!',
          'Perfetto. Allora c\'è tempo.',
          '> Martina. Il tuo tappo.',
          '* Glielo dai. Il tappo di Don Fluo: prestato, portato su e giù per mezza città, finito in un\'asta, sopravvissuto a una discesa senza motore. Restituito.',
          'È tornato. Ed è un po\' più giallo di prima.',
          'Mia nonna diceva: "Un tappo prestato torna sempre. È il tappo che sceglie da chi."',
        ],
        choices: [
          { t: 'Allora ha scelto te.', next: 'scelto' },
          { t: 'Tua nonna diceva cose strane.', next: 'nonna' },
          { t: 'Ho anche questo: il tappo con la stella.', if: (g) => g.has('tappoStella'), next: 'stella' },
        ],
      },
      scelto: {
        say: ['Ha scelto te per portarlo, e me per tenerlo. Siamo una squadra.', 'Una squadra da due. La più piccola possibile. Mi piace.'],
        do: (g) => g.flag('martinaSquadra'),
        next: 'vista',
      },
      nonna: {
        say: ['Anche la tua, immagino.', 'Tutte le nonne sono disegnate dalla stessa mano. Per questo dicono le stesse cose.'],
        next: 'vista',
      },
      stella: {
        do: (g) => {
          g.take('tappoStella');
          g.flag('stellaMartina');
          if (g.questActive('stella')) g.completeQuest('stella');
          g.addXp(40);
        },
        say: [
          '* Le dai il tappo con la stella.',
          'Questo è... Stecco. Sono tre sagre che lo inseguo. Tre!',
          'L\'hai pescato tu? Con l\'amo? Senza mani?',
          '> Non ho mani. Ho talento.',
          'Lo metto al centro della collezione. Anzi: lo metto da parte. Il centro è per le occasioni.',
        ],
        next: 'vista',
      },
      vista: {
        do: (g) => martinaLooks(g, false),
        look: fontana,
        say: [
          '* Da quassù si vede tutta la piazza: le bandierine colorate dai Pastelli, la banda, Marco che assaggia le torte della giuria.',
          'Guarda la fontana. Da qui sembra un fiore.',
        ],
        next: 'sparisce',
      },
      sparisce: {
        do: (g) => startErase(g),
        look: fontana,
        say: [
          '* E la fontana sparisce.',
          '* Non cade, non si rompe: sparisce. Un foglio bianco si allarga dove c\'era, a strappi, come una gomma che strofina su un quaderno.',
          '* Poi il bianco si richiude. La fontana è di nuovo lì.',
          '* Quasi uguale.',
        ],
        next: 'dopo',
      },
      dopo: {
        do: (g) => martinaLooks(g, true),
        say: ['Che c\'è? Hai visto un fantasma?'],
        choices: [
          { t: 'La fontana. È sparita. Poi è tornata.', next: 'tre' },
          { t: 'Niente. Mi gira la testa.', next: 'niente' },
        ],
      },
      tre: {
        look: fontana,
        say: [
          'Sparita? È lì. Con i suoi tre zampilli, come sempre.',
          '> Tre?',
          'Tre. Perché, quanti dovrebbero essere?',
          '* Tre. Tu ne ricordi quattro. Ma sei l\'unico, a quanto pare.',
        ],
        next: 'giu',
      },
      niente: {
        say: ['È l\'altezza. O sono io. Scherzo: è l\'altezza.'],
        next: 'giu',
      },
      giu: {
        say: ['@Il signor Perno| RIPARTEEE!'],
        do: (g) => {
          rideDown(g);
          g.addXp(60);
          g.flag('c8Ruota');
        },
      },
    },
  };
}
