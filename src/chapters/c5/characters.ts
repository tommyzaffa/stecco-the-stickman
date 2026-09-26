import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Stickman } from '../../entities/stickman';
import { CERA, THEME } from '../../render/palette';

// ---------------------------------------------------------------------------
// Fuori: Marco (con le prove della cena), la fioraia, il maître alla porta.
// Dentro: Martina, "Marcello" il cameriere (Marco coi baffi), il violinista, i clienti.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const ROSA_PASTELLO = '#f4a3c4';

function violin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.05).translate(0, -0.1, 0), new THREE.MeshBasicMaterial({ color: '#b5763c' }));
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.45, 0.01).translate(0, -0.2, 0.05), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
  g.add(body, bow);
  return g;
}

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];

  // =========================================================================
  // MARCO (fuori): il piano, e le prove (risposte a tempo)
  // =========================================================================
  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marcoStart'),
    face: [0, -8],
    look: { hat: 'cap' },
    icon: (g) => (g.quest('prove') === -1 ? 'side' : null),
    barks: () => ['Io qui non ci sono.', 'Ricordati: sii te stesso. Ma meglio.', 'Ho un travestimento. Non ti dico quale.', 'Tutti i Pastelli di Quadropoli mangiano qui. Che bello. Che paura.'],
    dialogue: {
      name: 'Marco',
      start: (g) => (g.quest('prove') === -1 ? 'piano' : 'dopo'),
      nodes: {
        piano: {
          say: [
            'Eccoci. "Da Pastello". Il ristorante più romantico del quartiere dei Pastelli a Cera.',
            '> Il quartiere di quelli che ieri ci hanno sparato.',
            'Appunto: nessuno si aspetta di vederci qui. È il posto più sicuro del mondo. O il meno.',
            'Il piano. Primo: sii te stesso. Secondo: se non funziona, sii qualcun altro. Terzo: io ci sono, ma non ci sono.',
            '> Cioè?',
            'Ho un travestimento. Non ti dico quale, sennò che travestimento è.',
            '> Marco. Tu non entri.',
            'Certo che no. Io sto qui fuori. Tipo. Più o meno. Dentro.',
          ],
          choices: [
            { t: 'Facciamo le prove della cena?', next: 'prove', do: (g) => g.startQuest('prove') },
            { t: 'Ok. Vado.', next: 'vai' },
          ],
        },
        vai: { say: ['Vai, campione. Il maître è alla porta. È bianco, ma si vede.'] },
        dopo: { say: [pick(['Vai! Io ci sono. Cioè no.', 'Se ti serve un cameriere, fischia. Cioè no, non fischiare.', 'Il maître è alla porta. Vai!'])] },
        // le prove: Marco fa Martina (e insegna le risposte a tempo)
        prove: {
          say: [
            '* Marco si mette una mano sul fianco. Non ha la mano. Si mette il braccio sul fianco.',
            'Ciao, sono Martina. Sono una matita colorata. Rosa. Adesso ti faccio una domanda, e hai poco tempo per rispondere.',
            'Se ci pensi troppo, stai zitto. Pronto? Qual è il tuo colore preferito?',
          ],
          timer: 6,
          timeout: 'p0',
          choices: [
            { t: 'Il rosa.', next: 'p1' },
            { t: 'Non ho colori. Sono in bianco e nero.', next: 'p2' },
            { t: "Il blu dell'inchiostro.", next: 'p3' },
          ],
        },
        p0: { say: ['> ...', 'Troppo tardi! Hai pensato troppo! Martina si annoia! Cioè: io mi annoio!'], next: 'lezione' },
        p1: { say: ['Ruffiano. A Martina non piacciono i ruffiani. Credo. Io sono Martina e non mi piaci.'], next: 'lezione' },
        p2: { say: ['Sincero! Bello! Mi sciolgo! Come la cera!'], next: 'lezione' },
        p3: { say: ['Blu. Come la pistola. Romantico e pericoloso.'], next: 'lezione' },
        lezione: {
          say: [
            'Hai visto? Certe domande hanno il tempo. Se non rispondi, stai zitto.',
            'E a volte stare zitti è la cosa giusta.',
            '> Davvero?',
            "Non lo so. L'ho letto in un biscotto della fortuna. Però era un biscotto molto sicuro di sé.",
            'Ultima cosa: sii sincero. E un po\' scemo. Quello ti viene naturale.',
          ],
          do: (g) => {
            g.flag('provato');
            g.completeQuest('prove');
            g.addXp(20);
            g.toast('Ti senti più sciolto: <b>l\'interesse di Martina parte un po\' più alto</b>.', 'reward', 5000);
          },
        },
      },
    },
  });

  // =========================================================================
  // LA FIORAIA (un fiore per Martina)
  // =========================================================================
  g.addNpc({
    id: 'fioraia',
    name: 'Fioraia',
    pos: at('fioraia'),
    face: [0, -24],
    look: { highlighter: '#b9a0e6', hat: 'crayon' },
    icon: (g) => (!g.has('fiore') && g.quest('fiore') !== 999 ? 'side' : null),
    barks: () => ['Fiori disegnati! Non appassiscono!', 'Fiori per la serata! Anche per le serate andate male!'],
    dialogue: {
      name: 'Fioraia',
      start: (g) => (g.has('fiore') ? 'hai' : 'a'),
      nodes: {
        a: {
          do: (g) => g.quest('fiore') === -1 && g.startQuest('fiore'),
          say: ['Fiori disegnati! Non appassiscono, non profumano e costano quasi niente. Sei monete.'],
          choices: [
            { t: 'Uno, per favore. (6 monete)', if: (g) => g.state.coins >= 6, next: 'compra' },
            { t: 'Non ho monete. Ho solo un appuntamento.', next: 'gratis' },
            { t: 'Solo guardavo.' },
          ],
        },
        compra: {
          say: ['Ecco. Tienilo dritto: i fiori disegnati si offendono se li pieghi.'],
          do: (g) => {
            g.addCoins(-6);
            g.give('fiore');
            g.completeQuest('fiore');
          },
        },
        gratis: {
          say: ['Un appuntamento? Con chi?', '> Con una matita colorata. Rosa.', 'Martina? Quella dei tappi?', '...Tieni. Gratis. Ma se la fai piangere torno a riprendermelo. E anche qualcos\'altro.'],
          do: (g) => {
            g.give('fiore');
            g.completeQuest('fiore');
          },
        },
        hai: { say: ['Hai già un fiore. Due fiori sono troppi: sembra che ti scusi di qualcosa.'] },
      },
    },
  });

  // =========================================================================
  // IL PASTELLO BIANCO, maître
  // =========================================================================
  g.addNpc({
    id: 'bianco',
    name: 'Pastello Bianco',
    pos: at('maitre'),
    face: [0, -20],
    look: { highlighter: '#ffffff', hat: 'crayon', tie: true },
    icon: (g) => (g.quest('c5') === 0 ? 'main' : null),
    barks: () => ['Prenotazione?', 'Da Pastello: cucina a cera.', 'Qui la carta è scura apposta. Sennò non mi vedrebbe nessuno.'],
    dialogue: {
      name: 'Pastello Bianco',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Buonasera. Sono il Pastello Bianco, il maître.',
            "Sì, mi vedete. Qui la carta è scura apposta: è l'unico posto dove esisto.",
            'Prenotazione?',
            '> Martina.',
            '"Martina più uno." Lei è l\'uno?',
            "> Sono l'uno.",
            "Un uno un po' scarabocchiato. Mh. Mi sembra di averla già vista.",
            '> Tutti gli omini stilizzati sono uguali.',
            'Vero. È il vostro dramma.',
          ],
          next: (g) => (g.has('pistola') || g.has('righello') ? 'armi' : 'entra'),
        },
        armi: {
          say: [
            'Le armi si lasciano al guardaroba. Qui si spara solo il pepe.',
            '* Consegni tutto. Il maître lo appende tra i cappotti, accanto a due temperini e un compasso.',
          ],
          next: 'entra',
        },
        entra: {
          say: ['La signorina la aspetta. Prego.'],
          do: (g) => g.flag('entra'),
        },
      },
    },
  });
  if (g.npc('bianco').body instanceof Stickman) {
    // il maître ha un tovagliolo sul braccio
    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.14).translate(0, -0.1, 0), new THREE.MeshBasicMaterial({ color: '#f2e3cf' }));
    (g.npc('bianco').body as Stickman).prop.add(towel);
  }

  // =========================================================================
  // DENTRO
  // =========================================================================
  g.addNpc({
    id: 'martina',
    name: 'Martina',
    pos: at('martina'),
    face: [0, 0],
    behavior: { type: 'sit' },
    look: { highlighter: ROSA_PASTELLO, hat: 'pencil', eyes: true },
    faceWhenNear: false,
    barks: () => [],
  });
  g.npc('martina').homeRot = Math.PI;

  // "Marcello": Marco coi baffi finti
  g.addNpc({
    id: 'marcello',
    name: 'Marcello',
    pos: [A.kitchen.x, A.kitchen.z],
    look: { hat: 'cap', mustache: true },
    hidden: true,
    barks: () => [],
  });

  const vio = g.addNpc({
    id: 'violinista',
    name: 'Violinista',
    pos: at('violinist'),
    look: { highlighter: '#47a7d8', hat: 'crayon' },
    behavior: { type: 'patrol', path: [[3, 10.5], [-3, 9], [4, 7]], speed: 0.8, wait: 3 },
    action: 'violin',
    faceWhenNear: false,
    barks: () => ['♪ La la laaa ♪', '♪ Tirititì ♪', 'Accetto mance. Anche in cera.'],
  });
  if (vio.body instanceof Stickman) vio.body.prop.add(violin());

  // clienti: coppie di Pastelli a cena
  const colors = [CERA.rosso, CERA.verde, CERA.arancione, CERA.blu, CERA.marrone, '#c99a2e', '#47a7d8', CERA.viola, '#34302c', '#e8e2d0', CERA.rosso, CERA.verde];
  const lines = [
    ['Questa cera fusa è divina.', 'Hai sentito? Ieri al Mercato Nero...', 'Io mi sono spuntato apposta per stasera.'],
    ['Amore, mi passi il sale? Cioè, lo zucchero. Cioè, la cera.', 'Che bel violino. Sembra un gatto.', 'Guarda quei due. Uno è grigio!'],
    ['Io da piccolo ero un pastello da spiaggia.', 'Non si colora fuori dai bordi a tavola.', 'Il maître oggi è pallidissimo.'],
  ];
  for (let i = 0; i < 6; i++) {
    for (const side of ['a', 'b'] as const) {
      const k = i * 2 + (side === 'a' ? 0 : 1);
      const p = A[`t${i}${side}`];
      g.addNpc({
        id: `cliente${i}${side}`,
        name: 'Cliente',
        pos: [p.x, p.z],
        face: [p.x, p.z + (side === 'a' ? 1 : -1)],
        behavior: { type: 'sit' },
        look: { highlighter: colors[k], hat: k % 3 === 0 ? 'crayon' : k % 3 === 1 ? 'bun' : 'crayon' },
        action: k % 4 === 0 ? 'drink' : 'none',
        faceWhenNear: false,
        barks: () => lines[k % 3],
      });
    }
  }
}
