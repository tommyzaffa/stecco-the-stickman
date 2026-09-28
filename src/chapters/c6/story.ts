import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { HL, THEME } from '../../render/palette';
import { glowTexture, headTexture } from '../../render/textures';
import { ROAD, S } from './road';
import { BASE_Y, REFS } from './world';
import { DRIVE, DRIVE_HOOKS, cullChunks, enterCar, leaveCar, resetDrive, spawnSheep, startChase, sub, updateDrive } from './drive';

// Capitolo 6: la piazza → la discesa con i Pastelli dietro → Don Fluo torna giallo → la panchina cancellata

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

let glow: THREE.Sprite | null = null;

export function setupStory(g: Game) {
  const A = g.world.anchors;
  resetDrive();
  glow = null;
  g.audio.birds = true;
  REFS.scatola!.visible = false;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi in piazza. Il Righello ti guarda dall\'alto');
  spawnSheep(g);

  g.addCoin(-19, -24, 'Una moneta vicino alla pasticceria. Quadrata? No, rotonda. Qualcuno ci ha provato.');
  g.addCoin(19, 16, 'Una moneta sotto il treppiede del geometra. Misurata: vale cinque.');

  // la macchina di Luca: si sale da qui
  const carPos = ROAD.point(S.car, 0, 1);
  g.addInteractable({
    pos: carPos,
    radius: 3.2,
    label: (g) => (DRIVE.active ? null : g.quest('c6') >= 1 ? 'Sali e guida' : 'La macchina di Luca'),
    use: (g) => {
      if (g.quest('c6') < 1) {
        g.talk(narr(['È un rettangolo con quattro cerchi. Più un altro rettangolo sopra.', 'Sul cofano, a matita: LUCA. Prima parla con lui: è sua.']));
        return;
      }
      startDrive(g);
    },
  });
  // la macchina si può toccare ma non attraversare (finché non sali)
  const carCol = g.world.colliders.box(0, ROAD.point(S.car, 0).z, 1.9, 4.1);
  g.addInteractable({
    pos: new THREE.Vector3(-11, 1.2, -6.6),
    radius: 2.6,
    label: () => 'Guarda il monumento',
    use: (g) => g.talk(narr(['Un righello alto sette metri. "AL RIGHELLO, CHE CI HA RESI DRITTI".', 'Qualcuno ci ha segnato sopra la propria altezza. Tutti uguali. Tutti un metro e novantatré.'])),
  });
  g.addInteractable({
    pos: new THREE.Vector3(0, 1, -29),
    radius: 2.6,
    label: () => (DRIVE.active ? null : 'Via della Cera'),
    use: (g) => g.talk(narr(['Una transenna. Dall\'altra parte, il quartiere dei Pastelli a Cera.', 'Dopo ieri sera, meglio non passarci. Nemmeno in punta di piedi. Soprattutto non in punta.'])),
  });
  // nel parco: le briciole
  g.addInteractable({
    pos: REFS.bench.clone().setY(BASE_Y + 0.4),
    radius: 2.6,
    label: (g) => (g.quest('c6') >= 4 && g.is('arturoFatto') ? 'Guarda le briciole' : null),
    use: (g) => g.talk(narr(['Briciole grigie, arricciate. Sono calde.', 'Quando cancelli qualcosa, la gomma lascia sempre qualcosa. È la parte che non si vede mai nei disegni finiti.'])),
  });

  // per le prove da console (solo in sviluppo)
  if (import.meta.env.DEV) Object.assign(window, { __c6: { DRIVE, ROAD, REFS, S } });

  DRIVE_HOOKS.barnieUp = barnieUp;
  DRIVE_HOOKS.barnieDown = barnieDown;
  DRIVE_HOOKS.arrive = arrive;

  g.onUpdate.push((g, dt) => {
    updateDrive(g, dt);
    const cam = g.player.camera.position;
    if (!DRIVE.active) {
      cullChunks(cam, g);
      REFS.sky?.position.copy(cam);
    }
    if (carCol && DRIVE.active) g.world.colliders.remove(carCol);

    // Marco ti accoglie in piazza
    if (!g.is('introAvviata') && g.chapterTime > 1.2 && !g.dialogue.isOpen) {
      g.flag('introAvviata');
      g.talk(g.specs.get('marco')!.dialogue!, g.npc('marco'));
    }

    // arrivo: la Scatola si avvicina e si ferma dietro di voi
    if (g.is('scatolaArriva') && DRIVE.chaseS < DRIVE.s - 9) {
      DRIVE.chaseS = Math.min(DRIVE.s - 9, DRIVE.chaseS + 6 * dt);
      DRIVE.chaseV = 3;
      if (DRIVE.chaseS >= DRIVE.s - 9) DRIVE.chaseV = 0;
    }
    // Don Fluo torna evidente: l'alone pulsa
    if (glow) {
      glow.material.opacity = 0.55 + Math.sin(g.time * 5) * 0.2;
      const f = g.npc('fluo');
      glow.position.set(f.pos.x, f.pos.y + 1.6, f.pos.z);
    }

    // dopo la consegna: stacco al parco
    if (g.is('consegnato') && !g.is('alParco') && !g.dialogue.isOpen) {
      g.flag('alParco');
      goPark(g);
    }
    // la panchina che non c'è
    if (g.quest('c6') === 4 && !g.is('arturoAvviato') && !g.dialogue.isOpen && g.player.pos.distanceTo(REFS.bench) < 5.5) {
      g.flag('arturoAvviato');
      g.audio.stopMusic();
      g.talk(arturo(), g.npc('filosofo'));
    }
    // fine capitolo
    if (g.is('c6Finale') && !g.dialogue.isOpen && !g.is('c6Done')) {
      g.flag('c6Done');
      g.completeQuest('c6');
      g.fade(true);
      g.after(1.4, () =>
        g.completeChapter('Prossimamente: il trasloco. Nonna Pina non si fida più della sua via. E ha tanti mobili. Troppi. Si incastrano male.'),
      );
    }
  });
}

export function startChapter6(g: Game) {
  if (g.quest('c6') === -1) g.startQuest('c6');
  g.audio.playMusic('indagine');
  g.after(0.6, () => g.chapter('CAPITOLO 6', 'Consegna a domicilio'));
  g.after(24, () => {
    if (g.quest('tappi') !== -1) return;
    g.phone('Martina', 'Buongiorno! Ricordati: il tappo te l\'ho prestato, non regalato. P.S. Se per strada vedi dei tappi, raccoglili per me.');
    g.startQuest('tappi');
  });
}

// =========================================================================
// SI PARTE
// =========================================================================
function startDrive(g: Game) {
  if (g.quest('tappi') === -1) {
    g.phone('Martina', 'Parti adesso? Se per strada vedi dei tappi, raccoglili per me!');
    g.startQuest('tappi');
  }
  enterCar(g);
  g.setStep('c6', 2);
  sub(g, 'marco', 'Pronti? Io spingo. Luca spinge. Tu sterzi.');
  sub(g, 'luca', 'È la prima volta che vedo la mia macchina da dentro.');
  const verde = g.npc('pVerdeGiornale');
  g.after(1.4, () => {
    verde.setBehavior({ type: 'stand' });
    if (verde.body instanceof Stickman) {
      verde.body.action = 'wave';
      verde.baseAction = 'wave';
      // il giornale vola via
      const paper = verde.body.torso.getObjectByName('giornale');
      if (paper) paper.visible = false;
    }
    verde.say('SONO QUI! SONO IN MACCHINA!!', 3);
    g.audio.alert();
    startChase(g);
  });
  g.after(2.4, () => {
    g.npc('pastellone').say('FERMATEVI! NEL NOME DELLA CERA!', 3.5);
    g.audio.playMusic('consegna');
    sub(g, 'marco', 'I Pastelli! Dietro di noi! SPINGI, LUCA!');
    g.toast('I Pastelli arrivano dalla piazza, dietro di te. Si guarda indietro girando la visuale.', 'bad', 5000);
    DRIVE.started = true;
  });
  g.after(6, () => g.setHidden(verde, true));
}

// =========================================================================
// BARNIE
// =========================================================================
function barnieUp(g: Game) {
  g.talk(
    {
      name: 'Barnie',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Grazie. Mi chiamo Barnie.',
            '* Barnie è alto come una porta. Una porta alta.',
            "Vado da Dario, a San Scarabocchio. Il pub. Stasera c'è la finale di freccette.",
            '> Stasera? Sono le dieci di mattina.',
            'Mi piace arrivare presto.',
            '@Marco| Sali dietro! Attento alla testa!',
            '* Barnie sale dietro. La macchina si abbassa di un palmo. La testa di Barnie esce dal tetto: dice che ci sta meglio così.',
          ],
          do: (g) => {
            g.startQuest('barnie');
            g.toast('Con Barnie a bordo in discesa si va un po\' più forte, e quando si spinge <b>spinge anche lui</b>.', 'reward', 6000);
          },
        },
      },
    },
    g.npc('barnie'),
  );
}

function barnieOut(g: Game, side: number) {
  const n = g.npc('barnie');
  n.controlled = false;
  if (n.body instanceof Stickman) {
    n.body.seated = false;
    n.body.action = 'none';
  }
  n.baseAction = 'none';
  n.setBehavior({ type: 'stand' });
  const p = ROAD.point(DRIVE.s + 0.5, DRIVE.d + side * 2.4);
  n.pos.copy(p);
  n.homeRot = ROAD.at(DRIVE.s).th + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  n.body.root.rotation.y = n.homeRot;
}

function barnieDown(g: Game) {
  barnieOut(g, -1);
  g.talk(
    {
      name: 'Barnie',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Eccoci. Grazie, Stecco. E grazie, macchina.',
            '* Dal pub esce un omino col grembiule.',
            '@Dario| Barnie! Sei in anticipo di dieci ore.',
            'Lo so, Dario.',
            '@Dario| E questi chi sono?',
            "Amici. Mi hanno dato un passaggio. Poi ho spinto un po'.",
            '@Dario| Venite anche voi, una sera! Gazzosa per tutti e freccette. Barnie vince sempre.',
            'Non sempre. Quasi.',
            '* Barnie ti dà una freccetta. È disegnata benissimo: la punta è davvero appuntita.',
          ],
          do: (g) => {
            g.give('freccetta');
            g.addCoins(15);
            g.addXp(30);
            g.completeQuest('barnie');
          },
        },
      },
    },
    g.npc('barnie'),
  );
}

// =========================================================================
// ARRIVATI: Don Fluo
// =========================================================================
function arrive(g: Game) {
  g.audio.stopMusic();
  g.setStep('c6', 3);
  // Don Fluo e Bruno vengono al finestrino
  const th = ROAD.at(DRIVE.s).th;
  const left = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
  const f = new THREE.Vector3(Math.sin(th), 0, Math.cos(th));
  const win = new THREE.Vector3(DRIVE.x, 0, DRIVE.z).addScaledVector(left, 2.0).addScaledVector(f, 0.2);
  const fluo = g.npc('fluo');
  fluo.setBehavior({ type: 'patrol', path: [[win.x, win.z]], speed: 2.2, once: true });
  const bruno = g.npc('bruno');
  const bw = win.clone().addScaledVector(left, 1.2).addScaledVector(f, 1.6);
  bruno.setBehavior({ type: 'patrol', path: [[bw.x, bw.z]], speed: 2.0, once: true });
  const talk = () => g.after(2.2, () => g.talk(fluoDialogue(), fluo));
  if (DRIVE.barnie === 'aboard') {
    DRIVE.barnie = 'dropped';
    barnieOut(g, -1);
    g.talk(
      {
        name: 'Barnie',
        start: 'a',
        nodes: {
          a: {
            say: ['Il pub era un po\' più su. Non importa: scendo qui e torno a piedi. Mi fa bene.', 'Grazie del passaggio. Se passate da Dario, una sera, vi offro una gazzosa.'],
            do: (g) => {
              g.addXp(20);
              g.completeQuest('barnie');
            },
          },
        },
      },
      g.npc('barnie'),
      () => {
        g.npc('barnie').setBehavior({ type: 'patrol', path: [[ROAD.point(S.dario, -4).x, ROAD.point(S.dario, -4).z]], speed: 1.6, once: true });
        talk();
      },
    );
  } else talk();
}

function fluoDialogue(): Dialogue {
  return {
    name: 'Don Fluo',
    start: 'a',
    nodes: {
      a: {
        say: [
          'Terzo giorno. Mezzogiorno meno un quarto.',
          'Siete in anticipo. Nessuno è mai in anticipo con me. Mi mette a disagio.',
          '> Il tappo.',
          '* Porgi il tappo giallo dal finestrino.',
          '* Don Fluo lo prende. Lo guarda. Se lo infila in testa. Clic.',
        ],
        next: 'giallo',
      },
      giallo: {
        do: (g) => fluoGlows(g),
        say: [
          '* Per un attimo non succede niente.',
          '* Poi Don Fluo diventa giallo. Molto giallo. Un giallo che si sente.',
          'Ah.',
          'Ragazzi. Mi sento... evidente.',
          '@Marco| Adesso ci evidenzia?',
          'No. Un evidenziatore evidenzia solo le cose importanti.',
          'E voi, con tutto il rispetto, non lo siete.',
          '> Grazie?',
        ],
        next: 'pastelli',
      },
      pastelli: {
        do: (g) => g.flag('scatolaArriva'),
        say: [
          '* Un rumore di ruote. E di dodici piedi che corrono.',
          '@Il Pastellone| FLUO!',
          'Pastellone.',
          '@Il Pastellone| Quel tappo...',
          'È mio.',
          '@Il Pastellone| Lo so. Non siamo qui per il tappo.',
          '@Il Pastellone| Stanotte, nel nostro quartiere, è sparita una via. Via del Temperino. Tutta. Con le case dentro.',
          '@Il Pastellone| Pensavamo foste stati voi. O questi due.',
          'A noi è sparito un lampione. Con la luce accesa.',
          '* Silenzio. Da qualche parte, lontano, qualcosa strofina.',
          'Tregua?',
          '@Il Pastellone| Tregua. Finché non scopriamo chi è.',
        ],
        next: 'fine',
      },
      fine: {
        say: [
          'Ragazzo. Tieni.',
          '* Don Fluo si toglie il tappo e te lo ridà. Resta giallo lo stesso.',
          'Mi bastava un minuto chiuso. Un evidenziatore dura anni, se ogni tanto si chiude.',
          "Riportalo alla signorina. Un tappo prestato si restituisce: è l'unica legge che rispettiamo tutti.",
          '@Marco| E il cappellino? Quello che avevo... preso in prestito?',
          'Tienilo. Hai la testa giusta per non pensarci.',
          '@Luca| Posso riavere la macchina? Mi manca spingerla.',
          '* Consegna a domicilio: quaranta monete, mancia inclusa. La paga Don Fluo. È la prima volta che qualcuno viene pagato da Don Fluo.',
        ],
        do: (g) => {
          g.addCoins(40);
          g.addXp(80);
          g.flag('consegnato');
        },
      },
    },
  };
}

// Il tappo torna al suo posto: Don Fluo riprende colore (gialli gli arti, la testa e un alone)
function fluoGlows(g: Game) {
  const n = g.npc('fluo');
  g.audio.glow();
  g.flag('fluoGiallo');
  if (n.body instanceof Stickman) {
    n.body.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m && m instanceof THREE.MeshBasicMaterial && m.transparent && Math.abs(m.opacity - 0.55) < 0.01) {
        m.color.set(HL.yellow);
        m.opacity = 0.8;
      }
    });
    const head = n.body.head.material as THREE.SpriteMaterial;
    head.map = headTexture(THEME.inkHex, HL.yellow);
    head.needsUpdate = true;
  }
  glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(232,245,58,0.7)'), transparent: true, depthWrite: false }));
  glow.scale.setScalar(4.2);
  g.world.group.add(glow);
  // dal Parallelepipedo parte la musica (da dentro, ovattata)
  g.after(1.2, () => {
    g.audio.setMusicMuffle(900);
    g.audio.playMusic('club');
  });
}

// =========================================================================
// IL PARCO
// =========================================================================
function goPark(g: Game) {
  const A = g.world.anchors;
  g.fade(true);
  g.after(1.1, () => {
    leaveCar(g);
    g.audio.stopMusic();
    g.audio.setMusicMuffle(20000);
    // la strada resta lì: macchina, Scatola e chi c'era spariscono dalla scena
    REFS.car!.root.visible = false;
    REFS.scatola!.visible = false;
    for (const id of ['fluo', 'bruno', 'dario', 'barnie', 'luca', 'pastellone', 'px0', 'px1', 'px2', 'px3', 'px4', 'px5', 'nonnaMercato']) g.setHidden(g.npc(id), true);
    if (glow) {
      glow.removeFromParent();
      glow = null;
    }
    const p = g.player;
    p.floor = BASE_Y;
    p.pos.set(A.parkSpawn.x, BASE_Y, A.parkSpawn.z);
    p.vy = 0;
    p.setLook(A.parkLook);
    const marco = g.npc('marco');
    marco.controlled = false;
    if (marco.body instanceof Stickman) {
      marco.body.seated = false;
      marco.body.action = 'none';
    }
    marco.pos.set(A.parkSpawn.x + 1.5, BASE_Y, A.parkSpawn.z - 1.2);
    marco.setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2.2, speed: 3.6 });
    g.setStep('c6', 4);
    g.setCheckpoint(A.parkSpawn, A.parkLook, 'Ti rialzi nel parco');
    if (g.questActive('torta')) g.setStep('torta', 1, true);
    g.fade(false);
    g.chapter('Più tardi', 'Il parco di San Scarabocchio');
    g.audio.playMusic('paese');
    g.audio.addEmitter('fountain', A.fontana, 16, 0.8);
    g.after(3, () => marco.say('Mi siedo un attimo sulla panchina di Arturo. Me lo merito.', 4));
    // la posta e i tappi: com'è andata
    g.after(2.5, () => settleTappi(g));
    g.after(7, () => settlePosta(g));
  });
}

// Martina e il postino fanno sapere com'è andata (se il capitolo finisce prima, succede lì)
function settleTappi(g: Game) {
  if (!g.questActive('tappi')) return;
  const n = DRIVE.caps;
  g.phone('Martina', n >= 20 ? `${n} tappi?! Mi sa che ti sposo. Scherzo. Forse. Il mio tappo giallo me lo riporti sabato, alla sagra?` : n > 0 ? `${n} tappi! Grazie! E il mio tappo giallo me lo riporti sabato, alla sagra?` : 'Ho saputo che Don Fluo è tornato giallo. Il mio tappo me lo riporti sabato, alla sagra?');
  g.flag(`tappi_${n}`);
  if (n >= 20) g.flag('tappiMartina');
  g.addXp(Math.min(60, n * 3));
  g.completeQuest('tappi');
}

function settlePosta(g: Game) {
  if (!g.questActive('posta')) return;
  g.take('lettere');
  const d = DRIVE.delivered;
  g.phone('Il postino', d >= 8 ? 'Otto su otto! Nemmeno io! Vuoi un lavoro? Scherzo, il lavoro è mio.' : d > 0 ? `${d} lettere su 8 arrivate. Le altre le cerco io in primavera.` : 'Nessuna lettera arrivata. Va bene così: erano bollette.');
  g.addXp(d * 6);
  g.completeQuest('posta');
}

function arturo(): Dialogue {
  const marcoBody = (g: Game) => g.npc('marco').body as Stickman;
  return {
    name: 'Arturo',
    start: 'a',
    nodes: {
      a: {
        do: (g) => {
          // Marco va dritto dove dovrebbe esserci la panchina
          const m = g.npc('marco');
          m.setBehavior({ type: 'stand' });
          m.pos.set(REFS.bench.x, BASE_Y, REFS.bench.z);
          m.homeRot = Math.PI;
          m.body.root.rotation.y = Math.PI;
        },
        look: () => REFS.bench.clone().setY(BASE_Y + 0.3),
        say: [
          '@Marco| Finalmente. Mi siedo un attimo. Ho spinto una macchina per mezza città.',
          '* Marco si siede. Sul niente.',
        ],
        next: 'cade',
      },
      cade: {
        do: (g) => {
          marcoBody(g).ko = true;
          g.audio.land();
        },
        look: () => REFS.bench.clone().setY(BASE_Y + 0.3),
        say: [
          '* E cade.',
          '* La panchina non c\'è.',
          '* Al suo posto, un rettangolo di foglio più bianco del foglio. Tutto attorno, briciole grigie e arricciate.',
        ],
        next: 'arturo',
      },
      arturo: {
        say: [
          (g) => (g.questDone('filosofo') ? 'Ah, il giovane delle tre domande. Ecco la quarta: dov\'è la mia panchina?' : 'Ah. Siete voi.'),
          'Ero seduto qui. Stamattina.',
          'Poi non ero più seduto. È la prima volta che mi alzo senza averlo deciso.',
          '> Cos\'è successo?',
          'Non lo so. Ho sentito un rumore. Come qualcuno che strofina.',
          '@Marco| Briciole di gomma. Sono ancora calde.',
          '> Qualcuno ha cancellato una panchina.',
          'Una panchina oggi. Domani, chissà.',
          'Il foglio è grande. Ma non è infinito.',
        ],
        next: 'fine',
      },
      fine: {
        do: (g) => {
          g.audio.erase(0.6);
          marcoBody(g).ko = false;
        },
        say: ['* Da qualche parte, lontano, qualcosa strofina.'],
        next: 'end',
      },
      end: {
        say: [],
        do: (g) => {
          settleTappi(g);
          settlePosta(g);
          g.flag('arturoFatto');
          g.flag('c6Finale');
        },
      },
    },
  };
}
