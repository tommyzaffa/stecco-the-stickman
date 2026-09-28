import type { Game } from '../../game/game';
import { keyName } from '../../settings';
import { TOUCH } from '../../touch';
import { Q7 } from './quests';
import { CARRY } from './carry';

// ---------------------------------------------------------------------------
// Capitolo 7: Nonna Pina (e Pallino), Marco, i Fratelli Squadra col furgone, il signor Tacchetto
// del piano terra, Arturo che indaga e l'unico rimasto del Vicolo Storto.
// ---------------------------------------------------------------------------

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function createCharacters(g: Game) {
  const A = g.world.anchors;
  const at = (id: string): [number, number] => [A[id].x, A[id].z];

  g.addNpc({
    id: 'marco',
    name: 'Marco',
    pos: at('marco'),
    face: [0, 8],
    look: { hat: 'cap' },
    barks: () => (CARRY.current ? [] : ['Io sono il motore. Tu sei lo sterzo.', 'Il divano mi guarda male.', 'Traslocare è come ballare. Ma con un armadio.']),
    dialogue: {
      name: 'Marco',
      start: (g) => (g.quest('c7') <= 0 ? 'a' : 'b'),
      nodes: {
        a: {
          say: [
            'Nonna Pina trasloca. Ha chiamato noi perché siamo giovani e forti.',
            '> Io sono giovane.',
            'E io sono forte. Insieme siamo una persona intera.',
            'Vai da lei, è davanti al portone. Io intanto mi scaldo. Guardo il furgone. Il furgone guarda me.',
          ],
        },
        b: { say: [pick(['Quando vuoi, sollevo. Tu dici "su" e io dico "su". Poi vediamo.', 'Pivot. Me lo sono segnato: pivot.', 'Io tengo il capo pesante. Tu quello leggero. Sono tutti e due pesanti.'])] },
      },
    },
  });

  g.addNpc({
    id: 'pina',
    name: 'Nonna Pina',
    pos: at('pina'),
    face: [4, 0],
    look: { hat: 'bun' },
    action: 'cane',
    icon: (g) => (g.quest('c7') === 0 || g.quest('c7') === 3 || (g.has('album') && g.questActive('album')) ? 'main' : null),
    barks: () => ['Piano con le scale! Sono vecchie. Come me.', 'Pallino, non fare pipì sul furgone.', 'Via della Penna. Là non cancella nessuno.'],
    dialogue: {
      name: 'Nonna Pina',
      start: (g) => (g.has('album') && g.questActive('album') ? 'album' : g.quest('c7') === 0 ? 'a' : g.quest('c7') === 3 ? 'saluti' : 'dopo'),
      nodes: {
        a: {
          say: [
            'Stecco! Grazie di essere venuto. Anche tu, Marco. Tu un po\' meno.',
            '> Nonna Pina, perché traslocate?',
            'Hai visto il vicolo qui accanto? Il Vicolo Storto.',
            '> Quale vicolo?',
            'Appunto. Ieri sera c\'era. Stamattina no. Cancellato: case, lampioni, il signor Brando col suo canarino.',
            'Io qui non ci resto. Vado in Via della Penna, dall\'altra parte del paese.',
            'Là è tutto a penna. La gomma non ci fa niente.',
            '> E i mobili?',
            'Li portate giù voi. I Fratelli Squadra hanno il furgone, ma non caricano: hanno gli angoli retti, non si piegano.',
            'Sono quattro: la poltrona, la scala, l\'armadio e il divano. Gli scatoloni li porto io con Pallino. Pallino porta quelli piccoli.',
            'Primo piano. Le scale sono strette. Il divano non è mai uscito di casa: è nato lì dentro.',
          ],
          do: (g) => {
            g.setStep('c7', 1);
            g.npc('marco').setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2.4, speed: 3.6 });
            g.toast(
              TOUCH
                ? 'Tu tieni un capo, Marco l\'altro. Il mobile gira con la visuale: se sbatte, torna un po\' indietro e giralo.'
                : `Tu tieni un capo, Marco l'altro. Il mobile gira con la visuale (mouse): se sbatte, torna un po' indietro e giralo. ${keyName('jump')} mette in piedi il divano.`,
              'quest',
              8000,
            );
          },
        },
        dopo: {
          say: [
            pick([
              'Il divano non girarlo a sinistra. Si offende. Si piega solo a destra.',
              'La scala è lunga. Sulle scale, falla passare sopra la ringhiera: lì c\'è spazio.',
              'L\'armadio fa l\'angolo. Anche nelle curve.',
              `Ne mancano ${4 - Q7.delivered}. Io intanto conto gli scatoloni. Sono tanti. Ne ho contati uno.`,
            ]),
          ],
        },
        album: {
          say: [
            'Il mio album! Dov\'era?',
            '> Nell\'armadio. È caduto quando l\'abbiamo sollevato.',
            'Guarda qui: questa sono io da giovane. Ero disegnata meglio: avevano appena temperato la matita.',
            'E questo è il mio primo Pallino. E questo il secondo. Questo è Pallino Secondo. Non sono bravissima coi nomi.',
            'Tieni, per il disturbo. E non dire a nessuno che da giovane avevo il naso.',
          ],
          do: (g) => {
            g.take('album');
            g.addCoins(15);
            g.addXp(30);
            g.completeQuest('album');
          },
        },
        saluti: {
          say: [
            'Tutto dentro. Anche il divano. Non pensavo che uscisse vivo di lì.',
            '@Marco| Nemmeno io. Nemmeno lui.',
            'Grazie, ragazzi. Venite a trovarmi in Via della Penna. Là è tutto più... definitivo.',
            '> Nonna Pina. E se arriva anche là?',
            'Allora vorrà dire che non è una gomma. È qualcos\'altro.',
            '* Pallino abbaia verso il Vicolo Storto. Verso il niente.',
            '@Il signor Goniometro| Si parte! Novanta gradi a destra, poi dritti!',
          ],
          do: (g) => {
            g.addCoins(30);
            g.addXp(60);
            g.flag('c7Parte');
          },
        },
      },
    },
  });
  g.addNpc({ id: 'pallino', name: 'Pallino', pos: [A.pina.x + 1.2, A.pina.z - 0.8], dog: true, behavior: { type: 'circle', cx: A.pina.x + 0.8, cz: A.pina.z - 1.2, r: 1.1, speed: 1.1 }, barks: () => ['Bau.', 'Bau?'] });

  // i Fratelli Squadra: misurano, non sollevano
  g.addNpc({
    id: 'squadra',
    name: 'Il signor Squadra',
    pos: at('squadra'),
    face: [0, 4],
    look: { hat: 'top', tie: true },
    action: 'crossed',
    barks: () => ['Novanta gradi. Sempre.', 'Io misuro. Mio fratello misura gli angoli. Nessuno dei due solleva.', 'Il furgone è rettangolare. Come la vita.'],
    dialogue: {
      name: 'Il signor Squadra',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Fratelli Squadra, traslochi. Io sono Squadra. Lui è Goniometro: è adottato.',
            '> Ci date una mano?',
            'Non possiamo piegarci: siamo ad angolo retto. È una questione di geometria, non di pigrizia.',
            'Però guidiamo. E misuriamo. Il cassone è cinque per nove: ci sta tutto, se ci sta.',
          ],
        },
      },
    },
  });
  g.addNpc({
    id: 'goniometro',
    name: 'Il signor Goniometro',
    pos: at('goniometro'),
    face: [4, 0],
    look: { hat: 'beret', mustache: true },
    barks: () => ['Ruota! Novanta gradi alla volta!', 'Ottantanove non è novanta.', 'Se non entra, giralo. Se non entra ancora, giralo di più.'],
    dialogue: {
      name: 'Il signor Goniometro',
      start: 'a',
      nodes: {
        a: {
          say: [
            'Il cassone del furgone è un incastro: tutto quello di Nonna Pina ci entra preciso. Non avanza una casella.',
            'Se non ci sta, giralo. Se ancora non ci sta, giralo di più. Novanta gradi alla volta.',
            'E se proprio non va, premi AIUTO: ti faccio vedere io dove va. Con l\'angolo giusto.',
          ],
        },
      },
    },
  });

  // il signor Tacchetto (piano terra): vuole silenzio. E il suo gatto.
  g.addNpc({
    id: 'tacchetto',
    name: 'Il signor Tacchetto',
    pos: at('tacchetto'),
    face: [3, 0],
    look: { hat: 'hair', mustache: true },
    action: 'crossed',
    icon: (g) => (g.quest('gatto') === 1 ? 'turnin' : g.is('gattoCaricato') && g.quest('gatto') === -1 ? 'side' : null),
    barks: (g) => (g.is('gattoCaricato') && !g.questDone('gatto') ? ['Micio! Micio! Dov\'è il mio gatto?', 'Qualcuno ha visto un gatto? Sembra un cane. È disegnato male.'] : ['SILENZIO!', 'Ci sono persone che dormono. Io. Io dormo.', 'Ogni botta sulle scale, un anno di vita. Mia.']),
    dialogue: {
      name: 'Il signor Tacchetto',
      start: (g) => (g.quest('gatto') === 1 ? 'grazie' : g.is('gattoCaricato') && g.quest('gatto') === -1 ? 'gatto' : g.questDone('gatto') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            'Voi siete quelli del trasloco. Quelli che sbattono.',
            '> Cerchiamo di non sbattere.',
            'Cercate meglio. Io abito sotto. Ogni volta che il divano tocca il muro, a me cade un quadro. Ho finito i quadri.',
          ],
        },
        gatto: {
          say: [
            'Il mio gatto! Era sul marciapiede un attimo fa. Adesso non c\'è.',
            '* Da qualche parte, nel furgone, qualcosa miagola. Con la voce di un cane.',
            'È un gatto. Sembra un cane perché è disegnato male. Non diteglielo: si offende.',
          ],
          do: (g) => g.startQuest('gatto'),
        },
        grazie: {
          say: ['Micio! Eccoti!', '* Il gatto guarda Tacchetto. Tacchetto guarda il gatto. Nessuno dei due dice bau.', 'Grazie. Per stavolta, fate pure rumore. Un po\'.'],
          do: (g) => {
            g.addCoins(10);
            g.addXp(25);
            g.completeQuest('gatto');
          },
        },
        dopo: { say: ['Silenzio. Ma poco. Oggi è un giorno speciale.'] },
      },
    },
  });
  g.addNpc({ id: 'gatto', name: 'Il gatto', pos: [A.tacchetto.x + 1.2, A.tacchetto.z - 0.4], dog: true, hidden: true, barks: () => ['Miao. Cioè bau. Cioè miao.'] });

  // Arturo: da quando non ha la panchina, cammina e indaga
  g.addNpc({
    id: 'filosofo',
    name: 'Arturo il Filosofo',
    pos: at('filosofo'),
    face: [-20, 3],
    look: { beard: true },
    action: 'think',
    icon: (g) => (g.quest('vicolo') === -1 || g.quest('vicolo') === 2 ? 'side' : null),
    barks: () => ['Da quando non ho la panchina, cammino. E camminando, indago.', 'Prima una panchina, poi un vicolo. Qualcuno sta facendo pulizia.'],
    dialogue: {
      name: 'Arturo',
      start: (g) => (g.quest('vicolo') === -1 ? 'a' : g.quest('vicolo') === 2 ? 'fine' : g.questDone('vicolo') ? 'dopo' : 'intanto'),
      nodes: {
        a: {
          say: [
            'Stecco. Prima la mia panchina, adesso un vicolo intero. Qualcuno sta facendo pulizia.',
            'Io non posso entrare lì: se cammino sul niente, poi non so dove sono. Tu sei giovane: sai sempre dove sei, anche quando non lo sai.',
            'C\'è uno che è rimasto. Quello con la porta. Parlagli, e guarda cosa è rimasto. Poi torna da me.',
          ],
          do: (g) => g.startQuest('vicolo'),
        },
        intanto: { say: ['Guarda bene. Le cose cancellate lasciano sempre qualcosa. Come le persone.'] },
        fine: {
          say: [
            '> Il signor Stipite dice che ha sentito strofinare. E le briciole sanno di fragola.',
            'Fragola.',
            'Allora non è una gomma qualunque. È una gomma per bambini.',
            'O per qualcuno che si crede ancora un bambino. Quelli sono i più pericolosi: cancellano senza pensarci.',
            'Tieni. Un pensiero. Non vale niente, ma pesa tanto.',
          ],
          do: (g) => {
            g.addXp(40);
            g.addCoins(10);
            g.flag('indagineVicolo');
            g.completeQuest('vicolo');
          },
        },
        dopo: { say: ['Fragola. Ci penso da stamattina. Mi è venuta fame.'] },
      },
    },
  });

  g.addNpc({
    id: 'stipite',
    name: 'Il signor Stipite',
    pos: at('superstite'),
    face: [-20, 12],
    look: { hat: 'beanie' },
    barks: () => ['La porta è rimasta. Io anche. Il resto no.', 'Qualcuno ha visto la mia casa? È dietro questa porta. Era.'],
    dialogue: {
      name: 'Il signor Stipite',
      start: (g) => (g.quest('vicolo') === 0 ? 'a' : 'b'),
      nodes: {
        a: {
          say: [
            'Ero sulla porta. Stavo uscendo a buttare la spazzatura.',
            'La porta è rimasta. Io anche. Il resto no.',
            '> Cosa ha visto?',
            'Niente. Era buio. Ho sentito strofinare. Tipo una gomma sul quaderno, ma grande. Grande come una casa. Anzi di più: le case le ha cancellate.',
            'E un profumo. Dolce. Di fragola.',
            '> Fragola?',
            'Le gomme alla fragola. Quelle delle elementari. Io non la mangiavo. Gli altri sì.',
            'Se vuoi vedere, per terra ci sono ancora le briciole. Rosa. Lì, tra la mia porta e il cartello.',
          ],
          do: (g) => g.setStep('vicolo', 1),
        },
        b: { say: ['Io resto qui. Se torna la casa, voglio essere il primo a entrare.'] },
      },
    },
  });
}
