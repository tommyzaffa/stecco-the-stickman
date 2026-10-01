import type { Game } from '../../game/game';
import { TOUCH } from '../../touch';
import { keyName } from '../../settings';

// ---------------------------------------------------------------------------
// Capitolo 10: chi c'è nel condominio di notte. Quasi tutti dormono (e non si vedono: stanno dietro
// le porte): la portinaia (dietro la vetrata), Biscotto il cane (sul suo tappeto, nel corridoio del
// 1° piano), il signor Chiodo, il neonato. Sveglio c'è solo il signor Gufo, che non dorme mai e sta
// seduto sulle scale. La mattina, Nonna Pina.
// ---------------------------------------------------------------------------

export function createCharacters(g: Game) {
  const A = g.world.anchors;

  // la portinaia: seduta alla scrivania, dietro la vetrata, addormentata
  g.addNpc({
    id: 'portinaia',
    name: 'La portinaia',
    pos: [A.portinaia.x, A.portinaia.z],
    face: [A.portinaia.x, 8],
    look: { hat: 'bun' },
    behavior: { type: 'sit' },
    faceWhenNear: false,
    barks: () => [],
  });

  // Biscotto: dorme sul fianco, sul suo tappeto (le zampe di qua)
  const dog = g.addNpc({ id: 'biscotto', name: 'Biscotto', pos: [A.dog.x, A.dog.z], dog: true, faceWhenNear: false, barks: () => [] });
  dog.pos.y = A.dog.y + 0.08;
  dog.body.root.rotation.y = Math.PI / 2;
  dog.homeRot = Math.PI / 2;
  dog.body.root.rotation.z = 1.35;

  // il signor Gufo: non dorme mai, sta sul mezzo piano della scala ovest (tra il 1° e il 2°)
  g.addNpc({
    id: 'gufo',
    name: 'Il signor Gufo',
    pos: [A.gufo.x, A.gufo.z],
    face: [A.gufo.x - 2, A.gufo.z + 3],
    look: { hat: 'beanie', mustache: true },
    action: 'read',
    behavior: { type: 'sit' },
    barks: () => ['(sottovoce) Una pecora. Due pecore. Una pecora è scappata.', '(sottovoce) Anche tu sveglio? Benvenuto nel club. Siamo in due.', '(sottovoce) Questo libro l\'ho letto quattro volte. Di notte. Al buio.'],
    dialogue: {
      name: 'Il signor Gufo',
      start: (g) => (g.is('c10Gufo') ? 'dopo' : 'a'),
      nodes: {
        a: {
          say: [
            '(sottovoce) Psst. Il nuovo dell\'interno 1. Ti ho sentito traslocare. Io sento tutto: non dormo.',
            '> (sottovoce) Sto andando a prendere il mio pacco. Al terzo piano.',
            '(sottovoce) Coraggioso. Al terzo c\'è il neonato dei Culla. Si sveglia se una piuma cambia idea.',
          ],
          choices: [
            { t: 'Come si cammina, qui, di notte?', next: 'come' },
            { t: 'E il cane?', next: 'cane' },
            { t: 'E il signor Chiodo?', next: 'chiodo' },
          ],
        },
        come: {
          say: [
            '(sottovoce) Le assi segnate di giallo scricchiolano: non pestarle. Tappeti e cartone, invece, zitti.',
            (_g) => `(sottovoce) Accovacciato (${TOUCH ? 'GIÙ' : keyName('crouch')}) fai meno rumore di un pensiero. Di corsa ti sente tutto il palazzo. Saltare, mai.`,
            '(sottovoce) Sulle scale cammina vicino al muro: i gradini scricchiolano in mezzo.',
            '(sottovoce) E se sopra una porta senti "mmh?", fermati. Aspetta. La gente si riaddormenta, se glielo lasci fare.',
          ],
          next: 'fine',
        },
        cane: {
          say: [
            '(sottovoce) Biscotto. Dorme in corridoio, sul suo tappeto. Ti sente con le orecchie e col naso.',
            '(sottovoce) Passagli lontano, bassi, sulla passatoia. La scarpiera in mezzo è dei Croccante: io ci sbatto sempre.',
          ],
          next: 'fine',
        },
        chiodo: {
          say: [
            '(sottovoce) Il signor Chiodo fa i lavori. Di giorno martella, di notte dorme col martello sotto il cuscino.',
            '(sottovoce) Se lo svegli, batte sul muro. E allora ci svegliamo tutti. Tranne me: io sono già sveglio.',
            '(sottovoce) Il suo corridoio è pieno di attrezzi. Stai sul cartone: il parquet nuovo canta.',
          ],
          next: 'fine',
        },
        fine: {
          say: ['(sottovoce) Tieni: una moneta. L\'ho trovata sulle scale. Di notte le scale regalano cose.'],
          do: (g) => {
            g.flag('c10Gufo');
            g.addCoins(10);
            g.addXp(15);
          },
        },
        dopo: {
          say: [
            '(sottovoce) Una pecora. Due pecore. ...Ah, sei tu.',
            '(sottovoce) Ricorda: giallo scricchiola, tappeto tace, muro amico. E mai correre.',
          ],
        },
      },
    },
  });
  g.npc('gufo').pos.y = A.gufo.y;

  // Nonna Pina: la mattina, alla porta (fino ad allora dorme: è sorda da un orecchio, quello buono)
  g.addNpc({
    id: 'pina',
    name: 'Nonna Pina',
    pos: [20, 8.4],
    face: [20, 12],
    look: { hat: 'bun' },
    action: 'cane',
    hidden: true,
    barks: () => [],
  });

}
