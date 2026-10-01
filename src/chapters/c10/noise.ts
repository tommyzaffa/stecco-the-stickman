import * as THREE from 'three';
import type { Game } from '../../game/game';
import { H, PROPS, REFS10, levelOf, onStairs, surfaceAt, type Surface } from './world';

// ---------------------------------------------------------------------------
// IL RUMORE (capitolo 10). Ogni passo fa rumore: quanto dipende da cosa c'è sotto (marmo, legno,
// parquet nuovo, le assi segnate che scricchiolano, tappeti e cartone che non fanno niente; sulle
// scale i gradini scricchiolano al centro, vicino al muro poco) e da come cammini (di corsa tanto,
// accovacciato pochissimo; con le pantofole meno, col pacco in braccio di più). Anche saltare,
// urtare un secchio, pestare una paperella.
// Il rumore arriva ai vicini che dormono: tanto più quanto sei vicino alla loro porta, molto meno da
// un altro piano. Ognuno ha una "sveglia" (0..1) che sale col rumore e scende piano da sola: a 1 si
// sveglia, ed è finita (si riprova dall'ultimo pianerottolo).
// ---------------------------------------------------------------------------

export interface Sleeper {
  id: string;
  name: string;
  level: number;
  x: number;
  z: number;
  sens: number; // quanto ha il sonno leggero
  door: number; // quanto la porta attutisce (1 = niente porta)
  alert: number;
  floor: number; // sotto questo non scende (es. il neonato col rubinetto che gocciola)
  decay: number;
}

const SURF: Record<Surface, number> = { tiles: 0.45, wood: 0.5, parquet: 0.85, creak: 2.4, soft: 0.06 };

export const N10 = {
  sleepers: [] as Sleeper[],
  loud: 0, // il rumore più forte appena fatto (per la barra: scende da solo)
  armed: new Set<string>(), // oggetti che possono ancora fare rumore (si riarmano quando ti allontani)
  pantofole: false,
  pacco: false,
  over: false, // qualcuno si è svegliato
  onWake: null as ((s: Sleeper) => void) | null,
};

export function setupNoise() {
  N10.sleepers = [
    { id: 'portinaia', name: 'La portinaia', level: 0, x: 3.4, z: 11.6, sens: 0.9, door: 0.8, alert: 0, floor: 0, decay: 0.05 },
    { id: 'cane', name: 'Biscotto (il cane)', level: 1, x: 12.5, z: 8.3, sens: 1.3, door: 1, alert: 0, floor: 0, decay: 0.05 },
    { id: 'chiodo', name: 'Il signor Chiodo', level: 2, x: 20, z: 9.4, sens: 1.0, door: 0.65, alert: 0, floor: 0, decay: 0.05 },
    { id: 'neonato', name: 'Il neonato (int. 13)', level: 3, x: 12, z: 9.4, sens: 1.5, door: 0.65, alert: 0.25, floor: 0.25, decay: 0.04 },
  ];
  N10.loud = 0;
  N10.armed = new Set(PROPS.map((p) => p.id));
  N10.over = false;
}

export const sleeper = (id: string) => N10.sleepers.find((s) => s.id === id)!;

// un rumore (forza n) nel punto pos: arriva a tutti, attutito da distanza, porte e piani
export function emit(n: number, pos: THREE.Vector3) {
  const lv = levelOf(pos.y);
  for (const s of N10.sleepers) {
    const d = Math.hypot(pos.x - s.x, pos.z - s.z);
    const fall = 1 / (1 + Math.pow(d / 4, 2.4)); // da vicino si sente tutto, da lontano quasi niente
    const lf = Math.pow(0.22, Math.abs(lv - s.level));
    s.alert += n * s.sens * fall * lf * s.door * 0.18;
  }
  N10.loud = Math.max(N10.loud, n);
}

// la parola che salta fuori (davanti a te, in basso: i piedi non si vedono)
function word(g: Game, text: string) {
  const p = g.player;
  const f = p.forward;
  const v = new THREE.Vector3(p.eye.x + f.x * 1.6, p.eye.y - 0.55, p.eye.z + f.z * 1.6);
  g.hud.popWord(v, p.camera, text);
}

// un passo: rumore secondo il pavimento e l'andatura; restituisce il volume del suono del passo
export function stepNoise(g: Game, running: boolean, crouching: boolean) {
  const p = g.player;
  const x = p.pos.x, z = p.pos.z;
  const lv = levelOf(p.pos.y);
  const st = onStairs(x, z);
  let s: Surface | 'stairs';
  let base: number;
  if (st) {
    s = 'stairs';
    base = st.edge ? 0.22 : 0.6;
  } else if (x < 0 || x > 24) {
    s = 'tiles';
    base = SURF.tiles;
  } else {
    s = surfaceAt(x, z, lv);
    base = SURF[s];
  }
  const gait = running ? 2.2 : crouching ? 0.35 : 1;
  const n = base * gait * (N10.pantofole ? 0.6 : 1) * (N10.pacco ? 1.3 : 1);
  emit(n, p.pos);
  if (s === 'creak') {
    g.audio.floorCreak(Math.min(1.4, 0.4 + n / 2));
    if (n > 0.5) word(g, crouching ? 'cric' : 'CRIIC!');
  } else if (s === 'stairs' && !st!.edge && n > 0.4) {
    g.audio.floorCreak(0.35);
  } else if (running && n > 0.7) word(g, 'TUM');
  return Math.max(0.12, Math.min(2.2, n / 0.5));
}

// atterrare da un salto: rumoroso (anche sul tappeto)
export function landNoise(g: Game) {
  const p = g.player;
  const lv = levelOf(p.pos.y);
  const s = p.pos.x < 0 || p.pos.x > 24 ? 'tiles' : surfaceAt(p.pos.x, p.pos.z, lv);
  emit(s === 'soft' ? 1.2 : 3, p.pos);
  word(g, 'BUM!');
}

const mood = (a: number) => (a < 0.3 ? 'dorme' : a < 0.55 ? 'si gira nel letto' : a < 0.8 ? 'ha sentito qualcosa' : 'si sta svegliando!');

export function updateNoise(g: Game, dt: number) {
  const p = g.player;
  const lv = levelOf(p.pos.y);
  N10.loud = Math.max(0, N10.loud - dt * 1.5);
  // gli oggetti per terra: urtati o pestati fanno rumore (una volta, finché non ti allontani)
  for (const pr of PROPS) {
    const d = Math.hypot(p.pos.x - pr.x, p.pos.z - pr.z);
    const here = lv === pr.level && d < pr.r;
    if (here && N10.armed.has(pr.id)) {
      N10.armed.delete(pr.id);
      emit(pr.noise * (p.crouching ? 0.6 : 1), p.pos);
      word(g, pr.word);
      if (pr.sound === 'clang') g.audio.clang(1.3);
      else g.audio.squeak();
      const o = REFS10.props[pr.id];
      if (o) {
        // il secchio si sposta, la paperella si schiaccia (poi torna)
        if (pr.sound === 'clang') o.rotation.z = 0.25;
        else {
          o.scale.y = 0.5;
          g.after(0.4, () => (o.scale.y = 1));
        }
      }
    } else if (!here && d > pr.r + 0.6 && !N10.armed.has(pr.id)) N10.armed.add(pr.id);
  }
  // il cane ti sente anche arrivare (l'odore): da vicino, se non sei accovacciato
  const dog = sleeper('cane');
  if (lv === 1 && !N10.over) {
    const d = Math.hypot(p.pos.x - dog.x, p.pos.z - dog.z);
    if (d < 2.1) dog.alert += dt * (p.crouching ? 0.035 : 0.22) * (N10.pacco ? 1.4 : 1);
  }
  // si riaddormentano piano
  for (const s of N10.sleepers) {
    s.alert = Math.max(s.floor, s.alert - s.decay * dt);
    if (s.alert >= 1 && !N10.over) {
      N10.over = true;
      N10.onWake?.(s);
    }
  }
  // i fumetti sopra le porte (solo al tuo piano): zzz, poi peggio
  for (const s of N10.sleepers) {
    if (s.level !== lv || N10.over) continue;
    const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
    if (d > 16) continue;
    const top = s.id === 'cane' ? 0.9 : s.id === 'portinaia' ? 2.0 : 2.45;
    const zz = s.id === 'cane' ? s.z : s.id === 'portinaia' ? s.z : s.z - 0.6;
    const t = s.alert < 0.3 ? 'z z z' : s.alert < 0.55 ? 'z z... mmh' : s.alert < 0.8 ? (s.id === 'cane' ? 'grrr...' : s.id === 'neonato' ? 'uè...' : 'mmh?!') : s.id === 'cane' ? 'GRRR!' : 'CHI È?!';
    g.worldBubble(new THREE.Vector3(s.x, s.level * H + top, zz), t);
  }
  // la barra in alto: il vicino più sveglio del tuo piano (o di quelli accanto)
  let worst: Sleeper | null = null;
  for (const s of N10.sleepers) {
    if (Math.abs(s.level - lv) > 1) continue;
    const near = s.level === lv ? 1 : 0.6;
    if (!worst || s.alert * near > worst.alert * (worst.level === lv ? 1 : 0.6)) worst = s;
  }
  if (worst && !N10.over) {
    const a = worst.alert;
    g.hud.meter({ label: `${worst.name}: ${mood(a)}`, value: a, color: a < 0.55 ? '#3f63b5' : a < 0.8 ? '#c98a1a' : '#d23c3c' });
  } else g.hud.meter(null);
}

// si riprova: tutti di nuovo a dormire
export function calmAll() {
  for (const s of N10.sleepers) s.alert = s.floor;
  N10.loud = 0;
  N10.over = false;
  N10.armed = new Set(PROPS.map((p) => p.id));
  for (const id of Object.keys(REFS10.props)) {
    const o = REFS10.props[id];
    o.rotation.z = 0;
    o.scale.y = 1;
  }
}
