import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Stickman } from '../../entities/stickman';
import type { Dialogue } from '../../game/dialogue';
import { CERA, THEME } from '../../render/palette';
import { HAND_FONT, MARKER_FONT } from '../../render/textures';
import { TOUCH } from '../../touch';
import { ROAD, S } from './road';
import { DRIVE } from './drive';

// ---------------------------------------------------------------------------
// Capitolo 6: in cima (Marco, Luca, il postino, la pasticcera, il geometra, un Pastello col
// giornale, un bambino), per strada (Barnie, una nonna sulle strisce, i Pastelli con la Scatola),
// in fondo (Don Fluo, Bruno, Dario) e nel parco (Arturo, Nonna Pina).
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// PNG sulla strada: posizione a (s, d), all'altezza giusta
function onRoad(g: Game, id: string, s: number, d: number, h = 0) {
  const n = g.npc(id);
  const p = ROAD.point(s, d, h);
  n.pos.copy(p);
  return n;
}

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];

  // =========================================================================
  // IN CIMA: LA PIAZZA DEL RIGHELLO
  // =========================================================================
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marco'),
    face: [0, 6],
    look: { hat: 'cap' },
    barks: (g) => (DRIVE.active ? [] : ['Terzo giorno. Giorno di consegne.', 'Luca è laggiù. Spinge anche da fermo.', 'Mi sento ottimista. È brutto segno?']),
    dialogue: {
      name: 'Marco',
      start: (g) => (g.is('introFatta') ? 'dopo' : 'intro'),
      nodes: {
        intro: {
          say: [
            'Buongiorno! Terzo giorno. Il giorno della consegna.',
            '> Don Fluo ha detto tre giorni. È oggi.',
            'Appunto: abbiamo tutta la giornata. Cioè: tutta la mattina. Cioè: dipende da quando è cominciato il primo giorno.',
            "> E come arriviamo a San Scarabocchio? È in fondo alla discesa. Proprio in fondo.",
            'Ho chiamato Luca.',
            '> Luca. Quello con la macchina senza motore.',
            'Esatto! È arrivato stanotte. A spinta. Da San Scarabocchio.',
            '> Ma è tutta salita!',
            "Gliel'ho detto anch'io. Lui ha detto \"ah\" e ha continuato a spingere.",
            'È laggiù, dietro la macchina. Si riconosce perché spinge.',
          ],
          do: (g) => g.flag('introFatta'),
        },
        dopo: { say: [pick(['Vai da Luca! Io intanto mi scaldo le braccia.', 'Hai il tappo? Fammelo vedere. No, non toccarlo. Sì, è lui.', 'Se qualcuno ti chiede di portare qualcosa giù: di\' di sì. Siamo gentili, oggi.'])] },
      },
    },
  });

  g.addNpc({
    id: 'luca',
    name: 'Luca',
    pos: at('luca'),
    face: [0, 20],
    look: { hat: 'cap' },
    action: 'push',
    faceWhenNear: false,
    icon: (g) => (g.quest('c6') === 0 ? 'main' : null),
    barks: (g) => (DRIVE.active ? [] : ['Forza... forza...', 'Si è mossa? No.', 'Stanotte abbiamo fatto tutta la salita. Io e lei.']),
    dialogue: {
      name: 'Luca',
      start: (g) => (g.quest('c6') >= 1 ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Ciao Stecco. Ho spinto tutta la notte.',
            '> Da San Scarabocchio fin quassù?',
            'Sì. A metà strada mi sono accorto che era in salita. Ormai ero a metà.',
            '> E adesso?',
            'Adesso torniamo giù. Io spingo, Marco spinge, tu sterzi.',
            '> Luca. Al ritorno è discesa.',
            '...E quindi?',
            '> In discesa le macchine vanno da sole.',
            '* Luca guarda la macchina. La macchina guarda Luca. O almeno, così sembra.',
            'Non lo so. Non ci sono mai salito, sulla mia macchina.',
            '> Mai?',
            'Qualcuno deve spingere.',
          ],
          choices: [
            { t: 'Come si guida?', next: 'guida' },
            { t: 'Andiamo.', next: 'via' },
          ],
        },
        guida: {
          say: [
            'Il volante è quello rotondo. Il freno è il pedale disegnato meglio.',
            "L'acceleratore non c'è. Non serviva: non c'è il motore.",
            'Il clacson nemmeno. Se vuoi suonare, di\' "bip". Io faccio così da sempre.',
            '> E se si ferma?',
            'Se si ferma, spingiamo. È la parte che mi viene meglio.',
          ],
          next: 'via',
        },
        via: {
          say: ['Sali pure. Il posto di guida è quello col volante davanti.'],
          do: (g) => g.setStep('c6', 1),
        },
        dopo: { say: [pick(['Sali quando vuoi. Il volante è quello rotondo.', 'Io sono pronto. Sono nato pronto. Sono nato spingendo.'])] },
      },
    },
  });

  // il postino: la posta della discesa
  g.addNpc({
    id: 'postino',
    name: 'Il postino',
    pos: at('postino'),
    face: [0, -4],
    look: { hat: 'cap', mustache: true },
    icon: (g) => (g.quest('posta') === -1 ? 'side' : null),
    barks: () => ['Posta! Posta per tutti! Tranne che per me.', 'Ho la gamba disegnata storta. Da stamattina.', 'Chi scende? Qualcuno scende?'],
    dialogue: {
      name: 'Il postino',
      start: (g) => (g.quest('posta') === -1 ? 'a' : 'dopo'),
      nodes: {
        a: {
          say: [
            'Tu! Sei quello che scende a San Scarabocchio in macchina?',
            '> Più o meno. La macchina non ha il motore.',
            'Meglio: fa meno rumore. Io ho una gamba disegnata storta e dieci lettere per le case della discesa.',
            'Le cassette sono blu. Tu passi, lanci, e la lettera entra. È il mestiere più facile del mondo. Se non lo fai tu.',
          ],
          choices: [
            { t: 'Dammele, ci penso io.', next: 'si' },
            { t: 'Non so mirare.', next: 'mira' },
            { t: 'Non ho tempo.' },
          ],
        },
        mira: {
          say: ['Nessuno sa mirare. Per questo gli indirizzi si scrivono grandi.'],
          choices: [
            { t: 'Va bene, dammele.', next: 'si' },
            { t: 'No, davvero.' },
          ],
        },
        si: {
          say: [
            'Ecco. Dieci lettere per otto cassette. Due sono di scorta: non sei il primo che ci prova.',
            TOUCH ? 'Guardi la cassetta e premi LANCIA. Lei fa il resto. Più o meno.' : 'Guardi la cassetta e fai click. Lei fa il resto. Più o meno.',
            'Tre monete per ogni lettera che entra. Le altre... le cerco io in primavera.',
          ],
          do: (g) => {
            g.give('lettere');
            DRIVE.letters = 10;
            g.startQuest('posta');
          },
        },
        dopo: { say: ['Mira alle cassette blu. Quelle rosse sono dei vicini, e i vicini leggono tutto.'] },
      },
    },
  });

  // la pasticcera: la torta per Nonna Pina
  g.addNpc({
    id: 'pasticcera',
    name: 'La pasticcera',
    pos: at('pasticcera'),
    face: [-14, -20],
    look: { hat: 'bun' },
    icon: (g) => (g.quest('torta') === -1 ? 'side' : null),
    barks: () => ['Torte quadrate! Si tagliano da sole!', 'Pasticceria Squadrata: niente angoli smussati.', 'Qualcuno scende a San Scarabocchio?'],
    dialogue: {
      name: 'La pasticcera',
      start: (g) => (g.quest('torta') === -1 ? 'a' : 'dopo'),
      nodes: {
        a: {
          say: [
            'Pasticceria Squadrata! Torte quadrate, come si usa a Quadropoli.',
            'Tu scendi a San Scarabocchio? Ho una torta per Nonna Pina. Tre piani. Quadrata.',
            'Se arriva intera ti paga lei. Se arriva a pezzi è un puzzle: glielo spieghi tu.',
          ],
          choices: [
            { t: 'La porto io.', next: 'si' },
            { t: 'Perché proprio io?', next: 'perche' },
            { t: 'Guido malissimo.', next: 'male' },
          ],
        },
        perche: {
          say: ["Perché sei l'unico che scende. Qui salgono tutti e basta. È una città in salita."],
          choices: [
            { t: 'Va bene, la porto.', next: 'si' },
            { t: 'Meglio di no.' },
          ],
        },
        male: {
          say: ['Allora guida piano. Ogni botta forte, un piano in meno.'],
          choices: [
            { t: 'Ci provo.', next: 'si' },
            { t: 'Meglio di no.' },
          ],
        },
        si: {
          say: [
            'Tre piani. Ogni botta forte, un piano in meno. Tre botte ed è una crostata.',
            "Nonna Pina di solito è al parco. Vicino alla panchina del filosofo, quello che sta sempre seduto.",
          ],
          do: (g) => {
            g.give('torta');
            DRIVE.torta = 3;
            g.startQuest('torta');
          },
        },
        dopo: { say: ['Piano sulle curve! La panna non ha le cinture.'] },
      },
    },
  });

  // il geometra (consigli di guida)
  g.addNpc({
    id: 'geometra',
    name: 'Il geometra',
    pos: at('geometra'),
    face: [0, 30],
    look: { hat: 'beret', mustache: true },
    action: 'think',
    barks: () => ['Dieci per cento. Più o meno.', 'Tutto è un triangolo, se lo guardi bene.', 'Questa strada l\'ho progettata io. Più o meno.'],
    dialogue: {
      name: 'Il geometra',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Sto misurando la pendenza della Via Ripida.',
            '> Quanto fa?',
            'Dieci per cento. Arrotondato per eccesso, per sicurezza. Per difetto, per ottimismo.',
            '> Consigli per scenderla senza motore?',
            'Frena prima delle curve, non dentro. Dentro è tardi. Dopo è tardissimo.',
            'E in fondo al mercato c\'è una salita: arrivaci veloce. È tutta una questione di triangoli.',
          ],
        },
      },
    },
  });

  // un Pastello che "legge il giornale" (vi stava cercando)
  g.addNpc({
    id: 'pVerdeGiornale',
    name: 'Un lettore',
    pos: at('verde'),
    face: [0, 4],
    behavior: { type: 'sit' },
    look: { highlighter: CERA.verde, hat: 'crayon' },
    action: 'read',
    faceWhenNear: false,
    barks: () => ['Io non vi ho visti.', 'Leggo. Solo leggo.', 'Che belle notizie. Tutte al contrario.'],
    dialogue: {
      name: 'Un lettore',
      start: 'a',
      nodes: {
        a: {
          say: [
            "* Un Pastello Verde legge il giornale su una panchina. Il giornale ha due buchi all'altezza degli occhi.",
            'Io non vi ho visti.',
            '> Non ho detto niente.',
            'Appunto. Nemmeno io. Sto leggendo.',
            '> Il giornale è al contrario.',
            '...Le notizie sono più belle al contrario. Vai via.',
          ],
        },
      },
    },
  });
  g.npc('pVerdeGiornale').homeRot = Math.PI / 2;
  // il giornale: al contrario, con due buchi per gli occhi
  const verde = g.npc('pVerdeGiornale').body;
  if (verde instanceof Stickman) {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.52),
      new THREE.MeshBasicMaterial({ map: newspaperTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    );
    paper.name = 'giornale';
    paper.position.set(0, 0.8, 0.3);
    paper.rotation.x = -0.12;
    verde.torso.add(paper);
  }

  g.addNpc({
    id: 'bimbo',
    name: 'Un bambino',
    pos: at('bimbo'),
    face: [0, 0],
    look: { hat: 'cap', scale: 0.72 },
    barks: () => ['Tac-tac-tac-tac!', 'Il mio skate ha le ruote quadrate.', 'In discesa va tutto!'],
    dialogue: {
      name: 'Un bambino',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Il mio skate ha le ruote quadrate. Qui a Quadropoli è normale.',
            '> E va?',
            'Fa tac-tac-tac. Però in discesa va. In discesa va tutto.',
            '> Anche una macchina senza motore?',
            'Soprattutto. Il motore in discesa è inutile. Lo dice sempre mio papà, che non ha la macchina.',
          ],
        },
      },
    },
  });

  // =========================================================================
  // PER STRADA
  // =========================================================================
  g.addNpc({
    id: 'barnie',
    name: 'Barnie',
    pos: [0, 0],
    look: { hat: 'beanie', beard: true, scale: 1.5 },
    action: 'wave',
    faceWhenNear: false,
    barks: () => (DRIVE.barnie === 'aboard' ? [] : ['Passaggio?', 'Vado giù. Tutto giù.', 'Non mordo. Gioco a freccette.']),
  });
  onRoad(g, 'barnie', S.barnie, -6.9);
  g.npc('barnie').body.root.rotation.y = ROAD.at(S.barnie).th + Math.PI / 2;

  g.addNpc({
    id: 'nonnaMercato',
    name: 'Signora Ines',
    pos: [0, 0],
    look: { hat: 'bun' },
    action: 'cane',
    faceWhenNear: false,
    barks: () => ['Le strisce sono sacre!', 'Ai miei tempi le macchine avevano il motore. E rispetto.'],
  });
  onRoad(g, 'nonnaMercato', S.mercato + 72, -8.5, 0.15);

  // i Pastelli della Scatola (spuntano quando parte l'inseguimento)
  const colors = [CERA.rosso, CERA.blu, CERA.verde, CERA.arancione, CERA.marrone, '#47a7d8'];
  colors.forEach((c, i) =>
    g.addNpc({
      id: `px${i}`,
      name: 'Pastello',
      pos: [0, -60 - i],
      hidden: true,
      look: { highlighter: c, hat: 'crayon' },
      faceWhenNear: false,
      barks: () => [],
    }),
  );
  g.addNpc({
    id: 'pastellone',
    name: 'Il Pastellone',
    pos: [0, -70],
    hidden: true,
    look: { highlighter: CERA.viola, hat: 'crayon', scale: 1.4 },
    faceWhenNear: false,
    barks: () => [],
  });

  // =========================================================================
  // IN FONDO: il Parallelepipedo e il pub di Dario
  // =========================================================================
  const fluoAt = ROAD.at(S.fluo);
  g.addNpc({
    id: 'fluo',
    name: 'Don Fluo',
    pos: [0, 0],
    look: { highlighter: '#eef3b8', hat: 'top', sunglasses: true, mustache: true, scale: 1.35 },
    action: 'crossed',
    faceWhenNear: false,
    barks: () => [],
  });
  onRoad(g, 'fluo', S.fluo, fluoAt.hw + 1.4, 0.15);
  g.npc('fluo').body.root.rotation.y = fluoAt.th - Math.PI / 2;
  g.addNpc({
    id: 'bruno',
    name: 'Bruno',
    pos: [0, 0],
    look: { sunglasses: true, scale: 1.3 },
    action: 'crossed',
    faceWhenNear: false,
    barks: () => ['...', 'Il capo aspetta.'],
  });
  onRoad(g, 'bruno', S.fluo + 4, fluoAt.hw + 1.5, 0.15);
  g.npc('bruno').body.root.rotation.y = fluoAt.th - Math.PI / 2;
  const darioAt = ROAD.at(S.dario);
  g.addNpc({
    id: 'dario',
    name: 'Dario',
    pos: [0, 0],
    look: { hat: 'hair', mustache: true },
    faceWhenNear: false,
    barks: () => ['Si apre stasera!', 'Gazzosa alla spina, stasera.'],
  });
  onRoad(g, 'dario', S.dario + 2, -(darioAt.hw + 1.3), 0.15);
  g.npc('dario').body.root.rotation.y = darioAt.th + Math.PI / 2;

  // =========================================================================
  // IL PARCO
  // =========================================================================
  g.addNpc({
    id: 'filosofo',
    name: 'Arturo il Filosofo',
    pos: at('arturo'),
    face: [A.parkLook.x, A.parkLook.z],
    look: { beard: true },
    action: 'think',
    faceWhenNear: false,
    barks: () => ['Ero seduto. Poi non più.', 'Strofinava. Qualcosa strofinava.', 'Una panchina non se ne va da sola. Non ha le gambe. Cioè, sì, ma non le usa.'],
  });
  g.npc('filosofo').pos.y = A.arturo.y;
  g.addNpc({
    id: 'pina',
    name: 'Nonna Pina',
    pos: at('pina'),
    face: [A.pina.x + 5, A.pina.z],
    behavior: { type: 'sit' },
    look: { hat: 'bun' },
    icon: (g) => (g.quest('torta') === 1 ? 'turnin' : null),
    barks: () => ['Pallino, le briciole grigie no!', 'Che mattina strana.', 'Arturo è in piedi. Non l\'ho mai visto in piedi.'],
    dialogue: pinaDialogue(),
  });
  g.npc('pina').pos.y = A.pina.y;
  g.npc('pina').homeRot = Math.PI / 2;
  g.addNpc({ id: 'pallino', name: 'Pallino', pos: at('pallino'), dog: true, behavior: { type: 'circle', cx: A.pallino.x, cz: A.pallino.z, r: 1.4, speed: 1.2 }, barks: () => ['Bau.'] });
  g.npc('pallino').pos.y = A.pallino.y;
}

function pinaDialogue(): Dialogue {
  const pay = (coins: number, xp: number) => (g: Game) => {
    g.take('torta');
    g.addCoins(coins);
    g.addXp(xp);
    g.completeQuest('torta');
  };
  return {
    name: 'Nonna Pina',
    start: (g) => (g.quest('torta') === 1 && g.has('torta') ? (DRIVE.torta >= 3 ? 't3' : DRIVE.torta > 0 ? 't2' : 't0') : 'a'),
    nodes: {
      t3: {
        say: [
          'Una torta! Quadrata! Da Quadropoli!',
          'Tre piani, tutti interi. Giovanotto, tu guidi come un autobus di linea. Quelli bravi.',
          'Tieni: venti monete. E un pezzo di torta. Disegnato, ma si mangia con gli occhi.',
        ],
        do: pay(20, 35),
      },
      t2: {
        say: ['Una torta! Un po\' storta.', 'Ne aveva tre, di piani. Lo so: il terzo lo sento che manca.', 'Dieci monete. E grazie lo stesso: ci hai provato.'],
        do: pay(10, 20),
      },
      t0: {
        say: ['Una crostata! Da Quadropoli!', '> Era una torta.', 'Adesso è una crostata. Le crostate mi piacciono di più. Tieni cinque monete, e non dirlo alla pasticcera.'],
        do: pay(5, 10),
      },
      a: {
        say: [
          'Stecco! Stamattina Arturo era agitatissimo. Non l\'ho mai visto in piedi.',
          'Dice che gli hanno portato via la panchina. Mentre ci stava seduto.',
          'Pallino, le briciole grigie no! Non si sa cosa sono!',
        ],
      },
    },
  };
}

// Il giornale del Pastello: "La Gazzetta Quadrata", tenuto al contrario, coi buchi per gli occhi
function newspaperTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 184;
  const ctx = c.getContext('2d')!;
  ctx.translate(128, 92);
  ctx.rotate(Math.PI); // al contrario
  ctx.translate(-128, -92);
  ctx.fillStyle = '#f4f0e2';
  ctx.fillRect(0, 0, 256, 184);
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, 250, 178);
  ctx.fillStyle = THEME.inkHex;
  ctx.font = `30px ${MARKER_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('LA GAZZETTA', 128, 38);
  ctx.font = `20px ${HAND_FONT}`;
  ctx.fillText('QUADRATA', 128, 60);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 70);
  ctx.lineTo(242, 70);
  ctx.stroke();
  // colonne di righe scarabocchiate
  for (let col = 0; col < 3; col++) {
    for (let r = 0; r < 8; r++) {
      const x = 16 + col * 80, y = 84 + r * 11;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 62 - ((r * 7 + col * 3) % 18), y);
      ctx.stroke();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // i buchi (dove ci sono gli occhi del lettore)
  ctx.globalCompositeOperation = 'destination-out';
  for (const x of [108, 148]) {
    ctx.beginPath();
    ctx.arc(x, 80, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
