import type { Chapter } from '../types';
import { MILLIMETRATA } from '../../render/palette';
import { buildConsegna } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter6 } from './story';

export const chapter6: Chapter = {
  num: 6,
  title: 'Consegna a domicilio',
  place: 'Da Quadropoli a San Scarabocchio',
  theme: MILLIMETRATA,
  quests: QUESTS,
  sideQuests: ['posta', 'tappi', 'barnie', 'torta'],
  build: buildConsegna,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter6,
  // saltando qui: solo il tappo (senza tappo non c'è consegna)
  startState: {
    items: ['tappoVero'],
    flags: ['metMarco', 'martinaCall'],
    quests: { c1: 999, c2: 999, c3: 999, c4: 999, c5: 999 },
  },
};
