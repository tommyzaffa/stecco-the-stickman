import { npcHead, type QuestDef } from '../../game/quests';
import type { ClueDef } from '../../game/game';

export const CLUES_NEEDED = 3;

// Gli indizi del furto. Quelli con "decisive" inchiodano il colpevole (Gustavo, il commesso).
export const CLUES: Record<string, ClueDef & { decisive?: boolean }> = {
  vetri: {
    name: 'Cocci fuori dalla vetrina',
    desc: 'I pezzi di vetro sono sul marciapiede, fuori. La vetrina è stata rotta da dentro.',
    decisive: true,
  },
  serratura: {
    name: 'Serratura intatta',
    desc: 'Nessun graffio, nessun segno di scasso. Chi è entrato aveva la chiave.',
    decisive: true,
  },
  biglietto: {
    name: "Ricevuta dell'asta",
    desc: '"Mercato Nero, asta di mezzanotte. Lotto 7: tappo giallo. Venditore: G." Era nel bidone sul retro.',
    decisive: true,
  },
  balcone: {
    name: 'Il testimone del balcone',
    desc: 'Alle tre qualcuno è uscito dal retro del banco chiudendo a chiave. Fischiettava. Cappellino girato al contrario.',
    decisive: true,
  },
  luce: {
    name: 'La luce accesa',
    desc: 'Alle tre la luce del banco era accesa. Un ladro vero non accende la luce: chi era dentro si sentiva a casa.',
    decisive: true,
  },
  vicino: {
    name: 'Gustavo non era a casa',
    desc: 'Il vicino insonne di Gustavo giura che stanotte alle tre Gustavo non era in casa.',
    decisive: true,
  },
  impronte: {
    name: 'Impronte appiccicose',
    desc: 'Impronte di colla sulla vetrina del banco. Qualcuno con le dita appiccicose.',
  },
  colla: {
    name: 'La colla della Signora Colla',
    desc: 'La Signora Colla pulisce le vetrine dei vicini con la colla. Le impronte sono sue.',
  },
  alibi: {
    name: "L'alibi di Temperino",
    desc: 'Stanotte Temperino ha vinto il Campionato di Pisolini. Ha dormito sotto gli occhi di tutti.',
  },
};

export const QUESTS: Record<string, QuestDef> = {
  c3: {
    title: 'Il Banco dei Pegni',
    main: true,
    steps: [
      { text: 'Raggiungi il banco dei pegni, sulla piazza', target: (g) => g.world.anchors.shopDoor },
      { text: "Parla con l'Ispettore Penna", target: npcHead('penna') },
      { text: (g) => `Indaga: trova almeno ${CLUES_NEEDED} indizi (${g.cluesFound.length}/${CLUES_NEEDED})` },
      { text: (g) => `Accusa il colpevole davanti all'Ispettore (indizi: ${g.cluesFound.length})`, target: npcHead('penna') },
      { text: 'Parla con Marco', target: npcHead('marco') },
    ],
  },
  mimo: {
    title: 'Il muro del mimo',
    steps: [
      { text: 'Procurati una briciola di gomma (Cartoleria Colla)' },
      { text: 'Libera il mimo, al bordo del foglio', target: npcHead('mimo') },
    ],
  },
  turista: {
    title: 'Il turista di Foglio Protocollo',
    steps: [{ text: "Accompagna il turista al Monumento all'Angolo Retto", target: (g) => g.world.anchors.monument }],
  },
  poeta: {
    title: 'Rime a quadretti',
    steps: [{ text: 'Aiuta il Poeta a finire la sua poesia', target: npcHead('poeta') }],
  },
};
