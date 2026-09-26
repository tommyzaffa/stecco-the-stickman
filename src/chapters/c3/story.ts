import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { CLUES, CLUES_NEEDED } from './quests';
import { ZONES } from './world';
import { touristArrival } from './characters';

// Capitolo 3: arrivo a Quadropoli → ispettore → indagine → accusa → Mercato Nero.

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

export function setupStory(g: Game) {
  const A = g.world.anchors;
  g.clues = CLUES;
  g.audio.birds = true;
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 1, 0), 30, 0.6);
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi in piazza. Un piccione disegnato ti guarda con sufficienza');

  // --- monete ---
  g.addCoin(A.coinA.x, A.coinA.z, 'Una moneta nel vicolo, dietro le casse. Nei vicoli si trova sempre qualcosa.');
  g.addCoin(A.coinB.x, A.coinB.z, 'Una moneta sul bordo della strada, vicino alla fine del foglio.');
  g.addCoin(A.coinC.x, A.coinC.z, 'Una moneta tra i materassini del campionato. Qualcuno l\'ha persa nel sonno.');
  g.addCoin(A.coinD.x, A.coinD.z, 'Una moneta vicino alla metro. Qualcuno ha pagato il biglietto con la fretta.');

  // --- indizi da esaminare ---
  const clueSpot = (pos: THREE.Vector3, id: keyof typeof CLUES, label: string, lines: string[], radius = 2) =>
    g.addInteractable({
      pos,
      radius,
      label: () => label,
      icon: (g) => (!g.hasClue(id) && g.quest('c3') >= 2 ? 'clue' : null),
      use: (g) => g.talk(narr(lines), null, () => g.findClue(id)),
    });
  clueSpot(A.glass, 'vetri', 'Esamina i cocci', [
    'Pezzi di vetro sul marciapiede. Tanti. Sparsi verso la piazza.',
    'Se qualcuno avesse rotto la vetrina da fuori, i cocci sarebbero dentro il negozio.',
    'Questi sono fuori. La vetrina è stata rotta da dentro.',
  ]);
  clueSpot(A.lock, 'serratura', 'Esamina la serratura', [
    'La serratura della porta è intatta. Nessun graffio, nessuno scasso.',
    'Chi è entrato aveva la chiave. O è entrato con qualcuno che ce l\'aveva. O era già dentro.',
  ], 1.6);
  clueSpot(A.prints, 'impronte', 'Esamina le impronte sulla vetrina', [
    'Sulla vetrina ci sono impronte. Appiccicose. Molto appiccicose.',
    'Chiunque le abbia lasciate aveva le dita piene di colla.',
  ], 1.6);
  clueSpot(A.bin, 'biglietto', 'Fruga nel bidone', [
    'Nel bidone: carta. Altra carta. Un disegno di un bidone (meta).',
    'E una ricevuta stropicciata: "Mercato Nero, asta di mezzanotte. Lotto 7: tappo giallo. Venditore: G."',
  ]);
  g.addInteractable({
    pos: A.case,
    label: () => 'Guarda la teca vuota',
    use: (g) => g.talk(narr(['Una teca vuota. Un cartellino: "Lotto 44: tappo giallo fluo, ottime condizioni. Leggermente sbiadito."', 'Sul cuscinetto è rimasta l\'impronta del tappo. Sembra triste.'])),
  });
  g.addInteractable({
    pos: A.poster,
    label: () => 'Leggi il cartello',
    use: (g) => g.talk(narr(['"CERCO TAPPI RARI. Pago bene. — M."', 'La calligrafia è ordinata. La M ha un ricciolo. Chissà chi è.'])),
  });
  g.addInteractable({
    pos: A.monument,
    radius: 2.6,
    label: () => 'Leggi la targa',
    use: (g) => g.talk(narr(['"ALL\'ANGOLO RETTO. 90 gradi di pura gloria."', 'Sotto, più piccolo: "Si prega di non misurarlo. È permaloso."'])),
  });
  g.addInteractable({
    pos: A.metro,
    radius: 2.6,
    label: () => 'Guarda la metro',
    use: (g) => g.talk(narr(['Metro a Quadretti. Tutte le linee sono dritte, tutte le fermate sono uguali.', 'Una volta un passeggero è sceso alla fermata giusta. Ne parlano ancora.'])),
  });

  // --- per frame ---
  const cars = [0, 1, 2].map((i) => ({ car: g.world.props[`car${i}`], pusher: g.npc(`spinta${i}`), nextHonk: 0 }));
  const fwd = new THREE.Vector3();
  g.onUpdate.push((g) => {
    const p = g.player.pos;
    const q = g.quest('c3');

    // arrivo al banco
    if (q === 0 && Math.hypot(p.x - A.shopDoor.x, p.z - A.shopDoor.z) < 6) g.setStep('c3', 1);
    // abbastanza indizi: si può accusare
    if (q === 2 && g.cluesFound.length >= CLUES_NEEDED) {
      g.setStep('c3', 3);
      g.toast("Hai abbastanza indizi per accusare qualcuno. Puoi anche continuare a indagare: più indizi hai, più sei sicuro.", 'info', 7000);
    }

    // auto spinte: la macchina sta davanti a chi la spinge; se ti metti in mezzo si fermano
    for (const c of cars) {
      const rot = c.pusher.body.root.rotation.y;
      fwd.set(Math.sin(rot), 0, Math.cos(rot));
      c.car.position.set(c.pusher.pos.x + fwd.x * 2.6, 0, c.pusher.pos.z + fwd.z * 2.6);
      c.car.rotation.y = rot;
      const rel = new THREE.Vector3(p.x - c.car.position.x, 0, p.z - c.car.position.z);
      const along = rel.dot(fwd);
      const side = Math.abs(rel.x * fwd.z - rel.z * fwd.x);
      const blocking = side < 1.4 && along > -2.2 && along < 4.2;
      if (!c.pusher.talking) {
        c.pusher.controlled = blocking;
        c.pusher.ctrlSpeed = 0;
      }
      if (blocking && g.time > c.nextHonk) {
        c.pusher.say(['Precedenza! PRECEDENZA!', 'Si sposti! Questa non ha i freni!', 'Pedone disegnato male!'][Math.floor(Math.random() * 3)], 2);
        c.nextHonk = g.time + 4;
      }
      // l'auto è solida: ti spinge fuori
      if (side < 1.05 && along > -2.05 && along < 2.05) {
        const push = 1.05 - side;
        const sign = rel.x * fwd.z - rel.z * fwd.x >= 0 ? 1 : -1;
        p.x += fwd.z * push * sign;
        p.z -= fwd.x * push * sign;
      }
    }

    // il turista arriva al monumento
    if (g.quest('turista') === 0 && !g.is('turistaArrivato')) {
      const t = g.npc('turista');
      // il monumento sta al centro della piazza (0, 0)
      if (Math.hypot(t.pos.x, t.pos.z) < 6 && !g.dialogue.isOpen) {
        g.flag('turistaArrivato');
        g.talk(touristArrival(g), t);
      }
    }

    // il mimo liberato va in piazza a esibirsi
    if (g.is('mimoFree') && !g.is('mimoWalking') && !g.dialogue.isOpen) {
      g.flag('mimoWalking');
      const m = g.npc('mimo');
      m.baseAction = 'push';
      m.setBehavior({ type: 'patrol', path: [[30, 1.5], [12, -11]], speed: 2, wait: 9999 });
    }

    // Gustavo arrestato: se ne va con l'ispettore (dopo il dialogo)
    if (g.is('gustavoArrested') && !g.is('gustavoGone') && !g.dialogue.isOpen) {
      g.flag('gustavoGone');
      const gu = g.npc('gustavo');
      gu.setBehavior({ type: 'patrol', path: [[-6, 21], [-20, 21]], speed: 1.4, wait: 9999 });
      gu.say('In triplice copia... in triplice copia...', 4);
      g.after(9, () => g.setHidden(gu, true));
    }

    // musica un po' ovattata dentro il negozio
    g.audio.setMusicMuffle(ZONES.shop(p) ? 1800 : 20000);

    // fine capitolo
    if (g.is('c3Finale') && !g.dialogue.isOpen && !g.is('c3Done')) {
      g.flag('c3Done');
      g.completeQuest('c3');
      g.after(0.8, () => g.completeChapter('Prossimamente: il Mercato Nero. Un\'asta di mezzanotte, un tappo e la prima pistola (a inchiostro).'));
    }
  });
}

export function startChapter3(g: Game) {
  if (g.quest('c3') === -1) g.startQuest('c3');
  g.audio.playMusic('indagine');
  g.after(0.6, () => g.chapter('CAPITOLO 3', 'Il Banco dei Pegni'));
  g.after(5, () => g.toast('Quadropoli: la città a quadretti. Tutte le strade sono dritte. Tutte uguali. Buona fortuna.', 'info', 6000));
}
