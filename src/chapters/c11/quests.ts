import * as THREE from 'three';
import type { Game } from '../../game/game';
import type { QuestDef } from '../../game/quests';
import { OFF, hhmm, winSpot, type WinId } from './office';

// stato del capitolo (sparisce con il capitolo: quello che conta dopo va nei flag)
export const Q11 = {
  started: false, // l'orologio è partito (dopo l'usciere)
  over: false, // le 12:00: game over
  fine: false,
  caught: 0, // volte che ti hanno cacciato da dietro il bancone
  coffeePaid: false, // moneta nella macchinetta (il caffè non è uscito)
  coffeeOut: false, // il caffè è uscito (dopo il pugno)
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TICKET = v(-3, 1.6, 8.7);

// la pratica: le cose da fare, in ordine (alcune si possono fare prima: la marca da bollo, la foto)
interface Check {
  flag: string;
  short: string;
  text: (g: Game) => string;
  target: (g: Game) => THREE.Vector3 | null;
}

const wait = (id: WinId, what: string) => (_g: Game) => {
  const mine = OFF.mine[id];
  if (!mine.length) return `${what}: prendi il numero ${id} all'eliminacode (all'ingresso)`;
  const w = OFF.wins[id];
  if (w.phase === 'call' && w.cur && mine.includes(w.cur.n)) return `${what}: hanno chiamato il tuo numero (${id} ${w.cur.n})! Vai allo sportello ${id}`;
  if (OFF.min < w.open) return `${what}: lo sportello ${id} apre alle ${hhmm(w.open)} (hai il ${id} ${Math.min(...mine)})`;
  return `${what}: aspetta il tuo numero (${id} ${Math.min(...mine)}); intanto puoi fare altro`;
};
const at = (id: WinId) => (_g: Game) => (OFF.mine[id].length ? winSpot(id) : TICKET);

export const CHECK: Check[] = [
  { flag: 'c11A', short: 'Modulo 27-A (rastrelliera)', text: () => 'Prendi il Modulo 27-A dalla rastrelliera (parete a sinistra)', target: () => v(-15.4, 1.3, 5) },
  { flag: 'c11AFill', short: 'Compilare il 27-A (tavolo)', text: () => 'Compila il 27-A al tavolo, in fondo a sinistra', target: () => v(-12, 1.3, 8.6) },
  { flag: 'c11Bollo', short: 'Marca da bollo (D: cassa)', text: wait('D', 'Compra la marca da bollo alla Cassa'), target: at('D') },
  { flag: 'c11ATimbro', short: 'Timbri sul 27-A (C: timbri)', text: wait('C', 'Fai timbrare il 27-A (con la marca) allo sportello C'), target: at('C') },
  { flag: 'c11Protocollo', short: 'Protocollo e 27-B (B)', text: wait('B', 'Porta il 27-A timbrato al Protocollo: ti danno il 27-B'), target: at('B') },
  { flag: 'c11Foto', short: 'Fototessera (in fondo a destra)', text: () => 'Fai la fototessera (in fondo a destra, due monete): serve almeno una foto buona', target: () => v(13.4, 1.4, 6.5) },
  { flag: 'c11BFill', short: 'Compilare il 27-B (tavolo)', text: () => 'Compila il 27-B al tavolo (con la foto)', target: () => v(-12, 1.3, 8.6) },
  { flag: 'c11BTimbro', short: 'Timbri sul 27-B (C)', text: wait('C', 'Fai timbrare il 27-B allo sportello C'), target: at('C') },
  { flag: 'c11Consegna', short: 'Consegna allo sportello A', text: wait('A', 'Consegna il 27-B allo sportello A (Residenze) entro le 12:00'), target: at('A') },
];

// il primo passo non ancora fatto
export const curCheck = (g: Game) => {
  const i = CHECK.findIndex((c) => !g.is(c.flag));
  return i < 0 ? CHECK.length : i;
};

export const QUESTS: Record<string, QuestDef> = {
  c11: {
    title: 'Modulo 27-B',
    main: true,
    steps: CHECK.map((c) => ({ text: (g: Game) => (Q11.started ? c.text(g) : 'Parla con l\'usciere, all\'ingresso'), target: (g: Game) => (Q11.started ? c.target(g) : v(2, 2.6, 10.6)) })),
  },
  occhiali: {
    title: 'Gli occhiali del signor Attesa',
    steps: [
      { text: 'Il signor Attesa ha perso gli occhiali andando alla fototessera: cercali per terra, in fondo a destra', target: () => v(12.9, 0.4, 8.2) },
      { text: 'Riporta gli occhiali al signor Attesa (prima fila, a sinistra)', target: () => v(-7.5, 2, -1) },
    ],
  },
  caffe: {
    title: 'Un caffè per Tampona',
    steps: [
      { text: 'Prendi un caffè alla macchinetta (parete a destra) per Tampona, prima delle 10:00', target: () => v(14.8, 1.3, 1) },
      { text: 'Porta il caffè a Tampona (sportello C): anche senza numero', target: () => winSpot('C') },
    ],
  },
  archivio: {
    title: 'La pratica riservata',
    steps: [
      { text: 'Le pratiche riservate sono in archivio, dietro lo sportello B. Si passa dal cancelletto in fondo a sinistra, quando Spillatrice è in pausa merenda (11:00-11:15). Accovacciato, nessuno ti vede.', target: () => v(-6.5, 1.2, -12.2) },
    ],
  },
};
