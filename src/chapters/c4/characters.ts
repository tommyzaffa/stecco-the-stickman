import * as THREE from 'three';
import type { Game, NpcSpec } from '../../game/game';
import type { Choice, Dialogue } from '../../game/dialogue';
import type { FighterOpts } from '../../game/combat';
import { Stickman } from '../../entities/stickman';
import { CERA, THEME } from '../../render/palette';
import { raidCrash } from './raid';
import { presentLot, sendLot } from './auction';
import { rangeRunning } from './range';
import { keyName } from '../../settings';
import { TOUCH } from '../../touch';

// ---------------------------------------------------------------------------
// Il Mercato Nero: venditori di cose disegnate male, un'asta, un buttafuori al contrario
// e, a un certo punto, un astuccio intero di Pastelli a Cera.
// Formato righe: 'testo' = PNG, '> testo' = tu, '* testo' = narratore, '@Nome| testo' = altri.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const coins = (g: Game) => g.state.coins;

// pistola di cera in mano (per i Pastelli)
function waxGun(color: string) {
  const grp = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.07).translate(0, -0.12, 0), new THREE.MeshBasicMaterial({ color }));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.13).translate(0, -0.03, -0.07), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
  grp.add(barrel, grip);
  return grp;
}

// lama di temperino (per gli Appuntiti)
function knife() {
  const grp = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.06).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#d9d4c8' }));
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05).translate(0, -0.04, 0), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
  grp.add(blade, handle);
  return grp;
}

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];

  // voci al telefono (non si vedono: servono solo per le voci del dialogo)
  for (const [id, name] of [['martinaM', 'M.'], ['martina', 'Martina']]) {
    g.addNpc({ id, name, pos: [0, -300], hidden: true });
  }

  // =========================================================================
  // MARCO
  // =========================================================================
  const marcoMenu: Choice[] = [
    { t: 'Che ne pensi del mercato?', next: 'mercato' },
    { t: 'Hai delle monete?', next: 'monete' },
    { t: "Un'idea per l'asta?", next: 'asta', if: (g) => g.quest('c4') <= 5 },
    { t: 'Niente, seguimi.' },
  ];
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marcoStart'),
    face: [A.tornello.x, A.tornello.z],
    look: { hat: 'cap' },
    faceWhenNear: false,
    icon: (g) => (g.quest('c4') === 9 ? 'main-turnin' : null),
    barks: (g) =>
      g.quest('c4') === 6
        ? ['Io copro le retrovie!', 'Sono un sacco di Pastelli!', 'Stecco! A destra! No, a sinistra! Ovunque!', 'Qui dietro si sta benissimo, vieni!']
        : g.quest('c4') <= 3
          ? ['Sono un habitué. Lui non se lo ricorda.', 'Ho un fiuto per i posti loschi.', 'Una volta qui ho comprato un calzino. Solo uno.']
          : ['Guarda quanta roba. Tutta rubata. Che emozione.', 'Tieni d\'occhio il portafoglio. Anzi, non ce l\'abbiamo.', 'Mercato Nero... in realtà è marrone.', 'Se vedi qualcosa per terra, è nostro.'],
    dialogue: {
      name: 'Marco',
      start: (g) => {
        const q = g.quest('c4');
        if (q <= 3) return 'fuori';
        if (q === 6) return 'raid';
        if (q === 9) return 'fine';
        if (q >= 7) return 'dopo';
        return 'menu0';
      },
      nodes: {
        fuori: {
          say: [
            'Quel buttafuori mi odia. Cioè, non si ricorda di me. È peggio.',
            '> Vuole che entriamo armati.',
            'È un posto serio. Qui chi non ha un\'arma fa la figura del turista.',
          ],
        },
        menu0: { say: ['Allora? Io ho gli occhi aperti. Tutti e due i puntini.'], choices: marcoMenu },
        menu: { say: ['Altro?'], choices: marcoMenu },
        mercato: { say: ['È come un mercato normale, ma tutti parlano sottovoce e nessuno fa lo scontrino.', 'Cioè, è come un mercato normale.'], next: 'menu' },
        monete: {
          say: ['Io ho un sistema. Guardo per terra.', 'Nei mercati cade sempre qualcosa: monete, calzini, dignità. Guarda negli angoli.'],
          next: 'menu',
        },
        asta: {
          say: ['Semplice: aspettiamo che qualcuno offra, poi offriamo di più.', '> E il "di più" dove lo prendiamo?', 'Quello è un dettaglio. Io penso alla strategia.'],
          next: 'menu',
        },
        raid: { say: ['Io copro le retrovie!', '> Sei accovacciato dietro il palco.', 'Appunto. Le retrovie sono qui.'] },
        dopo: { say: ['Il banditore sa a chi è andato il tappo. Scommetto che è una cosa romantica. Tutti i tubi portano all\'amore.'] },
        fine: {
          say: [
            'Allora? Allora? Chi era al telefono?',
            '> Si chiama Martina. Ha il tappo. Sabato ceniamo da Pastello.',
            'Un appuntamento! Stecco ha un appuntamento! Con una a colori!',
            '> È una trattativa.',
            'Con il dolce?',
            '> ...Con il dolce.',
            'Allora è un appuntamento.',
            'Però, "Da Pastello"... è il ristorante dei Pastelli a Cera. Quelli di stanotte. Tutti quelli di stanotte.',
            '> ...',
            'Tranquillo, ti presto la mia camicia buona. È uguale a questa, ma pensata meglio.',
          ],
          next: (g) => (g.is('noShadow') ? 'ombra' : 'via'),
        },
        ombra: {
          say: ['Aspetta. Stecco... dov\'è la tua ombra?', '> L\'ho scambiata. Tanto in prima persona non me la vedo.', 'Giusto. Allora non conta.'],
          next: 'via',
        },
        via: { say: ['Andiamo. Qui sotto c\'è troppo odore di cera.'], do: (g) => g.flag('c4Finale') },
      },
    },
  });

  // =========================================================================
  // TORNELLO, il buttafuori (metal detector al contrario)
  // =========================================================================
  g.addNpc({
    id: 'tornello',
    name: 'Tornello',
    pos: at('tornello'),
    face: [A.tornello.x, A.tornello.z - 5],
    look: { sunglasses: true, scale: 1.25 },
    faceWhenNear: true,
    icon: (g) => (g.quest('c4') === 0 || g.quest('c4') === 3 ? 'main' : null),
    shotLines: ['Ehi! Il metal detector sono io!', 'Sono il buttafuori, non il bersaglio!', 'Questo lo segno. Sul registro dei maleducati.'],
    barks: (g) =>
      g.is('gateOpen')
        ? ['Armati e responsabili. Così mi piace.', 'Chi entra, entra armato. Chi esce, faccia come vuole.', 'Controllo solo chi entra. Chi arriva dai tunnel non è affar mio.']
        : ['Metal detector. Prego.', 'Niente arma, niente mercato.', 'Regolamento interno.'],
    dialogue: {
      name: 'Tornello',
      start: (g) => (g.is('gateOpen') ? 'dentro' : g.has('pistola') && g.is('rangeDone') ? 'armato' : g.has('pistola') ? 'prova' : g.quest('c4') === 0 ? 'primo' : 'ancora'),
      nodes: {
        primo: {
          say: [
            'Alt. Metal detector.',
            '* Il buttafuori ti passa accanto un cerchio disegnato. Il cerchio non suona.',
            'Niente. Nemmeno un temperino. Sei disarmato.',
            '> È un problema?',
            'Certo che è un problema. Questo è il Mercato Nero. Entrare disarmati qui è pericolosissimo.',
            'Per la tua sicurezza: niente arma, niente mercato. Regolamento interno.',
            '@Marco| Ma io sono un habitué! Venivo qui sempre!',
            'Mai visto.',
            '@Marco| Venivo qui sempre... a guardare la porta.',
            'Le armi le vende il Calamaio: la porta con l\'insegna, qui nel corridoio. Tiro a segno compreso. Poi torna.',
          ],
          do: (g) => g.setStep('c4', 1),
        },
        ancora: { say: ['Disarmato. Ancora. Il Calamaio è nel corridoio, la porta con l\'insegna.'] },
        prova: { say: ['Hai una pistola ma niente porto d\'armi. Prima la prova del Calamaio. Siamo gente seria.'] },
        armato: {
          say: [
            'Alt. Metal detector.',
            '* Il cerchio disegnato fa BIIIP. Il buttafuori sorride per la prima volta in vita sua.',
            'Armato! Con porto d\'armi! Finalmente una persona responsabile.',
            'Prego, entra pure. Regole della casa: non si ruba, non si spara, e se si spara si spara ai ladri.',
            '> E chi sono i ladri?',
            'Qui sotto? Tutti. Buona serata.',
          ],
          do: (g) => {
            g.flag('gateOpen');
            g.setStep('c4', 4);
          },
        },
        dentro: { say: [pick(['Tutto bene là dentro?', 'Se compri qualcosa, non dirmi cosa.', 'Il banditore è in fondo, sul palco. Non puoi sbagliare: è l\'unico che urla numeri.'])] },
      },
    },
  });

  // =========================================================================
  // CALAMAIO: armeria e tiro a segno
  // =========================================================================
  g.addNpc({
    id: 'calamaio',
    name: 'Calamaio',
    pos: at('calamaio'),
    face: [-5, -46],
    look: { hat: 'top', mustache: true, scale: 1.1 },
    icon: (g) => (g.quest('c4') === 1 ? 'main' : !g.questDone('record') && g.is('rangeDone') && !rangeRunning() ? 'side' : null),
    shotLines: ['Non sul titolare! C\'è scritto!', 'Ehi! Io sono pieno d\'inchiostro, non mi serve il tuo!', 'Sagome, non clienti!'],
    barks: () => ['Inchiostro di prima qualità. Macchia dove deve.', 'Pistole a inchiostro: le uniche che si possono cancellare.', 'La nonna ha un occhio fenomenale. Di cartone, ma fenomenale.'],
    dialogue: {
      name: 'Calamaio',
      start: (g) => (!g.has('pistola') ? 'intro' : !g.is('rangeDone') ? 'prova' : 'menu'),
      nodes: {
        intro: {
          say: [
            'Benvenuto all\'Armeria Calamaio! Armi a inchiostro, cartucce e consigli non richiesti.',
            '> Il buttafuori non mi fa entrare disarmato.',
            'Tornello? Il mio miglior procacciatore di clienti. Lo pago in cartucce.',
            'Ecco qua: la pistola a inchiostro. Spara gocce di blu.',
            '> Blu? Qui è tutto in bianco e nero.',
            'Appunto: così si vede dove hai sparato. È una pistola onesta.',
            'Prima però la prova: sei sagome da colpire. Superi la prova e la pistola è tua, porto d\'armi incluso.',
            '> E il porto d\'armi chi lo firma?',
            'Io. Ho una calligrafia bellissima. Sono un calamaio.',
            'Mettiti sulla linea di tiro quando sei pronto. E ricorda: la nonna NON si colpisce.',
          ],
          do: (g) => {
            g.give('pistola');
            g.state.clip = g.clipSize;
            g.state.ammo = Math.max(g.state.ammo, 24);
            g.player.setWeapon('pistol');
            g.setStep('c4', 2);
            g.after(1, () =>
              g.toast(
                TOUCH
                  ? '<b>Pistola a inchiostro</b><br>Tocca lo schermo per sparare (dove punta il mirino) · RICARICA: ricarica · ARMA: cambia arma'
                  : `<b>Pistola a inchiostro</b><br>Click: spara · ${keyName('reload')}: ricarica · ${keyName('weapon1')}: pugni · ${keyName('weapon3')}: pistola<br><small>(i tasti si cambiano dalle impostazioni)</small>`,
                'info',
                7000,
              ),
            );
          },
        },
        prova: { say: ['Linea di tiro, sei sagome, niente nonne. Quando vuoi.'] },
        menu: {
          say: [(g) => (g.questDone('record') ? 'Il campione! La nonna non si è ancora ripresa.' : 'Torna per il record della nonna?')],
          choices: [
            { t: 'Un consiglio per le sparatorie?', next: 'consiglio' },
            { t: 'Perché proprio la nonna?', next: 'nonna' },
            { t: 'Vendi cartucce?', next: 'cartucce' },
            { t: 'Ciao.' },
          ],
        },
        consiglio: {
          say: [
            'Linea colorata puntata su di te: abbassati dietro qualcosa. Sempre.',
            'Non stare fermo allo scoperto. E mira alla testa: nei fumetti vale di più.',
            'E i barili d\'inchiostro... se ne vedi uno vicino a qualcuno di antipatico, sparaci.',
          ],
        },
        nonna: {
          say: ['Serve a insegnare che non si spara a tutto quello che si muove.', 'Anche se le nonne si muovono pochissimo. È questo che le rende pericolose.'],
        },
        cartucce: { say: ['Le vende Bossolo, al mercato. Io vendo solo pistole: le cartucce sono un altro reparto. Il mio reparto è l\'ottimismo.'] },
      },
    },
  });

  // =========================================================================
  // IL BANDITORE (l'asta vera e propria è in auctionDialogue, più sotto)
  // =========================================================================
  g.addNpc({
    id: 'banditore',
    name: 'Banditore',
    pos: at('banditore'),
    face: [0, 0],
    look: { mustache: true, tie: true, hat: 'beret' },
    faceWhenNear: true,
    talkRadius: 3.6,
    icon: (g) => (g.quest('c4') === 4 || g.quest('c4') === 5 || g.quest('c4') === 7 ? 'main' : null),
    shotLines: ['Non si spara al banditore! Si spara ai prezzi!', 'Mi hai macchiato il leggio!', 'Questo te lo metto in conto!'],
    barks: (g) =>
      g.quest('c4') >= 7
        ? ['Aggiudicato: il silenzio.', 'Stasera nessun rimborso. Nemmeno per i proiettili.']
        : ['Lotto sette stasera! Tappo raro!', 'Chi offre di più? Chi offre di meno? Chi offre?', 'Asta di mezzanotte! Anche prima, se c\'è gente!'],
    dialogue: {
      name: 'Banditore',
      start: (g) => {
        const q = g.quest('c4');
        if (q <= 4) return 'lotto';
        if (q === 5) return 'pronto';
        if (q === 7) return 'dopo';
        return 'fine';
      },
      nodes: {
        lotto: {
          say: [
            'Un nuovo offerente! Benvenuto all\'asta di mezzanotte!',
            '> Cerco il lotto sette. Un tappo giallo.',
            'Il tappo fluo! Pezzo raro. Stasera va all\'asta, appena comincia.',
            '> E quando comincia?',
            'A mezzanotte. Cioè quando lo dico io. Io sono il banditore: il tempo qui lo batto io, col martelletto.',
            'Dimmi quando sei pronto e cominciamo. Nel frattempo fai un giro: il mercato è pieno di occasioni. Quasi tutte vere.',
          ],
          next: 'pronto_scelta',
          do: (g) => g.setStep('c4', 5, true),
        },
        pronto: { say: ['Allora? Cominciamo?'], next: 'pronto_scelta' },
        pronto_scelta: {
          say: [],
          choices: [
            { t: 'Cominciamo l\'asta!', next: 'parte' },
            { t: 'Aspetta, faccio un giro.' },
          ],
        },
        parte: {
          say: ['Signori! Ai vostri posti! Si comincia!'],
          do: (g) => g.flag('auctionGo'),
        },
        dopo: {
          say: [
            '* Il banditore esce da sotto il leggio. Ha il martelletto alzato, per difendersi.',
            'Sono andati? Sono andati. Aggiudicato: il silenzio. TOC.',
            '> Il tappo. A chi l\'hai venduto?',
            'Riservatezza del cliente. Il Mercato Nero è una cosa...',
            '> ...seria. Lo so. Ti ho appena salvato il mercato da un astuccio intero di Pastelli a Cera.',
            'Giusto. È una cosa seria, ma non così seria.',
            '* Il banditore apre il registro delle vendite. È scritto a matita: così, se serve, si cancella.',
            '"Lotto sette: tappo giallo fluo. Aggiudicato a: M., collezionista di tappi rari. Consegna: posta pneumatica."',
            'La signorina lascia sempre un numero, per le consegne. La cabina telefonica è vicino all\'ingresso.',
            '> E ai Pastelli cosa importa di un tappo?',
            'Niente. Volevano solo che Don Fluo non lo riavesse mai. Senza tappo un evidenziatore si secca, e con il capo secco la sua gang è finita.',
            'Quartieri liberi. Da colorare. Fuori dai bordi.',
            '> Quindi è una guerra.',
            'È un mercato. Qui sotto è la stessa cosa, ma con gli sconti.',
          ],
          do: (g) => g.setStep('c4', 8),
        },
        fine: { say: ['La cabina è vicino all\'ingresso. Il numero te l\'ho dato. Il resto non l\'ho mai detto.'] },
      },
    },
  });
  g.npc('banditore').pos.y = A.banditore.y;

  g.addNpc({
    id: 'pneumatica',
    name: 'Pneumatica',
    pos: at('pneumatica'),
    face: [0, 0],
    look: { hat: 'bun' },
    action: 'phone',
    talkRadius: 3.4,
    barks: () => ['Posta pneumatica: in tre secondi a casa vostra.', 'Il ritorno? Tre settimane.', 'Pronto? No, non è un tubo qualsiasi.'],
    dialogue: {
      name: 'Pneumatica',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Posta pneumatica! Dal Mercato Nero a casa vostra in tre secondi.',
            '> E se voglio restituire qualcosa?',
            'Il tubo funziona solo in salita. Come la carriera.',
          ],
        },
      },
    },
  });
  g.npc('pneumatica').pos.y = A.pneumatica.y;

  // offerenti
  const bidder = (spec: NpcSpec) => g.addNpc({ behavior: { type: 'sit' }, ...spec });
  bidder({
    id: 'collezionista',
    name: 'Collezionista',
    pos: at('collezionista'),
    face: [0, 16],
    look: { mustache: true },
    barks: () => ['Colleziono tutto. Anche le collezioni degli altri.', 'Ho quarantasei calzini spaiati. Tutti sinistri.'],
    dialogue: {
      name: 'Collezionista',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Colleziono tutto. Tappi, idee usate, suoni di applausi.',
            '> E le tieni in casa?',
            'In casa tengo la collezione di case. È complicato.',
          ],
        },
      },
    },
  });
  bidder({
    id: 'pelliccia',
    name: 'Signora Pelliccia',
    pos: at('pelliccia'),
    face: [0, 16],
    look: { hat: 'bun' },
    barks: () => ['La mia pelliccia è finta. È disegnata. Come l\'animale.', 'Offro sempre un sospiro in più. Porta fortuna.'],
    dialogue: {
      name: 'Signora Pelliccia',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Giovanotto, anche lei qui per il tappo?',
            '> Più o meno.',
            'Io lo voglio per metterlo sulla mia pelliccia. Come spilla. La pelliccia è finta, la spilla sarà vera. Si bilanciano.',
          ],
        },
      },
    },
  });
  g.addNpc({
    id: 'salutatore',
    name: 'Salutatore',
    pos: at('salutatore'),
    face: [0, 12],
    action: 'wave',
    barks: () => ['Ciao!', 'Ciao Gianna!', 'Ciao! Ah, non ci conosciamo? Ciao lo stesso!'],
    dialogue: {
      name: 'Salutatore',
      start: 'a',
      nodes: {
        a: {
          say: ['Ciao!', '> Ciao.', 'Ciao ciao!', '> Perché saluti sempre?', 'È l\'unica cosa che so fare con il braccio. Non ho le mani, ma ho la cortesia.', 'A proposito... hai visto Gianna?'],
        },
      },
    },
  });

  // =========================================================================
  // I VENDITORI
  // =========================================================================
  // OMBRE & RIFLESSI
  g.addNpc({
    id: 'riflesso',
    name: 'Riflesso',
    pos: at('riflesso'),
    face: [0, A.riflesso.z],
    look: { hat: 'top' },
    icon: (g) => (g.quest('ombra') === 0 && !g.has('ombra') ? 'side' : null),
    barks: () => ['Ombre usate! Riflessi seminuovi!', 'Eco di seconda mano! Eco di seconda mano! Eco...', 'Ombra tratteggiata a mano, come nuova!'],
    dialogue: {
      name: 'Riflesso',
      start: (g) => (g.quest('ombra') === 0 && !g.has('ombra') ? 'quest' : 'a'),
      nodes: {
        a: {
          say: [
            'Ombre & Riflessi! Ombre usate, riflessi seminuovi, eco di seconda mano!',
            '> Chi compra un\'ombra usata?',
            'Chi l\'ha persa. Chi ne vuole una più lunga. Chi deve fare colpo al tramonto.',
            'Quest\'ombra, per esempio: tratteggiata a mano. Dodici monete.',
          ],
        },
        quest: {
          say: [
            '> Quell\'ombra sul bancone. Era del Signor Controluce?',
            'Di un signore distinto, sì. L\'aveva impegnata al banco dei pegni di Quadropoli. Poi il banco l\'ha venduta a me. Il mercato funziona così.',
            'Dodici monete e te la incarto. In carta da pacchi, come tutto.',
          ],
          choices: [
            { t: 'La compro. (12 monete)', if: (g) => coins(g) >= 12, next: 'compra' },
            { t: 'Non ho dodici monete. Facciamo uno scambio?', next: 'scambio' },
            { t: 'Ci penso.' },
          ],
        },
        compra: {
          say: ['* Il venditore piega l\'ombra in quattro. Non fa nemmeno una grinza.', 'Affare fatto. Non la lasci al sole: si allunga.'],
          do: (g) => {
            g.addCoins(-12);
            g.give('ombra');
            g.world.props.ombraSale.visible = false;
            g.setStep('ombra', 1);
          },
        },
        scambio: {
          say: [
            'Uno scambio? Cos\'hai da offrire?',
            '> La mia ombra.',
            'La TUA ombra? Ma poi resti senza.',
            '> Sono in prima persona. Non me la vedo comunque.',
            '* Il venditore guarda in basso, dove dovresti avere l\'ombra. Poi guarda te. Poi di nuovo in basso.',
            'Ragionamento impeccabile. Un\'ombra per un\'ombra: lo scambio più onesto del mercato.',
            '* Il venditore arrotola la tua ombra come un tappeto. Fa un po\' il solletico.',
          ],
          do: (g) => {
            g.flag('noShadow');
            g.give('ombra');
            g.world.props.ombraSale.visible = false;
            g.setStep('ombra', 1);
          },
        },
      },
    },
  });

  // IL SIGNOR CONTROLUCE (senza ombra)
  const controluce = g.addNpc({
    id: 'controluce',
    name: 'Signor Controluce',
    pos: at('controluce'),
    face: [A.riflesso.x, A.riflesso.z],
    look: { tie: true, hat: 'top' },
    icon: (g) => (g.quest('ombra') === -1 ? 'side' : g.quest('ombra') === 1 ? 'turnin' : null),
    barks: (g) => (g.questDone('ombra') ? ['Ho di nuovo un\'ombra! Guardate! No, non lì. Lì.'] : ['Non mi guardi i piedi.', 'Lo so. Lo so che non ce l\'ho.', 'Mi chiamano "quello appiccicato".']),
    dialogue: {
      name: 'Signor Controluce',
      start: (g) => {
        const q = g.quest('ombra');
        if (q === -1) return 'a';
        if (q === 0) return 'attesa';
        if (q === 1) return 'riporta';
        return 'dopo';
      },
      nodes: {
        a: {
          say: [
            '* Questo signore non ha l\'ombra. Ai suoi piedi, niente. Sembra appoggiato sul pavimento con lo scotch.',
            'Non mi guardi i piedi, per favore. Lo so. Lo so.',
            'Ero a corto di monete e ho impegnato la mia ombra al banco dei pegni. "Tanto chi se ne accorge", pensavo.',
            'Se ne accorgono tutti. Mi chiamano "quello appiccicato".',
            'Ora è su quella bancarella, lì davanti. Ma il venditore vuole dodici monete, e io ne ho zero. Le ho spese per questo cappello.',
            '> Il cappello a cilindro?',
            'No, quello è vero. Ne ho comprato un altro, invisibile. Una truffa anche quello.',
          ],
          choices: [
            { t: 'Ti riporto io la tua ombra.', do: (g) => g.startQuest('ombra') },
            { t: 'Buona fortuna.' },
          ],
        },
        attesa: { say: ['È lì, sul bancone di Ombre & Riflessi. La riconosco da qui: è a forma di me.'] },
        riporta: {
          say: [
            'La mia ombra! La riconosco: è a forma di me!',
            '* L\'ombra scivola sotto i suoi piedi e si riattacca con un piccolo "flop".',
            'Ah! Di nuovo in tre dimensioni! Più o meno!',
          ],
          next: (g) => (g.is('noShadow') ? 'eroe' : 'grazie'),
        },
        eroe: {
          say: [
            'Un momento... Lei non ha più l\'ombra. Ha scambiato la sua per me?',
            '> Tanto in prima persona non me la vedo.',
            'Lei è un eroe. Un eroe piatto, ma un eroe. Tenga, è tutto quello che ho. Me lo sono fatto prestare.',
          ],
          do: (g) => {
            g.take('ombra');
            if (controluce.body instanceof Stickman) controluce.body.shadow.visible = true;
            g.completeQuest('ombra');
            g.addCoins(15);
            g.addXp(40);
          },
        },
        grazie: {
          say: ['Tenga, quindici monete. Me le sono fatte prestare, ma per una buona causa: la mia.'],
          do: (g) => {
            g.take('ombra');
            if (controluce.body instanceof Stickman) controluce.body.shadow.visible = true;
            g.completeQuest('ombra');
            g.addCoins(15);
            g.addXp(30);
          },
        },
        dopo: { say: ['Stasera vado a fare una passeggiata controluce. Così la vedo bene.'] },
      },
    },
  });
  if (controluce.body instanceof Stickman) controluce.body.shadow.visible = false;

  // PAROLE USATE
  g.addNpc({
    id: 'vocabolo',
    name: 'Vocabolo',
    pos: at('vocabolo'),
    face: [0, A.vocabolo.z],
    look: { beard: true, hat: 'beanie' },
    barks: () => ['Parole usate! Come nuove!', '"Comunque"! Un classico! Un po\' consumata!', 'Ho anche dei punti esclamativi, sfusi!'],
    dialogue: {
      name: 'Vocabolo',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Parole usate! Parole di seconda mano, ancora in buono stato!',
            '"Comunque": usatissima, un po\' consumata, ma funziona ancora. Una moneta.',
            '"Ti amo": pochi chilometri, sempre tenuta in garage.',
            '"Scusa": praticamente nuova. Nessuno la usa mai. Tre monete.',
          ],
          choices: [
            { t: 'Prendo "scusa". (3 monete)', if: (g) => !g.has('scusa') && coins(g) >= 3, next: 'scusa' },
            { t: 'Quanto costa "ti amo"?', next: 'tiamo' },
            { t: 'Avete la parola "tappo"?', next: 'tappo' },
            { t: 'Niente, grazie.', next: 'grazie' },
          ],
        },
        scusa: {
          say: ['Ottima scelta. Usala con parsimonia, ma usala: le parole ferme si arrugginiscono.'],
          do: (g) => {
            g.addCoins(-3);
            g.give('scusa');
          },
        },
        tiamo: {
          say: ['Più di quanto hai. Anche più di quanto avrai.', 'E poi va detta a qualcuno di preciso, sennò si rovina. Torna quando hai qualcuno di preciso.'],
        },
        tappo: {
          say: ['Ce l\'avevo. L\'hanno messa all\'asta come lotto sette.', 'Ah no, quello era un tappo vero. Scusa, a forza di vendere parole non distinguo più le cose.'],
        },
        grazie: { say: ['"Grazie": usata poco, ma con affetto. Te la regalo.'] },
      },
    },
  });

  // COLORI VERI (tarocchi)
  const tarocco = g.addNpc({
    id: 'tarocco',
    name: 'Tarocco',
    pos: at('tarocco'),
    face: [0, A.tarocco.z],
    look: { hat: 'beret', mustache: true },
    icon: (g) => (g.quest('colori') === 0 ? 'side' : null),
    shotLines: ['Il blu! Blu vero! Qui è illegale!', 'Ehi! Mi hai colorato senza permesso!'],
    barks: (g) => (g.quest('colori') >= 1 ? ['Colori... quasi veri!', 'Saldi di fine truffa!'] : ['Colori veri! Rosso, verde, giallo!', 'Garantiti in bianco e nero!', 'Rosso Ferrari! Quasi!']),
    dialogue: {
      name: 'Tarocco',
      start: (g) => (g.quest('colori') === 0 ? 'quest' : g.quest('colori') >= 1 ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Colori! Colori veri! Rosso, verde, giallo! Originali, garantiti, in bianco e nero!',
            '> In bianco e nero?',
            'Per la spedizione. Poi a casa si colorano da soli, con la fantasia.',
          ],
        },
        quest: {
          say: ['Colori veri! Vuole un bel rosso? Un verde speranza?'],
          choices: [
            { t: 'Mi dipinga una riga di rosso. Qui, sul braccio.', next: 'riga' },
            { t: 'Questo è blu. Blu vero. Vuole vedere come macchia?', if: (g) => g.has('pistola'), next: 'blu' },
            { t: 'Ne prendo uno anch\'io: il verde. (2 monete)', if: (g) => coins(g) >= 2, next: 'verde' },
            { t: 'Niente, grazie.' },
          ],
        },
        riga: {
          say: [
            '* Tarocco intinge il pennello nel barattolo "ROSSO" e ti fa una riga sul braccio.',
            '* È grigia. Grigio topo. Grigio lunedì mattina.',
            '> È grigia.',
            'È un rosso... timido. Si deve ambientare.',
            '@Signora Grigia| LO SAPEVO!',
            'Va bene, va bene! Rimborso la signora. Ma non lo dica in giro.',
          ],
          do: (g) => g.setStep('colori', 1),
        },
        blu: {
          say: [
            '* Spari una goccia d\'inchiostro sul bancone. Una macchia blu, vera, si allarga tra i barattoli grigi.',
            'Blu vero?! Qui sotto?! Ma è illegalissimo!',
            '> E il suo "blu", invece?',
            '* Tarocco guarda il barattolo con l\'etichetta "BLU". Poi la macchia. Poi di nuovo il barattolo.',
            '...Rimborso la signora. Rimborso tutti. Rimborso anche me stesso.',
          ],
          do: (g) => g.setStep('colori', 1),
        },
        verde: {
          say: ['Ottima scelta. Il verde è il colore della speranza.', '> È grigio.', 'Appunto. Lei speri.'],
          do: (g) => g.addCoins(-2),
        },
        dopo: { say: ['Va bene, sono grigi. Ma sono grigi di qualità. Grigio perla, grigio fumo, grigio... grigio.'] },
      },
    },
  });
  void tarocco;

  // LA SIGNORA GRIGIA (cliente truffata)
  g.addNpc({
    id: 'grigia',
    name: 'Signora Grigia',
    pos: at('grigia'),
    face: [A.tarocco.x, A.tarocco.z],
    look: { hat: 'bun' },
    icon: (g) => (g.quest('colori') === -1 ? 'side' : g.quest('colori') === 1 ? 'turnin' : null),
    barks: (g) => (g.questDone('colori') ? ['Adesso compro solo il bianco. So cosa aspettarmi.'] : ['Truffatore!', 'Grigio! Tutto grigio!', 'Tre monete per un grigio!']),
    dialogue: {
      name: 'Signora Grigia',
      start: (g) => {
        const q = g.quest('colori');
        return q === -1 ? 'a' : q === 0 ? 'attesa' : q === 1 ? 'fine' : 'dopo';
      },
      nodes: {
        a: {
          say: [
            'Giovanotto! Lei ha l\'aria di uno onesto. Un po\' scarabocchiato, ma onesto.',
            'Ho comprato un barattolo di ROSSO da quel signore col basco. Tre monete.',
            'Arrivo a casa, lo apro: grigio. Grigio come tutto il resto!',
            '> Magari è un rosso scuro.',
            'Magari è una truffa! Mi aiuti a smascherarlo? Se ci vado io, mi dice che sono daltonica.',
            '> E lo è?',
            'Siamo tutti daltonici, qui! Non c\'è niente da vedere!',
          ],
          choices: [
            { t: 'Ci penso io.', do: (g) => g.startQuest('colori') },
            { t: 'Adesso non posso.' },
          ],
        },
        attesa: { say: ['È ancora lì che vende grigio a prezzo di rosso. Lo smascheri!'] },
        fine: {
          say: [
            'L\'ha smascherato! Mi ha ridato le tre monete!',
            'Tenga, gliene do dieci. Le altre sette le avevo messe da parte per un colore vero. Tanto non esistono.',
          ],
          do: (g) => {
            g.completeQuest('colori');
            g.addCoins(10);
            g.addXp(25);
          },
        },
        dopo: { say: ['Ora compro solo il bianco. Almeno so cosa aspettarmi.'] },
      },
    },
  });

  // PROFUMERIA BOCCETTA
  g.addNpc({
    id: 'boccetta',
    name: 'Madame Boccetta',
    pos: at('boccetta'),
    face: [0, A.boccetta.z],
    look: { hat: 'bun' },
    barks: () => ['Profumi, tesoro! Profumi!', 'Eau de temperino! Essenza di gomma pane!', '"Quaderno Nuovo": il più venduto!'],
    dialogue: {
      name: 'Madame Boccetta',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Profumi, tesoro! Profumo d\'inchiostro, eau de temperino, essenza di gomma pane!',
            'Il più venduto: "Quaderno Nuovo". Sa di primo giorno di scuola. Quindici monete.',
          ],
          choices: [
            { t: 'Prendo "Quaderno Nuovo". (15 monete)', if: (g) => !g.has('profumo') && coins(g) >= 15, next: 'compra' },
            { t: 'Chi lo compra?', next: 'chi' },
            { t: 'Posso annusare?', next: 'annusa' },
            { t: 'Niente, grazie.' },
          ],
        },
        compra: {
          say: ['Scelta squisita. Due gocce, non di più: dopo tre sembri un cartolaio.'],
          do: (g) => {
            g.addCoins(-15);
            g.give('profumo');
          },
        },
        chi: {
          say: [
            'Lo compra sempre una ragazza. Una matita colorata, rosa. Un rosa vero, non di quelli fluo che si vedono in giro.',
            'Viene per i tappi e si ferma per il profumo. Non dice mai il nome. Firma con una lettera sola.',
          ],
        },
        annusa: { say: ['* Sa di quaderno nuovo. Per un attimo hai sei anni e l\'astuccio pieno.', 'Visto? Funziona su tutti. Anche su chi non ha il naso.'] },
      },
    },
  });

  // BOSSOLO: cartucce e merendine
  g.addNpc({
    id: 'bossolo',
    name: 'Bossolo',
    pos: at('bossolo'),
    face: [0, A.bossolo.z],
    look: { hat: 'cap' },
    barks: () => ['Cartucce! Merendine!', 'Tutto quello che serve per una serata al mercato!', 'Cartucce d\'inchiostro, blu garantito!'],
    dialogue: {
      name: 'Bossolo',
      start: 'a',
      nodes: {
        a: {
          say: ['Cartucce d\'inchiostro e merendine! Tutto quello che serve per una serata al mercato.'],
          next: 'menu',
        },
        menu: {
          say: [],
          choices: [
            { t: 'Cartucce, 8 colpi. (3 monete)', if: (g) => coins(g) >= 3, next: 'cartucce' },
            { t: 'Una merendina, +30 salute. (4 monete)', if: (g) => coins(g) >= 4, next: 'merendina' },
            { t: 'Perché cartucce E merendine?', next: 'perche' },
            { t: 'Niente.' },
          ],
        },
        cartucce: {
          say: ['Otto gocce di blu. Non sprecarle sui piccioni.'],
          do: (g) => {
            g.addCoins(-3, true);
            g.addAmmo(8);
          },
          next: 'menu',
        },
        merendina: {
          say: ['* Mangi la merendina. Sa di merendina disegnata: di niente, ma con entusiasmo.'],
          do: (g) => {
            g.addCoins(-4, true);
            g.heal(30);
          },
          next: 'menu',
        },
        perche: { say: ['Perché dopo una sparatoria viene fame. E prima, per scaramanzia.'], next: 'menu' },
      },
    },
  });

  // OGGETTI SMARRITI: chiuso, il titolare dorme
  g.addNpc({
    id: 'smarriti',
    name: 'Titolare degli Oggetti Smarriti',
    pos: at('smarriti'),
    face: [0, A.smarriti.z],
    behavior: { type: 'sit' },
    look: { hat: 'beanie' },
    barks: () => ['Zzz...', 'Chiuso... per rapina...', 'Zzz... la nostra...'],
  });

  // clienti che girano
  g.addNpc({
    id: 'cliente1',
    name: 'Cliente losco',
    pos: at('cliente1'),
    look: { sunglasses: true, hat: 'cap' },
    behavior: { type: 'patrol', path: [[6, -24], [6, -4], [-6, -4], [-6, -24]], speed: 1.2, wait: 2 },
    barks: () => ['Sto solo guardando. Male.', 'Non mi hai visto.', 'Io qui non ci sono mai stato. Anche adesso.'],
  });
  g.addNpc({
    id: 'cliente2',
    name: 'Signore col cappotto',
    pos: at('cliente2'),
    look: { hat: 'top' },
    behavior: { type: 'patrol', path: [[-6, -12], [-15, -20], [-15, -26], [-6, -30]], speed: 1.0, wait: 3 },
    barks: () => ['Qualcuno ha visto un calzino spaiato?', 'Cerco un regalo per mia moglie. Qualcosa di rubato, ma elegante.', 'Mercato Nero... ma è tutto marrone.'],
  });

  // =========================================================================
  // I PASTELLI A CERA (nascosti fino all'asta)
  // =========================================================================
  const KO = ['Mi sono spezzato... ora siamo in due.', 'Colorato fuori dai bordi...', 'Chiamate la maestra...', 'Sono tutto sbavato.', 'Mi hai spuntato...'];
  const pastello = (id: string, name: string, color: string, extra: Partial<FighterOpts> = {}, scale = 1) => {
    const n = g.addNpc({
      id,
      name,
      pos: [0, -300],
      hidden: true,
      look: { highlighter: color, hat: 'crayon', scale },
      fighter: {
        hp: 60,
        speed: 4.4,
        alertLine: pick(['Ti coloro fuori dai bordi!', 'A CERA!', 'Arrivano i Pastelli!', 'Colori o la vita!']),
        hurtLines: ['Mi hai sbavato!', 'Ahia, la punta!', 'Inchiostro?! Che schifo!', 'Blu?! Io sono ' + name.split(' ')[1]?.toLowerCase() + '!'],
        koLine: pick(KO),
        ranged: { accuracy: 0.5, dmg: 8, aim: 1.0, color, hide: [1.3, 2.6] },
        ...extra,
      },
    });
    if (n.body instanceof Stickman) n.body.prop.add(waxGun(color));
    return n;
  };
  // prima ondata: 75 di cera, mirano bene se stai fermo
  const w1 = (color: string) => ({ hp: 75, ranged: { accuracy: 0.6, dmg: 8, aim: 0.85, color, hide: [0.9, 2.0] as [number, number] } });
  pastello('pRosso', 'Pastello Rosso', CERA.rosso, w1(CERA.rosso));
  pastello('pBlu', 'Pastello Blu', CERA.blu, w1(CERA.blu));
  pastello('pVerde', 'Pastello Verde', CERA.verde, w1(CERA.verde));
  pastello('pArancione', 'Pastello Arancione', CERA.arancione, w1(CERA.arancione));
  const w2 = (color: string) => ({ hp: 85, ranged: { accuracy: 0.58, dmg: 8, aim: 0.8, color, hide: [0.9, 1.9] as [number, number] } });
  pastello('pMarrone', 'Pastello Marrone', CERA.marrone, w2(CERA.marrone));
  pastello('pNero', 'Pastello Nero', '#34302c', w2('#34302c'));
  pastello('pCeleste', 'Pastello Celeste', '#47a7d8', w2('#47a7d8'));
  pastello('pOcra', 'Pastello Ocra', '#c99a2e', w2('#c99a2e'));
  pastello('pRame', 'Pastello Rame', '#b8733e', w2('#b8733e'));
  pastello('pRosso2', 'Pastello Rosso (di scorta)', CERA.rosso, w2(CERA.rosso));
  pastello('pVerde2', 'Pastello Verde (di scorta)', CERA.verde, w2(CERA.verde));

  // gli Appuntiti: niente pistola, un temperino aperto e tanta fretta. Corrono a zig-zag.
  const appuntito = (id: string, name: string, color: string) => {
    const n = g.addNpc({
      id,
      name,
      pos: [0, -300],
      hidden: true,
      look: { highlighter: color, hat: 'crayon', scale: 0.92 },
      fighter: {
        hp: 45,
        speed: 6.4,
        dmg: 15,
        reach: 1.6,
        windup: 0.45,
        cooldown: 0.7,
        parries: [1, 1],
        zigzag: true,
        alertLine: pick(['TI FACCIO LA PUNTA!', 'Temperino in arrivo!', 'Appuntito e arrabbiato!']),
        hurtLines: ['Ahi!', 'Mi hai smussato!', 'Non vale, da lontano!'],
        koLine: pick(['Mi sono spuntato...', 'Troppo appuntito per vivere...', 'Tempera... tempera...']),
      },
    });
    if (n.body instanceof Stickman) n.body.prop.add(knife());
  };
  appuntito('aGiallo', 'Appuntito Giallo', '#e0b400');
  appuntito('aBianco', 'Appuntito Bianco', '#e8e2d0');
  appuntito('aNero', 'Appuntito Nero', '#34302c');
  appuntito('aRosso', 'Appuntito Rosso', CERA.rosso);
  pastello(
    'pastellone',
    'Il Pastellone',
    CERA.viola,
    {
      hp: 360,
      speed: 2.4,
      alertLine: 'CHI HA SPUNTATO I MIEI FRATELLI?!',
      hurtLines: ['Solletico!', 'Sono a cera spessa, io!', 'TOC TOC. Chi è? Nessuno.'],
      koLine: 'Mi... sono... consumato...',
      ranged: { accuracy: 0.55, dmg: 11, aim: 1.1, color: CERA.viola, burst: 3, sharpenEvery: 6, armor: 0.3, hide: [1.2, 2.0] },
    },
    1.4,
  );
}

// L'asta di mezzanotte: si apre quando il banditore dice "si comincia" (dopo lo stacco in ultima fila)
export const auctionDialogue = (): Dialogue => ({
  name: 'Banditore',
  start: 'inizio',
  nodes: {
    inizio: {
      say: [
        '* Il banditore batte il martelletto sul leggio. TOC.',
        'Signore, signori, e chiunque altro! Asta di mezzanotte!',
      ],
      next: 'lotto5',
    },
    lotto5: {
      do: (g) => (g.world.props.idea.visible = true),
      look: (g) => g.world.anchors.lotto,
      say: [
        'Lotto cinque: un\'idea. Usata una volta sola, da un filosofo di San Scarabocchio. Non ha portato a niente.',
        '* Sul piedistallo c\'è una lampadina disegnata. Spenta.',
        '@Collezionista| Due monete.',
        'Aggiudicata! TOC!',
      ],
      next: 'lotto6',
    },
    lotto6: {
      do: (g) => {
        g.world.props.idea.visible = false;
        g.after(1.5, () => g.audio.applause());
      },
      look: (g) => g.world.anchors.lotto,
      say: [
        'Lotto sei: il suono di un applauso. Solo il suono: le mani non sono incluse. Come sempre.',
        '* Da qualche parte parte un applauso. Il piedistallo è vuoto.',
        '@Signora Pelliccia| Tre monete.',
        '@Salutatore| Ciao Gianna!',
        'Quattro monete dal signore che saluta! Aggiudicato!',
        '@Salutatore| No, stavo salutando...',
        'Aggiudicato è aggiudicato. TOC!',
      ],
      next: 'lotto7',
    },
    lotto7: {
      do: () => presentLot(),
      look: (g) => g.world.props.lotto.position,
      say: [
        'E ora... il pezzo forte della serata! Il lotto sette!',
        '* L\'assistente va al piedistallo e solleva il tappo giallo fluo. Sbiadito, ma inconfondibile.',
        '@Marco| È lui! Il tappo! Ciao tappo!',
        'Base d\'asta: dieci monete!',
      ],
      choices: [
        { t: 'Dieci monete!', if: (g) => coins(g) >= 10, next: 'offro' },
        { t: (g) => `Tutte le mie monete! (${coins(g)})`, if: (g) => coins(g) > 0 && coins(g) < 10, next: 'poche' },
        { t: 'Alzo la mano! (Non ho la mano.)', next: 'mano' },
      ],
    },
    offro: {
      say: ['Dieci monete dal signore scarabocchiato!', '@Marco| Vai Stecco! Sei ricchissimo!', '> Ho dieci monete.', '@Marco| Appunto.'],
      next: 'rilancio',
    },
    poche: {
      say: [
        (g) => `${coins(g)} monete. Apprezziamo l'entusiasmo, ma la base è dieci.`,
        '@Marco| Offro anch\'io! Offro... il mio entusiasmo!',
        'L\'entusiasmo non è una valuta, signore.',
        '@Marco| Da noi sì.',
      ],
      next: 'rilancio',
    },
    mano: {
      say: [
        '* Alzi il braccio. Dove dovrebbe esserci una mano c\'è la fine del braccio.',
        'Il signore in ultima fila alza... il braccio! Vale come offerta! Dieci monete!',
        '> Non ho dieci monete.',
        'Adesso sì che è un\'asta.',
      ],
      next: 'rilancio',
    },
    rilancio: {
      say: [
        '@Collezionista| Venti.',
        '@Signora Pelliccia| Trenta. E un sospiro.',
        '@Salutatore| Ciao Gianna!',
        'Quaranta dal signore che saluta!',
        '@Salutatore| No, stavo salutando Gianna...',
        'Non c\'è nessuna Gianna. Quaranta!',
        '@Pneumatica| Offerta telefonica!',
        'Sentiamo!',
        '@Pneumatica| La signorina al telefono offre: "tutto quello che hanno offerto gli altri, più uno".',
        'Più uno cosa?',
        '@Pneumatica| Dice: "Più uno e basta. Voi capite."',
        'Nessuno capisce, ma è moltissimo!',
        'AGGIUDICATO alla signorina al telefono! TOC!',
        '> NO! Aspetti!',
      ],
      next: 'tubo',
    },
    tubo: {
      do: () => sendLot(),
      look: (g) => g.world.anchors.tubeLook,
      say: [
        '* L\'assistente porta il tappo alla cassetta della posta pneumatica e lo infila nello sportello.',
        '* FIUUUUU. Il tappo sale nel tubo di vetro e sparisce nel soffitto. Per sempre, o almeno fino all\'indirizzo del destinatario.',
        'Posta pneumatica! Qui si consegna subito, prima che il cliente cambi idea. O che qualcuno spari.',
        '> A chi è andato?!',
        'Riservatezza del cliente. Il Mercato Nero è una cosa seria.',
      ],
      next: 'crash',
    },
    crash: {
      do: (g) => {
        raidCrash(g);
        // ti alzi di scatto
        g.player.seated = false;
      },
      look: (g) => new THREE.Vector3(-27, 1.4, 1),
      say: [
        '* CRASH. La barriera del tunnel ovest vola via. Ti alzi di scatto.',
        '* Dal buio escono omini colorati. Colorati davvero. Con la punta.',
        '@Pastello Rosso| QUESTA È UNA RAPINA! CIOÈ UNO SCARABOCCHIO! CIOÈ... MANI IN ALTO!',
        '@Marco| Qui nessuno ha le mani!',
        '@Pastello Rosso| Allora... TUTTO in alto! E dateci il tappo giallo di Don Fluo!',
        'Il tappo è appena partito, signori. Posta pneumatica. Tre secondi.',
        '@Pastello Rosso| ...',
        '@Pastello Rosso| ...allora COLORIAMO TUTTO! PASTELLI, FUORI DAI BORDI!',
      ],
      next: 'via',
    },
    via: {
      say: ['@Marco| Stecco! Io copro le retrovie! Cioè, mi nascondo!'],
      do: (g) => g.flag('raidStart'),
    },
  },
});
