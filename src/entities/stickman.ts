import * as THREE from 'three';
import { THEME } from '../render/palette';
import { headTexture, shadowTexture } from '../render/textures';

// ---------------------------------------------------------------------------
// Omino stilizzato con scheletro procedurale: niente file di animazione,
// ogni posa è calcolata con qualche seno e coseno.
// ---------------------------------------------------------------------------

export type Hat = 'none' | 'cap' | 'top' | 'beanie' | 'bun' | 'police' | 'party' | 'beret' | 'hair';
export type Action =
  | 'none' | 'wave' | 'talk' | 'push' | 'phone' | 'paint' | 'speech' | 'cane' | 'crossed' | 'think'
  | 'dance' | 'drink' | 'guard' | 'windup' | 'strike' | 'dj';

export interface StickmanOpts {
  hat?: Hat;
  highlighter?: string; // colore evidenziatore (gang)
  mustache?: boolean;
  beard?: boolean;
  sunglasses?: boolean;
  tie?: boolean;
  scale?: number;
  eyes?: boolean;
}

const LIMB_DOWN = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, -0.5, 0);
const LIMB_UP = new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0);
const JOINT = new THREE.SphereGeometry(1, 8, 6);
// Materiali e texture dipendono dal tema (giorno: inchiostro, notte: gesso).
interface Themed { ink: THREE.MeshBasicMaterial; head: THREE.Texture; shadow: THREE.Texture; colored: Map<string, THREE.Texture> }
const themes = new Map<string, Themed>();
function themed(): Themed {
  const key = THEME.inkHex + THEME.paperHex;
  let t = themes.get(key);
  if (!t) {
    t = { ink: new THREE.MeshBasicMaterial({ color: THEME.inkHex }), head: headTexture(), shadow: shadowTexture(), colored: new Map() };
    themes.set(key, t);
  }
  return t;
}
let inkMat: THREE.MeshBasicMaterial;

const R = 0.027; // spessore del "tratto"
const HIP_Y = 0.92, TORSO = 0.58, UPPER = 0.34, FORE = 0.32, THIGH = 0.46, SHIN = 0.46, HEAD_OFF = 0.22, HEAD_R = 0.18;

export function getShadowTexture() {
  return themed().shadow;
}

function highlightMat(color: string) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
}

export class Stickman {
  root = new THREE.Group();
  body = new THREE.Group();
  hips = new THREE.Group();
  torso = new THREE.Group();
  neck = new THREE.Group();
  head: THREE.Sprite;
  shoulderL = new THREE.Group();
  shoulderR = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  elbowL = new THREE.Group();
  elbowR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  kneeL = new THREE.Group();
  kneeR = new THREE.Group();
  prop = new THREE.Group(); // oggetto in mano destra

  action: Action = 'none';
  seated = false;
  ko = false;
  private koT = 0;
  private danceStyle = Math.floor(Math.random() * 3);
  private phase = 0;
  private t = Math.random() * 100;
  private hurt = 0;
  private cur: Record<string, number> = {};

  constructor(opts: StickmanOpts = {}) {
    const th = themed();
    inkMat = th.ink;
    const hl = opts.highlighter ? highlightMat(opts.highlighter) : null;
    const limb = (parent: THREE.Object3D, len: number, up = false) => {
      const m = new THREE.Mesh(up ? LIMB_UP : LIMB_DOWN, inkMat);
      m.scale.set(R, len, R);
      parent.add(m);
      if (hl) {
        const g = new THREE.Mesh(up ? LIMB_UP : LIMB_DOWN, hl);
        g.scale.set(R * 2.6, len, R * 2.6);
        g.renderOrder = 2;
        parent.add(g);
      }
      const j = new THREE.Mesh(JOINT, inkMat);
      j.scale.setScalar(R * 1.05);
      j.position.y = up ? len : -len;
      parent.add(j);
    };

    this.root.userData.shared = true; // geometrie e materiali condivisi: non liberarli col mondo
    this.root.add(this.body);
    this.body.add(this.hips);
    this.hips.position.y = HIP_Y;

    // torso + testa
    this.hips.add(this.torso);
    limb(this.torso, TORSO, true);
    this.torso.add(this.neck);
    this.neck.position.y = TORSO;
    limb(this.neck, HEAD_OFF - HEAD_R * 0.8, true);

    let tex: THREE.Texture;
    if (opts.highlighter) {
      tex = th.colored.get(opts.highlighter) ?? headTexture(THEME.inkHex, opts.highlighter);
      th.colored.set(opts.highlighter, tex);
    } else {
      tex = th.head;
    }
    const headMat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5, transparent: false });
    headMat.alphaToCoverage = true;
    this.head = new THREE.Sprite(headMat);
    this.head.scale.setScalar(HEAD_R * 2 * (64 / 52));
    this.head.position.y = HEAD_OFF;
    this.neck.add(this.head);
    this.addFace(opts);
    this.addHat(opts.hat ?? 'none', hl);

    // braccia
    for (const [sh, arm, elbow, side] of [
      [this.shoulderL, this.armL, this.elbowL, 1],
      [this.shoulderR, this.armR, this.elbowR, -1],
    ] as const) {
      this.torso.add(sh);
      sh.position.set(0, TORSO - 0.07, 0);
      sh.add(arm);
      limb(arm, UPPER);
      arm.add(elbow);
      elbow.position.y = -UPPER;
      limb(elbow, FORE);
      void side;
    }
    this.elbowR.add(this.prop);
    this.prop.position.y = -FORE;

    // gambe
    for (const [leg, knee] of [
      [this.legL, this.kneeL],
      [this.legR, this.kneeR],
    ] as const) {
      this.hips.add(leg);
      limb(leg, THIGH);
      leg.add(knee);
      knee.position.y = -THIGH;
      limb(knee, SHIN);
    }

    if (opts.tie) {
      const tie = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), inkMat);
      tie.rotation.x = Math.PI;
      tie.position.set(0, TORSO - 0.2, 0.04);
      this.torso.add(tie);
    }

    // ombra tratteggiata
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.root.add(sh);

    const s = opts.scale ?? 1;
    this.body.scale.setScalar(s);
  }

  private addFace(opts: StickmanOpts) {
    const face = new THREE.Group();
    face.position.set(0, HEAD_OFF, 0);
    this.neck.add(face);
    const dot = (x: number, y: number, r: number) => {
      const m = new THREE.Mesh(JOINT, inkMat);
      m.scale.setScalar(r);
      m.position.set(x, y, HEAD_R * 0.88);
      face.add(m);
    };
    if (opts.sunglasses) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.03), inkMat);
      g.position.set(0, 0.03, HEAD_R * 0.9);
      face.add(g);
    } else if (opts.eyes !== false) {
      dot(-0.055, 0.03, 0.018);
      dot(0.055, 0.03, 0.018);
    }
    if (opts.mustache) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), inkMat);
      m.position.set(0, -0.05, HEAD_R * 0.92);
      face.add(m);
    }
    if (opts.beard) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 3), inkMat);
      b.rotation.x = Math.PI;
      b.position.set(0, -0.2, HEAD_R * 0.5);
      face.add(b);
    }
  }

  private addHat(hat: Hat, hl: THREE.Material | null) {
    const top = HEAD_OFF + HEAD_R * 0.8;
    const g = new THREE.Group();
    g.position.y = top;
    this.neck.add(g);
    const mat = hl ?? inkMat;
    const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, inkMat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    switch (hat) {
      case 'cap':
        add(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, -0.02, 0);
        add(new THREE.BoxGeometry(0.22, 0.02, 0.16), 0, -0.01, -0.2); // visiera all'indietro
        break;
      case 'top':
        add(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 14), 0, 0, 0);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 14), 0, 0.14, 0);
        break;
      case 'beanie':
        add(new THREE.SphereGeometry(0.175, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, -0.04, 0);
        add(new THREE.SphereGeometry(0.04, 6, 4), 0, 0.14, 0);
        break;
      case 'bun':
        add(new THREE.SphereGeometry(0.075, 8, 6), 0, 0.03, -0.1);
        break;
      case 'police':
        add(new THREE.CylinderGeometry(0.19, 0.16, 0.12, 12), 0, 0.02, 0);
        add(new THREE.BoxGeometry(0.2, 0.02, 0.12), 0, -0.04, 0.2);
        break;
      case 'party': {
        const c = add(new THREE.ConeGeometry(0.1, 0.3, 10), 0, 0.14, 0);
        c.rotation.z = 0.2;
        break;
      }
      case 'beret': {
        const b = add(new THREE.CylinderGeometry(0.2, 0.18, 0.06, 12), 0.04, 0, 0);
        b.rotation.z = -0.25;
        break;
      }
      case 'hair':
        for (let i = -2; i <= 2; i++) {
          const h = add(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), i * 0.05, 0.05, 0);
          h.rotation.z = -i * 0.25;
        }
        break;
    }
    if (hl && hat !== 'none') g.children.forEach((c) => ((c as THREE.Mesh).material = mat));
  }

  punchReaction() {
    this.hurt = 1;
  }

  faceTowards(x: number, z: number, dt: number, rate = 6) {
    const want = Math.atan2(x - this.root.position.x, z - this.root.position.z);
    let d = want - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * rate);
  }

  // speed: metri al secondo nel mondo (0 = fermo)
  update(dt: number, speed: number) {
    this.t += dt;
    const t = this.t;
    const moving = speed > 0.1 && !this.seated;
    const run = Math.min(1, Math.max(0, (speed - 2.5) / 3));
    const amp = moving ? 0.8 + run * 0.5 : 0;
    if (moving) this.phase += dt * (3.2 + speed * 1.1);
    const ph = this.phase;

    const tg: Record<string, number> = {
      hipsY: HIP_Y,
      torsoX: 0.02 * Math.sin(t * 1.4),
      torsoZ: 0,
      legLX: 0, legRX: 0, kneeLX: 0, kneeRX: 0,
      legLZ: 0.04, legRZ: -0.04,
      armLX: 0, armRX: 0, armLZ: 0.13 + 0.02 * Math.sin(t * 1.4), armRZ: -0.13 - 0.02 * Math.sin(t * 1.4),
      elbowLX: -0.15, elbowRX: -0.15, elbowLZ: 0, elbowRZ: 0,
    };

    if (this.seated) {
      tg.hipsY = 0.5;
      tg.legLX = tg.legRX = -1.5;
      tg.kneeLX = tg.kneeRX = 1.45;
      tg.torsoX = -0.08 + 0.02 * Math.sin(t * 1.2);
      tg.armLX = tg.armRX = -0.45;
      tg.elbowLX = tg.elbowRX = -0.7;
    } else if (moving) {
      const s = Math.sin(ph), c = Math.cos(ph);
      tg.legLX = s * 0.55 * amp;
      tg.legRX = -s * 0.55 * amp;
      tg.kneeLX = Math.max(0, -c) * 1.1 * amp;
      tg.kneeRX = Math.max(0, c) * 1.1 * amp;
      tg.armLX = -s * 0.55 * amp;
      tg.armRX = s * 0.55 * amp;
      tg.elbowLX = tg.elbowRX = -0.3 - run * 0.9;
      tg.hipsY = HIP_Y - 0.03 * amp + Math.abs(c) * 0.05 * amp;
      tg.torsoX = 0.06 + run * 0.25;
    }

    switch (this.action) {
      case 'wave':
        tg.armRZ = -2.7;
        tg.armRX = 0;
        tg.elbowRZ = Math.sin(t * 9) * 0.5;
        tg.elbowRX = 0;
        break;
      case 'talk':
        tg.armLX = -0.35 + Math.sin(t * 2.3) * 0.25;
        tg.armRX = -0.35 + Math.sin(t * 2.9 + 1) * 0.3;
        tg.elbowLX = -0.9 + Math.sin(t * 3.1) * 0.35;
        tg.elbowRX = -0.9 + Math.sin(t * 2.7 + 2) * 0.35;
        tg.torsoZ = Math.sin(t * 1.3) * 0.04;
        break;
      case 'push': {
        const k = Math.sin(t * 2.2) * 0.08;
        tg.torsoX = 0.5 + k;
        tg.armLX = tg.armRX = -2.05 - k;
        tg.armLZ = 0.15;
        tg.armRZ = -0.15;
        tg.elbowLX = tg.elbowRX = -0.1;
        tg.legLX = -0.35;
        tg.legRX = 0.55 + k * 2;
        tg.kneeLX = 0.3;
        tg.hipsY = HIP_Y - 0.06;
        break;
      }
      case 'phone':
        tg.armRX = -0.35;
        tg.armRZ = -0.5;
        tg.elbowRX = -2.5;
        tg.elbowRZ = 0.5;
        break;
      case 'paint':
        tg.armRX = -1.9 + Math.sin(t * 2.4) * 0.55;
        tg.elbowRX = -0.25;
        break;
      case 'speech':
        tg.armLX = -1.5 + Math.sin(t * 1.9) * 0.6;
        tg.armLZ = 0.5;
        tg.armRX = -1.5 + Math.sin(t * 1.9 + 2.2) * 0.6;
        tg.armRZ = -0.5;
        tg.elbowLX = tg.elbowRX = -0.3;
        tg.torsoX = -0.06;
        break;
      case 'cane':
        tg.armRX = -0.5;
        tg.armRZ = -0.15;
        tg.elbowRX = -0.3;
        tg.torsoX += 0.18;
        break;
      case 'crossed':
        tg.armLX = tg.armRX = -0.75;
        tg.armLZ = -0.35;
        tg.armRZ = 0.35;
        tg.elbowLZ = -1.5;
        tg.elbowRZ = 1.5;
        tg.elbowLX = tg.elbowRX = -0.2;
        break;
      case 'think':
        tg.armRX = -0.7;
        tg.elbowRX = -2.2;
        tg.armLX = -0.5;
        tg.armLZ = -0.2;
        tg.elbowLZ = -1.2;
        break;
      case 'dance': {
        const b = t * 4.3; // ~124 bpm
        const bounce = Math.abs(Math.sin(b));
        tg.hipsY = HIP_Y - 0.08 + bounce * 0.08;
        tg.kneeLX = tg.kneeRX = 0.35 - bounce * 0.3;
        tg.legLX = tg.legRX = -0.18 + bounce * 0.15;
        tg.torsoZ = Math.sin(b * 0.5) * 0.12;
        if (this.danceStyle === 0) {
          // braccia al cielo alternate
          tg.armLZ = 2.4 + Math.sin(b) * 0.4;
          tg.armRZ = -2.4 + Math.sin(b) * 0.4;
          tg.elbowLX = tg.elbowRX = -0.2;
        } else if (this.danceStyle === 1) {
          // "disco": un braccio in alto, uno in basso
          const s = Math.sin(b * 0.5) > 0 ? 1 : -1;
          tg.armRZ = s > 0 ? -2.6 : -0.4;
          tg.armLZ = s > 0 ? 0.4 : 2.6;
          tg.elbowLX = tg.elbowRX = -0.1;
        } else {
          // pugni avanti a tempo
          tg.armLX = -1.3 + Math.sin(b) * 0.5;
          tg.armRX = -1.3 - Math.sin(b) * 0.5;
          tg.elbowLX = tg.elbowRX = -1.2;
        }
        break;
      }
      case 'drink':
        tg.armRX = -0.6 + Math.max(0, Math.sin(t * 0.8)) * -0.5;
        tg.elbowRX = -2.1;
        tg.armLX = -0.1;
        break;
      case 'dj':
        tg.armLX = tg.armRX = -1.1;
        tg.elbowLX = tg.elbowRX = -0.6;
        tg.armLZ = 0.3 + Math.sin(t * 8.6) * 0.15;
        tg.armRZ = -0.3 + Math.sin(t * 4.3) * 0.2;
        tg.torsoX = 0.15 + Math.abs(Math.sin(t * 4.3)) * 0.12;
        break;
      case 'guard': {
        const s = Math.sin(t * 5) * 0.05;
        tg.armLX = tg.armRX = -1.0 + s;
        tg.elbowLX = tg.elbowRX = -1.9;
        tg.armLZ = -0.25;
        tg.armRZ = 0.25;
        tg.torsoX = 0.12;
        tg.legLX = -0.25;
        tg.legRX = 0.25;
        tg.kneeLX = tg.kneeRX = 0.25;
        tg.hipsY = HIP_Y - 0.05 + s * 0.3;
        if (moving) {
          tg.legLX = Math.sin(ph) * 0.4;
          tg.legRX = -Math.sin(ph) * 0.4;
        }
        break;
      }
      case 'windup':
        tg.armLX = -1.0;
        tg.elbowLX = -1.9;
        tg.armRX = 0.9;
        tg.armRZ = -0.6;
        tg.elbowRX = -1.6;
        tg.torsoX = -0.1;
        tg.torsoZ = -0.12;
        break;
      case 'strike':
        tg.armLX = -0.8;
        tg.elbowLX = -1.9;
        tg.armRX = -1.65;
        tg.armRZ = 0.1;
        tg.elbowRX = -0.05;
        tg.torsoX = 0.3;
        tg.legLX = -0.4;
        tg.legRX = 0.4;
        break;
    }

    if (this.ko) {
      // a terra, braccia e gambe scomposte
      this.koT = Math.min(1, this.koT + dt * 3);
      tg.armLZ = 1.4;
      tg.armRZ = -1.2;
      tg.armLX = tg.armRX = 0;
      tg.elbowLX = -0.4;
      tg.elbowRX = -0.8;
      tg.legLZ = 0.35;
      tg.legRZ = -0.2;
      tg.legLX = tg.legRX = 0;
      tg.kneeLX = 0.3;
      tg.kneeRX = 0;
      tg.torsoX = 0;
      tg.hipsY = HIP_Y;
    } else {
      this.koT = Math.max(0, this.koT - dt * 3);
    }

    if (this.hurt > 0) {
      this.hurt = Math.max(0, this.hurt - dt * 2.2);
      const h = this.hurt;
      tg.torsoX -= h * 0.7;
      tg.armLZ += h * 1.6;
      tg.armRZ -= h * 1.6;
      tg.torsoZ += Math.sin(t * 30) * h * 0.1;
    }

    const fast = this.action === 'strike' || this.action === 'windup' || moving;
    const k = 1 - Math.exp(-dt * (this.action === 'strike' ? 30 : fast ? 18 : 9));
    for (const key in tg) {
      const c = this.cur[key] ?? tg[key];
      this.cur[key] = c + (tg[key] - c) * k;
    }
    const c = this.cur;
    this.hips.position.y = c.hipsY;
    this.torso.rotation.set(c.torsoX, 0, c.torsoZ);
    this.legL.rotation.set(c.legLX, 0, c.legLZ);
    this.legR.rotation.set(c.legRX, 0, c.legRZ);
    this.kneeL.rotation.x = c.kneeLX;
    this.kneeR.rotation.x = c.kneeRX;
    this.armL.rotation.set(c.armLX, 0, c.armLZ);
    this.armR.rotation.set(c.armRX, 0, c.armRZ);
    this.elbowL.rotation.set(c.elbowLX, 0, c.elbowLZ);
    this.elbowR.rotation.set(c.elbowRX, 0, c.elbowRZ);
    // caduta all'indietro quando va KO
    this.body.rotation.x = -this.koT * 1.45;
    this.body.position.y = this.koT * 0.12;
  }
}

// ---------------------------------------------------------------------------
// Cane stilizzato
// ---------------------------------------------------------------------------
export class StickDog {
  root = new THREE.Group();
  private legs: THREE.Group[] = [];
  private tail = new THREE.Group();
  private phase = 0;
  private t = 0;

  constructor() {
    inkMat = themed().ink;
    const body = new THREE.Group();
    body.position.y = 0.34;
    this.root.add(body);
    // schiena: un segmento orizzontale da z=+0.25 a z=-0.25
    const spine = new THREE.Group();
    spine.position.z = 0.25;
    spine.rotation.x = Math.PI / 2;
    body.add(spine);
    const sm = new THREE.Mesh(LIMB_DOWN, inkMat);
    sm.scale.set(R * 0.9, 0.5, R * 0.9);
    spine.add(sm);
    for (const [z, x] of [[0.22, 0.06], [0.22, -0.06], [-0.24, 0.06], [-0.24, -0.06]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0, z);
      body.add(leg);
      const m = new THREE.Mesh(LIMB_DOWN, inkMat);
      m.scale.set(R * 0.8, 0.34, R * 0.8);
      leg.add(m);
      this.legs.push(leg);
    }
    const neck = new THREE.Group();
    neck.position.set(0, 0, 0.25);
    body.add(neck);
    const n = new THREE.Mesh(LIMB_UP, inkMat);
    n.scale.set(R * 0.8, 0.2, R * 0.8);
    neck.add(n);
    neck.rotation.x = 0.6;
    const headMat = new THREE.SpriteMaterial({ map: themed().head, alphaTest: 0.5 });
    const head = new THREE.Sprite(headMat);
    head.scale.setScalar(0.24);
    head.position.set(0, 0.22, 0.06);
    neck.add(head);
    for (const x of [-0.07, 0.07]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 3), inkMat);
      ear.position.set(x, 0.32, 0.04);
      neck.add(ear);
    }
    this.tail.position.set(0, 0, -0.25);
    body.add(this.tail);
    const tm = new THREE.Mesh(LIMB_UP, inkMat);
    tm.scale.set(R * 0.7, 0.22, R * 0.7);
    this.tail.add(tm);

    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    this.root.add(sh);
  }

  update(dt: number, speed: number) {
    this.t += dt;
    if (speed > 0.1) this.phase += dt * (6 + speed * 2);
    const a = speed > 0.1 ? 0.5 : 0;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + (i % 2 === 0 ? 0 : Math.PI) + (i > 1 ? Math.PI : 0)) * a));
    this.tail.rotation.set(-0.7, 0, Math.sin(this.t * 14) * 0.6);
  }
}
