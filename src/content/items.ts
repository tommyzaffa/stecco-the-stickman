export type ItemId =
  | 'pacco' | 'righello' | 'libro' | 'tappo' | 'sottobicchiere' | 'calzino' | 'chiave'
  | 'gomma' | 'guanti' | 'fiore' | 'poesia' | 'sospiri'
  | 'pistola' | 'profumo' | 'ombra' | 'scusa' | 'tappoVero'
  | 'lettere' | 'torta' | 'freccetta'
  | 'album' | 'briciola';

export const ITEMS: Record<ItemId, { name: string; desc: string; weapon?: boolean }> = {
  pacco: {
    name: 'Pacco misterioso',
    desc: 'Sigillato con scotch disegnato. Non si riapre più. Da consegnare al Dottor Soldini.',
  },
  righello: {
    name: 'Righello da 30 cm',
    desc: 'Era del marito di Nonna Pina. Lo usava per misurare la sua pazienza. Mai oltre i 30 cm.',
    weapon: true,
  },
  libro: {
    name: '"Essere o non essere (disegnati)"',
    desc: 'Un libro del Filosofo. Tutte le pagine sono bianche. Come le nostre facce.',
  },
  tappo: {
    name: 'Il tappo di Don Fluo',
    desc: 'Marco giura che è quello giusto. Marco giura su molte cose.',
  },
  sottobicchiere: {
    name: 'Sottobicchiere',
    desc: 'Rotondo, piatto, un po\' appiccicoso. Per un DJ disperato è un disco.',
  },
  calzino: {
    name: 'Calzino spaiato',
    desc: 'Trovato in un bagno. Nessuno qui ha i piedi. Il mistero si infittisce.',
  },
  chiave: {
    name: 'Chiave di servizio',
    desc: 'Apre la porta "SOLO PERSONALE" nei bagni del Parallelepipedo.',
  },
  gomma: {
    name: 'Briciola di gomma',
    desc: 'Cancella. Anche cose che non vorresti. Maneggiare con cura.',
  },
  guanti: {
    name: 'Guanti bianchi del mimo',
    desc: 'Regalo di un mimo liberato. Non hai le mani, ma sono il pensiero che conta.',
  },
  fiore: {
    name: 'Fiore disegnato',
    desc: 'Non appassisce mai. Non profuma mai. È un compromesso.',
  },
  poesia: {
    name: "Poesia d'amore",
    desc: 'Scritta col Poeta di Quadropoli. Le rime sono discutibili. Il sentimento, anche.',
  },
  sospiri: {
    name: 'Tre sospiri',
    desc: 'In un barattolo, dal banco dei pegni. Per le occasioni romantiche.',
  },
  pistola: {
    name: 'Pistola a inchiostro',
    desc: "Dell'armeria Calamaio. Spara gocce d'inchiostro blu. Macchia tutto. Anche la coscienza.",
    weapon: true,
  },
  profumo: {
    name: "Profumo d'inchiostro",
    desc: 'Dal Mercato Nero. Sa di quaderno nuovo. Per le occasioni importanti.',
  },
  ombra: {
    name: "Un'ombra usata",
    desc: 'Tratteggiata, ancora in buono stato. Non è tua.',
  },
  tappoVero: {
    name: 'Il tappo giallo (quello vero)',
    desc: 'Il tappo di Don Fluo. Prestato da Martina: va riportato. A lei, dopo. Prima a Don Fluo.',
  },
  scusa: {
    name: '"Scusa" (parola usata)',
    desc: 'Dalla bancarella delle parole usate. Praticamente nuova: nessuno la usa mai. Potrebbe servire.',
  },
  lettere: {
    name: 'La posta della discesa',
    desc: 'Dieci lettere per otto cassette blu. Si lanciano dal finestrino, guardando la cassetta.',
  },
  torta: {
    name: 'Torta quadrata (tre piani)',
    desc: 'Della Pasticceria Squadrata, per Nonna Pina. Ogni botta forte, un piano in meno.',
  },
  album: {
    name: "L'album di Nonna Pina",
    desc: "Caduto dall'armadio. Foto di Nonna Pina da giovane: disegnata con la matita appena temperata.",
  },
  briciola: {
    name: 'Una briciola di gomma',
    desc: 'Dal Vicolo Storto. Rosa. Profuma di fragola. Chi cancella lascia sempre qualcosa.',
  },
  freccetta: {
    name: 'Una freccetta di Barnie',
    desc: 'Disegnata benissimo: la punta è davvero appuntita. Da Dario si gioca a freccette.',
  },
};
