import type { Chapter } from '../types';
import { RIGHE } from '../../render/palette';
import { buildTrasloco } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter7 } from './story';

export const chapter7: Chapter = {
  num: 7,
  title: 'Il trasloco',
  place: 'Via delle Matite, San Scarabocchio',
  theme: RIGHE,
  quests: QUESTS,
  sideQuests: ['vicolo', 'album', 'gatto'],
  build: buildTrasloco,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter7,
  // saltando qui: il tappo di Martina (da ridarle alla sagra), nient'altro
  startState: {
    items: ['tappoVero'],
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999, c6: 999 },
  },
};
