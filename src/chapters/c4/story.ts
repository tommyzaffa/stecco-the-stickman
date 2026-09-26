import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { HALL_H, REFS, ZONES } from './world';
import { auctionDialogue } from './characters';
import { crateLabel, crateUse, raidDrop, raidFaint, resetRaid, setupBarrels, startRaid, updateRaid } from './raid';
import { setupRange } from './range';

// Capitolo 4: buttafuori → armeria e poligono → mercato → asta → sparatoria → telefonata.

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

export function setupStory(g: Game) {
  const A = g.world.anchors;
  resetRaid();
  g.audio.birds = false;
  g.guns.ceiling = HALL_H;
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 1, -12), 30, 0.6);
  g.audio.addEmitter('hum', new THREE.Vector3(-12, 3, -46), 10, 0.8);
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi in fondo alle scale. Qualcuno ti ha già frugato. Non avevi niente');

  // --- monete ---
  g.addCoin(A.coinA.x, A.coinA.z, 'Una moneta dietro il palco. Qualcuno ha offerto e poi ci ha ripensato.');
  g.addCoin(A.coinB.x, A.coinB.z, 'Una moneta nell\'angolo. Nei mercati cade sempre qualcosa.');
  g.addCoin(A.coinC.x, A.coinC.z, 'Una moneta vicino alla linea di tiro. Forse era un bersaglio.');
  g.addCoin(A.coinD.x, A.coinD.z, 'Una moneta vicino al tubo della posta pneumatica. È tornata indietro.');

  // passaggi (per chi ti insegue fuori dal mercato)
  g.combat.nav = [[0, -34.5], [0, -38], [-2, -45], [-4.6, -45], [-27.5, 1], [27.5, 1]].map(([x, z]) => new THREE.Vector3(x, 0, z));

  setupRange(g);
  setupBarrels(g);
  g.onKo = (n) => raidDrop(g, n);
  g.onFaint = () => raidFaint(g);

  // --- cose da guardare ---
  g.addInteractable({
    pos: A.rules,
    radius: 2.6,
    label: () => 'Leggi il regolamento',
    use: (g) =>
      g.talk(
        narr([
          '"REGOLAMENTO DEL MERCATO NERO. Uno: non si ruba (senza permesso)."',
          '"Due: tutto è originale, tranne il falso. Tre: vietato sparare, salvo emergenze e antipatie."',
          '"Quattro: i reclami si fanno all\'uscita. L\'uscita è l\'entrata."',
          'In fondo, a matita: "Cinque: il regolamento può cambiare senza preavviso. Anche adesso."',
        ]),
      ),
  });
  g.addInteractable({
    pos: A.lotto,
    radius: 3.2,
    label: (g) => (g.world.props.lotto.visible ? 'Guarda il lotto 7' : null),
    use: (g) =>
      g.talk(
        narr([
          'Il tappo giallo fluo, su un cuscinetto di velluto disegnato. Un cartellino: "Lotto 7. Base d\'asta: 10 monete."',
          'È un po\' sbiadito. Da qualche parte, Don Fluo si sta sbiadendo allo stesso ritmo.',
        ]),
      ),
  });
  g.addInteractable({
    pos: A.tube,
    radius: 3,
    label: () => 'Guarda il tubo',
    use: (g) => g.talk(narr(['Un tubo che sale nel soffitto e sparisce. Ci soffia dentro un vento che sa di ufficio postale.', 'Un cartellino: "Non infilare animali, sentimenti o dita (tanto non le avete)."'])),
  });
  g.addInteractable({
    pos: A.ammoCrate,
    radius: 2,
    label: (g) => crateLabel(g),
    use: (g) => crateUse(g),
  });

  // --- la telefonata ---
  const call: Dialogue = {
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* Infili un gettone immaginario. La cabina lo accetta: è il pensiero che conta.',
          '* Tuuu... tuuu...',
          '@M.| Pronto? Chi parla?',
          '> Ciao. Sono Stecco. Hai appena comprato un tappo giallo, all\'asta.',
          '@M.| Ah! Il tappo fluo. È arrivato adesso, è ancora caldo di tubo. Bellissimo. Un po\' sbiadito, come piace a me.',
          '> Ecco... quel tappo sarebbe di un boss. Un boss che si sta sbiadendo.',
          '@Martina| E io sarei Martina. Una che colleziona tappi e non li rivende. Mai.',
        ],
        choices: [
          { t: 'Te lo ricompro. Quanto vuoi?', next: 'soldi' },
          { t: 'Ti prego. È una questione di vita o di sbiadimento.', next: 'drama' },
          { t: 'Allora vengo a prendermelo.', next: 'minaccia' },
        ],
      },
      soldi: {
        say: [(g) => `> Ho ${g.state.coins} monete.`, '@Martina| Non è in vendita. Però mi piace chi fa offerte con i soldi che non ha.'],
        next: 'cena',
      },
      drama: { say: ['@Martina| Drammatico. Mi piace il drammatico. Ma solo a teatro, e solo se c\'è l\'intervallo.'], next: 'cena' },
      minaccia: {
        say: [
          '@Martina| Ah sì? Io ho una collezione di tappi e un sacco di amici colorati. Tu cos\'hai?',
          '> Una pistola a inchiostro.',
          '@Martina| Blu. Carino. Si abbina ai miei occhi. Che sono rosa.',
        ],
        next: 'cena',
      },
      cena: {
        say: [
          '@Martina| Facciamo così. Sabato ceno da Pastello, alle otto. Se vuoi parlarne, vieni.',
          '@Martina| Ma ti avviso: mi annoio facilmente. Se mi annoi, il tappo resta mio. E tu resti a piedi.',
          '> È... un appuntamento?',
          '@Martina| È una trattativa. Con il dolce.',
          '* Click. Ha riattaccato.',
          '* Ti accorgi che stai ancora tenendo la cornetta. Senza mani. È più difficile di quanto sembri.',
        ],
        do: (g) => {
          g.flag('martinaCall');
          g.setStep('c4', 9);
        },
      },
    },
  };
  g.addInteractable({
    pos: A.phone,
    radius: 2.2,
    label: (g) => (g.quest('c4') === 8 ? 'Chiama il numero di "M."' : 'Telefono pubblico'),
    use: (g) =>
      g.quest('c4') === 8
        ? g.talk(call)
        : g.talk(narr(['Un telefono a gettoni immaginari. Non sai chi chiamare.', 'Chiami te stesso. Occupato.'])),
  });

  // --- per frame ---
  const marco = g.npc('marco');
  const banditore = g.npc('banditore');
  g.onUpdate.push((g) => {
    const p = g.player.pos;

    // il cancello si apre quando il buttafuori ti fa passare
    if (g.is('gateOpen') && REFS.gate) {
      g.world.colliders.remove(REFS.gate);
      REFS.gate = null;
      g.audio.door();
      marco.setBehavior({ type: 'follow', target: () => g.player.pos, dist: 2.6, speed: 4.4 });
      marco.faceWhenNear = true;
    }

    // l'asta comincia dopo che il banditore ha detto "si comincia"
    if (g.is('auctionGo') && !g.is('auctionOn') && !g.dialogue.isOpen) {
      g.flag('auctionOn');
      g.player.setLook(new THREE.Vector3(banditore.pos.x, banditore.topY - 0.2, banditore.pos.z));
      g.talk(auctionDialogue(), banditore);
    }
    // e finisce con i Pastelli
    if (g.is('raidStart') && !g.is('raidOn') && !g.dialogue.isOpen) {
      g.flag('raidOn');
      startRaid(g);
    }
    updateRaid(g);

    // musica ovattata fuori dal mercato
    g.audio.setMusicMuffle(ZONES.hall(p) ? 20000 : 1300);

    // fine capitolo
    if (g.is('c4Finale') && !g.dialogue.isOpen && !g.is('c4Done')) {
      g.flag('c4Done');
      g.completeQuest('c4');
      g.after(0.8, () =>
        g.completeChapter('Prossimamente: l\'appuntamento. Una cena da Pastello, una ragazza a colori e un tappo in palio. Niente pistole: solo parole. Sceglile bene.'),
      );
    }
  });
}

export function startChapter4(g: Game) {
  if (g.quest('c4') === -1) g.startQuest('c4');
  g.audio.playMusic('mercato');
  g.after(0.6, () => g.chapter('CAPITOLO 4', 'Il Mercato Nero'));
  g.after(5, () => g.toast('Sotto la stazione di Quadropoli. Qui tutto è incartato, anche le persone.', 'info', 6000));
}
