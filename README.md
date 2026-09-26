# Stilizzato

Un videogioco in prima persona dove tutto è disegnato a matita: gli abitanti sono omini
stilizzati, gli edifici sono linee d'inchiostro su un foglio di carta, e l'unica cosa colorata
in città è la gang degli Evidenziatori.

Tono ironico e satirico: dialoghi assurdi, missioni secondarie in ogni capitolo, e molta
meta-ironia sul fatto di essere disegnati (niente mani, niente tasche, niente colori).

## Caratteristiche tecniche

- **Three.js + TypeScript + Vite**, nessun asset esterno: grafica, texture, animazioni, effetti
  sonori e musica sono tutti generati via codice.
- Rendering "a matita": linee spesse con sbordature e tremolio, tratteggio procedurale sulle facce
  in ombra, post-processing con grana della carta e *line boil* a 8 fps.
- Omini con scheletro e animazioni procedurali (camminata, corsa, pose, reazioni ai colpi).
- Sistema di dialoghi a nodi con scelte, missioni a passi, inventario, esperienza e livelli.
- Risse con parata e contrattacchi, guardie con campo visivo e linea di vista, minigioco di ballo.
- Un capitolo = un luogo e una meccanica diversi: San Scarabocchio di giorno (inchiostro), il club
  di notte (gesso, furtività e risse), Quadropoli a quadretti (indagine con indizi e accusa),
  il Mercato Nero su carta da pacchi (tiro a segno e sparatoria a ondate con coperture).
- Audio sintetizzato con Web Audio: voci "a bip" diverse per ogni personaggio, suoni ambientali
  spaziali, musica procedurale.

## Gioca

**https://tommyzaffa.github.io/stilizzato/** (si aggiorna da solo a ogni push su `main`).

Funziona anche da telefono, in orizzontale: joystick a sinistra, trascina a destra per guardarti
intorno, tocca lo schermo per colpire (dove punta il mirino), pulsanti trasparenti per saltare,
parare, abbassarti, usare. Col blocco rotazione attivo il
gioco si gira da solo (e le barre del browser finiscono di lato); aggiunto alla schermata Home si
apre a tutto schermo. Su iPhone in Safari si gioca col blocco rotazione attivo (il gioco lo chiede).

## Avvio in locale

```bash
npm install
npm run dev
```

Poi apri http://localhost:5317.

## Comandi

I tasti si possono cambiare da **Impostazioni** nel menu principale.

| Tasto | Azione |
|---|---|
| WASD | muoversi |
| Mouse | guardarsi intorno |
| Shift | correre |
| Spazio | saltare |
| E | parlare / interagire |
| Click | colpire / sparare |
| Tasto destro | parare |
| C | accovacciarsi |
| R | ricaricare |
| Q | diario |
| 1 / 2 / 3 | cambiare arma |
| M | musica on/off |

## Stato

Capitoli 1, 2, 3 e 4 completi. Il piano dei capitoli è in [docs/CAPITOLI.md](docs/CAPITOLI.md).

Dal menu principale, "Seleziona capitolo" permette di ripartire da un capitolo sbloccato
(o sbloccarlo con la password mostrata a fine del capitolo precedente).
