import * as THREE from 'three';
import { Stickman, StickDog, type Action } from './stickman';

export type Behavior =
  | { type: 'stand' }
  | { type: 'sit' }
  | { type: 'patrol'; path: [number, number][]; speed: number; wait?: number }
  | { type: 'circle'; cx: number; cz: number; r: number; speed: number }
  | { type: 'follow'; target: () => THREE.Vector3; dist: number; speed: number };

export class NPC {
  pos: THREE.Vector3;
  talking = false;
  speaking = false;
  bubble: string | null = null;
  bubbleT = 0;
  nextBark = 4 + Math.random() * 8;
  hidden = false;
  onSay: ((text: string) => void) | null = null;
  fighter?: import('../game/combat').Fighter;
  controlled = false; // quando true il movimento lo decide il sistema di combattimento
  ctrlSpeed = 0;
  private pathIdx = 0;
  private waitT = 0;
  private angle = 0;
  private lastSpeed = 0;

  constructor(
    public id: string,
    public name: string,
    public body: Stickman | StickDog,
    public behavior: Behavior,
    public baseAction: Action = 'none',
    public homeRot = 0,
    public faceWhenNear = true,
  ) {
    this.pos = body.root.position;
    body.root.rotation.y = homeRot;
    if (body instanceof Stickman) {
      body.action = baseAction;
      body.seated = behavior.type === 'sit';
    }
  }

  get isDog() {
    return this.body instanceof StickDog;
  }

  // Altezza della testa, per fumetti e marker.
  get headY() {
    if (!(this.body instanceof Stickman)) return 0.8;
    return this.body.seated ? 1.5 : 1.93 * this.body.body.scale.y;
  }

  say(text: string, time = 3.5) {
    this.bubble = text;
    this.bubbleT = time;
    this.onSay?.(text);
  }

  setBehavior(b: Behavior) {
    this.behavior = b;
    this.pathIdx = 0;
    this.waitT = 0;
    if (this.body instanceof Stickman) this.body.seated = b.type === 'sit';
  }

  private moveTo(x: number, z: number, speed: number, dt: number) {
    const dx = x - this.pos.x, dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return 0;
    // prima ci si gira, poi ci si sposta: se si arriva esattamente sul punto la direzione
    // diventerebbe nulla e il corpo si girerebbe verso nord (effetto "moonwalk")
    this.body instanceof Stickman ? this.body.faceTowards(x, z, dt, 8) : this.faceDog(x, z, dt);
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    return speed;
  }

  private faceDog(x: number, z: number, dt: number) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    let d = want - this.body.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.body.root.rotation.y += d * Math.min(1, dt * 8);
  }

  update(dt: number, player: THREE.Vector3) {
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) this.bubble = null;
    }
    let speed = 0;
    const b = this.behavior;
    const pd = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    if (this.controlled) {
      this.lastSpeed += (this.ctrlSpeed - this.lastSpeed) * Math.min(1, dt * 10);
      this.body.update(dt, this.lastSpeed);
      return pd;
    }

    if (this.talking) {
      if (b.type !== 'sit' && b.type !== 'circle') this.face(player.x, player.z, dt);
      else if (b.type === 'sit') this.face(player.x, player.z, dt, 2);
    } else {
      switch (b.type) {
        case 'stand':
          if (this.faceWhenNear && pd < 4) this.face(player.x, player.z, dt, 3);
          else this.turnHome(dt);
          break;
        case 'sit':
          this.turnHome(dt);
          break;
        case 'patrol': {
          if (this.waitT > 0) {
            this.waitT -= dt;
            if (this.faceWhenNear && pd < 4) this.face(player.x, player.z, dt, 3);
            break;
          }
          const [tx, tz] = b.path[this.pathIdx];
          speed = this.moveTo(tx, tz, b.speed, dt);
          if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 0.1) {
            this.pathIdx = (this.pathIdx + 1) % b.path.length;
            this.waitT = b.wait ?? 0;
          }
          break;
        }
        case 'circle': {
          this.angle += (b.speed / b.r) * dt;
          const ahead = this.angle + 0.35; // punto un po' più avanti sul cerchio
          const x = b.cx + Math.cos(ahead) * b.r, z = b.cz + Math.sin(ahead) * b.r;
          speed = this.moveTo(x, z, b.speed, dt) ? b.speed : 0;
          break;
        }
        case 'follow': {
          const t = b.target();
          const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
          if (d > b.dist) speed = this.moveTo(t.x, t.z, d > b.dist * 3 ? b.speed * 1.8 : b.speed, dt);
          else this.face(t.x, t.z, dt, 3);
          break;
        }
      }
    }

    // velocità "morbida" per evitare scatti nell'animazione
    this.lastSpeed += (speed - this.lastSpeed) * Math.min(1, dt * 10);
    if (this.body instanceof Stickman) {
      const talkNow = this.talking && this.speaking && this.baseAction !== 'push';
      this.body.action = talkNow && b.type !== 'sit' ? 'talk' : this.baseAction;
      if (this.talking && this.baseAction === 'phone') this.body.action = this.speaking ? 'talk' : 'none';
    }
    this.body.update(dt, this.lastSpeed);
    return pd;
  }

  private face(x: number, z: number, dt: number, rate = 6) {
    if (this.body instanceof Stickman) this.body.faceTowards(x, z, dt, rate);
    else this.faceDog(x, z, dt);
  }

  private turnHome(dt: number) {
    let d = this.homeRot - this.body.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.body.root.rotation.y += d * Math.min(1, dt * 2);
  }
}
