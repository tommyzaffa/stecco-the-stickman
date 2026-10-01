import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import { Sketch } from '../../render/sketch';
import { TOUCH } from '../../touch';
import { keyName } from '../../settings';
import { N10, calmAll, emit, landNoise, setupNoise, sleeper, stepNoise, updateNoise, type Sleeper } from './noise';
import { Q10 } from './quests';
import { EAST, H, REFS10, WEST, floorAt, levelOf } from './world';

// Capitolo 10: il condominio. La prima notte nella casa nuova, senza cuscino: il pacco è finito al
// 3° piano. Su e giù per i corridoi senza svegliare nessuno → a casa → la mattina, Nonna Pina.

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });
const crouchKey = () => (TOUCH ? 'GIÙ' : keyName('crouch'));

// il pacco in braccio: davanti a te, in basso
let carried: THREE.Group | null = null;

export function setupStory(g: Game) {
  const A = g.world.anchors;
  setupNoise();
  Q10.phone = false;
  Q10.dripT = 1;
  Q10.check = { pos: A.spawn.clone(), yaw: Math.atan2(-(A.spawnLook.x - A.spawn.x), -(A.spawnLook.z - A.spawn.z)), pacco: false };
  g.audio.birds = false;
  g.hideNameTags = true; // i nomi si vedrebbero attraverso i soffitti (gli altri piani)
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi in casa');
  g.onStep = (running, crouching) => stepNoise(g, running, crouching);
  g.onLand = () => landNoise(g);
  g.onLine = (l) => {
    // al telefono Marco urla (si sente in tutto il pianerottolo)
    if (l.who === 'Marco' && Q10.call) emit(1.5, g.player.pos);
  };
  N10.onWake = (s) => wake(g, s);
  if (import.meta.env.DEV) Object.assign(window, { __c10: { N10, Q10, REFS10, takePacco, calmAll, floorAt, levelOf } });

  // il pacco portato in braccio (si vede in basso, davanti)
  {
    const s = new Sketch();
    s.style = { jitter: 0.004, over: 0.012 };
    s.box(0, 0, 0, 0.55, 0.38, 0.4);
    s.seg(-0.27, 0.38, 0, 0.27, 0.38, 0);
    carried = new THREE.Group();
    carried.add(s.build(REFS10.lm!, REFS10.fill!));
    carried.visible = false;
    g.world.group.add(carried);
  }

  g.addCoin(29.8, 9.3, 'Una moneta sul pianerottolo. Qualcuno l\'ha persa salendo, o scendendo, o pensando.', 0.6);
  coinAt(g, 22.8, H, 6.6, 'Una moneta sotto la passatoia del 1° piano. La passatoia la proteggeva dal rumore.');
  coinAt(g, -6.2, 2 * H, 9.3, 'Una moneta sul pianerottolo della scala di servizio. Le scale di servizio servono anche a questo.');

  // --- la cassetta della posta (piano terra) ---
  g.addInteractable({
    pos: new THREE.Vector3(A.mailbox.x, A.mailbox.y, A.mailbox.z),
    radius: 2.2,
    label: (g) => (here(g, 0) && g.quest('lettera') === -1 ? 'Guarda nella tua cassetta (int. 1)' : null),
    use: (g) =>
      g.talk(
        narr([
          'Apri la cassetta. Piano: lo sportellino cigola, ma solo un po\'.',
          'Dentro c\'è una lettera. Non è per te: "Famiglia Righello, interno 8, 2° piano". Sulla busta: URGENTE (ma non di notte).',
          'Il postino si confonde con gli interni. È di famiglia, qui.',
        ]),
        null,
        () => {
          g.give('letteraRighello');
          g.startQuest('lettera');
        },
      ),
  });
  // --- le pantofole sullo zerbino di Nonna Pina ---
  g.addInteractable({
    pos: new THREE.Vector3(12, 0.3, 6.5),
    radius: 1.9,
    label: (g) => (here(g, 0) && !g.has('pantofole') && !g.is('c10Pantofole') ? 'Prendi quello che c\'è sullo zerbino di Nonna Pina' : null),
    use: (g) =>
      g.talk(
        {
          name: '',
          start: 'a',
          nodes: {
            a: {
              say: [
                '* Sullo zerbino dell\'interno 2 ci sono due pantofole di feltro, e un biglietto.',
                '* "Per il vicino nuovo. Di notte qui si sente tutto, anche i pensieri. Le pantofole aiutano. — Pina".',
                '* Non hai i piedi. Le pantofole le calpesti, e basta. Ma fanno il loro lavoro: i passi si sentono meno.',
              ],
            },
          },
        },
        null,
        () => {
          g.flag('c10Pantofole');
          g.give('pantofole');
          N10.pantofole = true;
          if (REFS10.pantofole) REFS10.pantofole.visible = false;
          g.addXp(20);
          if (g.quest('pantofole') === -1) g.startQuest('pantofole');
          g.completeQuest('pantofole');
        },
      ),
  });
  // --- il rubinetto della lavanderia ---
  g.addInteractable({
    pos: new THREE.Vector3(A.tap.x, A.tap.y, A.tap.z),
    radius: 2.2,
    label: (g) => (here(g, 0) && !g.is('c10Rubinetto') ? 'Chiudi il rubinetto' : null),
    use: (g) => {
      g.flag('c10Rubinetto');
      const baby = sleeper('neonato');
      baby.floor = 0;
      baby.alert = Math.max(0, baby.alert - 0.25);
      REFS10.drop!.visible = false;
      g.audio.select();
      g.toast('Il rubinetto non gocciola più. Al 3° piano, nel tubo che passa da casa sua, il neonato smette di agitarsi.', 'quest', 5500);
      if (g.quest('rubinetto') === -1) g.startQuest('rubinetto');
      g.addXp(25);
      g.addCoins(5);
      g.completeQuest('rubinetto');
    },
  });
  // --- la lettera sotto la porta dei Righello (2° piano) ---
  g.addInteractable({
    pos: new THREE.Vector3(A.righelloDoor.x, A.righelloDoor.y + 0.3, A.righelloDoor.z + 0.3),
    radius: 1.8,
    label: (g) => (here(g, 2) && g.has('letteraRighello') ? 'Infila la lettera sotto la porta' : null),
    use: (g) => {
      g.take('letteraRighello');
      emit(0.3, g.player.pos);
      g.audio.whoosh();
      g.toast('Fsss. La lettera scivola sotto la porta. Domattina i Righello la troveranno, e daranno la colpa al postino.', 'info', 5000);
      g.addXp(30);
      g.addCoins(10);
      g.completeQuest('lettera');
    },
  });
  // --- il pacco ---
  g.addInteractable({
    pos: new THREE.Vector3(A.pacco.x, A.pacco.y, A.pacco.z),
    radius: 1.9,
    label: (g) => (here(g, 3) && !N10.pacco && g.quest('c10') === 0 ? 'Prendi il pacco (piano...)' : null),
    use: (g) => takePacco(g),
  });

  g.onUpdate.push((g, dt) => update(g, dt));
}

const here = (g: Game, level: number) => levelOf(g.player.pos.y) === level && !N10.over;

function coinAt(g: Game, x: number, y: number, z: number, msg: string) {
  g.addCoin(x, z, msg, y + 0.6);
}

export function startChapter10(g: Game) {
  if (g.quest('c10') === -1) g.startQuest('c10');
  g.audio.playMusic('notturno');
  g.after(0.6, () => g.chapter('CAPITOLO 10', 'Il condominio'));
  g.after(3.2, () => g.talk(intro(), null));
}

function intro(): Dialogue {
  return {
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* Via della Penna 3, interno 1. La prima notte nella casa nuova.',
          '* Qui è tutto a penna: muri, porte, scale. La gomma non ci passa. Lo dice Nonna Pina, che abita di fronte.',
          '* Manca solo una cosa: il cuscino. È nel pacco del trasloco. E il pacco non c\'è.',
          '* Sul telefono, un messaggio del corriere: "Consegnato all\'interno 12, 3° piano. L\'1 e il 12 si assomigliano. Buonanotte."',
          '> Sono le tre. Il condominio dorme. Io, senza cuscino, no.',
          '* Nell\'androne c\'è il regolamento. Articolo 1: dopo le 22 si cammina col pensiero. Articolo 2: chi sveglia un vicino, va all\'assemblea.',
        ],
        next: 'b',
      },
      b: {
        say: [
          (_g) => `* Ogni passo fa rumore. Di corsa, tantissimo; accovacciato (${crouchKey()}), pochissimo. Le assi segnate di giallo scricchiolano; tappeti e cartone no.`,
          '* Sopra le porte dei vicini vedrai come dormono. Se compare "mmh?", fermati e aspetta: si riaddormentano.',
          '* Sotto la porta, un biglietto di Nonna Pina: "Ti ho lasciato una cosa sul mio zerbino. — Pina".',
        ],
        do: (g) => g.startQuest('pantofole'),
      },
    },
  };
}

// =========================================================================
// A OGNI FRAME
// =========================================================================
function update(g: Game, dt: number) {
  const p = g.player;
  const A = g.world.anchors;
  // il pavimento sotto i piedi (scale comprese) e le collisioni del piano su cui sei
  p.floor = floorAt(p.pos.x, p.pos.z, p.pos.y);
  const lv = levelOf(p.pos.y);
  g.world.colliders.level = lv;
  updateNoise(g, dt);

  // il pacco in braccio
  if (carried) {
    carried.visible = N10.pacco;
    if (N10.pacco) {
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const e = p.eye;
      carried.position.set(e.x + fx * 0.75, e.y - 0.62, e.z + fz * 0.75);
      carried.rotation.set(0, p.yaw, 0);
    }
  }

  // la goccia del rubinetto: PLIC (si sente al piano terra; nel tubo arriva fino al neonato)
  if (!g.is('c10Rubinetto')) {
    Q10.dripT -= dt;
    const drop = REFS10.drop!;
    drop.position.y = 1.2 - Math.max(0, 1 - Q10.dripT / 0.4) * 0.3;
    if (Q10.dripT <= 0) {
      Q10.dripT = 1.6;
      const d = Math.hypot(p.pos.x - A.tap.x, p.pos.z - A.tap.z);
      if (lv === 0 && d < 14) g.audio.drip(Math.max(0.15, 1 - d / 14));
      if (lv === 0 && d < 7 && g.quest('rubinetto') === -1) g.startQuest('rubinetto');
    }
  }

  // i pianerottoli: si riprova da qui (con o senza pacco, com'eri)
  if (!N10.over && !g.dialogue.isOpen) {
    for (const w of [EAST, WEST]) {
      if (p.pos.x > w.x0 + 0.5 && p.pos.x < w.x1 - 0.5 && p.pos.z > 6.6 && p.pos.z < 9.6 && Math.abs(p.pos.y - lv * H) < 0.05 && w.floors.includes(lv)) {
        const cx = (w.x0 + w.x1) / 2;
        if (Math.abs(Q10.check.pos.x - cx) > 0.1 || Math.abs(Q10.check.pos.y - lv * H) > 0.1 || Q10.check.pacco !== N10.pacco) {
          Q10.check = { pos: new THREE.Vector3(cx, lv * H, 8.3), yaw: w === EAST ? Math.PI / 2 : -Math.PI / 2, pacco: N10.pacco };
        }
      }
    }
  }

  // la telefonata di Marco: col pacco, arrivato al pianerottolo del 2° piano (accanto al signor Chiodo)
  if (N10.pacco && !Q10.phone && lv === 2 && p.pos.x > 24.5 && p.pos.z > 6.6 && Math.abs(p.pos.y - 2 * H) < 0.05 && !g.dialogue.isOpen && !N10.over) {
    Q10.phone = true;
    phoneCall(g);
  }
  if (Q10.ringing) {
    Q10.ringT -= dt;
    if (Q10.ringT <= 0) {
      Q10.ringT = 1.15;
      g.audio.phone();
      emit(1.1, p.pos);
    }
  }

  // a casa col pacco: fine
  if (N10.pacco && lv === 0 && p.pos.x > 16.3 && p.pos.z > 9.4 && !g.is('c10Casa') && !g.dialogue.isOpen && !N10.over) {
    g.flag('c10Casa');
    homeAgain(g);
  }
  if (g.is('c10Fine') && !g.dialogue.isOpen && !g.is('c10Via')) {
    g.flag('c10Via');
    g.after(2, () => {
      g.completeQuest('c10');
      g.fade(true);
      g.after(1.3, () =>
        g.completeChapter('Prossimamente: Modulo 27-B. Per la residenza nuova serve un modulo. Per il modulo serve un altro modulo. All\'Ufficio Protocollo di Quadropoli gli sportelli chiudono quando arrivi tu.'),
      );
    });
  }
}

// =========================================================================
// IL PACCO
// =========================================================================
export function takePacco(g: Game) {
  N10.pacco = true;
  REFS10.pacco!.visible = false;
  g.give('paccoStecco');
  g.player.speedMul = 0.85;
  emit(0.4, g.player.pos);
  g.setStep('c10', 1);
  Q10.check = { pos: g.player.pos.clone(), yaw: g.player.yaw, pacco: true };
  g.toast('Il pacco pesa: col pacco in braccio i passi fanno più rumore. Piano, adesso. Si torna giù.', 'quest', 5500);
}

// =========================================================================
// QUALCUNO SI SVEGLIA
// =========================================================================
function wake(g: Game, s: Sleeper) {
  const p = g.player;
  const msg: Record<string, [string, string]> = {
    portinaia: ['La portinaia si è svegliata', '«Chi va là? Alle tre di notte?» Accende la luce, prende il quaderno delle assemblee e scrive il tuo nome. In stampatello.'],
    cane: ['Biscotto si è svegliato', '«BAU! BAU! BAU!» Si accendono tre luci, poi quattro. Domani all\'assemblea si parlerà di te. E di Biscotto, che ha fatto il suo dovere.'],
    chiodo: ['Il signor Chiodo si è svegliato', '«CHI È CHE CAMMINA ALLE TRE DI NOTTE?!» TUM, TUM, TUM: batte sul muro col martello. Adesso sono svegli tutti.'],
    neonato: ['Il neonato si è svegliato', '«UÈÈÈÈ!» Il pianto sale le scale, scende le scale, entra in tutte le case. Il condominio è sveglio. L\'assemblea è convocata.'],
  };
  if (s.id === 'cane') {
    const d = g.npc('biscotto');
    d.body.root.rotation.z = 0;
    d.pos.y = s.level * H;
    for (let i = 0; i < 3; i++) g.after(i * 0.35, () => g.audio.bark(d.pos));
  } else if (s.id === 'chiodo') g.audio.thumps(4);
  else if (s.id === 'neonato') g.audio.cry();
  else g.audio.hic();
  if (Q10.ringing) Q10.ringing = false;
  g.hud.popWord(new THREE.Vector3(s.x, s.level * H + 1.8, s.z - 0.4), p.camera, s.id === 'cane' ? 'BAU!' : s.id === 'neonato' ? 'UÈÈÈ!' : s.id === 'chiodo' ? 'TUM! TUM!' : 'CHI VA LÀ?');
  g.after(1.6, () => {
    const [title, text] = msg[s.id];
    g.gameOver(title, `${text}<br><br>Si riprova dall'ultimo pianerottolo.`, () => retry(g));
  });
}

function retry(g: Game) {
  const p = g.player;
  calmAll();
  const c = Q10.check;
  p.pos.copy(c.pos);
  p.floor = c.pos.y;
  p.vy = 0;
  p.yaw = c.yaw;
  p.pitch = 0;
  p.setCrouch(false);
  g.world.colliders.level = levelOf(c.pos.y);
  // com'eri al pianerottolo: col pacco o senza
  if (!c.pacco && N10.pacco) {
    N10.pacco = false;
    REFS10.pacco!.visible = true;
    g.take('paccoStecco');
    p.speedMul = 1;
    g.setStep('c10', 0, true);
  }
  const d = g.npc('biscotto');
  d.body.root.rotation.z = 1.35;
  d.pos.y = H + 0.08;
  Q10.ringing = false;
}

// =========================================================================
// LA TELEFONATA DI MARCO (sul pianerottolo del 2° piano, col pacco in braccio)
// =========================================================================
function phoneCall(g: Game) {
  Q10.ringing = true;
  Q10.ringT = 0;
  const stop = () => {
    Q10.ringing = false;
  };
  g.talk(
    {
      name: '',
      start: 'a',
      nodes: {
        a: {
          say: ['* Il telefono squilla. DRIIIN. Di notte, sul pianerottolo, sembra una sirena. È Marco.'],
          timer: 5,
          timeout: 'tardi',
          choices: [
            { t: 'Rispondi (sottovoce)', do: stop, next: 'b' },
            { t: 'Rifiuta la chiamata', do: stop, next: 'rifiuta' },
          ],
        },
        tardi: {
          do: (g) => {
            emit(1.5, g.player.pos);
            stop();
          },
          say: ['* Squilla ancora. E ancora. Poi smette. Il pianerottolo trattiene il fiato.', '* Di là dalla porta, il signor Chiodo si gira nel letto.'],
        },
        rifiuta: {
          say: ['* Rifiuti la chiamata. Arriva un messaggio: "STECCO SEI SVEGLIO??? IO SÌ!!!". Spegni il telefono.'],
        },
        b: {
          do: () => (Q10.call = true),
          say: ['@Marco| STECCO! SEI SVEGLIO? IO SÌ! NON RIESCO A DORMIRE!', '> (sottovoce) Marco. Sono le tre. Sto recuperando il mio pacco.', '@Marco| IL TUO PACCO?! DI NOTTE?! CHE AVVENTURA!'],
          choices: [
            { t: 'Parla piano!', next: 'piano' },
            { t: 'Ti richiamo domani.', next: 'bye' },
          ],
        },
        piano: {
          say: ['@Marco| (sottovoce) ...così? ...COSÌ VA BENE?', '> Peggio.'],
          next: 'bye',
        },
        bye: {
          say: ['@Marco| VA BENE! BUONANOTTE! SALUTAMI I VICINI!', '* Riattacchi. Di là dalla porta, il signor Chiodo si gira nel letto.'],
          do: () => (Q10.call = false),
        },
      },
    },
    null,
    () => {
      Q10.call = false;
      stop();
    },
  );
}

// =========================================================================
// A CASA, E LA MATTINA
// =========================================================================
function homeAgain(g: Game) {
  g.talk(
    {
      name: '',
      start: 'a',
      nodes: {
        a: {
          say: [
            '* Sei a casa. Chiudi la porta. Piano. Ancora più piano.',
            '* Nessuno si è svegliato. Il condominio dorme, come se niente fosse. Niente è stato: sei stato tu.',
            '* Apri il pacco. Il cuscino. Una tazza. Una foto di Marco con la faccia da giudice.',
            '* E una busta dell\'Ufficio Protocollo di Quadropoli: "Per il cambio di residenza presentarsi con il Modulo 27-B. Il Modulo 27-B si richiede con il Modulo 27-A".',
            '> Domani. Adesso, il cuscino.',
          ],
          next: 'mattina',
        },
        mattina: {
          do: (g) => {
            N10.pacco = false;
            g.take('paccoStecco');
            g.player.speedMul = 1;
            g.fade(true);
            g.audio.playMusic('paese');
            g.after(1.2, () => {
              const pina = g.npc('pina');
              g.setHidden(pina, false);
              pina.pos.set(20, 0, 8.4);
              g.player.pos.set(20.4, 0, 10.6);
              g.player.setLook(new THREE.Vector3(20, 1.4, 8.4));
              g.fade(false);
              g.audio.door();
            });
          },
          say: ['* La mattina. Qualcuno bussa: toc, toc. Piano. Sa come si fa.'],
          next: 'pina',
        },
        pina: {
          say: [
            '@Nonna Pina| Buongiorno, vicino! Hai trovato le pantofole? Hai dormito?',
            '> Benissimo. Alla fine.',
            '@Nonna Pina| Io benissimo. Sono sorda da un orecchio: quello buono.',
            '@Nonna Pina| Però il signor Chiodo dice che stanotte sulle scale c\'era un fantasma. Uno senza mani, con un pacco.',
            '> Un fantasma molto educato.',
            '@Nonna Pina| Lo dicevo io. Qui a Via della Penna anche i fantasmi rispettano il regolamento. Ti ho portato il caffè. Disegnato, ma caldo.',
          ],
          next: 'fine',
        },
        fine: {
          say: [],
          do: (g) => {
            g.flag('c10Fine');
            g.addXp(80);
            g.addCoins(20);
          },
        },
      },
    },
    null,
  );
}
