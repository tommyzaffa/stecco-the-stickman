import { npcHead, type QuestDef } from '../../game/quests';
import type * as THREE from 'three';
import type { Game } from '../../game/game';

export const RECORD_TIME = 14; // secondi per battere la nonna al poligono

// stato della sparatoria (lo aggiorna la storia, lo legge l'obiettivo)
export const RAID = { wave: 0, waves: 3, left: 0 };

// il segnalino sparisce quando ci sei sopra (altrimenti la freccia punta ai tuoi piedi)
const nearOff = (f: (g: Game) => THREE.Vector3) => (g: Game) => {
  const t = f(g);
  return Math.hypot(t.x - g.player.pos.x, t.z - g.player.pos.z) < 2.5 ? null : t;
};

export const QUESTS: Record<string, QuestDef> = {
  c4: {
    title: 'Il Mercato Nero',
    main: true,
    steps: [
      { text: 'Entra nel Mercato Nero', target: npcHead('tornello') },
      { text: "Procurati un'arma all'Armeria Calamaio", target: npcHead('calamaio') },
      { text: 'Supera la prova al poligono', target: nearOff((g) => g.world.anchors.rangeStart) },
      { text: 'Torna dal buttafuori (ora sei armato)', target: npcHead('tornello') },
      { text: "Trova l'asta del lotto 7", target: npcHead('banditore') },
      { text: "Partecipa all'asta (quando sei pronto)", target: npcHead('banditore') },
      { text: (g: Game) => (RAID.wave ? `Resisti ai Pastelli a Cera · ondata ${RAID.wave}/${RAID.waves} · ne restano ${RAID.left}` : 'Resisti ai Pastelli a Cera') },
      { text: 'Parla con il Banditore', target: npcHead('banditore') },
      { text: 'Chiama il numero di "M." dalla cabina telefonica', target: (g) => g.world.anchors.phone },
      { text: 'Parla con Marco', target: npcHead('marco') },
    ],
  },
  record: {
    title: 'Il record della nonna',
    steps: [{ text: `Finisci il tiro a segno in meno di ${RECORD_TIME} secondi`, target: nearOff((g) => g.world.anchors.rangeStart) }],
  },
  ombra: {
    title: "L'uomo senz'ombra",
    steps: [
      { text: "Recupera l'ombra del Signor Controluce (Ombre & Riflessi)", target: npcHead('riflesso') },
      { text: "Riporta l'ombra al Signor Controluce", target: npcHead('controluce') },
    ],
  },
  colori: {
    title: 'Colori tarocchi',
    steps: [
      { text: 'Smaschera il venditore di colori', target: npcHead('tarocco') },
      { text: 'Torna dalla Signora Grigia', target: npcHead('grigia') },
    ],
  },
};
