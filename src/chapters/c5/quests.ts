import { npcHead, type QuestDef } from '../../game/quests';

// testo dell'obiettivo durante la cena (lo aggiorna date.ts: portata, eventi di Marco...)
export const STATUS = { text: 'Cena con Martina' };

export const QUESTS: Record<string, QuestDef> = {
  c5: {
    title: "L'appuntamento",
    main: true,
    steps: [
      { text: 'Entra da Pastello: il maître è alla porta', target: npcHead('bianco') },
      { text: () => STATUS.text },
    ],
  },
  prove: {
    title: 'Le prove con Marco',
    steps: [{ text: 'Fai le prove della cena con Marco', target: npcHead('marco') }],
  },
  fiore: {
    title: 'Un fiore per Martina',
    steps: [{ text: 'Procurati un fiore (la fioraia col carretto)', target: npcHead('fioraia') }],
  },
};
