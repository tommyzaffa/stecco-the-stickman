import * as THREE from 'three';
import { npcHead, type QuestDef } from '../../game/quests';
import { REFS } from './world';

export const QUESTS: Record<string, QuestDef> = {
  c6: {
    title: 'Consegna a domicilio',
    main: true,
    steps: [
      { text: 'Parla con Luca: è dietro la sua macchina, in fondo alla piazza', target: npcHead('luca') },
      { text: 'Sali in macchina: guidi tu', target: () => REFS.car?.root.position.clone().setY(2.4) ?? null },
      { text: 'Scendi fino a San Scarabocchio: i Pastelli sono dietro' },
      { text: 'Consegna il tappo a Don Fluo' },
      { text: 'Vai alla panchina di Arturo, nel parco', target: () => REFS.bench.clone().add(new THREE.Vector3(0, 1.6, 0)) },
    ],
  },
  posta: {
    title: 'La posta della discesa',
    steps: [{ text: 'Lancia la posta nelle cassette blu lungo la strada' }],
  },
  tappi: {
    title: 'Tappi per Martina',
    steps: [{ text: 'Raccogli i tappi per strada (passaci sopra con la macchina)' }],
  },
  barnie: {
    title: 'Il gigante col pollice alzato',
    steps: [{ text: 'Porta Barnie al pub di Dario (fermati lì davanti, a destra)' }],
  },
  torta: {
    title: 'La torta di Nonna Pina',
    steps: [
      { text: 'Porta la torta a San Scarabocchio senza sbattere' },
      { text: 'Consegna la torta a Nonna Pina, nel parco', target: npcHead('pina') },
    ],
  },
};
