import type { Chapter } from '../types';
import { CARTONCINO } from '../../render/palette';
import { buildPastello } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter5 } from './story';

export const chapter5: Chapter = {
  num: 5,
  title: "L'appuntamento",
  place: 'Ristorante "Da Pastello"',
  theme: CARTONCINO,
  quests: QUESTS,
  sideQuests: ['prove', 'fiore'],
  build: buildPastello,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter5,
  password: 'ROSA',
  // saltando qui: niente oggetti e niente monete (il conto si può affrontare anche senza)
  startState: {
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999 },
  },
};
