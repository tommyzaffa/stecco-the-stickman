import type { Game } from '../../game/game';
import { CERA } from '../../render/palette';
import { TOUCH } from '../../touch';
import { parryName } from '../../settings';
import { TRAY } from './tray';
import { dartsLosses, playDarts } from './darts';
import { afterDarts, startWater } from './story';
import { STAGE, TABLES } from './world';

// ---------------------------------------------------------------------------
// Capitolo 9: da Dario. Dario al bancone, Barnie alle freccette, Marco e Martina al tavolo della
// squadra, le Biro Blu (squadra "Verbale Unico") e i Pastelli a Cera ("I Temperati") agli altri
// tavoli, il signor Righetti vicino al jukebox. E alla fine, la mamma di Marco.
// ---------------------------------------------------------------------------

const ROSA_PASTELLO = '#f4a3c4';
const BIRO_BLU = '#4d7cf0';
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// chi sta seduto a quale tavolo (si guardano tra loro, attorno al tavolo)
const SEATS: Record<string, { x: number; z: number }> = {
  marco: TABLES.team, martina: TABLES.team,
  penna: TABLES.biro, pennino: TABLES.biro,
  pRosso: TABLES.pastelli, pGiallo: TABLES.pastelli, pBlu: TABLES.pastelli,
};

// seduto su uno sgabello (alto: 25 cm più su del pavimento), girato verso il suo tavolo
export function seat(g: Game, id: string) {
  const A = g.world.anchors;
  const n = g.npc(id);
  n.pos.set(A[id].x, A[id].y, A[id].z);
  n.setBehavior({ type: 'sit' });
  n.homeRot = Math.atan2(SEATS[id].x - n.pos.x, SEATS[id].z - n.pos.z);
  n.body.root.rotation.y = n.homeRot;
}

// durante il quiz tutti i seduti guardano il palco; poi tornano a guardarsi attorno al tavolo
export function seatedLook(g: Game, where: 'table' | 'stage') {
  for (const id of Object.keys(SEATS)) {
    const n = g.npc(id);
    if (n.hidden || n.behavior.type !== 'sit') continue;
    const t = where === 'stage' ? STAGE : SEATS[id];
    n.homeRot = Math.atan2(t.x - n.pos.x, t.z - n.pos.z);
  }
}

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];

  // =========================================================================
  // DARIO (dietro il bancone)
  // =========================================================================
  g.addNpc({
    id: 'dario',
    name: 'Dario',
    pos: at('dario'),
    face: [A.dario.x, A.dario.z + 5],
    look: { hat: 'hair', mustache: true },
    talkRadius: 3.4,
    icon: (g) =>
      g.quest('fragola') === 1 ? 'turnin' : g.is('c9Gazzosa') && g.quest('acqua') === -1 && !g.is('c9Chiuso') ? 'side' : null,
    barks: (g) =>
      g.is('c9Chiuso')
        ? []
        : g.is('c9Gazzosa')
          ? ['Acqua! Chi vuole acqua? Nessuno. Come sempre.', 'La Gazzosa Gigante: tre litri, una cannuccia, nessun rimpianto. Qualche singhiozzo.', 'Barnie, lascia vincere qualcuno. Una volta. Per la clientela.']
          : ['Gazzosa alla spina! Frizzante, molto frizzante, Gigante.', 'Il quiz comincia tra poco. Le risposte sono sul cartoncino. Il cartoncino è mio.', 'Il jukebox salta. Lo so. Lo sanno tutti.'],
    dialogue: {
      name: 'Dario',
      start: (g) =>
        g.quest('fragola') === 1
          ? 'fragola'
          : g.is('c9Gazzosa') && g.quest('acqua') === -1
            ? 'acqua'
            : g.questActive('acqua')
              ? 'acquaDopo'
              : !g.is('c9DarioCiao')
                ? 'ciao'
                : 'dopo',
      nodes: {
        ciao: {
          say: [
            'Stecco! Sei venuto. Benvenuto da Dario: pub, gazzosa, freccette. In quest\'ordine, di solito.',
            '> Bel posto.',
            'L\'ho disegnato io. Cioè: me l\'hanno disegnato, ma le lampadine le ho scelte io.',
            'Marco e la signorina sono già al tavolo. Il quiz comincia appena ti siedi: vi aspettavo per le squadre da tre.',
            (g) => (g.questDone('jukebox') ? 'E il jukebox va! Qualcuno gli ha dato il pugno giusto.' : 'Ah, e il jukebox salta. Il disco è rigato. Righetti dice che basta un pugno di lato, ma lui è pacifista e io ho la mano delicata. Cioè: non ho la mano.'),
          ],
          do: (g) => {
            g.flag('c9DarioCiao');
            if (g.quest('jukebox') === -1 && !g.is('c9JukeboxOk')) g.startQuest('jukebox');
          },
        },
        acqua: {
          say: [
            'Stecco. Guardati. Guarda Marco: sta parlando con lo sgabello.',
            'Ci vuole acqua. Tre bicchieri, per la squadra. Il vassoio è sul bancone: io non posso lasciare la spina, la spina scappa.',
            '> Il vassoio? Io non ho mani.',
            'Nessuno qui ha le mani. Il vassoio si porta con equilibrio: piano, senza girarti di colpo, senza correre.',
            (_g) => `E se ti gira la testa, concentrati: tieni premuto ${TOUCH ? 'PARA' : parryName()}. Vai più piano, ma dritto.`,
          ],
          do: (g) => startWater(g),
        },
        acquaDopo: {
          say: [(_g) => (TRAY.held ? 'Piano! Il vassoio ha tre bicchieri e nessuna pazienza.' : 'Il vassoio è sul bancone. Tre bicchieri. Si portano, non si bevono per strada.')],
        },
        fragola: {
          say: [
            '> Dario. Chi era seduto al tavolo in fondo? Quello con le briciole rosa.',
            'Il sette? Una cliente nuova. Stasera, prima che arrivaste. Una signora... tonda. Rosa. Morbida, direi.',
            'Profumava di fragola. Ha ordinato niente, ha pagato con niente, e mi ha chiesto una cosa sola: dov\'è Via dei Temperini.',
            '> E tu?',
            'Gliel\'ho detto. Qui dietro, dopo la casa della signorina. È un quartiere tranquillo.',
            'Era. Cioè: è. Perché ho detto "era"?',
            'Ha lasciato questo. Mezzo sottobicchiere. L\'altra metà non c\'è: non rotta. Non c\'è.',
          ],
          do: (g) => {
            g.give('mezzoSottobicchiere');
            g.flag('fragolaPub');
            g.addXp(40);
            g.completeQuest('fragola');
          },
        },
        dopo: {
          say: [
            (g) =>
              g.is('c9Chiuso')
                ? 'Si chiude. Riportali a casa, Stecco. Tutti e due. Nell\'ordine che preferisci, ma tutti e due.'
                : g.questDone('c9') || g.quest('c9') >= 3
                  ? 'Domani riapro. Le case dei Temperini, invece, non so.'
                  : g.is('c9Gazzosa')
                    ? pick(['Barnie ti aspetta alle freccette. Si sta scaldando il braccio. Da stamattina.', 'La Gazzosa Gigante non si restituisce. Nemmeno le bollicine.'])
                    : pick(['Siediti col tuo tavolo, il quiz aspetta te.', 'Le domande le ho scritte io. Le risposte anche. Sono imbattibile e non posso giocare.']),
          ],
        },
      },
    },
  });

  // =========================================================================
  // BARNIE (vicino al bersaglio)
  // =========================================================================
  g.addNpc({
    id: 'barnie',
    name: 'Barnie',
    pos: at('barnie'),
    face: [A.barnie.x - 3, A.barnie.z + 2],
    look: { hat: 'beanie', beard: true, scale: 1.5 },
    action: 'drink',
    talkRadius: 3,
    icon: (g) => (g.quest('c9') === 2 ? 'main' : null),
    barks: (g) =>
      g.questDone('c9') || g.is('c9Barnie')
        ? ['Hai vinto. Il centro ti vuole bene. Un po\'. Meno che a me.', 'Stasera dormo. Domani mi alleno. Dopodomani vinco.']
        : ['Freccette. Io. Tu. Tutti.', 'Il centro mi vuole bene.', 'Undici serate. Undici. Il bersaglio mi chiama per nome.'],
    dialogue: {
      name: 'Barnie',
      start: (g) => (g.is('c9Barnie') ? 'dopo' : g.quest('c9') < 2 ? 'prima' : dartsLosses() > 0 ? 'rivincita' : 'sfida'),
      nodes: {
        prima: {
          say: [
            'Il ragazzo del passaggio. Ciao.',
            'Dopo il quiz, la finale di freccette. Io contro tutti. Scusa: vinco io.',
            'Se vuoi allenarti, la linea è quella. OCHE. Si tira da lì. Non si passa.',
          ],
        },
        sfida: {
          say: [
            'La finale. Tre turni, tre freccette a turno. Tiro prima io. Poi tu. Chi fa più punti vince.',
            'Chi mi batte si prende il Sottobicchiere d\'Oro. È di cartone. Dipinto d\'oro. Con la vernice di Don Fluo.',
            (g) => (g.has('freccetta') ? 'Ce l\'hai ancora, la mia freccetta. Quella del passaggio. Tirala per prima: sa la strada.' : 'La mia freccetta portafortuna l\'ho regalata. A uno che guidava senza motore.'),
            (_g) => `Consiglio: col capogiro la vista balla. Trattieni il fiato (${TOUCH ? 'FIATO' : parryName()}, tenuto premuto) e tira quando è ferma. Il fiato finisce. Io non respiro mai, quando tiro.`,
          ],
          choices: [
            { t: 'Giochiamo.', next: 'via' },
            { t: 'Prima mi alleno.', next: 'dopoAllenamento' },
          ],
        },
        rivincita: {
          say: [
            (_g) => pick(['Rivincita? Va bene. Sono stanco, ma non si vede.', 'Ancora? Mi piaci. Perdi con impegno.', 'Rivincita. Il centro si è addormentato un po\'. Anche io.']),
          ],
          choices: [
            { t: 'Rivincita.', next: 'via' },
            { t: 'Dopo.', next: 'dopoAllenamento' },
          ],
        },
        dopoAllenamento: { say: ['Sono qui. Sono sempre qui, vicino al bersaglio. Come un cane da guardia. Buono.'] },
        via: {
          say: ['* Barnie prende tre freccette dal barattolo. Le guarda come si guardano dei vecchi amici.'],
          do: (g) => g.after(0.2, () => playDarts(g, 'final', (r) => afterDarts(g, r))),
        },
        dopo: {
          say: [
            (_g) => pick(['Undici serate e poi tu. Va bene. Il bersaglio ha bisogno di cambiare.', 'Il Sottobicchiere d\'Oro. Tienilo lontano dall\'acqua. È di cartone.']),
          ],
        },
      },
    },
  });

  // =========================================================================
  // MARCO E MARTINA (al tavolo della squadra)
  // =========================================================================
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marco'),
    look: { hat: 'cap' },
    barks: (g) =>
      g.quest('c9') >= 3
        ? ['Stecco. La strada si muove. O siamo noi?', 'Io cammino dritto. È la strada che è storta.', 'Hic. Scusa. Hic. Non sono io, sono le bollicine.', 'Mia mamma è sveglia. Lo sento. Le mamme lo sentono, e io sento che lo sentono.']
        : g.is('c9Gazzosa')
          ? ['Hic.', 'Stecco, il pavimento è a righe. Da quando il pavimento è a righe?', 'Ho parlato con lo sgabello. È simpatico. Un po\' rigido.', 'La Gazzosa Gigante mi guarda. È vuota e mi guarda.']
          : ['Stecco! Qui! Il tavolo della vittoria!', 'Il quiz è facile. Basta sapere le risposte.', 'Io sono bravo nelle domande. Nelle risposte un po\' meno.'],
    dialogue: {
      name: 'Marco',
      start: (g) => (g.quest('c9') <= 1 ? 'prima' : g.quest('c9') >= 3 ? 'strada' : 'pub'),
      nodes: {
        prima: {
          say: [
            'Stecco! Siediti, dai. Il quiz! Ho già deciso il nome della squadra. Anzi, ne ho decisi tre.',
            'Martina dice che sono tutti brutti. Martina ha ragione, ma sono miei.',
          ],
        },
        pub: {
          say: [
            (g) =>
              g.is('c9Barnie')
                ? 'Hai battuto Barnie! Io lo sapevo. Cioè: lo speravo. Cioè: ero al bagno.'
                : pick(['Barnie non ha mai perso. Mai. Una volta ha pareggiato con se stesso.', 'Se vinci il Sottobicchiere d\'Oro, lo appendiamo in camera mia. È la stanza più grande. Dopo il bagno.', 'Hic. Scusa. Dicevo: vai e vinci.']),
          ],
        },
        strada: {
          say: [(_g) => pick(['Sto benissimo. Guarda: una gamba, poi l\'altra, poi di nuovo la prima.', 'Casa mia è di là dal canale. Il canale però non c\'era, prima. O sì?', 'Stecco. Grazie. Per tutto. Anche per le cose che non ricordo.'])],
        },
      },
    },
  });
  seat(g, 'marco');

  g.addNpc({
    id: 'martina',
    name: 'Martina',
    pos: at('martina'),
    look: { highlighter: ROSA_PASTELLO, hat: 'pencil', eyes: true },
    barks: (g) =>
      g.quest('c9') >= 3
        ? ['Cammino benissimo. È il marciapiede che fa le onde.', 'Le stelle stasera sono disegnate a mano. Si vede: una è storta.', 'Hic. Oh. Scusa. Le matite colorate non fanno "hic". Di solito.']
        : g.is('c9Gazzosa')
          ? ['Il pentagramma sul muro sta suonando. O sono io.', 'Hic. Oddio. Non l\'hai sentito.', 'Tre litri. Una cannuccia. Chi l\'ha inventata va arrestato. Dopo averlo ringraziato.']
          : ['Stecco! Ti ho tenuto il posto. Cioè: ci ho messo sopra la borsa. Non ho la borsa.', 'Marco vuole chiamare la squadra "Marco e gli altri due". Fermalo.', 'Al quiz ci sono le Biro Blu. Non sbagliano mai. Scrivono tutto.'],
    dialogue: {
      name: 'Martina',
      start: (g) => (g.quest('c9') <= 1 ? 'prima' : g.quest('c9') >= 3 ? 'strada' : 'pub'),
      nodes: {
        prima: {
          say: [
            'Eccoti. Siediti: le Biro Blu hanno già scritto le risposte che daranno. Tutte. In bella copia.',
            'I Pastelli invece rispondono con un colore. A qualsiasi domanda. Ogni tanto ci prendono.',
          ],
        },
        pub: {
          say: [
            (g) =>
              g.is('c9Barnie')
                ? 'Hai battuto Barnie. Col capogiro. Stecco, tu sei pieno di sorprese. E di gazzosa.'
                : pick(['Vai, campione. Io tifo da qui. Seduta. Il pavimento ondeggia.', 'Barnie è gentile anche quando vince. Soprattutto quando vince.', 'Non guardare me, guarda il bersaglio. Cioè: guarda me dopo.']),
          ],
        },
        strada: {
          say: [(_g) => pick(['Grazie per la serata. È stata strana. Mi piacciono le serate strane.', 'Casa mia è quella con la collezione in finestra. Si vedono i tappi, da fuori.', 'Hic. Non ridere.'])],
        },
      },
    },
  });
  seat(g, 'martina');

  // =========================================================================
  // LE ALTRE SQUADRE DEL QUIZ
  // =========================================================================
  g.addNpc({
    id: 'penna',
    name: 'Ispettore Penna',
    pos: at('penna'),
    look: { highlighter: BIRO_BLU, hat: 'police', mustache: true },
    action: 'read',
    barks: (g) =>
      g.is('c9Quiz')
        ? ['Il quiz è verbalizzato. Il verbale è in triplice copia. Una copia l\'ho mangiata.', 'Pareggiare è un reato? No. Ma lo sto valutando.']
        : ['Squadra "Verbale Unico". Siamo pronti. Abbiamo le risposte in bella.', 'Le gazzose vanno bevute seduti. Articolo 12. L\'ho appena scritto.'],
    dialogue: {
      name: 'Ispettore Penna',
      start: 'a',
      nodes: {
        a: {
          say: [
            (g) =>
              g.is('c9Quiz')
                ? g.is('c9QuizVinto')
                  ? 'Complimenti per la vittoria. È stata regolare. Purtroppo. L\'ho controllato tre volte.'
                  : 'Abbiamo vinto il quiz. Come da previsione. La previsione l\'avevo verbalizzata ieri.'
                : 'Stecco. Stasera sono fuori servizio. Il che significa che scrivo verbali per hobby.',
            '@Pennino| Io scrivo quelli che lui detta. Anche quando non detta.',
          ],
        },
      },
    },
  });
  seat(g, 'penna');
  g.addNpc({
    id: 'pennino',
    name: 'Pennino',
    pos: at('pennino'),
    look: { highlighter: BIRO_BLU, hat: 'police', scale: 0.8 },
    action: 'read',
    barks: () => ['Scrivo. Sempre. Anche adesso.', 'Il capo dice che il quiz è una forma di verbale. Con le domande.', 'Io ho un tappo blu. Si mastica. Non ditelo al capo.'],
  });
  seat(g, 'pennino');

  const pastelli: [string, string, string][] = [
    ['pRosso', 'Pastello Rosso', CERA.rosso],
    ['pGiallo', 'Pastello Giallo', '#e8c21e'],
    ['pBlu', 'Pastello Blu', CERA.blu],
  ];
  for (const [id, name, color] of pastelli) {
    g.addNpc({
      id,
      name,
      pos: at(id),
      look: { highlighter: color, hat: 'crayon' },
      barks: (g) =>
        g.is('c9Quiz')
          ? ['Abbiamo risposto "blu" a tutto. Due punti. Il blu funziona.', 'Il Pastellone ci ha detto di non vincere niente di troppo grosso. Ubbidiamo.', 'Gazzosa! Colorata! Cioè no. Ma la immaginiamo arancione.']
          : ['Squadra "I Temperati"! Siamo appuntiti!', 'Stasera niente guai. Stasera quiz.', 'Il Pastellone ci ha dato la serata libera. Fino alle dieci.'],
      dialogue: {
        name,
        start: 'a',
        nodes: {
          a: {
            say: [
              (_g) => pick([
                'Stecco! Niente pistole stasera, eh. Stasera siamo una squadra del quiz. "I Temperati".',
                'La sagra, la ruota, il tappo... ci siamo stancati di rincorrerti. Adesso rincorriamo le risposte.',
                'Il segreto del quiz è rispondere con un colore. Il blu va bene quasi sempre. Il cielo, il mare, le Biro.',
              ]),
            ],
          },
        },
      },
    });
    seat(g, id);
  }

  // =========================================================================
  // IL SIGNOR RIGHETTI (vicino al jukebox)
  // =========================================================================
  g.addNpc({
    id: 'righetti',
    name: 'Il signor Righetti',
    pos: [-8.2, 0.9],
    face: [-9.5, 2],
    look: { hat: 'top' },
    action: 'think',
    icon: (g) => (g.quest('jukebox') === -1 && !g.is('c9JukeboxOk') ? 'side' : null),
    barks: (g) =>
      g.is('c9JukeboxOk')
        ? ['Adesso sì. Adesso posso ascoltare seduto.', 'Un pugno ben dato è musica. Io però resto pacifista.']
        : ['Ta-ta-ta. Ta-ta-ta. È così da un\'ora. Il disco salta.', 'Il jukebox vuole un pugno. Di lato. Lo so perché gliel\'ho chiesto.'],
    dialogue: {
      name: 'Il signor Righetti',
      start: (g) => (g.is('c9JukeboxOk') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Senti? Ta-ta-ta. Ta-ta-ta. Il disco è rigato. Salta sempre nello stesso punto.',
            'Ci vorrebbe un pugno. Di lato, a sinistra, dove c\'è l\'ammaccatura. Tutti i jukebox hanno un\'ammaccatura: è il loro pulsante vero.',
            '> E lei non glielo dà?',
            'Io sono pacifista. Con i jukebox soprattutto.',
          ],
          do: (g) => {
            if (g.quest('jukebox') === -1) g.startQuest('jukebox');
          },
        },
        dopo: {
          say: [
            'La musica! Finalmente. Grazie, Stecco. Ti offrirei qualcosa, ma hai già bevuto abbastanza. Si vede.',
          ],
        },
      },
    },
  });

  // =========================================================================
  // LA MAMMA DI MARCO (compare alla porta, alla fine)
  // =========================================================================
  g.addNpc({
    id: 'mamma',
    name: 'La mamma di Marco',
    pos: at('mamma'),
    face: [A.mamma.x, A.mamma.z + 5],
    look: { hat: 'bun' },
    hidden: true,
    action: 'crossed',
    barks: () => [],
  });

}
