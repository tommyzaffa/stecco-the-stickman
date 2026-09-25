import type * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';

// Oggetti con cui interagire + monete sparse per la città.

const narr = (lines: string[], extra: Partial<Dialogue> = {}): Dialogue => ({
  name: '',
  start: 'a',
  nodes: { a: { say: lines.map((l) => `* ${l}`) } },
  ...extra,
});

export function createObjects(g: Game) {
  const A = g.world.anchors;
  const obj = (pos: THREE.Vector3, label: string | ((g: Game) => string | null), d: Dialogue | ((g: Game) => Dialogue), radius = 2) =>
    g.addInteractable({
      pos,
      radius,
      label: typeof label === 'string' ? () => label : label,
      use: (g) => g.talk(typeof d === 'function' ? d(g) : d),
    });

  // --- casa -------------------------------------------------------------------
  obj(A.alarm, (g) => (g.quest('c1') === 0 ? 'Spegni la sveglia' : 'Guarda la sveglia'), (g) =>
    g.quest('c1') === 0
      ? {
          name: '',
          start: 'a',
          nodes: {
            a: {
              say: ['* Spegni la sveglia con un colpo deciso.', '* Lei ti fissa. Sa che domani vincerà di nuovo.'],
              do: (g) => {
                g.setStep('c1', 1, true);
                g.after(1.4, () => {
                  g.phone('Marco', 'SVEGLIA. Stasera si esce. Vieni al bar da Gino. NON fare tardi come l\'ultima volta (3 giorni).');
                  g.after(1.2, () => g.toast('Obiettivo: Esci di casa', 'quest'));
                });
              },
            },
          },
        }
      : narr(["La sveglia segna le 7:00. Segna sempre le 7:00. Ha solo quell'ora disegnata."]),
  );

  obj(A.fridge, 'Apri il frigo', (g) =>
    g.is('lemonEaten')
      ? narr(['Il frigo è vuoto.', "Anche la tua anima, ma questo è un altro discorso."])
      : {
          name: '',
          start: 'a',
          nodes: {
            a: {
              say: ['* Apri il frigo.', "* Dentro c'è un limone. Solo un limone.", '* Il limone ti guarda. Tu guardi il limone.'],
              choices: [{ t: 'Mangia il limone (+10 salute)', next: 'eat' }, { t: 'Chiudi il frigo con dignità.' }],
            },
            eat: {
              do: (g) => {
                g.flag('lemonEaten');
                g.heal(10);
              },
              say: ['* Hai mangiato un limone intero. Con la buccia.', '* Rimpianti: molti. Vitamina C: tantissima.'],
            },
          },
        },
  );

  obj(A.tv, 'Guarda la TV', narr(['La TV trasmette una linea orizzontale.', 'Da tre anni.', 'Non riesci a smettere di guardarla. È il programma migliore della settimana.']));
  obj(A.mirror, 'Guardati allo specchio', narr(['Ti guardi allo specchio.', 'Un cerchio. Qualche linea.', 'Bellissimo. Come sempre.']));
  obj(A.plant, 'Annaffia la pianta', narr(["Una pianta disegnata. Non ha bisogno d'acqua.", 'La annaffi lo stesso, per affetto.', 'Lei non ricambia. È una pianta.']));
  obj(A.bed, (g) => (g.quest('c1') >= 1 ? 'Torna a letto' : null), narr(['Potresti tornare a dormire.', 'Ma poi il gioco durerebbe trenta secondi. Non è il caso.']));
  obj(A.mailbox, 'Apri la cassetta della posta', narr(["Nella cassetta c'è una bolletta.", '"Bolletta inchiostro, mese di settembre."', 'Salata. Ogni linea che disegni costa.']));

  // --- città --------------------------------------------------------------------
  obj(A.statue, 'Leggi la targa', narr(['Sulla targa c\'è scritto: "Al Sindaco, con affetto. Firmato: il Sindaco".']));
  obj(A.fountain, 'Guarda la fontana', narr(["Una fontana. L'acqua è fatta di linee ondulate.", 'Non bagna. Che delusione.']), 2.6);
  obj(A.clubDoor, 'Leggi il cartello', narr(['CHIUSO (il martedì).', 'Sotto, a matita: "anche il mercoledì se piove".']), 2.6);
  obj(A.edgeSign, 'Leggi il cartello', narr(['FINE DEL DISEGNO.', '"L\'autore ha finito la matita. Si prega di non proseguire."', 'Oltre il cartello c\'è solo carta bianca. Tanta. Troppa.']), 2.6);
  obj(A.unfinished, "Guarda l'edificio", narr(['Un edificio mai finito. Si vedono ancora le linee di costruzione.', 'Qualcuno ha scritto "finire dopo".', 'Il dopo non è mai arrivato.']), 3);
  obj(A.car, 'Guarda la macchina', narr(['Una macchina parcheggiata.', 'Non ha il motore. Nessuna ce l\'ha.', 'Il traffico a San Scarabocchio è molto tranquillo.']), 2.8);

  obj(A.busSign, 'Leggi gli orari', (g) => ({
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: ['* ORARI LINEA 12:', '* "L\'autobus passa quando smetti di aspettarlo."', '* Firmato: il Comune.'],
        do: (g) => {
          if (g.quest('bus') === 0) g.setStep('bus', 1);
        },
      },
    },
  }));

  // --- monete sparse --------------------------------------------------------------
  g.addCoin(-47, 24.6, 'Una moneta nel cortile. Probabilmente tua. Adesso sicuramente tua.');
  g.addCoin(38, -24.7, 'Una moneta vicino alla fontana. Qualcuno ha espresso un desiderio. Ora il desiderio è tuo.');
  g.addCoin(39, 23.5, 'Dietro la banca. La banca non se ne accorgerà: non ha mai contato.');
  g.addCoin(13.5, 45.4, "Una moneta alla fine del disegno. L'autore l'ha dimenticata qui.");
  g.addCoin(24.5, -48.2, "Nell'angolo del parco, tra l'erba disegnata.");
  g.addCoin(-9.5, 16, 'Una moneta in un vicolo. Un classico.');
}
