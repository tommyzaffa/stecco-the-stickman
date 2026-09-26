import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Choice, DNode, Dialogue } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { INK } from '../../render/palette';
import { CLUES, CLUES_NEEDED } from './quests';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// Quadropoli: un furto, un ispettore che scrive verbali, tanti testimoni e un colpevole.
// Formato righe: 'testo' = PNG, '> testo' = tu, '* testo' = narratore, '@Nome| testo' = altri.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const BIRO_BLU = '#4d7cf0';

// stato dell'accusa (si azzera a ogni caricamento del capitolo)
const acc = { suspect: '', proof: '', fails: 0 };
export function resetAccusation() {
  acc.suspect = '';
  acc.proof = '';
  acc.fails = 0;
}

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  resetAccusation();

  // =========================================================================
  // MARCO: ti segue e fa il Watson
  // =========================================================================
  const marcoMenu: Choice[] = [
    { t: 'Hai qualche idea, Watson?', next: 'idea' },
    { t: "Dov'eri stanotte, Marco?", next: 'alibi' },
    { t: 'Niente, seguimi.' },
  ];
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: [A.marcoStart.x, A.marcoStart.z],
    face: [0, 0],
    look: { hat: 'cap' },
    behavior: { type: 'follow', target: () => g.player.pos, dist: 2.4, speed: 4.2 },
    icon: (g) => (g.quest('c3') === 4 ? 'main-turnin' : null),
    barks: () => [
      'Elementare, Stecco.',
      'Ho un fiuto per queste cose. Soprattutto per il cibo.',
      'Se fossi un tappo, dove mi nasconderei?',
      'Quadretti ovunque... mi sento a scuola.',
      'Io farei il detective, ma poi dovrei pensare.',
    ],
    dialogue: {
      name: 'Marco',
      start: (g) => {
        const q = g.quest('c3');
        if (q <= 1) return 'inizio';
        if (q <= 3) return 'indagine';
        if (q === 4) return 'fine';
        return 'dopo';
      },
      nodes: {
        inizio: {
          say: [
            'Quadropoli! Guarda quanti quadretti. Mi gira il cerchio.',
            "Il banco dei pegni è sulla piazza, lato nord. Si chiama \"Monte dei Tappi\".",
            '> Hai venduto il tappo di un boss e ti ricordi il nome del negozio.',
            'Ho una memoria eccellente per le cose che non dovevo fare.',
          ],
        },
        indagine: { say: ['Allora, detective? Io sono pronto. Per cosa, non lo so.'], choices: marcoMenu },
        menu: { say: ['Altro?'], choices: marcoMenu },
        idea: { say: [], next: () => pick(['idea1', 'idea2', 'idea3']) },
        idea1: { say: ['Secondo me è stato il maggiordomo.', "> Non c'è un maggiordomo.", 'Appunto. È sparito. Sospetto.'], next: 'menu' },
        idea2: { say: ['Io guarderei chi ha le chiavi.', '> Ottima idea.', 'Lo so. Mi capita di rado. Era questa.'], next: 'menu' },
        idea3: {
          say: ['Dicono che il colpevole torni sempre sul luogo del delitto.', '> Quindi?', 'Quindi io ci sto lontano. Non voglio sembrare colpevole.'],
          next: 'menu',
        },
        alibi: {
          say: ['Con te! Al club! A farci picchiare da un evidenziatore!', 'E poi in un vicolo. E poi su una panchina, a dormire. Alibi di ferro.'],
          next: 'menu',
        },
        fine: {
          say: [
            'Stecco. Sei un genio.',
            '> Lo so.',
            'Cioè, un genio per essere uno senza cervello. Nessuno di noi ce l\'ha, eh.',
            'Allora: il tappo è finito all\'asta di mezzanotte del Mercato Nero. Sotto la stazione.',
            "> E chi l'ha comprato?",
            'Non lo sappiamo. Ma stanotte c\'è un\'altra asta, e lì qualcuno lo saprà.',
            'Ci serviranno monete. O un\'arma. O tutte e due.',
            '> Tu hai monete?',
            'Io ho entusiasmo. È quasi la stessa cosa.',
          ],
          do: (g) => g.flag('c3Finale'),
        },
        dopo: { say: ["Mercato Nero, stanotte. Tu porta le monete, io porto l'entusiasmo."] },
      },
    },
  });

  // =========================================================================
  // ISPETTORE PENNA (Biro Blu): verbali e, alla fine, l'accusa
  // =========================================================================
  const SUSPECTS: [string, string][] = [
    ['temperino', 'Temperino'],
    ['colla', 'La Signora Colla'],
    ['postino', 'Il Postino'],
    ['gustavo', 'Gustavo, il commesso'],
    ['marco', 'Marco'],
  ];
  const proofChoices: Choice[] = [
    ...Object.entries(CLUES).map(([id, c]) => ({
      t: c.name,
      if: (g: Game) => g.hasClue(id),
      do: () => (acc.proof = id),
      next: 'verdetto',
    })),
    { t: 'Ha una faccia da colpevole.', do: () => (acc.proof = 'faccia'), next: 'verdetto' },
  ];
  const wrong = (lines: string[]): DNode => ({
    say: lines,
    next: 'multa',
  });
  const pennaNodes: Record<string, DNode> = {
    intro: {
      say: [
        'Ispettore Penna, Biro Blu. Si fermi: qui è tutto sotto controllo.',
        'Ho già scritto il verbale.',
        '> E cosa dice?',
        '"Furto. Colpevole: ignoto. Movente: boh. Caso chiuso." In bella calligrafia.',
        '> Non ha indagato?',
        'Indagare stanca. Scrivere è bello. Guardi che corsivo.',
      ],
      choices: [
        { t: 'Mi lasci indagare.', next: 'ok' },
        { t: 'Tutti dicono che è stato Temperino.', next: 'temperino' },
      ],
    },
    temperino: { say: ['Tutti dicono tutto di tutti. Io scrivo solo quello che si prova.', 'Cioè niente, finora.'], next: 'ok' },
    ok: {
      say: [
        'Vuole indagare? Un privato cittadino? Grigio?',
        '...E va bene. Mi porti almeno tre indizi e un colpevole.',
        'Ma se accusa la persona sbagliata le faccio un verbale. Tre verbali e la arresto.',
        'È la procedura. L\'ho scritta io, stamattina.',
      ],
      do: (g) => {
        if (g.quest('c3') < 2) {
          g.setStep('c3', 2);
          g.after(2.5, () =>
            g.toast(`Cerca gli indizi: guarda bene intorno al banco (anche dietro) e parla con tutti. Il taccuino è nel diario (<b>${keyName('journal')}</b>).`, 'info', 8000),
          );
        }
      },
    },
    pochi: {
      say: [(g) => `Indizi? Ne ha ${g.cluesFound.length}. Gliene servono ${CLUES_NEEDED}. È la procedura.`],
      choices: [
        { t: 'Cosa sa del furto?', next: 'sa' },
        { t: 'Vado a cercare.' },
      ],
    },
    sa: {
      say: [
        'Stanotte hanno rubato un tappo giallo dal banco dei pegni. Vetrina rotta. Nessun testimone.',
        'Cioè, nessun testimone che abbia voglia di venire in questura. Che poi è la stessa cosa.',
      ],
    },
    pronto: {
      say: ['Allora, detective. Chi è stato?'],
      choices: [
        ...SUSPECTS.map(([id, name]) => ({ t: name, do: () => (acc.suspect = id), next: 'prova' })),
        { t: 'Non sono ancora sicuro.', next: 'aspetto' },
      ],
    },
    aspetto: { say: ['Mi prenda il tempo che le serve. Io intanto scrivo un verbale sul tempo.'] },
    prova: { say: ['Con quale prova?'], choices: proofChoices },
    verdetto: {
      say: [],
      next: () => {
        if (acc.suspect === 'gustavo') return CLUES[acc.proof]?.decisive ? 'giusto' : 'debole';
        return `no_${acc.suspect}`;
      },
    },
    debole: wrong(['Con questa prova non posso arrestare nessuno.', '@Gustavo| Ahah!', 'Vede? Ride. E un po\' rido anche io.']),
    no_temperino: wrong([
      'Temperino?',
      'Stanotte Temperino ha vinto il Campionato di Pisolini. Ha dormito davanti a cinquanta persone.',
      'Un alibi più solido di così esiste solo nei verbali. I miei.',
    ]),
    no_colla: wrong([
      'La Signora Colla?',
      'Ha le dita appiccicose perché si chiama Colla. È nel nome, detective.',
      'E di notte incolla. Lo sanno tutti: lo racconta a tutti.',
    ]),
    no_postino: wrong(['Il postino?', 'Il postino non ha le chiavi. Ha solo buste. Vuote.', 'Non è un movente. È una professione.']),
    no_marco: wrong([
      '@Marco| IO?!',
      '@Marco| Stanotte ero con te! In un club! A farci picchiare!',
      'Confermo. Nel verbale di ieri c\'è scritto: "rissa con omino col cappellino al contrario, e amico grigio".',
      '...Aspetti. L\'amico grigio è lei?',
    ]),
    multa: {
      do: (g) => {
        acc.fails++;
        const fine = Math.min(10, g.state.coins);
        if (fine > 0) g.addCoins(-fine);
        g.audio.bad();
        if (acc.fails >= 3) {
          g.gameOver(
            'ARRESTATO',
            "L'Ispettore Penna ti ha arrestato per eccesso di fantasia.<br>Tre accuse sbagliate: è la procedura.",
            () => {
              acc.fails = 0;
              const p = g.npc('penna').pos;
              g.player.pos.set(p.x, 0, p.z - 2.2);
              g.player.setLook(p.clone().setY(1.5));
              g.toast('Riproviamo. Gli indizi che avevi trovato sono ancora nel taccuino.', 'info', 6000);
            },
          );
        }
      },
      say: [(g) => `Verbale per accusa infondata: 10 monete. Accuse sbagliate: ${acc.fails}/3.`, 'Torni quando ha le idee più chiare. O più indizi.'],
    },
    giusto: {
      do: (g) => {
        // Gustavo viene chiamato fuori dal negozio
        const gu = g.npc('gustavo');
        const p = g.npc('penna').pos;
        gu.pos.set(p.x + 1.3, 0, p.z + 0.6);
        gu.setBehavior({ type: 'stand' });
        gu.baseAction = 'none';
      },
      say: [
        (g) => `${CLUES[acc.proof].name}. Mmh.`,
        'GUSTAVO! Venga fuori un momento.',
        '@Gustavo| Sì? Stavo spazzando. Tantissimo.',
        '> La vetrina è stata rotta da dentro. La porta aperta con la chiave. E tu stanotte non eri a casa.',
        '@Gustavo| ...',
        '@Gustavo| Va bene. Sono stato io.',
        '@Gustavo| Ho venduto il tappo all\'asta di mezzanotte, al Mercato Nero. Sotto la stazione.',
        '@Gustavo| Mi servivano monete. Devo dei colori ai Pastelli a Cera. Mi hanno prestato un arancione. Con gli interessi.',
        'Gustavo, lei è in arresto. Compili il modulo 27-B: "Arresto di me medesimo". In triplice copia.',
        '@Gustavo| Posso usare la matita?',
        'Penna. Qui si usa la penna. Per questo mi chiamo così.',
      ],
      next: 'premio',
    },
    premio: {
      do: (g) => {
        g.addXp(60);
        g.addCoins(20);
        g.setStep('c3', 4);
        g.flag('gustavoArrested');
      },
      say: [
        'Detective, devo ammetterlo: ottimo lavoro. Le do venti monete di ricompensa. Dal fondo "cose impreviste".',
        'E ora mi scusi: devo scrivere il verbale più lungo della mia carriera.',
      ],
    },
    dopo: { say: ['Sto scrivendo il verbale. Siamo a pagina quattro. Gustavo sta ancora compilando il modulo.'] },
  };
  g.addNpc({
    id: 'penna',
    name: 'Ispettore Penna',
    pos: [A.ispettore.x, A.ispettore.z],
    face: [0, 0],
    look: { highlighter: BIRO_BLU, hat: 'police', mustache: true },
    icon: (g) => {
      const q = g.quest('c3');
      return q === 1 ? 'main' : q === 3 ? 'main-turnin' : null;
    },
    barks: () => ['Verbale, verbale, verbale.', 'Ho scritto un verbale su questo marciapiede. È troppo quadrato.', 'Circolare! In triplice copia!'],
    dialogue: {
      name: 'Ispettore Penna',
      start: (g) => {
        const q = g.quest('c3');
        if (q <= 1) return 'intro';
        if (q === 2 || (q === 3 && g.cluesFound.length < CLUES_NEEDED)) return 'pochi';
        if (q === 3) return 'pronto';
        return 'dopo';
      },
      nodes: pennaNodes,
    },
  });

  // =========================================================================
  // SIGNOR PEGNO e GUSTAVO (dentro il banco)
  // =========================================================================
  const pegnoMenu: Choice[] = [
    { t: 'Chi ha le chiavi del negozio?', next: 'chiavi' },
    { t: 'Chi le ha venduto il tappo?', next: 'venduto' },
    { t: 'Che ne pensa di Temperino?', next: 'temperino' },
    { t: 'Vorrei i tre sospiri. (1 moneta)', next: 'sospiri', if: (g) => !g.has('sospiri') },
    { t: 'Arrivederci.' },
  ];
  g.addNpc({
    id: 'pegno',
    name: 'Signor Pegno',
    pos: [A.pegno.x, A.pegno.z],
    face: [0, 25],
    look: { hat: 'hair', mustache: true, tie: true },
    action: 'think',
    barks: () => ['Il mio tappo...', 'Ladri senza gusto. Hanno lasciato l\'ombra usata.', 'Tutto in vendita! Tranne il tappo. Che non c\'è.'],
    dialogue: {
      name: 'Signor Pegno',
      start: (g) => (g.is('pegnoMet') ? 'menu' : 'intro'),
      nodes: {
        intro: {
          do: (g) => g.flag('pegnoMet'),
          say: [
            'Un cliente? No, un altro curioso.',
            'Mi hanno svaligiato! Il pezzo più prezioso della collezione: un tappo giallo fluo. Originale!',
            '> Hanno preso solo il tappo?',
            'Solo il tappo! Hanno lasciato tutto il resto. L\'ombra usata. I tre sospiri. Il ritratto di nessuno.',
            'Ladri senza gusto.',
          ],
          choices: pegnoMenu,
        },
        menu: { say: ['Mi dica.'], choices: pegnoMenu },
        chiavi: {
          say: ['Io e il mio commesso, Gustavo. Bravo ragazzo. Un po\' distratto.', 'Ultimamente è pieno di debiti. Ma bravo.', 'Lo pago in esperienza. L\'esperienza, si sa, non si mangia.'],
          next: 'menu',
        },
        venduto: {
          say: [
            'Un tizio col cappellino al contrario. Una fretta...',
            '"Mi servono cinquanta monete per entrare in un club, è questione di vita o di morte", diceva.',
            '> Marco.',
            'Si chiamava Marco? Non chiedo mai i nomi. È più elegante.',
          ],
          next: 'menu',
        },
        temperino: {
          say: ['Temperino? Gira sempre qui intorno. Ha la fedina sporca.', 'Anche se stanotte... no, stanotte c\'era la finale dei pisolini. Lui non se la perde mai.'],
          next: 'menu',
        },
        sospiri: { say: [], next: (g) => (g.state.coins >= 1 ? 'sospiriOk' : 'poveri') },
        sospiriOk: {
          do: (g) => {
            g.addCoins(-1);
            g.give('sospiri');
          },
          say: ['Tre sospiri in barattolo. Per le occasioni romantiche. O per le code alla posta.'],
        },
        poveri: { say: ['Neanche una moneta? Allora sospiri gratis. Come tutti.'] },
      },
    },
  });

  const gustavoMenu: Choice[] = [
    { t: "Dov'eri stanotte?", next: 'dove' },
    { t: 'Tu hai le chiavi del negozio, vero?', next: 'chiavi' },
    { t: 'Il tuo vicino dice che stanotte non eri a casa.', next: 'vicino', if: (g) => g.hasClue('vicino') },
    { t: 'Questa ricevuta dice "Venditore: G."', next: 'g', if: (g) => g.hasClue('biglietto') },
    { t: 'Un testimone ha visto qualcuno col cappellino al contrario.', next: 'cappello', if: (g) => g.hasClue('balcone') },
    { t: 'Niente, continua pure a spazzare.' },
  ];
  const gustavo = g.addNpc({
    id: 'gustavo',
    name: 'Gustavo',
    pos: [A.gustavo.x, A.gustavo.z],
    face: [3.2, 25],
    look: { hat: 'cap' },
    action: 'paint',
    faceWhenNear: false,
    barks: (g) => (g.is('gustavoArrested') ? ['In triplice copia...', 'Come si scrive "medesimo"?'] : ['Che caldo, eh?', 'Sto spazzando. Molto.', 'Io non so niente. Di niente. In generale.']),
    punchLines: ['Ehi! Sono un testimone! Cioè, un commesso!', 'Violenza sul posto di lavoro!'],
    dialogue: {
      name: 'Gustavo',
      start: (g) => (g.is('gustavoArrested') ? 'arrestato' : 'start'),
      nodes: {
        start: {
          say: ['Buongiorno. Cioè, buongiorno per modo di dire. Ci hanno svaligiato.', 'Sto spazzando i vetri. Tantissimo.'],
          choices: gustavoMenu,
        },
        menu: { say: ['Altro? Ho molto da spazzare.'], choices: gustavoMenu },
        dove: {
          say: ['A casa. A dormire. Da solo.', 'Chiedete a chiunque. Cioè, a nessuno: ero da solo.', 'È il bello di essere soli: nessuno può smentirti.'],
          next: 'menu',
        },
        chiavi: { say: ['Le chiavi? Sì. Cioè, no. Le ho perse. Ieri. Forse. Sì, ieri.', '> Dove?', 'Se lo sapessi non sarebbero perse. Logico, no?'], next: 'menu' },
        vicino: { say: ['Il mio vicino... non dorme mai, vede cose.', 'Una volta ha giurato di aver visto un triangolo. Qui. A Quadropoli. Figurati.'], next: 'menu' },
        g: {
          say: ['"G." può essere chiunque.', 'Gino. Gianni. Giallo. Gnomo. Gelato.', '> Gelato?', 'Ho fame quando sono nervoso. Non che io sia nervoso.'],
          next: 'menu',
        },
        cappello: {
          say: ['Tantissima gente ha il cappellino al contrario.', 'Il tuo amico, per esempio. Quello che ti segue.', '> Marco?', 'Io non accuso nessuno. Io spazzo.'],
          next: 'menu',
        },
        arrestato: { say: ['Sto compilando il modulo. "Arresto di me medesimo". È più difficile di quanto sembri.'] },
      },
    },
  });
  // scopa
  const broom = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 6).translate(0, -0.55, 0), new THREE.MeshBasicMaterial({ color: INK }));
  const brush = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4, 1, true).translate(0, -1.2, 0), new THREE.MeshBasicMaterial({ color: INK, wireframe: true }));
  broom.add(stick, brush);
  broom.rotation.x = -0.4;
  (gustavo.body as Stickman).prop.add(broom);

  // =========================================================================
  // SIGNORA COLLA
  // =========================================================================
  const collaMenu: Choice[] = [
    { t: 'Le impronte appiccicose sulla vetrina del banco?', next: 'impronte', if: (g) => g.hasClue('impronte') && !g.hasClue('colla') },
    { t: 'Ha visto qualcosa stanotte?', next: 'notte' },
    { t: 'Chi è "M.", quella del cartello?', next: 'm' },
    { t: 'Vorrei una briciola di gomma. (5 monete)', next: 'gomma', if: (g) => !g.has('gomma') && !g.questDone('mimo') },
    { t: 'Arrivederci.' },
  ];
  g.addNpc({
    id: 'colla',
    name: 'Signora Colla',
    pos: [A.colla.x, A.colla.z],
    face: [12, 0],
    look: { hat: 'bun' },
    barks: () => ['Colla! Colla fresca!', 'Tutto si aggiusta con la colla. Tranne la colla.'],
    dialogue: {
      name: 'Signora Colla',
      start: 'start',
      nodes: {
        start: { say: ['Buongiorno! Cartoleria Colla! Abbiamo colla, colla stick, colla vinilica e... colla.'], choices: collaMenu },
        menu: { say: ['Altro, caro?'], choices: collaMenu },
        impronte: {
          say: ['Mie!', 'Pulisco le vetrine dei vicini col mio prodotto. La colla pulisce tutto.', 'Poi non si stacca più niente, ma è pulito.'],
          next: 'improntePrese',
        },
        improntePrese: {
          do: (g) => g.findClue('colla'),
          say: ["> Quindi le impronte non c'entrano col furto.", 'Le impronte non c\'entrano mai con niente. Restano lì. Come i parenti.'],
          next: 'menu',
        },
        notte: { say: ['La notte io incollo. Mi rilassa.', 'Stanotte ho incollato insieme due giorni. Per questo oggi sembra così lungo.'], next: 'menu' },
        m: {
          say: [
            'Una ragazza. Rosa pastello: un colore vero, non fluo. Rarissimo.',
            'Colleziona tappi. Passa, compra un tappo e se ne va.',
            'Parla poco. Ma quando parla ha ragione. È irritante.',
          ],
          next: 'menu',
        },
        gomma: { say: [], next: (g) => (g.state.coins >= 5 ? 'gommaOk' : 'poveri') },
        gommaOk: {
          do: (g) => {
            g.addCoins(-5);
            g.give('gomma');
            if (g.quest('mimo') === 0) g.setStep('mimo', 1);
          },
          say: [
            'Ecco. Una briciola di gomma.',
            'Attento: la gomma cancella. Anche cose che non vorresti.',
            'Ho sentito di gente che ne usa di enormi, per cancellare quartieri interi. Brr.',
          ],
        },
        poveri: { say: ['Cinque monete. La gomma costa. Cancellare è un lusso.'] },
      },
    },
  });

  // =========================================================================
  // I TESTIMONI
  // =========================================================================
  const balcone = g.addNpc({
    id: 'balcone',
    name: 'Il Signore del Balcone',
    pos: [A.balcony.x, A.balcony.z],
    face: [4, 35.5],
    look: { hat: 'hair', mustache: true },
    action: 'crossed',
    talkRadius: 5,
    barks: () => ['Vedo tutto da quassù!', 'Ehi! Ti è caduta una linea!', 'Il bidone oggi è pieno di sorprese.'],
    dialogue: {
      name: 'Il Signore del Balcone',
      start: 'start',
      nodes: {
        start: {
          say: ['Ehi, tu, laggiù! Sì, tu, quello grigio!', 'Io sto sempre sul balcone. Guardo. È il mio lavoro. Non mi pagano, ma è il mio lavoro.'],
          choices: [
            { t: 'Ha visto qualcosa stanotte, al banco dei pegni?', next: 'notte', if: (g) => !g.hasClue('balcone') },
            { t: 'Cosa si vede da lassù?', next: 'vista' },
            { t: 'Arrivederci.' },
          ],
        },
        notte: {
          say: [
            'Alle tre qualcuno è uscito dal retro del banco e ha chiuso la porta a chiave.',
            'Con calma. Fischiettava.',
            "> Com'era?",
            'Un omino stilizzato. Col cappellino a visiera girato al contrario.',
            '> Tutti sono omini stilizzati.',
            'Ma non tutti fischiettano alle tre di notte chiudendo a chiave un negozio che non è loro.',
          ],
          next: 'fine',
        },
        fine: { do: (g) => g.findClue('balcone'), say: ['Scrivilo sul taccuino. I detective hanno sempre un taccuino.'] },
        vista: { say: ['Da quassù vedo tutto. La piazza. Il vicolo. Il bidone.', 'Il bidone è la mia serie preferita. Ogni giorno una puntata nuova.'] },
      },
    },
  });
  balcone.pos.y = A.balcony.y;

  g.addNpc({
    id: 'temperino',
    name: 'Temperino',
    pos: [A.benchTemperino.x, A.benchTemperino.z],
    face: [10, A.benchTemperino.z],
    look: { hat: 'beanie' },
    behavior: { type: 'sit' },
    barks: () => ['Non sono stato io. Stavolta.', 'Zzz... no, sono sveglio. Allenamento.'],
    dialogue: {
      name: 'Temperino',
      start: 'start',
      nodes: {
        start: {
          say: ['Lo so cosa pensi. "Ecco Temperino, quello con la fedina sporca".', "È vero. L'ho lavata. Resta grigia. Come tutto, qui."],
          choices: [
            { t: "Dov'eri stanotte?", next: 'notte' },
            { t: 'Perché ti chiamano Temperino?', next: 'nome' },
            { t: 'Niente.' },
          ],
        },
        notte: { say: ['Al Campionato di Pisolini. La finale.', 'Ho vinto. Chiedi al Presidente: è quello davanti al cartellone, dall\'altra parte della piazza.'] },
        nome: {
          say: ['Perché sono affilato. Di testa.', "E perché una volta ho temperato una penna della polizia. Era dell'Ispettore Penna. È ancora arrabbiato."],
        },
      },
    },
  });

  g.addNpc({
    id: 'presidente',
    name: 'Presidente dei Pisolini',
    pos: [A.pisolini.x, A.pisolini.z],
    face: [A.pisolini.x, -10],
    look: { hat: 'top', tie: true },
    barks: () => ['Shh! Stanno gareggiando!', 'Che tecnica! Che respiro!'],
    dialogue: {
      name: 'Presidente dei Pisolini',
      start: 'start',
      nodes: {
        start: {
          say: ['Il Campionato di Pisolini! Silenzio, per favore: alcuni concorrenti sono ancora in gara.'],
          choices: [
            { t: 'Temperino ha partecipato stanotte?', next: 'temperino', if: (g) => !g.hasClue('alibi') },
            { t: 'Come funziona il campionato?', next: 'regole' },
            { t: 'Arrivederci.' },
          ],
        },
        temperino: {
          say: [
            'Temperino ha VINTO!',
            'Dieci ore di sonno senza muoversi. Tecnica perfetta. Ha russato solo nelle pause regolamentari.',
            'Cinquanta spettatori l\'hanno guardato dormire tutta la notte. Uno spettacolo.',
          ],
          next: 'alibi',
        },
        alibi: {
          do: (g) => g.findClue('alibi'),
          say: ['> Quindi non può essere stato lui.', 'Impossibile. A meno che non rubi nel sonno. Ma sarebbe squalificato.'],
        },
        regole: {
          say: ['Vince chi dorme di più senza muoversi. Vietato sognare cose rumorose.', 'Quei tre sono in gara da stamattina. Vincerà chi si sveglia per ultimo.'],
        },
      },
    },
  });
  [8.4, 10.2, 12].forEach((x, i) => {
    const n = g.addNpc({
      id: `dorm${i}`,
      name: 'Concorrente',
      pos: [x, 7.1],
      face: [x, 20],
      look: { hat: (['beanie', 'none', 'bun'] as const)[i] },
      faceWhenNear: false,
      barks: () => ['Zzz...', 'Zzz... altri cinque minuti...', 'Zzz... no mamma, oggi niente scuola...'],
      punchLines: ['Mi hai svegliato! Sono squalificato!', 'NOOO! Ero in vantaggio!'],
      dialogue: { name: '', start: 'a', nodes: { a: { say: ['* Dorme. È in gara. Meglio non disturbare.'] } } },
      talkLabel: 'Guarda il concorrente',
    });
    (n.body as Stickman).ko = true;
  });

  g.addNpc({
    id: 'insonne',
    name: 'Il Tizio che non dorme',
    pos: [A.benchInsonne.x, A.benchInsonne.z - 0.05],
    face: [A.benchInsonne.x, -20],
    look: { hat: 'hair' },
    behavior: { type: 'sit' },
    action: 'drink',
    barks: () => ['Caffè numero quattordici.', 'Qualcuno ha visto la notte? Io sì. Tutta.'],
    dialogue: {
      name: 'Il Tizio che non dorme',
      start: 'start',
      nodes: {
        start: {
          say: ['Ciao. Non dormo mai. Mai.', 'Non per scelta: mi hanno disegnato con gli occhi aperti. Due puntini. Niente palpebre.'],
          choices: [
            { t: 'Conosci Gustavo, il commesso del banco dei pegni?', next: 'gustavo', if: (g) => !g.hasClue('vicino') },
            { t: 'Cosa fai tutta la notte?', next: 'notte' },
            { t: 'Buona... giornata.' },
          ],
        },
        gustavo: {
          say: [
            'Il mio vicino di casa? Certo.',
            'Stanotte non c\'era. Alle tre ho bussato per chiedergli un po\' di sale. Niente.',
            'Non c\'era lui e non c\'era il sale. Due assenze in una notte.',
          ],
          next: 'fine',
        },
        fine: {
          do: (g) => g.findClue('vicino'),
          say: ['> Magari dormiva.', 'Io riconosco il silenzio di chi dorme. Quello era il silenzio di chi non c\'è.'],
        },
        notte: { say: ['Conto le pecore del vicino. Ne ha tre. Le conto molto lentamente.'] },
      },
    },
  });

  g.addNpc({
    id: 'postino',
    name: 'Il Postino',
    pos: [-13, -13],
    look: { hat: 'police' },
    behavior: { type: 'patrol', path: [[-13, -13], [13, -13], [13, 13], [-13, 13]], speed: 1.8, wait: 1.5 },
    barks: () => ['Posta! Posta vuota!', 'Una busta per lei! È vuota, ma è per lei.'],
    dialogue: {
      name: 'Il Postino',
      start: 'start',
      nodes: {
        start: {
          say: ['Posta! Nessuno scrive più, ma io consegno lo stesso.'],
          choices: [
            { t: 'Hai visto qualcosa stanotte?', next: 'notte', if: (g) => !g.hasClue('luce') },
            { t: 'Cosa consegni, se nessuno scrive?', next: 'buste' },
            { t: 'Buon lavoro.' },
          ],
        },
        notte: {
          say: [
            'Stanotte consegnavo. Di notte le buste pesano meno.',
            'Alle tre sono passato davanti al banco dei pegni. Dentro la luce era accesa.',
            '> E non ti è sembrato strano?',
            'A me? Io consegno, non penso. Pensare non è nel contratto.',
          ],
          next: 'fine',
        },
        fine: {
          do: (g) => g.findClue('luce'),
          say: ['Però adesso che me lo fai notare... chi ruba con la luce accesa? Uno che si sente a casa sua.'],
        },
        buste: { say: ['Buste vuote. Le porto a chi non aspetta niente. Così nessuno resta deluso.'] },
      },
    },
  });

  // =========================================================================
  // MISSIONI SECONDARIE: il mimo, il turista, il poeta. E il fioraio.
  // =========================================================================
  g.addNpc({
    id: 'mimo',
    name: 'Il Mimo',
    pos: [A.mime.x, A.mime.z],
    face: [80, A.mime.z],
    look: { hat: 'beret' },
    action: 'push',
    faceWhenNear: false,
    icon: (g) => (g.quest('mimo') === -1 ? 'side' : g.questActive('mimo') && g.has('gomma') ? 'turnin' : null),
    barks: (g) => (g.questDone('mimo') ? ['* (mima felicità)', '* (mima un ringraziamento)'] : ['...', 'Mmmh! Mmmh!', '* (mima "aiuto")']),
    dialogue: {
      name: 'Il Mimo',
      start: (g) => {
        const q = g.quest('mimo');
        if (q === -1) return 'intro';
        if (g.questDone('mimo')) return 'dopo';
        return g.has('gomma') ? 'dai' : 'attesa';
      },
      nodes: {
        intro: {
          say: ['...', '* Il mimo fa finta di essere intrappolato in una scatola invisibile.', '* Lo fa molto bene. Troppo bene.'],
          choices: [
            { t: 'Bravo! Molto realistico.', next: 'bravo' },
            { t: 'Tutto bene?', next: 'aiuto' },
          ],
        },
        bravo: { say: ['...', '* Il mimo scuote la testa. Indica il muro. Indica te. Indica il muro.'], next: 'aiuto' },
        aiuto: {
          say: [
            '...Va bene, parlo. Non è un numero. Sono bloccato davvero.',
            'Questo è il bordo del foglio. Facevo il muro invisibile e il muro invisibile... c\'era.',
            'Mi serve una gomma. Una briciola basta: cancello un pezzetto di bordo ed esco.',
            '> Esci dove? Di là non c\'è niente.',
            'Appunto. Sono un mimo: il niente è il mio mestiere.',
          ],
          choices: [
            { t: 'Ti trovo una gomma.', next: 'ok' },
            { t: 'Resta lì, sei bravissimo.' },
          ],
        },
        ok: {
          do: (g) => {
            g.startQuest('mimo');
            if (g.has('gomma')) g.setStep('mimo', 1, true);
          },
          say: ['Grazie. La Signora Colla, in cartoleria, vende gomme. Io intanto... resto qui.'],
        },
        attesa: { say: ['* Il mimo mima una gomma. È una gomma molto convincente. Ma non funziona.'] },
        dai: { say: ['* Il mimo vede la briciola di gomma. I suoi occhi, due puntini, si allargano.'], choices: [{ t: 'Ecco la briciola di gomma.', next: 'libera' }] },
        libera: {
          do: (g) => g.take('gomma'),
          say: [
            '* Il mimo strofina la briciola sul bordo del foglio.',
            '* Il tratteggio si scolora. Il muro invisibile diventa meno invisibile. Poi sparisce.',
            'Libero! Libero! Vado a vedere cosa c\'è fuori dal foglio!',
          ],
          next: 'premio',
        },
        premio: {
          do: (g) => {
            g.addCoins(10);
            g.give('guanti');
            g.addXp(30);
            g.completeQuest('mimo');
            g.flag('mimoFree');
          },
          say: [
            'Tieni: dieci monete e i miei guanti bianchi.',
            'Non hai le mani, lo so. Ma i guanti sono un pensiero, e i pensieri non hanno bisogno di mani.',
            'E stai attento a chi usa le gomme grosse. Ho sentito che qualcuno cancella interi quartieri.',
          ],
        },
        dopo: { say: ['* Il mimo mima un ringraziamento. Poi mima un abbraccio. Poi mima di essersi imbarazzato.'] },
      },
    },
  });

  g.addNpc({
    id: 'turista',
    name: 'Turista',
    pos: [A.turista.x, A.turista.z],
    face: [A.spawn.x, A.spawn.z],
    look: { hat: 'party' },
    icon: (g) => (g.quest('turista') === -1 ? 'side' : null),
    barks: (g) => (g.questActive('turista') ? ['La seguo! Non corra, ho le linee corte.', 'Che bello! Cioè, che quadrato!'] : ['Tutte le strade sono uguali!', 'Mi sono perso. Di nuovo.']),
    dialogue: {
      name: 'Turista',
      start: (g) => (g.quest('turista') === -1 ? 'intro' : g.questDone('turista') ? 'dopo' : 'segue'),
      nodes: {
        intro: {
          say: [
            'Scusi! Scusi! Lei è di qui?',
            'Sono di Foglio Protocollo. Da noi le strade sono righe, tutte orizzontali. Qui ci sono i quadretti!',
            'Tutte le vie sono dritte e tutte uguali. Mi sono perso quattro volte in due metri.',
            "Devo andare al Monumento all'Angolo Retto. È la cosa più famosa di Quadropoli.",
          ],
          choices: [
            { t: 'La accompagno io.', next: 'ok' },
            { t: 'È dritto davanti a lei.', next: 'dritto' },
          ],
        },
        dritto: { say: ['Dritto? Qui è TUTTO dritto! È questo il problema!'], choices: [{ t: 'Va bene, la accompagno.', next: 'ok' }, { t: 'Buona fortuna.' }] },
        ok: {
          do: (g) => {
            g.startQuest('turista');
            g.npc('turista').setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2.2, speed: 3.6 });
          },
          say: ['Grazie! La seguo. Non corra, ho le linee corte.'],
        },
        segue: { say: ['Siamo arrivati? No? Va bene. Tutto è uguale, ma mi fido.'] },
        arrivo: {
          say: [
            "Eccolo! Il Monumento all'Angolo Retto!",
            '...',
            'È un angolo.',
            'Retto.',
            '> Novanta gradi di pura gloria.',
            'Ho attraversato mezzo quaderno per un angolo.',
            '...Però è venuto proprio bene. Guardi che precisione. Mi commuovo.',
          ],
          next: 'premio',
        },
        premio: {
          do: (g) => {
            g.addCoins(15);
            g.addXp(25);
            g.completeQuest('turista');
            g.npc('turista').setBehavior({ type: 'stand' });
          },
          say: ['Tenga, quindici monete. E se passa da Foglio Protocollo, le faccio vedere la nostra riga più famosa.'],
        },
        dopo: { say: ['Mi disegno vicino all\'angolo. Per il ricordo.'] },
      },
    },
  });

  // una strofa da completare: ogni scelta porta alla sua risposta (base_0, base_1, ...)
  const rima = (verse: string, opts: string[], base: string): DNode => ({
    say: [verse],
    choices: opts.map((t, i) => ({ t, next: `${base}_${i}` })),
  });
  const replies = (base: string, lines: string[], next: string): Record<string, DNode> =>
    Object.fromEntries(lines.map((l, i) => [`${base}_${i}`, { say: [l], next }]));
  g.addNpc({
    id: 'poeta',
    name: 'Il Poeta',
    pos: [A.poeta.x, A.poeta.z],
    face: [A.poeta.x, -10],
    look: { hat: 'beret', beard: true },
    action: 'speech',
    icon: (g) => (g.quest('poeta') === -1 ? 'side' : null),
    barks: (g) => (g.questDone('poeta') ? ['Sto scrivendo un sonetto sull\'ipotenusa.'] : ['Oh, quadretto!', 'Cosa fa rima con "ascissa"? Niente. Come la mia vita.']),
    dialogue: {
      name: 'Il Poeta',
      start: (g) => (g.questDone('poeta') ? 'dopo' : 'intro'),
      nodes: {
        intro: {
          say: ['Oh, musa! Oh, quadretto! Oh...', "Scusa. Sto scrivendo una poesia d'amore, ma mi mancano le rime. Mi aiuti?"],
          choices: [
            { t: 'Proviamo.', next: 'r1' },
            { t: 'Non sono bravo con le rime.', next: 'no' },
          ],
        },
        no: { say: ['Nessuno è bravo con le rime. È per questo che le poesie sono corte.'] },
        r1: {
          ...rima('"Il tuo sguardo è un quadretto, perfetto come un..."', ['...righetto.', '...rettangoletto.', "...biglietto dell'autobus."], 'r1'),
          do: (g) => {
            if (g.quest('poeta') === -1) g.startQuest('poeta');
          },
        },
        ...replies('r1', ['"Righetto". Non esiste, ma suona benissimo.', '"Rettangoletto"! Diminutivo geometrico! Audace.', 'Non rima. Ma è così vero.'], 'r2'),
        r2: rima('"Il mio cuore è una linea spezzata, dal giorno che tu..."', ['...mi hai cancellata.', '...sei passata.', '...hai sbagliato strada.'], 'r2'),
        ...replies('r2', ['Troppo triste. Mi piace.', 'Classico. Un po\' banale. Perfetto.', 'A Quadropoli succede spesso. È realismo.'], 'r3'),
        r3: rima('Ultimo verso. "E se un giorno ci cancelleranno..."', ['"...ci ridisegneranno."', '"...pazienza."', '"...almeno eravamo tratteggiati bene."'], 'r3'),
        ...replies('r3', ['Speranzoso. Commovente. Quasi ottimista.', 'Brutale. Onesto. Molto quadropolitano.', 'Genio. Piango. Non ho le lacrime, ma piango.'], 'fine'),
        fine: {
          do: (g) => {
            g.give('poesia');
            g.addXp(25);
            g.completeQuest('poeta');
          },
          say: [
            'È finita! La mia prima poesia finita!',
            'Tienila tu. Io ne scriverò un\'altra. Tanto non la finirò.',
            'Usala con qualcuno che ti piace. Le poesie sono come le chiavi: aprono le porte. A volte le sbattono.',
          ],
        },
        dopo: { say: ['Sto scrivendo un sonetto sull\'ipotenusa. È complicato: c\'è di mezzo Pitagora.'] },
      },
    },
  });

  g.addNpc({
    id: 'fioraio',
    name: 'Fioraia',
    pos: [A.fioraio.x, A.fioraio.z],
    face: [A.fioraio.x, -20],
    look: { hat: 'bun' },
    barks: () => ['Fiori! Fiori disegnati!', 'Un fiore per il tuo appuntamento? Ah, non hai un appuntamento.'],
    dialogue: {
      name: 'Fioraia',
      start: 'start',
      nodes: {
        start: {
          say: ['Fiori disegnati! Non appassiscono mai. Non profumano mai. È un compromesso.'],
          choices: [
            { t: 'Un fiore, grazie. (8 monete)', next: 'buy', if: (g) => !g.has('fiore') },
            { t: 'Per chi sono i fiori, di solito?', next: 'chi' },
            { t: 'Niente, grazie.' },
          ],
        },
        buy: { say: [], next: (g) => (g.state.coins >= 8 ? 'ok' : 'no') },
        ok: {
          do: (g) => {
            g.addCoins(-8);
            g.give('fiore');
          },
          say: ['Ecco a te. Per una persona speciale?', '> Per ora per nessuno.', "Allora è un fiore d'attesa. I più belli."],
        },
        no: { say: ['Otto monete. I fiori non crescono sugli alberi. Qui crescono sul foglio, ma costano uguale.'] },
        chi: { say: ['Per le scuse, per gli appuntamenti, per i funerali.', 'Stessi fiori. Cambia la faccia di chi li porta.'] },
      },
    },
  });

  // =========================================================================
  // GLI SPINGITORI: a Quadropoli le auto non hanno il motore, le spinge qualcuno
  // =========================================================================
  const pushLines = [
    ['Non posso fermarmi! Se mi fermo, si ferma la macchina.', '> Perché non ci sale sopra?', 'E poi chi spinge? Ragiona.'],
    ['Sono un tassista.', '> E il cliente?', 'Il cliente spinge con me. È un servizio condiviso.'],
    ['Faccio il giro della piazza da stamattina.', '> Dove deve andare?', 'Da nessuna parte. Ma con molta dignità.'],
  ];
  for (let i = 0; i < 3; i++) {
    const start = [[-19, 19], [19, -19], [19, 19]][i];
    const path: [number, number][] = [[-19, 19], [19, 19], [19, -19], [-19, -19]];
    const k = path.findIndex((p) => p[0] === start[0] && p[1] === start[1]);
    const rotated = [...path.slice(k), ...path.slice(0, k)];
    g.addNpc({
      id: `spinta${i}`,
      name: i === 1 ? 'Spingitrice' : 'Spingitore',
      pos: [start[0], start[1]],
      face: [rotated[1][0], rotated[1][1]],
      look: { hat: (['cap', 'bun', 'beanie'] as const)[i] },
      action: 'push',
      faceWhenNear: false,
      noTurn: true,
      behavior: { type: 'patrol', path: [...rotated.slice(1), rotated[0]], speed: 2.4, wait: 0 },
      barks: () => ['Precedenza!', 'Uff... salita.', 'Qualcuno ha visto un motore? No? Pazienza.'],
      dialogue: { name: i === 1 ? 'Spingitrice' : 'Spingitore', start: 'a', nodes: { a: { say: pushLines[i] } } },
    });
  }
}

// Dialogo "arrivo al monumento" del turista (lo avvia la storia)
export function touristArrival(g: Game): Dialogue {
  const spec = g.specs.get('turista')!;
  return { ...spec.dialogue!, start: 'arrivo' };
}
