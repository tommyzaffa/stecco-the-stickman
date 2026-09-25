export type ItemId = 'pacco' | 'righello' | 'libro';

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
};
