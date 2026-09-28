# Stecco the Stickman


Videogioco in prima persona in stile "disegno a matita": omini stilizzati, mondo fatto di linee
d'inchiostro su carta, tono ironico e satirico. Lingua del gioco: **italiano**.

## Avvio

```bash
npm install
npm run dev        # http://localhost:5317 (vedi .claude/launch.json)
npm run typecheck
npm run build
```

## Stack

Three.js + TypeScript + Vite. Nessun asset esterno: tutte le texture sono disegnate su canvas a
runtime (`src/render/textures.ts`), le animazioni degli omini sono procedurali.

## Struttura

- `src/render/` — stile grafico
  - `sketch.ts`: classe `Sketch` che accumula linee (fat lines, con sbordature e tremolio "a mano")
    e riempimenti; `makeHatchMaterial` = carta + tratteggio sulle facce in ombra.
  - `postfx.ts`: post-processing (line boil a 8 fps, grana carta, vignetta, flash danno).
  - `palette.ts`: colori e **tema** (`DAY` inchiostro su carta, `NIGHT` gesso su carta nera,
    `QUADRETTI` carta a quadretti: la griglia la disegna lo shader del tratteggio,
    `PACCHI` carta da pacchi, `CARTONCINO` cartoncino prugna a lume di candela, `MILLIMETRATA`
    carta millimetrata: `grid.major` = una riga più marcata ogni N, `RIGHE` quaderno a righe:
    `grid.rows` = solo righe orizzontali, anche sui muri). `CERA` = colori dei Pastelli a Cera.
    Il tema va impostato prima di costruire un capitolo (lo fa `Game.loadChapter`).
- `src/world/` — `builder.ts` (`WorldBuilder`: muri, porte, edifici, cartelli, neon, alberi,
  `ceiling` per gli interni, `wallText` per le scritte sui muri...; `finish()` restituisce un
  `World`), `collision.ts` (collisioni 2D su XZ + linea di vista; gli ostacoli `low` nascondono
  solo chi è accovacciato; `Rect.h` = altezza, sopra passano i colpi).
- `src/entities/` — `Stickman` (scheletro + pose/azioni, KO), `StickDog`, `NPC` (comportamenti:
  stand/sit/patrol/circle/follow; `controlled` quando lo guida il combattimento).
- `src/game/` — `Game` (stato, API per i contenuti, ciclo di gioco, salvataggi), `DialogueRunner`,
  `combat.ts` (risse e furtività: `Fighter`, guardie con campo visivo, porte come nodi di
  navigazione; `FighterOpts.ranged` = nemici che sparano), `guns.ts` (armi da fuoco: raggi,
  scie, macchie, linee di mira, bersagli `Target`), `flow.ts` (titolo, pausa, fine capitolo),
  `quests.ts` (tipi missioni).
- `src/chapters/` — **un capitolo per cartella** (`c1`, `c2`, ...): `world.ts` (il luogo),
  `characters.ts` (PNG e dialoghi), `quests.ts`, `story.ts` (logica e scene), `index.ts`
  (definizione `Chapter`). Registrati in `src/chapters/index.ts`.
- `src/content/` — dati condivisi tra capitoli: oggetti (`items.ts`) e voci (`voices.ts`).
- `src/ui/hud.ts` — HUD in HTML/CSS sopra il canvas (`src/style.css`).
- `src/audio/` — audio tutto sintetizzato con Web Audio (nessun file): `audio.ts` effetti, voci a
  bip, sorgenti nel mondo (`addEmitter`), filtro "musica ovattata" (`setMusicMuffle`);
  `music.ts` sequencer + brani (`paese`, `club`, `sbiadisco`, `indagine`, `mercato`, `sparatoria`,
  `cena`, `violino`, `consegna`, `trasloco`). Suoni della macchina (capitolo 6): `car(v, freno, sbandata)`
  continuo, `crash`, `bump`, `scrape`, `horn`, `wiper`, `bleat`, `glow`, `erase`.
  L'AudioContext si sblocca solo con un click (schermata del titolo).

## Sistemi riusabili

- **Indizi** (capitolo 3): il capitolo imposta `g.clues`; `g.findClue(id)` li segna (flag
  `clue_<id>`), compaiono nel diario. Gli oggetti da esaminare usano `icon: 'clue'`.
- **Game over**: `g.gameOver(titolo, testo, riprova)` mostra la schermata con "Riprova";
  `riprova` rimette le cose a posto (es. capitolo 3: tre accuse sbagliate).
- `NpcSpec.talkRadius` per chi si parla da lontano (es. il testimone sul balcone).
- `WorldBuilder.daySky('mountains' | 'skyline')` per il cielo di giorno.
- **Dialoghi e regia**: la testa si gira da sola verso chi parla (anche un `@Nome|` che non è il
  PNG con cui hai iniziato). `DNode.look` = cosa guardare durante le righe del narratore di quel
  nodo (un oggetto, un punto). `g.onLine` = callback a ogni riga (es. "TOC" → suono del martelletto).
  `player.seated` per le scene da seduti. Durante i dialoghi il braccio/arma si abbassa.
- **Risposte a tempo**: `DNode.timer` (secondi) e `DNode.timeout` (nodo se non scegli: di solito
  "stai zitto"). Barra che si accorcia nel riquadro del dialogo.
- **Barra di capitolo**: `g.hud.meter({label, value 0..1, color})` e `g.hud.meterPop('+10', buono)`
  (capitolo 5: interesse di Martina).
- **Seduti**: `player.seated` = ci si guarda intorno ma non ci si muove, non si salta e non si
  colpisce (il click resta in `input.clicked` per il capitolo). `patrol` con `once: true` percorre
  la strada una volta e si ferma (con `wait` si fermerebbe a ogni punto).
- **Chi ti segue** (`behavior: 'follow'` verso il giocatore) segue le tue tracce: passa dalle porte,
  non attraversa i muri; se si perde riappare dietro di te, fuori dalla visuale.
- **Armi da fuoco** (capitolo 4): oggetto `pistola`, tasto `weapon3`, `reload`; `GameState.clip/ammo`,
  `g.clipSize` (flag `caricatoreGrande` = 12). `g.addPickup('ammo' | 'heal', x, z, valore)`.
  Nemici che sparano: `fighter.ranged` (si riparano, si alzano, mirano con una linea colorata
  visibile, sparano); `fighter.cover` = copertura iniziale, poi la cambiano da soli tra
  `combat.covers` (`combat.buildCovers(zona)` li calcola attorno agli ostacoli bassi) e ti aggirano
  se resti riparato. `FighterOpts.zigzag` = chi corre a zig-zag col coltello. Chi spara non para i
  pugni. Accovacciato dietro un ostacolo basso non ti colpiscono quasi mai; fermo allo scoperto
  ti inquadrano (`player.stillT`). `g.guns.targets` per sagome e barili.
  `g.guns.ceiling` = soffitto per i colpi al chiuso. `NpcSpec.onShot/shotLines` per i civili colpiti.
- **Guida** (capitolo 6, `src/chapters/c6/drive.ts`): la strada è una sola (`road.ts`: tratti dritti
  e curve con pendenza, coordinate stradali `s`/`d`), la macchina senza motore va a pendenza, attrito
  e aria; si sterza e si frena (niente acceleratore); ferma in piano o in salita spingono Marco e
  Luca, col freno tenuto da fermi spingono indietro. Curve troppo veloci = contro il bordo, urti
  forti = pezzi persi (4, poi game over). Inseguimento della Scatola da 24 (in discesa li semini,
  in piano/salita ti prendono), cera sul parabrezza e tergicristallo, posta da lanciare nelle
  cassette (mira aiutata), tappi, pecore e nonna da scansare col clacson ("bip"), tappe con Riprova.
  Il mondo è a pezzi da 100 m (`REFS.chunks`) e ciò che è lontano non si disegna.
- **Pavimento a quota variabile**: `player.floor` (default 0), da aggiornare a ogni frame dal
  capitolo (capitolo 6 sotto lo zero, capitolo 7 scale e primo piano con `floorAt()`). Le collisioni
  restano 2D: i due piani non devono avere zone calpestabili sovrapposte.
- **Portare i mobili** (capitolo 7, `c7/carry.ts`): `player.carrying` (piano, niente salti, pugni,
  parate e armi; `player.speedMul`). Il mobile è una sagoma di rettangoli davanti a te che gira con
  la visuale; se una mossa lo farebbe entrare in un muro si prova a scivolare, se no resta com'era.
  Gli ostacoli `low` (ringhiere, tavoli) non contano. USA = cambia capo con Marco, SALTA = divano
  in piedi, GIÙ = rimettilo a posto. **Puzzle del cassone** (`c7/pack.ts`): incastro 5×9 su un canvas
  (minigioco: puntatore finto mosso dal mouse; sul telefono si trascina), niente aiuti (una
  soluzione è scritta in cima a `pack.ts`). Il divano in piedi si disegna in trasparenza (copriva tutto);
  Marco tiene l'altro capo con l'azione `carry` di `Stickman` (mani su `grip`, non dentro il mobile).
- **Opzioni del capitolo sul Game** (tornano normali allo scarico): `g.touchMode` = pulsanti a
  schermo speciali (`{fire, use, jump, crouch}`: testo o `null` per nasconderlo), `g.hideNameTags`,
  `g.interactOff` (niente "parla con"/"usa"). Gli elementi HTML con classe `chapter-ui` spariscono
  da soli con il capitolo.

## Pubblicazione e telefono

- Il gioco è online su https://tommyzaffa.github.io/stecco-the-stickman/ : `.github/workflows/deploy.yml`
  lo ricostruisce e lo pubblica a ogni push su `main` (repo pubblico, `vite.config.ts` con
  `base: './'`).
- **Telefono** (`src/touch.ts` rileva il touch; `?touch=1` lo forza su computer per provarlo):
  `src/ui/touch.ts` disegna joystick, zona per la visuale e pulsanti (COLPISCI/SPARA: un tocco = un colpo,
  al rilascio; trascinato fa da levetta per la visuale e non spara; anche un tocco veloce sulla metà
  destra colpisce al mirino; ARMA sta in alto con DIARIO e pausa), e scrive in `Input`
  (`moveX/moveY`, `press(azione)`, `hold`, `cycleWeapon`). Niente pointer lock: `input.lock()`
  è virtuale e `input.onLock` avvisa il flusso (pausa). `keyName()` restituisce i nomi dei
  pulsanti (USA, GIÙ, ARMA...), `parryName()`/`attackName()` per i testi su parata e attacco:
  **nei testi mai "click" o "tasto destro" scritti a mano**. Sul telefono: meno pixel, niente
  antialiasing, mira assistita della pistola. Interfaccia compatta sotto i 540 px di altezza.
- **Rotazione** (`src/view.ts`): se sul telefono lo schermo è verticale (blocco rotazione attivo),
  la pagina si disegna girata di 90° e si gioca tenendolo in orizzontale (barre di Safari di
  lato). `VIEW.w/h` = dimensioni del gioco: **usarle al posto di `window.innerWidth/Height`**, e
  nel CSS `var(--gw)/var(--gh)` al posto di `vw/vh`. I tocchi passano da `toGame()`. "Capovolgi lo
  schermo" nelle impostazioni per l'altro verso. **Su iPhone in Safari** girato in orizzontale vero
  (blocco rotazione spento) il gioco va in pausa con l'avviso "Attiva il blocco rotazione"
  (`VIEW.needLock`; `?iphone=1` lo simula). Android, iPad e schermata Home: nessun blocco.

- **Mai emoji** (sul telefono ▶ ◀ e simili diventano emoji colorate): frecce e simboli vanno
  disegnati (SVG, es. `arrowSvg()` in `ui/touch.ts`); nei testi, se proprio serve, con `\uFE0E`.
- **Mai `confirm()`/`alert()` del browser**: per le conferme c'è `ask()` in `flow.ts` (foglietto
  con Sì/No). Sul telefono i clic simulati dopo un tocco vanno ignorati (`Input` li scarta):
  un tocco = un'azione.

## Capitoli, account e salvataggi

- **Account** (`src/account.ts`, `ACCOUNT`): con Firebase configurato (`src/firebase-config.ts`)
  si gioca solo con un account (email+password o Google); la storia sta in Firestore
  (`users/{uid}`, regole in `firestore.rules`: ognuno legge/scrive solo il suo). Con la
  configurazione a `null` il gioco è in modalità locale (salvataggi nel browser, nessun login).
  In sviluppo la schermata di accesso ha "Entra in locale". Firebase si carica solo se serve.
- **Storia** (una per account): si salva all'inizio di ogni capitolo (`Game.saveHook`, stato +
  capitolo). "Continua" riparte da lì, "Nuova partita" azzera. Finiti i 20 capitoli si sblocca
  la **modalità Capitoli**: un capitolo a scelta con il suo `startState` (**solo lo stretto
  necessario**); finito, si torna alla lista e la storia non cambia. **Per ora (gioco in
  lavorazione) `OPEN_CHAPTERS = true` in `flow.ts` la apre a tutti: all'uscita va rimesso a false.**
- **Demo** (`src/chapters/demo/`, `DEMO`, non sta in `CHAPTERS`): "la pagina di prova", un percorso
  di circa 3 minuti che insegna un comando alla volta con il Tutorial (guarda, cammina, corri a
  tempo, salta la pozzanghera, accovacciati sotto la sbarra, parla e scegli, monete, diario,
  colpisci, para, righello, pistola e sagome, ricarica). Si apre dal menu, anche senza account,
  non salva niente e alla fine torna al menu. Se si aggiunge un comando nuovo al gioco, va
  aggiunta una tappa.
- All'avvio: schermata di accesso (o menu principale, se sei già dentro). Nessun capitolo è
  caricato finché non si inizia (`Game.closeChapter`). Mai `confirm()` del browser: `ask()`.
- **Impostazioni** (`src/settings.ts`): tasti riassegnabili, sensibilità del mouse, volumi.
  Nel codice non usare mai codici tasto fissi per le azioni: `input.isDown('jump')`,
  `input.wasPressed('interact')`, e nei testi `keyName('interact')`.
- `?cap=N` nell'indirizzo aggiunge al menu il pulsante "Test: capitolo N" (solo in sviluppo).
- Gli id delle missioni sono globali (lo stato di tutte le missioni resta): la missione
  principale del capitolo N si chiama `cN`. `QUEST_DONE = 999`.
- Quando un capitolo viene scaricato, tutto il suo contenuto sparisce (PNG, oggetti, suoni,
  logica): i riferimenti ai capitoli precedenti si fanno con i flag e lo stato delle missioni.

## Prestazioni

Impostazione **Grafica** (`SETTINGS.quality`, `qualityParams()` in `settings.ts`): Leggera
(1 MP, niente antialiasing, 30 fps), **Normale** (predefinita: 1,5 MP, MSAA 2x, 60 fps), Alta
(2,4 MP, MSAA 4x). Sul telefono valori più bassi. 10 fps su titolo/pausa (`src/main.ts`). Il
post-processing è un solo passaggio (`postfx.ts`) che scrive direttamente a schermo. Il renderer
non chiede la scheda grafica potente (`powerPreference: 'default'`): sui portatili con due schede
scaldava. Non alzare questi limiti senza misurare: su un Mac Retina facevano partire la ventola.

## Obiettivo e metodo di lavoro

Progetto da portfolio (nessuno scopo di lucro), **20 capitoli da ~10 minuti**. Si lavora **un
capitolo alla volta, chiudendolo del tutto** (grafica, dialoghi, suoni) prima di passare al
successivo. **Ogni capitolo porta una meccanica nuova** (indagine, sparatoria, appuntamento a
dialoghi, guida, furtività su più piani...): mai due capitoli che si giocano uguali.
Completati: capitolo 1 (San Scarabocchio), 2 (Il Parallelepipedo), 3 (Il Banco dei Pegni, Quadropoli),
4 (Il Mercato Nero: poligono, asta, sparatoria a ondate con il Pastellone),
5 (L'appuntamento: cena a portate con Martina, interesse, risposte a tempo, Marco da scacciare),
6 (Consegna a domicilio: la macchina senza motore di Luca giù per 1300 metri, i Pastelli dietro),
7 (Il trasloco: mobili giù per la scala a U con Marco, incastro nel cassone del furgone).
Piano di tutti i capitoli: `docs/CAPITOLI.md`.

## Convenzioni per i contenuti

- Righe di dialogo: `'testo'` = parla il PNG, `'> testo'` = parla il giocatore,
  `'* testo'` = narratore, `'@Nome| testo'` = altro personaggio.
- Le ricompense vanno nel `do` dell'**ultimo** nodo del dialogo, così le notifiche arrivano alla fine.
- Stato missioni: `g.quest(id)` → -1 non iniziata, 0..n-1 passo attivo, n = completata.
- Il protagonista si chiama "Stecco". La città ha 47 abitanti, 3 dimensioni, 0 colori.
- Umorismo: meta-ironia sull'essere disegnati (niente mani, niente tasche, niente colori),
  burocrazia, vita di paese. **Le gag sulle date e sugli anni ("dal 2014", "dal 1998") sono
  state abusate: al massimo una per capitolo.**
- Risse: gli avversari parano sempre; si colpisce solo dopo aver parato un loro attacco, finché
  sono scoperti. `parries: [min, max]` nel `FighterOpts` decide quante parate servono.

## Test nel browser integrato

Quando il pannello è nascosto `requestAnimationFrame` non gira: per testare da script chiamare
`game.update(1/60)` a mano (con `game.input.locked = true`). `window.game` è esposto per il debug.
Il minigioco di ballo usa l'orologio dell'audio se la musica suona: per testarlo da script
sospendere l'AudioContext così usa il tempo di gioco. Gli screenshot a volte mostrano il frame
precedente: farne due. I `setTimeout` dei messaggi (toast) vanno in tempo reale, non di gioco.
Capitolo 6: `window.__c6` (solo in sviluppo) espone `DRIVE`, `ROAD`, `REFS`, `S` per le prove.
