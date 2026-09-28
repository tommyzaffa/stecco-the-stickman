import type { Game } from '../../game/game';
import { BOOTH, finishBooth } from '../../game/booth';
import { Q8 } from './quests';

// I gettoni della sagra: la riga in fondo al riquadro delle bancarelle e la vincita a fine partita.
export const tokenFooter = () => `gettoni: <b>${Q8.tokens}</b>`;

export function finishTokens(g: Game, html: string, tokens: number) {
  if (!BOOTH.cur || BOOTH.endT >= 0) return;
  const win = tokens > 1 ? `+${tokens} gettoni` : tokens === 1 ? '+1 gettone' : 'niente gettoni';
  if (tokens > 0) {
    Q8.tokens += tokens;
    Q8.won += tokens;
    g.audio.tokens(tokens);
  } else g.audio.miss();
  finishBooth(g, `${html}<div class="win">${win}</div>`, tokens);
}
