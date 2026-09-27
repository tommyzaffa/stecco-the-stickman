import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Choice, Dialogue, DNode, Txt } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { TOUCH } from '../../touch';
import { MARCO_SPOTS, MARTINA_LOOK, type MarcoSpot } from './world';
import { STATUS } from './quests';

// ---------------------------------------------------------------------------
// La cena con Martina. Niente pistole: solo parole.
//
//  - "Interesse di Martina" (0..100): le risposte sincere e un po' sceme piacciono, le frasi
//    fatte, le bugie e le vanterie no. A zero se ne va: si riparte dall'inizio della portata.
//  - Alcune risposte sono a tempo: se non scegli, stai zitto. A volte è la cosa giusta.
//  - Marco "aiuta": quando Martina è distratta spunta in giro per la sala e va mandato via
//    (guardalo e colpisci) prima che lei lo veda. Si traveste anche da cameriere.
// ---------------------------------------------------------------------------

const PINK = '#e7679e';
const START_INTEREST = 45;

export const DATE = {
  active: false,
  interest: START_INTEREST,
  beat: -1,
  checkpoint: 0,
  checkpointInterest: START_INTEREST,
  leaving: false,
  scusaUsed: false,
  course: '',
  gen: 0, // cambia a ogni game over: gli eventi programmati prima non partono più
};

interface MarcoEvent {
  t: number;
  dur: number;
  popsLeft: number;
  away: boolean;
  spot: MarcoSpot | null;
  nextPopAt: number;
  shooAt: number;
  used: string[];
  caughtSpot: MarcoSpot | null;
}
let EV: MarcoEvent | null = null;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function resetDate() {
  Object.assign(DATE, { active: false, interest: START_INTEREST, beat: -1, checkpoint: 0, checkpointInterest: START_INTEREST, leaving: false, scusaUsed: false, course: '', gen: DATE.gen + 1 });
  EV = null;
}

// l'interesse di Martina sale o scende (con il numerino che salta fuori dalla barra)
export function love(g: Game, n: number) {
  if (DATE.leaving || !n) return;
  DATE.interest = Math.max(0, Math.min(100, DATE.interest + n));
  g.hud.meterPop(n > 0 ? `+${n} ♥` : `${n}`, n > 0);
  if (n > 0) g.audio.good();
  else g.audio.bad();
  if (DATE.interest <= 0) {
    const gen = DATE.gen;
    g.after(0.4, () => gen === DATE.gen && leave(g));
  }
}

// una risposta: testo, effetto sull'interesse, nodo dopo
const opt = (t: Txt, d: number, next?: string, cond?: (g: Game) => boolean, extra?: (g: Game) => void): Choice => ({
  t,
  next,
  if: cond,
  do: (g) => {
    love(g, d);
    extra?.(g);
  },
});
const node = (say: Txt[], next?: DNode['next'], more: Partial<DNode> = {}): DNode => ({ say, next, ...more });

// =========================================================================
// LE PORTATE
// =========================================================================
const arrivo = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      say: [
        "* Martina è già al tavolo. È una matita colorata: rosa. Un rosa vero, pastello, non di quelli fluo. Ha la punta appena temperata.",
        'Sei venuto davvero. Pensavo che uno che telefona da una cabina a gettoni immaginari fosse immaginario anche lui.',
      ],
      choices: [
        opt('Non potevo mancare, principessa.', -10, 'a2'),
        opt('Sono reale. Più o meno. Sono disegnato.', 10, 'a1'),
        opt('Sono qui per il tappo. Andiamo al sodo.', -5, 'a3'),
      ],
    },
    a1: node(['Siamo tutti disegnati. Almeno tu lo ammetti.'], 'telefono'),
    a2: node(['Principessa. Wow. Sei uscito da un biscotto della fortuna?'], 'telefono'),
    a3: node(['Andiamo al sodo. Romantico come un modulo delle Biro Blu.'], 'telefono'),
    // come è andata la telefonata (capitolo 4)
    telefono: node([], (g) => (g.is('callMinaccia') ? 'tm' : g.is('callDrama') ? 'td' : g.is('callSoldi') ? 'ts' : 'regali')),
    tm: {
      say: ['Al telefono volevi venire a prenderti il tappo. Con una pistola. Blu.', 'E invece eccoti qui, seduto, con il tovagliolo disegnato.'],
      choices: [opt("La pistola l'ho lasciata al guardaroba. Per te.", 10, 'tm2'), opt('Ho cambiato strategia.', 5, 'tm1')],
    },
    tm1: node(['Mi piace chi ha una strategia. Anche quando si vede che non ce l\'ha.'], 'regali'),
    tm2: node(['Il gesto più romantico della storia delle armi.'], 'regali'),
    td: {
      say: ['Al telefono eri drammatico. "Vita o sbiadimento", dicevi.', 'Sei drammatico anche a cena o solo nelle cabine telefoniche?'],
      choices: [opt('Sempre. La vita è una tragedia disegnata.', -5, 'td2'), opt('Solo nelle cabine. Mi ispirano.', 10, 'td1')],
    },
    td1: node(['Allora dopo ti porto vicino a una cabina. Per vedere.'], 'regali'),
    td2: node(['Ecco. Adesso mi sento a teatro. Senza intervallo.'], 'regali'),
    ts: {
      say: ['Al telefono volevi ricomprare il tappo con i soldi che non hai.', 'Stasera il conto chi lo paga?'],
      choices: [opt('Tu. Sei tu la ricca dei tappi.', -10, 'ts2'), opt('Io. Credo. Speriamo.', 10, 'ts1')],
    },
    ts1: node(['"Credo. Speriamo." La frase più onesta mai detta a un primo appuntamento.'], 'regali'),
    ts2: node(['...Facciamo finta che tu non l\'abbia detto.'], 'regali'),
    // regali (dagli altri capitoli)
    regali: node([], (g) => (g.has('fiore') ? 'fiore' : g.has('profumo') ? 'profumo' : 'menu')),
    fiore: {
      say: ['* (Hai un fiore disegnato. In tasca. Cioè: non hai tasche. Ce l\'hai e basta.)'],
      choices: [
        opt('Ti ho portato un fiore. Disegnato. Non appassisce.', 10, 'f1', undefined, (g) => g.take('fiore')),
        { t: 'Il fiore lo tengo per dopo.', next: 'profumoQ' },
      ],
    },
    f1: node(['Non appassisce... come i tappi. Lo metto nel bicchiere.', '* Il fiore sta nel bicchiere, dritto, fiero di non appassire.'], 'profumoQ'),
    profumoQ: node([], (g) => (g.has('profumo') ? 'profumo' : 'menu')),
    profumo: {
      say: ["* Martina annusa l'aria.", 'Sai di... quaderno nuovo? Il primo giorno di scuola?'],
      choices: [
        opt('È il mio odore naturale.', -5, 'p2'),
        opt('Si chiama "Quaderno Nuovo". Madame Boccetta dice che lo compri sempre tu.', 10, 'p1'),
      ],
    },
    p1: node(['Madame Boccetta parla troppo. Però ha ragione.'], 'menu'),
    p2: node(['Bugiardo. Ma profumato.'], 'menu'),
    menu: node(
      [
        '@Pastello Bianco| I menù. Stasera lo chef consiglia la cera fusa al sugo.',
        "Vediamo cosa c'è. Tu intanto guardati intorno: il posto è carino.",
        '> (Speriamo che Marco non si faccia vedere.)',
      ],
      undefined,
      { do: (g) => maitreComes(g) },
    ),
  },
});

const primo = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      say: ['Io prendo la cera fusa. Tu?'],
      timer: 6,
      timeout: 'a0',
      choices: [opt('La cosa che costa meno.', 5, 'a2'), opt('Quello che prendi tu.', -5, 'a1'), opt('Il piatto con il nome più strano.', 10, 'a3')],
    },
    a0: node(['> ...', 'Il silenzio non è sul menù. Ordino io per te: spaghetti alla gomma pane.'], 'tappi'),
    a1: node(['Personalità: zero. Come i colori. I tuoi.'], 'tappi'),
    a2: node([(g) => (g.state.coins < 10 ? 'Sincero sul portafoglio. Lo apprezzo. Il portafoglio no.' : 'Parsimonioso. O tirchio. Lo scoprirò al conto.')], 'tappi'),
    a3: node(['"Spaghetti alla gomma pane": si cancellano mentre li mangi. Coraggioso.'], 'tappi'),
    tappi: {
      say: [
        'Sai perché colleziono tappi?',
        '> Perché?',
        'Perché un tappo chiude le cose. E io non chiudo mai niente: i libri, le porte, i discorsi. Mi sembra giusto che qualcuno lo faccia.',
      ],
      timer: 7,
      timeout: 't0',
      choices: [
        opt('Io i tappi li perdo sempre.', 0, 't3'),
        opt("Anche io. Una volta ho aperto una parentesi e non l'ho più chiusa (", 10, 't2'),
        opt('È la cosa più profonda mai sentita in un ristorante.', 5, 't1'),
      ],
    },
    t0: node(['> ...', 'Mh. Ti ho annoiato. Mi succede quando parlo di tappi.'], 'lavoro', { do: (g) => love(g, -5) }),
    t1: node(['Il ristorante ha abbassato la media, in effetti.'], 'lavoro'),
    t2: node(['* Martina ride. Una risata a matita: si sente il graffio.', "E l'hai chiusa, poi?", '> Non ancora.'], 'lavoro'),
    t3: node(["Lo so. Me ne hai fatto perdere uno ieri, all'asta. Cioè: l'ho vinto io."], 'lavoro'),
    lavoro: {
      say: ['E tu cosa fai nella vita?'],
      timer: 6,
      timeout: 'l0',
      choices: [
        opt('Sono un eroe: ieri ho salvato il Mercato Nero da un astuccio di Pastelli.', -10, 'l4'),
        opt('Il detective. Ho risolto un furto a Quadropoli.', 0, 'l1'),
        opt('Niente. Esisto. A tratti.', 10, 'l3'),
        opt('Lavoro per un evidenziatore che si sta sbiadendo.', 5, 'l2'),
      ],
    },
    l0: node(['> ...', 'Non lo sai nemmeno tu. Interessante. O triste. Deciderò al dolce.'], undefined, { do: (g) => love(g, -5) }),
    l1: node(['Un detective. Allora dimmi: chi ha rubato il tuo cappello?', '> Non ho un cappello.', 'Caso risolto.']),
    l2: node(['Don Fluo. Lo sapevo: hai la faccia di uno che fa favori ai boss. Una faccia tonda.']),
    l3: node(['A tratti. Come me quando mi spunto.']),
    l4: node([
      'Shh! Siamo nel ristorante dei Pastelli! Vuoi farci colorare fuori dai bordi?',
      '* Al tavolo accanto, un Pastello Arancione smette di masticare. Poi riprende.',
    ]),
  },
});

const marcello = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      do: (g) => showMarcello(g),
      look: (g) => g.npc('marcello'),
      say: [
        '* Arriva un cameriere. Ha due baffi disegnati storti e un cappellino che conosci benissimo.',
        '@Marcello| Buonasera! Sono Marcello! Il cameriere! Di questo ristorante! Da sempre!',
        "@Marcello| Ecco la cera fusa per la signora e, per il signore, il piatto dell'amore!",
        '@Marcello| Il signore mi ha detto che siete fidanzati!',
      ],
      timer: 4,
      timeout: 'm0',
      choices: [opt('Marco! Vattene!', -15, 'm3'), opt('Non ho detto niente del genere.', 0, 'm1'), opt('Grazie, Marcello. Può andare.', 10, 'm2')],
    },
    m0: node(
      [
        '> ...',
        '@Marcello| E ha detto anche che lei è bellissima, anche se non ha i colori giusti!',
        'Non ho i colori giusti?',
        '> Io non ho proprio colori.',
        '@Marcello| Buon appetito! Tanto amore!',
      ],
      'via',
      { do: (g) => love(g, -10) },
    ),
    m1: node(['Tranquillo. Il cameriere è evidentemente scemo.', '@Marcello| Grazie!'], 'via'),
    m2: node(['@Marcello| Certo! Vado! Sparisco! Come un cameriere!', 'Hai gestito un cameriere scemo con eleganza. Punti.'], 'via'),
    m3: node(
      [
        'Marco? ...Il tuo amico si è travestito da cameriere per spiarci?',
        '@Marcello| Io non sono Marco! Sono Marcello! È diverso: ha due elle!',
        '* Marcello se ne va di corsa. Uno dei baffi resta sul tavolo.',
      ],
      'via',
    ),
    via: node([], undefined, { do: (g) => marcelloLeaves(g) }),
  },
});

const violino = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      do: (g) => violinistComes(g),
      look: (g) => g.npc('violinista'),
      say: ['* Un Pastello Celeste con un violino si avvicina al tavolo e comincia a suonare.', '* Martina chiude gli occhi.'],
      timer: 5,
      timeout: 'v0',
      choices: [
        opt('Sembra un gatto disegnato che litiga con una gomma.', 5, 'v2'),
        opt('Che bella musica.', -5, 'v1'),
        opt("Posso suonare anch'io? Non ho le mani, ma ho entusiasmo.", 0, 'v3'),
      ],
    },
    // stare zitti, qui, è la risposta giusta
    v0: node(
      ['* Resti zitto. Il violino suona. Per un attimo nessuno dice niente, e va benissimo così.', 'Grazie per non aver parlato. Quasi nessuno ci riesce.'],
      'fine',
      { do: (g) => love(g, 15) },
    ),
    v1: node(["Frase da biglietto d'auguri. Hai rotto l'incantesimo."], 'fine'),
    v2: node(['* Martina ride con gli occhi chiusi.', 'È vero. Ma non dirlo a lui.', '@Violinista| Ho sentito.'], 'fine'),
    v3: node(['@Violinista| No.'], 'fine'),
    fine: node([], undefined, { do: (g) => violinistLeaves(g) }),
  },
});

const domande = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      say: ['Allora. Dimmi la verità: perché vuoi davvero il tappo?'],
      timer: 8,
      timeout: 'd0',
      choices: [
        opt('Per te. Il tappo era solo una scusa per vederti.', -5, 'd2'),
        opt("Non lo so. Mi hanno detto di farlo e l'ho fatto. Tipo in un videogioco.", 10, 'd3'),
        opt('Se Don Fluo non lo riavrà, si sbiadisce e la sua gang crolla. E io e Marco finiamo evidenziati. Male.', 10, 'd1'),
      ],
    },
    d0: node(['> ...', 'Il silenzio non è una risposta. Cioè, a volte sì. Non adesso.'], 'ombra', { do: (g) => love(g, -5) }),
    d1: node(['Onesto. Pericoloso, ma onesto.'], 'ombra'),
    d2: node(['Bugiardo. Carino, ma bugiardo: mi hai chiamato per il tappo, me lo ricordo.'], 'ombra'),
    d3: node(
      ['Tipo in un videogioco...', "Sai che a volte anch'io mi sento così? Come se qualcuno decidesse cosa dico. Con delle opzioni. Numerate."],
      'ombra',
    ),
    ombra: node([], (g) => (g.is('noShadow') ? 'om' : 'naso')),
    om: {
      say: ['* Martina guarda sotto il tavolo. Poi guarda te.', "Scusa... tu non hai l'ombra?"],
      choices: [
        opt("Me l'hanno rubata al Mercato Nero.", -5, 'om2'),
        opt('In prima persona non si vede.', 5, 'om3'),
        opt("L'ho data a un signore che ne aveva più bisogno di me.", 15, 'om1'),
      ],
    },
    om1: node(['...Davvero?', '...Sei strano. Mi piace, strano.'], 'naso'),
    om2: node(['Mh. Ci credo poco. Le ombre non si rubano: si vendono.'], 'naso'),
    om3: node(['Neanche io mi vedo i piedi. Siamo pari.'], 'naso'),
    naso: node([
      'Scusami un attimo. Vado a incipriarmi il naso.',
      '> Non hai il naso.',
      'Appunto: ci metto poco.',
      '> (Poco quanto? Marco è qui da qualche parte. Me lo sento.)',
    ]),
  },
});

const ritorno = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      say: ['* Martina si è temperata la punta. Si vede. Forse.'],
      timer: 4,
      timeout: 'r0',
      choices: [opt('Ci hai messo tanto.', -5, 'r2'), opt('Ti sei temperata la punta?', 10, 'r1')],
    },
    r0: node(['> ...', 'Non te ne sei accorto. Mi sono temperata. Vabbè.'], 'dolce'),
    r1: node(['Te ne sei accorto! Nessuno se ne accorge mai.'], 'dolce'),
    r2: node(["C'era la fila. Anche per incipriarsi il naso che non c'è."], 'dolce'),
    dolce: node(
      ['@Pastello Bianco| Il dolce: torta di gomma pane. Si cancella in bocca.'],
      (g) => (g.has('poesia') || g.has('sospiri') || g.has('guanti') ? 'regalo' : 'fine'),
      { do: (g) => maitreComes(g) },
    ),
    regalo: {
      say: ['* (Hai qualcosa per lei. Il momento è adesso. O mai più. O dopo.)'],
      choices: [
        { t: 'Ti ho scritto una poesia.', next: 'poesia', if: (g) => g.has('poesia') },
        { t: 'Ti ho portato tre sospiri. In barattolo.', next: 'sospiri', if: (g) => g.has('sospiri') },
        { t: 'Mi metto i guanti del mimo e ti do la mano.', next: 'guanti', if: (g) => g.has('guanti') },
        { t: 'Niente. Mangiamo il dolce.', next: 'fine' },
      ],
    },
    poesia: {
      do: (g) => g.take('poesia'),
      say: [
        '* Leggi ad alta voce:',
        '* "Sei rosa come... il rosa. / Sei una matita, ma anche una cosa. / Temperata al punto giusto, / più di così non riesco: sono un fusto."',
        'Chi ti ha aiutato?',
      ],
      choices: [opt("L'ho scritta tutta da solo.", -10, 'po2'), opt('Il Poeta di Quadropoli. Io ho messo "fusto".', 10, 'po1')],
    },
    po1: node(['"Fusto" è la parola peggiore della poesia. Ed è la mia preferita.'], 'fine'),
    po2: node(['In fondo c\'è scritto "con l\'aiuto del Poeta di Quadropoli". A matita. Piccolo.'], 'fine'),
    sospiri: node(
      [
        '* Apri il barattolo. Ne escono tre sospiri: "Aaah." "Mmh." "Sigh."',
        'Mi hai portato dei sospiri. In barattolo.',
        '> Usati una volta sola.',
        'Nessuno mi aveva mai regalato sospiri usati. È la cosa più strana e più carina della settimana.',
      ],
      'fine',
      {
        do: (g) => {
          g.take('sospiri');
          love(g, 10);
        },
      },
    ),
    guanti: node(
      [
        '* Ti metti i guanti bianchi del mimo e le porgi il fondo del braccio. Col guanto sopra.',
        'Non abbiamo le mani, nessuno dei due.',
        'Però così... è quasi come.',
      ],
      'fine',
      { do: (g) => love(g, 10) },
    ),
    fine: node(['* La torta si cancella in bocca. Resta un sapore di quaderno.']),
  },
});

const biglietto = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      do: (g) => showMarcello(g),
      look: (g) => g.npc('marcello'),
      say: [
        '@Marcello| Un biglietto per il signore! Da parte di... nessuno!',
        '* Sul biglietto, con la calligrafia di Marco: "BACIALA. Firmato: nessuno (Marco)."',
      ],
      timer: 4,
      timeout: 'b0',
      choices: [opt('Lo leggo ad alta voce.', -10, 'b2'), opt('Lo passo a Martina.', -5, 'b3'), opt('Me lo mangio.', 10, 'b1')],
    },
    b0: node(
      ['* Martina ti prende il biglietto di mano e lo legge.', '"Baciala. Firmato: nessuno (Marco)." ...Il tuo amico è un romantico. Tu invece?'],
      'via',
      { do: (g) => love(g, -5) },
    ),
    b1: node(
      [
        '* Ti mangi il biglietto. Sa di carta. Come tutto.',
        'Hai appena mangiato un biglietto?',
        '> Era un antipasto. In ritardo.',
        'Sei la persona più strana che abbia mai conosciuto. Continua così.',
      ],
      'via',
    ),
    b2: node(['> "Baciala. Firmato: nessuno. Marco."', '...Marco.', '@Marcello| NON SONO IO! Io sono Marcello! Due elle!'], 'via'),
    b3: node(['"Baciala. Firmato: nessuno (Marco)." Il tuo amico è un romantico. Tu invece?'], 'via'),
    via: node([], undefined, { do: (g) => marcelloLeaves(g) }),
  },
});

const conto = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: {
      do: (g) => maitreComes(g),
      say: ['@Pastello Bianco| Il conto: trenta monete. La cera fusa è cara: la sciogliamo a mano. Cioè, senza mani.'],
      choices: [
        { t: 'Pago io. (30 monete)', if: (g) => g.state.coins >= 30, next: 'c1', do: (g) => (g.addCoins(-30), love(g, 10)) },
        { t: 'Facciamo metà? (15 monete)', if: (g) => g.state.coins >= 15, next: 'c2', do: (g) => (g.addCoins(-15), love(g, 5)) },
        { t: (g) => `Ho solo ${g.state.coins} monete.`, if: (g) => g.state.coins < 30, next: 'c3', do: (g) => love(g, 5) },
        { t: 'Scappiamo senza pagare?', next: 'c4', do: (g) => (love(g, 5), g.flag('scappare')) },
      ],
    },
    c1: node(['Un gentiluomo. Disegnato, ma gentiluomo.']),
    c2: node(['Moderno. Mi piace.']),
    c3: node(['Sincero sul portafoglio. Pago io. In tappi, se li accettano.', '@Pastello Bianco| Li accettiamo.']),
    c4: node(['...Stavo per proportelo io.', '@Pastello Bianco| Ho sentito.']),
  },
});

const finale = (): Dialogue => ({
  name: 'Martina',
  start: 'a',
  nodes: {
    a: node([], () => (DATE.interest >= 75 ? 'top' : DATE.interest >= 40 ? 'mid' : 'low')),
    top: node(
      [
        'Stecco. È stata la cena più strana della mia vita.',
        'E la migliore.',
        "* Martina apre la borsetta. Non ha la borsetta: apre l'aria. Ne esce il tappo giallo.",
        "Il tappo. Te lo presto: tre giorni. Poi me lo riporti. E mi porti fuori un'altra volta.",
      ],
      'scoperti',
      { do: (g) => g.flag('martinaCuore') },
    ),
    mid: node(
      [
        "Non sei male. Un po' scarabocchiato, ma non male.",
        '* Martina tira fuori il tappo giallo. Lo guarda un attimo, poi te lo mette davanti.',
        "È un prestito. Con gli interessi. Gli interessi sono un'altra cena.",
      ],
      'scoperti',
      { do: (g) => g.flag('martinaAmica') },
    ),
    low: node(
      [
        'Sei stato... un disastro.',
        'Un disastro simpatico, però.',
        '* Martina ti lancia il tappo giallo. Lo prendi col petto.',
        'Tienilo. Mi hai fatto pena. E un po\' ridere. Soprattutto pena.',
      ],
      'scoperti',
      { do: (g) => g.flag('martinaPena') },
    ),
    scoperti: {
      do: (g) => {
        g.give('tappoVero');
        g.hud.meter(null);
      },
      say: [
        '@Pastello Bianco| Un momento.',
        '@Pastello Bianco| Io ho una memoria di cera: tutto quello che vedo mi resta attaccato.',
        '@Pastello Bianco| Voi due... siete quelli del Mercato Nero!',
        '* In tutta la sala i Pastelli a Cera posano le posate. Tutti insieme. Clic.',
      ],
      next: 'fuga',
    },
    fuga: {
      do: (g) => everyoneStands(g),
      say: [
        'Uscita sul retro. Di corsa.',
        '> E poi?',
        'E poi ci serve una macchina.',
        '@Marcello| Io conosco uno con una macchina! Non ha il motore, però è una macchina!',
        '> Luca.',
      ],
      next: 'via',
    },
    via: node([], undefined, { do: (g) => g.flag('c5Finale') }),
  },
});

// =========================================================================
// LO SVOLGIMENTO DELLA SERATA
// =========================================================================
type Beat =
  | { kind: 'talk'; d: () => Dialogue; checkpoint?: string }
  | { kind: 'marco'; dur: number; pops: number; away: boolean; checkpoint?: string };

const BEATS: Beat[] = [
  { kind: 'talk', d: arrivo, checkpoint: 'Antipasto' },
  { kind: 'marco', dur: 11, pops: 1, away: false },
  { kind: 'talk', d: primo, checkpoint: 'Primo' },
  { kind: 'talk', d: marcello },
  { kind: 'talk', d: violino, checkpoint: 'Secondo' },
  { kind: 'talk', d: domande },
  { kind: 'marco', dur: 17, pops: 3, away: true },
  { kind: 'talk', d: ritorno, checkpoint: 'Dolce' },
  { kind: 'talk', d: biglietto },
  { kind: 'talk', d: conto, checkpoint: 'Il conto' },
  { kind: 'talk', d: finale },
];

export function startDate(g: Game) {
  DATE.active = true;
  DATE.interest = START_INTEREST + (g.is('provato') ? 5 : 0);
  DATE.checkpointInterest = DATE.interest;
  runBeat(g, 0);
}

function runBeat(g: Game, i: number) {
  if (DATE.leaving) return;
  DATE.beat = i;
  const b = BEATS[i];
  if (!b) return;
  if (b.checkpoint) {
    DATE.checkpoint = i;
    DATE.checkpointInterest = DATE.interest;
    DATE.course = b.checkpoint;
  }
  STATUS.text = `Cena con Martina · ${DATE.course}`;
  const gen = DATE.gen;
  if (!(b.kind === 'talk' && b.d === finale)) maitreBack(g);
  if (b.kind === 'talk') {
    g.talk(b.d(), g.npc('martina'), () => {
      if (!DATE.leaving) g.after(0.6, () => gen === DATE.gen && !DATE.leaving && runBeat(g, i + 1));
    });
  } else startMarcoEvent(g, b.dur, b.pops, b.away);
}

// A zero interesse Martina se ne va: game over, si riparte dall'inizio della portata
function leave(g: Game) {
  if (DATE.leaving) return;
  DATE.leaving = true;
  DATE.gen++;
  if (g.dialogue.isOpen) g.dialogue.close();
  endMarcoEvent(g, true);
  const m = g.npc('martina');
  g.talk(
    {
      name: 'Martina',
      start: 'a',
      nodes: {
        a: node(['Sai cosa? Me ne vado.', 'Il conto è tuo. E il tappo resta mio.', '* Martina si alza e se ne va. Resta un profumo di matita appena temperata.']),
      },
    },
    m,
    () =>
      g.gameOver(
        "Martina se n'è andata",
        'Troppe risposte sbagliate. A Martina non piacciono le frasi fatte, le bugie e gli amici travestiti da cameriere. Si riparte da questa portata.',
        () => retry(g),
      ),
  );
}

function retry(g: Game) {
  DATE.leaving = false;
  DATE.gen++;
  const gen = DATE.gen;
  DATE.interest = Math.max(DATE.checkpointInterest, 30);
  seatMartina(g);
  for (const id of ['marco', 'marcello']) g.setHidden(g.npc(id), true);
  g.player.setLook(MARTINA_LOOK);
  g.after(0.8, () => gen === DATE.gen && runBeat(g, DATE.checkpoint));
}

// =========================================================================
// MARCO IN GIRO PER LA SALA
// =========================================================================
const SPOT_POSE: Record<string, { action: 'think' | 'wave' | 'crossed'; line: string; caught: string; reply: string }> = {
  pianta: { action: 'think', line: 'Psst! Sono una pianta!', caught: 'Stecco... la pianta dietro di te ha il cappellino. E mi sta facendo l\'occhiolino.', reply: 'Sono una pianta! Le piante fanno l\'occhiolino!' },
  finestra: { action: 'wave', line: 'Ciao! Cioè: non ci sono!', caught: "C'è un omino alla finestra che ci saluta. Con entusiasmo. È il tuo amico?", reply: 'Ciao Martina! Cioè: non ci sono!' },
  attaccapanni: { action: 'crossed', line: 'Sono un cappotto. Col cappellino.', caught: "Quell'attaccapanni si muove. E ha il cappellino del tuo amico.", reply: 'Sono un cappotto! Un cappotto molto affezionato!' },
  acquario: { action: 'wave', line: 'Blub! Blub! Forza Stecco!', caught: "C'è un omino dietro l'acquario che fa le bolle con la bocca. Lo conosci?", reply: 'Blub!' },
  lampadario: { action: 'wave', line: 'Da quassù si vede tutto!', caught: "C'è un omino appeso al lampadario. Dimmi che non è tuo amico.", reply: 'Da quassù si vede benissimo!' },
};

function startMarcoEvent(g: Game, dur: number, pops: number, away: boolean) {
  const m = g.npc('martina');
  if (away) {
    // Martina va in bagno (e sparisce oltre la porta)
    m.baseAction = 'none';
    m.setBehavior({ type: 'patrol', path: [[-1.6, 6.6], [-10.8, 11.8]], speed: 1.6, once: true });
  } else m.baseAction = 'read';
  EV = { t: 0, dur, popsLeft: pops, away, spot: null, nextPopAt: 1.4, shooAt: 0, used: [], caughtSpot: null };
  const how = TOUCH ? 'guardalo e tocca lo schermo' : 'guardalo e fai click';
  g.toast(
    away
      ? `Martina è in bagno. Marco ne approfitterà: <b>trovalo e mandalo via</b> (${how}) prima che lei torni.`
      : `Martina legge il menù. Se Marco si fa vedere, <b>mandalo via</b> (${how}) prima che lei alzi gli occhi. Guardati intorno!`,
    'quest',
    7000,
  );
  g.audio.alert();
}

function popMarco(g: Game) {
  if (!EV) return;
  const free = MARCO_SPOTS.filter((s) => !EV!.used.includes(s.id));
  const spot = free[Math.floor(Math.random() * free.length)] ?? MARCO_SPOTS[0];
  EV.used.push(spot.id);
  EV.spot = spot;
  EV.popsLeft--;
  const marco = g.npc('marco');
  const pose = SPOT_POSE[spot.id];
  marco.pos.set(spot.pos[0], spot.y ?? 0, spot.pos[1]);
  marco.setBehavior({ type: 'stand' });
  marco.faceWhenNear = false;
  marco.homeRot = Math.atan2(spot.face[0] - spot.pos[0], spot.face[1] - spot.pos[1]);
  marco.body.root.rotation.y = marco.homeRot;
  marco.baseAction = pose.action;
  g.setHidden(marco, false);
  g.after(0.3, () => marco.say(pose.line, 3));
}

function shoo(g: Game) {
  if (!EV?.spot) return;
  const marco = g.npc('marco');
  marco.say(['Ok, ok, vado!', 'Non mi hai visto!', 'Ritirata strategica!', 'Sparisco! Come un cameriere!'][Math.floor(Math.random() * 4)], 1.5);
  g.hud.popWord(marco.pos.clone().setY(marco.topY + 0.3), g.player.camera, 'SCIÒ!');
  g.audio.good();
  EV.shooAt = EV.t + 0.7;
}

function updateMarcoEvent(g: Game, dt: number) {
  if (!EV || g.dialogue.isOpen || DATE.leaving) return;
  const ev = EV;
  ev.t += dt;
  const left = Math.max(0, Math.ceil(ev.dur - ev.t));
  STATUS.text = ev.away ? `Martina torna tra ${left} s: se Marco è in giro, mandalo via!` : `Martina legge il menù (${left} s): se Marco si fa vedere, mandalo via!`;
  // Martina arriva in bagno: sparisce
  const m = g.npc('martina');
  if (ev.away && !m.hidden && m.pos.distanceTo(new THREE.Vector3(-10.8, 0, 11.8)) < 0.3) g.setHidden(m, true);
  // Marco spunta
  if (!ev.spot && ev.popsLeft > 0 && ev.t >= ev.nextPopAt && ev.dur - ev.t > 2.5) popMarco(g);
  const marco = g.npc('marco');
  if (ev.spot && !ev.shooAt) {
    // lo stai guardando?
    const target = marco.pos.clone().setY(marco.pos.y + 1.2);
    const toM = target.clone().sub(g.player.eye);
    const angle = toM.angleTo(g.player.forward);
    const aimed = angle < 0.16 + 0.6 / Math.max(2, toM.length());
    if (aimed) {
      g.worldBubble(marco.pos.clone().setY(marco.topY + 0.35), TOUCH ? 'Sciò! (tocca)' : 'Sciò! (click)');
      if (g.input.clicked || g.input.wasPressed('interact')) shoo(g);
    }
  }
  if (ev.shooAt && ev.t >= ev.shooAt) {
    g.setHidden(marco, true);
    ev.spot = null;
    ev.shooAt = 0;
    ev.nextPopAt = ev.t + rand(1.2, 2.2);
  }
  if (ev.t >= ev.dur) endMarcoEvent(g, false);
}

function endMarcoEvent(g: Game, silent: boolean) {
  if (!EV) return;
  const ev = EV;
  EV = null;
  const caught = !silent && ev.spot && !ev.shooAt ? ev.spot : null;
  seatMartina(g);
  if (silent) {
    g.setHidden(g.npc('marco'), true);
    return;
  }
  const gen = DATE.gen;
  const next = () => {
    g.setHidden(g.npc('marco'), true);
    if (!DATE.leaving) g.after(0.5, () => gen === DATE.gen && !DATE.leaving && runBeat(g, DATE.beat + 1));
  };
  const m = g.npc('martina');
  if (caught) {
    const pose = SPOT_POSE[caught.id];
    g.talk(
      {
        name: 'Martina',
        start: 'a',
        nodes: {
          a: node(
            [ev.away ? '* Martina torna al tavolo. Si ferma. Guarda dietro di te.' : '* Martina alza gli occhi dal menù. Si ferma. Guarda dietro di te.', pose.caught, `@Marco| ${pose.reply}`],
            (g) => (g.has('scusa') && !DATE.scusaUsed ? 'scusa' : undefined),
            { do: (g) => love(g, -15), look: (g) => g.npc('marco') },
          ),
          scusa: {
            say: ["* (Hai una parola quasi nuova. In tasca. Cioè: non hai tasche. Ce l'hai e basta.)"],
            choices: [
              opt('Dì: "Scusa."', 15, 'sc1', undefined, (g) => {
                g.take('scusa');
                DATE.scusaUsed = true;
              }),
              { t: 'Faccio finta di niente.' },
            ],
          },
          sc1: node(['"Scusa"?', 'Nessuno lo dice mai. Accettata.']),
        },
      },
      m,
      next,
    );
  } else {
    g.talk(
      {
        name: 'Martina',
        start: 'a',
        nodes: {
          a: node(
            ev.away
              ? ['* Martina torna al tavolo.', 'Tutto tranquillo? Hai la faccia di uno che ha appena scacciato qualcuno.', '> Tranquillissimo.']
              : ['* Martina alza gli occhi dal menù.', 'Tutto bene? Ti giravi di continuo.', '> Ammiravo il locale.', 'Il locale ringrazia.'],
            undefined,
            { do: (g) => love(g, 5) },
          ),
        },
      },
      m,
      next,
    );
  }
}

// =========================================================================
// COMPARSE
// =========================================================================
export function seatMartina(g: Game) {
  const m = g.npc('martina');
  const W = g.world.anchors;
  g.setHidden(m, false);
  m.pos.set(W.martina.x, 0, W.martina.z);
  m.setBehavior({ type: 'sit' });
  m.homeRot = Math.PI;
  m.body.root.rotation.y = Math.PI;
  m.baseAction = 'none';
}

// il maître viene al tavolo quando c'è da parlare, poi torna al suo posto vicino all'ingresso
function maitreComes(g: Game) {
  const n = g.npc('bianco');
  const W = g.world.anchors;
  n.pos.set(W.maitreTable.x, 0, W.maitreTable.z);
  n.setBehavior({ type: 'stand' });
  n.homeRot = Math.atan2(0 - W.maitreTable.x, 4 - W.maitreTable.z);
  n.body.root.rotation.y = n.homeRot;
  n.faceWhenNear = false;
}

export function maitreBack(g: Game) {
  const n = g.npc('bianco');
  const W = g.world.anchors;
  if (n.pos.distanceTo(W.maitrePost) < 0.5) return;
  n.faceWhenNear = false;
  n.homeRot = Math.PI;
  n.setBehavior({ type: 'patrol', path: [[W.maitrePost.x, W.maitrePost.z]], speed: 1.6, once: true });
}

function showMarcello(g: Game) {
  const n = g.npc('marcello');
  const W = g.world.anchors;
  n.pos.set(W.tableSide.x, 0, W.tableSide.z);
  n.setBehavior({ type: 'stand' });
  n.faceWhenNear = true;
  n.baseAction = 'talk';
  g.setHidden(n, false);
}

function marcelloLeaves(g: Game) {
  const n = g.npc('marcello');
  const W = g.world.anchors;
  n.baseAction = 'none';
  n.setBehavior({ type: 'patrol', path: [[W.kitchen.x, W.kitchen.z]], speed: 3.2, once: true });
  g.after(4.5, () => g.setHidden(n, true));
}

function violinistComes(g: Game) {
  const v = g.npc('violinista');
  const W = g.world.anchors;
  v.pos.set(W.violinSpot.x, 0, W.violinSpot.z);
  v.setBehavior({ type: 'stand' });
  v.homeRot = Math.atan2(0 - W.violinSpot.x, 4 - W.violinSpot.z);
  v.body.root.rotation.y = v.homeRot;
  v.faceWhenNear = false;
  v.baseAction = 'violin';
  g.audio.playMusic('violino');
}

function violinistLeaves(g: Game) {
  const v = g.npc('violinista');
  const W = g.world.anchors;
  v.setBehavior({ type: 'patrol', path: [[W.violinist.x, W.violinist.z], [-3, 9], [4, 7]], speed: 0.8, wait: 3 });
  g.audio.playMusic('cena');
}

// "Voi siete quelli del Mercato Nero!": tutti i Pastelli si alzano
function everyoneStands(g: Game) {
  for (const n of g.npcs) {
    if (!n.id.startsWith('cliente') || n.hidden) continue;
    n.setBehavior({ type: 'stand' });
    if (n.body instanceof Stickman) n.body.seated = false;
    n.faceWhenNear = true;
    n.baseAction = 'guard';
  }
  g.npc('bianco').baseAction = 'guard';
  g.audio.alert();
}

// per frame (chiamato dalla storia)
export function updateDate(g: Game, dt: number) {
  if (!DATE.active) return;
  g.hud.meter(g.is('c5Finale') ? null : { label: 'Interesse di Martina', value: DATE.interest / 100, color: PINK });
  updateMarcoEvent(g, dt);
}
