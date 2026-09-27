import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { MARTINA_LOOK, ZONES } from './world';
import { resetDate, startDate, updateDate } from './date';
import { STATUS } from './quests';

// Capitolo 5: la via dei Pastelli → il maître → la cena con Martina → "Voi siete quelli del Mercato Nero!"

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

export function setupStory(g: Game) {
  const A = g.world.anchors;
  resetDate();
  STATUS.text = 'Cena con Martina';
  g.audio.birds = false;
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 1, 6), 20, 0.35);
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi sul marciapiede. Un Pastello ti guarda e scuote la punta');

  g.addCoin(A.coinA.x, A.coinA.z, 'Una moneta vicino allo steccato. Qualcuno l\'ha persa giocando a campana.');
  g.addCoin(A.coinB.x, A.coinB.z, 'Una moneta davanti al ristorante. Il resto di una mancia troppo generosa.');

  g.addInteractable({
    pos: new THREE.Vector3(-5, 0.2, -19.5),
    radius: 2.2,
    label: () => 'Guarda la campana',
    use: (g) => g.talk(narr(['Una campana disegnata col pastello rosso. In fondo, al posto di "CIELO", qualcuno ha scritto "CENA".', 'Salti fino alla cena. Arrivi senza fiato. Promettente.'])),
  });
  g.addInteractable({
    pos: A.door,
    radius: 2,
    label: (g) => (g.quest('c5') === 0 ? 'Porta del ristorante' : null),
    use: (g) => g.talk(narr(['La porta è chiusa. Si entra solo passando dal maître. È un posto serio. Più o meno.'])),
  });

  g.onUpdate.push((g, dt) => {
    const p = g.player.pos;

    // dentro! stacco al tavolo
    if (g.is('entra') && !g.is('seduto') && !g.dialogue.isOpen) {
      g.flag('seduto');
      sitDown(g);
    }
    updateDate(g, dt);

    // la musica del ristorante, da fuori, si sente ovattata
    g.audio.setMusicMuffle(ZONES.inside(p) ? 20000 : 900);

    // fine capitolo
    if (g.is('c5Finale') && !g.dialogue.isOpen && !g.is('c5Done')) {
      g.flag('c5Done');
      g.completeQuest('c5');
      g.fade(true);
      g.after(1.2, () =>
        g.completeChapter(
          'Prossimamente: consegna a domicilio. La macchina di Luca (senza motore), il tappo giallo, e tutti i Pastelli di Quadropoli dietro. Guidi tu.',
        ),
      );
    }
  });
}

// Buio, e riapri gli occhi seduto al tavolo, davanti a Martina
function sitDown(g: Game) {
  const A = g.world.anchors;
  g.fade(true);
  g.after(0.9, () => {
    g.player.pos.set(A.seat.x, 0, A.seat.z);
    g.player.seated = true;
    g.player.setCrouch(false);
    g.player.setWeapon('fist');
    g.player.setLook(MARTINA_LOOK);
    g.setHidden(g.npc('marco'), true);
    // il maître è entrato con te: sta dentro, vicino all'ingresso
    const b = g.npc('bianco');
    b.pos.set(A.maitrePost.x, 0, A.maitrePost.z);
    b.setBehavior({ type: 'stand' });
    b.homeRot = Math.PI;
    b.body.root.rotation.y = Math.PI;
    b.faceWhenNear = false;
    g.setStep('c5', 1, true);
    g.setCheckpoint(A.seat, MARTINA_LOOK, 'Riprendi fiato');
    g.fade(false);
    g.after(1.0, () => startDate(g));
  });
}

export function startChapter5(g: Game) {
  if (g.quest('c5') === -1) g.startQuest('c5');
  g.audio.playMusic('cena');
  g.after(0.6, () => g.chapter('CAPITOLO 5', "L'appuntamento"));
  g.after(5, () => g.toast('Il quartiere dei Pastelli a Cera. Stasera niente pistole: solo parole. Sceglile bene.', 'info', 6000));
}
