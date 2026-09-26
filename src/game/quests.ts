import type * as THREE from 'three';
import type { Game } from './game';

export interface QuestStep {
  text: string | ((g: Game) => string);
  target?: (g: Game) => THREE.Vector3 | null;
}

export interface QuestDef {
  title: string;
  main?: boolean;
  steps: QuestStep[];
}

// Punto sopra la testa di un PNG (per la freccia dell'obiettivo)
export const npcHead = (id: string) => (g: Game) => {
  const n = g.npc(id);
  return n.pos.clone().setY(n.topY + 1.05);
};
