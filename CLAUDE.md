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
  - `palette.ts`: colori. Il mondo è bianco/nero; rosso = obiettivo principale, blu = secondarie,
    giallo evidenziatore = gang.
- `src/world/town.ts` — la città di San Scarabocchio. Esporta `anchors` (punti nominati usati dai
  contenuti) e `colliders` (collisioni 2D su XZ).
- `src/entities/` — `Stickman` (scheletro + pose/azioni), `StickDog`, `NPC` (comportamenti:
  stand/sit/patrol/circle/follow).
- `src/game/` — `Game` (stato, API per i contenuti, ciclo di gioco), `DialogueRunner`.
- `src/content/` — **tutto il contenuto di gioco**: personaggi e dialoghi (`characters.ts`),
  oggetti e monete (`objects.ts`), missioni (`quests.ts`), oggetti inventario (`items.ts`),
  flusso della storia (`story.ts`).
- `src/ui/hud.ts` — HUD in HTML/CSS sopra il canvas (`src/style.css`).
- `src/audio/` — audio tutto sintetizzato con Web Audio (nessun file): `audio.ts` effetti, voci a
  bip dei personaggi, ambiente (vento, uccellini, fontana, sveglia); `music.ts` sequencer del
  motivetto fischiettato. Le voci per personaggio stanno in `src/content/voices.ts` (chiave = id PNG).
  L'AudioContext si sblocca solo con un click (schermata del titolo).

## Prestazioni

Il gioco è limitato a 60 fps (10 fps su titolo/pausa) in `src/main.ts` e la risoluzione interna è
limitata a ~2.4 MP in `Game.resize()`. Il post-processing è un solo passaggio (`postfx.ts`) che
scrive direttamente a schermo. Non togliere questi limiti senza misurare: su un Mac Retina a
120 Hz facevano andare la ventola al massimo.

## Obiettivo e metodo di lavoro

Progetto da portfolio (nessuno scopo di lucro), obiettivo 15-20 capitoli. Si lavora **un capitolo
alla volta, chiudendolo del tutto** (grafica, dialoghi, suoni) prima di passare al successivo.
Capitolo 1 (San Scarabocchio) = completato.

## Convenzioni per i contenuti

- Righe di dialogo: `'testo'` = parla il PNG, `'> testo'` = parla il giocatore,
  `'* testo'` = narratore, `'@Nome| testo'` = altro personaggio.
- Le ricompense vanno nel `do` dell'**ultimo** nodo del dialogo, così le notifiche arrivano alla fine.
- Stato missioni: `g.quest(id)` → -1 non iniziata, 0..n-1 passo attivo, n = completata.
- Il protagonista si chiama "Stecco". La città ha 47 abitanti, 3 dimensioni, 0 colori.
- Umorismo: meta-ironia sull'essere disegnati (niente mani, niente tasche, niente colori),
  burocrazia, vita di paese.

## Test nel browser integrato

Quando il pannello è nascosto `requestAnimationFrame` non gira: per testare da script chiamare
`game.update(1/60)` a mano. `window.game` è esposto per il debug.
