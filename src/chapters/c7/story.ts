import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { Stickman } from '../../entities/stickman';
import { TOUCH } from '../../touch';
import { keyName } from '../../settings';
import { CARRY, lift, setupFurniture, stow, updateCarry, type FurnId, type Furniture } from './carry';
import { BOXES, JUNK, PACK, addJunk, addPiece, openPack, resetPack } from './pack';
import { Q7 } from './quests';
import { FLOOR1, FURNITURE_AT, REFS7, VAN, floorAt, inside } from './world';

// Capitolo 7: Nonna Pina → quattro mobili giù per le scale con Marco → il cassone del furgone → si parte

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

export function setupStory(g: Game) {
  const A = g.world.anchors;
  Q7.delivered = 0;
  Q7.clues = new Set();
  resetPack();
  g.audio.birds = true;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi sul marciapiede');
  setupFurniture(g, REFS7.lm!, REFS7.fill!);
  if (import.meta.env.DEV) Object.assign(window, { __c7: { CARRY, PACK, Q7, lift, floorAt, addPiece, addJunk, openPack, BOXES } });

  g.addCoin(-6.5, 9.5, 'Una moneta sulla rampa delle scale. Qualcuno l\'ha persa traslocando. Nel millenovecento. Scherzo.', floorAt(-6.5, 9.5) + 0.9);
  g.addCoin(27, -4, 'Una moneta davanti alla ferramenta. Quadrata? No, rotonda.');

  // i mobili: si sollevano in due
  for (const id of Object.keys(FURNITURE_AT) as FurnId[]) {
    const at = FURNITURE_AT[id];
    g.addInteractable({
      pos: new THREE.Vector3(at.x, FLOOR1 + 0.8, at.z),
      radius: 2.8,
      label: (g) => (g.quest('c7') === 1 && !CARRY.current && CARRY.items[id].state === 'home' ? `Solleva ${CARRY.items[id].name} (con Marco)` : null),
      use: (g) => startLift(g, id),
    });
  }
  // il furgone: il cassone si può sempre riordinare
  g.addInteractable({
    pos: VAN.rear.clone().setY(1.2),
    radius: 3,
    label: (g) => (CARRY.current ? null : g.quest('c7') === 2 ? 'Carica gli scatoloni' : g.quest('c7') >= 1 && g.quest('c7') < 3 && PACK.pieces.length ? 'Riordina il cassone' : null),
    use: (g) => (g.quest('c7') === 2 ? finalPacking(g) : openPack(g, 'view', null, () => {})),
  });
  // il Vicolo Storto: cosa resta
  const clue = (id: string, pos: THREE.Vector3, label: string, lines: string[], give?: () => void) =>
    g.addInteractable({
      pos,
      radius: 2.8,
      icon: (g) => (g.quest('vicolo') === 1 && !Q7.clues.has(id) ? 'clue' : null),
      label: (g) => (g.quest('vicolo') === 1 && !Q7.clues.has(id) ? label : null),
      use: (g) =>
        g.talk(narr(lines), null, () => {
          Q7.clues.add(id);
          give?.();
          if (Q7.clues.size >= 2) g.setStep('vicolo', 2);
        }),
    });
  clue('cartello', A.vicoloCartello, 'Guarda il cartello', [
    'Il cartello dice "VICOLO ST". Il resto è cancellato.',
    'Chi cancella va di fretta: comincia dalle cose grandi e lascia le parole a metà.',
  ]);
  clue('briciole', A.vicoloBriciole, 'Guarda le briciole rosa', [
    'Un mucchietto di briciole di gomma. Rosa, arricciate, ancora tiepide.',
    'Ne raccogli una. Profuma di fragola.',
  ], () => g.give('briciola'));
  g.addInteractable({
    pos: A.vicoloPorta,
    radius: 2.2,
    label: () => 'Apri la porta',
    use: (g) => g.talk(narr(['Apri la porta. Dall\'altra parte c\'è il foglio bianco.', 'La richiudi. Per educazione.'])),
  });

  // arrivati al furgone con un mobile: si sistema nel cassone
  CARRY.onArrive = (g, f) => arriveAtVan(g, f);
  PACK.onRemoved = (id) => junkRemoved(g, id);

  g.onUpdate.push((g, dt) => {
    const p = g.player.pos;
    // il pavimento: scale e primo piano
    g.player.floor = floorAt(p.x, p.z);
    if (!PACK.open) updateCarry(g, dt);
    // chi cammina con te sale e scende le scale
    for (const id of ['marco', 'pallino', 'gatto']) {
      const n = g.npc(id);
      if (!n.controlled) n.pos.y = floorAt(n.pos.x, n.pos.z);
    }
    // la musica dentro casa si sente un po' meno
    g.audio.setMusicMuffle(inside(p) ? 2500 : 20000);

    // intro: Marco ti spiega
    if (!g.is('introAvviata') && g.chapterTime > 1.2 && !g.dialogue.isOpen) {
      g.flag('introAvviata');
      g.talk(g.specs.get('marco')!.dialogue!, g.npc('marco'));
    }
    // si parte: il furgone va via con Nonna Pina
    if (g.is('c7Parte') && !g.dialogue.isOpen && !g.is('c7Via')) {
      g.flag('c7Via');
      for (const id of ['pina', 'pallino', 'squadra', 'goniometro']) g.setHidden(g.npc(id), true);
      for (const d of REFS7.vanDoors) d.rotation.y = 0;
      if (REFS7.vanCol) g.world.colliders.remove(REFS7.vanCol);
      g.audio.stopMusic();
      g.after(4, () => {
        g.completeQuest('c7');
        g.fade(true);
        g.after(1.3, () => g.completeChapter('Prossimamente: la sagra di San Scarabocchio. Tiro ai barattoli, pesca dei tappi, la ruota. E Martina, che aspetta il suo tappo.'));
      });
    }
    if (g.is('c7Via') && REFS7.van) {
      const v = REFS7.van;
      v.position.x += Math.min(12, 2 + (v.position.x || 0) * 0.8) * dt;
    }
  });
}

export function startChapter7(g: Game) {
  if (g.quest('c7') === -1) g.startQuest('c7');
  g.audio.playMusic('trasloco');
  g.after(0.6, () => g.chapter('CAPITOLO 7', 'Il trasloco'));
}

// =========================================================================
// I MOBILI
// =========================================================================
function startLift(g: Game, id: FurnId) {
  lift(g, id);
  const f = CARRY.items[id];
  if (id === 'armadio' && !g.is('albumCaduto')) {
    g.flag('albumCaduto');
    g.after(0.7, () => {
      g.npc('marco').say('È caduto un album! Lo prendo io! Cioè, lo tengo col mento.', 3);
      g.give('album');
      g.startQuest('album');
    });
  }
  if (Q7.delivered === 0) {
    g.toast(
      TOUCH
        ? 'Il mobile gira con la visuale. Se non passa: torna un po\' indietro e giralo, oppure <b>GIRA</b>: tu e Marco vi scambiate i capi.'
        : `Il mobile gira con la visuale. Se non passa: torna un po' indietro e giralo, oppure <b>${keyName('interact')}</b>: tu e Marco vi scambiate i capi.`,
      'quest',
      8000,
    );
  }
  if (id === 'divano') g.toast(TOUCH ? '<b>ALZA</b> mette il divano in piedi: più corto, più lento.' : `<b>${keyName('jump')}</b> mette il divano in piedi: più corto, più lento.`, 'quest', 6000);
  g.npc('marco').say(pick(['Al mio tre. Uno... su!', 'Oh-issa!', 'Pesa! Cioè no. Cioè sì.', `Ciao, ${f.name.replace(/^(il |la |l')/, '')}. Andiamo a fare un giro.`]), 2.5);
}

function arriveAtVan(g: Game, f: Furniture) {
  if (PACK.open) return;
  const piece = PACK.pieces.find((p) => p.id === f.id) ?? addPiece(f.id, false);
  openPack(g, 'one', piece, () => {
    stow(g, f);
    Q7.delivered++;
    g.addXp(20);
    g.audio.good();
    // Marco "aiuta": carica qualcosa che non è di Nonna Pina
    const junk = JUNK[Q7.delivered - 1];
    if (junk) {
      g.after(2.5, () => {
        const j = addJunk(junk);
        if (!j) return;
        if (junk === 'gatto') g.flag('gattoCaricato');
        const m = g.npc('marco');
        m.say(
          junk === 'cassetta'
            ? 'Ho caricato anche la cassetta della posta! Era davanti a casa di Nonna Pina, quindi è sua. No?'
            : junk === 'gatto'
              ? 'C\'era un gatto sul furgone. L\'ho sistemato dietro. Era sul furgone, quindi è nostro.'
              : 'Ho messo dentro anche il cartello STOP. Così alla nuova casa sanno dove fermarsi.',
          5,
        );
        g.toast(`Marco ha caricato: <b>${j.name}</b>. Non è di Nonna Pina.`, 'bad', 5000);
      });
    }
    if (Q7.delivered >= 4) {
      g.setStep('c7', 2);
      g.after(1.5, () => g.npc('pina').say('Gli scatoloni sono pronti! Sistemateli voi, io ho l\'età.', 4));
    } else g.npc('marco').say(pick(['Uno giù! Tre su. Cioè, tre da portare giù.', 'Fatto! Il prossimo lo porto io davanti. No, dietro.', 'Io lo sapevo che ci stava.']), 3);
  });
}

function finalPacking(g: Game) {
  if (!PACK.pieces.some((p) => p.kind === 'scatola')) for (const id of BOXES) addPiece(id);
  openPack(g, 'all', null, () => {
    g.setStep('c7', 3);
    g.addXp(40);
    g.npc('pina').say('Tutto dentro? Anche i centrini? Allora si parte!', 4);
  });
}

function junkRemoved(g: Game, id: string) {
  if (id !== 'gatto') return;
  const cat = g.npc('gatto');
  g.setHidden(cat, false);
  if (g.quest('gatto') === -1) g.startQuest('gatto');
  g.setStep('gatto', 1);
  if (cat.body instanceof Stickman) cat.body.action = 'none';
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
