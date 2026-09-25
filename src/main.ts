import './style.css';
import { Game } from './game/game';
import { createCharacters } from './content/characters';
import { createObjects } from './content/objects';
import { setupStory } from './content/story';

async function boot() {
  // i font scritti a mano servono anche alle texture delle insegne
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Patrick Hand"'), document.fonts.load('40px "Permanent Marker"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* si usa il font di riserva */
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const game = new Game(canvas);
  createCharacters(game);
  createObjects(game);
  setupStory(game);
  document.getElementById('loading')?.remove();

  // Limitatore di frame: sugli schermi a 120 Hz il browser chiamerebbe il gioco 120 volte al
  // secondo. 60 fps in gioco bastano; su titolo/pausa ne bastano 10 (il tratto trema a 8 fps).
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const interval = 1000 / (game.active ? 60 : 10);
    const elapsed = now - last;
    if (elapsed < interval - 1) return;
    // riporta il "ritardo" accumulato al frame dopo, così la media resta sul target
    last = elapsed >= interval && elapsed < interval * 2 ? now - (elapsed - interval) : now;
    game.update(Math.min(0.05, elapsed / 1000));
  };
  requestAnimationFrame(frame);

  (window as unknown as { game: Game }).game = game; // per il debug da console
}

boot();
