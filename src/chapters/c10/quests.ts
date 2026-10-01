import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { QuestDef } from '../../game/quests';
import { H, levelOf } from './world';

// stato del capitolo (sparisce con il capitolo: quello che conta dopo va nei flag)
export const Q10 = {
  check: { pos: new THREE.Vector3(), yaw: 0, pacco: false }, // dove si riprova se qualcuno si sveglia
  phone: false, // la telefonata di Marco è già arrivata
  ringing: false, // il telefono sta squillando (ogni squillo fa rumore)
  ringT: 0,
  call: false, // Marco sta parlando (urla)
  dripT: 1, // prossima goccia del rubinetto
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// la strada: piano terra → scala est → 1° (corridoio, il cane) → scala ovest → 2° (lavori) →
// scala est → 3° (il neonato) → il pacco. Al ritorno la stessa, al contrario.
function nextStop(g: Game, back: boolean) {
  const lv = levelOf(g.player.pos.y);
  if (!back) return [v(27.5, 1.2, 8.5), v(-3.5, H + 1.2, 8.5), v(27.5, 2 * H + 1.2, 8.5), v(4, 3 * H + 0.8, 8.4)][lv];
  return [v(20, 1.2, 9.5), v(27.5, H + 1.2, 8.5), v(-3.5, 2 * H + 1.2, 8.5), v(27.5, 3 * H + 1.2, 8.5)][lv];
}

export const QUESTS: Record<string, QuestDef> = {
  c10: {
    title: 'Il condominio',
    main: true,
    steps: [
      {
        text: (g) =>
          ['Il pacco è al 3° piano (interno 12): sali dalla scala in fondo, a destra', 'Al 1° la scala per salire è dall\'altra parte: attraversa il corridoio (c\'è il cane)', 'Al 2° piano si sale dalla scala est: attraversa i lavori', 'Il pacco è in fondo al corridoio, davanti all\'interno 12 (accanto c\'è il neonato)'][levelOf(g.player.pos.y)],
        target: (g) => nextStop(g, false),
      },
      {
        text: (g) =>
          ['Riporta il pacco a casa: interno 1, piano terra', 'Al 1° piano si scende dalla scala est: ripassa davanti al cane', 'Al 2° si scende dalla scala ovest: ripassa tra i lavori', 'Torna giù dalla scala est (piano, col pacco in braccio)'][levelOf(g.player.pos.y)],
        target: (g) => nextStop(g, true),
      },
    ],
  },
  pantofole: {
    title: 'Le pantofole di Nonna Pina',
    steps: [{ text: 'Sullo zerbino dell\'interno 2 (Nonna Pina) c\'è qualcosa per te', target: () => v(12, 0.4, 6.5) }],
  },
  rubinetto: {
    title: 'Il rubinetto che gocciola',
    steps: [{ text: 'Chiudi il rubinetto della lavanderia (piano terra): la goccia rimbomba nei tubi fino al 3° piano', target: () => v(14.6, 1.1, 13.4) }],
  },
  lettera: {
    title: 'La lettera sbagliata',
    steps: [{ text: 'Infila la lettera sotto la porta dei Righello (2° piano, interno 8)', target: () => v(4, 2 * H + 0.3, 6.3) }],
  },
};
