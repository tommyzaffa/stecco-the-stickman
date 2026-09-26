import type { Chapter } from '../types';
import { NIGHT } from '../../render/palette';
import { buildClub } from './world';
import { QUESTS } from './quests';
import { createCharacters } from './characters';
import { setupStory, startChapter2 } from './story';

export const chapter2: Chapter = {
  num: 2,
  title: 'Il Parallelepipedo',
  place: 'Il club, di notte',
  theme: NIGHT,
  quests: QUESTS,
  sideQuests: ['dj', 'guardaroba', 'ballo', 'linea'],
  build: buildClub,
  setup(g) {
    createCharacters(g);
    setupStory(g);
  },
  start: startChapter2,
  password: 'PSST',
  // se si salta direttamente qui: statistiche di base e solo lo stretto necessario
  // (le 50 monete per entrare al club, niente di più)
  startState: {
    coins: 50,
    flags: ['metMarco'],
    quests: { c1: 999 },
  },
};
