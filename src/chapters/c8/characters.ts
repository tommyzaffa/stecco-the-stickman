import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Choice } from '../../game/dialogue';
import type { ItemId } from '../../content/items';
import { Stickman } from '../../entities/stickman';
import { CERA, HL } from '../../render/palette';
import { Q8, RIDE_COST } from './quests';
import { FOUNTAIN } from './world';
import { rideWheel } from './story';
import { cakeBest } from './cake';
import { RIDE } from './wheel';

// ---------------------------------------------------------------------------
// Capitolo 8: la sagra. Marco, Martina, il signor Perno della ruota, i Pastelli al tiro ai barattoli,
// Nonna Pina alla gara di torte (e la maestra Crostata, giuria), Don Fluo al banco dei premi,
// l'Ispettore Penna delle Biro Blu (Ufficio Sagre), Dario e Barnie alla gazzosa, il Sindaco e la
// banda sul palco, Arturo, e mezzo paese.
// ---------------------------------------------------------------------------

const ROSA_PASTELLO = '#f4a3c4';
const BIRO_BLU = '#4d7cf0';
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];
  const onStage = (id: string, anchor: string) => (g.npc(id).pos.y = A[anchor].y);

  // =========================================================================
  // MARCO
  // =========================================================================
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marco'),
    face: [0, 34],
    look: { hat: 'cap' },
    icon: (g) => (g.has('pesce') && !g.questDone('pesce') ? 'turnin' : g.is('c8Intro') && g.quest('pesce') === -1 && g.quest('c8') >= 1 ? 'side' : null),
    barks: (g) =>
      g.is('c8Intro')
        ? ['La giuria ha detto che non sono della giuria. Io ho detto: e allora chi assaggia?', 'Questa è al limone. Questa è al limone. Anche questa. È una gara di torte al limone?', 'Se vinci un pesce, è mio. Cioè, se vinci un pesce, dimmelo.']
        : [],
    dialogue: {
      name: 'Marco',
      // il pesce si può dargli sempre: anche se l'hai comprato prima che te lo chiedesse
      start: (g) =>
        !g.is('c8IntroFatta')
          ? 'intro'
          : g.has('pesce') && !g.questDone('pesce')
            ? g.quest('pesce') === -1
              ? 'pesceSorpresa'
              : 'pesceDato'
            : g.quest('pesce') === -1 && g.quest('c8') >= 1
              ? 'pesce'
              : 'dopo',
      nodes: {
        intro: {
          say: [
            'Eccoti! La sagra di San Scarabocchio. Una volta all\'anno il paese si ricorda di essere un paese.',
            '> C\'è un sacco di gente.',
            'Quarantasette abitanti. Tutti qui. Anche quelli che non si parlano: alla sagra si parlano, per litigare meglio dopo.',
            'Regola numero uno: qui le monete non valgono. Si gioca alle bancarelle e si vincono i gettoni.',
            'Regola numero due: i gettoni non si mangiano. L\'ho scoperto io, l\'anno scorso.',
            'Martina ti cerca. È alla pesca dei tappi, ovviamente. Ce l\'hai il tappo?',
            '> Ce l\'ho.',
            'Allora vai. Io vado alla gara di torte. Come giudice.',
            '> Ti hanno fatto giudice?',
            'No. Ma ho la faccia da giudice. Il resto lo improvviso.',
          ],
          do: (g) => {
            g.flag('c8IntroFatta');
            const m = g.npc('marco');
            m.setBehavior({ type: 'patrol', path: [[1.5, 20], [9, 6], [A.marcoTorte.x, A.marcoTorte.z]], speed: 3.2, once: true });
            g.toast(`Le bancarelle: <b>tiro ai barattoli</b> e <b>pesca dei tappi</b> a sinistra, <b>gara di torte</b> e <b>banco dei premi</b> a destra. Ogni partita vale gettoni.`, 'quest', 7500);
          },
        },
        pesce: {
          say: [
            'Stecco. Ho una domanda seria.',
            'Al banco dei premi c\'è un pesce rosso. Cioè: dicono che è rosso. Io lo vedo grigio. Come tutto.',
            'Io voglio un animale. Uno che non parli. Che ascolti e basta.',
            '> Un pesce ascolta?',
            'Non lo so. Ma non mi interrompe. Costa tre gettoni. I miei li ho spesi. Li ho mangiati. Te l\'ho detto: non si mangiano.',
          ],
          do: (g) => g.startQuest('pesce'),
        },
        pesceSorpresa: {
          say: [
            '> Tieni. Un pesce. Per te.',
            'Per me? Un pesce? Come facevi a sapere che volevo un animale che non parla?',
            '> Hai la faccia di uno che vuole un animale che non parla.',
            'È vero. Ce l\'ho da sempre, questa faccia. Guardalo: è grigio! È bellissimo!',
          ],
          next: 'nome',
        },
        pesceDato: {
          say: ['> Tieni. Il tuo pesce.', 'Il mio pesce! Guardalo: è grigio! È bellissimo!'],
          next: 'nome',
        },
        nome: {
          say: [
            'Lo chiamo... Stecco Secondo.',
            '> Perché?',
            'Perché è grigio, sta zitto e fa tutto quello che faccio io. Cioè, niente. Ma con impegno.',
            '* Marco tiene il sacchetto con la testa, come un trofeo.',
          ],
          do: (g) => {
            g.take('pesce');
            g.flag('pesceMarco');
            g.addXp(35);
            g.addCoins(10);
            g.completeQuest('pesce');
          },
        },
        dopo: {
          say: [
            (g) =>
              g.quest('c8') >= 3
                ? 'La fontana? Che ha la fontana? È lì. Con i suoi tre zampilli.'
                : g.questDone('pesce')
                  ? pick(['Stecco Secondo ti saluta. Cioè, non fa niente. Ma lo fa verso di te.', 'Le torte della giuria sono buonissime. Anche quelle degli altri concorrenti. Mi hanno cacciato.'])
                  : pick(['Le torte della giuria sono buonissime. Anche quelle degli altri concorrenti. Mi hanno cacciato.', 'Hai visto Martina? Te lo chiedo per te, non per me.', 'Il pesce, Stecco. Il pesce.']),
          ],
        },
      },
    },
  });

  // =========================================================================
  // MARTINA (alla pesca dei tappi)
  // =========================================================================
  g.addNpc({
    id: 'martina',
    name: 'Martina',
    pos: at('martina'),
    face: [A.martina.x - 2, A.martina.z - 1.5],
    look: { highlighter: ROSA_PASTELLO, hat: 'pencil', eyes: true },
    icon: (g) => (g.quest('c8') === 0 ? 'main' : g.has('tappoStella') ? 'turnin' : null),
    barks: (g) =>
      g.quest('c8') === 0
        ? ['Stecco! Qui!', 'Tappi, tappi, tappi...']
        : ['Quello con la stella gira al bordo. Veloce. Come le cose belle.', 'Ogni tappo ha una storia. Questa pesca ne ha dodici.', 'Tre sagre che lo inseguo.'],
    dialogue: {
      name: 'Martina',
      // il tappo con la stella lo prende appena glielo porti (prima o dopo la ruota)
      start: (g) =>
        g.quest('c8') === 0 ? 'ciao' : g.has('tappoStella') ? 'stellaDopo' : g.quest('c8') >= 3 ? 'dopo' : g.quest('c8') === 2 ? 'andiamo' : 'intanto',
      nodes: {
        ciao: {
          say: [
            'Stecco! Sei venuto!',
            '> Ti ho portato il tappo. Quello giallo.',
            'Il mio tappo! Aspetta. Non darmelo qui.',
            'Sulla ruota panoramica. In cima. Me lo ridai lassù: così è un momento, e non una consegna.',
            '> La ruota costa sei gettoni.',
            'Lo so. È il prezzo dei momenti.',
            'Io intanto pesco. Qui dentro c\'è un tappo con una stella sotto: il più raro della sagra. Sono tre anni che lo inseguo.',
            'Gira al bordo della vasca, velocissimo. Se lo peschi tu, ti sposo. Scherzo. Ti offro una gazzosa.',
          ],
          do: (g) => {
            g.setStep('c8', 1);
            if (Q8.tokens >= RIDE_COST) g.setStep('c8', 2);
            // se l'hai già pescato, niente missione: glielo dai subito
            if (g.quest('stella') === -1 && !g.has('tappoStella')) g.startQuest('stella');
          },
          next: (g) => (g.has('tappoStella') ? 'giaStella' : undefined),
        },
        giaStella: {
          say: [
            '> Il tappo con la stella? Questo?',
            '...',
            'Ce l\'hai GIÀ? Tre sagre che lo inseguo, e tu lo peschi prima ancora di salutarmi.',
            '* Martina prende il tappo con la stella. Lo guarda. Lo riguarda.',
            'Grazie. Lo metto da parte: il centro della collezione è per le occasioni.',
            'Il tappo giallo invece no: quello me lo ridai lassù, in cima alla ruota. È un altro momento.',
          ],
          do: (g) => {
            g.take('tappoStella');
            g.flag('stellaMartina');
            g.addXp(40);
            g.completeQuest('stella');
          },
        },
        intanto: {
          say: [
            (g) =>
              Q8.tokens > 0
                ? `${Q8.tokens} gettoni! Ne mancano ${Math.max(0, RIDE_COST - Q8.tokens)}. Le torte di Nonna Pina rendono bene, dicono.`
                : pick(['Il tiro ai barattoli lo fanno i Pastelli. Tre palline. Mira in alto: le palline scendono. Come i prezzi, dopo la sagra.', 'Qui alla pesca devi anticipare: l\'amo scende e il tappo intanto va avanti.']),
          ],
        },
        andiamo: {
          say: ['Sei gettoni! Andiamo alla ruota? Ci vediamo là: dal signor Perno.'],
        },
        stellaDopo: {
          say: [
            '> Ho pescato il tappo con la stella. È tuo.',
            'Il tappo con la stella... Sono tre sagre che lo inseguo, Stecco. Tre.',
            'L\'hai pescato tu? Con l\'amo? Senza mani?',
            '> Non ho mani. Ho talento.',
            'Lo metto al centro della collezione. No: da parte. Il centro è per le occasioni.',
            (g) => (g.quest('c8') <= 2 ? 'E adesso la ruota. Sei gettoni, e il tappo giallo me lo ridai lassù.' : 'Oggi è la giornata dei tappi. E dei momenti.'),
          ],
          do: (g) => {
            g.take('tappoStella');
            g.flag('stellaMartina');
            g.addXp(40);
            g.completeQuest('stella');
          },
        },
        dopo: {
          say: [
            () =>
              pick([
                'Grazie per il momento. Adesso sono un po\' imbarazzata. Pesco per non pensarci.',
                'Il tappo sta benissimo nella collezione. Giallo tra i grigi. Come te tra... no, niente.',
              ]),
          ],
        },
      },
    },
  });

  // =========================================================================
  // IL SIGNOR PERNO (ruota panoramica)
  // =========================================================================
  g.addNpc({
    id: 'perno',
    name: 'Il signor Perno',
    pos: at('perno'),
    face: [A.perno.x, A.perno.z + 6],
    look: { hat: 'cap', mustache: true },
    icon: (g) => (g.quest('c8') === 2 && RIDE.cabin < 0 ? 'main' : null),
    barks: () => ['Ruota panoramica! Si vede tutto il paese! Cioè, tutta la piazza!', 'Gira da quarant\'anni. Si inceppa solo in cima. Per il panorama.', 'Sei gettoni in due. In uno solo, sei gettoni lo stesso.'],
    dialogue: {
      name: 'Il signor Perno',
      start: (g) => (g.quest('c8') === 2 ? (Q8.tokens >= RIDE_COST ? 'sali' : 'pochi') : g.is('c8Ruota') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'La ruota panoramica di San Scarabocchio. Otto cabine, un perno. Il perno sono io.',
            `Sei gettoni, per due persone. Si sale, si guarda, si scende. In cima a volte si inceppa: la gente paga apposta.`,
          ],
        },
        pochi: {
          say: [(_g) => `Sei gettoni. Tu ne hai ${Q8.tokens}. La matematica non fa sconti, e nemmeno io.`],
        },
        sali: {
          say: [
            'Sei gettoni? E la signorina?',
            '* Martina arriva di corsa. Ha visto i gettoni da lontano.',
            '@Martina| Eccomi! Eccomi.',
            'Prego. Cabina numero uno. Cioè, sono tutte la numero uno: non le ho mai numerate.',
          ],
          next: 'via',
        },
        via: {
          say: [],
          do: (g) => g.after(0.05, () => rideWheel(g)),
        },
        dopo: { say: ['Com\'era il panorama? Tutti dicono "bellissimo". Nessuno dice cosa hanno visto.'] },
      },
    },
  });

  // =========================================================================
  // I PASTELLI A CERA (tiro ai barattoli)
  // =========================================================================
  g.addNpc({
    id: 'pastellone',
    name: 'Il Pastellone',
    pos: at('pastellone'),
    face: [A.pastellone.x + 5, A.pastellone.z],
    look: { highlighter: CERA.viola, hat: 'crayon', scale: 1.4 },
    action: 'crossed',
    talkRadius: 5.4,
    icon: (g) => (g.quest('incollato') === 2 ? 'turnin' : null),
    barks: () => ['Tre palline, un gettone! No: tre palline, fino a tre gettoni!', 'Tregua con gli Evidenziatori. Non con i barattoli.', 'Mirare in alto. La vita va giù da sola.'],
    dialogue: {
      name: 'Il Pastellone',
      start: (g) => (g.quest('incollato') === 2 ? 'verbale' : 'a'),
      nodes: {
        a: {
          say: [
            'Il ragazzo della discesa! Quello che ci ha seminati in una macchina senza motore.',
            'Tregua, tregua. Oggi facciamo i commercianti: tiro ai barattoli dei Pastelli a Cera.',
            'Tre palline di carta. Barattoli giù dalla mensola: tutti e sei, tre gettoni. Quattro, due. Due, uno.',
            '> Gratis?',
            'Gratis. Il guadagno lo facciamo sulla dignità degli altri.',
          ],
          do: (g) => g.flag('c8Pastellone'),
        },
        verbale: {
          say: [
            '> Verbale delle Biro Blu. Il barattolo di mezzo è incollato. Va scollato.',
            'Incollato? Il barattolo? Ma chi... Pastello Verde!',
            '@Pastello Verde| Era per la tradizione, capo!',
            'La tradizione si fa con la cera, non con la colla! Scollalo!',
            '* Il Pastello Verde scolla il barattolo. Con i denti. Non avendo denti, ci mette un po\'.',
            'Ecco. Adesso cadono tutti. Tieni, per il disturbo: due gettoni. E non dirlo agli Evidenziatori.',
          ],
          do: (g) => {
            g.flag('scollato');
            Q8.tokens += 2;
            Q8.won += 2;
            g.audio.tokens(2);
            g.toast('+2 gettoni', 'reward', 2200);
            g.addXp(40);
            g.addCoins(10);
            g.completeQuest('incollato');
          },
        },
      },
    },
  });
  g.addNpc({
    id: 'pastello',
    name: 'Pastello Verde',
    pos: at('pastello'),
    face: [A.pastello.x + 5, A.pastello.z],
    look: { highlighter: CERA.verde, hat: 'crayon' },
    barks: (g) => (g.is('scollato') ? ['Scollato. Con i denti. Non ho i denti.'] : ['Non guardate il barattolo di mezzo. È timido.', 'Palline! Palline di carta! Riciclata!']),
  });

  // =========================================================================
  // NONNA PINA E LA GARA DI TORTE
  // =========================================================================
  g.addNpc({
    id: 'pina',
    name: 'Nonna Pina',
    pos: at('pina'),
    face: [A.pina.x - 4, A.pina.z],
    look: { hat: 'bun' },
    action: 'cane',
    icon: (g) => (g.quest('torta') === -1 ? 'side' : null),
    barks: (g) => (g.questDone('torta') ? ['Il Mestolo d\'Oro! Dopo quarant\'anni!', 'La maestra Crostata non mi parla. Meglio.'] : ['Una torta alta come un campanile!', 'Via della Penna è bellissima. Ma le torte le faccio ancora qui.', 'Pallino, la panna no!']),
    dialogue: {
      name: 'Nonna Pina',
      start: (g) => (g.questActive('torta') && CAKE_WIN.done() ? 'vinto' : g.quest('torta') === -1 ? 'a' : g.questDone('torta') ? 'dopo' : 'intanto'),
      nodes: {
        a: {
          say: [
            'Stecco! Anche tu alla sagra! Io sono venuta apposta da Via della Penna. Là è tutto a penna, ma le sagre non le fanno.',
            'Quest\'anno partecipo alla gara di torte. Vince la più alta. Da quarant\'anni vince la maestra Crostata.',
            'Io faccio i piani. Tu li metti uno sopra l\'altro: io ho le mani che tremano. Cioè, le linee.',
            '> Quanti piani servono?',
            'Dieci. Con dieci piani la maestra Crostata diventa bianca. Più bianca, voglio dire.',
            'Il piano nuovo scorre: tu appoggialo quando è sopra la torta. Quello che sporge si taglia. Se lo metti preciso, resta tutto.',
          ],
          do: (g) => {
            g.flag('c8Pina');
            g.startQuest('torta');
          },
        },
        intanto: { say: [(g) => `Dieci piani, Stecco. ${CAKE_WIN.best() ? `L'ultima era di ${CAKE_WIN.best()}.` : ''} La maestra Crostata ci guarda.`] },
        vinto: {
          say: [
            'DIECI PIANI! Anzi, di più!',
            '@La maestra Crostata| ...la giuria... si ritira... per deliberare.',
            '@La maestra Crostata| La giuria ha deliberato. Il Mestolo d\'Oro va... a Nonna Pina.',
            'Quarant\'anni! Quarant\'anni che aspettavo!',
            'Tieni, Stecco: il premio in gettoni è tuo. Il mestolo me lo tengo io: ci giro il caffè.',
          ],
          do: (g) => {
            Q8.tokens += 3;
            Q8.won += 3;
            g.audio.tokens(3);
            g.toast('+3 gettoni (premio della giuria)', 'reward', 2600);
            g.addXp(50);
            g.flag('mestoloPina');
            g.completeQuest('torta');
          },
        },
        dopo: { say: ['Il Mestolo d\'Oro. Adesso quando giro il caffè mi sento una regina. Una regina col caffè.'] },
      },
    },
  });
  g.addNpc({ id: 'pallino', name: 'Pallino', pos: at('pallino'), dog: true, behavior: { type: 'circle', cx: A.pallino.x, cz: A.pallino.z, r: 1.1, speed: 1.2 }, barks: () => ['Bau.', 'Bau?', '(annusa le torte)'] });
  g.addNpc({
    id: 'crostata',
    name: 'La maestra Crostata',
    pos: at('crostata'),
    face: [A.crostata.x - 4, A.crostata.z],
    look: { hat: 'bun', tie: true },
    action: 'crossed',
    barks: (g) => (g.questDone('torta') ? ['...', 'Quarant\'anni di carriera. Battuta da una torta a piani.'] : ['Una torta non si giudica dall\'altezza. Però vince la più alta.', 'Io da quarant\'anni. Chiedete in giro.', 'Il ragazzo col cappellino ha assaggiato la giuria. Cioè, le torte della giuria.']),
  });

  // =========================================================================
  // DON FLUO: IL BANCO DEI PREMI
  // =========================================================================
  const prizes: { id: ItemId; name: string; price: number; line: string }[] = [
    { id: 'pesce', name: 'Pesce rosso (grigio)', price: 3, line: 'Il pesce. È rosso. Se non lo vedi rosso, il problema è tuo.' },
    { id: 'fischietto', name: 'Fischietto di latta', price: 2, line: 'Il fischietto. Lo sentono i cani e i vicini. Gli Evidenziatori lo usano per chiamare i rinforzi. Cioè, Bruno.' },
    { id: 'palloncino', name: 'Palloncino a forma di niente', price: 1, line: 'Il palloncino. A forma di cane. Guardalo bene: è un cane. Tondo.' },
    { id: 'orsetto', name: 'Orsacchiotto gigante', price: 10, line: 'L\'orsacchiotto gigante. Il premio evidenziato. Nessuno l\'ha mai vinto: è qui dal 1987.' },
  ];
  const buy = (p: (typeof prizes)[number]): Choice => ({
    t: (g) => `${p.name} (${p.price} gettoni)`,
    if: (g) => !g.has(p.id) && !(p.id === 'pesce' && g.questDone('pesce')),
    do: (g) => {
      if (Q8.tokens < p.price) {
        g.npc('fluo').say('Non bastano. Gli Evidenziatori non fanno sconti. Evidenziano i prezzi.', 3.5);
        g.audio.bad();
        return;
      }
      Q8.tokens -= p.price;
      g.audio.pay();
      g.give(p.id);
      g.npc('fluo').say(p.line, 4.5);
      if (p.id === 'pesce' && g.quest('pesce') === 0) g.setStep('pesce', 1);
      if (p.id === 'orsetto') g.flag('orsettoGigante');
    },
    next: 'fine',
  });
  g.addNpc({
    id: 'fluo',
    name: 'Don Fluo',
    pos: at('fluo'),
    face: [A.fluo.x - 5, A.fluo.z],
    look: { highlighter: HL.yellow, hat: 'top', sunglasses: true, mustache: true, scale: 1.35 },
    action: 'crossed',
    talkRadius: 4.2,
    barks: () => ['Premi! Premi evidenziati!', 'Il tappo me lo sono rimesso. Guardate come brillo.', 'Tregua con i Pastelli. Ma i barattoli li guardo.'],
    dialogue: {
      name: 'Don Fluo',
      start: (g) => (g.is('c8Fluo') ? 'banco' : 'a'),
      nodes: {
        a: {
          say: [
            'Il ragazzo del tappo. Guarda: brillo. Giallo come il primo giorno.',
            'Oggi gli Evidenziatori fanno beneficenza: il banco dei premi della sagra. I premi migliori sono evidenziati.',
            '> Quali sono evidenziati?',
            'Tutti. Siamo generosi, con l\'evidenziatore.',
          ],
          do: (g) => g.flag('c8Fluo'),
          next: 'banco',
        },
        banco: {
          say: [(g) => `Gettoni: ${Q8.tokens}. Cosa ti evidenzio?`],
          choices: [...prizes.map(buy), { t: 'Niente, grazie.', next: 'fine' }],
        },
        fine: { say: [] },
      },
    },
  });
  g.addNpc({
    id: 'bruno',
    name: 'Bruno',
    pos: at('bruno'),
    face: [A.bruno.x - 4, A.bruno.z],
    look: { sunglasses: true, scale: 1.3 },
    action: 'crossed',
    barks: () => ['...', 'Il capo è in beneficenza. Non chiedete.', 'Io sorveglio l\'orsacchiotto.'],
  });

  // =========================================================================
  // ISPETTORE PENNA (Biro Blu, Ufficio Sagre)
  // =========================================================================
  g.addNpc({
    id: 'penna',
    name: 'Ispettore Penna',
    pos: at('penna'),
    look: { highlighter: BIRO_BLU, hat: 'police', mustache: true },
    action: 'read',
    behavior: { type: 'patrol', path: [[7.5, 12], [-7, 14], [-9, -2], [7, -3]], speed: 1.0, wait: 4 },
    icon: (g) => (g.quest('incollato') === 1 ? 'turnin' : null),
    barks: () => ['Verbale: bandierina storta. Verbale: bandierina dritta, ma troppo.', 'Ufficio Sagre e Feste, distaccamento di San Scarabocchio.', 'Qui si controlla tutto. Tranne il divertimento: quello è fuori competenza.'],
    dialogue: {
      name: 'Ispettore Penna',
      start: (g) => (g.quest('incollato') === 1 ? 'colla' : 'a'),
      nodes: {
        a: {
          say: [
            'Ispettore Penna, Biro Blu. Ci siamo già visti a Quadropoli. O ci vedremo. Le date non sono di mia competenza.',
            'Oggi sono all\'Ufficio Sagre e Feste. Controllo che la festa sia regolare.',
            '> E come fa una festa a essere regolare?',
            'Con i moduli. Una festa senza moduli è una rissa con la musica.',
          ],
        },
        colla: {
          say: [
            '> Ispettore. Al tiro ai barattoli, il barattolo di mezzo è incollato.',
            'Incollato? Con cosa?',
            '> Colla stick.',
            '* L\'Ispettore Penna scrive. Scrive tanto. Gira pagina. Scrive ancora.',
            'Verbale numero quattromilaquattrocentododici: barattolo fissato alla mensola con colla stick, in violazione del regolamento dei giochi di lancio.',
            'Sanzione: scollarlo. Consegni lei il verbale al Pastellone. Io non mi avvicino alla cera: macchia.',
          ],
          do: (g) => g.setStep('incollato', 2),
        },
      },
    },
  });

  // =========================================================================
  // DARIO E BARNIE (la gazzosa)
  // =========================================================================
  g.addNpc({
    id: 'dario',
    name: 'Dario',
    pos: at('dario'),
    face: [A.dario.x, A.dario.z + 5],
    look: { hat: 'hair', mustache: true },
    talkRadius: 3.2,
    barks: () => ['Gazzosa! Fresca, disegnata, con le bollicine a matita!', 'Stasera il pub è aperto. Si gioca a freccette.', 'Barnie, non fare la Gazzosa Gigante adesso. Stasera.'],
    dialogue: {
      name: 'Dario',
      start: (g) => (g.is('gazzosaDario') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Il ragazzo della macchina senza motore! Barnie mi ha raccontato tutto. Tre volte.',
            'Tieni: una gazzosa. Offre la casa. Anzi, il chiosco.',
            '* Bevi. Le bollicine sono disegnate, ma pizzicano lo stesso.',
            'Stasera apro il pub. Quiz, freccette, e la Gazzosa Gigante: tre litri, una cannuccia.',
            'Porta Marco. E la signorina con la matita. Una squadra di tre è il numero giusto per perdere al quiz con dignità.',
          ],
          do: (g) => {
            g.flag('gazzosaDario');
            g.flag('invitoDario');
            g.heal(30);
          },
        },
        dopo: { say: ['Stasera. Freccette. Barnie si sta scaldando il braccio. Da tre ore.'] },
      },
    },
  });
  g.addNpc({
    id: 'barnie',
    name: 'Barnie',
    pos: at('barnie'),
    face: [A.barnie.x - 2, A.barnie.z + 3],
    look: { hat: 'beanie', beard: true, scale: 1.5 },
    action: 'drink',
    barks: () => ['Ciao. Gazzosa.', 'Stasera freccette. Io vinco. Sempre. Scusa.', 'Ho fatto l\'autostop fin qui. Da quattro metri.'],
    dialogue: {
      name: 'Barnie',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Il ragazzo del passaggio.',
            '> Barnie! Come va?',
            'Bene. Bevo gazzosa. Stasera freccette.',
            'Io faccio centro sempre. Non è bravura. Il centro mi vuole bene.',
          ],
        },
      },
    },
  });

  // =========================================================================
  // IL PALCO: il Sindaco e la banda
  // =========================================================================
  g.addNpc({
    id: 'sindaco',
    name: 'Il Sindaco',
    pos: at('sindaco'),
    face: [A.sindaco.x - 2, A.sindaco.z + 8],
    look: { hat: 'top', mustache: true, tie: true },
    action: 'speech',
    faceWhenNear: false,
    barks: () => [
      'Benvenuti alla sagra! Quest\'anno, come ogni anno: niente colori!',
      'Tra poco l\'estrazione della lotteria. Il primo premio è un secondo premio.',
      'Ringrazio la banda, che suona gratis. Cioè, la pago io. Cioè, il Comune.',
      'Le bandierine colorate non le ha autorizzate nessuno. Però sono belle. Le autorizzo adesso.',
    ],
  });
  onStage('sindaco', 'sindaco');
  const band: [string, string, THREE.Object3D][] = [
    ['banda0', 'banda0', tuba()],
    ['banda1', 'banda1', new THREE.Group()],
    ['banda2', 'banda2', clarinet()],
  ];
  const bandLines = [
    ['Ooom-pa-pa. Ooom-pa-pa.', 'La tuba pesa quanto me. Io peso poco.'],
    ['Tum. Tum. Tum-tum.', 'Il tamburo l\'ho disegnato io. Si vede.'],
    ['Il clarinetto stona. È voluto. È folk.', 'Tiriti-tiritì.'],
  ];
  band.forEach(([id, anchor, prop], i) => {
    const n = g.addNpc({
      id,
      name: ['Il tubista', 'Il tamburino', 'La clarinettista'][i],
      pos: at(anchor),
      face: [A[anchor].x, A[anchor].z + 8],
      look: { hat: i === 2 ? 'bun' : 'police' },
      action: i === 0 ? 'read' : i === 1 ? 'gavel' : 'violin',
      faceWhenNear: false,
      barks: () => bandLines[i],
    });
    n.pos.y = A[anchor].y;
    if (n.body instanceof Stickman) n.body.prop.add(prop);
  });

  // =========================================================================
  // ARTURO
  // =========================================================================
  g.addNpc({
    id: 'filosofo',
    name: 'Arturo il Filosofo',
    pos: at('filosofo'),
    face: [FOUNTAIN.x, FOUNTAIN.z],
    look: { beard: true },
    action: 'think',
    icon: (g) => (g.quest('c8') === 3 ? 'main' : null),
    barks: (g) =>
      g.quest('c8') === 3
        ? ['Stecco! Qui. Guarda la fontana.', 'Quattro. Erano quattro.']
        : ['Alla sagra nessuno guarda per terra. Io sì.', 'Una panchina, un vicolo... Qui, oggi, per ora niente. Per ora.', 'La fontana. Ogni anno la guardo. Ogni anno è uguale. Mi tranquillizza.'],
    dialogue: {
      name: 'Arturo',
      start: (g) => (g.quest('c8') === 3 ? 'fine' : 'a'),
      nodes: {
        a: {
          say: [
            'Stecco. Tutti guardano in alto: la ruota, le bandierine, la banda.',
            'Io guardo per terra. È lì che cadono le cose. E dopo il Vicolo Storto, voglio vedere cosa cade.',
            '> E cosa vede?',
            'Per ora, coriandoli. Speriamo che restino coriandoli.',
          ],
        },
        fine: {
          look: (g) => g.world.anchors.fontanaLook.clone(),
          say: [
            'L\'hai visto anche tu. Dalla ruota.',
            '> La fontana. È sparita. Poi è tornata.',
            'Con tre zampilli. Prima ne aveva quattro. Li conto da trent\'anni: quattro.',
            '> Martina dice che sono sempre stati tre.',
            'Lo dicono tutti. Ho chiesto a dieci persone: tre, tre, tre. Uno ha detto "fontana?".',
            'Qualcuno ha cancellato un pezzo di piazza. E qualcuno l\'ha ridisegnato. In fretta.',
            'Quando si ridisegna in fretta, ci si ricorda male. E se ci si ricorda male in tanti, diventa vero.',
            '> Chi cancella, lo sappiamo. La gomma alla fragola.',
            '* Tutto intorno alla fontana, per terra, briciole rosa. Nessuno ci fa caso: guardano tutti la ruota.',
            'Chi cancella, sì. Ma chi ridisegna?',
            'Ha la mano che trema, Stecco. Come chi ha paura. O come chi ha finito la matita.',
          ],
          do: (g) => {
            g.addXp(60);
            g.addCoins(15);
            g.flag('fontanaTre');
            g.flag('c8Fine');
          },
        },
      },
    },
  });

  // =========================================================================
  // IL PAESE ALLA SAGRA (comparse con cui si scambia una parola)
  // =========================================================================
  g.addNpc({
    id: 'fabio',
    name: 'Fabio',
    pos: [FOUNTAIN.x + 6.5, FOUNTAIN.z],
    look: { hat: 'hair' },
    behavior: { type: 'circle', cx: FOUNTAIN.x, cz: FOUNTAIN.z, r: 6.4, speed: 3.2 },
    barks: (g) => (RIDE_AFTER(g) ? ['Giro 4.521! Strano: la fontana mi sembra più corta.', 'Uff... uff... la fontana ha cambiato forma? No. Io sono stanco.'] : ['Giro 4.513! Anche alla sagra!', 'Non posso fermarmi! Neanche per la torta!', 'Uff... uff...']),
  });
  g.addNpc({
    id: 'rocco',
    name: 'Rocco',
    pos: at('rocco'),
    face: [A.rocco.x, A.rocco.z - 5],
    look: { mustache: true, hat: 'hair' },
    talkRadius: 3,
    barks: () => ['Kebab esistenziale! Anche alla sagra!', 'Kebab alla sagra: la stessa domanda, con i coriandoli.'],
    dialogue: {
      name: 'Rocco',
      start: 'a',
      nodes: {
        a: {
          say: ['Kebab Esistenziale, edizione sagra. Due monete. Ti fa chiedere "perché", ma con allegria.'],
          choices: [
            {
              t: 'Uno, grazie (2 monete)',
              if: (g) => g.state.coins >= 2,
              do: (g) => {
                g.addCoins(-2);
                g.heal(35);
              },
              next: 'mangia',
            },
            { t: 'No, grazie.', next: 'no' },
          ],
        },
        mangia: { say: ['* Mangi il kebab. Per un attimo, tutto ha senso. Anche la sagra.', '* Poi l\'attimo passa. La sagra resta.'] },
        no: { say: ['Nessun problema. Il "perché" te lo chiedi gratis, prima o poi.'] },
      },
    },
  });
  const extras: { id: string; name: string; pos: [number, number]; look: object; action?: 'phone' | 'drink' | 'none' | 'think'; lines: string[]; patrol?: [number, number][] }[] = [
    { id: 'gino', name: 'Gino', pos: [-11, -4.6], look: { mustache: true, hat: 'hair' }, action: 'drink', lines: ['Alla sagra il caffè non lo faccio io. Riposo.', 'Questa gazzosa è quasi un caffè. Quasi.'] },
    { id: 'giulia', name: 'Giulia', pos: [6.5, 19], look: { hat: 'bun' }, action: 'phone', lines: ['Sì mamma, sono alla sagra. No mamma, non ho vinto niente. Sì, mangio.', 'No mamma, il fidanzato non c\'è. C\'è la ruota.'] },
    { id: 'ugo', name: 'Ugo il Pittore', pos: [-8, 22], look: { hat: 'beret' }, action: 'think', lines: ['Le bandierine colorate. Che orrore. Che bellezza. Che orrore.', 'Io le avrei fatte bianche. Più bianche.'] },
    { id: 'paesano0', name: 'La signora Ines', pos: [9.5, -2], look: { hat: 'bun' }, lines: ['Ai miei tempi la sagra durava tre giorni. Ora dura tre giorni lo stesso, ma sembrano meno.', 'La ruota! La ruota! Io non ci salgo. Soffro di vertigini disegnate.'], patrol: [[9.5, -2], [8, 8], [-2, 12], [-8, 2]] },
    { id: 'paesano1', name: 'Un bambino', pos: [3, 14], look: { hat: 'beanie', scale: 0.7 }, lines: ['Voglio l\'orsacchiotto gigante!', 'Mamma, perché le bandierine sono colorate e io no?'], patrol: [[3, 14], [-5, 18], [-14, 14], [-3, 9]] },
    { id: 'paesano2', name: 'Il signor Righetti', pos: [-2.5, -7.2], look: { hat: 'top' }, lines: ['Io vengo alla sagra per la banda. E per sedermi. Soprattutto per sedermi.'] },
    { id: 'paesano3', name: 'La signora Quadrelli', pos: [11, 1.5], look: { hat: 'bun', scale: 0.95 }, lines: ['Questa carta a puntini mi fa girare la testa. Sembrano coriandoli fermi.', 'Hanno messo le bandierine anche sopra la fontana. Poveri zampilli.'] },
  ];
  for (const e of extras) {
    g.addNpc({
      id: e.id,
      name: e.name,
      pos: e.pos,
      look: e.look,
      action: e.action ?? 'none',
      behavior: e.patrol ? { type: 'patrol', path: e.patrol, speed: 1.1, wait: 3 } : { type: 'stand' },
      barks: () => e.lines,
      dialogue: { name: e.name, start: 'a', nodes: { a: { say: [pick(e.lines)] } } },
    });
  }
}

// la torta di Nonna Pina (per le sue battute) e la fontana (dopo la ruota)
const CAKE_WIN = { done: () => cakeBest() >= 10, best: cakeBest };
const RIDE_AFTER = (_g: Game) => RIDE.erased;

// la tuba del tubista: un imbuto d'ottone... d'inchiostro
function tuba() {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#c9a33a', side: THREE.DoubleSide }));
  bell.position.set(0, 0.25, 0.1);
  bell.rotation.x = Math.PI;
  const body = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 14), new THREE.MeshBasicMaterial({ color: '#b28f2c' }));
  body.position.set(0, 0.0, 0.05);
  g.add(bell, body);
  return g;
}

function clarinet() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#25222c' }));
  c.position.set(0, -0.2, 0.05);
  g.add(c);
  return g;
}
