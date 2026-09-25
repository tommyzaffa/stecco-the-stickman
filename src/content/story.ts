import type { Game } from '../game/game';
import { COINS_NEEDED } from './quests';

// Flusso della demo: titolo → risveglio → città → Marco → monete → finale.

const CONTROLS = `
  <div class="controls">
    <div><b>WASD</b> muoviti</div><div><b>Mouse</b> guardati intorno</div>
    <div><b>Shift</b> corri</div><div><b>Spazio</b> salta</div>
    <div><b>E</b> parla / interagisci</div><div><b>Click</b> pugno</div>
    <div><b>Q</b> diario</div><div><b>1 / 2</b> cambia arma</div>
    <div><b>M</b> musica on/off</div><div><b>Esc</b> pausa</div>
  </div>`;

export function setupStory(g: Game) {
  const screen = g.hud.screen;
  const show = (html: string) => {
    screen.innerHTML = html;
    screen.style.display = 'flex';
  };
  const hide = () => (screen.style.display = 'none');

  // --- titolo ------------------------------------------------------------------
  show(`
    <div class="card paper">
      <div class="title">STILIZZATO</div>
      <div class="sub">demo · capitolo 1</div>
      ${CONTROLS}
      <div class="go">clicca per iniziare</div>
    </div>`);

  const sp = g.town.anchors.spawn;
  g.player.pos.set(sp.x, 0, sp.z);
  g.player.setLook(g.town.anchors.alarm.clone().setY(1.0));

  screen.addEventListener('click', () => {
    g.audio.init(); // i browser sbloccano l'audio solo dopo un click
    if (g.mode === 'title') begin();
    g.input.lock();
  });

  const begin = () => {
    g.mode = 'play';
    g.startQuest('main');
    g.fade(true);
    g.after(0.1, () => g.fade(false));
    g.after(0.6, () => g.chapter('CAPITOLO 1', 'Un martedì qualunque'));
    g.after(4.5, () => g.toast('Premi <b>E</b> quando vedi qualcosa di interessante. O qualcuno.', 'info', 6000));
  };

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      g.audio.resume();
      return hide();
    }
    if (g.mode === 'play') {
      g.audio.suspend();
      show(`
        <div class="card paper">
          <div class="title small">Pausa</div>
          <div class="sub">anche gli omini stilizzati hanno bisogno di una pausa</div>
          ${CONTROLS}
          <div class="go">clicca per continuare</div>
        </div>`);
    }
  });

  // --- logica per frame ---------------------------------------------------------
  const alarmBaseY = g.town.alarm.position.y;
  g.onUpdate.push((g) => {
    const main = g.quest('main');

    // la sveglia trema finché suona
    if (main === 0) {
      g.town.alarm.rotation.z = Math.sin(g.time * 55) * 0.09;
      g.town.alarm.position.y = alarmBaseY + Math.abs(Math.sin(g.time * 28)) * 0.025;
    } else {
      g.town.alarm.rotation.z = 0;
      g.town.alarm.position.y = alarmBaseY;
    }

    // uscita di casa
    if (g.mode === 'play' && main >= 0 && main <= 1 && !g.town.isInsideHouse(g.player.pos)) {
      if (main === 0) {
        g.toast('Hai lasciato la sveglia a suonare. I vicini ti odieranno. Come sempre.', 'info', 5000);
        g.phone('Marco', "SVEGLIA. Stasera si esce. Vieni al bar da Gino. NON fare tardi come l'ultima volta (3 giorni).");
      }
      g.setStep('main', 2);
      g.after(2.5, () => g.chapter('SAN SCARABOCCHIO', '47 abitanti · 3 dimensioni · 0 colori'));
      g.after(3.5, () => g.audio.startMusic());
    }

    // monete per il club
    if (main === 3 && g.state.coins >= COINS_NEEDED) {
      g.setStep('main', 4);
      g.toast(`Hai ${COINS_NEEDED} monete! Torna da Marco.`, 'quest');
    } else if (main === 4 && g.state.coins < COINS_NEEDED && !g.dialogue.isOpen) {
      g.setStep('main', 3, true);
    }

    // Gianni, finalmente libero, va a spasso per il parco
    if (g.is('gianniFree') && !g.is('gianniWalking') && !g.dialogue.isOpen) {
      g.flag('gianniWalking');
      g.npc('gianni').setBehavior({
        type: 'patrol',
        path: [[-30, -6.4], [-8, -6.4], [10, -6.4], [36.5, -7], [38, -16], [44, -20], [38, -18], [36.5, -7], [10, -6.4], [-8, -6.4]],
        speed: 1.8,
        wait: 1,
      });
    }

    // finale della demo
    if (g.is('finale') && !g.dialogue.isOpen && !g.is('demoEnded')) {
      g.flag('demoEnded');
      g.completeQuest('main');
      g.after(0.6, () => endDemo(g));
    }
  });

  const endDemo = (g: Game) => {
    g.mode = 'end';
    const side = ['cane', 'consegna', 'bus', 'filosofo'].filter((q) => g.questDone(q)).length;
    const mins = Math.floor(g.playTime / 60), secs = Math.floor(g.playTime % 60);
    g.input.unlock();
    g.audio.jingle();
    show(`
      <div class="card paper">
        <div class="title small">FINE DELLA DEMO</div>
        <div class="sub">Il capitolo 2 non è ancora stato disegnato.<br>(Stasera: il Parallelepipedo, gli Evidenziatori e un tappo da restituire.)</div>
        <div class="stats-end">
          <div>Tempo: <b>${mins}m ${secs}s</b></div>
          <div>Livello: <b>${g.state.level}</b></div>
          <div>Monete: <b>${g.state.coins}</b></div>
          <div>Missioni secondarie: <b>${side}/4</b></div>
        </div>
        <div class="go">clicca per continuare a esplorare</div>
      </div>`);
    const again = () => {
      g.mode = 'play';
      screen.removeEventListener('click', again);
    };
    screen.addEventListener('click', again);
  };
}
