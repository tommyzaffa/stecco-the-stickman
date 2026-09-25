import type { Chapter } from '../types';
import { DAY } from '../../render/palette';
import { buildTown } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { createObjects } from './objects';
import { setupStory, startChapter1 } from './story';

export const chapter1: Chapter = {
  num: 1,
  title: 'Un martedì qualunque',
  place: 'San Scarabocchio',
  theme: DAY,
  quests: QUESTS,
  sideQuests: ['cane', 'consegna', 'bus', 'filosofo'],
  build: buildTown,
  setup(g) {
    createCharacters(g);
    createObjects(g);
    setupStory(g);
  },
  start: startChapter1,
};
