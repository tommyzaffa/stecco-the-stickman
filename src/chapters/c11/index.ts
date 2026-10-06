import type { Chapter } from '../types';
import { MODULO } from '../../render/palette';
import { buildUfficio } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter11 } from './story';

export const chapter11: Chapter = {
  num: 11,
  title: 'Modulo 27-B',
  place: 'L\'Ufficio Protocollo di Quadropoli',
  theme: MODULO,
  quests: QUESTS,
  sideQuests: ['occhiali', 'caffe', 'archivio'],
  build: buildUfficio,
  setup(g) {
    const customers = createCharacters(g);
    setupStory(g, customers);
  },
  start: startChapter11,
  // saltando qui: qualche moneta (marca da bollo, foto, caffè)
  startState: {
    items: [],
    coins: 20,
    flags: ['metMarco', 'martinaCall', 'c10Fine'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999, c6: 999, c7: 999, c8: 999, c9: 999, c10: 999 },
  },
};
