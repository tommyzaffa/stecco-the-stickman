import type { Chapter } from '../types';
import { PUNTINI } from '../../render/palette';
import { buildSagra } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter8 } from './story';

export const chapter8: Chapter = {
  num: 8,
  title: 'La sagra',
  place: 'Piazza Grande, San Scarabocchio',
  theme: PUNTINI,
  quests: QUESTS,
  sideQuests: ['stella', 'incollato', 'torta', 'pesce'],
  build: buildSagra,
  setup(g) {
    setupStory(g);
    createCharacters(g);
  },
  start: startChapter8,
  // saltando qui: il tappo di Martina (da ridarle in cima alla ruota), nient'altro
  startState: {
    items: ['tappoVero'],
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999, c6: 999, c7: 999 },
  },
};
