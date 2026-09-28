import type { Chapter } from '../types';
import { DAY } from '../../render/palette';
import { buildDemo } from './world';
import { STATUS, setupDemo, startDemo } from './story';

// La demo: "la pagina di prova". Non è un capitolo della storia (non sta in CHAPTERS):
// si gioca dal menu, anche senza account, e alla fine si torna al menu.
export const DEMO: Chapter = {
  num: 0,
  title: 'Demo',
  place: 'La pagina di prova',
  theme: DAY,
  quests: {
    demo: {
      title: 'La pagina di prova',
      main: true,
      steps: [{ text: () => STATUS.text, target: () => STATUS.target }],
    },
  },
  sideQuests: [],
  build: buildDemo,
  setup: setupDemo,
  start: startDemo,
};
