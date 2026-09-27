import './style.css';
import { Game } from './game/game';
import { setupFlow } from './game/flow';
import { SETTINGS, qualityParams } from './settings';
import { TOUCH } from './touch';

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
  setupFlow(game);
  document.getElementById('loading')?.remove();

  // Limitatore di frame: sugli schermi a 120 Hz il browser chiamerebbe il gioco 120 volte al
  // secondo. 60 fps in gioco bastano; su titolo/pausa ne bastano 10 (il tratto trema a 8 fps).
  // Il margine (4 ms) è largo apposta: i telefoni a 60 Hz consegnano i frame con un po' di anticipo o
  // ritardo, e con un margine stretto se ne saltava uno ogni tanto (camminata a scatti). A 120 Hz si
  // salta comunque un frame su due (60 fps), o tre su quattro con la grafica leggera (30 fps).
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const interval = 1000 / (game.active ? qualityParams(SETTINGS.quality, TOUCH).fps : 10);
    const elapsed = now - last;
    if (elapsed < interval - 4) return;
    last = now;
    game.update(Math.min(0.05, elapsed / 1000));
  };
  requestAnimationFrame(frame);

  (window as unknown as { game: Game }).game = game; // per il debug da console
}

boot();
