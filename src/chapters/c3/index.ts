import type { Chapter } from '../types';
import { QUADRETTI } from '../../render/palette';
import { buildQuadropoli } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter3 } from './story';

export const chapter3: Chapter = {
  num: 3,
  title: 'Il Banco dei Pegni',
  place: 'Quadropoli',
  theme: QUADRETTI,
  quests: QUESTS,
  sideQuests: ['mimo', 'turista', 'poeta'],
  build: buildQuadropoli,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter3,
  password: 'BIRO',
  // saltando qui: statistiche di base, niente oggetti, niente monete (non servono)
  startState: {
    flags: ['metMarco'],
    quests: { c1: 999, c2: 999 },
  },
};
