export type ItemId = 'pacco' | 'righello' | 'libro' | 'tappo' | 'sottobicchiere' | 'calzino' | 'chiave';

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
};
