import * as THREE from 'three';
import { npcHead, type QuestDef } from '../../game/quests';
import { CARRY, type FurnId } from './carry';
import { FLOOR1, FURNITURE_AT, VAN } from './world';

export const Q7 = {
  delivered: 0,
  clues: new Set<string>(), // vicolo: cartello, briciole
};

const ORDER: FurnId[] = ['poltrona', 'scala', 'armadio', 'divano'];
const vanTarget = () => VAN.rear.clone().setY(2.4);

// il prossimo mobile da portare giù (per la freccia)
function nextFurniture() {
  const id = ORDER.find((i) => CARRY.items[i]?.state === 'home');
  if (!id) return null;
  const at = FURNITURE_AT[id];
  return new THREE.Vector3(at.x, FLOOR1 + 1.8, at.z);
}

export const QUESTS: Record<string, QuestDef> = {
  c7: {
    title: 'Il trasloco',
    main: true,
    steps: [
      { text: 'Parla con Nonna Pina, davanti alla palazzina', target: npcHead('pina') },
      {
        text: () =>
          CARRY.current
            ? `Porta ${CARRY.current.name} fino al furgone (Marco tiene l'altro capo)`
            : `Porta giù i mobili con Marco (${Q7.delivered}/4): la poltrona, la scala, l'armadio, il divano. Primo piano.`,
        target: () => (CARRY.current ? vanTarget() : nextFurniture()),
      },
      { text: 'Carica gli scatoloni nel furgone (e togli quello che non è di Nonna Pina)', target: vanTarget },
      { text: 'Saluta Nonna Pina', target: npcHead('pina') },
    ],
  },
  vicolo: {
    title: 'Il Vicolo Storto',
    steps: [
      { text: 'Parla con chi è rimasto nel Vicolo Storto (quello con la porta)', target: npcHead('stipite') },
      {
        text: () => `Guarda cosa resta del vicolo (${Q7.clues.size}/2): il cartello e le briciole rosa`,
        // la freccia indica la prossima cosa da guardare
        target: (g) => {
          const A = g.world.anchors;
          const p = !Q7.clues.has('cartello') ? A.vicoloCartello : !Q7.clues.has('briciole') ? A.vicoloBriciole : null;
          return p ? p.clone().setY(p.y + 1.4) : null;
        },
      },
      { text: 'Racconta tutto ad Arturo', target: npcHead('filosofo') },
    ],
  },
  album: {
    title: "L'album di Nonna Pina",
    steps: [{ text: "Riporta l'album a Nonna Pina", target: npcHead('pina') }],
  },
  gatto: {
    title: 'Il gatto del signor Tacchetto',
    steps: [
      { text: 'Il gatto di Tacchetto è nel furgone (Marco): toglilo dal cassone', target: vanTarget },
      { text: 'Il gatto è tornato: dillo al signor Tacchetto', target: npcHead('tacchetto') },
    ],
  },
};
