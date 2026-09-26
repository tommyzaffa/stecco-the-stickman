import type { Game } from '../../game/game';
import type { Choice } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { HL } from '../../render/palette';
import { BRIBE, ENTRY_FEE } from './quests';
import { openDoor, ZONES } from './world';
import { startDanceOff } from './dance';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// Il popolo della notte: chi sta in fila, chi balla, chi custodisce il niente.
// Formato righe: 'testo' = parla il PNG, '> testo' = parli tu, '* testo' = narratore,
// '@Nome| testo' = parla qualcun altro.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function createCharacters(g: Game) {
  const A = g.world.anchors;

  // =========================================================================
  // MARCO: fuori, poi al bar, poi nel vicolo
  // =========================================================================
  const marcoBarMenu: Choice[] = [
    { t: 'Ripetimi le strade per arrivare all\'ufficio.', next: 'strade' },
    { t: 'Tu cosa fai intanto?', next: 'intanto' },
    { t: 'Vado.' },
  ];
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: [A.marcoOut.x, A.marcoOut.z],
    face: [0, -37],
    look: { hat: 'cap' },
    icon: (g) => {
      const q = g.quest('c2');
      return q === 0 || q === 2 ? 'main' : q === 7 ? 'main-turnin' : null;
    },
    barks: (g) => {
      const q = g.quest('c2');
      if (q <= 0) return ['Stecco! Qui! Fai finta di niente!', 'Psst! Sono io! Marco! Quello col cappellino!'];
      if (q === 3) return ['Io sorveglio. Tu... fai la parte difficile.', 'Ricordati: la teca è nell\'ufficio in fondo.'];
      return ['Stasera si fa la storia.', 'Tutto sotto controllo. Credo.'];
    },
    dialogue: {
      name: 'Marco',
      start: (g) => {
        const q = g.quest('c2');
        if (q <= 0) return 'fuori';
        if (q === 1) return 'fuori2';
        if (q === 2) return 'bar';
        if (q >= 7) return 'vicolo';
        return 'barMenu';
      },
      nodes: {
        fuori: {
          say: [
            'Stecco! Sei venuto! E hai le monete?',
            (g) => (g.state.coins >= ENTRY_FEE ? '> Cinquanta. Contate due volte.' : `> Ne ho ${g.state.coins}. Più o meno cinquanta.`),
            'Perfetto. Allora, il piano.',
            'Tieni. Questo è il tappo di Don Fluo.',
            '* Marco ti dà un tappo. È piccolo, blu, e ha un buchino in cima.',
            '> Non dovrebbe essere giallo? Lui è un evidenziatore giallo.',
            'Ehm. Col buio i colori cambiano. È scienza.',
            'Tu entri, arrivi all\'ufficio di Don Fluo, rimetti il tappo nella teca, esci. Nessuno si accorge di niente.',
            '> E tu?',
            'Io entro dal retro. Conosco il lavapiatti. Ci vediamo al bar.',
          ],
          next: 'dai',
        },
        dai: {
          do: (g) => {
            g.give('tappo');
            g.setStep('c2', 1);
            // Marco sparisce per ricomparire al bar
            g.after(0.4, () => {
              const m = g.npc('marco');
              m.pos.set(A.marco.x, 0, A.marco.z);
              m.body.root.rotation.y = Math.PI / 2;
              m.homeRot = Math.PI / 2;
            });
          },
          say: ['Vai! Io intanto faccio... la parte del piano che non ti ho detto.'],
        },
        fuori2: { say: ['Sei ancora qui? Bruno è lì. Cinquanta monete. Vai.'] },
        bar: {
          say: [
            'Ce l\'hai fatta! Hai visto? Nessuno ci ha notati.',
            '> Tutti ci hanno notati. Hai urlato "PSST" dal marciapiede.',
            'Dettagli. Allora: l\'ufficio di Don Fluo è in fondo alla zona VIP.',
            'Il problema è Rosa, la guardia al cordone. Non fa passare nessuno.',
          ],
          next: 'strade',
        },
        strade: {
          say: [
            'Hai quattro strade.',
            'Uno: il DJ. Quando suona "Sbiadisco", Rosa non resiste e va a ballare. Ma il DJ ha qualche problema, vai a sentire.',
            () => `Due: Ornella, al guardaroba, ha le chiavi della porta di servizio nei bagni. Da lì un corridoio porta dritto all'ufficio. C'è una guardia, però: stai basso, premi ${keyName('crouch')}.`,
            `Tre: Rosa accetta "mance". Tipo ${BRIBE} monete.`,
            'Quattro: le dai un pugno.',
            '> E la quattro?',
            'La quattro è la mia preferita, ma non te la consiglio. Sono in tanti. E sono colorati.',
          ],
          do: (g) => {
            if (g.quest('c2') === 2) {
              g.setStep('c2', 3);
              g.setCheckpoint(A.marco.clone().setX(A.marco.x + 1.2), A.marco.clone().setY(1.5), 'Marco ti ha trascinato al bar e ti ha fatto bere un bicchiere d\'acqua disegnata');
            }
          },
          choices: marcoBarMenu,
        },
        barMenu: { say: ['Tutto bene? Il tappo ce l\'hai ancora, sì?'], choices: marcoBarMenu },
        intanto: {
          say: ['Io resto qui al bar.', 'Se qualcosa va storto, faccio finta di non conoscerti.', '> Rassicurante.', 'È un piano. Non ho detto che è un bel piano.'],
          choices: marcoBarMenu,
        },
        vicolo: {
          say: [
            'Stecco! Sei vivo! Più o meno!',
            '> Marco. Il tappo era di una BIRO.',
            '...Ah.',
            '> "Ah"?!',
            'Potrei averli confusi. Avevo due tappi in tasca.',
            '> Non abbiamo tasche.',
            'Appunto! Erano per terra, uno vicino all\'altro. Un errore comprensibile.',
            '> E il tappo vero dov\'è?',
            '...',
            'L\'ho venduto.',
            '> MARCO.',
            'Mi servivano cinquanta monete per entrare stasera! Tu le hai guadagnate aiutando la gente. Io vendendo il tappo di un boss. Ognuno ha i suoi metodi.',
          ],
          next: 'fluo',
        },
        fluo: {
          do: (g) => g.flag('fluoInAlley'),
          next: 'fine',
          say: [
            '@Don Fluo| Eccovi.',
            '* Don Fluo è sulla porta. Alla luce del lampione è ancora più pallido.',
            '@Don Fluo| Il mio tappo. Dov\'è.',
            'Al banco dei pegni! A Quadropoli! Lo recuperiamo, promesso!',
            '@Don Fluo| Avete tre giorni.',
            '@Don Fluo| Poi vi evidenzio. Tutti e due. Fino all\'ultima linea.',
            '@Don Fluo| E Marco... quel cappellino. È mio?',
            'No. Cioè sì. Cioè... tre giorni, ha detto?',
          ],
        },
        fine: {
          do: (g) => g.flag('c2Finale'),
          say: ['* Don Fluo rientra. La porta si chiude. La musica, da dentro, continua a fare tunz tunz.', '> Quadropoli, quindi.', 'Quadropoli. Ti piaceranno i quadretti.'],
        },
      },
    },
  });

  // =========================================================================
  // BRUNO + LA FILA
  // =========================================================================
  g.addNpc({
    id: 'bruno',
    name: 'Bruno',
    pos: [A.bruno.x, A.bruno.z],
    face: [A.bruno.x, -40],
    look: { sunglasses: true, scale: 1.3 },
    action: 'crossed',
    faceWhenNear: false,
    icon: (g) => (g.quest('c2') === 1 ? 'main' : null),
    barks: () => ['...', 'Cinquanta monete.', 'La fila è da quella parte. Non che serva a qualcosa.'],
    onPunch: (g, n) => {
      n.say('Anche stasera? Ammirevole.', 3);
      g.after(0.25, () => {
        g.hurt(25);
        g.player.knock.copy(g.player.pos.clone().sub(n.pos).setY(0).normalize().multiplyScalar(14));
        g.toast('Bruno ti ha restituito il pugno. Con gli interessi. Di nuovo.', 'bad');
      });
    },
    dialogue: {
      name: 'Bruno',
      start: (g) => (g.quest('c2') === 1 ? 'porta' : g.quest('c2') === 0 ? 'prima' : 'dopo'),
      nodes: {
        prima: { say: ['Tu sei l\'amico di Marco.', '> Come lo sai?', 'Ha urlato "PSST" per dieci minuti indicandoti.'] },
        porta: {
          say: ['Parallelepipedo. Aperto.', `${ENTRY_FEE} monete.`],
          choices: [
            { t: `Ecco le ${ENTRY_FEE} monete.`, next: 'paga', if: (g) => g.state.coins >= ENTRY_FEE },
            { t: 'Non ne ho abbastanza...', next: 'pochi', if: (g) => g.state.coins < ENTRY_FEE },
            { t: 'Com\'è dentro, stasera?', next: 'dentro' },
            { t: 'Torno dopo.' },
          ],
        },
        dentro: { say: ['Rettangolare.', '> Come l\'altra volta.', 'Il locale non cambia forma per te.'], next: 'porta' },
        pochi: {
          say: [(g) => `Ti mancano ${ENTRY_FEE - g.state.coins} monete.`, '> ...', 'Io aspetto. Aspetto bene. È il mio lavoro.'],
          do: (g) => {
            if (g.is('marcoLoan')) return;
            g.flag('marcoLoan');
            g.after(4, () => {
              g.phone('Marco', 'ti ho visto. ti mando io la differenza. me la ridai quando sei ricco. o mai.');
              g.after(1.2, () => g.addCoins(ENTRY_FEE - g.state.coins));
            });
          },
        },
        paga: {
          do: (g) => {
            g.addCoins(-ENTRY_FEE);
            openDoor(g.world, 'frontDoor');
            g.audio.door();
            g.setStep('c2', 2);
            const q = g.npc('fila1');
            q.say('EHI! C\'è la fila!', 3);
            g.after(1.6, () => g.npc('bruno').say('Lui è con Marco.', 2.5));
            g.after(3.6, () => g.npc('fila2').say('E chi è Marco?', 2.5));
            g.after(5.6, () => g.npc('bruno').say('Nessuno lo sa.', 2.5));
          },
          say: ['* Bruno conta le monete. Due volte. Poi apre la porta.', 'Divertiti. Ma non troppo.'],
        },
        dopo: { say: ['Sei già dentro. Cioè, fuori. Cioè... hai capito.'] },
      },
    },
  });

  const queueLines = [
    'Sono in fila da così tanto che la fila mi ha dato un soprannome.',
    'Dicono che dentro sia rettangolare.',
    'Io non entro. Mi piace la fila. È una comunità.',
    'Ho portato il pranzo. E la cena.',
    'La fila è l\'unico posto dove tutti vanno nella stessa direzione.',
  ];
  (
    [
      ['fila1', 'Tizio in fila', 3.4, 'beanie'],
      ['fila2', 'Tizia in fila', 4.8, 'bun'],
      ['fila3', 'Altro tizio in fila', 6.2, 'hair'],
    ] as const
  ).forEach(([id, name, x, hat]) =>
    g.addNpc({
      id,
      name,
      pos: [x, -27.3],
      face: [-10, -27.3],
      look: { hat },
      barks: () => queueLines,
      dialogue: {
        name,
        start: 'a',
        nodes: {
          a: {
            say: [
              () => pick(queueLines),
              () => pick(['> Da quanto aspetti?', '> Perché non entri?', '> Ma la fila va avanti?']),
              () =>
                pick([
                  'La fila non va avanti. È questo il bello: nessuna delusione.',
                  'Bruno dice che è un club esclusivo. Esclude soprattutto noi.',
                  'Ho quasi finito di contare i mattoni. Ne mancano tre.',
                ]),
            ],
          },
        },
      },
    }),
  );

  // =========================================================================
  // ORNELLA: guardaroba. Missione "Qualcosa da custodire"
  // =========================================================================
  const ornellaGive: Choice[] = [
    { t: 'Ecco un libro. Tutte pagine bianche.', next: 'libro', if: (g) => g.has('libro') },
    { t: 'Ecco un calzino. Spaiato.', next: 'calzino', if: (g) => g.has('calzino') },
    { t: 'Non ho niente, per ora.' },
  ];
  g.addNpc({
    id: 'ornella',
    name: 'Ornella',
    pos: [A.ornella.x, A.ornella.z],
    face: [0, -22],
    look: { hat: 'bun' },
    icon: (g) => (g.quest('guardaroba') === -1 ? 'side' : g.questActive('guardaroba') && (g.has('libro') || g.has('calzino')) ? 'turnin' : null),
    barks: () => ['Guardaroba! Qualcuno? Niente?', 'Neanche un cappotto. Mai.', 'Custodisco il vuoto. Il vuoto non dà mance.'],
    dialogue: {
      name: 'Ornella',
      start: (g) => (g.quest('guardaroba') === -1 ? 'intro' : g.questDone('guardaroba') ? 'dopo' : 'attesa'),
      nodes: {
        intro: {
          say: [
            'Benvenuto! Cosa lascia al guardaroba? Cappotto? Borsa? Ombrello?',
            '> Non ho niente.',
            'Nessuno ha niente. Nessuno ha MAI niente.',
            'Da quando ho aperto custodisco il vuoto. Il vuoto è puntuale, ma non ringrazia.',
            'Portami qualcosa da custodire. Qualsiasi cosa. Anche piccola. Anche brutta.',
          ],
          choices: [
            { t: 'Vedrò cosa trovo.', next: 'ok' },
            { t: 'Hai le chiavi della porta di servizio?', next: 'chiavi', if: (g) => g.quest('c2') >= 3 },
            { t: 'Buona fortuna.' },
          ],
        },
        ok: { do: (g) => g.startQuest('guardaroba'), say: ['Grazie! Ti preparo già lo scontrino. Numero uno!'], choices: ornellaGive },
        chiavi: {
          say: ['Forse. Forse le ho. Forse le do a chi mi porta qualcosa da custodire.', 'Il guardaroba è un\'economia di scambio.'],
          next: 'ok',
        },
        attesa: { say: ['Allora? Hai qualcosa da custodire?'], choices: ornellaGive },
        libro: {
          do: (g) => g.take('libro'),
          say: ['Un libro! Con le pagine bianche! Lo custodirò come se fosse pieno.'],
          next: 'premio',
        },
        calzino: {
          do: (g) => g.take('calzino'),
          say: ['Un calzino! Ma... nessuno di noi ha i piedi.', '...Non importa. È bellissimo. Lo appendo subito.'],
          next: 'premio',
        },
        premio: {
          do: (g) => {
            g.give('chiave');
            g.addXp(30);
            g.completeQuest('guardaroba');
          },
          say: [
            'Ecco il tuo scontrino: numero uno. Il primo della storia.',
            'E questa... è la chiave della porta di servizio, nei bagni. Non dovrei dartela.',
            'Ma nemmeno tu dovresti avere un calzino. Siamo pari.',
          ],
        },
        dopo: { say: ['Il tuo oggetto è al sicuro. Lo guardo ogni tanto. Mi fa compagnia.'] },
      },
    },
  });

  // =========================================================================
  // NANDO: il barista
  // =========================================================================
  const nandoMenu: Choice[] = [
    { t: 'Acqua frizzante disegnata (4 monete, +20 salute)', next: 'acqua' },
    { t: "Succo d'inchiostro (8 monete, +45 salute)", next: 'succo' },
    { t: 'Cos\'è "Il Tratteggio"?', next: 'tratteggio' },
    { t: 'Niente, grazie.' },
  ];
  g.addNpc({
    id: 'nando',
    name: 'Nando',
    pos: [A.nando.x, A.nando.z],
    face: [0, -6],
    look: { mustache: true, hat: 'hair' },
    action: 'drink',
    barks: () => ['Chi vuole bere? Tutto disegnato, niente postumi.', 'Il ghiaccio è finito. Era disegnato male.', 'Offre la casa! No. Mai.'],
    dialogue: {
      name: 'Nando',
      start: 'start',
      nodes: {
        start: { say: ['Benvenuto al bar del Parallelepipedo. Cosa ti servo?'], choices: nandoMenu },
        menu: { say: ['Altro?'], choices: nandoMenu },
        acqua: { say: [], next: (g) => (g.state.coins >= 4 ? 'acquaOk' : 'poveri') },
        acquaOk: {
          do: (g) => {
            g.addCoins(-4);
            g.heal(20);
          },
          say: ['Ecco. Le bollicine sono disegnate a mano, una per una.', '* Le bollicine ti fanno il solletico. Anche dove non hai niente.'],
        },
        succo: { say: [], next: (g) => (g.state.coins >= 8 ? 'succoOk' : 'poveri') },
        succoOk: {
          do: (g) => {
            g.addCoins(-8);
            g.heal(45);
          },
          say: ["Succo d'inchiostro. Nero, denso, ti riempie le linee.", '* Ti senti più marcato. Più deciso. Più a fuoco.'],
        },
        poveri: { say: ['Niente monete, niente bicchiere. Il bancone non è un ente di beneficenza.'] },
        tratteggio: {
          say: ['È il cocktail della casa.', 'Un bicchiere vuoto con delle righe sopra.', '> E costa?', 'Venti monete. Il vuoto qui è esclusivo.'],
          next: 'menu',
        },
      },
    },
  });

  // =========================================================================
  // DJ COMPASSO. Missione "Un disco per il DJ"
  // =========================================================================
  const djGive: Choice[] = [
    { t: 'Ecco un sottobicchiere. È rotondo.', next: 'consegna', if: (g) => g.has('sottobicchiere') },
    { t: 'Potrei darti la mia testa. È rotonda.', next: 'testa' },
    { t: 'Continuo a cercare.' },
  ];
  const dj = g.addNpc({
    id: 'dj',
    name: 'DJ Compasso',
    pos: [A.dj.x, A.dj.z],
    face: [0, -10],
    look: { hat: 'cap', sunglasses: true },
    action: 'dj',
    faceWhenNear: false,
    icon: (g) => (g.quest('dj') === -1 ? 'side' : g.questActive('dj') && g.has('sottobicchiere') ? 'turnin' : null),
    barks: (g) =>
      g.questDone('dj')
        ? ['SBIADISCOOO!', 'Questa è per te, Rosa!', 'Mani in alto! Cioè, linee in alto!']
        : ['Il mio disco... qualcuno ha visto il mio disco?', 'Suono sempre la stessa. Non ho scelta.', 'Tunz. Tunz. Tunz. Aiuto.'],
    dialogue: {
      name: 'DJ Compasso',
      start: (g) => (g.quest('dj') === -1 ? 'intro' : g.questDone('dj') ? 'dopo' : 'attesa'),
      nodes: {
        intro: {
          say: [
            'Ehi! Tu! Hai orecchie? No? Nessuno ha orecchie. Ascolta lo stesso.',
            'Mi hanno rubato il disco! Quello di "Sbiadisco", il pezzo preferito di Don Fluo.',
            'E di Rosa, la guardia del VIP. Quando parte quel pezzo lei molla tutto e va a ballare.',
            '> Com\'è fatto il disco?',
            'Rotondo. Piatto. Col buco in mezzo.',
            '> Così sono tutti i dischi.',
            'Appunto! Portami qualcosa di rotondo e piatto. Al resto ci penso io: sono un professionista.',
          ],
          next: 'accetta',
        },
        accetta: { do: (g) => g.startQuest('dj'), say: [], choices: djGive },
        attesa: { say: ['Allora? Qualcosa di rotondo? Anche un po\' ovale va bene.'], choices: djGive },
        testa: {
          say: ['Mmh. Troppo bianca. E poi credo che ti serva.', '> Credo anche io.'],
          choices: djGive,
        },
        consegna: {
          do: (g) => g.take('sottobicchiere'),
          say: ['Un sottobicchiere. Perfetto. Nessuno noterà la differenza.', '* Il DJ appoggia il sottobicchiere sul giradischi. Gira. Per qualche motivo, funziona.'],
          next: 'premio',
        },
        premio: {
          do: (g) => {
            g.addCoins(15);
            g.addXp(30);
            g.completeQuest('dj');
            g.flag('sbiadisco');
          },
          say: ['Tieni, quindici monete. E adesso...', 'QUESTA È PER TE, ROSA! SBIADISCOOO!'],
        },
        dopo: { say: ['Grazie, amico! Il sottobicchiere suona meglio del disco vero. Non dirlo a nessuno.'] },
      },
    },
  });
  dj.pos.y = 0.6;

  // =========================================================================
  // REY DELLA PISTA. Missione "La sfida di Rey"
  // =========================================================================
  g.addNpc({
    id: 'rey',
    name: 'Rey della Pista',
    pos: [0, -6],
    face: [0, -14],
    look: { hat: 'party' },
    action: 'dance',
    faceWhenNear: false,
    icon: (g) => (!g.questDone('ballo') ? 'side' : null),
    barks: (g) => (g.questDone('ballo') ? ['Rey è ancora sconvolto.', 'Rey si ritira. Da domani.'] : ['Nessuno batte Rey!', 'Rey non ha mai perso. Rey non ha mai sudato.', 'Chi osa sfidare Rey?']),
    dialogue: {
      name: 'Rey',
      start: (g) => (g.questDone('ballo') ? 'dopo' : g.quest('ballo') === -1 ? 'intro' : 'ancora'),
      nodes: {
        intro: {
          say: [
            'Rey ti ha visto guardare la pista.',
            'Rey ballava prima che inventassero il ritmo. Nessuno batte Rey.',
            '> Perché parli di te in terza persona?',
            'Perché Rey è troppo grande per una persona sola.',
            'Sfida Rey. Rey ti mostrerà dei passi: tu li rifai a tempo di musica. Se sbagli, Rey ride.',
          ],
          choices: [
            { t: 'Accetto la sfida.', next: 'via' },
            { t: 'Come funziona, esattamente?', next: 'regole' },
            { t: 'Un\'altra volta.' },
          ],
        },
        regole: {
          say: [
            () => `* Comparirà un tasto (${['forward', 'left', 'back', 'right'].map((a) => keyName(a as 'forward')).join(', ')}). Premilo quando il cerchio rosso si chiude sul tasto, a tempo col battito.`,
            '* Dieci passi. Ne servono almeno sette giusti.',
          ],
          choices: [
            { t: 'Accetto la sfida.', next: 'via' },
            { t: 'Un\'altra volta.' },
          ],
        },
        ancora: {
          say: ['Rey è pronto per la rivincita. Rey è sempre pronto.'],
          choices: [
            { t: 'Rivincita!', next: 'via' },
            { t: 'Non ora.' },
          ],
        },
        via: {
          do: (g) => {
            if (g.quest('ballo') === -1) g.startQuest('ballo');
            g.after(0.3, () =>
              startDanceOff(g, g.npc('rey'), (won) => {
                const rey = g.npc('rey');
                if (won) {
                  rey.say('Rey... Rey è senza parole.', 4);
                  g.addCoins(20);
                  g.addXp(40);
                  g.completeQuest('ballo');
                } else {
                  rey.say('AHAHAH! Rey vince sempre! Riprova quando avrai le articolazioni.', 4);
                }
              }),
            );
          },
          say: ['La pista è tua. Il ritmo... vedremo.'],
        },
        dopo: { say: ['Rey si inchina. Rey non si era mai inchinato.', 'Rey ha mal di schiena, adesso.'] },
      },
    },
  });

  // ballerini: si può parlare con tutti
  const danceBarks = [
    'Che musica rettangolare!',
    'Balliamo in quattro quarti!',
    'Non ho i piedi ma ho il ritmo!',
    'Sto sudando inchiostro!',
    'Mi si è piegata una linea!',
    'Il DJ è un genio. O un compasso.',
  ];
  const danceLines = [
    'Non posso parlare, sto ballando in quattro quarti.',
    'Ehi! Bel tratto! Chi è il tuo disegnatore?',
    'La musica è così forte che mi vibra il cerchio.',
    'Sai che Don Fluo è sempre più pallido? Dicono che gli manchi qualcosa.',
    'Ho pagato cinquanta monete per stare qui. Ora ballo finché non valgono la pena.',
    'Rey dice che nessuno lo batte. Rey parla di sé in terza persona. È inquietante.',
    'Quella guardia rosa al cordone mi fa paura. Anche il suo colore mi fa paura.',
  ];
  const dancers: [number, number, string][] = [
    [-5, -10, 'hair'], [-3, -8, 'beanie'], [4, -9, 'bun'], [5.5, -4, 'cap'], [-4.5, -3, 'none'],
    [2, -2, 'hair'], [-1.5, -11, 'bun'], [3.5, -11.5, 'party'],
  ];
  dancers.forEach(([x, z, hat], i) =>
    g.addNpc({
      id: `ballo${i}`,
      name: i % 2 ? 'Tizia che balla' : 'Tizio che balla',
      pos: [x, z],
      face: [0, 4],
      look: { hat: hat as never },
      action: 'dance',
      faceWhenNear: false,
      barks: () => danceBarks,
      dialogue: { name: i % 2 ? 'Tizia che balla' : 'Tizio che balla', start: 'a', nodes: { a: { say: [() => pick(danceLines)] } } },
    }),
  );

  // clienti ai divanetti
  g.addNpc({
    id: 'cliente1',
    name: 'Cliente elegante',
    pos: [16.95, -14],
    face: [0, -14],
    look: { hat: 'top', tie: true },
    behavior: { type: 'sit' },
    action: 'drink',
    barks: () => ['Questo locale è sopravvalutato. Vengo tutte le sere.', 'Una volta qui era tutto a tempera.'],
    dialogue: {
      name: 'Cliente elegante',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Mi scusi, sta bloccando la vista.',
            '> La vista di cosa?',
            'Del muro. È un muro molto rettangolare. Pago per guardarlo.',
          ],
        },
      },
    },
  });
  g.addNpc({
    id: 'cliente2',
    name: 'Signora al tavolo',
    pos: [16.95, -4],
    face: [0, -4],
    look: { hat: 'bun' },
    behavior: { type: 'sit' },
    barks: () => ['Qualcuno ha visto il mio sottobicchiere? No? Meglio.', 'Il Tratteggio è divino. Non sa di niente.'],
    dialogue: {
      name: 'Signora al tavolo',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Giovanotto, lei balla?',
            '> Non molto.',
            'Peccato. Rey ha bisogno di qualcuno che lo batta. Per il bene di tutti.',
          ],
        },
      },
    },
  });

  // =========================================================================
  // LINEA: l'omino più sottile del mondo (bagni)
  // =========================================================================
  g.addNpc({
    id: 'linea',
    name: 'Linea',
    pos: [-16.1, 13],
    face: [-10, 13],
    look: { eyes: true, scale: 0.9 },
    action: 'think',
    icon: (g) => (g.quest('linea') === -1 ? 'side' : null),
    barks: (g) => (g.questDone('linea') ? ['Sono sottile. E va bene così.', 'Una linea è l\'inizio di tutto!'] : ['*sniff*', 'Nessuno mi nota...', 'Sono solo una linea...']),
    dialogue: {
      name: 'Linea',
      start: (g) => (g.questDone('linea') ? 'dopo' : 'intro'),
      nodes: {
        intro: {
          do: (g) => {
            if (g.quest('linea') === -1) g.startQuest('linea');
          },
          say: [
            '*sniff* Oh. Mi hai visto? Nessuno mi vede mai.',
            'Sono così sottile... Gli altri almeno sono omini. Io sono una linea. Una linea sola.',
            'Stasera ho provato a ballare. Il buttafuori mi ha scambiato per una crepa nel pavimento.',
          ],
          choices: [
            { t: 'Essere sottili è elegante.', next: 'r1' },
            { t: 'Una linea è l\'inizio di ogni disegno.', next: 'r2' },
            { t: 'In effetti non ti avevo notato.', next: 'r3' },
          ],
        },
        r1: { say: ['Elegante... dici? Come una cravatta?', '> Come una cravatta.', 'Ho sempre voluto essere una cravatta.'], next: 'fine' },
        r2: {
          say: ['L\'inizio... di ogni disegno.', 'Quindi senza di me... non ci sareste neanche voi.', '> Più o meno.', 'Io sono... IMPORTANTE.'],
          next: 'fine',
        },
        r3: { say: ['...', 'Almeno sei sincero. È già qualcosa. Mi sento meno invisibile. Un po\'.'], next: 'fine' },
        fine: {
          do: (g) => {
            g.addXp(25);
            g.addCoins(5);
            g.completeQuest('linea');
          },
          say: [
            'Grazie. Tieni, cinque monete: le avevo trovate per terra. Nessuno mi vede mai raccoglierle.',
            'E un consiglio: la guardia del corridoio, Verde, in fondo si ferma a contare le casse.',
            'Conta fino a tre. Male. Ci mette un sacco.',
          ],
        },
        dopo: { say: ['Mi sto guardando allo specchio. Mi vedo! Più o meno.'] },
      },
    },
  });

  // =========================================================================
  // GLI EVIDENZIATORI
  // =========================================================================
  const rosaMenu: Choice[] = [
    { t: 'Sono con Marco.', next: 'marco' },
    { t: 'Sono un VIP.', next: 'vip' },
    { t: 'C\'è una rissa al bar!', next: 'rissa' },
    { t: `Ti do ${BRIBE} monete se mi fai passare.`, next: 'mancia', if: (g) => g.state.coins >= BRIBE },
    { t: 'Niente.' },
  ];
  g.addNpc({
    id: 'rosa',
    name: 'Evidenziatore Rosa',
    pos: [A.rosa.x, A.rosa.z],
    face: [8, -10],
    look: { highlighter: HL.pink, hat: 'hair' },
    action: 'crossed',
    fighter: { hp: 90, dmg: 12, parries: [1, 3], alertLine: 'Hai fatto un errore. Rosa.', hurtLines: ['Mi hai sbavato!', 'Il rosa non si tocca!'], koLine: 'Mi... sto... sbiadendo...' },
    barks: (g) => (g.is('sbiadisco') ? ['SBIADISCOOO!', 'Non posso smettere! È il mio pezzo!'] : ['Zona VIP. Tu non sei VIP.', 'Circolare. Anche i cerchi.', 'Rosa vede tutto.']),
    dialogue: {
      name: 'Evidenziatore Rosa',
      start: (g) => {
        if (g.is('sbiadisco')) return 'balla';
        // sei già oltre il cordone: non ha senso chiederle di farti passare
        const p = g.player.pos;
        if (ZONES.vip(p) || ZONES.corridor(p) || ZONES.office(p)) return g.is('rosaBribed') ? 'pagato' : 'dentro';
        return g.is('rosaBribed') ? 'pagato' : 'start';
      },
      nodes: {
        start: { say: ['Zona VIP. Nome?'], choices: rosaMenu },
        menu: { say: ['Altro?'], choices: rosaMenu },
        marco: { say: ['Allora sei doppiamente fuori.'], next: 'menu' },
        vip: { say: ['Hai un colore?', '> No.', 'Allora no.'], next: 'menu' },
        rissa: { say: ['Al bar c\'è solo Marco.', 'Da solo nessuno fa rissa.', '...Tranne Marco. Ma no.'], next: 'menu' },
        mancia: {
          do: (g) => {
            g.addCoins(-BRIBE);
            g.flag('rosaBribed');
            openRope(g);
          },
          say: ['* Rosa conta le monete senza guardarle. Professionale.', 'Non ti ho visto. Letteralmente: sei grigio, ti confondi col muro.'],
        },
        pagato: { say: ['Io non ti conosco. Tu non conosci me. Vai.'] },
        dentro: {
          say: [
            'Aspetta. Tu sei dentro.',
            'Come sei entrato?',
            '> Dai bagni.',
            'Dai bagni. Certo. Nessuno controlla mai i bagni.',
            'Senti: io non ti ho visto, tu non mi hai visto. Il capo non mi paga abbastanza per i bagni.',
          ],
        },
        balla: { say: ['NON ORA! C\'È SBIADISCO!'] },
      },
    },
  });

  g.addNpc({
    id: 'verde',
    name: 'Evidenziatore Verde',
    pos: [-15.3, 17.9],
    face: [0, 17.9],
    look: { highlighter: HL.green, hat: 'beanie' },
    behavior: { type: 'patrol', path: [[-15.3, 17.9], [3.6, 17.9]], speed: 1.25, wait: 3 },
    faceWhenNear: false,
    fighter: {
      hp: 75,
      dmg: 11,
      parries: [1, 2],
      vision: { range: 9, fov: 100 },
      alertLine: 'EHI! TU! Qui è solo personale!',
      hurtLines: ['Ahi! Ho perso il conto!', 'Uno... due... ahia!'],
    },
    barks: () => ['Uno... due... tre casse. No, aspetta.', 'Uno... due... quante erano?', 'Il capo dice di contare le casse. Io conto le casse.'],
  });

  const lounge = (id: string, name: string, x: number, color: string, lines: string[]) =>
    g.addNpc({
      id,
      name,
      pos: [x, 15.25],
      face: [x, 0],
      look: { highlighter: color, hat: 'cap' },
      behavior: { type: 'sit' },
      action: 'drink',
      fighter: { hp: 70, dmg: 10, alertLine: 'Rissa! Finalmente!' },
      barks: () => lines,
      dialogue: {
        name,
        start: 'a',
        nodes: {
          a: {
            say: [
              'Chi sei tu?',
              '...Boh. Sei nella zona VIP, sarai importante.',
              () => pick(['Ciao, importante.', 'Salutami il capo, importante.', 'Non toccare il divano, importante.']),
            ],
          },
        },
      },
    });
  lounge('arancione', 'Evidenziatore Arancione', -0.9, HL.orange, ['Il capo è sempre più pallido.', 'Senza tappo si secca. È scienza.', 'Se trova chi è stato, lo evidenzia fino all\'ultima linea.']);
  lounge('azzurro', 'Evidenziatore Azzurro', 0.9, HL.cyan, ['Sì. Pallidissimo. Stamattina era color crema.', 'Io il tappo lo tengo sempre. Guarda: tappato.', 'Chi ruba un tappo è capace di tutto.']);

  // --- entrano in scena più tardi ---
  g.addNpc({
    id: 'fluo',
    name: 'Don Fluo',
    pos: [A.fluoDoor.x, A.fluoDoor.z],
    face: [A.fluoDoor.x, 25],
    look: { highlighter: '#eef3b8', hat: 'top', sunglasses: true, mustache: true, scale: 1.35 },
    action: 'none',
    faceWhenNear: false,
    hidden: true,
    punchLines: ['Non toccare il mio giallo!', 'Sai quanto costa un ritocco?!'],
  });
  const goon = (id: string, name: string, x: number, color: string, lines: string[], parries: [number, number] = [1, 2]) =>
    g.addNpc({
      id,
      name,
      pos: [x, 14.4],
      face: [x, 25],
      look: { highlighter: color, hat: 'cap' },
      faceWhenNear: false,
      hidden: true,
      fighter: { hp: 85, dmg: 10, speed: 3.8, hurtLines: lines, parries },
    });
  goon('giallo', 'Evidenziatore Giallo', 12.1, HL.yellow, ['Te l\'avevo detto!', 'Ti ho evidenziato!', 'Mi hai sbavato il tratto!'], [2, 3]);
  goon('viola', 'Evidenziatore Viola', 13.9, '#b58cff', ['Ahia!', 'Il viola non perdona!'], [1, 3]);
  goon('fucsia', 'Rinforzo Fucsia', 8, '#ff4fd8', ['Ahi!', 'Arrivano i rinforzi! Cioè io.'], [1, 1]);
  goon('lime', 'Rinforzo Lime', 10.5, '#b6ff3a', ['Ouch!', 'Sono un rinforzo, non un bersaglio!'], [1, 1]);
  for (const id of ['fucsia', 'lime']) {
    const f = g.npc(id).fighter!;
    f.hp = f.maxHp = 55;
    f.dmg = 9;
    f.speed = 4.4;
  }
}

// Rosa lascia passare: il cordone si apre
export function openRope(g: Game) {
  const rope = g.world.props.rope;
  if (!rope.visible) return;
  rope.visible = false;
  g.world.colliders.remove(rope.userData.rect);
}

// Rosa va a ballare sulla pista (quando parte Sbiadisco)
export function rosaDances(g: Game) {
  const rosa = g.npc('rosa');
  if (rosa.fighter?.hostile || rosa.fighter?.ko) return;
  rosa.baseAction = 'dance';
  rosa.faceWhenNear = false;
  rosa.setBehavior({ type: 'patrol', path: [[3.5, -5.2]], speed: 2.2, wait: 9999 });
  if (rosa.body instanceof Stickman) rosa.body.action = 'dance';
}
