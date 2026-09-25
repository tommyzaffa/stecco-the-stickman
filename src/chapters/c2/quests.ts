import { npcHead, type QuestDef } from '../../game/quests';
import type { Game } from '../../game/game';
import { ZONES } from './world';

export const ENTRY_FEE = 50;
export const BRIBE = 25;

// Dove puntare la freccia per "raggiungi l'ufficio": dipende da dove sei e che strada stai usando
const officeTarget = (g: Game) => {
  const p = g.player.pos, A = g.world.anchors;
  if (ZONES.vip(p)) return A.officeFront;
  if (ZONES.corridor(p)) return A.officeFront.clone().set(6, 1.2, 18);
  if (ZONES.bathroom(p) && g.has('chiave')) return A.staffDoor;
  return A.rope;
};

export const QUESTS: Record<string, QuestDef> = {
  c2: {
    title: 'Il Parallelepipedo',
    main: true,
    steps: [
      { text: 'Parla con Marco davanti al club', target: npcHead('marco') },
      { text: `Entra nel club (Bruno vuole ${ENTRY_FEE} monete)`, target: npcHead('bruno') },
      { text: 'Trova Marco al bar', target: npcHead('marco') },
      { text: "Raggiungi l'ufficio di Don Fluo", target: officeTarget },
      { text: 'Rimetti il tappo nella teca', target: (g) => g.world.anchors.teca },
      { text: 'Difenditi dagli scagnozzi di Don Fluo!' },
      { text: "Scappa dall'uscita sul retro!", target: (g) => g.world.anchors.backExit },
      { text: 'Parla con Marco nel vicolo', target: npcHead('marco') },
    ],
  },
  dj: {
    title: 'Un disco per il DJ',
    steps: [
      { text: 'Trova qualcosa di rotondo per il DJ' },
      { text: 'Porta il "disco" al DJ', target: npcHead('dj') },
    ],
  },
  guardaroba: {
    title: 'Qualcosa da custodire',
    steps: [{ text: 'Porta a Ornella qualcosa da custodire (qualsiasi cosa)' }],
  },
  ballo: {
    title: 'La sfida di Rey',
    steps: [{ text: 'Batti Rey nella sfida di ballo', target: npcHead('rey') }],
  },
  linea: {
    title: "L'omino più sottile del mondo",
    steps: [{ text: 'Tira su il morale a Linea, nei bagni' }],
  },
};
