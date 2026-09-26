import { npcHead, type QuestDef } from '../../game/quests';
import type { ClueDef } from '../../game/game';

export const CLUES_NEEDED = 4;

// Gli indizi del furto.
//  - insider: provano che è stato qualcuno con la chiave (ma le chiavi le hanno in due)
//  - decisive: riguardano proprio Gustavo, il commesso: servono per arrestarlo
export const CLUES: Record<string, ClueDef & { decisive?: boolean; insider?: boolean }> = {
  vetri: {
    name: 'Cocci fuori dalla vetrina',
    desc: 'I pezzi di vetro sono sul marciapiede, fuori. La vetrina è stata rotta da dentro.',
    insider: true,
  },
  serratura: {
    name: 'Serratura intatta',
    desc: 'Nessun graffio, nessun segno di scasso. Chi è entrato aveva la chiave.',
    insider: true,
  },
  balcone: {
    name: 'Il testimone del balcone',
    desc: "Alle tre qualcuno è uscito dal retro chiudendo a chiave. Fischiettava. Il lampione era spento: il testimone non ha visto chi.",
    insider: true,
  },
  luce: {
    name: 'La luce accesa',
    desc: 'Alle tre la luce del banco era accesa. Un ladro vero non accende la luce: chi era dentro si sentiva a casa.',
    insider: true,
  },
  vicino: {
    name: 'Gustavo non era a casa',
    desc: 'Il vicino di Gustavo giura che stanotte alle tre Gustavo non era in casa. Gustavo invece dice di sì.',
    decisive: true,
  },
  biglietto: {
    name: "Ricevuta dell'asta",
    desc: '"Mercato Nero, asta di mezzanotte. Lotto 7: tappo giallo. Venditore: G." In un angolo, il disegnino di una scopa. Era al macero.',
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
