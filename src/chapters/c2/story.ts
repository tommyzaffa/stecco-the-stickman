import { parryName } from '../../settings';
import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import type { Behavior } from '../../entities/npc';
import { Stickman } from '../../entities/stickman';
import { ZONES, NAV, openDoor } from './world';
import { openRope, rosaDances } from './characters';
import { keyName } from '../../settings';

// Capitolo 2: fila → dentro → ufficio (tre strade) → tappo sbagliato → rissa → fuga → vicolo.

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });

const FLUO_TALK: Dialogue = {
  name: 'Don Fluo',
  start: 'a',
  nodes: {
    a: {
      say: [
        'Bene, bene, bene.',
        'Un omino grigio nel mio ufficio. Che colore interessante: nessuno.',
        'Sono Don Fluo. Capo degli Evidenziatori, proprietario del Parallelepipedo e, fino a ieri, di un tappo.',
        "> Gliel'ho riportato! È nella teca!",
        '* Don Fluo si avvicina alla teca. Da vicino è pallidissimo: il suo giallo è quasi color panna.',
        'Vediamo...',
        '...',
        'Questo è il tappo di una BIRO.',
        '> ...No?',
        'È BLU. È di plastica economica. C\'è scritto sopra "Penna Fantastica 0,5".',
        '> Potrebbe essere un modello nuovo.',
        'Mi sto SBIADENDO e tu mi porti il tappo di una BIRO?!',
        'Ragazzi. Evidenziatelo.',
        "@Evidenziatore Giallo| Ancora tu. Te l'avevo detto che ti avevo evidenziato.",
      ],
      choices: [
        { t: 'Posso spiegare.', next: 'spiega' },
        { t: '(Alza i pugni)', next: 'pugni' },
      ],
    },
    spiega: {
      say: ['@Evidenziatore Giallo| Spiegalo ai miei pugni.', () => `* Loro parano sempre. Aspetta che attacchino, para con ${parryName()}, poi colpisci finché sono scoperti.`],
    },
    pugni: {
      say: ['Almeno ha stile. Poco. Grigio. Ma ha stile.', () => `* Loro parano sempre. Aspetta che attacchino, para con ${parryName()}, poi colpisci finché sono scoperti.`],
    },
  },
};

export function setupStory(g: Game) {
  const A = g.world.anchors;
  g.audio.birds = false;
  g.audio.addEmitter('crowd', new THREE.Vector3(0, 1, -6), 26);
  // la parte furtiva finisce quando arrivi in ufficio
  g.combat.restricted = (p) => g.quest('c2') <= 3 && (ZONES.vip(p) || ZONES.corridor(p) || ZONES.office(p));
  g.combat.nav = NAV.map(([x, z]) => new THREE.Vector3(x, 0, z));
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi sul marciapiede. La fila ti guarda con compassione');

  // posizioni e comportamenti iniziali delle guardie (per rimetterle a posto dopo uno svenimento)
  const guards = ['rosa', 'verde', 'arancione', 'azzurro'].map((id) => {
    const n = g.npc(id);
    return { n, pos: n.pos.clone(), rot: n.body.root.rotation.y, behavior: n.behavior as Behavior, seated: n.body instanceof Stickman && n.body.seated };
  });
  const resetGuards = () => {
    for (const s of guards) {
      const f = s.n.fighter!;
      if (f.ko) continue;
      if (s.n.id === 'rosa' && g.is('sbiadisco')) {
        f.reset();
        s.n.controlled = false;
        s.n.pos.set(3.5, 0, -5.2);
        continue;
      }
      f.reset();
      s.n.controlled = false;
      s.n.pos.copy(s.pos);
      s.n.body.root.rotation.y = s.rot;
      s.n.setBehavior(s.behavior);
      if (s.n.body instanceof Stickman) s.n.body.seated = s.seated;
    }
  };

  // --- monete ---
  g.addCoin(A.coinDj.x, A.coinDj.z, 'Dietro la consolle. Il DJ non conta le monete, conta i battiti.');
  g.addCoin(A.coinBath.x, A.coinBath.z, 'Una moneta vicino al water. Non chiederti come ci sia arrivata.', 0.5);
  g.addCoin(A.coinAlley.x, A.coinAlley.z, 'Una moneta sul cassonetto. Il vicolo dà, il vicolo toglie.', 1.6);
  g.addCoin(12, 9.4, 'Una moneta nella zona VIP. Qui le perdono per noia.');

  // --- oggetti ---
  const obj = (pos: THREE.Vector3, label: (g: Game) => string | null, use: (g: Game) => void, radius = 2) =>
    g.addInteractable({ pos, label, use, radius });

  obj(A.coaster, () => (g.world.props.coaster.visible ? 'Prendi il sottobicchiere' : null), (g) => {
    g.world.props.coaster.visible = false;
    g.give('sottobicchiere');
    if (g.quest('dj') === 0) g.setStep('dj', 1);
  });
  obj(A.sock, () => (g.world.props.sock.visible ? 'Raccogli il calzino spaiato' : null), (g) => {
    g.world.props.sock.visible = false;
    g.give('calzino');
    g.toast('Un calzino. Nessuno qui ha i piedi. Il mistero si infittisce.', 'info', 4500);
  });

  obj(A.rope, () => (g.world.props.rope.visible ? (g.player.pos.z > 7.6 ? 'Passa sotto il cordone (torna in sala)' : 'Passa sotto il cordone') : null), (g) => {
    // dalla zona VIP verso la sala: chi esce non è un problema di Rosa
    if (g.player.pos.z > 7.6) {
      g.player.pos.set(8, 0, 5.8);
      return;
    }
    const rosa = g.npc('rosa');
    const onDuty = !rosa.fighter!.ko && !g.is('sbiadisco') && !rosa.fighter!.hostile;
    if (onDuty && rosa.pos.distanceTo(A.rosa) < 3) {
      g.talk(g.specs.get('rosa')!.dialogue!, rosa);
      return;
    }
    g.player.pos.set(8, 0, 9.4);
    g.toast('Sei nella zona VIP. Muoviti con calma: sei grigio, ti confondi col muro.', 'info', 4500);
  }, 2.2);

  obj(A.staffDoor, () => (g.world.props.staffDoor.visible ? (g.has('chiave') ? 'Apri la porta di servizio' : 'Porta "SOLO PERSONALE"') : null), (g) => {
    if (!g.has('chiave')) {
      g.talk(narr(['È chiusa a chiave.', 'C\'è scritto SOLO PERSONALE. Tu non sei personale. Sei a malapena una persona.']));
      return;
    }
    openDoor(g.world, 'staffDoor');
    g.audio.door();
    g.toast(`Porta aperta. Oltre c'è il corridoio di servizio: resta accovacciato (${keyName('crouch')}) e sfrutta le casse.`, 'info', 6000);
  });

  obj(A.backExit, () => (g.world.props.backExit.visible ? 'Uscita di emergenza' : null), (g) =>
    g.talk(narr(['Chiusa. C\'è scritto: "Aprire solo in caso di emergenza. O di Marco."'])),
  );

  obj(A.teca, (g) => (g.quest('c2') === 4 ? 'Rimetti il tappo nella teca' : 'Guarda la teca'), (g) => {
    if (g.quest('c2') === 4) officeScene(g);
    else if (g.quest('c2') > 4) g.talk(narr(['Nella teca c\'è il tappo di una biro. Sembra imbarazzato.']));
    else g.talk(narr(['Una teca vuota. Un cuscinetto con l\'impronta di un tappo.']));
  });
  obj(new THREE.Vector3(12.5, 1, 19.4), () => 'Guarda la scrivania', (g) =>
    g.talk(narr(['Sulla scrivania c\'è una lista.', '"Cose da evidenziare: 1) il caveau della Banca dei Soldi. 2) Quadropoli. 3) TUTTO."', 'Qualcuno ha disegnato un cuoricino giallo vicino a "TUTTO".'])),
  );
  obj(new THREE.Vector3(17, 1, 20.4), () => 'Guarda la cassaforte', (g) =>
    g.talk(narr(['Una cassaforte. Sopra c\'è un post-it: "combinazione: giallo, giallo, giallo".', 'Non ci sono numeri. Solo gialli.'])),
  );
  obj(new THREE.Vector3(12.5, 2.5, 21.6), () => 'Guarda il ritratto', (g) =>
    g.talk(narr(['Il ritratto ufficiale di Don Fluo.', 'L\'hanno ridisegnato tre volte. Ogni volta il giallo era più pallido.'])),
  );
  obj(new THREE.Vector3(-17.6, 1.6, 12), () => 'Guardati allo specchio', (g) =>
    g.talk(narr(['Ti guardi allo specchio.', 'Al buio, col gesso, sembri un fantasma. Un fantasma stilizzato. Comunque bellissimo.'])),
  );

  // --- svenimenti: dove si riparte dipende dalla fase ---
  g.onFaint = () => {
    const q = g.quest('c2');
    if (q <= 4) {
      g.combat.calmAll();
      resetGuards();
    }
  };

  // --- per frame ---
  const tiles = g.world.props.tiles;
  const beams = g.world.props.beams;
  const ball = g.world.props.ball;
  let wasCaught = false;
  g.onUpdate.push((g, dt) => {
    const p = g.player.pos;
    const q = g.quest('c2');

    // luci a tempo di musica
    const b = g.audio.ready && g.audio.music?.playing ? g.audio.beat() : { phase: (g.time * 124 / 60) % 1, index: Math.floor((g.time * 124) / 60) };
    for (const t of tiles.children as THREE.Mesh[]) {
      const { ix, iz } = t.userData;
      const on = (ix + iz + b.index) % 4 === 0 || (ix * 3 + iz * 5 + b.index * 7) % 11 === 0;
      (t.material as THREE.MeshBasicMaterial).opacity = on ? 0.12 + 0.5 * (1 - b.phase) : 0.1;
    }
    beams.children.forEach((pv) => {
      const ph = pv.userData.phase + g.time * 0.7;
      pv.rotation.set(Math.sin(ph) * 0.45, 0, Math.cos(ph * 1.3) * 0.45);
    });
    ball.rotation.y += dt * 0.6;

    // musica ovattata a seconda della stanza
    let muffle = 20000;
    if (!ZONES.inside(p)) muffle = ZONES.alley(p) ? 280 : 360;
    else if (ZONES.entrance(p)) muffle = 1600;
    else if (ZONES.vip(p)) muffle = 7000;
    else if (ZONES.bathroom(p)) muffle = 900;
    else if (ZONES.corridor(p)) muffle = 650;
    else if (ZONES.office(p)) muffle = 1100;
    g.audio.setMusicMuffle(muffle);

    // Sbiadisco!
    if (g.is('sbiadisco') && !g.is('sbiadiscoOn')) {
      g.flag('sbiadiscoOn');
      g.audio.playMusic('sbiadisco');
      g.after(1.5, () => {
        rosaDances(g);
        g.toast('Rosa ha lasciato il cordone per ballare! La zona VIP è libera.', 'quest', 5000);
      });
    }
    if (g.is('rosaBribed')) openRope(g);

    // arrivato in ufficio
    if (q === 3 && ZONES.office(p)) {
      g.setStep('c2', 4);
      g.setCheckpoint(new THREE.Vector3(9, 0, 18.6), A.teca, 'Ti rialzi nell\'ufficio. Nessuno ti ha visto svenire. Imbarazzante lo stesso');
    }

    // scoperto durante la parte furtiva
    const caught = q === 3 && g.combat.anyHostile;
    if (caught && !wasCaught) {
      g.after(0.8, () => g.phone('Marco', 'ti hanno visto!! o scappi o picchi. io faccio finta di non conoscerti'));
    }
    wasCaught = caught;

    // rissa in ufficio vinta → fuga
    if (q === 5 && g.npc('giallo').fighter!.ko && g.npc('viola').fighter!.ko && !g.is('escape')) {
      g.flag('escape');
      startEscape(g);
    }

    // nel vicolo: salvo!
    if (q === 6 && ZONES.alley(p)) {
      g.setStep('c2', 7);
      g.combat.calmAll();
      for (const id of ['fucsia', 'lime', 'verde', 'rosa', 'arancione', 'azzurro']) {
        const n = g.npc(id);
        if (!n.fighter!.ko && (ZONES.alley(n.pos) || ZONES.corridor(n.pos) || ZONES.office(n.pos))) g.setHidden(n, true);
      }
      const m = g.npc('marco');
      m.pos.set(A.alleyMarco.x, 0, A.alleyMarco.z);
      m.homeRot = -Math.PI / 2;
      g.setCheckpoint(new THREE.Vector3(-21, 0, 16), A.alleyMarco.clone().setY(1.5), 'Ti rialzi nel vicolo');
      g.toast('Sei fuori. Le guardie non escono dal club: il vicolo non è territorio loro.', 'info', 5000);
    }
    if (g.is('fluoInAlley') && !g.is('fluoShown')) {
      g.flag('fluoShown');
      const f = g.npc('fluo');
      g.setHidden(f, false);
      f.pos.set(A.fluoAlley.x, 0, A.fluoAlley.z);
      f.body.root.rotation.y = -Math.PI / 2;
      f.homeRot = -Math.PI / 2;
      f.setBehavior({ type: 'stand' });
    }

    // fine capitolo
    if (g.is('c2Finale') && !g.dialogue.isOpen && !g.is('c2Done')) {
      g.flag('c2Done');
      g.setHidden(g.npc('fluo'), true);
      g.completeQuest('c2');
      g.after(0.8, () => g.completeChapter('Prossimamente: Quadropoli, la città a quadretti. Un banco dei pegni, un tappo vero e tre giorni di tempo.'));
    }
  });
}

// La scena dell'ufficio: rimetti il tappo, arriva Don Fluo
function officeScene(g: Game) {
  const A = g.world.anchors;
  g.take('tappo');
  g.talk(narr(['Rimetti il tappo nel cuscinetto della teca.', 'Clic. Si incastra. Quasi.', 'Dietro di te, una porta si apre.']), null, () => {
    const fluo = g.npc('fluo'), giallo = g.npc('giallo'), viola = g.npc('viola');
    for (const n of [fluo, giallo, viola]) g.setHidden(n, false);
    fluo.setBehavior({ type: 'patrol', path: [[11.5, 17.3]], speed: 1.6, wait: 9999 });
    giallo.setBehavior({ type: 'patrol', path: [[13.4, 18.2]], speed: 2, wait: 9999 });
    viola.setBehavior({ type: 'patrol', path: [[10, 17.9]], speed: 2, wait: 9999 });
    g.audio.alert();
    g.after(2.2, () => {
      g.talk(FLUO_TALK, fluo, () => {
        g.setStep('c2', 5);
        g.combat.provoke(giallo);
        g.combat.provoke(viola);
        fluo.say('Fatelo a strisce!', 3);
        g.setCheckpoint(new THREE.Vector3(9, 0, 20.5), A.teca, 'Ti rialzi dietro la scrivania. Gli Evidenziatori si stanno sgranchendo le linee');
        // se svieni durante la rissa, si ricomincia la rissa (chi è KO resta KO)
        g.onFaint = () => {
          for (const [n, x, z] of [[giallo, 13.4, 18.2], [viola, 10, 17.9]] as const) {
            if (n.fighter!.ko) continue;
            n.fighter!.hp = n.fighter!.maxHp;
            n.pos.set(x, 0, z);
          }
        };
      });
    });
  });
}

// Rissa vinta: rinforzi in arrivo, Marco apre l'uscita sul retro
function startEscape(g: Game) {
  const fluo = g.npc('fluo');
  fluo.say('Incompetenti! RINFORZI!', 3);
  g.after(1.5, () => {
    fluo.setBehavior({ type: 'patrol', path: [[13, 14]], speed: 2.5, wait: 9999 });
    g.after(1.5, () => g.setHidden(fluo, true));
  });
  g.after(1.0, () => {
    g.setStep('c2', 6);
    openDoor(g.world, 'backExit');
    g.phone('Marco', "ESCI DAL RETRO!! ho aperto l'uscita di emergenza, in fondo al corridoio. CORRI");
    const back = new THREE.Vector3(5.5, 0, 18);
    g.setCheckpoint(back, new THREE.Vector3(-18, 1.5, 18), 'Ti rialzi nel corridoio. I rinforzi ti stanno cercando');
    for (const id of ['fucsia', 'lime']) {
      const n = g.npc(id);
      g.setHidden(n, false);
      n.pos.set(id === 'fucsia' ? 12.4 : 13.6, 0, 13.5);
      g.combat.provoke(n);
    }
    const verde = g.npc('verde');
    if (!verde.fighter!.ko) g.combat.provoke(verde);
    g.onFaint = () => {
      for (const [id, x] of [['fucsia', 12.4], ['lime', 13.6]] as const) {
        const n = g.npc(id);
        if (n.fighter!.ko) continue;
        n.fighter!.hp = n.fighter!.maxHp;
        n.pos.set(x, 0, 13.5);
      }
    };
  });
}

export function startChapter2(g: Game) {
  if (g.quest('c2') === -1) g.startQuest('c2');
  g.audio.playMusic('club');
  g.after(0.6, () => g.chapter('CAPITOLO 2', 'Il Parallelepipedo'));
  g.after(5, () => g.toast('Di notte San Scarabocchio si disegna col gesso. E si sente la musica del club da un isolato.', 'info', 6000));
}
