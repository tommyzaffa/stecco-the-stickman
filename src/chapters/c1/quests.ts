import { npcHead, type QuestDef } from '../../game/quests';

export const COINS_NEEDED = 50;

export const QUESTS: Record<string, QuestDef> = {
  c1: {
    title: 'Un martedì qualunque',
    main: true,
    steps: [
      { text: 'Spegni la sveglia', target: (g) => g.world.anchors.alarm },
      { text: 'Esci di casa', target: (g) => g.world.anchors.houseDoor },
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
      { text: 'Leggi gli orari alla fermata del bus', target: (g) => g.world.anchors.busSign },
      { text: 'Torna da Gianni', target: npcHead('gianni') },
    ],
  },
  filosofo: {
    title: 'Tre domande',
    steps: [{ text: 'Rispondi alle domande del Filosofo' }],
  },
};
