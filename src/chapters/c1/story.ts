import type { Game } from '../../game/game';
import { COINS_NEEDED } from './quests';

// Capitolo 1: risveglio → città → Marco → monete → finale.

export function setupStory(g: Game) {
  const A = g.world.anchors;
  g.audio.birds = true;
  g.setCheckpoint(A.spawn, A.alarm, 'Ti risvegli a casa. Qualcuno ti ha riportato qui');
  const alarmSound = g.audio.addEmitter('alarm', A.alarm, 30);
  g.audio.addEmitter('fountain', A.fountain, 16);

  const alarm = g.world.props.alarm;
  const alarmBaseY = alarm.position.y;
  g.onUpdate.push((g) => {
    const main = g.quest('c1');

    // la sveglia trema (e suona) finché non la spegni
    alarmSound.on = main === 0 && g.mode === 'play';
    if (main === 0) {
      alarm.rotation.z = Math.sin(g.time * 55) * 0.09;
      alarm.position.y = alarmBaseY + Math.abs(Math.sin(g.time * 28)) * 0.025;
      g.worldBubble(A.alarm.clone().setY(1.2), 'DRIIIN! DRIIIN!');
    } else {
      alarm.rotation.z = 0;
      alarm.position.y = alarmBaseY;
    }

    // uscita di casa
    if (g.mode === 'play' && main >= 0 && main <= 1 && !g.world.isIndoor(g.player.pos)) {
      if (main === 0) {
        g.toast('Hai lasciato la sveglia a suonare. I vicini ti odieranno. Come sempre.', 'info', 5000);
        g.phone('Marco', "SVEGLIA. Stasera si esce. Vieni al bar da Gino. NON fare tardi come l'ultima volta (3 giorni).");
      }
      g.setStep('c1', 2);
      g.after(2.5, () => g.chapter('SAN SCARABOCCHIO', '47 abitanti · 3 dimensioni · 0 colori'));
      g.after(3.5, () => g.audio.playMusic('paese'));
    }

    // monete per il club
    if (main === 3 && g.state.coins >= COINS_NEEDED) {
      g.setStep('c1', 4);
      g.toast(`Hai ${COINS_NEEDED} monete! Torna da Marco.`, 'quest');
    } else if (main === 4 && g.state.coins < COINS_NEEDED && !g.dialogue.isOpen) {
      g.setStep('c1', 3, true);
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

    // fine del capitolo
    if (g.is('finale') && !g.dialogue.isOpen && !g.is('c1Done')) {
      g.flag('c1Done');
      g.completeQuest('c1');
      g.after(0.6, () => g.completeChapter('Stasera: il Parallelepipedo, gli Evidenziatori e un tappo da restituire.'));
    }
  });
}

export function startChapter1(g: Game) {
  if (g.quest('c1') === -1) g.startQuest('c1');
  g.after(0.6, () => g.chapter('CAPITOLO 1', 'Un martedì qualunque'));
  g.after(4.5, () => g.toast('Premi <b>E</b> quando vedi qualcosa di interessante. O qualcuno.', 'info', 6000));
}
