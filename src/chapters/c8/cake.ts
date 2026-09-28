import * as THREE from 'three';
import type { Game } from '../../game/game';
import { Sketch } from '../../render/sketch';
import { CAKE, REFS8 } from './world';
import { BOOTH, finishBooth, fireName, type Booth } from './booth';

// ---------------------------------------------------------------------------
// LA TORTA A PIANI (gara di torte, per Nonna Pina): il piano nuovo scorre avanti e indietro
// sopra la torta, una volta di lato e una volta davanti. Un colpo = lo appoggi. Quello che
// sporge si taglia e cade (Nonna Pina lo raccoglie: "non si butta niente"). Se lo appoggi
// preciso, resta intero. Se lo manchi del tutto, la torta è finita. Vince la più alta.
// ---------------------------------------------------------------------------

const LH = 0.13; // altezza di un piano
const BASE = 0.62;
const RANGE = 0.8; // quanto scorre il piano, da una parte e dall'altra
const MAX = 20;
const TABLE_Y = CAKE.y - 0.03;

interface Layer {
  m: THREE.Group;
  cx: number;
  cz: number;
  sx: number;
  sz: number;
  y: number;
}
interface Chunk {
  m: THREE.Group;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  t: number;
  rest: boolean;
}

const S = {
  layers: [] as Layer[],
  cur: null as Layer | null,
  axis: 'x' as 'x' | 'z',
  off: 0,
  dir: 1,
  chunks: [] as Chunk[],
  endT: -1,
  done: false,
  perfect: 0,
  best: 0,
  cherry: null as THREE.Object3D | null,
  msg: '',
};

function disposeGroup(m: THREE.Object3D) {
  m.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
}

// un piano di torta: pan di spagna tratteggiato, con la panna ondulata tutto intorno
function layerModel(sx: number, sz: number, k: number) {
  const s = new Sketch();
  s.style = { jitter: 0.004, over: 0.02 };
  s.box(0, 0, 0, sx, LH, sz);
  const y = LH * 0.55;
  const wave = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(3, Math.round(len / 0.05));
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([ax + (bx - ax) * t, y + Math.sin(t * n * Math.PI) * 0.018, az + (bz - az) * t]);
    }
    s.curve(pts);
  };
  const hx = sx / 2 + 0.002, hz = sz / 2 + 0.002;
  wave(-hx, hz, hx, hz);
  wave(hx, hz, hx, -hz);
  wave(hx, -hz, -hx, -hz);
  wave(-hx, -hz, -hx, hz);
  // un piano sì e uno no: codette sopra
  if (k % 2 === 1) {
    for (let i = 0; i < Math.max(2, Math.round(sx * sz * 30)); i++) {
      const px = (((i * 0.618) % 1) - 0.5) * sx * 0.8, pz = (((i * 0.382 + 0.3) % 1) - 0.5) * sz * 0.8;
      s.seg(px, LH + 0.002, pz, px + 0.02, LH + 0.002, pz + 0.012, { over: 0 });
    }
  }
  const g = new THREE.Group();
  g.add(s.build(REFS8.thin!, REFS8.fill!));
  return g;
}

function addLayer(g: Game, cx: number, cz: number, sx: number, sz: number, y: number) {
  const m = layerModel(sx, sz, S.layers.length);
  m.position.set(cx, y, cz);
  g.world.group.add(m);
  return { m, cx, cz, sx, sz, y };
}

// nuovo capitolo: niente torte vecchie
export function setupCake() {
  S.layers = [];
  S.cur = null;
  S.chunks = [];
  S.cherry = null;
  S.best = 0;
}

function clearAll(g: Game) {
  for (const l of S.layers) {
    g.world.group.remove(l.m);
    disposeGroup(l.m);
  }
  if (S.cur) {
    g.world.group.remove(S.cur.m);
    disposeGroup(S.cur.m);
  }
  for (const c of S.chunks) {
    g.world.group.remove(c.m);
    disposeGroup(c.m);
  }
  if (S.cherry) g.world.group.remove(S.cherry);
  S.layers = [];
  S.cur = null;
  S.chunks = [];
  S.cherry = null;
}

const top = () => S.layers[S.layers.length - 1];
export const cakeHeight = () => Math.max(0, S.layers.length - 1);
export const cakeBest = () => S.best;

function speed() {
  return Math.min(1.7, 0.7 + 0.055 * (S.layers.length - 1));
}

// il prossimo piano parte da un lato (alternando: di fianco, poi davanti)
function nextLayer(g: Game) {
  const t = top();
  S.axis = S.layers.length % 2 ? 'x' : 'z';
  S.off = -RANGE;
  S.dir = 1;
  S.cur = addLayer(g, t.cx, t.cz, t.sx, t.sz, t.y + LH);
  place();
}

function place() {
  const c = S.cur!, t = top();
  c.cx = t.cx + (S.axis === 'x' ? S.off : 0);
  c.cz = t.cz + (S.axis === 'z' ? S.off : 0);
  c.m.position.set(c.cx, c.y, c.cz);
}

// un pezzo che cade: prende la forma del taglio
function drop(g: Game, cx: number, cz: number, sx: number, sz: number, y: number, dirX: number, dirZ: number) {
  const m = layerModel(sx, sz, 0);
  m.position.set(cx, y, cz);
  g.world.group.add(m);
  S.chunks.push({ m, v: new THREE.Vector3(dirX * 0.7, 0.4, dirZ * 0.7), spin: new THREE.Vector3(dirZ * 4, 0, -dirX * 4), t: 0, rest: false });
}

function finish(g: Game, why: string) {
  if (S.done) return;
  S.done = true;
  const n = cakeHeight();
  S.best = Math.max(S.best, n);
  // la ciliegina
  const t = top();
  const ch = new THREE.Group();
  const s = new Sketch();
  s.style = { jitter: 0.002, over: 0 };
  s.seg(0, 0.05, 0, 0.03, 0.12, 0.01, { over: 0 });
  ch.add(s.build(REFS8.lm!, REFS8.fill!));
  ch.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#d6333a' })));
  ch.position.set(t.cx, t.y + LH + 0.045, t.cz);
  g.world.group.add(ch);
  S.cherry = ch;
  const tokens = n >= 12 ? 3 : n >= 8 ? 2 : n >= 4 ? 1 : 0;
  finishBooth(g, `${why}<br><b>${n}</b> piani${n >= 10 ? ' · <b>la più alta della sagra!</b>' : ''}`, tokens);
}

export const CAKE_BOOTH: Booth = {
  id: 'cake',
  title: 'LA TORTA A PIANI',
  fire: 'METTI',
  help: () => `<b>${fireName(CAKE_BOOTH)}</b> quando il piano è sopra la torta: quello che sporge si taglia`,
  spot: CAKE.spot,
  look: new THREE.Vector3(CAKE.x, CAKE.y + 0.2, CAKE.z),
  fixed: true,
  start(g) {
    clearAll(g);
    S.done = false;
    S.endT = -1;
    S.perfect = 0;
    S.msg = '';
    S.layers.push(addLayer(g, CAKE.x, CAKE.z, BASE, BASE, CAKE.y + 0.005));
    nextLayer(g);
  },
  update(g, dt, click) {
    // piano che scorre
    if (S.cur && !S.done) {
      S.off += S.dir * speed() * dt;
      if (S.off > RANGE) {
        S.off = RANGE;
        S.dir = -1;
      } else if (S.off < -RANGE) {
        S.off = -RANGE;
        S.dir = 1;
      }
      place();
      if (click) {
        const c = S.cur, t = top();
        const size = S.axis === 'x' ? t.sx : t.sz;
        const off = S.off;
        g.world.group.remove(c.m);
        disposeGroup(c.m);
        S.cur = null;
        if (Math.abs(off) < 0.02) {
          // preciso: resta intero
          S.perfect++;
          S.layers.push(addLayer(g, t.cx, t.cz, t.sx, t.sz, c.y));
          g.audio.plop(1);
          g.audio.ding(S.perfect > 1);
          g.hud.popWord(new THREE.Vector3(t.cx, c.y + 0.25, t.cz), g.player.camera, S.perfect > 1 ? `PERFETTO x${S.perfect}` : 'PERFETTO!');
        } else if (size - Math.abs(off) <= 0.03) {
          // mancato: cade tutto
          drop(g, c.cx, c.cz, c.sx, c.sz, c.y, S.axis === 'x' ? Math.sign(off) : 0, S.axis === 'z' ? Math.sign(off) : 0);
          g.audio.bump(0.6);
          finish(g, 'Il piano è caduto. La torta finisce qui.');
          return;
        } else {
          S.perfect = 0;
          const keep = size - Math.abs(off);
          const sg = Math.sign(off);
          const t2 = S.axis === 'x' ? { cx: t.cx + off / 2, cz: t.cz, sx: keep, sz: t.sz } : { cx: t.cx, cz: t.cz + off / 2, sx: t.sx, sz: keep };
          S.layers.push(addLayer(g, t2.cx, t2.cz, t2.sx, t2.sz, c.y));
          // il pezzo che sporgeva
          if (S.axis === 'x') drop(g, t.cx + sg * (size / 2 + Math.abs(off) / 2), t.cz, Math.abs(off), t.sz, c.y, sg, 0);
          else drop(g, t.cx, t.cz + sg * (size / 2 + Math.abs(off) / 2), t.sx, Math.abs(off), c.y, 0, sg);
          g.audio.plop(0.6);
        }
        const n = cakeHeight();
        if (n === 5) g.npc('pina').say('Cinque piani! Come la mia prima torta. Poi è caduta.', 3);
        else if (n === 10) g.npc('pina').say('DIECI! La maestra Crostata è diventata bianca! Cioè, è sempre bianca. Ma di più!', 4);
        if (n >= MAX) finish(g, 'La torta tocca il tendone!');
        else nextLayer(g);
      }
    }
    // pezzi che cadono: sul tavolo (e lì restano un attimo) o per terra
    for (const ch of S.chunks) {
      ch.t += dt;
      if (!ch.rest) {
        ch.v.y -= 9.8 * dt;
        ch.m.position.addScaledVector(ch.v, dt);
        ch.m.rotation.x += ch.spin.x * dt;
        ch.m.rotation.z += ch.spin.z * dt;
        const p = ch.m.position;
        const onTable = Math.abs(p.x - CAKE.x) < 0.55 && p.z > CAKE.z - 1.3 && p.z < CAKE.z + 2.1;
        const floor = onTable ? TABLE_Y : 0;
        if (p.y < floor && ch.v.y < 0) {
          p.y = floor;
          ch.rest = true;
          ch.m.rotation.set(0, ch.m.rotation.y, 0);
          g.audio.plop(0.3);
        }
      }
      // dopo un po' spariscono (Nonna Pina li raccoglie)
      if (ch.t > 2.2) ch.m.scale.setScalar(Math.max(0.001, 1 - (ch.t - 2.2) * 2));
    }
    S.chunks = S.chunks.filter((ch) => {
      if (ch.t < 2.8) return true;
      g.world.group.remove(ch.m);
      disposeGroup(ch.m);
      return false;
    });
    // la visuale segue la cima della torta
    const t = top();
    if (t) BOOTH.lookAt.set(CAKE.x, t.y + 0.1, CAKE.z);
  },
  status: () => `piani: <b>${cakeHeight()}</b>${S.best ? ` · record: ${S.best}` : ''}${S.perfect > 1 ? ` · perfetti di fila: ${S.perfect}` : ''}`,
  stop() {
    if (S.cur) {
      S.cur.m.removeFromParent();
      disposeGroup(S.cur.m);
    }
    S.cur = null;
  },
};
