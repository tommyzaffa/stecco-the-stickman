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
  // se si salta direttamente qui: un giocatore "medio" che ha finito il capitolo 1
  startState: {
    hp: 110,
    maxHp: 110,
    level: 2,
    xp: 30,
    coins: 50,
    items: ['righello', 'libro'],
    flags: ['metMarco', 'metGiallo'],
    quests: { c1: 999, cane: 999, consegna: 999, bus: 999, filosofo: 999 },
  },
};
