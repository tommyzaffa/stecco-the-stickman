import * as THREE from 'three';
import type { Input } from './input';
import type { Colliders } from './world/collision';
import { THEME } from './render/palette';
import { SETTINGS } from './settings';
import { headTexture, rulerTexture } from './render/textures';

export type Weapon = 'fist' | 'ruler';

const WALK = 4.2, RUN = 7.5, JUMP = 5.2, GRAVITY = 16, EYE = 1.62, EYE_CROUCH = 1.02;

export class Player {
  camera: THREE.PerspectiveCamera;
  pos = new THREE.Vector3();
  vy = 0;
  yaw = 0;
  pitch = 0;
  radius = 0.35;
  weapon: Weapon = 'fist';
  knock = new THREE.Vector3();
  speed = 0;
  blocking = false;
  crouching = false;
  private eyeH = EYE;
  private armMat: THREE.MeshBasicMaterial;
  private fistMat: THREE.SpriteMaterial;

  private arm = new THREE.Group();
  private fist: THREE.Group;
  private ruler: THREE.Mesh;
  private attackT = -1;
  private hitDone = false;
  private bob = 0;
  private sway = new THREE.Vector2();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.05, 400);
    this.camera.rotation.order = 'YXZ';

    // braccio stilizzato in prima persona
    const mat = new THREE.MeshBasicMaterial({ color: THEME.inkHex });
    this.armMat = mat;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6).translate(0, 0.5, 0), mat);
    limb.scale.y = 0.62;
    limb.rotation.set(-1.15, 0, 0.35);
    this.arm.add(limb);
    this.fist = new THREE.Group();
    this.fistMat = new THREE.SpriteMaterial({ map: headTexture(), depthTest: false });
    const f = new THREE.Sprite(this.fistMat);
    f.scale.setScalar(0.085);
    this.fist.add(f);
    // punto in cui il braccio finisce
    const tip = new THREE.Vector3(0, 0.62, 0).applyEuler(limb.rotation);
    this.fist.position.copy(tip);
    this.arm.add(this.fist);
    this.ruler = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.008, 0.5).translate(0, 0, -0.22),
      new THREE.MeshBasicMaterial({ map: rulerTexture() }),
    );
    this.ruler.position.copy(tip);
    this.ruler.rotation.set(0.35, 0.1, 0);
    this.ruler.visible = false;
    this.arm.add(this.ruler);
    this.arm.position.set(0.42, -0.62, -0.28);
    for (const o of [limb, f, this.ruler]) {
      o.renderOrder = 10;
      const m = (o as THREE.Mesh).material as THREE.Material;
      m.depthTest = false;
    }
    this.camera.add(this.arm);
  }

  // il braccio in prima persona segue il tema (inchiostro o gesso)
  applyTheme() {
    this.armMat.color.set(THEME.inkHex);
    this.fistMat.map?.dispose();
    this.fistMat.map = headTexture();
    this.fistMat.needsUpdate = true;
  }

  setCrouch(on: boolean) {
    this.crouching = on;
  }

  setWeapon(w: Weapon) {
    this.weapon = w;
    this.ruler.visible = w === 'ruler';
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  setLook(target: THREE.Vector3) {
    const e = this.eye;
    const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  // Gira dolcemente la visuale verso un punto (durante i dialoghi).
  easeLook(target: THREE.Vector3, dt: number) {
    const e = this.eye;
    const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
    const wantYaw = Math.atan2(-dx, -dz);
    const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    let d = wantYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = Math.min(1, dt * 5);
    this.yaw += d * k;
    this.pitch += (wantPitch - this.pitch) * k;
  }

  // Ritorna true se l'attacco parte (per il suono del colpo a vuoto).
  attack(): boolean {
    if (this.attackT >= 0) return false;
    this.attackT = 0;
    this.hitDone = false;
    return true;
  }

  get attacking() {
    return this.attackT >= 0;
  }

  update(dt: number, input: Input, col: Colliders, canMove: boolean) {
    let hit = false;
    let jumped = false, landed = false, stepped = false;
    const wasAir = this.pos.y > 0.001;
    const fallSpeed = this.vy;
    if (canMove) {
      const sens = 0.0022 * SETTINGS.sensitivity;
      this.yaw -= input.mouseDX * sens;
      this.pitch -= input.mouseDY * sens;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }

    let mx = 0, mz = 0;
    if (canMove) {
      if (input.isDown('forward') || input.down.has('ArrowUp')) mz -= 1;
      if (input.isDown('back') || input.down.has('ArrowDown')) mz += 1;
      if (input.isDown('left') || input.down.has('ArrowLeft')) mx -= 1;
      if (input.isDown('right') || input.down.has('ArrowRight')) mx += 1;
    }
    const len = Math.hypot(mx, mz);
    this.blocking = canMove && input.rightDown;
    const running = input.isDown('run') && !this.crouching && !this.blocking;
    const sp = (running ? RUN : WALK) * (this.crouching ? 0.5 : 1) * (this.blocking ? 0.55 : 1);
    let vx = 0, vz = 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      vx = (mx * c + mz * s) * sp;
      vz = (-mx * s + mz * c) * sp;
    }
    this.pos.x += (vx + this.knock.x) * dt;
    this.pos.z += (vz + this.knock.z) * dt;
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));

    if (canMove && input.wasPressed('jump') && this.pos.y <= 0.001 && !this.crouching) {
      this.vy = JUMP;
      jumped = true;
    }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y < 0) {
      this.pos.y = 0;
      this.vy = 0;
      if (wasAir && fallSpeed < -2) landed = true;
    }
    col.resolve(this.pos, this.radius);
    this.speed = len > 0 ? sp : 0;

    // camera + dondolio della camminata
    const onGround = this.pos.y <= 0.001;
    const prevBob = this.bob;
    if (len > 0 && onGround) this.bob += dt * (running ? 13 : 9);
    if (Math.floor(prevBob / Math.PI) !== Math.floor(this.bob / Math.PI)) stepped = true;
    const bobY = onGround && len > 0 ? Math.abs(Math.sin(this.bob)) * (running ? 0.07 : 0.045) : 0;
    this.eyeH += ((this.crouching ? EYE_CROUCH : EYE) - this.eyeH) * Math.min(1, dt * 10);
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeH + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // braccio: oscillazione + attacco
    this.sway.x += (input.mouseDX * 0.0004 - this.sway.x) * Math.min(1, dt * 8);
    this.sway.y += (input.mouseDY * 0.0004 - this.sway.y) * Math.min(1, dt * 8);
    let ax = 0.42 - this.sway.x + Math.sin(this.bob * 0.5) * (len > 0 ? 0.02 : 0);
    let ay = -0.62 + this.sway.y - bobY * 0.4 + Math.sin(performance.now() * 0.0015) * 0.006;
    let az = -0.28;
    let rx = 0, rz = 0;
    if (this.blocking) {
      // pugno alzato davanti alla faccia
      ax -= 0.3;
      ay += 0.22;
      az += 0.05;
      rz = 0.5;
    }
    if (this.attackT >= 0) {
      const dur = this.weapon === 'ruler' ? 0.42 : 0.3;
      this.attackT += dt / dur;
      const t = Math.min(1, this.attackT);
      const e = Math.sin(t * Math.PI);
      if (this.weapon === 'fist') {
        ax -= e * 0.18;
        ay += e * 0.14;
        az -= e * 0.32;
      } else {
        rz = Math.sin(t * Math.PI) * 1.1;
        rx = -Math.sin(t * Math.PI) * 0.6;
        ax -= e * 0.12;
        az -= e * 0.12;
      }
      if (!this.hitDone && t > 0.4) {
        this.hitDone = true;
        hit = true;
      }
      if (this.attackT >= 1) this.attackT = -1;
    }
    this.arm.position.set(ax, ay, az);
    this.arm.rotation.set(rx, 0, rz);
    return { hit, jumped, landed, stepped, running };
  }
}
