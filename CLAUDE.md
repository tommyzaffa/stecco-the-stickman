# Stilizzato

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
    `PACCHI` carta da pacchi). `CERA` = colori dei Pastelli a Cera.
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
  `music.ts` sequencer + brani (`paese`, `club`, `sbiadisco`, `indagine`, `mercato`, `sparatoria`).
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

## Pubblicazione e telefono

- Il gioco è online su https://tommyzaffa.github.io/stilizzato/ : `.github/workflows/deploy.yml`
  lo ricostruisce e lo pubblica a ogni push su `main` (repo pubblico, `vite.config.ts` con
  `base: './'`).
- **Telefono** (`src/touch.ts` rileva il touch; `?touch=1` lo forza su computer per provarlo):
  `src/ui/touch.ts` disegna joystick, zona per la visuale e pulsanti, e scrive in `Input`
  (`moveX/moveY`, `press(azione)`, `hold`, `cycleWeapon`). Niente pointer lock: `input.lock()`
  è virtuale e `input.onLock` avvisa il flusso (pausa). `keyName()` restituisce i nomi dei
  pulsanti (USA, GIÙ, ARMA...), `parryName()`/`attackName()` per i testi su parata e attacco:
  **nei testi mai "click" o "tasto destro" scritti a mano**. Sul telefono: meno pixel, niente
  antialiasing, mira assistita della pistola. Interfaccia compatta sotto i 540 px di altezza.

## Capitoli e salvataggi

- Si salva in `localStorage` all'inizio di ogni capitolo (stato del giocatore + capitolo).
- All'avvio si apre il **menu principale** (`flow.ts`): Continua / Nuova partita / Seleziona
  capitolo / Impostazioni. Nessun capitolo è caricato finché non si inizia (`Game.closeChapter`).
- **Impostazioni** (`src/settings.ts`): tasti riassegnabili, sensibilità del mouse, volumi.
  Nel codice non usare mai codici tasto fissi per le azioni: `input.isDown('jump')`,
  `input.wasPressed('interact')`, e nei testi `keyName('interact')`.
- Menu "Seleziona capitolo": un capitolo si sblocca finendo il precedente o con la sua
  `password` (mostrata a fine del capitolo prima). Saltando a un capitolo si parte con il suo
  `startState`: **solo lo stretto necessario** (es. capitolo 2: 50 monete, niente di più).
- `?cap=N` nell'indirizzo aggiunge al menu il pulsante "Test: capitolo N" (scorciatoia per i test).
- Gli id delle missioni sono globali (lo stato di tutte le missioni resta): la missione
  principale del capitolo N si chiama `cN`. `QUEST_DONE = 999`.
- Quando un capitolo viene scaricato, tutto il suo contenuto sparisce (PNG, oggetti, suoni,
  logica): i riferimenti ai capitoli precedenti si fanno con i flag e lo stato delle missioni.

## Prestazioni

Il gioco è limitato a 60 fps (10 fps su titolo/pausa) in `src/main.ts` e la risoluzione interna è
limitata a ~2.4 MP in `Game.resize()`. Il post-processing è un solo passaggio (`postfx.ts`) che
scrive direttamente a schermo. Non togliere questi limiti senza misurare: su un Mac Retina a
120 Hz facevano andare la ventola al massimo.

## Obiettivo e metodo di lavoro

Progetto da portfolio (nessuno scopo di lucro), **20 capitoli da ~10 minuti**. Si lavora **un
capitolo alla volta, chiudendolo del tutto** (grafica, dialoghi, suoni) prima di passare al
successivo. **Ogni capitolo porta una meccanica nuova** (indagine, sparatoria, appuntamento a
dialoghi, guida, furtività su più piani...): mai due capitoli che si giocano uguali.
Completati: capitolo 1 (San Scarabocchio), 2 (Il Parallelepipedo), 3 (Il Banco dei Pegni, Quadropoli),
4 (Il Mercato Nero: poligono, asta, sparatoria a ondate con il Pastellone).
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
