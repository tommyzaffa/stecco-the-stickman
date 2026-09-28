import { Game, deserializeState, serializeState, type RawState } from './game';
import { CHAPTERS } from '../chapters';
import { DEMO } from '../chapters/demo';
import { ACTIONS, QUALITY_LABEL, SETTINGS, bindKey, codeLabel, keyName, resetKeys, saveSettings, type Quality } from '../settings';
import { TOUCH } from '../touch';
import { ACCOUNT, authError, type Progress } from '../account';

// ---------------------------------------------------------------------------
// Schermate fuori dal gioco: accesso, menu principale, capitoli, impostazioni, pausa,
// game over, fine capitolo. E il passaggio tra capitoli.
//
// Modalità:
//  - storia: una sola per account. Si salva all'inizio di ogni capitolo; "Continua" riparte da lì,
//    "Nuova partita" azzera tutto.
//  - capitoli: si sblocca finendo la storia. Capitolo a scelta, con lo stretto necessario; finito
//    il capitolo si torna alla lista, e la storia non cambia.
//  - demo: "la pagina di prova", un percorso che insegna tutti i comandi (anche senza account).
//    Non salva niente; alla fine si torna al menu.
//  - test: ?cap=N, solo in sviluppo.
// ---------------------------------------------------------------------------

const TOTAL_CHAPTERS = 20;
const DEV = import.meta.env.DEV;
// TEMPORANEO: finché il gioco è in lavorazione i capitoli si possono scegliere anche senza aver
// finito la storia (per provarli). All'uscita va rimesso a false.
const OPEN_CHAPTERS = true;
type Mode = 'story' | 'chapters' | 'demo' | 'test';

// Riepilogo dei comandi con i tasti scelti nelle impostazioni (o i pulsanti a schermo sul telefono)
const controls = () => TOUCH ? `
  <div class="controls">
    <div><b>pollice sinistro</b> muoviti (in fondo corri)</div><div><b>trascina a destra</b> guardati intorno</div>
    <div><b>COLPISCI</b> tocca per colpire, trascina per guardare</div><div><b>PARA</b> tieni premuto per parare</div>
    <div><b>tocco veloce a destra</b> colpisci anche così</div><div></div>
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
  let mode: Mode = 'story';
  let progress: Progress = { story: null, finished: false };
  const show = (html: string, onClick: ((e: MouseEvent) => void) | null, kind: 'menu' | 'overlay' = 'overlay') => {
    screen.innerHTML = html;
    screen.className = `screen ${kind}`;
    screen.style.display = 'flex';
    screen.onclick = onClick;
    g.hud.root.classList.toggle('in-menu', kind === 'menu');
    fit();
  };
  // La schermata deve entrare tutta: se è più alta (o larga) dello spazio, si rimpicciolisce.
  // Sotto metà grandezza si scorre invece (non si leggerebbe più niente).
  const fit = () => {
    const el = screen.querySelector<HTMLElement>('.card, .menu-main');
    if (!el || screen.style.display !== 'flex') return;
    el.style.zoom = '';
    // spazio libero: la schermata meno i margini della pagina che la contiene (menu principale)
    const page = el.parentElement?.classList.contains('menu-page') ? getComputedStyle(el.parentElement) : null;
    const padY = page ? parseFloat(page.paddingTop) + parseFloat(page.paddingBottom) : 0;
    const padX = page ? parseFloat(page.paddingLeft) + parseFloat(page.paddingRight) : 0;
    const extraW = el.parentElement?.querySelector('.menu-stickman')?.getBoundingClientRect().width ?? 0;
    const z = Math.min(1, (screen.clientHeight - padY - 16) / el.offsetHeight, (screen.clientWidth - padX - extraW - 24) / el.offsetWidth);
    if (z < 0.99) el.style.zoom = String(Math.max(0.5, z));
  };
  window.addEventListener('resize', () => setTimeout(fit, 60));
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

  // salva la storia (solo in modalità storia)
  const saveStory = (chapter: number, state: RawState) => {
    progress.story = { chapter, state };
    ACCOUNT.save(progress).catch(() => g.toast('Salvataggio non riuscito: controlla la connessione.', 'bad', 5000));
  };

  const begin = () => {
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

  const play = (m: Mode, num: number, state: 'fresh' | 'minimal' | RawState) => {
    mode = m;
    const c = CHAPTERS[num - 1];
    if (state === 'fresh') g.resetState();
    else if (state === 'minimal') g.resetState(c.startState);
    else g.state = deserializeState(state);
    g.saveHook = m === 'story' ? saveStory : null;
    g.loadChapter(c);
    begin();
  };

  // la demo: la pagina di prova (non è un capitolo della storia, non salva)
  const playDemo = () => {
    mode = 'demo';
    g.resetState();
    g.saveHook = null;
    g.loadChapter(DEMO);
    begin();
  };

  // =========================================================================
  // ACCESSO (con Firebase): email e password, Google, oppure la demo
  // =========================================================================
  const loginScreen = (msg = '') => {
    g.mode = 'title';
    g.input.unlock();
    g.closeChapter();
    show(
      `<div class="menu-page">
        ${WAVING_STICKMAN}
        <div class="menu-main login">
          <div class="title big">STECCO</div>
          <div class="title-tag">the Stickman</div>
          <div class="sub">Per giocare serve un account: la tua storia ti segue su ogni dispositivo.</div>
          <div class="buttons menu-buttons">
            <button class="primary" data-a="google">Accedi con Google</button>
          </div>
          <div class="or">oppure con l'email</div>
          <div class="fields">
            <input type="email" name="email" placeholder="email" autocomplete="email" spellcheck="false" />
            <input type="password" name="password" placeholder="password" autocomplete="current-password" />
          </div>
          <div class="buttons row">
            <button data-a="login">Accedi</button>
            <button data-a="signup">Crea account</button>
          </div>
          <button class="link" data-a="forgot">Password dimenticata?</button>
          <div class="msg">${msg}</div>
          <div class="buttons menu-buttons demo">
            <button data-a="demo">Prova la demo<small>tutti i comandi in 3 minuti, senza account</small></button>
            ${DEV ? '<button data-a="local">Entra in locale<small>solo in sviluppo: salvataggi nel browser</small></button>' : ''}
          </div>
          <button class="link" data-a="privacy">Privacy</button>
        </div>
      </div>`,
      async (e) => {
        const a = action(e)?.dataset.a;
        if (!a) return;
        const email = (screen.querySelector('input[name="email"]') as HTMLInputElement).value.trim();
        const password = (screen.querySelector('input[name="password"]') as HTMLInputElement).value;
        const busy = (text: string) => {
          screen.querySelectorAll('button').forEach((b) => (b.disabled = true));
          (screen.querySelector('.msg') as HTMLElement).textContent = text;
        };
        try {
          if (a === 'google') {
            busy('Un attimo…');
            await ACCOUNT.signInGoogle();
            return afterLogin();
          }
          if (a === 'login') {
            busy('Accesso…');
            await ACCOUNT.signInEmail(email, password);
            return afterLogin();
          }
          if (a === 'signup') {
            busy('Creo il tuo account…');
            await ACCOUNT.signUpEmail(email, password);
            return afterLogin();
          }
          if (a === 'forgot') {
            if (!email) return loginScreen("Scrivi la tua email qui sopra, poi premi di nuovo \"Password dimenticata?\".");
            busy('Un attimo…');
            await ACCOUNT.resetPassword(email);
            return loginScreen(`Ti ho mandato un'email a ${email} per scegliere una nuova password.`);
          }
        } catch (err) {
          return loginScreen(authError(err));
        }
        if (a === 'demo') return playDemo();
        if (a === 'local') {
          ACCOUNT.useLocal();
          return afterLogin();
        }
        if (a === 'privacy') return privacyScreen(() => loginScreen());
      },
      'menu',
    );
    screen.querySelectorAll('input').forEach((inp) =>
      inp.addEventListener('keydown', (ev) => {
        ev.stopPropagation(); // i tasti scritti non arrivano al gioco
        if (ev.key === 'Enter') (screen.querySelector('[data-a="login"]') as Btn).click();
      }),
    );
  };

  // Appena dentro: si legge la storia salvata, poi il menu
  const afterLogin = async () => {
    try {
      progress = await ACCOUNT.load();
    } catch {
      progress = { story: null, finished: false };
      return loginScreen('Non riesco a leggere il salvataggio: controlla la connessione e riprova.');
    }
    mainMenu();
  };

  const privacyScreen = (back: () => void) => {
    show(
      `<div class="card paper privacy">
        <div class="title small">Privacy</div>
        <div class="sub">
          Stecco the Stickman è un progetto personale, senza scopo di lucro.<br><br>
          <b>Cosa salviamo:</b> l'email (o l'account Google) che usi per accedere e i progressi del gioco
          (capitolo, statistiche, scelte fatte).<br>
          <b>Perché:</b> solo per farti ritrovare la partita su qualunque dispositivo.<br>
          <b>Dove:</b> su Firebase (Google), che gestisce l'accesso e il database. I dati possono essere
          trattati anche fuori dalla Svizzera e dall'UE, con le garanzie di Google.<br>
          Niente pubblicità, niente tracciamento, niente dati a terzi.<br><br>
          Puoi eliminare l'account e tutti i dati quando vuoi: Impostazioni → Elimina account.
          Per qualsiasi domanda: la pagina del progetto su GitHub.
        </div>
        <div class="buttons"><button class="primary" data-a="back">Indietro</button></div>
      </div>`,
      (e) => {
        if (action(e)?.dataset.a === 'back') back();
      },
      'menu',
    );
  };

  // =========================================================================
  // MENU PRINCIPALE
  // =========================================================================
  const mainMenu = () => {
    g.mode = 'title';
    g.input.unlock();
    g.closeChapter();
    if (!ACCOUNT.loggedIn) return loginScreen();
    const story = progress.story;
    const storyCh = story ? CHAPTERS[story.chapter - 1] : null;
    const chaptersOpen = progress.finished || DEV || OPEN_CHAPTERS;
    show(
      `<div class="menu-page">
        ${WAVING_STICKMAN}
        <div class="menu-main">
          <div class="title big">STECCO</div>
          <div class="title-tag">the Stickman</div>
          <div class="sub">un gioco disegnato a matita</div>
          <div class="buttons menu-buttons">
            ${DEV && capParam && CHAPTERS[capParam - 1] ? `<button class="primary" data-a="test">Test: capitolo ${capParam}<small>parte con lo stretto necessario</small></button>` : ''}
            ${
              story
                ? storyCh
                  ? `<button class="${capParam ? '' : 'primary'}" data-a="continue">Continua<small>Capitolo ${storyCh.num}: ${storyCh.title}</small></button>`
                  : `<button class="locked" disabled>Continua<small>il capitolo ${story.chapter} non è ancora disegnato</small></button>`
                : ''
            }
            <button class="${storyCh || capParam ? '' : 'primary'}" data-a="new">${story ? 'Nuova partita' : progress.finished ? 'Nuova storia' : 'Inizia la storia'}</button>
            ${chaptersOpen ? '<button data-a="chapters">Capitoli<small>gioca un capitolo a scelta</small></button>' : ''}
            <button data-a="demo">Demo<small>tutti i comandi in 3 minuti</small></button>
            <button data-a="settings">Impostazioni</button>
          </div>
          <div class="menu-foot">Capitoli disegnati: ${CHAPTERS.length} su ${TOTAL_CHAPTERS}${
            ACCOUNT.cloud && ACCOUNT.user ? `<br><small>${ACCOUNT.user.email ?? ACCOUNT.user.name ?? 'account'}</small>` : ''
          }</div>
        </div>
      </div>`,
      (e) => {
        const b = action(e);
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'test') return play('test', capParam, 'minimal');
        if (a === 'continue' && story && storyCh) return play('story', story.chapter, story.state);
        if (a === 'new') {
          if (!story) return play('story', 1, 'fresh');
          return ask({
            title: 'Nuova partita?',
            text: 'Si ricomincia dal capitolo 1 e la storia di adesso viene cancellata.',
            yes: 'Sì, ricomincia',
            no: 'No, torna indietro',
            onYes: () => play('story', 1, 'fresh'),
            onNo: mainMenu,
            kind: 'menu',
          });
        }
        if (a === 'chapters') return chaptersMenu();
        if (a === 'demo') return playDemo();
        if (a === 'settings') return settingsMenu(mainMenu);
      },
      'menu',
    );
  };

  // =========================================================================
  // CAPITOLI (dopo aver finito la storia): un capitolo a scelta, la storia non cambia
  // =========================================================================
  const chaptersMenu = () => {
    g.mode = 'title';
    g.input.unlock();
    g.closeChapter();
    const rows = CHAPTERS.map((c) => `<button data-a="ch" data-n="${c.num}">Capitolo ${c.num}<small>${c.title}</small></button>`).join('');
    show(
      `<div class="menu-page">
        <div class="menu-main wide">
          <div class="title small">Capitoli</div>
          <div class="sub">Un capitolo a scelta, con lo stretto necessario. La tua storia non cambia.</div>
          <div class="buttons chapter-grid">${rows}</div>
          <div class="buttons"><button data-a="back">Indietro</button></div>
        </div>
      </div>`,
      (e) => {
        const b = action(e);
        const a = b?.dataset.a;
        if (!a) return;
        if (a === 'back') return mainMenu();
        if (a === 'ch') return play('chapters', Number(b!.dataset.n), 'minimal');
      },
      'menu',
    );
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
          <div class="buttons row"><button data-a="quality">Grafica: ${QUALITY_LABEL[SETTINGS.quality]}</button></div>
          <div class="sub fixed">${
            SETTINGS.quality === 'leggera'
              ? 'Leggera: meno pixel, niente antialiasing, 30 fps. Scalda poco.'
              : SETTINGS.quality === 'alta'
                ? 'Alta: più nitida, ma scalda e può far partire la ventola.'
                : 'Normale: il giusto. Se il computer scalda, prova Leggera.'
          }</div>
          ${TOUCH ? `<div class="buttons row"><button data-a="flip">Capovolgi lo schermo${SETTINGS.flip ? ' ✓' : ''}</button></div>
          <div class="sub fixed">Se tieni il telefono girato dall'altra parte (con lo schermo bloccato in verticale).</div>` : ''}
          ${TOUCH ? '' : `<div class="sub">Comandi: clicca su un tasto e premi quello nuovo (Esc per annullare).</div>
          <div class="binds">${rows}</div>
          <div class="sub fixed">Fissi: <b>Click</b> colpisci · <b>Tasto destro</b> para · <b>Esc</b> pausa · <b>frecce</b> muoviti</div>`}
          ${
            ACCOUNT.cloud && ACCOUNT.user && kind === 'menu'
              ? `<div class="sub fixed account">Account: <b>${ACCOUNT.user.email ?? ACCOUNT.user.name ?? ''}</b></div>
          <div class="buttons row"><button data-a="logout">Esci</button><button data-a="delete">Elimina account</button><button data-a="privacy">Privacy</button></div>`
              : ''
          }
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
        if (a === 'logout') {
          ACCOUNT.signOut().then(() => loginScreen());
          return;
        }
        if (a === 'privacy') return privacyScreen(() => settingsMenu(back, kind));
        if (a === 'delete') {
          return ask({
            title: "Eliminare l'account?",
            text: 'Si cancellano l\'account e tutta la storia salvata. Non si può tornare indietro.',
            yes: 'Sì, elimina tutto',
            no: 'No',
            kind: 'menu',
            onNo: () => settingsMenu(back, kind),
            onYes: () => {
              ACCOUNT.deleteAccount()
                .then(() => {
                  progress = { story: null, finished: false };
                  loginScreen("Account eliminato. Ciao ciao, e grazie d'aver disegnato con noi.");
                })
                .catch((err) => settingsMenu(back, kind, authError(err)));
            },
          });
        }
        if (a === 'quality') {
          const order: Quality[] = ['leggera', 'normale', 'alta'];
          SETTINGS.quality = order[(order.indexOf(SETTINGS.quality) + 1) % order.length];
          saveSettings();
          g.resize();
          return settingsMenu(back, kind);
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
            text:
              mode === 'story'
                ? "Quando continuerai, ripartirai dall'inizio di questo capitolo."
                : mode === 'demo'
                  ? 'La demo ricomincerà da capo.'
                  : 'Il capitolo ricomincerà da capo.',
            yes: 'Sì, torna al menu',
            no: 'No, resto qui',
            onYes: () => (mode === 'chapters' ? chaptersMenu() : mainMenu()),
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
    g.input.unlock();
    g.audio.jingle();
    const c = g.chapterDef;
    const side = c.sideQuests.filter((q) => g.questDone(q)).length;
    const mins = Math.floor(g.chapterTime / 60), secs = Math.floor(g.chapterTime % 60);
    const nextCh = CHAPTERS[next - 1];
    // la storia va avanti: si salva subito l'inizio del capitolo dopo (o la fine della storia)
    if (mode === 'story') {
      if (next > TOTAL_CHAPTERS) {
        progress = { story: null, finished: true };
        ACCOUNT.save(progress).catch(() => {});
      } else saveStory(next, serializeState(g.state));
    }
    const stats = `<div class="stats-end">
          <div>Tempo: <b>${mins}m ${secs}s</b></div>
          <div>Livello: <b>${g.state.level}</b> · Monete: <b>${g.state.coins}</b></div>
          <div>Missioni secondarie: <b>${side}/${c.sideQuests.length}</b></div>
        </div>`;
    const buttons =
      mode === 'story'
          ? next > TOTAL_CHAPTERS
            ? `<div class="sub">Hai finito la storia! Adesso puoi rigiocare i capitoli che vuoi, o iniziarne una nuova.</div>
              <button class="primary" data-a="menu">Menu principale</button>`
            : `${
                nextCh
                  ? `<button class="primary" data-a="next">Capitolo ${nextCh.num}<small>${nextCh.title}</small></button>`
                  : `<div class="sub">Il capitolo ${next} non è ancora stato disegnato. La tua storia è salvata: la riprendi da qui.</div>`
              }
              <button ${nextCh ? '' : 'class="primary" '}data-a="menu">Menu principale</button>`
          : `<button class="primary" data-a="list">Torna ai capitoli</button><button data-a="menu">Menu principale</button>`;
    if (mode === 'demo') {
      show(
        `<div class="card paper">
          <div class="title small">Demo finita</div>
          <div class="sub">Adesso sai tutti i comandi. La storia ti aspetta.</div>
          <div class="stats-end"><div>Tempo: <b>${mins}m ${secs}s</b></div></div>
          <div class="buttons"><button class="primary" data-a="menu">Menu principale</button></div>
        </div>`,
        (e) => {
          if (action(e)?.dataset.a === 'menu') mainMenu();
        },
      );
      return;
    }
    show(
      `<div class="card paper">
        <div class="title small">Capitolo ${c.num} completato</div>
        <div class="sub">${c.title}</div>
        ${stats}
        <div class="sub"><i>${g.lastTeaser}</i></div>
        <div class="buttons">${buttons}</div>
      </div>`,
      (e) => {
        const a = action(e)?.dataset.a;
        if (!a) return;
        if (a === 'next' && nextCh) return play('story', next, serializeState(g.state));
        if (a === 'list') return mode === 'test' ? mainMenu() : chaptersMenu();
        if (a === 'menu') return mainMenu();
      },
    );
  };

  // se esci da un'altra scheda (o ti scade la sessione) si torna alla schermata di accesso
  ACCOUNT.onChange = () => {
    if (ACCOUNT.cloud && !ACCOUNT.loggedIn && g.mode !== 'play') loginScreen();
  };

  // Avvio: un attimo per sapere se sei già dentro, poi menu (o accesso)
  show('<div class="card paper"><div class="sub">un attimo…</div></div>', null, 'menu');
  ACCOUNT.init()
    .then(() => (ACCOUNT.loggedIn ? afterLogin() : loginScreen()))
    .catch(() => loginScreen('Non riesco a collegarmi. Controlla la connessione e ricarica la pagina.'));
}
