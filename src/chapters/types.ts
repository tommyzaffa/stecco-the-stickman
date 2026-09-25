import type { Game, GameState } from '../game/game';
import type { QuestDef } from '../game/quests';
import type { World } from '../world/builder';

// Un capitolo = una "pagina" del quaderno: il suo luogo, i suoi personaggi, le sue missioni.
export interface Chapter {
  num: number;
  title: string; // es. "Un martedì qualunque"
  place: string; // es. "San Scarabocchio"
  theme: { paper: string; ink: string };
  quests: Record<string, QuestDef>;
  // quali missioni contano per il riepilogo di fine capitolo
  sideQuests: string[];
  build(): World;
  // PNG, oggetti e logica. Il giocatore è già sulla posizione "spawn" del mondo.
  setup(g: Game): void;
  // Chiamato quando il giocatore inizia davvero a giocare il capitolo (dopo il click).
  start(g: Game): void;
  // Stato di partenza se si salta direttamente a questo capitolo (?cap=N): valori "medi".
  startState?: Partial<Omit<GameState, 'flags'>> & { flags?: string[] };
}
