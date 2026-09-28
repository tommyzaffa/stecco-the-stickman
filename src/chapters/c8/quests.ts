import * as THREE from 'three';
import type { Game } from '../../game/game';
import { npcHead, type QuestDef } from '../../game/quests';
import { CAKE, CANS, FISH } from './world';
import { RIDE } from './wheel';

export const RIDE_COST = 6;

// stato del capitolo (sparisce con il capitolo: quello che conta dopo va nei flag)
export const Q8 = {
  tokens: 0, // gettoni in tasca (cioè in mano: le tasche non ci sono)
  won: 0, // gettoni vinti in tutto
  played: new Set<string>(), // bancarelle provate almeno una volta
};

// le tre bancarelle: davanti a ognuna, all'altezza degli occhi
export const BOOTHS: Record<string, THREE.Vector3> = {
  cans: new THREE.Vector3(CANS.spot.x, 2.3, CANS.spot.z),
  fish: new THREE.Vector3(FISH.spot.x, 2.3, FISH.spot.z),
  cake: new THREE.Vector3(CAKE.spot.x, 2.3, CAKE.spot.z),
};

// la freccia indica la bancarella più vicina che non hai ancora provato (se le hai provate tutte, la più vicina)
function nextBooth(g: Game) {
  const p = g.player.pos;
  const ids = Object.keys(BOOTHS);
  const todo = ids.filter((id) => !Q8.played.has(id));
  const list = todo.length ? todo : ids;
  let best: THREE.Vector3 | null = null;
  for (const id of list) {
    const b = BOOTHS[id];
    if (!best || Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(best.x - p.x, best.z - p.z)) best = b;
  }
  return best;
}

export const QUESTS: Record<string, QuestDef> = {
  c8: {
    title: 'La sagra',
    main: true,
    steps: [
      { text: 'Trova Martina: è alla pesca dei tappi', target: npcHead('martina') },
      {
        text: () => `Vinci ${RIDE_COST} gettoni alle bancarelle (${Math.min(RIDE_COST, Q8.tokens)}/${RIDE_COST}): barattoli, tappi, torte`,
        target: nextBooth,
      },
      {
        text: () => (RIDE.cabin >= 0 ? 'Sulla ruota panoramica, con Martina' : `Porta Martina sulla ruota panoramica (${RIDE_COST} gettoni in due)`),
        target: (g) => (RIDE.cabin >= 0 ? null : npcHead('perno')(g)),
      },
      { text: 'Arturo ti fa segno, vicino alla fontana', target: npcHead('filosofo') },
    ],
  },
  stella: {
    title: 'Il tappo con la stella',
    steps: [
      { text: 'Pesca il tappo con la stella (quello che gira più veloce, al bordo della vasca)', target: () => BOOTHS.fish },
      { text: 'Porta il tappo con la stella a Martina', target: npcHead('martina') },
    ],
  },
  incollato: {
    title: 'Il barattolo incollato',
    steps: [
      { text: 'Il barattolo di mezzo non cade mai: guardalo da vicino, dal bancone', target: () => BOOTHS.cans },
      { text: "Dillo all'Ispettore Penna (Biro Blu, Ufficio Sagre)", target: npcHead('penna') },
      { text: 'Porta il verbale al Pastellone', target: npcHead('pastellone') },
    ],
  },
  torta: {
    title: 'La torta più alta',
    steps: [{ text: 'Aiuta Nonna Pina: impila una torta di almeno 10 piani (gara di torte)', target: () => BOOTHS.cake }],
  },
  pesce: {
    title: 'Il pesce di Marco',
    steps: [
      { text: 'Marco vuole il pesce rosso (grigio) del banco dei premi: 3 gettoni', target: npcHead('fluo') },
      { text: 'Porta il pesce a Marco', target: npcHead('marco') },
    ],
  },
};
