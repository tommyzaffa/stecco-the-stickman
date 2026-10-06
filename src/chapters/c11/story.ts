import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { Dialogue } from '../../game/dialogue';
import type { NPC } from '../../entities/npc';
import { BOOTH, leaveBooth, updateBooth } from '../../game/booth';
import { TOUCH } from '../../touch';
import { attackName, keyName } from '../../settings';
import { COUNTER_Z, REFS11, WINDOWS, behindCounter, inArchive } from './world';
import { END_MIN, OFF, WIN_IDS, ahead, calling, createPanel, giftAttesa, hhmm, present, served, setupOffice, takeTicket, updateOffice, type WinId } from './office';
import { clearAnswer, closeForm, openForm, pickForm, resetForms, type Field, type FormDef } from './forms';
import { closeStamps, openStamps, type StampDef } from './stamp';
import { PH, openPhoto, type Shot } from './photo';
import { CHECK, Q11, curCheck } from './quests';

// Capitolo 11: Modulo 27-B. Per registrare la residenza nuova serve il 27-B; il 27-B si chiede col
// 27-A; il 27-A va compilato, bollato, timbrato e protocollato. Sportelli con orari e pause, numeri
// che si chiamano da soli, moduli a crocette, timbri a tempo, la fototessera. Entro le 12:00.
// Al Protocollo, pinzato al 27-B, un foglio che non è tuo: "Richiesta di cancellazione totale. G."

const narr = (lines: string[]): Dialogue => ({ name: '', start: 'a', nodes: { a: { say: lines.map((l) => `* ${l}`) } } });
const MISTAKE_MIN = 5;
const BOLLO = 16;
const FOTO = 2;

let customers: NPC[] = [];

// =========================================================================
// I MODULI
// =========================================================================
const fx = (f: Field): Field => ({ ...f, why: `${f.why ?? 'Risposta sbagliata.'} <b>Correttore: ${MISTAKE_MIN} minuti per asciugare.</b>` });

const FORM_27A: FormDef = {
  id: '27A',
  title: 'MODULO 27-A · Richiesta del Modulo 27-B',
  note: 'Compilare in stampatello. Le mani non sono richieste. Leggere le istruzioni in piccolo (sono lì apposta).',
  fields: [
    fx({ q: 'Cognome', hint: 'chi non ha un cognome scriva il nome due volte', opts: ['Stecco', 'Stecco Stecco', 'Nessuno'], ok: 1, why: '"Chi non ha un cognome scriva il nome due volte". Era scritto in piccolo, apposta.' }),
    fx({ q: 'Colore degli occhi', hint: 'per i disegnati: barrare il materiale', opts: ['Marroni', 'Azzurri', 'Inchiostro', 'Due puntini'], ok: 2, why: 'Gli occhi disegnati non hanno colore: hanno un materiale. Inchiostro.' }),
    fx({ q: 'Numero di mani', hint: 'zero è un numero (Regolamento, art. 3)', opts: ['Due', 'Una', 'Zero', 'Non pertinente'], ok: 2, why: 'Le mani si contano, anche quando non ci sono. Zero.' }),
    fx({ q: 'Indirizzo di residenza', hint: 'quello di prima, finché non si ha il 27-B', opts: ['Via della Penna 3', 'San Scarabocchio, casa vecchia', 'In trasloco'], ok: 1, why: 'Finché non hai il 27-B abiti ancora nella casa vecchia. È per questo che sei qui.' }),
    fx({ q: 'Motivo della richiesta', hint: 'barrare una sola casella', opts: ['Avere il 27-B', 'Avere la residenza', 'Non lo so più'], ok: 0, why: 'Il 27-A serve solo ad avere il 27-B. La residenza è un altro modulo.' }),
    fx({ q: 'Firma', hint: 'in mancanza di mani, firmare con una linea', opts: ['Firma', 'Una linea', 'Una croce'], ok: 1, why: 'Senza mani si firma con una linea. La croce è per chi non sa scrivere: tu non sai tenere la penna, è diverso.' }),
  ],
};

const SHOT_TXT: Record<Shot, string> = { ok: 'dritta, seria', storta: 'guardi da un\'altra parte', mossa: 'mossa (sei una nuvola)' };
function form27B(): FormDef {
  const rs = PH.results;
  return {
    id: '27B',
    title: 'MODULO 27-B · Dichiarazione di residenza',
    note: 'Ultima copia disponibile. Non piegare, non macchiare, non perdere la speranza.',
    fields: [
      fx({ q: 'Nuovo indirizzo', hint: 'l\'interno è quello dove si dorme (non quello dove arrivano i pacchi)', opts: ['Via della Penna 3, int. 1', 'Via della Penna 3, int. 12', 'Via della Matita 3'], ok: 0, why: 'All\'interno 12 è arrivato il pacco. Tu abiti all\'1.' }),
      fx({ q: 'Conviventi', hint: 'persone a carico (i cuscini non contano)', opts: ['Nessuno', 'Un cuscino', 'Marco (quasi sempre)'], ok: 0, why: 'Marco non abita con te. Marco è solo sempre lì.' }),
      fx({ q: 'Materiale dell\'abitazione', hint: 'matita, penna, pennarello o gesso', opts: ['Matita', 'Penna', 'Pennarello', 'Gesso'], ok: 1, why: 'Via della Penna: a penna. La gomma non ci passa.' }),
      fx({
        q: 'Fotografia',
        hint: 'incollare una fototessera in cui il richiedente guarda l\'obiettivo',
        opts: rs.map((r, i) => `Foto ${i + 1}: ${SHOT_TXT[r]}`),
        ok: rs.map((r, i) => (r === 'ok' ? i : -1)).filter((i) => i >= 0),
        why: 'Questa all\'anagrafe non passa: l\'anagrafe vuole guardarti negli occhi. Nei puntini.',
      }),
      fx({ q: 'Residenza precedente', hint: 'come sul 27-A', opts: ['San Scarabocchio, casa vecchia', 'Via della Penna 3', 'Nessuna'], ok: 0, why: 'Sul 27-A hai scritto la casa vecchia. I moduli devono andare d\'accordo.' }),
      fx({ q: 'Dichiaro di non essere stato cancellato', hint: 'chi è stato cancellato non può firmare questo modulo', opts: ['Sì, lo dichiaro', 'Non mi ricordo', 'Non ancora'], ok: 0, why: 'Se non te lo ricordi, forse sì. Barra "Sì, lo dichiaro" e non pensarci.' }),
    ],
  };
}

// i timbri (Tampona): le caselle sparse sul foglio, in ordine
const STAMP_27A: StampDef = {
  title: 'Sportello C · Timbri sul Modulo 27-A',
  speed: 1.9,
  boxes: [
    { n: 2, label: 'tondo', x: 0.16, w: 0.16 },
    { n: 1, label: 'sulla marca', x: 0.52, w: 0.15 },
    { n: 3, label: 'data', x: 0.84, w: 0.15 },
  ],
};
const STAMP_27B: StampDef = {
  title: 'Sportello C · Timbri sul Modulo 27-B',
  speed: 2.15,
  boxes: [
    { n: 3, label: 'quadro', x: 0.12, w: 0.13 },
    { n: 1, label: 'sulla foto', x: 0.38, w: 0.13 },
    { n: 4, label: 'data', x: 0.63, w: 0.12 },
    { n: 2, label: 'tondo', x: 0.87, w: 0.13 },
  ],
};

// =========================================================================
// PREPARAZIONE
// =========================================================================
export function setupStory(g: Game, cs: NPC[]) {
  const A = g.world.anchors;
  customers = cs;
  Object.assign(Q11, { started: false, over: false, fine: false, caught: 0, coffeePaid: false, coffeeOut: false });
  OFF.day = 1;
  OFF.coffee = false;
  resetForms();
  setupOffice(g, customers);
  createPanel(g);
  OFF.steps = () => CHECK.map((c) => ({ t: c.short, on: g.is(c.flag) }));
  OFF.onCall = (w, n) => {
    g.toast(`Din don: <b>${w.id} ${n}</b>. Tocca a te: sportello ${w.id} (${WINDOWS[w.id].name.toLowerCase()})!`, 'quest', 5000);
  };
  OFF.onSkip = (w, n) => {
    g.npc(w.clerk).say(`${w.id} ${n}? ...${w.id} ${n}? Avanti il prossimo.`, 3);
    g.toast(`${w.id} ${n}: non ti sei presentato e sono passati al prossimo. Rifai il numero.`, 'bad', 5000);
  };
  OFF.onGhost = (w, t) => {
    const clerk = g.npc(w.clerk);
    if (t.tag === 'attesa' && !g.is('c11Occhiali')) {
      clerk.say('A 2... A 2? Avanti il prossimo.', 2.5);
      g.after(1.2, () => g.npc('attesa').say('Hanno chiamato? Che numero era? Non ci vedo!', 3.5));
    } else if (Math.random() < 0.4) clerk.say(`${w.id} ${t.n}? ...Nessuno. Avanti.`, 2.2);
  };
  g.audio.birds = false;
  g.setCheckpoint(A.spawn, A.spawnLook, 'Ti rialzi all\'ingresso');
  if (import.meta.env.DEV) Object.assign(window, { __c11: { OFF, Q11, PH, REFS11, takeTicket, pickForm, newDay: () => newDay(g) } });

  // le monete (per la marca da bollo, la foto, il caffè)
  g.addCoin(-14.9, 2.4, 'Una moneta dietro la rastrelliera dei moduli. Qualcuno ci ha rinunciato.');
  g.addCoin(6, 2.9, 'Una moneta tra le sedie. Caduta a chi aspettava: aspettare costa.');
  g.addCoin(-8.2, 0.3, 'Una moneta sotto la prima fila.');
  g.addCoin(15.2, 10.9, 'Una moneta nell\'angolo, vicino alla fototessera. Il resto di una foto venuta male.');
  g.addCoin(-1.5, -12.8, 'Una moneta in archivio. Archiviata.', 0.6);

  // --- la rastrelliera dei moduli ---
  g.addInteractable({
    pos: new THREE.Vector3(A.rack.x, A.rack.y, A.rack.z),
    radius: 2.4,
    label: (g) => (Q11.started && !g.is('c11A') ? 'Prendi un modulo (rastrelliera)' : null),
    use: (g) => g.talk(rackDialogue(), null),
  });
  // --- il tavolo per compilare ---
  g.addInteractable({
    pos: new THREE.Vector3(A.desk.x, A.desk.y, A.desk.z),
    radius: 2.3,
    label: (g) => {
      if (!Q11.started || Q11.over) return null;
      if (g.has('modulo27A') && !g.is('c11AFill')) return 'Compila il Modulo 27-A';
      if (g.has('modulo27B') && !g.is('c11BFill')) return g.is('c11Foto') ? 'Compila il Modulo 27-B' : 'Compila il Modulo 27-B (serve la foto)';
      return null;
    },
    use: (g) => fill(g),
  });
  // --- l'eliminacode ---
  g.addInteractable({
    pos: new THREE.Vector3(A.ticket.x, A.ticket.y, A.ticket.z),
    radius: 2.2,
    label: () => (Q11.started && !Q11.over && !Q11.fine ? 'Prendi un numero' : null),
    use: (g) => g.talk(ticketDialogue(), null),
  });
  // --- gli sportelli ---
  for (const id of WIN_IDS) {
    const w = WINDOWS[id];
    g.addInteractable({
      pos: new THREE.Vector3(w.x, 1.2, COUNTER_Z + 0.6),
      radius: 1.7,
      label: (g) => windowLabel(g, id),
      use: (g) => windowUse(g, id),
    });
  }
  // --- la fototessera ---
  g.addInteractable({
    pos: new THREE.Vector3(A.booth.x - 0.8, 1.2, A.booth.z),
    radius: 1.8,
    label: (g) => (Q11.started && !Q11.over && !BOOTH.cur && !g.is('c11Foto') ? `Fototessera (${FOTO} monete)` : null),
    use: (g) => photo(g),
  });
  // --- la macchinetta del caffè ---
  g.addInteractable({
    pos: new THREE.Vector3(A.coffee.x, A.coffee.y, A.coffee.z),
    radius: 2.0,
    label: (g) => {
      if (!Q11.started || g.has('caffe') || g.is('c11Caffe')) return null;
      if (Q11.coffeeOut) return 'Prendi il caffè';
      return Q11.coffeePaid ? 'Aspetta il caffè' : 'Compra un caffè (1 moneta)';
    },
    use: (g) => coffee(g),
  });
  // --- gli occhiali del signor Attesa ---
  g.addInteractable({
    pos: new THREE.Vector3(12.9, 0.3, 8.2),
    radius: 1.7,
    label: (g) => (REFS11.occhiali?.visible && !g.has('occhialiAttesa') ? 'Raccogli gli occhiali' : null),
    use: (g) => {
      REFS11.occhiali!.visible = false;
      g.give('occhialiAttesa');
      g.audio.select();
      if (g.quest('occhiali') === -1) g.startQuest('occhiali');
      g.setStep('occhiali', 1);
    },
  });
  // --- il signor Attesa ---
  g.addInteractable({
    pos: g.npc('attesa').pos,
    radius: 2.4,
    label: (g) => (g.npc('attesa').hidden || g.is('c11Occhiali') ? null : 'Parla con il signor Attesa'),
    use: (g) => g.talk(attesaDialogue(), g.npc('attesa')),
  });
  // --- la cartella rossa, in archivio ---
  g.addInteractable({
    pos: new THREE.Vector3(A.archive.x, A.archive.y, A.archive.z),
    radius: 1.8,
    label: (g) => (!g.is('c11Archivio') ? 'Apri la cartella rossa' : null),
    use: (g) => g.talk(archiveDialogue(), null),
  });

  g.onUpdate.push((g, dt) => update(g, dt));
}

export function startChapter11(g: Game) {
  if (g.quest('c11') === -1) g.startQuest('c11');
  g.audio.playMusic('attesa');
  g.after(0.6, () => g.chapter('CAPITOLO 11', 'Modulo 27-B'));
  g.after(3.2, () => g.talk(intro(), g.npc('usciere'), () => startClock(g)));
}

function startClock(g: Game) {
  if (Q11.started) return;
  Q11.started = true;
  g.setStep('c11', curCheck(g));
  g.toast(TOUCH ? 'Il foglietto in alto: l\'ora e i tuoi numeri. Mentre parli, l\'orologio si ferma.' : 'Il foglietto in basso a sinistra: l\'ora, i tuoi numeri e cosa manca. Mentre parli, l\'orologio si ferma.', 'info', 6500);
}

function intro(): Dialogue {
  return {
    name: 'Il signor Fila',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* Quadropoli, Ufficio Protocollo. Le 9:00 in punto. L\'orologio sopra gli sportelli è l\'unico che lavora già.',
          '* Nella busta del trasloco c\'era scritto: "Per il cambio di residenza presentarsi con il Modulo 27-B".',
          'Buongiorno. Cosa le serve? No, non me lo dica: un modulo.',
          '> Il Modulo 27-B. Per la residenza nuova.',
          'Il 27-B. Bellissimo modulo. Esaurito. Lo dà il Protocollo, sportello B, a chi porta il 27-A.',
          'Il 27-A è in rastrelliera, a sinistra. Si compila al tavolo. Poi la marca da bollo alla Cassa, D. Poi i timbri, C. Poi il Protocollo, B, che le dà il 27-B.',
          'Il 27-B vuole la foto: la cabina è in fondo a destra. Si compila, si ritimbra, e si consegna allo sportello A, Residenze.',
          '> E lo sportello A quando apre?',
          'Alle dieci e mezza. Chiude a mezzogiorno. Le pause sono scritte sul muro, sotto i tabelloni. Per ogni sportello ci vuole il numero: l\'eliminacode è qui accanto. Uno per sportello.',
        ],
        choices: [
          { t: 'Un consiglio?', next: 'consiglio' },
          { t: 'E se non ce la faccio entro mezzogiorno?', next: 'domani' },
        ],
      },
      consiglio: {
        say: ['Prenda i numeri subito. Mentre aspetta, compila. Mentre compila, aspetta. È tutta una questione di aspettare bene.', 'E quando chiamano il suo numero, si presenti. Qui nessuno chiama due volte. Tranne me, ma io sono l\'usciere.'],
        next: 'via',
      },
      domani: {
        say: ['Torna domani. Le pratiche non muoiono mai: aspettano. Come tutti, qui.', 'Però prenda i numeri subito. Mentre aspetta, compila. È tutta una questione di aspettare bene.'],
        next: 'via',
      },
      via: {
        say: ['Prego. L\'orologio è già partito. Cioè: partirà appena smettiamo di parlare. Qui, quando si parla, il tempo aspetta. Per educazione.'],
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
  OFF.running = Q11.started && !Q11.over && !Q11.fine && !g.dialogue.isOpen;
  updateOffice(g, dt);
  updateBooth(g, dt);
  if (!Q11.started) return;

  // il passo della missione principale segue la pratica
  const i = curCheck(g);
  if (i < CHECK.length && g.quest('c11') !== i && !Q11.fine) g.setStep('c11', i);

  // gli avvisi dell'ufficio
  const say = (k: string, at: number, fn: () => void) => {
    if (OFF.min >= at && !OFF.warned.has(k)) {
      OFF.warned.add(k);
      fn();
    }
  };
  if (OFF.running) {
    say('caffe', 60, () => !OFF.coffee && g.toast('Le 10:00: la signora Tampona (sportello C) va in pausa caffè.', 'info', 4500));
    say('apreA', 90, () => g.toast('Le 10:30: apre lo sportello A, Residenze.', 'info', 4500));
    say('merenda', 120, () => g.toast('Le 11:00: la signora Spillatrice (sportello B) va in pausa merenda.', 'info', 4500));
    say('mezzora', 150, () => g.toast('Le 11:30: mezz\'ora alla chiusura dello sportello A. La Cassa chiude per i conti.', 'bad', 5000));
    say('fretta', 160, () => g.audio.playMusic('attesaFretta'));
    say('dieci', 170, () => g.toast('Dieci minuti a mezzogiorno!', 'bad', 4000));
  }

  // mezzogiorno: lo sportello A chiude
  if (OFF.min >= END_MIN && !Q11.over && !Q11.fine) closing(g);

  // il signor Attesa se ne va (con gli occhiali)
  const at = g.npc('attesa');
  if (g.is('c11Occhiali') && !at.hidden && at.behavior.type === 'patrol' && Math.hypot(at.pos.x, at.pos.z - 11.9) < 0.3) g.setHidden(at, true);

  // il pugno alla macchinetta del caffè (col tasto per colpire, guardandola da vicino)
  if (g.input.clicked && !g.dialogue.isOpen && !g.minigame && !p.rooted && !p.seated && !g.is('c11Caffe') && !g.has('caffe')) {
    const e = p.eye, f = p.forward;
    const dx = A.coffee.x - e.x, dz = A.coffee.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.2 && (dx * f.x + dz * f.z) / d > 0.7) g.after(0.15, () => punchCoffee(g));
  }

  // dietro il bancone: se ti vedono, ti riaccompagnano fuori
  if ((behindCounter(p.pos) || inArchive(p.pos)) && !g.dialogue.isOpen && !Q11.over) {
    for (const id of WIN_IDS) {
      const w = OFF.wins[id];
      const c = g.npc(w.clerk);
      const atDesk = Math.hypot(c.pos.x - WINDOWS[id].x, c.pos.z + 7.85) < 0.5 && w.phase !== 'away';
      if (!atDesk) continue;
      if (id === 'A' && OFF.min < w.open) continue; // legge il giornale fino all'apertura
      const d = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
      // Spillatrice è accanto alla porta dell'archivio: vede tutto. Gli altri, solo chi sta in piedi.
      const sees = id === 'B' ? d < 4.6 : d < 3 && !p.crouching;
      if (sees) {
        caught(g, c);
        break;
      }
    }
  }
}

function caught(g: Game, c: NPC) {
  const p = g.player;
  Q11.caught++;
  c.say('Lei! Qui non può stare! È riservato al personale!', 3);
  g.audio.alert();
  p.pos.set(-15.4, 0, COUNTER_Z + 1.4);
  p.setCrouch(false);
  p.setLook(new THREE.Vector3(0, 1.4, COUNTER_Z + 3));
  g.toast(
    Q11.caught === 1
      ? `Ti riaccompagnano al cancelletto. Accovacciato (${TOUCH ? 'GIÙ' : keyName('crouch')}) da lontano non ti vedono; ma Spillatrice, accanto all'archivio, vede tutto (tranne durante la merenda).`
      : 'Ti riaccompagnano al cancelletto. Di nuovo.',
    'bad',
    6000,
  );
}

// =========================================================================
// MEZZOGIORNO (game over) E IL GIORNO DOPO
// =========================================================================
function closing(g: Game) {
  Q11.over = true;
  closeForm(g);
  closeStamps(g);
  if (BOOTH.cur) leaveBooth(g);
  g.audio.chime(true);
  g.npc('cartella').say('Mezzogiorno. Si chiude. Torni domani.', 4);
  g.after(1.4, () =>
    g.gameOver(
      'Mezzogiorno',
      '«Lo sportello A è chiuso. Torni domani. Con un altro numero.»<br><br>La pratica resta aperta: le pratiche non muoiono mai. Domani si ricomincia dalle 9:00, con quello che hai già fatto.',
      () => newDay(g),
    ),
  );
}

function newDay(g: Game) {
  const A = g.world.anchors;
  const p = g.player;
  OFF.day++;
  OFF.coffee = false;
  Q11.over = false;
  Q11.coffeePaid = Q11.coffeeOut = false;
  if (REFS11.caffe) REFS11.caffe.visible = false;
  setupOffice(g, customers);
  if (g.is('c11Occhiali')) g.setHidden(g.npc('attesa'), true);
  p.pos.copy(A.spawn);
  p.setLook(A.spawnLook);
  p.setCrouch(false);
  g.audio.playMusic('attesa');
  g.after(0.5, () => {
    g.npc('usciere').say('Lei di nuovo. Bene: l\'esperienza conta.', 3.5);
    g.toast(`Giorno ${OFF.day}. Le 9:00. Quello che hai fatto ieri vale ancora (i numeri no).`, 'quest', 5500);
  });
}

// =========================================================================
// LA RASTRELLIERA E IL TAVOLO
// =========================================================================
function rackDialogue(): Dialogue {
  return {
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: ['* La rastrelliera dei moduli. 27-A, 27-A bis, 14-C, 9-Z, 101-bis, 0. Il 27-B ha un cartellino: "esaurito". Il 27-C ha il cartellino "non esiste", e lo scomparto vuoto.'],
        choices: [
          { t: 'Prendi un 27-A', next: 'preso' },
          { t: 'Prendi un 27-A bis', next: 'bis' },
          { t: 'Prendi un modulo 0', next: 'zero' },
        ],
      },
      bis: {
        say: ['* Il 27-A bis serve a chiedere il 27-A. Il 27-A è lì, nello scomparto accanto. Rimetti a posto il bis.'],
        choices: [{ t: 'Prendi un 27-A', next: 'preso' }],
      },
      zero: {
        say: ['* Modulo 0: "Richiesta di non dover compilare moduli". Da compilare in quadruplice copia. Lo rimetti a posto, piano, come se scottasse.'],
        choices: [{ t: 'Prendi un 27-A', next: 'preso' }],
      },
      preso: {
        say: ['* Un Modulo 27-A. Bianco, a righe verdi, con i buchi ai lati. Pesa quanto una mattinata.', '* Si compila al tavolo, in fondo a sinistra.'],
        do: (g) => {
          g.flag('c11A');
          g.give('modulo27A');
        },
      },
    },
  };
}

function fill(g: Game) {
  const mistake = () => {
    OFF.min += MISTAKE_MIN;
  };
  if (g.has('modulo27A') && !g.is('c11AFill')) {
    openForm(g, FORM_27A, mistake, (ok) => {
      if (!ok || Q11.over) return;
      g.flag('c11AFill');
      g.addXp(20);
      g.toast('Modulo 27-A compilato. Adesso: marca da bollo (D) e timbri (C).', 'quest', 4500);
    });
    return;
  }
  if (g.has('modulo27B') && !g.is('c11BFill')) {
    if (!g.is('c11Foto')) {
      g.toast('Il campo 4 del 27-B vuole una fototessera. La cabina è in fondo a destra.', 'info', 4500);
      return;
    }
    openForm(g, form27B(), mistake, (ok) => {
      if (!ok || Q11.over) return;
      g.flag('c11BFill');
      g.addXp(25);
      g.toast('Modulo 27-B compilato. Manca solo il timbro (C), poi lo sportello A.', 'quest', 4500);
    });
  }
}

// =========================================================================
// L'ELIMINACODE
// =========================================================================
function ticketDialogue(): Dialogue {
  let last = '';
  const choices = WIN_IDS.map((id) => ({
    t: (_g: Game) => {
      const w = OFF.wins[id];
      const q = w.queue.length;
      const st = OFF.min < w.open ? `apre alle ${hhmm(w.open)}` : w.phase === 'away' ? 'in pausa' : `chiamano il ${w.served}`;
      return `${id} · ${WINDOWS[id].name.toLowerCase()} (${st}, ${q} in attesa)`;
    },
    if: (_g: Game) => !OFF.mine[id].length && OFF.min < OFF.wins[id].close,
    do: (g: Game) => {
      const n = takeTicket(id);
      last = `${id} ${n}`;
      g.audio.tick();
    },
    next: 'b',
  }));
  const mine = () =>
    WIN_IDS.filter((id) => OFF.mine[id].length)
      .map((id) => `${id} ${OFF.mine[id].join(', ')}`)
      .join(' · ');
  return {
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: [(_g) => `* L'eliminacode: quattro pulsanti, uno per sportello. Un numero alla volta per sportello.${mine() ? ` Hai già: ${mine()}.` : ''}`],
        choices: [...choices, { t: 'Basta così', next: 'fine' }],
      },
      b: {
        say: [
          (_g) => {
            const id = last.charAt(0) as WinId;
            const k = ahead(id);
            return `* Esce un biglietto: ${last}. ${k > 0 ? `Prima di te: ${k}.` : k === 0 ? 'Sei il prossimo.' : ''}${OFF.min < OFF.wins[id].open ? ` (Lo sportello ${id} apre alle ${hhmm(OFF.wins[id].open)}.)` : ''}`;
          },
        ],
        choices: [...choices, { t: 'Basta così', next: 'fine' }],
      },
      fine: { say: [] },
    },
  };
}

// =========================================================================
// GLI SPORTELLI
// =========================================================================
function windowLabel(g: Game, id: WinId) {
  if (!Q11.started || Q11.over || Q11.fine || behindCounter(g.player.pos)) return null;
  const w = OFF.wins[id];
  const n = calling(id);
  if (n) return `Presentati allo sportello ${id} (numero ${id} ${n})`;
  if (id === 'C' && g.has('caffe') && w.phase !== 'away') return 'Dai il caffè alla signora Tampona';
  if (OFF.min < w.open) return `Sportello ${id}: apre alle ${hhmm(w.open)}`;
  if (OFF.min >= w.close) return `Sportello ${id}: chiuso`;
  if (w.phase === 'away') return `Sportello ${id}: ${w.pause?.label.toLowerCase() ?? 'torno subito'}`;
  return `Sportello ${id} (serve il numero)`;
}

function windowUse(g: Game, id: WinId) {
  const w = OFF.wins[id];
  const clerk = g.npc(w.clerk);
  if (calling(id)) {
    present(id);
    const d = service(g, id);
    g.talk(d.dialogue, clerk, () => {
      if (d.after) d.after();
      else served(id);
    });
    return;
  }
  if (id === 'C' && g.has('caffe') && w.phase !== 'away') return g.talk(coffeeGive(), clerk);
  if (OFF.min < w.open || OFF.min >= w.close || w.phase === 'away') {
    g.toast(`Il tabellone dello sportello ${id} dice: ${windowLabel(g, id)?.split(': ')[1] ?? 'chiuso'}.`, 'info', 3000);
    return;
  }
  // senza numero: due parole e basta
  const lines: Record<WinId, string[]> = {
    A: ['Residenze. Numero?', '> Non ce l\'ho.', 'Allora non esiste. Eliminacode, all\'ingresso. Le residenze si consegnano fino a mezzogiorno.'],
    B: ['Protocollo. Numero?', '> Volevo solo chiedere...', 'Anche le domande si protocollano. Con il numero. TAC.'],
    C: ['Timbri. Numero?', '> Volevo solo un\'informazione.', 'Le informazioni le dà l\'usciere. Io do timbri. E sbadigli: senza caffè sbaglio anche quelli.'],
    D: ['Cassa. Numero?', '> No.', 'Senza numero non si paga. È l\'unico caso in cui non pagare costa di più.'],
  };
  g.talk(
    {
      name: clerk.name,
      start: 'a',
      nodes: {
        a: {
          say: lines[id],
          do: (g) => {
            if (id === 'C' && g.quest('caffe') === -1 && !g.is('c11Caffe') && OFF.min < 60) g.startQuest('caffe');
          },
        },
      },
    },
    clerk,
  );
}

// cosa succede allo sportello quando tocca a te. "after": cosa fare dopo il dialogo (se c'è, è lui
// a liberare lo sportello)
function service(g: Game, id: WinId): { dialogue: Dialogue; after?: () => void } {
  const name = g.npc(OFF.wins[id].clerk).name;
  const one = (say: Dialogue['nodes'][string]['say'], doIt?: (g: Game) => void): Dialogue => ({ name, start: 'a', nodes: { a: { say, do: doIt } } });

  if (id === 'D') {
    if (g.is('c11Bollo'))
      return { dialogue: one(['Cassa. Cosa paga?', '> Niente. Ho già la marca.', 'Allora ha preso il numero per niente. Il numero è gratis: è il tempo che si paga.']) };
    const coins = g.state.coins;
    if (coins >= BOLLO)
      return {
        dialogue: {
          name,
          start: 'a',
          nodes: {
            a: { say: ['Cassa. Cosa paga?', '> Una marca da bollo. Per il 27-A.', `${BOLLO} monete. Le monete disegnate valgono come quelle vere: cioè niente, ma con il bollo sopra.`], next: 'b' },
            b: {
              say: ['* Il signor Spiccioli conta le monete due volte. Poi una terza, per tradizione. Ti passa la marca sotto il vetro.'],
              do: (g) => {
                g.addCoins(-BOLLO);
                g.give('marcaBollo');
                g.flag('c11Bollo');
              },
            },
          },
        },
      };
    return {
      dialogue: {
        name,
        start: 'a',
        nodes: {
          a: {
            say: ['Cassa. Cosa paga?', '> Una marca da bollo.', `${BOLLO} monete.`, `> Ne ho ${coins}.`, `${coins}? ...Facciamo ${coins} e un sorriso. Non ha la bocca? Mi basta l'intenzione. La registro come "marca da bollo a rate".`],
            do: (g) => {
              if (coins > 0) g.addCoins(-coins);
              g.give('marcaBollo');
              g.flag('c11Bollo');
            },
          },
        },
      },
    };
  }

  if (id === 'C') {
    const t = g.npc('tampona');
    const stamp = (def: StampDef, form: 'A' | 'B') => () => {
      t.baseAction = 'gavel';
      const d: StampDef = OFF.coffee ? { ...def, speed: def.speed * 0.8 } : def;
      openStamps(g, d, (ok) => {
        t.baseAction = 'none';
        served('C');
        if (Q11.over) return;
        if (ok) {
          if (form === 'A') {
            g.flag('c11ATimbro');
            g.take('marcaBollo');
            g.toast('27-A timbrato, marca annullata. Adesso il Protocollo (sportello B).', 'quest', 4500);
          } else {
            g.flag('c11BTimbro');
            g.toast('27-B timbrato. Manca solo lo sportello A, Residenze.', 'quest', 4500);
          }
          g.addXp(25);
        } else {
          t.say('Annullato. Tre timbri storti, e la legge è chiara: si rifà la fila.', 4);
          g.toast('ANNULLATO: il modulo è buono, i timbri no. Rifai il numero per lo sportello C.', 'bad', 5500);
        }
      });
    };
    const intro = (form: string) => [
      `Timbri. Il ${form}, vediamo... bene.`,
      'Io il timbro lo muovo, avanti e indietro. Ma lo abbasso solo quando me lo dice lei. Così, se viene storto, la colpa è sua.',
      (_g: Game) => `* Di' "ORA!" (${TOUCH ? 'ORA!' : attackName()}) quando il timbro è sopra la casella giusta. Le caselle vanno timbrate in ordine: 1, 2, 3... Tre timbri storti e si rifà la fila.`,
    ];
    if (!g.is('c11ATimbro')) {
      if (!g.is('c11AFill'))
        return { dialogue: one(['Timbri. Cosa timbro? Lei? Senza modulo timbro solo lei, e le fa male.', '> Il 27-A...', 'Compilato? No? Lo compili al tavolo, poi torni. Con un altro numero.']) };
      if (!g.is('c11Bollo'))
        return { dialogue: one(['Timbri. Il 27-A, bene. E la marca da bollo?', '> Quale marca?', 'Il timbro annulla la marca. Senza marca non annullo niente, e senza annullare non timbro. Cassa, sportello D. Poi un altro numero.']) };
      return { dialogue: one(intro('27-A')), after: stamp(STAMP_27A, 'A') };
    }
    if (g.has('modulo27B') && g.is('c11BFill') && !g.is('c11BTimbro')) return { dialogue: one(intro('27-B, con la foto')), after: stamp(STAMP_27B, 'B') };
    if (g.has('modulo27B') && !g.is('c11BFill'))
      return { dialogue: one(['Timbri. Il 27-B... è bianco. I fogli bianchi non li timbro: sembrano tutti uguali.', 'Lo compili, con la foto. Poi un altro numero.']) };
    return { dialogue: one(['Timbri. Cosa timbro?', '> Niente. Ho già i timbri che mi servono.', 'Uno in più, per ricordo? ...No. I timbri non sono souvenir.']) };
  }

  if (id === 'B') {
    if (g.is('c11Protocollo')) return { dialogue: one(['Protocollo. Ha già il 27-B. Era l\'ultimo: se lo perde, la ristampa è prevista per... (sfoglia) ...mai.']) };
    if (!g.is('c11ATimbro'))
      return { dialogue: one(['Protocollo. Il 27-A? Senza timbri non lo protocollo. Al massimo lo pinzo. TAC. Ecco: pinzato.', 'Torni con i timbri, sportello C. E con un altro numero.']) };
    return { dialogue: protocolDialogue(name) };
  }

  // A: Residenze
  if (g.is('c11BTimbro')) return { dialogue: finalDialogue(name) };
  const missing = CHECK.slice(0, CHECK.length - 1)
    .filter((c) => !g.is(c.flag))
    .map((c) => c.short.replace(/ \(.*\)$/, '').toLowerCase());
  return {
    dialogue: one([
      'Residenze. Cosa mi porta?',
      (_g) => `Ah. Le manca: ${missing.join(', ')}.`,
      'Torni quando ha tutto. Con un altro numero, ovviamente. E prima di mezzogiorno.',
    ]),
  };
}

function protocolDialogue(name: string): Dialogue {
  return {
    name,
    start: 'a',
    nodes: {
      a: {
        say: [
          'Protocollo. Il 27-A, compilato, timbrato, con la marca annullata. Che bellezza. Non ne vedevo uno così da... non ne vedevo uno così.',
          '* TAC. TAC. TAC. La signora Spillatrice pinza, protocolla, riprotocolla.',
          'Numero di protocollo 27-A/0047. E questo è il suo 27-B. L\'ultimo. Gliel\'ho tenuto da parte: era pinzato a un\'altra pratica.',
          '* Al 27-B è rimasto pinzato un altro foglio. Non è tuo. Prima che lei se ne accorga, lo leggi.',
          '* "PRATICA N. 1. Oggetto: RICHIESTA DI CANCELLAZIONE TOTALE. Del quaderno. Di tutto. Motivo: ricominciare da un foglio pulito."',
          '* "Stato: in attesa di timbro. Firmato: G." In basso, una macchiolina rosa. Il foglio profuma di fragola.',
        ],
        choices: [
          { t: 'Chi è G.?', next: 'chi' },
          { t: 'Cancellazione totale di cosa?', next: 'cosa' },
        ],
      },
      chi: {
        say: ['G.? Quale G.? ...Ah. Questo.', '* TAC: lo stacca, lo piega, lo fa sparire nel cassetto.', 'Non c\'è nessun foglio. Le pratiche riservate stanno in archivio. E l\'archivio è riservato. E io sono riservata. Arrivederci.'],
        next: 'fine',
      },
      cosa: {
        say: ['Di cosa? ...Ah. Questo non è suo.', '* TAC: lo stacca, lo piega, lo fa sparire nel cassetto.', 'Cancellazioni, rettifiche, ridisegni: roba d\'archivio. E l\'archivio è riservato. Come me. Arrivederci.'],
        next: 'fine',
      },
      fine: {
        say: ['> (La pratica di G. è in archivio. La porta è dietro di lei.)'],
        do: (g) => {
          g.take('modulo27A');
          g.give('modulo27B');
          g.flag('c11Protocollo');
          g.flag('c11Gomma');
          g.addXp(30);
          if (g.quest('archivio') === -1 && !g.is('c11Archivio')) g.startQuest('archivio');
        },
      },
    },
  };
}

function finalDialogue(name: string): Dialogue {
  return {
    name,
    start: 'a',
    nodes: {
      a: {
        say: [
          'Residenze. Vediamo. Il 27-B: compilato, timbrato, con la foto. Dritta, perfino.',
          'Il 27-A protocollato, la marca annullata. Il timbro tondo, il quadro, la data. Tutto in ordine.',
          'Nuovo indirizzo: Via della Penna 3, interno 1. A penna. Ottima scelta: lì la gomma non passa.',
          'Strano, però. È la quinta residenza in Via della Penna questa settimana. Tutti dal Vicolo Storto. E da Via dei Temperini, i numeri pari.',
          '> Scappano dalla matita.',
          'Io non chiedo perché. Io registro. TUNF. Registrato.',
          (_g) => `* Residenza registrata alle ${hhmm(OFF.min)}${OFF.day > 1 ? `, al giorno ${OFF.day}` : ''}. Il signor Fila, all'ingresso, applaude piano. Per educazione.`,
        ],
        do: (g) => {
          g.audio.stamp(1.2);
          g.audio.applause();
        },
        next: 'fine',
      },
      fine: {
        say: [],
        do: (g) => {
          g.flag('c11Consegna');
          Q11.fine = true;
          g.completeQuest('c11');
          g.take('modulo27B');
          g.take('fototessera');
          g.addXp(80);
          g.addCoins(25);
          g.after(1.2, () => ending(g));
        },
      },
    },
  };
}

function ending(g: Game) {
  g.audio.playMusic('paese');
  g.phone('Martina', 'Domenica pranzo dai miei! Mamma vuole conoscerti. Anche papà. E la nonna, gli zii, i cugini. Porta le mani. Scherzo. Porta il dolce.');
  g.after(5, () =>
    g.talk(
      narr([
        'Fuori dall\'ufficio, Quadropoli è a quadretti come sempre. Contati: ci sono tutti.',
        'Stecco ha una residenza nuova, un pranzo domenicale e una domanda in testa: chi è G.? E cosa deve timbrare?',
      ]),
      null,
      () => {
        g.fade(true);
        g.after(1.3, () =>
          g.completeChapter('Prossimamente: Il pranzo della domenica. La famiglia di Martina: matite colorate, tutte di colori diversi, tutte curiose. Passare i piatti, rispondere a tre parenti insieme, non rovesciare niente.'),
        );
      },
    ),
  );
}

// =========================================================================
// LA FOTOTESSERA
// =========================================================================
function photo(g: Game) {
  if (g.state.coins < FOTO) {
    g.toast(`La fototessera vuole ${FOTO} monete. Ne cadono, di monete, in un ufficio dove tutti aspettano: guardati intorno.`, 'info', 5000);
    return;
  }
  g.addCoins(-FOTO);
  openPhoto(g, (good) => {
    if (Q11.over) return;
    if (good > 0) {
      g.flag('c11Foto');
      g.give('fototessera');
      clearAnswer('27B', 3);
      g.addXp(15);
      g.after(3, () => g.toast(`Fototessera: ${good} ${good === 1 ? 'foto buona' : 'foto buone'}. Adesso il 27-B si può compilare.`, 'quest', 4500));
    } else g.after(3, () => g.toast(`Nessuna foto buona. Si può riprovare (${FOTO} monete): guarda il pallino nero e stai fermo.`, 'bad', 5000));
  });
}

// =========================================================================
// IL CAFFÈ PER TAMPONA
// =========================================================================
function coffee(g: Game) {
  if (Q11.coffeeOut) {
    Q11.coffeeOut = false;
    REFS11.caffe!.visible = false;
    g.give('caffe');
    g.audio.select();
    if (g.quest('caffe') === -1) g.startQuest('caffe');
    g.setStep('caffe', 1);
    return;
  }
  if (Q11.coffeePaid) {
    g.toast('La macchinetta ronza. Pensa. Non decide. Il cartello dice: "quando vuole lei". Forse le serve un incoraggiamento.', 'info', 5000);
    return;
  }
  if (g.state.coins < 1) {
    g.toast('Il caffè costa una moneta. Non ne hai.', 'info', 3000);
    return;
  }
  g.addCoins(-1);
  Q11.coffeePaid = true;
  g.audio.tonk();
  if (g.quest('caffe') === -1) g.startQuest('caffe');
  g.after(0.8, () => g.toast('Clonk. La moneta scende. Il caffè no.', 'info', 3500));
}

function punchCoffee(g: Game) {
  const A = g.world.anchors;
  g.hud.popWord(new THREE.Vector3(A.coffee.x - 0.3, 1.5, A.coffee.z), g.player.camera, 'SBONK!');
  g.audio.clang(0.8);
  if (!Q11.coffeePaid) {
    if (!g.is('c11Sbonk')) {
      g.flag('c11Sbonk');
      g.toast('SBONK. La macchinetta non dà niente a chi non paga. È l\'unica cosa onesta dell\'ufficio.', 'info', 4500);
    }
    return;
  }
  if (Q11.coffeeOut) return;
  Q11.coffeeOut = true;
  Q11.coffeePaid = false;
  REFS11.caffe!.visible = true;
  g.after(0.5, () => {
    g.audio.glug(2);
    g.toast('Brrr... blub. Esce un bicchierino. Caffè disegnato, ma caldo.', 'info', 3500);
  });
}

function coffeeGive(): Dialogue {
  const early = () => OFF.min < 60;
  return {
    name: 'Signora Tampona',
    start: (_g) => (early() ? 'a' : 'tardi'),
    nodes: {
      a: {
        say: [
          '> Signora Tampona: un caffè. Per lei.',
          'Per me? Senza numero? ...Lo accetto. Ma solo perché è caldo.',
          '* Lo beve in un sorso. Le si drizza la crocchia.',
          'Ah. Niente pausa caffè, allora: il caffè è venuto da me. E con il caffè timbro più piano, e più dritto.',
        ],
        next: 'fine',
      },
      tardi: {
        say: ['> Signora Tampona: un caffè. Per lei.', 'Il caffè l\'ho già preso, in pausa. Questo lo tengo per domani. Ma il pensiero lo timbro subito: TUNF. Grazie.'],
        next: 'fine',
      },
      fine: {
        say: [],
        do: (g) => {
          g.take('caffe');
          g.flag('c11Caffe');
          if (early()) {
            OFF.coffee = true;
            OFF.wins.C.service = 4.5;
          }
          g.addXp(20);
          g.addCoins(5);
          if (g.quest('caffe') === -1) g.startQuest('caffe');
          g.completeQuest('caffe');
        },
      },
    },
  };
}

// =========================================================================
// IL SIGNOR ATTESA
// =========================================================================
function attesaDialogue(): Dialogue {
  return {
    name: 'Il signor Attesa',
    start: (g) => (g.has('occhialiAttesa') ? 'ridai' : g.quest('occhiali') >= 0 ? 'cerca' : 'a'),
    nodes: {
      a: {
        say: [
          'Scusi, giovanotto. Che numero c\'è sullo sportello A? Ho perso gli occhiali. Senza, vedo tutto a matita.',
          '> È tutto a matita.',
          'Appunto. Non distinguo niente. Io ho l\'A 2. Il due! Aspetto da tanto. Da quando c\'erano i colori... no, quelli non ci sono mai stati.',
          'Gli occhiali li ho persi andando alla fototessera. Volevo una foto per il documento. Ho perso il posto, gli occhiali e la pazienza. Il posto l\'ho ritrovato.',
        ],
        do: (g) => {
          if (g.quest('occhiali') === -1) g.startQuest('occhiali');
        },
      },
      cerca: {
        say: ['Li ha trovati? Sono due cerchi con un ponticello. Come tutti gli occhiali, ma miei.'],
      },
      ridai: {
        say: [
          '> I suoi occhiali. Erano per terra, vicino alla fototessera.',
          '* Se li mette. Guarda il tabellone. Guarda il cartello sopra lo sportello. Lo guarda di nuovo.',
          'Sportello A... RESIDENZE?! Io ero venuto per le PENSIONI.',
          'Aspetto dal 1998 allo sportello sbagliato.',
          (_g) =>
            OFF.wins.A.queue.some((q) => q.tag === 'attesa')
              ? 'Tenga il mio numero: A 2. A me non serve più. Le pensioni sono... (legge) ...al piano di sopra. Non c\'è un piano di sopra.'
              : 'Il mio numero l\'hanno già chiamato, e io non ci vedevo. Tenga queste, almeno: le pensioni sono al piano di sopra. Non c\'è un piano di sopra.',
          'Vado a casa. Dopo tutti questi anni mi merito un po\' di attesa a casa mia.',
        ],
        next: 'fine',
      },
      fine: {
        say: [],
        do: (g) => {
          g.take('occhialiAttesa');
          g.flag('c11Occhiali');
          const n = giftAttesa();
          if (n) g.toast(`Hai il numero <b>A ${n}</b>: quando apre lo sportello A sarai tra i primi.`, 'quest', 5500);
          else g.addCoins(15);
          g.addXp(25);
          g.completeQuest('occhiali');
          const at = g.npc('attesa');
          at.setBehavior({ type: 'patrol', path: [[at.pos.x, -2.3], [0, -2.3], [0, 8], [0, 11.9]], speed: 1.1, once: true });
        },
      },
    },
  };
}

// =========================================================================
// L'ARCHIVIO
// =========================================================================
function archiveDialogue(): Dialogue {
  return {
    name: '',
    start: 'a',
    nodes: {
      a: {
        say: [
          '* La cartella rossa. Sull\'etichetta: "PRATICHE G. (riservate)". Dentro, fogli pinzati, timbrati, protocollati.',
          '* "Vicolo Storto: cancellazione APPROVATA." "Via dei Temperini 4, 6 e 8: APPROVATA." "Fontana di San Scarabocchio, uno zampillo: APPROVATA."',
          '* "Via della Penna: RESPINTA (è a penna). Si chiede un parere tecnico."',
          '* E l\'ultima: "Il quaderno, tutto: IN ATTESA DI TIMBRO. Timbro richiesto: sportello C."',
          '> Sportello C. Tampona. Lei timbra quello che le dicono di timbrare. Quando glielo dicono.',
          '* Ogni foglio ha una macchiolina rosa in basso, e lo stesso profumo. Fragola.',
        ],
        do: (g) => {
          g.flag('c11Archivio');
          g.addXp(40);
          g.addCoins(10);
          if (g.quest('archivio') === -1) g.startQuest('archivio');
          g.completeQuest('archivio');
        },
      },
    },
  };
}

