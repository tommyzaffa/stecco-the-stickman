import type { Chapter } from '../types';
import { CARBONE } from '../../render/palette';
import { buildCondominio } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter10 } from './story';

export const chapter10: Chapter = {
  num: 10,
  title: 'Il condominio',
  place: 'Via della Penna 3, di notte',
  theme: CARBONE,
  quests: QUESTS,
  sideQuests: ['pantofole', 'rubinetto', 'lettera'],
  build: buildCondominio,
  setup(g) {
    setupStory(g);
    createCharacters(g);
  },
  start: startChapter10,
  // saltando qui: niente oggetti
  startState: {
    items: [],
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999, c6: 999, c7: 999, c8: 999, c9: 999 },
  },
};
