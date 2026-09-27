import type { Chapter } from '../types';
import { PACCHI } from '../../render/palette';
import { buildMercato } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter4 } from './story';

export const chapter4: Chapter = {
  num: 4,
  title: 'Il Mercato Nero',
  place: 'Sotto la stazione di Quadropoli',
  theme: PACCHI,
  quests: QUESTS,
  sideQuests: ['record', 'ombra', 'colori'],
  build: buildMercato,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter4,
  // saltando qui: niente monete e niente armi (la pistola si prende nel capitolo)
  startState: {
    flags: ['metMarco'],
    quests: { c1: 999, c2: 999, c3: 999 },
  },
};
