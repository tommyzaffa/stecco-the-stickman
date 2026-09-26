import { Game } from './game';
import { CHAPTERS } from '../chapters';
import { ACTIONS, SETTINGS, bindKey, codeLabel, keyName, resetKeys, saveSettings } from '../settings';
import { TOUCH } from '../touch';

// ---------------------------------------------------------------------------
// Schermate fuori dal gioco: menu principale, capitoli, impostazioni, pausa,
// game over, fine capitolo. E il passaggio tra capitoli.
// ---------------------------------------------------------------------------

const UNLOCK_KEY = 'stilizzato.unlocked.v1';

const TOTAL_CHAPTERS = 20;

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

// Riepilogo dei comandi con i tasti scelti nelle impostazioni (o i pulsanti a schermo sul telefono)
const controls = () => TOUCH ? `
  <div class="controls">
    <div><b>pollice sinistro</b> muoviti (in fondo corri)</div><div><b>trascina a destra</b> guardati intorno</div>
    <div><b>tocca lo schermo</b> colpisci / spara (al mirino)</div><div><b>PARA</b> tieni premuto per parare</div>
    <div><b>USA</b> parla / interagisci</div><div><b>SALTA</b> / <b>GIÙ</b> salta / accovacciati</div>
    <div><b>ARMA</b> cambia arma</div><div><b>❚❚</b> pausa</div>
  </div>` : `
  <div class="controls">
    <div><b>${keyName('forward')}${keyName('left')}${keyName('back')}${keyName('right')}</b> muoviti</div><div><b>Mouse</b> guardati intorno</div>
    <div><b>${keyName('run')}</b> corri</div><div><b>${keyName('jump')}</b> salta</div>
    <div><b>${keyName('interact')}</b> parla / interagisci</div><div><b>Click</b> colpisci</div>
    <div><b>Tasto destro</b> para</div><div><b>${keyName('crouch')}</b> accovacciati</div>
    <div><b>${keyName('journal')}</b> diario</div><div><b>${keyName('weapon1')} / ${keyName('weapon2')} / ${keyName('weapon3')}</b> cambia arma</div>
    <div><b>${keyName('reload')}</b> ricarica</div><div><b>${keyName('music')}</b> musica on/off</div>
    <div><b>Esc</b> pausa</div>
  </div>`;

// Omino che saluta, per il menu principale
const WAVING_STICKMAN = `
  <svg class="menu-stickman" viewBox="0 0 120 200" aria-hidden="true">
    <circle cx="60" cy="38" r="22" />
    <circle cx="52" cy="35" r="2.6" class="dot" /><circle cx="68" cy="35" r="2.6" class="dot" />
    <path d="M60 60 L61 120" /><path d="M61 120 L42 182" /><path d="M61 120 L80 182" />
    <path d="M60 76 L34 108" />
    <g class="wave"><path d="M60 76 L90 58 L104 30" /></g>
  </svg>`;

type Btn = HTMLButtonElement;

export function setupFlow(g: Game) {
  const screen = g.hud.screen;
  const show = (html: string, onClick: ((e: MouseEvent) => void) | null, kind: 'menu' | 'overlay' = 'overlay') => {
    screen.innerHTML = html;
    screen.className = `screen ${kind}`;
    screen.style.display = 'flex';
    screen.onclick = onClick;
    g.hud.root.classList.toggle('in-menu', kind === 'menu');
  };
  const hide = () => {
    screen.style.display = 'none';
    screen.onclick = null;
    g.hud.root.classList.remove('in-menu');
  };
  const action = (e: MouseEvent) => (e.target as HTMLElement).closest('button') as Btn | null;

  // Conferma "nostra" (al posto delle finestre del browser): foglietto con Sì / No
  const ask = (o: { title: string; text: string; yes: string; no: string; onYes: () => void; onNo: () => void; kind?: 'menu' | 'overlay' }) => {
    show(
      `<div class="card paper confirm">
        <div class="title small">${o.title}</div>
        <div class="sub">${o.text}</div>
        <div class="buttons row">
          <button data-a="no">${o.no}</button>
          <button class="primary" data-a="yes">${o.yes}</button>
        </div>
      </div>`,
      (e) => {
        const a = action(e)?.dataset.a;
        if (a === 'yes') o.onYes();
        else if (a === 'no') o.onNo();
      },
      o.kind ?? 'overlay',
    );
  };

  // ?cap=N nell'indirizzo: scorciatoia per i test (compare come primo pulsante del menu)
  const capParam = Number(new URLSearchParams(location.search).get('cap'));

  const begin = () => {
    unlockChapter(g.chapterNum); // un capitolo che hai giocato resta sbloccato nel menu
    g.audio.init(); // i browser sbloccano l'audio solo dopo un click
    g.audio.resume();
    g.mode = 'play';
    g.fade(true);
    g.after(0.1, () => g.fade(false));
    g.chapterDef.start(g);
    hide();
    g.input.lock();
    // telefono: schermo intero e orizzontale, dove il browser lo permette (su iPhone no)
    if (TOUCH && !document.fullscreenElement) {
      document.documentElement
        .requestFullscreen?.({ navigationUI: 'hide' })
        .then(() => (window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => {});
    }
  };

  const startChapter = (num: number, fresh: boolean) => {
    const c = CHAPTERS[num - 1];
    if (fresh) g.resetState(c.startState);
    g.loadChapter(c);
    begin();
  };

  // =========================================================================
  // MENU PRINCIPALE
  // =========================================================================
  const mainMenu = () => {
    g.mode = 'title';
    g.input.unlock();
    g.closeChapter();
    const save = Game.loadSave();
    const saved = save && CHAPTERS[save.chapter - 1];
    show(
      `<div class="menu-page">
        ${WAVING_STICKMAN}
        <div class="menu-main">
          <div class="title big">STILIZZATO</div>
          <div class="sub">un gioco disegnato a matita</div>
          <div class="buttons menu-buttons">
            ${capParam && CHAPTERS[capParam - 1] ? `<button class="primary" data-a="test">Test: capitolo ${capParam}<small>parte con lo stretto necessario</small></button>` : ''}
            ${saved ? `<button class="${capParam ? '' : 'primary'}" data-a="continue">Continua<small>Capitolo ${saved.num}: ${saved.title}</small></button>` : ''}
            <button class="${saved || capParam ? '' : 'primary'}" data-a="new">${saved ? 'Nuova partita' : 'Inizia partita'}</button>
            <button data-a="chapters">Seleziona capitolo</button>
            <button data-a="settings">Impostazioni</button>
          </div>
          <div class="menu-foot">Capitoli disegnati: ${CHAPTERS.length} su ${TOTAL_CHAPTERS}</div>
        </div>
      </div>`,
      (e) => {
        const b = action(e);
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'test') return startChapter(capParam, true);
        if (a === 'continue' && save) {
          g.state = save.state;
          g.loadChapter(CHAPTERS[save.chapter - 1]);
          return begin();
        }
        if (a === 'new') {
          if (!saved) return startChapter(1, true);
          return ask({
            title: 'Nuova partita?',
            text: 'Si ricomincia dal capitolo 1 e il salvataggio di adesso viene sostituito.',
            yes: 'Sì, ricomincia',
            no: 'No, torna indietro',
            onYes: () => startChapter(1, true),
            onNo: mainMenu,
            kind: 'menu',
          });
        }
        if (a === 'chapters') return chaptersMenu();
        if (a === 'settings') return settingsMenu(mainMenu);
      },
      'menu',
    );
  };

  // =========================================================================
  // CAPITOLI: si sbloccano finendo il precedente o con la password
  // =========================================================================
  const chaptersMenu = (msg = '') => {
    const open = unlockedChapters();
    const rows = CHAPTERS.map((c) =>
      open.has(c.num)
        ? `<button data-a="ch" data-n="${c.num}">Capitolo ${c.num}<small>${c.title}</small></button>`
        : `<button class="locked" disabled>🔒 Capitolo ${c.num}<small>bloccato</small></button>`,
    ).join('');
    show(
      `<div class="menu-page">
        <div class="menu-main wide">
          <div class="title small">Seleziona capitolo</div>
          <div class="sub">Se salti un capitolo, parti con lo stretto necessario.</div>
          <div class="buttons chapter-grid">${rows}</div>
          <div class="password">
            <input type="text" placeholder="password" maxlength="24" autocomplete="off" spellcheck="false" />
            <button data-a="pwd">Sblocca</button>
          </div>
          <div class="msg">${msg}</div>
          <div class="buttons"><button data-a="back">Indietro</button></div>
        </div>
      </div>`,
      (e) => {
        const b = action(e);
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'back') return mainMenu();
        if (a === 'ch') {
          const n = Number(b!.dataset.n);
          if (!Game.loadSave()) return startChapter(n, true);
          return ask({
            title: `Capitolo ${n}?`,
            text: 'Parti con lo stretto necessario e il salvataggio di adesso viene sostituito.',
            yes: 'Sì, inizia',
            no: 'No, torna indietro',
            onYes: () => startChapter(n, true),
            onNo: () => chaptersMenu(),
            kind: 'menu',
          });
        }
        if (a === 'pwd') {
          const val = (screen.querySelector('.password input') as HTMLInputElement).value.trim().toUpperCase();
          const c = CHAPTERS.find((c) => c.password && c.password === val);
          if (!c) return chaptersMenu('Password sbagliata. O scritta male. O disegnata male.');
          unlockChapter(c.num);
          return chaptersMenu(`Capitolo ${c.num} sbloccato!`);
        }
      },
      'menu',
    );
    const input = screen.querySelector('.password input') as HTMLInputElement;
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation(); // non far arrivare i tasti al gioco
      if (ev.key === 'Enter') (screen.querySelector('[data-a="pwd"]') as Btn).click();
    });
  };

  // =========================================================================
  // IMPOSTAZIONI: comandi, sensibilità, volumi
  // =========================================================================
  const settingsMenu = (back: () => void, kind: 'menu' | 'overlay' = 'menu', msg = '') => {
    const rows = ACTIONS.map(
      (a) => `<div class="bind"><span>${a.label}</span><button data-a="bind" data-id="${a.id}">${codeLabel(SETTINGS.keys[a.id])}</button></div>`,
    ).join('');
    const slider = (id: string, label: string, min: number, max: number, step: number, val: number) =>
      `<label class="slider"><span>${label}</span><input type="range" data-id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" /><b>${Math.round(val * 100)}%</b></label>`;
    show(
      `<div class="menu-page">
        <div class="menu-main wide settings">
          <div class="title small">Impostazioni</div>
          <div class="sliders">
            ${slider('sensitivity', TOUCH ? 'Sensibilità della visuale' : 'Sensibilità del mouse', 0.3, 2.5, 0.05, SETTINGS.sensitivity)}
            ${slider('music', 'Volume musica', 0, 1, 0.05, SETTINGS.music)}
            ${slider('sfx', 'Volume effetti e voci', 0, 1, 0.05, SETTINGS.sfx)}
          </div>
          ${TOUCH ? `<div class="buttons row"><button data-a="flip">Capovolgi lo schermo${SETTINGS.flip ? ' ✓' : ''}</button></div>
          <div class="sub fixed">Se tieni il telefono girato dall'altra parte (con lo schermo bloccato in verticale).</div>` : ''}
          ${TOUCH ? '' : `<div class="sub">Comandi: clicca su un tasto e premi quello nuovo (Esc per annullare).</div>
          <div class="binds">${rows}</div>
          <div class="sub fixed">Fissi: <b>Click</b> colpisci · <b>Tasto destro</b> para · <b>Esc</b> pausa · <b>frecce</b> muoviti</div>`}
          <div class="msg">${msg}</div>
          <div class="buttons row">
            ${TOUCH ? '' : '<button data-a="reset">Ripristina comandi</button>'}
            <button class="primary" data-a="back">Indietro</button>
          </div>
        </div>
      </div>`,
      (e) => {
        const b = action(e);
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'back') {
          g.input.captureKey = null;
          return back();
        }
        if (a === 'flip') {
          SETTINGS.flip = !SETTINGS.flip;
          saveSettings();
          g.resize();
          return settingsMenu(back, kind, SETTINGS.flip ? 'Schermo capovolto.' : 'Schermo nel verso normale.');
        }
        if (a === 'reset') {
          resetKeys();
          return settingsMenu(back, kind, 'Comandi ripristinati.');
        }
        if (a === 'bind') {
          const id = b!.dataset.id as (typeof ACTIONS)[number]['id'];
          screen.querySelectorAll('[data-a="bind"]').forEach((x) => x.classList.remove('waiting'));
          b!.classList.add('waiting');
          b!.textContent = 'premi un tasto…';
          g.input.captureKey = (code) => {
            if (code === 'Escape') return settingsMenu(back, kind);
            bindKey(id, code);
            settingsMenu(back, kind, `${ACTIONS.find((x) => x.id === id)!.label}: ${codeLabel(code)}`);
          };
        }
      },
      kind,
    );
    screen.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const v = Number(inp.value);
        const id = inp.dataset.id as 'sensitivity' | 'music' | 'sfx';
        SETTINGS[id] = v;
        (inp.nextElementSibling as HTMLElement).textContent = `${Math.round(v * 100)}%`;
        saveSettings();
        g.audio.applyVolumes();
      }),
    );
  };

  // =========================================================================
  // PAUSA
  // =========================================================================
  const pauseMenu = () => {
    g.audio.suspend();
    show(
      `<div class="card paper">
        <div class="title small">Pausa</div>
        <div class="sub">anche gli omini stilizzati hanno bisogno di una pausa</div>
        ${controls()}
        <div class="buttons">
          <button class="primary" data-a="resume">Riprendi</button>
          <button data-a="settings">Impostazioni</button>
          <button data-a="menu">Menu principale</button>
        </div>
      </div>`,
      (e) => {
        const a = action(e)?.dataset.a;
        if (!a) return;
        if (a === 'resume') {
          g.audio.resume();
          hide();
          g.input.lock();
        } else if (a === 'settings') {
          settingsMenu(pauseMenu, 'overlay');
        } else if (a === 'menu') {
          ask({
            title: 'Tornare al menu?',
            text: "Quando continuerai, ripartirai dall'inizio di questo capitolo.",
            yes: 'Sì, torna al menu',
            no: 'No, resto qui',
            onYes: mainMenu,
            onNo: pauseMenu,
          });
        }
      },
    );
  };

  g.input.onLock.push((locked) => {
    if (locked) {
      g.audio.resume();
      if (g.mode !== 'end') hide();
      return;
    }
    if (g.mode === 'play' && screen.style.display !== 'flex') pauseMenu();
  });

  // =========================================================================
  // GAME OVER
  // =========================================================================
  g.onGameOver = (title, text, retry) => {
    g.input.unlock();
    show(
      `<div class="card paper">
        <div class="title small">${title}</div>
        <div class="sub">${text}</div>
        <div class="buttons"><button class="primary" data-a="retry">Riprova</button></div>
      </div>`,
      (e) => {
        if (action(e)?.dataset.a !== 'retry') return;
        retry();
        g.mode = 'play';
        hide();
        g.input.lock();
      },
    );
  };

  // =========================================================================
  // FINE CAPITOLO
  // =========================================================================
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
          <button data-a="menu">Menu principale</button>
        </div>
      </div>`,
      (e) => {
        const a = action(e)?.dataset.a;
        if (!a) return;
        if (a === 'next' && nextCh) {
          g.loadChapter(nextCh);
          begin();
        } else if (a === 'menu') {
          mainMenu();
        } else {
          g.mode = 'play';
          hide();
          g.input.lock();
        }
      },
    );
  };

  mainMenu();
}
