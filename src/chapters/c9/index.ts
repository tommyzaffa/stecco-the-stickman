import type { Chapter } from '../types';
import { PENTAGRAMMA } from '../../render/palette';
import { buildPub } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter9 } from './story';

export const chapter9: Chapter = {
  num: 9,
  title: 'Da Dario',
  place: 'Il pub di Dario e Via del Pentagramma, di sera',
  theme: PENTAGRAMMA,
  quests: QUESTS,
  sideQuests: ['jukebox', 'acqua', 'fragola'],
  build: buildPub,
  setup(g) {
    setupStory(g);
    createCharacters(g);
  },
  start: startChapter9,
  // saltando qui: niente oggetti (la freccetta di Barnie è un aiuto, non serve)
  startState: {
    items: [],
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999, c6: 999, c7: 999, c8: 999 },
  },
};
