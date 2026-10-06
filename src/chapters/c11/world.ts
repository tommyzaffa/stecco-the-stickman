import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Sketch } from '../../render/sketch';
import { HAND_FONT, MARKER_FONT } from '../../render/textures';
import { BLUE_HEX, RED_HEX, THEME } from '../../render/palette';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// Capitolo 11: l'Ufficio Protocollo di Quadropoli (carta a modulo continuo).
//
//   la sala           x -16..16, z -10..12, alta 5 m; ingresso a sud (x 0)
//   gli sportelli     a nord, dietro il bancone (z -7): A RESIDENZE (x -11), B PROTOCOLLO (x -4),
//                     C TIMBRI (x 3), D CASSA (x 10); sopra ognuno il tabellone col numero
//   l'eliminacode     vicino all'ingresso (x -3, z 9)
//   le sedie          tre file al centro (z -1, 1.6, 4.2)
//   la rastrelliera   dei moduli, parete ovest (x -15.6, z 3..7); il tavolo per compilare (x -12, z 9)
//   la fototessera    parete est (x 14.4, z 6.5); la macchinetta del caffè (x 15, z 1)
//   l'archivio        dietro la parete nord, porta dietro lo sportello B (x -4); il cancelletto per
//                     passare dietro il bancone è in fondo a ovest (x -15.5)
// ---------------------------------------------------------------------------

export const HALL = { x0: -16, x1: 16, z0: -10, z1: 12, h: 5 };
export const COUNTER_Z = -7; // il fronte del bancone
export const WINDOWS: Record<string, { x: number; name: string }> = {
  A: { x: -11, name: 'RESIDENZE' },
  B: { x: -4, name: 'PROTOCOLLO' },
  C: { x: 3, name: 'TIMBRI' },
  D: { x: 10, name: 'CASSA' },
};
const HOURS: Record<string, string> = {
  A: 'apre 10:30\nchiude 12:00',
  B: 'pausa merenda\n11:00-11:15',
  C: 'pausa caffè\n10:00-10:20',
  D: 'chiusura cassa\n11:30-11:45',
};
export const ARCHIVE = { x0: -9, x1: 0, z0: -14, z1: -10, door: -4 };
export const BOOTH_AT = { x: 14.1, z: 6.5 };
export const CHAIRS: [number, number][] = [];
for (const z of [-1, 1.6, 4.2]) for (let x = -9; x <= 9; x += 1.5) if (Math.abs(x) > 0.6) CHAIRS.push([x, z]);

export const behindCounter = (p: THREE.Vector3) => p.z < COUNTER_Z - 0.45 && p.z > HALL.z0 && p.x > HALL.x0 && p.x < HALL.x1;
export const inArchive = (p: THREE.Vector3) => p.z < HALL.z0 && p.x > ARCHIVE.x0 && p.x < ARCHIVE.x1;

export const REFS11 = {
  lm: null as LineMaterial | null,
  thin: null as LineMaterial | null,
  fill: null as THREE.Material | null,
  displays: {} as Record<string, { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; last: string }>,
  hourHand: null as THREE.Object3D | null,
  minHand: null as THREE.Object3D | null,
  occhiali: null as THREE.Group | null,
  caffe: null as THREE.Group | null,
  flash: null as THREE.Mesh | null, // il lampo della fototessera
  lens: null as THREE.Mesh | null, // l'obiettivo (si sposta un po')
};

// il tabellone sopra lo sportello: "B 37" (si ridisegna solo quando cambia)
export function setDisplay(id: string, text: string, sub = '') {
  const d = REFS11.displays[id];
  const key = text + '|' + sub;
  if (!d || d.last === key) return;
  d.last = key;
  const { ctx } = d;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = '#1d2321';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8b04a';
  ctx.font = `bold ${Math.round(h * 0.52)}px ${MARKER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * (sub ? 0.4 : 0.52));
  if (sub) {
    ctx.font = `${Math.round(h * 0.2)}px ${MARKER_FONT}`;
    ctx.fillStyle = '#f2e3b0';
    ctx.fillText(sub, w / 2, h * 0.82);
  }
  d.tex.needsUpdate = true;
}

export function buildUfficio(): World {
  const b = new WorldBuilder(1111);
  const { S, D, G, col, A, sign, wallText } = b;
  const y = 0.02;
  b.ground();
  REFS11.lm = b.lineMat(2.2);
  REFS11.thin = b.lineMat(1.4);
  REFS11.fill = b.fill;
  REFS11.displays = {};
  const { x0, x1, z0, z1, h } = HALL;

  // =========================================================================
  // LA SALA
  // =========================================================================
  b.wallDoor(x0, z0, x1, z0, ARCHIVE.door, 1.2, h, 2.3); // la porta dell'archivio, dietro lo sportello B
  b.wall(x0, z0, x0, z1, h);
  b.wall(x1, z0, x1, z1, h);
  b.wallDoor(x0, z1, x1, z1, 0, 2.2, h, 2.7);
  b.ceiling(x0, z0, x1, z1, h - 0.01);
  // la porta d'ingresso a vetri (chiusa alle spalle: si esce solo con la residenza)
  col.rect(-1.15, z1 - 0.05, 1.15, z1 + 0.25);
  D.rectV(-1.1, 0, z1 - 0.02, 1.08, 2.6, 'x').rectV(0.02, 0, z1 - 0.02, 1.08, 2.6, 'x');
  D.seg(-0.12, 1.0, z1 - 0.04, -0.12, 1.3, z1 - 0.04).seg(0.12, 1.0, z1 - 0.04, 0.12, 1.3, z1 - 0.04);
  // pavimento a piastrelle grandi
  for (let x = x0 + 1; x < x1; x += 1) G.seg(x, y, z0 + 0.1, x, y, z1 - 0.1, { over: 0 });
  for (let z = z0 + 1; z < z1; z += 1) G.seg(x0 + 0.1, y, z, x1 - 0.1, y, z, { over: 0 });
  // lampade al neon (strisce)
  for (let x = -10; x <= 10; x += 10) for (let z = -4; z <= 8; z += 6) S.box(x, h - 0.12, z, 3, 0.1, 0.4);
  sign('UFFICIO PROTOCOLLO DI QUADROPOLI\nsi prega di non avere fretta', 0, 4.25, z1 - 0.14, 6, 0.9, '-z', { font: MARKER_FONT });

  // =========================================================================
  // IL BANCONE E GLI SPORTELLI (a nord)
  // =========================================================================
  b.solid(0.6, COUNTER_Z, 30.8, 0.8, 1.1); // da x -14.8 alla parete est: in fondo a ovest si passa
  S.box(0.6, 1.1, COUNTER_Z, 31, 0.06, 1.0);
  // il cancelletto (in fondo a ovest, x -15.5): si passa, ma è "riservato"
  sign('RISERVATO AL PERSONALE', -15.4, 1.5, COUNTER_Z + 0.45, 1.1, 0.5, '+z', { font: HAND_FONT });
  S.seg(-15.9, 0, COUNTER_Z + 0.4, -15.9, 1.0, COUNTER_Z + 0.4).seg(-14.85, 0, COUNTER_Z + 0.4, -14.85, 1.0, COUNTER_Z + 0.4);
  // tra uno sportello e l'altro: vetri e pannelli (fino al soffitto)
  const glassMat = new THREE.MeshBasicMaterial({ color: '#9ec4d6', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  for (const [id, w] of Object.entries(WINDOWS)) {
    const x = w.x;
    // il vetro con la fessura in basso
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), glassMat);
    glass.position.set(x, 1.95, COUNTER_Z);
    b.group.add(glass);
    D.rectV(x - 1.3, 1.15, COUNTER_Z + 0.01, 2.6, 1.6, 'x');
    D.seg(x - 0.4, 1.32, COUNTER_Z + 0.02, x + 0.4, 1.32, COUNTER_Z + 0.02);
    // la scrivania dell'impiegato, la sedia, i timbri, le pile di carte
    S.box(x, 0, -8.6, 2.0, 0.78, 0.9);
    S.cylinder(x, 0, -7.85, 0.17, 0.78, 8); // lo sgabello alto
    for (let i = 0; i < 3; i++) S.box(x - 0.6 + i * 0.25, 0.78, -8.7, 0.21, 0.08 + i * 0.07, 0.3);
    // il tabellone col numero
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tex }));
    disp.position.set(x, 3.25, COUNTER_Z - 0.02);
    b.group.add(disp);
    S.box(x, 2.82, COUNTER_Z - 0.06, 1.62, 0.85, 0.06);
    REFS11.displays[id] = { tex, ctx, last: '' };
    setDisplay(id, `${id} --`);
    sign(`${id}  ${w.name}`, x, 4.15, COUNTER_Z - 0.02, 2.4, 0.5, '+z', { font: MARKER_FONT });
    // l'orario, attaccato al vetro
    sign(HOURS[id], x + 0.55, 2.45, COUNTER_Z + 0.03, 1.3, 0.42, '+z', { font: HAND_FONT });
  }
  for (const x of [-14.5, -7.5, -0.5, 6.5, 13.5]) {
    S.box(x, 1.16, COUNTER_Z, 0.12, h - 1.16, 0.12);
  }
  S.box(0.6, 3.95, COUNTER_Z, 31, 0.08, 0.12);
  // l'angolo del personale (in fondo a est, dietro il bancone): tavolino, bollitore, tazze
  b.solid(14.5, -9.45, 1.3, 0.7, 0.75);
  S.cylinder(14.2, 0.75, -9.45, 0.09, 0.22, 8).cylinder(14.65, 0.75, -9.4, 0.045, 0.09, 8).cylinder(14.85, 0.75, -9.55, 0.045, 0.09, 8);
  wallText('ANGOLO DEL PERSONALE\n(la pausa dura quanto dura)', 14.5, 1.75, z0 + 0.14, 2.2, 0.55, '+z');
  wallText('A apre alle 10:30, chiude alle 12:00 · C pausa caffè 10:00-10:20\nB pausa merenda 11:00-11:15 · D chiusura cassa 11:30-11:45', -11, 3.6, z0 + 0.14, 7, 0.55, '+z');

  // =========================================================================
  // L'OROLOGIO (grande, sulla parete nord): le lancette girano col tempo del capitolo
  // =========================================================================
  {
    const cx = 6.5, cy = 4.0, cz = z0 + 0.15, r = 0.75;
    const face = new THREE.Mesh(new THREE.CircleGeometry(r, 36), new THREE.MeshBasicMaterial({ color: THEME.paperHex }));
    face.position.set(cx, cy, cz);
    b.group.add(face);
    D.circle(cx, cy, cz + 0.01, r, 'z', 36);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      D.seg(cx + Math.sin(a) * r * 0.82, cy + Math.cos(a) * r * 0.82, cz + 0.01, cx + Math.sin(a) * r * 0.95, cy + Math.cos(a) * r * 0.95, cz + 0.01, { over: 0 });
    }
    const hand = (len: number, wid: number) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wid, len).translate(0, len / 2, 0), new THREE.MeshBasicMaterial({ color: THEME.inkHex }));
      g.add(m);
      g.position.set(cx, cy, cz + 0.02);
      b.group.add(g);
      return g;
    };
    REFS11.hourHand = hand(r * 0.5, 0.07);
    REFS11.minHand = hand(r * 0.78, 0.045);
  }

  // =========================================================================
  // LE SEDIE (tre file) E L'ELIMINACODE
  // =========================================================================
  for (const [x, z] of CHAIRS) {
    S.box(x, 0.45, z, 0.5, 0.06, 0.5);
    S.box(x, 0.5, z + 0.24, 0.5, 0.5, 0.05);
    S.seg(x - 0.22, 0, z - 0.22, x - 0.22, 0.45, z - 0.22).seg(x + 0.22, 0, z - 0.22, x + 0.22, 0.45, z - 0.22);
    S.seg(x - 0.22, 0, z + 0.22, x - 0.22, 0.45, z + 0.22).seg(x + 0.22, 0, z + 0.22, x + 0.22, 0.45, z + 0.22);
  }
  for (const z of [-1, 1.6, 4.2]) {
    col.rect(-9.4, z - 0.3, -0.75, z + 0.3);
    col.rect(0.75, z - 0.3, 9.4, z + 0.3);
  }
  {
    // l'eliminacode: colonnina con quattro pulsanti e il rotolo dei biglietti
    const ex = -3, ez = 9;
    b.solid(ex, ez, 0.55, 0.45, 1.25);
    S.box(ex, 1.25, ez, 0.65, 0.35, 0.5);
    const colors = [BLUE_HEX, RED_HEX, '#2f9e44', '#e8791e'];
    ['A', 'B', 'C', 'D'].forEach((l, i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), new THREE.MeshBasicMaterial({ color: colors[i] }));
      m.position.set(ex - 0.2 + i * 0.13, 1.42, ez - 0.255);
      m.rotation.y = Math.PI;
      b.group.add(m);
    });
    sign('PRENDERE IL NUMERO\n(uno per sportello)', ex, 2.05, ez - 0.27, 1.3, 0.5, '-z', { font: HAND_FONT });
    D.seg(ex - 0.1, 1.0, ez - 0.23, ex + 0.1, 1.0, ez - 0.23).seg(ex - 0.06, 1.0, ez - 0.23, ex - 0.04, 0.8, ez - 0.25);
  }

  // =========================================================================
  // LA RASTRELLIERA DEI MODULI E IL TAVOLO PER COMPILARE (lato ovest)
  // =========================================================================
  {
    const rx = x0 + 0.35;
    b.solid(rx, 5, 0.5, 4, 2.2);
    const labels = ['27-A', '27-B\n(esaurito)', '14-C', '9-Z', '101-bis', '27-A\nbis', '0', '27-C\n(non esiste)', '3-ter'];
    labels.forEach((l, i) => {
      const zz = 3.5 + (i % 3) * 1.15, yy = 0.5 + Math.floor(i / 3) * 0.6;
      D.rectV(rx + 0.26, yy, zz - 0.5, 1.0, 0.5, 'z');
      wallText(l, rx + 0.27, yy + 0.3, zz, 0.9, 0.38, '+x');
    });
    sign('MODULI\n(prendetene uno alla volta)', rx + 0.27, 2.55, 5, 1.8, 0.5, '+x', { font: HAND_FONT });
    // il tavolo per compilare, con la penna legata alla catena
    b.solid(-12, 9.2, 2.6, 0.9, 1.0);
    S.seg(-11.6, 1.0, 9.0, -11.2, 1.05, 8.95);
    D.curve([[-11.2, 1.05, 8.95], [-11.0, 0.95, 9.1], [-10.9, 1.0, 9.3], [-10.85, 1.0, 9.5]]);
    sign('COMPILARE QUI\n(in stampatello, senza mani)', -12, 1.75, 9.7, 1.8, 0.5, '-z', { font: HAND_FONT });
  }

  // =========================================================================
  // LA FOTOTESSERA E LA MACCHINETTA DEL CAFFÈ (lato est)
  // =========================================================================
  {
    const { x: bx, z: bz } = BOOTH_AT;
    // la cabina: tre pareti, la tenda, dentro lo sgabello e l'obiettivo
    S.box(bx + 0.75, 0, bz, 0.08, 2.2, 1.5);
    S.box(bx, 0, bz - 0.75, 1.5, 2.2, 0.08);
    S.box(bx, 0, bz + 0.75, 1.5, 2.2, 0.08);
    S.box(bx, 2.2, bz, 1.5, 0.1, 1.5);
    col.rect(bx - 0.75, bz - 0.8, bx + 0.8, bz - 0.7);
    col.rect(bx - 0.75, bz + 0.7, bx + 0.8, bz + 0.8);
    col.rect(bx + 0.7, bz - 0.8, bx + 0.8, bz + 0.8);
    for (let i = 0; i < 5; i++) D.curve([[bx - 0.75, 2.1, bz + 0.72 - i * 0.1], [bx - 0.78, 1.2, bz + 0.69 - i * 0.1], [bx - 0.75, 0.4, bz + 0.72 - i * 0.1]]);
    sign('FOTOTESSERA\n4 pose, 2 monete', bx - 0.8, 2.55, bz, 1.4, 0.5, '-x', { font: HAND_FONT });
    S.cylinder(bx + 0.2, 0, bz, 0.2, 0.55, 10);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: '#1d2321' }));
    lens.rotation.y = -Math.PI / 2;
    lens.position.set(bx + 0.7, 1.45, bz);
    b.group.add(lens);
    REFS11.lens = lens;
    D.circle(bx + 0.7, 1.45, bz, 0.12, 'x', 14);
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.0), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    flash.rotation.y = -Math.PI / 2;
    flash.position.set(bx + 0.69, 1.2, bz);
    b.group.add(flash);
    REFS11.flash = flash;
    // la macchinetta del caffè
    b.solid(15.3, 1, 0.7, 0.9, 1.9);
    D.rectV(14.94, 0.9, 0.7, 0.6, 0.7, 'z');
    for (let i = 0; i < 4; i++) D.rectV(14.94, 1.65, 0.65 + i * 0.16, 0.1, 0.08, 'z');
    wallText('CAFFÈ\n(1 moneta, quando vuole lei)', 14.92, 1.75, 1.35, 0.9, 0.35, '-x');
  }

  // =========================================================================
  // L'ARCHIVIO (dietro la parete nord, porta dietro lo sportello B)
  // =========================================================================
  {
    const { x0: ax0, x1: ax1, z0: az0, door } = ARCHIVE;
    b.wall(ax0, az0, ax1, az0, h);
    b.wall(ax0, az0, ax0, z0, h);
    b.wall(ax1, az0, ax1, z0, h);
    b.ceiling(ax0, az0, ax1, z0, h - 0.01);
    D.rectV(door - 0.6, 0, z0 + 0.13, 1.2, 2.3, 'x');
    sign('ARCHIVIO\nvietato l\'accesso (anche a chi ha il numero)', door, 2.7, z0 + 0.14, 2.2, 0.55, '+z', { font: HAND_FONT });
    for (let i = 0; i < 4; i++) {
      const sx = ax0 + 1 + i * 2.2;
      S.box(sx, 0, az0 + 0.5, 1.6, 2.6, 0.6);
      for (let k = 0; k < 4; k++) S.seg(sx - 0.8, 0.5 + k * 0.6, az0 + 0.82, sx + 0.8, 0.5 + k * 0.6, az0 + 0.82);
      col.rect(sx - 0.8, az0, sx + 0.8, az0 + 0.85);
    }
    b.solid(-6.5, -12.2, 1.6, 0.8, 0.8);
    // la cartella rossa
    const folder = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshBasicMaterial({ color: RED_HEX }));
    folder.rotation.x = -Math.PI / 2;
    folder.position.set(-6.5, 0.81, -12.2);
    b.group.add(folder);
  }

  // =========================================================================
  // GLI OCCHIALI DEL SIGNOR ATTESA (vicino alla fototessera) E IL CAFFÈ
  // =========================================================================
  {
    const o = new Sketch();
    o.style = { jitter: 0.002, over: 0 };
    o.circle(-0.07, 0.02, 0, 0.055, 'y', 10).circle(0.07, 0.02, 0, 0.055, 'y', 10).seg(-0.015, 0.02, 0, 0.015, 0.02, 0);
    const g = new THREE.Group();
    g.add(o.build(REFS11.thin, b.fill));
    g.position.set(12.9, y, 8.2);
    b.group.add(g);
    REFS11.occhiali = g;
    const c = new Sketch();
    c.style = { jitter: 0.002, over: 0.005 };
    c.cylinder(0, 0, 0, 0.05, 0.1, 8);
    const cg = new THREE.Group();
    cg.add(c.build(REFS11.lm, b.fill));
    cg.position.set(14.75, 0.92, 1);
    cg.visible = false;
    b.group.add(cg);
    REFS11.caffe = cg;
  }

  // =========================================================================
  // PUNTI NOTEVOLI
  // =========================================================================
  A('spawn', 0, 0, 10.5);
  A('spawnLook', 0, 2.5, 0);
  A('usciere', 2, 0, 10.6);
  A('ticket', -3, 1.3, 8.7);
  A('rack', x0 + 0.6, 1.2, 5);
  A('desk', -12, 1.0, 8.6);
  A('booth', BOOTH_AT.x, 0, BOOTH_AT.z);
  A('coffee', 14.9, 1.0, 1);
  A('archive', -6.5, 0.8, -12.2);
  A('exit', 0, 0, 11.4);
  A('gate', -15.5, 0, COUNTER_Z + 0.9);
  for (const [id, w] of Object.entries(WINDOWS)) {
    A(`win${id}`, w.x, 0, COUNTER_Z + 0.75);
    A(`clerk${id}`, w.x, 0, -8.15);
  }
  A('attesa', -7.5, 0, -1);
  A('penna', -4.6, 0, COUNTER_Z + 1.5);

  return b.finish({ isIndoor: () => true, fog: [40, 90] });
}
