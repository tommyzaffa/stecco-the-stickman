import type { Game } from '../../game/game';
import type { NPC } from '../../entities/npc';
import type { StickmanOpts } from '../../entities/stickman';
import { CHAIRS } from './world';
import { CHECK, Q11, curCheck } from './quests';
import { OFF, hhmm } from './office';

// ---------------------------------------------------------------------------
// Capitolo 11: chi c'è all'Ufficio Protocollo. L'usciere (il signor Fila), le quattro persone dietro
// i vetri (Cartella alle Residenze, Spillatrice al Protocollo, Tampona ai Timbri, il signor Spiccioli
// alla Cassa), il signor Attesa (prima fila, senza occhiali), l'Ispettore Penna (in fila anche lui) e
// i clienti: si siedono, aspettano, vanno allo sportello, se ne vanno, tornano.
// ---------------------------------------------------------------------------

export const CUSTOMERS: { id: string; name: string; look: StickmanOpts }[] = [
  { id: 'cliente0', name: 'La signora Busta', look: { hat: 'bun' } },
  { id: 'cliente1', name: 'Il signor Graffetta', look: { hat: 'cap', mustache: true } },
  { id: 'cliente2', name: 'La signora Ricevuta', look: { hat: 'hair' } },
  { id: 'cliente3', name: 'Il signor Codice', look: { tie: true } },
  { id: 'cliente4', name: 'La signorina Allegato', look: { hat: 'beret' } },
  { id: 'cliente5', name: 'Il signor Bollino', look: { hat: 'top', beard: true } },
  { id: 'cliente6', name: 'La signora Copia', look: { hat: 'bun', scale: 0.92 } },
  { id: 'cliente7', name: 'Il signor Delega', look: { hat: 'beanie' } },
  { id: 'cliente8', name: 'Il signor Fotocopia', look: { tie: true, mustache: true } },
];

const MOANS = [
  'Sono qui per rinnovare il rinnovo.',
  'Ho preso il numero ieri. Vale anche oggi?',
  'Mi hanno chiesto la fotocopia della fotocopia.',
  'Il 27-B? Esaurito dal giorno in cui l\'hanno stampato.',
  'Sportello sbagliato. Lo sapevo dal numero.',
  'Dicono che alla Cassa accettino anche i sorrisi. Io non ho la bocca.',
  'Ogni volta che vado in bagno chiamano il mio numero.',
  'Avevo un appuntamento alle nove. Sono le... ah. Le nove e un quarto di vita.',
  'Mi serve un modulo per sapere quale modulo mi serve.',
  'Ho la marca da bollo, ma non ho più il modulo. Ho il bollo di niente.',
  'Il tabellone è fermo da un\'ora. Il mio orologio no.',
  'In fila si fa amicizia. Poi chiamano uno dei due, e finisce lì.',
];

export function createCharacters(g: Game): NPC[] {
  const A = g.world.anchors;

  // --- l'usciere, il signor Fila: all'ingresso, sa tutto (lo ripete volentieri) ---
  g.addNpc({
    id: 'usciere',
    name: 'Il signor Fila',
    pos: [A.usciere.x, A.usciere.z],
    face: [A.usciere.x - 1, A.usciere.z - 3],
    look: { hat: 'cap', mustache: true, tie: true },
    action: 'crossed',
    barks: () => ['Numero, prego. Senza numero non si esiste.', 'Le pause sono scritte sul muro. Anche le mie.', 'Si prega di non avere fretta. La fretta rallenta.'],
    dialogue: {
      name: 'Il signor Fila',
      start: (g) => (g.is('c11Consegna') ? 'fine' : 'a'),
      nodes: {
        a: {
          say: [
            (g) => {
              const i = curCheck(g);
              return i >= CHECK.length ? 'Ha fatto tutto? Allora può andare. Piano, però: qui si corre solo verso la fila.' : `Adesso le serve questo: ${CHECK[i].text(g).replace(/^./, (c) => c.toLowerCase())}.`;
            },
            (g) => {
              const m = OFF.min;
              if (m < 60) return 'Alle dieci Tampona va in pausa caffè: venti minuti, più il viaggio. Se le serve un timbro, prima.';
              if (m < 90) return 'Lo sportello A apre alle dieci e mezza. Puntuale come un ritardo.';
              if (m < 120) return 'Alle undici Spillatrice va in pausa merenda. Non la disturbi: morde.';
              if (m < 150) return 'Alle undici e mezza la Cassa chiude per contare i soldi. Li conta due volte, per sicurezza. Tre, per tradizione.';
              return `Sono le ${hhmm(m)}. Lo sportello A chiude a mezzogiorno. Mezzogiorno non aspetta nessuno: è l'unico.`;
            },
          ],
        },
        fine: {
          say: ['Residenza registrata? Complimenti. L\'ho visto fare tre volte. Una ero io.'],
        },
      },
    },
  });

  // --- dietro i vetri ---
  const clerk = (id: string, name: string, look: StickmanOpts, barks: string[]) =>
    g.addNpc({ id, name, pos: [0, -7.85], look, behavior: { type: 'sit' }, faceWhenNear: false, barks: () => barks });
  clerk('cartella', 'Signora Cartella', { hat: 'bun' }, ['Residenze. Si risiede qui.', 'Le residenze si consegnano entro le dodici. Dopo, si è residenti di domani.']);
  clerk('spillatrice', 'Signora Spillatrice', { hat: 'hair' }, ['Protocollo! Tutto si protocolla. Anche il protocollo.', 'TAC. Pinzato. Non si stacca più.']);
  clerk('tampona', 'Signora Tampona', { hat: 'bun', scale: 1.05 }, ['Timbri! Tondi, quadri, rettangolari. Quelli a stella li ho finiti.', 'Senza caffè il timbro viene storto. Con il caffè, anche: ma più veloce.']);
  clerk('spiccioli', 'Il signor Spiccioli', { hat: 'beret', mustache: true }, ['Cassa. Si paga qui. Anche per chiedere quanto si paga.', 'Il resto non si dà. Si promette.']);

  // --- il signor Attesa: prima fila, senza occhiali (aspetta lo sportello A da sempre) ---
  const at = g.addNpc({
    id: 'attesa',
    name: 'Il signor Attesa',
    pos: [A.attesa.x, A.attesa.z],
    face: [A.attesa.x, A.attesa.z - 3],
    look: { hat: 'top', beard: true },
    behavior: { type: 'sit' },
    barks: (g) => (g.is('c11Occhiali') ? [] : ['Che numero c\'è sull\'A? Non ci vedo.', 'Senza occhiali i numeri sembrano tutti un uno. Anche l\'otto.', 'Aspetto. È la cosa che mi riesce meglio.']),
  });
  at.homeRot = Math.PI;

  // --- l'Ispettore Penna: in fila anche lui (è la legge) ---
  const [px, pz] = CHAIRS.find(([x, z]) => x === 7.5 && z === 4.2)!;
  const pe = g.addNpc({
    id: 'penna',
    name: 'Ispettore Penna',
    pos: [px, pz],
    face: [px, pz - 3],
    look: { hat: 'police', mustache: true },
    behavior: { type: 'sit' },
    barks: () => ['Anche la polizia fa la fila. È la legge. La legge sono io.', 'Ho preso il numero per domani. Così domani sono il primo.'],
    dialogue: {
      name: 'Ispettore Penna',
      start: (g) => (g.is('c11Penna') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Stecco. Non la arresto: sono in fila. In fila siamo tutti uguali, tranne chi ha il numero più basso.',
            '> Cosa ci fa qui, Ispettore?',
            'Pago una multa. A me stesso. Ho parcheggiato in doppia fila... nella fila.',
            'E intanto tengo d\'occhio l\'archivio. Ultimamente spariscono le cose: una via, una fontana, tre case. E poi spariscono anche le pratiche delle cose.',
            'Senza pratica, una cosa sparita non è mai esistita. È burocraticamente perfetto. Mi fa venire i brividi. Di ammirazione.',
          ],
          choices: [
            { t: 'Chi le fa sparire?', next: 'chi' },
            { t: 'Buona fila, Ispettore.', next: 'fine' },
          ],
        },
        chi: {
          say: [
            'Non lo so. Ma chi cancella lascia le briciole. Rosa. E profumano di fragola. L\'ho scritto nel verbale, e il verbale... è sparito.',
            'Se trova qualcosa di strano, me lo dica. Con un modulo, possibilmente.',
          ],
          next: 'fine',
        },
        fine: {
          say: ['Ah, Stecco: tenga. Le ho trovate sotto la sedia. Non le metto a verbale: sono troppo poche.'],
          do: (g) => {
            g.flag('c11Penna');
            g.addCoins(10);
            g.addXp(15);
          },
        },
        dopo: {
          say: [(g) => (g.is('c11Archivio') ? 'Ha visto l\'archivio? Non me lo dica. Me lo scriva. Anzi, no: le cose scritte spariscono.' : 'Sono ancora in fila. Il mio numero è per domani. Sto facendo pratica.')],
        },
      },
    },
  });
  pe.homeRot = Math.PI;

  // --- i clienti (li muove l'ufficio: si siedono, vanno allo sportello, se ne vanno, tornano) ---
  return CUSTOMERS.map((c, i) => {
    const moans = MOANS.slice(i % 4).concat(MOANS.slice(0, i % 4)).filter((_, k) => k % 3 === i % 3);
    return g.addNpc({ id: c.id, name: c.name, pos: [0, 12], look: c.look, behavior: { type: 'sit' }, faceWhenNear: false, barks: () => (Q11.started ? moans : []) });
  });
}
