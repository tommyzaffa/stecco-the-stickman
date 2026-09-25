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
- Audio sintetizzato con Web Audio: voci "a bip" diverse per ogni personaggio, suoni ambientali
  spaziali, musica procedurale.

## Avvio

```bash
npm install
npm run dev
```

Poi apri http://localhost:5317.

## Comandi

| Tasto | Azione |
|---|---|
| WASD | muoversi |
| Mouse | guardarsi intorno |
| Shift | correre |
| Spazio | saltare |
| E | parlare / interagire |
| Click | pugno |
| Q | diario |
| 1 / 2 | cambiare arma |
| M | musica on/off |

## Stato

Capitolo 1 completo. Il piano dei capitoli è in [docs/CAPITOLI.md](docs/CAPITOLI.md).
