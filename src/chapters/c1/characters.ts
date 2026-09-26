import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Choice } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { keyName } from '../../settings';
import { COINS_NEEDED } from './quests';
import { HIGHLIGHT_YELLOW_HEX, INK } from '../../render/palette';

// ---------------------------------------------------------------------------
// Gli abitanti di San Scarabocchio.
// Formato righe: 'testo' = parla il PNG, '> testo' = parli tu, '* testo' = narratore.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function createCharacters(g: Game) {
  // =========================================================================
  // MARCO — il tuo migliore amico. Il motore della storia (e dei guai).
  // =========================================================================
  const marcoMenu: Choice[] = [
    { t: 'Dove trovo altre monete?', next: 'hint' },
    { t: "Com'è il Parallelepipedo dentro?", next: 'club' },
    { t: 'Vado.' },
  ];
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: [-15.9, 6.3],
    face: [-20, 0],
    look: { hat: 'cap' },
    icon: (g) => (g.quest('c1') === 2 ? 'main' : g.quest('c1') === 4 ? 'main-turnin' : null),
    barks: (g) => {
      const q = g.quest('c1');
      if (q <= 2) return ['STECCO! Sono qui!', 'Ti vedo! Cioè, vedo delle linee che si avvicinano.'];
      if (q === 3) return ['Monete, Stecco. Mo-ne-te.', 'Io sorveglio il bar. È un lavoro duro.', 'Hai controllato per terra? Per terra ci sono sempre monete.'];
      return ['Stasera si fa la storia.', 'Porta un piano. Io porto... me.'];
    },
    dialogue: {
      name: 'Marco',
      start: (g) => {
        const q = g.quest('c1');
        if (q <= 2) return 'intro';
        if (q === 3) return 'collect';
        if (q === 4) return 'finale';
        return 'after';
      },
      nodes: {
        intro: {
          say: [
            'Stecco! Finalmente. Ti aspetto da tre ore.',
            '> Mi hai scritto venti minuti fa.',
            'Ti aspetto emotivamente da tre ore. È diverso.',
            'Allora. Stasera si va al Parallelepipedo. Il club più esclusivo della città.',
            "> È l'unico club della città.",
            'Appunto. Esclude tutti gli altri club. Più esclusivo di così.',
            "Unico problema: l'ingresso costa 50 monete. A testa.",
          ],
          choices: [
            { t: 'Io ho zero monete.', next: 'zero' },
            { t: 'Paghi tu, vero?', next: 'paghi' },
            { t: 'Perché non restiamo al bar di Gino?', next: 'gino' },
          ],
        },
        zero: { say: ['Lo so. Ti conosco. Per questo te lo dico adesso e non alle 23:59.'], next: 'piano' },
        paghi: {
          say: [
            'Ahahah.',
            'No.',
            "Ho pagato io l'ultima volta.",
            "> L'ultima volta non siamo entrati.",
            'E di chi è la colpa? Chi si è messo a discutere col buttafuori sulla filosofia delle porte?',
            '> Era una domanda legittima.',
            '"Se una porta è chiusa, è ancora una porta o è un muro con ambizioni?" Non è legittima, Stecco.',
          ],
          next: 'piano',
        },
        gino: {
          say: [
            'Perché il bar di Gino chiude alle sette.',
            '> Di sera?',
            'Di mattina. Apre alle sei e chiude alle sette. Gino dice che è un bar "concettuale".',
          ],
          next: 'piano',
        },
        piano: {
          say: [
            'Senti, fai così: gira per il paese. La gente qui ha sempre bisogno di qualcosa.',
            'Aiutali, e magari ti pagano. Oppure cerca monete per terra: qui la gente le perde di continuo.',
            '> Come fanno a perderle?',
            'Non abbiamo tasche. Non abbiamo vestiti. Metà del PIL cittadino è sul marciapiede.',
            'Quando hai 50 monete torna da me. Io resto qui a... sorvegliare il bar.',
          ],
          do: (g) => {
            if (g.quest('c1') >= 3) return;
            g.flag('metMarco');
            g.addXp(20);
            g.setStep('c1', g.state.coins >= COINS_NEEDED ? 4 : 3);
            g.after(3, () =>
              g.toast(`Suggerimento: chi ha un <b class="blue">!</b> sopra la testa ha bisogno di aiuto. Premi <b>${keyName('journal')}</b> per il diario.`, 'info', 8000),
            );
          },
        },
        collect: {
          say: [
            (g) =>
              pick([
                `${g.state.coins} monete? Su ${COINS_NEEDED}? Matematicamente è... meno.`,
                `Sei a ${g.state.coins}. Ne mancano ${COINS_NEEDED - g.state.coins}. Lo so perché ho fatto il liceo. Due volte.`,
                `${g.state.coins} monete. Il buttafuori non accetta "quasi".`,
              ]),
          ],
          choices: marcoMenu,
        },
        menu: { say: ['Altro?'], choices: marcoMenu },
        hint: {
          say: [
            (g) => {
              const tips: string[] = [];
              if (!g.questDone('cane')) tips.push('Nonna Pina ha perso di nuovo il cane. Paga bene. Paga, almeno.');
              if (!g.questDone('consegna')) tips.push('Aldo del Negozio di Cose cerca sempre qualcuno per le consegne.');
              if (!g.questDone('bus')) tips.push('Gianni, alla fermata del bus. Aspetta da così tanto che avrà messo da parte qualcosa.');
              if (!g.questDone('filosofo')) tips.push('Il Filosofo nel parco paga chi lo ascolta. Poco, ma paga.');
              tips.push('E guarda per terra! Vicoli, cortili, fontane. La gente perde monete ovunque.');
              return pick(tips);
            },
          ],
          next: 'menu',
        },
        club: {
          say: [
            'È rettangolare. Tutto è rettangolare. Anche la musica.',
            '> Come fa la musica a essere rettangolare?',
            'Non lo so. Ma quando la senti, lo capisci.',
          ],
          next: 'menu',
        },
        finale: {
          say: [
            'Cinquanta monete! Stecco, sono fiero di te. Mi scende una lacrima. Se avessi gli occhi lucidi. O gli occhi.',
            '> Quindi stasera si va al Parallelepipedo?',
            'Certo. Solo... una piccola cosa.',
            'Hai visto quel tizio giallo in fondo alla strada, verso nord?',
            (g) => (g.is('metGiallo') ? '> Sì. Mi ha minacciato. In giallo.' : '> Quello colorato? Pensavo fosse un errore di stampa.'),
            'È uno degli Evidenziatori. La gang più pericolosa della città.',
            'Sono gli unici ad avere un colore. E se ne vantano. Tantissimo.',
            'Il Parallelepipedo è loro. E ieri sera io ho... diciamo... preso in prestito una cosa.',
            '> Che cosa?',
            'Il tappo del capo.',
            '> Marco. Un evidenziatore senza tappo si secca.',
            'LO SO. È tutta la notte che lo sento urlare "mi sto sbiadendo".',
            'Quindi stasera entriamo, rimettiamo il tappo al suo posto, e usciamo. Nessuno si fa male.',
            '> E se ci scoprono?',
            'Allora qualcuno si fa male. Ma in modo stilizzato.',
            'Ci vediamo stasera. Porta le monete. E un piano. Soprattutto un piano.',
          ],
          do: (g) => g.flag('finale'),
        },
        after: {
          say: ['Stasera. Parallelepipedo. Porta un piano.'],
          choices: [{ t: 'Qual è il piano?', next: 'noplan' }, { t: 'A stasera.' }],
        },
        noplan: { say: ['Pensavo lo portassi tu.', '> ...', 'Ecco. Questo non è un piano.'] },
      },
    },
  });

  // =========================================================================
  // GINO — barista del bar concettuale
  // =========================================================================
  const ginoMenu: Choice[] = [
    { t: 'Un caffè, grazie. (3 monete, +15 salute)', next: 'caffe' },
    { t: "Com'è la vita da barista?", next: 'vita' },
    { t: 'Perché chiudi alle sette di mattina?', next: 'orari', if: (g) => g.is('metMarco') },
    { t: 'Niente, ciao.' },
  ];
  g.addNpc({
    id: 'gino',
    name: 'Gino',
    pos: [-18, 9.45],
    face: [-18, 0],
    look: { mustache: true, hat: 'hair' },
    barks: () => ['Caffè! Caffè disegnato!', 'Questo bicchiere non si asciuga mai...', 'Oggi offre la casa. No, scherzo.'],
    dialogue: {
      name: 'Gino',
      start: 'start',
      nodes: {
        start: {
          say: ['Benvenuto al Bar da Gino! Abbiamo caffè, caffè lungo e caffè che sembra lungo ma è solo disegnato male.'],
          choices: ginoMenu,
        },
        menu: { say: ['Altro?'], choices: ginoMenu },
        caffe: { say: [], next: (g) => (g.state.coins >= 3 ? 'caffeOk' : 'caffeNo') },
        caffeOk: {
          do: (g) => {
            g.addCoins(-3);
            g.heal(15);
          },
          say: ['Ecco a te. Attento, scotta.', '* Il caffè ti attraversa. Letteralmente. Sei fatto di linee.', 'Tre monete. Il resto è poesia.'],
        },
        caffeNo: {
          say: ['Niente monete? Allora ti offro un consiglio: le monete non crescono sugli alberi.', 'Crescono per terra. Guardati intorno.'],
        },
        vita: {
          say: [
            "Asciugo lo stesso bicchiere da quando mi hanno disegnato.",
            '> E non si asciuga?',
            "Mai. Credo che l'abbiano disegnato bagnato.",
            'È una metafora della vita. O un errore di chi mi ha disegnato. Non ho ancora deciso.',
          ],
          next: 'menu',
        },
        orari: { say: ["È un bar concettuale. L'idea del bar è sempre aperta. Il bar no."], next: 'menu' },
      },
    },
  });

  // =========================================================================
  // ALDO — Negozio di Cose. Missione: Consegna urgente
  // =========================================================================
  const aldoMenu: Choice[] = [
    { t: 'Ci penso io.', next: 'accept' },
    { t: "Cosa c'è dentro?", next: 'dentro' },
    { t: 'Cosa vendi, esattamente?', next: 'vendi' },
    { t: 'Non ho tempo.', next: 'no' },
  ];
  g.addNpc({
    id: 'aldo',
    name: 'Aldo',
    pos: [25, 8.7],
    face: [25, 0],
    look: { hat: 'beanie' },
    action: 'crossed',
    icon: (g) => (g.quest('consegna') === -1 ? 'side' : null),
    barks: () => ['Cose! Vendo cose!', 'Oggi sconti su tutto. Anche sul niente.', 'Un cliente? No. Era il vento.'],
    dialogue: {
      name: 'Aldo',
      start: (g) => (g.quest('consegna') === -1 ? 'intro' : g.questDone('consegna') ? 'after' : 'waiting'),
      nodes: {
        intro: {
          say: [
            'Ehi tu! Sì, tu, quello con le braccia.',
            '> Tutti hanno le braccia.',
            "E infatti lo dico a tutti. Ma tu sei l'unico che si è fermato.",
            'Devo consegnare un pacco al Dottor Soldini, in banca. Ma non posso lasciare il negozio.',
            '> Perché?',
            'Potrebbe entrare un cliente. Non è mai successo, ma se succede proprio mentre non ci sono? Tragedia.',
          ],
          choices: aldoMenu,
        },
        menu: { say: ['Allora? Mi aiuti?'], choices: aldoMenu },
        dentro: {
          say: [
            "Non lo so. Me l'ha dato un tizio che non lo sapeva.",
            "A lui l'aveva dato un altro che non lo sapeva.",
            'È una catena di non-sapere. Si chiama economia.',
          ],
          next: 'menu',
        },
        vendi: {
          say: ['Cose.', '> Che tipo di cose?', "Cose generiche. Se ti serve una cosa, ce l'ho. Se ti serve una cosa specifica, no."],
          next: 'menu',
        },
        no: { say: ['Nessuno ha tempo. Il tempo qui è disegnato a mano. Ogni tanto salta.'] },
        accept: {
          do: (g) => {
            g.startQuest('consegna');
            g.give('pacco');
          },
          say: [
            'Grande! Sei un eroe. Un eroe stilizzato, ma un eroe.',
            'Ah, e non aprirlo. Non per privacy: è sigillato con lo scotch disegnato. Non si riapre più.',
          ],
        },
        waiting: { say: ['Il pacco! Alla banca! Dottor Soldini! Veloce!', 'O con calma. Ma veloce.'] },
        after: { say: ['Grazie ancora per la consegna. Se entra un cliente, sarai il primo a saperlo.', 'Dopo di me.'] },
      },
    },
  });

  // =========================================================================
  // DOTTOR SOLDINI — Banca dei Soldi (pochi)
  // =========================================================================
  const soldiniMenu: Choice[] = [
    { t: 'Che tasso di interesse avete?', next: 'tasso' },
    { t: 'Mi fa un prestito?', next: 'prestito' },
    { t: 'Perché "pochi" soldi?', next: 'pochi' },
    { t: 'No, grazie.' },
  ];
  g.addNpc({
    id: 'soldini',
    name: 'Dott. Soldini',
    pos: [39, 8.0],
    face: [39, 0],
    look: { hat: 'top', tie: true },
    icon: (g) => (g.questActive('consegna') ? 'turnin' : null),
    barks: () => ['Soldi, soldi, soldi. Pochi, ma soldi.', 'Investite nel vuoto. Rende sempre uguale.', 'La banca è solida. È un parallelepipedo anche lei.'],
    dialogue: {
      name: 'Dott. Soldini',
      start: (g) => (g.questActive('consegna') && g.has('pacco') ? 'pacco' : 'normal'),
      nodes: {
        normal: { say: ['Banca dei Soldi, buongiorno. Vuole aprire un conto?'], choices: soldiniMenu },
        menu: { say: ['Altro?'], choices: soldiniMenu },
        tasso: { say: ['Nessuno.', '> Nessun interesse?', 'Nessuno è interessato. Lo dico sempre. Nessuno ride mai.'], next: 'menu' },
        prestito: {
          say: ['Certamente! Al 400% di interesse.', '> Annuale?', 'Al minuto.', '> ...No, grazie.', 'Lo dicono tutti. È per questo che i soldi sono pochi.'],
          next: 'menu',
        },
        pochi: {
          say: [
            'Perché gli Evidenziatori passano ogni settimana a "evidenziare" il caveau.',
            'E quello che evidenziano... sparisce.',
            'Ma non chiamarli rapinatori. Si offendono. Preferiscono "consulenti cromatici".',
          ],
          next: 'menu',
        },
        pacco: {
          say: [
            'Il mio pacco! Finalmente!',
            '* Il Dottor Soldini apre il pacco. Lo scotch disegnato si strappa con un suono disegnato.',
            'Una scatola vuota. Perfetto!',
            '> Cosa se ne fa di una scatola vuota?',
            'Ci metto i risparmi della banca.',
            '> E quanti sono?',
            'Esattamente quanti ne entrano in una scatola vuota.',
          ],
          next: 'paga',
        },
        paga: {
          do: (g) => {
            g.take('pacco');
            g.addCoins(20);
            g.addXp(30);
            g.completeQuest('consegna');
          },
          say: ['Ecco 20 monete per il disturbo. Le ho stampate adesso, sono ancora calde.'],
        },
      },
    },
  });

  // =========================================================================
  // BRUNO — buttafuori del Parallelepipedo
  // =========================================================================
  const brunoMenu: Choice[] = [
    { t: 'Quando apre?', next: 'apre' },
    { t: "Com'è dentro?", next: 'dentro' },
    { t: 'Posso entrare solo un attimo?', next: 'attimo' },
    { t: 'Conosci Marco?', next: 'marco', if: (g) => g.is('metMarco') },
    { t: 'Ok, ciao.' },
  ];
  g.addNpc({
    id: 'bruno',
    name: 'Bruno',
    pos: [53, 7.5],
    face: [53, 0],
    look: { sunglasses: true, scale: 1.3 },
    action: 'crossed',
    faceWhenNear: false,
    barks: () => ['...', 'Chiuso.', 'Stasera. Non ora.', 'Circolare.'],
    onPunch: (g, n) => {
      const again = g.is('punched_bruno');
      n.say(again ? 'Due volte? Ammirevole. Stupido, ma ammirevole.' : 'Pessima idea.', 3);
      g.after(0.25, () => {
        g.hurt(again ? 35 : 25);
        const d = g.player.pos.clone().sub(n.pos).setY(0).normalize();
        g.player.knock.copy(d.multiplyScalar(14));
        g.toast('Bruno ti ha restituito il pugno. Con gli interessi.', 'bad');
      });
    },
    dialogue: {
      name: 'Bruno',
      start: 'start',
      nodes: {
        start: { say: ['Parallelepipedo. Chiuso.'], choices: brunoMenu },
        menu: { say: ['Altro? Veloce.'], choices: brunoMenu },
        apre: { say: ['Stasera. Ingresso 50 monete.', 'Dress code: niente scarpe da ginnastica.', '> Non ho le scarpe.', 'Allora sei già in regola.'], next: 'menu' },
        dentro: { say: ['Rettangolare.', '> Tutto qui?', "È un parallelepipedo. Cosa ti aspettavi, una sfera?"], next: 'menu' },
        attimo: {
          say: ['No.', '> Mezzo attimo?', 'Mezzo no.', '> Un quarto di...', 'Le mie braccia sono più spesse delle tue. Si vede anche se siamo tutti linee.'],
          next: 'menu',
        },
        marco: {
          say: ['Marco...', "Di' a Marco che il capo lo sta cercando.", 'Anzi no. Non dirglielo. È più divertente così.'],
          next: 'menu',
        },
      },
    },
  });

  // =========================================================================
  // IL SINDACO — fa comizi a nessuno davanti alla propria statua
  // =========================================================================
  const sindacoMenu: Choice[] = [
    { t: 'Di chi è la statua?', next: 'statua' },
    { t: 'Che problemi ha la città?', next: 'problemi' },
    { t: 'Il Comune può darmi dei soldi?', next: 'soldi' },
    { t: 'Con chi sta parlando?', next: 'solo' },
    { t: 'Arrivederci.' },
  ];
  g.addNpc({
    id: 'sindaco',
    name: 'Il Sindaco',
    pos: [-42.9, -6.4],
    face: [-42.9, 0],
    look: { hat: 'top', mustache: true, tie: true },
    action: 'speech',
    barks: () => [
      'Cittadini! ...Cittadino? ...Nessuno?',
      'Votatemi! Sono già il sindaco, ma votatemi lo stesso!',
      'Prometto più linee per tutti!',
      'Meno tasse! Più tratteggio!',
    ],
    dialogue: {
      name: 'Il Sindaco',
      start: 'start',
      nodes: {
        start: {
          say: ['Ah, un elettore! Benvenuto a San Scarabocchio!', '47 abitanti. Tre dimensioni. Zero colori. Una città modello.'],
          choices: sindacoMenu,
        },
        menu: { say: ['Altre domande? Adoro le domande. Le risposte un po\' meno.'], choices: sindacoMenu },
        statua: { say: ["Mia! L'ho disegnata io stesso. Notare la somiglianza.", '> È un omino stilizzato.', 'Esatto. Identica. Anni di lavoro.'], next: 'menu' },
        problemi: {
          say: [
            'Nessuno!',
            'A parte la gang degli Evidenziatori, il bilancio in rosso, la mancanza di colori, di tasche, di dita...',
            "...l'autobus che non passa, il bar che chiude alle sette, la posta in sciopero perenne...",
            'Nessuno! Città modello.',
          ],
          next: 'menu',
        },
        soldi: {
          say: ['Il Comune non dà soldi. Il Comune prende soldi.', "È la definizione di Comune. Guarda sul dizionario. Ah, non abbiamo il dizionario. Fidati."],
          next: 'menu',
        },
        solo: {
          say: [
            'Ai cittadini!',
            "> Non c'è nessuno.",
            'Ai cittadini futuri. Faccio campagna elettorale con largo anticipo.',
            '> Le elezioni quando sono?',
            'Mai. Ma non si sa mai.',
          ],
          next: 'menu',
        },
      },
    },
  });

  // =========================================================================
  // NONNA PINA + PALLINO. Missione: Il cane di Nonna Pina
  // =========================================================================
  const pinaAsk: Choice[] = [
    { t: 'Lo cerco io.', next: 'accept' },
    { t: 'Mi spiace, sono impegnato.', next: 'no' },
  ];
  const pina = g.addNpc({
    id: 'pina',
    name: 'Nonna Pina',
    pos: [-16, -8.4],
    face: [-16, 0],
    look: { hat: 'bun' },
    action: 'cane',
    icon: (g) => (g.quest('cane') === -1 ? 'side' : g.quest('cane') === 1 ? 'turnin' : null),
    barks: (g) =>
      g.questDone('cane')
        ? ['Pallino Secondo, non mangiare il marciapiede!', 'Che bel cagnolino. Chiunque sia.']
        : ['Pallinooo!', 'Pallino, vieni dalla nonna!', 'Pallino! Ho i biscotti! Disegnati, ma li ho!'],
    dialogue: {
      name: 'Nonna Pina',
      start: (g) => {
        const q = g.quest('cane');
        if (q === -1) return g.is('pinaAsked') ? 'intro2' : 'intro';
        if (q === 0) return 'cerca';
        if (q === 1) return 'ritorno';
        return 'after';
      },
      nodes: {
        intro: {
          do: (g) => g.flag('pinaAsked'),
          say: [
            'Giovanotto! Hai visto il mio Pallino?',
            '> Chi è Pallino?',
            'Il mio cane! Piccolo, quattro zampe, una coda. Una linea per il corpo.',
            '> Così descrive tutti i cani del mondo.',
            'Ma lui è speciale. Risponde al nome Pallino.',
            'A volte. Mai, in realtà.',
            "L'ho perso vicino al parco. Stamattina. O ieri. Alla mia età i giorni sono tratteggiati.",
          ],
          choices: pinaAsk,
        },
        intro2: { say: ["Hai cambiato idea, caro? Pallino è ancora là fuori. Credo. Forse nel parco."], choices: pinaAsk },
        accept: {
          do: (g) => g.startQuest('cane'),
          say: ['Che caro ragazzo. Ti darò una ricompensa.', 'Non soldi.', 'Anche soldi.'],
        },
        no: { say: ['Anche Pallino era impegnato. Guarda com\'è finita.'] },
        cerca: {
          say: [
            "L'hai trovato? No?",
            'Controlla il parco. I cani adorano il parco. Gli alberi sono disegnati benissimo.',
            '> Sono tre scarabocchi.',
            'Per un cane sono una foresta.',
          ],
        },
        ritorno: {
          say: [
            'PALLINO! Fammi vedere...',
            '...',
            'Questo non è Pallino.',
            '> Come no?',
            "Pallino è morto nel 1998. Te l'ho detto.",
            "> Non me l'ha detto.",
            "Beh, adesso te l'ho detto.",
            'Però questo è carino. Lo chiamo Pallino Secondo.',
          ],
          next: 'reward',
        },
        reward: {
          do: (g) => {
            g.addCoins(15);
            g.give('righello');
            g.addXp(40);
            g.completeQuest('cane');
            const dog = g.npc('pallino');
            dog.setBehavior({ type: 'follow', target: () => g.npc('pina').pos, dist: 1.3, speed: 2.2 });
          },
          say: [
            'Tieni, per il disturbo. Quindici monete.',
            'E prendi questo righello. Era di mio marito. Lo usava per misurare la sua pazienza.',
            'Trenta centimetri. Mai uno di più.',
            () => `Con quello puoi darle di santa ragione a chi se lo merita. Premi ${keyName('weapon2')} per impugnarlo, caro.`,
          ],
        },
        after: {
          say: ['Pallino Secondo sta benissimo. Ha già morso il postino.', '> Ma la posta è chiusa.', 'Appunto. Non so chi abbia morso. Meglio non chiedere.'],
        },
      },
    },
  });
  // bastone
  const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.95, 6).translate(0, -0.47, 0), new THREE.MeshBasicMaterial({ color: INK }));
  cane.rotation.x = 0.35;
  (pina.body as Stickman).prop.add(cane);

  const dogPos = g.world.anchors.dogSpot;
  g.addNpc({
    id: 'pallino',
    name: 'Cane',
    pos: [dogPos.x, dogPos.z],
    face: [40, -40],
    dog: true,
    talkLabel: 'Accarezza il cane',
    barks: () => ['Bau.', 'Bau?', 'Wof.', 'Bau (in corsivo).'],
    onPunch: (g, n) => {
      n.say('Guaì!', 2);
      g.toast('Hai tirato un pugno a un cane. Il gioco ti giudica.', 'bad');
    },
    dialogue: {
      name: 'Cane',
      start: (g) => {
        const q = g.quest('cane');
        if (q === 0) return 'found';
        if (q === 1) return 'following';
        if (g.questDone('cane')) return 'pina';
        return 'random';
      },
      nodes: {
        random: { say: ['* Il cane ti guarda. Tu guardi il cane.', '* Siete due linee che si capiscono.', 'Bau.'] },
        found: {
          say: [
            '* Il cane ti guarda. Ha una linea per corpo e quattro per zampe.',
            '* Potrebbe essere Pallino. Potrebbe essere qualsiasi cane. Qui i cani sono tutti uguali.',
            'Bau.',
          ],
          next: 'follow',
        },
        follow: {
          do: (g) => {
            g.setStep('cane', 1);
            g.npc('pallino').setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2, speed: 3.2 });
          },
          say: ['* Il cane decide di seguirti. Si fida di te. Errore suo.'],
        },
        following: { say: ['Bau?', '* Il cane vuole andare dalla signora col bastone. Anche tu, a quanto pare.'] },
        pina: { say: ['Bau!', '* Pallino Secondo è felice. Credo.'] },
      },
    },
  });

  // =========================================================================
  // GIANNI — aspetta il 12 dal 2014. Missione: Aspettando il 12
  // =========================================================================
  g.addNpc({
    id: 'gianni',
    name: 'Gianni',
    pos: [-30, -7.4],
    face: [-30, 0],
    look: { hat: 'beanie' },
    icon: (g) => (g.quest('bus') === -1 ? 'side' : g.quest('bus') === 1 ? 'turnin' : null),
    barks: (g) =>
      g.is('gianniFree')
        ? ['Libero! LIBERO!', 'Che bello camminare! Ho delle ginocchia!']
        : g.is('gianniLied')
          ? ['Quattro minuti...', 'Tre minuti e mezzo...', 'Ormai ci siamo!']
          : ['Dove sarà il 12...', 'Oggi me lo sento. Lo sento nelle linee.', 'Brum brum? No, era un piccione.'],
    dialogue: {
      name: 'Gianni',
      start: (g) => {
        const q = g.quest('bus');
        if (q === -1) return 'intro';
        if (q === 0) return 'waitRead';
        if (q === 1) return 'tell';
        return g.is('gianniFree') ? 'free' : 'lied';
      },
      nodes: {
        intro: {
          say: [
            'Scusa... sai mica a che ora passa il 12?',
            '> Da quanto aspetti?',
            'Dal 2014.',
            'Ma ieri mi è sembrato di sentirlo. Oppure era la mia pancia.',
            "Ho paura di andare a guardare gli orari. E se l'ho perso?",
            'Potresti guardarli tu? Il cartello è lì, sul palo.',
          ],
          choices: [
            { t: 'Ci guardo io.', next: 'accept' },
            { t: "Aspetta ancora un po', vedrai che arriva.", next: 'no' },
          ],
        },
        accept: { do: (g) => g.startQuest('bus'), say: ['Grazie! Io resto qui. Non si sa mai che arrivi mentre sei via.'] },
        no: { say: ['È quello che faccio meglio.'] },
        waitRead: { say: ['Allora? Il cartello è lì. Sul palo. Il palo col cartello.'] },
        tell: {
          say: ['Allora? Quando passa?'],
          choices: [
            { t: 'Gianni... il cartello dice che passa quando smetti di aspettarlo.', next: 'truth' },
            { t: 'Fra cinque minuti!', next: 'lie' },
          ],
        },
        truth: {
          say: [
            '...Quando smetto di aspettarlo?',
            '> Esatto.',
            'Quindi se me ne vado... passa?',
            '> Credo di sì.',
            'E io lo perdo!',
            '> ...Sì.',
            'È la cosa più bella che abbia mai sentito.',
            "Sono libero! Vado a fare una passeggiata! Ho delle gambe! Me n'ero dimenticato!",
          ],
          next: 'truthPay',
        },
        truthPay: {
          do: (g) => {
            g.flag('gianniFree');
            g.addCoins(10);
            g.addXp(30);
            g.completeQuest('bus');
          },
          say: ['Tieni, i soldi del biglietto. Non mi servono più.'],
        },
        lie: { say: ['Lo sapevo! Me lo sentivo!', 'Cinque minuti! Dopo tutto questo aspettare, è quasi niente!'], next: 'liePay' },
        liePay: {
          do: (g) => {
            g.flag('gianniLied');
            g.addCoins(10);
            g.addXp(20);
            g.completeQuest('bus');
          },
          say: ['Tieni, una mancia per la bella notizia.'],
        },
        free: { say: ['Ho scoperto i piedi! Vado ovunque adesso!', 'Ieri il parco, oggi il parco, domani... forse il parco!'] },
        lied: { say: ['Cinque minuti... ancora cinque minuti...', 'È bellissimo avere una speranza precisa.'] },
      },
    },
  });

  // =========================================================================
  // ARTURO IL FILOSOFO — Missione: Tre domande
  // =========================================================================
  const bench = g.world.anchors.philosopherBench;
  g.addNpc({
    id: 'filosofo',
    name: 'Arturo il Filosofo',
    pos: [bench.x - 0.05, bench.z],
    face: [bench.x - 10, bench.z],
    look: { beard: true },
    behavior: { type: 'sit' },
    action: 'think',
    icon: (g) => (g.quest('filosofo') === -1 ? 'side' : null),
    barks: () => ['Essere o non essere... disegnati.', 'Penso, dunque sono. Stilizzato.', 'Se il cerchio è la mia testa, dov\'è il mio cervello?'],
    dialogue: {
      name: 'Arturo',
      start: (g) => (g.questDone('filosofo') ? 'after' : 'intro'),
      nodes: {
        intro: {
          say: [
            'Siediti, giovane linea.',
            'Ti porrò tre domande. Se rispondi, avrai la saggezza. E cinque monete.',
          ],
          choices: [
            { t: 'Va bene.', next: 'q1' },
            { t: 'Posso avere solo le cinque monete?', next: 'solo' },
            { t: 'Magari dopo.' },
          ],
        },
        solo: { say: ['Vuoi il risultato senza il percorso. Sei già un filosofo moderno.', 'Ma no.'], choices: [{ t: 'Va bene, fammi le domande.', next: 'q1' }, { t: 'Magari dopo.' }] },
        q1: {
          do: (g) => {
            if (g.quest('filosofo') === -1) g.startQuest('filosofo');
          },
          say: ['Prima domanda.', 'Se un omino stilizzato cade in un bosco e nessuno lo disegna... fa rumore?'],
          choices: [
            { t: 'Sì.', next: 'q1a' },
            { t: 'No.', next: 'q1b' },
            { t: 'Quale bosco? Qui ci sono tre alberi.', next: 'q1c' },
          ],
        },
        q1a: { say: ['Interessante. Sbagliato, ma interessante.'], next: 'q2' },
        q1b: { say: ['Pessimista. Mi piaci.'], next: 'q2' },
        q1c: { say: ['Esatto! QUALE bosco? Genio. Lo scriverò da qualche parte. Quando avrò le mani.'], next: 'q2' },
        q2: {
          say: ['Seconda domanda.', 'Noi abbiamo le braccia, ma non le mani. Allora come facciamo a tenere le cose?'],
          choices: [
            { t: 'Con la fede.', next: 'q2a' },
            { t: 'Con la fisica.', next: 'q2b' },
            { t: 'Non ci avevo mai pensato. Ora ho paura.', next: 'q2c' },
          ],
        },
        q2a: { say: ['La fede. Certo. Come quella che hai nel fatto che domani ci ridisegnino uguali.'], next: 'q3' },
        q2b: { say: ['La fisica qui è opzionale. Hai visto come salti?'], next: 'q3' },
        q2c: { say: ["Bene. La paura è l'inizio della saggezza. E del sudore, se avessimo i pori."], next: 'q3' },
        q3: {
          say: ['Ultima domanda. La più difficile.', 'Chi ci ha disegnati?'],
          choices: [
            { t: 'Dio.', next: 'q3a' },
            { t: 'Un tizio annoiato col computer.', next: 'q3b' },
            { t: "Un'intelligenza artificiale.", next: 'q3c' },
          ],
        },
        q3a: { say: ['Mmh. Allora Dio ha una matita sola e poca pazienza.'], next: 'fine' },
        q3b: { say: ['Probabile. Guarda le proporzioni degli alberi.'], next: 'fine' },
        q3c: { say: ['Ahahah! Ma per favore.', 'Nessuna macchina saprebbe scrivere dialoghi così profondi.'], next: 'fine' },
        fine: {
          do: (g) => {
            g.addCoins(5);
            g.addXp(35);
            g.give('libro');
            g.completeQuest('filosofo');
          },
          say: [
            'Hai risposto. Non bene, ma hai risposto.',
            'Ecco le tue cinque monete. E un libro che ho scritto io.',
            'Leggilo con calma. Sono tutte pagine bianche. Come le nostre facce.',
          ],
        },
        after: {
          say: ['Torna quando avrai nuovi dubbi. Io sarò qui.', '> Sempre?', "Sempre. Mi hanno disegnato seduto. Non ho mai provato ad alzarmi, ma ho i miei sospetti."],
        },
      },
    },
  });

  // =========================================================================
  // COMPARSE (senza missioni, ma con molto da dire)
  // =========================================================================
  const fountain = g.world.anchors.fountain;
  g.addNpc({
    id: 'fabio',
    name: 'Fabio',
    pos: [38 + 8.5, -28],
    look: { hat: 'hair' },
    behavior: { type: 'circle', cx: 38, cz: fountain.z - 3.1, r: 8.5, speed: 3.4 },
    barks: () => ['Giro 4.382!', 'Non posso fermarmi! Se mi fermo mi cancellano!', 'Uff... uff...', 'Il segreto è respirare. Anche senza polmoni.'],
    dialogue: {
      name: 'Fabio',
      start: 'start',
      nodes: {
        start: {
          say: ['Uff... uff... Cosa vuoi? Veloce, sto perdendo il ritmo cardiaco.', '> Non abbiamo il cuore.', 'Lo so. Lo sto perdendo lo stesso.'],
          choices: [
            { t: 'Perché corri sempre in cerchio?', next: 'cerchio' },
            { t: 'Per cosa ti alleni?', next: 'allena' },
            { t: 'Niente, vai pure.' },
          ],
        },
        cerchio: { say: ['Perché la fontana è rotonda. Se fosse quadrata correrei in quadrato.', 'Sono flessibile.'] },
        allena: { say: ['Per la maratona.', '> Quale maratona?', 'Non lo so. Ma quando ci sarà, sarò pronto. Sono al giro 4.382.'] },
      },
    },
  });

  g.addNpc({
    id: 'luca',
    name: 'Luca',
    pos: [-8.75, -1.8],
    face: [0, -1.8],
    look: { hat: 'cap' },
    action: 'push',
    faceWhenNear: false,
    barks: () => ['Forza... forza...', 'Ancora un centimetro...', 'Hai visto? Si è mossa! No.'],
    dialogue: {
      name: 'Luca',
      start: 'start',
      nodes: {
        start: {
          say: [
            'Si è fermata.',
            '> La macchina?',
            "Sì. Non ha il motore. Non l'ha mai avuto.",
            'È un rettangolo con quattro cerchi. Più un altro rettangolo sopra.',
            '> E perché la spingi?',
            'Perché così sembra che vada. Guardala. Non sembra che vada?',
          ],
          choices: [
            { t: 'Ti aiuto a spingere.', next: 'aiuto', if: (g) => !g.is('lucaHelped') },
            { t: 'Sembra ferma.', next: 'ferma' },
            { t: 'Dove devi andare?', next: 'dove' },
          ],
        },
        aiuto: {
          say: ['Grazie! Al mio tre. Uno... due... tre!', '* Spingete con tutte le vostre linee.', '* La macchina non si muove di un millimetro.'],
          next: 'aiuto2',
        },
        aiuto2: {
          do: (g) => {
            g.flag('lucaHelped');
            g.addXp(15);
          },
          say: ['Non si è mossa. Ma la nostra amicizia sì.'],
        },
        ferma: { say: ['Pessimista. Tu e il Filosofo dovreste conoscervi.'] },
        dove: {
          say: [
            'Da nessuna parte. Ma se smetto di spingere, poi cosa faccio?',
            "Almeno così ho un obiettivo. Tu ce l'hai un obiettivo?",
            '> Ho una freccia rossa che me lo indica.',
            'Beato te.',
          ],
        },
      },
    },
  });

  g.addNpc({
    id: 'giulia',
    name: 'Giulia',
    pos: [21, -6.6],
    look: { hat: 'bun' },
    action: 'phone',
    behavior: { type: 'patrol', path: [[21, -6.6], [33, -6.6]], speed: 1.1, wait: 2.5 },
    barks: () => [
      'Sì mamma. No mamma. Sì, ho mangiato.',
      'No, non ho il fidanzato. Sì, sono ancora stilizzata.',
      'Mamma, non ti sento... ti sto perdendo... non è vero.',
      'Sì, mi copro. Con cosa, mamma? Con cosa?',
    ],
    dialogue: {
      name: 'Giulia',
      start: 'start',
      nodes: {
        start: {
          say: [
            'Scusa, sono al telefono.',
            '> Con chi?',
            'Con mia madre.',
            '> E cosa dice?',
            'Ha iniziato con "ai miei tempi..." e poi ha fatto una pausa. Sto ancora aspettando il resto.',
          ],
          choices: [
            { t: 'Salutamela.', next: 'saluta' },
            { t: 'Dov\'è il telefono? Non vedo niente.', next: 'tel' },
            { t: 'Ok, scusa.' },
          ],
        },
        saluta: { say: ['Mamma, ti saluta un omino.', '...', 'Dice che sei troppo magro.'] },
        tel: { say: ['È un telefono stilizzato. Basta il gesto.', '> Ma non abbiamo le mani.', 'Appunto. È MOLTO stilizzato.'] },
      },
    },
  });

  const ugo = g.addNpc({
    id: 'ugo',
    name: 'Ugo il Pittore',
    pos: [-33, 9.35],
    face: [-33, 12],
    look: { hat: 'beret' },
    action: 'paint',
    faceWhenNear: false,
    barks: () => ["Un'altra mano di bianco...", 'Ancora più bianco. Ancora.', 'Il bianco è il nuovo bianco.'],
    dialogue: {
      name: 'Ugo',
      start: 'start',
      nodes: {
        start: {
          say: ["Non disturbare l'artista.", '> Cosa stai facendo?', 'Sto dipingendo il muro di bianco.', '> Ma era già bianco.', 'E adesso è più bianco. È arte contemporanea.'],
          choices: [
            { t: 'Chi ti paga?', next: 'paga' },
            { t: 'Posso aiutare?', next: 'aiuto' },
            { t: 'Bello. Molto... bianco.', next: 'bello' },
          ],
        },
        paga: { say: ['Il Comune.', '> Quanto?', 'Niente. È molto contemporaneo.'] },
        aiuto: { say: ['No. Hai un tratto troppo... espressivo. Qui serve il nulla.'] },
        bello: { say: ['Grazie! Finalmente qualcuno che capisce.', 'La prossima settimana dipingo il cielo. Di bianco.'] },
      },
    },
  });
  const roller = new THREE.Group();
  const rh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6).translate(0, -0.25, 0), new THREE.MeshBasicMaterial({ color: INK }));
  const rr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), new THREE.MeshBasicMaterial({ color: '#fbf8ee' }));
  rr.rotation.z = Math.PI / 2;
  rr.position.y = -0.52;
  const rrEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 10, 1, true), new THREE.MeshBasicMaterial({ color: INK, wireframe: true }));
  rrEdge.rotation.z = Math.PI / 2;
  rrEdge.position.y = -0.52;
  roller.add(rh, rr, rrEdge);
  roller.rotation.x = -1.2;
  (ugo.body as Stickman).prop.add(roller);

  const kebabMenu: Choice[] = [
    { t: 'Un kebab, grazie. (10 monete, +50 salute)', next: 'buy' },
    { t: 'Perché "esistenziale"?', next: 'perche' },
    { t: "Cosa c'è dentro?", next: 'dentro' },
    { t: 'Ciao.' },
  ];
  g.addNpc({
    id: 'rocco',
    name: 'Rocco',
    pos: [-4.8, -11.75],
    face: [-4.8, 0],
    look: { mustache: true, hat: 'hair' },
    barks: () => ['Kebab! Kebab esistenziale!', 'Salsa piccante? È disegnata, ma brucia lo stesso.', 'Chi ha fame di risposte? Io ho il kebab.'],
    dialogue: {
      name: 'Rocco',
      start: 'start',
      nodes: {
        start: { say: ['Kebab Esistenziale! Il kebab che ti fa chiedere "perché".'], choices: kebabMenu },
        menu: { say: ['Altro, amico?'], choices: kebabMenu },
        buy: { say: [], next: (g) => (g.state.coins >= 10 ? 'ok' : 'no') },
        ok: {
          do: (g) => {
            g.addCoins(-10);
            g.heal(50);
          },
          say: ['Ecco a te. Salsa? Sì. Qui si dice sempre sì.', '* Mangi il kebab. Per un attimo, tutto ha senso.', "* Poi l'attimo passa."],
        },
        no: { say: ["Niente monete, niente kebab. È l'unica legge che rispetto."] },
        perche: {
          say: ["Perché dopo averlo mangiato ti chiedi: perché l'ho fatto?", 'E poi: lo rifarei?', "E la risposta è sempre sì. Questo è l'esistenzialismo."],
          next: 'menu',
        },
        dentro: { say: ['Carne.', '> Di cosa?', 'Di carne. Non fare domande di cui non vuoi la risposta.'], next: 'menu' },
      },
    },
  });

  const rossiMenu: Choice[] = [
    { t: "Com'è la criminalità qui?", next: 'crimine' },
    { t: 'E gli Evidenziatori?', next: 'gang', if: (g) => g.is('metMarco') || g.is('metGiallo') },
    { t: 'Posso avere un distintivo?', next: 'distintivo' },
    { t: 'Tutto regolare.' },
  ];
  g.addNpc({
    id: 'rossi',
    name: 'Agente Rossi',
    pos: [-40, 5.8],
    look: { hat: 'police', mustache: true },
    behavior: { type: 'patrol', path: [[-40, 5.8], [46, 5.8], [46, -5.4], [-40, -5.4]], speed: 1.4, wait: 2 },
    barks: () => ['Circolare, circolare.', 'Circolare. Anche i quadrati.', 'Tutto sotto controllo. Credo.', 'Qui non succede mai niente. Mai. Niente.'],
    punchLines: ['Aggressione a pubblico ufficiale! ...Per stavolta chiudo un occhio. Tanto è un puntino.', 'Ehi! Ho una divisa! Cioè, un cappello.'],
    dialogue: {
      name: 'Agente Rossi',
      start: 'start',
      nodes: {
        start: { say: ['Tutto regolare, cittadino?'], choices: rossiMenu },
        menu: { say: ['Altro?'], choices: rossiMenu },
        crimine: {
          say: [
            'Qui a San Scarabocchio il crimine non esiste.',
            'Non abbiamo le mani per rubare.',
            'Una volta un tizio ha disegnato fuori dai bordi. Lo stiamo ancora cercando.',
          ],
          next: 'menu',
        },
        gang: {
          say: [
            '...',
            'Non so di cosa tu stia parlando.',
            'Io vedo in bianco e nero. Per me i colori non esistono. Quindi non esistono gang colorate.',
            'Buona giornata. Circolare.',
          ],
        },
        distintivo: { say: ['Il distintivo si guadagna.', '> Come?', "Non lo so. Il mio l'ho trovato per terra."], next: 'menu' },
      },
    },
  });

  // =========================================================================
  // L'EVIDENZIATORE GIALLO — primo contatto con la gang
  // =========================================================================
  const gialloMenu: Choice[] = [
    { t: 'Cosa ci fai quaggiù?', next: 'qui' },
    { t: 'Conosci un certo Marco?', next: 'marco', if: (g) => g.is('metMarco') },
    { t: "Bel colore. Dove l'hai comprato?", next: 'colore' },
    { t: 'Io vado.', next: 'bye' },
  ];
  g.addNpc({
    id: 'giallo',
    name: 'Evidenziatore Giallo',
    pos: [16.8, 42.5],
    face: [10, 30],
    look: { highlighter: HIGHLIGHT_YELLOW_HEX, hat: 'cap' },
    action: 'crossed',
    barks: () => ['...', 'Cosa guardi?', 'Il giallo è il colore della prudenza. Sii prudente.', 'Mi sto sbiadendo? No. No, vero?'],
    onPunch: (g, n) => {
      if (!g.is('punched_giallo')) {
        n.say('Hai appena colpito un Evidenziatore. Coraggioso. Stupido, ma coraggioso.', 4);
        return;
      }
      n.say('Adesso ti evidenzio io.', 3);
      g.after(0.3, () => {
        g.hurt(20);
        const d = g.player.pos.clone().sub(n.pos).setY(0).normalize();
        g.player.knock.copy(d.multiplyScalar(11));
      });
    },
    dialogue: {
      name: 'Evidenziatore Giallo',
      start: (g) => (g.is('metGiallo') ? 'again' : 'intro'),
      nodes: {
        intro: {
          do: (g) => g.flag('metGiallo'),
          say: [
            'Ehi. Tu. Cosa guardi?',
            '> Sei... giallo.',
            "Si chiama colore, sgorbio. Qualcuno ce l'ha. Qualcuno no.",
            "Io sono l'Evidenziatore Giallo. Quando evidenzio qualcosa, diventa importante.",
            'E quando evidenzio qualcuno... diventa un problema.',
          ],
          choices: gialloMenu,
        },
        again: { say: ["Ancora tu? Ti ho già evidenziato. Non farmi passare all'indelebile."], choices: gialloMenu },
        menu: { say: ['Allora?'], choices: gialloMenu },
        qui: {
          say: ['Aspetto. Qui finisce il disegno. Nessuno ci viene mai.', 'È il posto perfetto per fare cose che non vanno disegnate.'],
          next: 'menu',
        },
        marco: {
          say: [
            'Marco.',
            '* Il giallo diventa leggermente più intenso.',
            'Marco ha una cosa che ci appartiene.',
            "Digli che l'Evidenziatore Giallo lo sta... evidenziando.",
          ],
          next: 'menu',
        },
        colore: {
          say: ['Non si compra. Si conquista.', "Il capo ce l'ha dato quando siamo entrati nella gang.", 'Prima ero come te. Grigio dentro. E anche fuori.'],
          next: 'menu',
        },
        bye: { say: ['Bravo. Vai. E ricorda: ti ho evidenziato.'] },
      },
    },
  });
}
