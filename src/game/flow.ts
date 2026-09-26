import { Game } from './game';
import { CHAPTERS } from '../chapters';

const UNLOCK_KEY = 'stilizzato.unlocked.v1';

export function unlockedChapters(): Set<number> {
  const s = new Set<number>([1]);
  try {
    for (const n of JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? '[]')) s.add(n);
  } catch {
    /* niente */
  }
  return s;
}

export function unlockChapter(n: number) {
  const s = unlockedChapters();
  s.add(n);
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify([...s]));
  } catch {
    /* niente */
  }
}

// Schermate fuori dal gioco: titolo, pausa, fine capitolo. E il passaggio tra capitoli.

const CONTROLS = `
  <div class="controls">
    <div><b>WASD</b> muoviti</div><div><b>Mouse</b> guardati intorno</div>
    <div><b>Shift</b> corri</div><div><b>Spazio</b> salta</div>
    <div><b>E</b> parla / interagisci</div><div><b>Click</b> colpisci</div>
    <div><b>Tasto destro</b> para</div><div><b>C</b> accovacciati</div>
    <div><b>Q</b> diario</div><div><b>1 / 2</b> cambia arma</div>
    <div><b>M</b> musica on/off</div><div><b>Esc</b> pausa</div>
  </div>`;

export function setupFlow(g: Game) {
  const screen = g.hud.screen;
  const show = (html: string, onClick: ((e: MouseEvent) => void) | null) => {
    screen.innerHTML = html;
    screen.style.display = 'flex';
    screen.onclick = onClick;
  };
  const hide = () => {
    screen.style.display = 'none';
    screen.onclick = null;
  };

  // Da dove si parte: ?cap=N nell'indirizzo, altrimenti il salvataggio, altrimenti il capitolo 1.
  const capParam = Number(new URLSearchParams(location.search).get('cap'));
  const save = Game.loadSave();
  let startNum = 1;
  if (capParam && CHAPTERS[capParam - 1]) {
    g.resetState(CHAPTERS[capParam - 1].startState);
    startNum = capParam;
  } else if (save && CHAPTERS[save.chapter - 1]) {
    g.state = save.state;
    startNum = save.chapter;
  } else {
    g.resetState();
  }
  g.loadChapter(CHAPTERS[startNum - 1]);

  const begin = () => {
    unlockChapter(g.chapterNum); // un capitolo che hai giocato resta sbloccato nel menu
    g.audio.init(); // i browser sbloccano l'audio solo dopo un click
    g.mode = 'play';
    g.fade(true);
    g.after(0.1, () => g.fade(false));
    g.chapterDef.start(g);
    hide();
    g.input.lock();
  };

  // --- titolo e menu dei capitoli ------------------------------------------------
  const startChapter = (num: number, fresh: boolean) => {
    const c = CHAPTERS[num - 1];
    if (fresh) g.resetState(c.startState);
    g.loadChapter(c);
    begin();
  };

  const showTitle = () => {
    const ch = CHAPTERS[startNum - 1];
    const resuming = startNum > 1 || (save !== null && save.chapter === startNum && capParam === 0 && Object.keys(save.state.quests).length > 0);
    show(
      `<div class="card paper">
        <div class="title">STILIZZATO</div>
        <div class="sub">un gioco disegnato a matita</div>
        ${CONTROLS}
        <div class="buttons">
          ${
            resuming
              ? `<button class="primary" data-a="go">Continua<small>Capitolo ${ch.num}: ${ch.title}</small></button>
                 <button data-a="new">Nuova partita</button>`
              : `<button class="primary" data-a="go">Inizia</button>`
          }
          <button data-a="chapters">Capitoli</button>
        </div>
      </div>`,
      (e) => {
        const a = (e.target as HTMLElement).closest('button')?.dataset.a;
        if (!a) return;
        if (a === 'chapters') return showChapters();
        if (a === 'new') {
          if (!confirm('Ricominciare dal capitolo 1? I progressi salvati verranno persi.')) return;
          return startChapter(1, true);
        }
        begin();
      },
    );
  };

  // Scegli da che capitolo partire. I capitoli si sbloccano finendo il precedente,
  // oppure con la password che compare alla fine del capitolo prima.
  const showChapters = (msg = '') => {
    const open = unlockedChapters();
    const rows = CHAPTERS.map((c) =>
      open.has(c.num)
        ? `<button data-a="ch" data-n="${c.num}">Capitolo ${c.num}<small>${c.title}</small></button>`
        : `<button class="locked" disabled>🔒 Capitolo ${c.num}<small>bloccato</small></button>`,
    ).join('');
    show(
      `<div class="card paper chapters">
        <div class="title small">Capitoli</div>
        <div class="sub">Se salti un capitolo, parti con lo stretto necessario.</div>
        <div class="buttons">${rows}</div>
        <div class="password">
          <input type="text" placeholder="password" maxlength="24" autocomplete="off" spellcheck="false" />
          <button data-a="pwd">Sblocca</button>
        </div>
        <div class="msg">${msg}</div>
        <div class="buttons"><button data-a="back">Indietro</button></div>
      </div>`,
      (e) => {
        const b = (e.target as HTMLElement).closest('button');
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'back') return showTitle();
        if (a === 'ch') {
          const n = Number(b!.dataset.n);
          if (n !== 1 && !confirm(`Iniziare dal capitolo ${n}? I progressi salvati verranno sostituiti.`)) return;
          return startChapter(n, true);
        }
        if (a === 'pwd') {
          const val = (screen.querySelector('.password input') as HTMLInputElement).value.trim().toUpperCase();
          const c = CHAPTERS.find((c) => c.password && c.password === val);
          if (!c) return showChapters('Password sbagliata. O scritta male. O disegnata male.');
          unlockChapter(c.num);
          return showChapters(`Capitolo ${c.num} sbloccato!`);
        }
      },
    );
    const input = screen.querySelector('.password input') as HTMLInputElement;
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); // non far arrivare i tasti al gioco
      if (ev.key === 'Enter') (screen.querySelector('[data-a="pwd"]') as HTMLButtonElement).click();
    });
  };

  showTitle();

  // --- pausa --------------------------------------------------------------------
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      g.audio.resume();
      if (g.mode !== 'end') hide();
      return;
    }
    if (g.mode === 'play' && screen.style.display !== 'flex') {
      g.audio.suspend();
      show(
        `<div class="card paper">
          <div class="title small">Pausa</div>
          <div class="sub">anche gli omini stilizzati hanno bisogno di una pausa</div>
          ${CONTROLS}
          <div class="go">clicca per continuare</div>
        </div>`,
        () => {
          g.audio.resume();
          g.input.lock();
          hide();
        },
      );
    }
  });

  // --- fine capitolo ---------------------------------------------------------------
  g.onChapterComplete = (g, next) => {
    unlockChapter(next);
    g.input.unlock();
    g.audio.jingle();
    const c = g.chapterDef;
    const side = c.sideQuests.filter((q) => g.questDone(q)).length;
    const mins = Math.floor(g.chapterTime / 60), secs = Math.floor(g.chapterTime % 60);
    const nextCh = CHAPTERS[next - 1];
    show(
      `<div class="card paper">
        <div class="title small">Capitolo ${c.num} completato</div>
        <div class="sub">${c.title}</div>
        <div class="stats-end">
          <div>Tempo: <b>${mins}m ${secs}s</b></div>
          <div>Livello: <b>${g.state.level}</b> · Monete: <b>${g.state.coins}</b></div>
          <div>Missioni secondarie: <b>${side}/${c.sideQuests.length}</b></div>
        </div>
        <div class="sub"><i>${g.lastTeaser}</i></div>
        ${nextCh?.password ? `<div class="pwd-show">Password del capitolo ${next}: <b>${nextCh.password}</b></div>` : ''}
        <div class="buttons">
          ${
            nextCh
              ? `<button class="primary" data-a="next">Capitolo ${nextCh.num}<small>${nextCh.title}</small></button>`
              : `<div class="sub">Il capitolo ${next} non è ancora stato disegnato.</div>`
          }
          <button data-a="stay">Continua a esplorare qui</button>
        </div>
      </div>`,
      (e) => {
        const a = (e.target as HTMLElement).closest('button')?.dataset.a;
        if (!a) return;
        if (a === 'next' && nextCh) {
          g.loadChapter(nextCh);
          begin();
        } else {
          g.mode = 'play';
          hide();
          g.input.lock();
        }
      },
    );
  };
}
