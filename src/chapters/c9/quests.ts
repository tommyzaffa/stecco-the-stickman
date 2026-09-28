import * as THREE from 'three';
import type { Game } from '../../game/game';
import { npcHead, type QuestDef } from '../../game/quests';
import { HOMES } from './world';
import { TRAY } from './tray';

// stato del capitolo (sparisce con il capitolo: quello che conta dopo va nei flag)
export const Q9 = {
  fizz: 0, // bollicine in corpo (0..1): il capogiro
  team: 'Gli Stecchini', // il nome della squadra al quiz
  score: 0, // risposte giuste al quiz
  hicT: 9, // prossimo singhiozzo
  inside: 0, // quando sei entrato nel pub (tempo del capitolo)
};

const at = (id: string, y = 1.2) => (g: Game) => {
  const a = g.world.anchors[id];
  return new THREE.Vector3(a.x, y, a.z);
};

export const QUESTS: Record<string, QuestDef> = {
  c9: {
    title: 'Da Dario',
    main: true,
    steps: [
      { text: 'Entra da Dario: Marco e Martina ti aspettano per il quiz', target: at('door', 1.4) },
      { text: 'Siediti al tavolo con Marco e Martina: il quiz sta per cominciare', target: at('seat', 1.1) },
      { text: 'La finale di freccette: parla con Barnie, vicino al bersaglio', target: npcHead('barnie') },
      { text: 'Riporta a casa Martina (Via del Pentagramma, verso il canale)', target: () => new THREE.Vector3(HOMES.martina.x, 1.4, HOMES.martina.z - 1) },
      { text: 'Riporta a casa Marco (di là dal canale)', target: () => new THREE.Vector3(HOMES.marco.x, 1.4, HOMES.marco.z + 1) },
    ],
  },
  jukebox: {
    title: 'Il disco rigato',
    steps: [{ text: 'Il jukebox salta: un pugno di lato lo fa ripartire', target: at('jukebox', 1.1) }],
  },
  acqua: {
    title: 'Acqua per la squadra',
    steps: [
      { text: 'Prendi il vassoio con i tre bicchieri d\'acqua (sul bancone)', target: at('tray', 1.3) },
      { text: 'Porta il vassoio al tavolo della squadra senza rovesciare l\'acqua', target: (g) => (TRAY.held ? at('teamTable', 1.0)(g) : at('tray', 1.3)(g)) },
    ],
  },
  fragola: {
    title: 'Il tavolo in fondo',
    steps: [
      { text: 'Il tavolo in fondo, vicino al bagno: briciole rosa. Guardalo da vicino', target: at('tavolo7', 1.0) },
      { text: 'Chiedi a Dario chi era seduto al tavolo in fondo', target: npcHead('dario') },
    ],
  },
};
