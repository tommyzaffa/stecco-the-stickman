import type * as THREE from 'three';
import type { Game } from '../game/game';

export interface QuestStep {
  text: string | ((g: Game) => string);
  target?: (g: Game) => THREE.Vector3 | null;
}

export interface QuestDef {
  title: string;
  main?: boolean;
  steps: QuestStep[];
}

const npcHead = (id: string) => (g: Game) => {
  const n = g.npc(id);
  return n.pos.clone().setY(n.headY + 1.05);
};

export const COINS_NEEDED = 50;

export const QUESTS: Record<string, QuestDef> = {
  main: {
    title: 'Un martedì qualunque',
    main: true,
    steps: [
      { text: 'Spegni la sveglia', target: (g) => g.town.anchors.alarm },
      { text: 'Esci di casa', target: (g) => g.town.anchors.houseDoor },
      { text: 'Raggiungi Marco al Bar da Gino', target: npcHead('marco') },
      { text: (g) => `Racimola ${COINS_NEEDED} monete per il club (${g.state.coins}/${COINS_NEEDED})` },
      { text: 'Torna da Marco con le monete', target: npcHead('marco') },
    ],
  },
  cane: {
    title: 'Il cane di Nonna Pina',
    steps: [
      { text: 'Trova il cane di Nonna Pina (forse nel parco?)' },
      { text: 'Riporta il cane a Nonna Pina', target: npcHead('pina') },
    ],
  },
  consegna: {
    title: 'Consegna urgente',
    steps: [{ text: 'Porta il pacco al Dottor Soldini, in banca', target: npcHead('soldini') }],
  },
  bus: {
    title: 'Aspettando il 12',
    steps: [
      { text: 'Leggi gli orari alla fermata del bus', target: (g) => g.town.anchors.busSign },
      { text: 'Torna da Gianni', target: npcHead('gianni') },
    ],
  },
  filosofo: {
    title: 'Tre domande',
    steps: [{ text: 'Rispondi alle domande del Filosofo' }],
  },
};
