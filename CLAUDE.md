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
    `QUADRETTI` carta a quadretti: la griglia la disegna lo shader del tratteggio).
    Il tema va impostato prima di costruire un capitolo (lo fa `Game.loadChapter`).
- `src/world/` — `builder.ts` (`WorldBuilder`: muri, porte, edifici, cartelli, neon, alberi...;
  `finish()` restituisce un `World`), `collision.ts` (collisioni 2D su XZ + linea di vista;
  gli ostacoli `low` nascondono solo chi è accovacciato).
- `src/entities/` — `Stickman` (scheletro + pose/azioni, KO), `StickDog`, `NPC` (comportamenti:
  stand/sit/patrol/circle/follow; `controlled` quando lo guida il combattimento).
- `src/game/` — `Game` (stato, API per i contenuti, ciclo di gioco, salvataggi), `DialogueRunner`,
  `combat.ts` (risse e furtività: `Fighter`, guardie con campo visivo, porte come nodi di
  navigazione), `flow.ts` (titolo, pausa, fine capitolo), `quests.ts` (tipi missioni).
- `src/chapters/` — **un capitolo per cartella** (`c1`, `c2`, ...): `world.ts` (il luogo),
  `characters.ts` (PNG e dialoghi), `quests.ts`, `story.ts` (logica e scene), `index.ts`
  (definizione `Chapter`). Registrati in `src/chapters/index.ts`.
- `src/content/` — dati condivisi tra capitoli: oggetti (`items.ts`) e voci (`voices.ts`).
- `src/ui/hud.ts` — HUD in HTML/CSS sopra il canvas (`src/style.css`).
- `src/audio/` — audio tutto sintetizzato con Web Audio (nessun file): `audio.ts` effetti, voci a
  bip, sorgenti nel mondo (`addEmitter`), filtro "musica ovattata" (`setMusicMuffle`);
  `music.ts` sequencer + brani (`paese`, `club`, `sbiadisco`, `indagine`).
  L'AudioContext si sblocca solo con un click (schermata del titolo).

## Sistemi riusabili

- **Indizi** (capitolo 3): il capitolo imposta `g.clues`; `g.findClue(id)` li segna (flag
  `clue_<id>`), compaiono nel diario. Gli oggetti da esaminare usano `icon: 'clue'`.
- **Game over**: `g.gameOver(titolo, testo, riprova)` mostra la schermata con "Riprova";
  `riprova` rimette le cose a posto (es. capitolo 3: tre accuse sbagliate).
- `NpcSpec.talkRadius` per chi si parla da lontano (es. il testimone sul balcone).
- `WorldBuilder.daySky('mountains' | 'skyline')` per il cielo di giorno.

## Capitoli e salvataggi

- Si salva in `localStorage` all'inizio di ogni capitolo (stato del giocatore + capitolo).
- Menu "Capitoli" nel titolo: un capitolo si sblocca finendo il precedente o con la sua
  `password` (mostrata a fine del capitolo prima). Saltando a un capitolo si parte con il suo
  `startState`: **solo lo stretto necessario** (es. capitolo 2: 50 monete, niente di più).
- `?cap=N` nell'indirizzo fa partire dal capitolo N (scorciatoia per i test).
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
Completati: capitolo 1 (San Scarabocchio), 2 (Il Parallelepipedo), 3 (Il Banco dei Pegni, Quadropoli).
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
sospendere l'AudioContext così usa il tempo di gioco.
