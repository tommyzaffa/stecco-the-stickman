import * as THREE from 'three';
import { Sketch } from '../../render/sketch';
import { HAND_FONT } from '../../render/textures';
import { INK } from '../../render/palette';
import { Stickman } from '../../entities/stickman';
import { WorldBuilder, type World } from '../../world/builder';

// ---------------------------------------------------------------------------
// San Scarabocchio: la cittadina. Tutto è costruito con primitive + inchiostro.
//
// Assi: X = est/ovest lungo la via principale, Z = da un lato all'altro.
// Via principale: z ∈ [-5, 5]. Via trasversale: x ∈ [5, 15].
// Lato "casa" (z > 9): casa tua, condominio, bar, posta, negozio, banca, club.
// Lato "municipio" (z < -9): municipio, lavanderia, casa di nonna Pina, parco.
// ---------------------------------------------------------------------------

export function buildTown(): World {
  const b = new WorldBuilder(2024);
  const { S, D, G, col, group, fill, A, sign, groundText, tree, bush, lamp, bench, car, building, rr } = b;
  const r = b.r;

  // =========================================================================
  // TERRENO E STRADE
  // =========================================================================
  {
    b.ground();

    const y = 0.02;
    // bordi della via principale (interrotti all'incrocio)
    for (const z of [-5, 5]) {
      G.seg(-58, y, z, 5, y, z).seg(15, y, z, 58, y, z);
      D.seg(-58, y, z + Math.sign(z) * 0.18, 5, y, z + Math.sign(z) * 0.18);
      D.seg(15, y, z + Math.sign(z) * 0.18, 58, y, z + Math.sign(z) * 0.18);
    }
    for (const z of [-9, 9]) G.seg(-58, y, z, 1, y, z).seg(19, y, z, 58, y, z);
    // linea tratteggiata centrale
    G.dashed(-58, y, 0, 4, y, 0, 2, 2);
    G.dashed(16, y, 0, 58, y, 0, 2, 2);
    // via trasversale
    for (const x of [5, 15]) {
      G.seg(x, y, -50, x, y, -5).seg(x, y, 5, x, y, 50);
    }
    for (const x of [1, 19]) G.seg(x, y, -50, x, y, -9).seg(x, y, 9, x, y, 50);
    G.dashed(10, y, -50, 10, y, -6, 2, 2);
    G.dashed(10, y, 6, 10, y, 50, 2, 2);
    // strisce pedonali
    for (let z = -4.2; z < 4.2; z += 1.1) D.poly([[1.5, y, z], [4.2, y, z], [4.2, y, z + 0.55], [1.5, y, z + 0.55]], true);
    for (let x = 5.6; x < 14.6; x += 1.1) D.poly([[x, y, 5.6], [x + 0.55, y, 5.6], [x + 0.55, y, 8.4], [x, y, 8.4]], true);
    // crepe e segni sul marciapiede
    for (let i = 0; i < 40; i++) {
      const x = rr(-56, 56);
      if (x > 0 && x < 20) continue;
      const z = (r() > 0.5 ? 1 : -1) * rr(5.6, 8.6);
      D.poly([[x, y, z], [x + rr(-0.3, 0.3), y, z + rr(-0.3, 0.3)], [x + rr(-0.5, 0.5), y, z + rr(-0.4, 0.4)]]);
    }
    // bordo del foglio: "ritagliare lungo la linea tratteggiata"
    G.dashed(-58, y, -50, 58, y, -50, 1.2, 0.8);
    G.dashed(-58, y, 50, 58, y, 50, 1.2, 0.8);
    G.dashed(-58, y, -50, -58, y, 50, 1.2, 0.8);
    G.dashed(58, y, -50, 58, y, 50, 1.2, 0.8);
    groundText('✂ - - ritagliare lungo la linea tratteggiata - -', 40, 48.9, 14, 1.2, Math.PI);
    groundText('✂ - - ritagliare lungo la linea tratteggiata - -', -40, -48.9, 14, 1.2, 0);
    groundText('✂ - - ritagliare qui - -', 56.9, 0, 9, 1.1, Math.PI / 2);
    groundText('✂ - - ritagliare qui - -', -56.9, 20, 9, 1.1, -Math.PI / 2);
    // muri invisibili
    col.rect(-80, -80, -58, 80);
    col.rect(58, -80, 80, 80);
    col.rect(-80, -80, 80, -50);
    col.rect(-80, 50, 80, 80);
  }

  // =========================================================================
  // CASA TUA (con interni)
  // =========================================================================
  {
    const X0 = -52, X1 = -42, Z0 = 10, Z1 = 20, H = 3.2, T = 0.2;
    const DL = -47.7, DR = -46.3; // varco della porta
    // muri
    S.box((X0 + X1) / 2, 0, Z1 - T / 2, X1 - X0, H, T); // retro
    S.box(X0 + T / 2, 0, (Z0 + Z1) / 2, T, H, Z1 - Z0); // sinistra
    S.box(X1 - T / 2, 0, (Z0 + Z1) / 2, T, H, Z1 - Z0); // destra
    S.box((X0 + DL) / 2, 0, Z0 + T / 2, DL - X0, H, T); // fronte sx
    S.box((DR + X1) / 2, 0, Z0 + T / 2, X1 - DR, H, T); // fronte dx
    S.box((DL + DR) / 2, 2.3, Z0 + T / 2, DR - DL, H - 2.3, T); // architrave
    S.roof((X0 + X1) / 2, H, (Z0 + Z1) / 2, X1 - X0, Z1 - Z0, 2.4, 'x', 0.5);
    col.rect(X0, Z1 - T, X1, Z1);
    col.rect(X0, Z0, X0 + T, Z1);
    col.rect(X1 - T, Z0, X1, Z1);
    col.rect(X0, Z0, DL, Z0 + T);
    col.rect(DR, Z0, X1, Z0 + T);

    // finestre (dentro e fuori)
    for (const off of [-0.03, T + 0.03]) {
      D.window(X0 + off, 1.1, 15.8, 1.3, 1.2, 'z');
      D.window(X1 - off, 1.1, 15.2, 1.3, 1.2, 'z');
      D.window(-44.6, 1.1, Z0 + (off < 0 ? -0.03 : T + 0.03), 1.4, 1.2, 'x');
      D.window(-50.6, 1.1, Z0 + (off < 0 ? -0.03 : T + 0.03), 1.4, 1.2, 'x');
    }
    // porta aperta verso l'interno
    S.box(DR - 0.03, 0, Z0 + T + 0.65, 0.06, 2.25, 1.3);
    col.rect(DR - 0.08, Z0 + T, DR + 0.02, Z0 + T + 1.3);
    D.circle(DR - 0.08, 1.05, Z0 + T + 1.1, 0.05, 'x', 8);
    // cartello e zerbino
    sign('CASA TUA', -47, 2.75, Z0 - 0.06, 1.6, 0.42, '-z');
    groundText('BENVENUTO\n(più o meno)', -47, 9.2, 1.6, 0.9, Math.PI);
    D.poly([[-47.9, 0.025, 8.7], [-46.1, 0.025, 8.7], [-46.1, 0.025, 9.8], [-47.9, 0.025, 9.8]], true);
    // cassetta della posta
    S.seg(-44, 0, 8.8, -44, 1.0, 8.8);
    S.box(-44, 1.0, 8.8, 0.3, 0.3, 0.45);
    A('mailbox', -44, 1.15, 8.8);

    // pavimento a doghe
    for (let x = X0 + T + 0.6; x < X1 - T; x += 0.6) D.dashed(x, 0.02, Z0 + T, x, 0.02, Z1 - T, rr(1.5, 3), 0.15);
    // tappeto
    D.circle(-46.8, 0.025, 15.2, 1.5, 'y', 26, 0.03);
    D.circle(-46.8, 0.025, 15.2, 1.25, 'y', 24, 0.03);

    // letto
    S.box(-50.7, 0, 18.3, 1.6, 0.45, 2.8);
    S.box(-50.7, 0, 19.62, 1.6, 1.0, 0.1);
    S.box(-50.7, 0.45, 19.1, 1.1, 0.14, 0.5);
    D.curve([[-51.5, 0.47, 17.6], [-51.0, 0.5, 17.4], [-50.5, 0.47, 17.65], [-49.9, 0.5, 17.4]]);
    D.curve([[-51.5, 0.47, 17.0], [-50.9, 0.49, 17.2], [-50.3, 0.47, 16.95], [-49.9, 0.49, 17.1]]);
    col.rect(-51.5, 16.9, -49.9, 19.8);
    A('bed', -50.2, 0.7, 17.6);
    // comodino + sveglia
    S.box(-49.4, 0, 19.4, 0.55, 0.55, 0.55);
    col.box(-49.4, 19.4, 0.55, 0.55);
    A('alarm', -49.4, 0.8, 19.4);
    // frigo
    S.box(-42.75, 0, 19.3, 0.9, 1.9, 0.8);
    D.seg(-43.2, 1.3, 18.87, -42.3, 1.3, 18.87);
    D.seg(-42.45, 1.45, 18.86, -42.45, 1.75, 18.86);
    D.seg(-42.45, 0.9, 18.86, -42.45, 1.15, 18.86);
    col.box(-42.75, 19.3, 0.9, 0.8);
    A('fridge', -42.75, 1.2, 18.8);
    // bancone cucina
    S.box(-44.5, 0, 19.45, 2.2, 0.95, 0.6);
    D.poly([[-44.9, 0.96, 19.25], [-44.2, 0.96, 19.25], [-44.2, 0.96, 19.65], [-44.9, 0.96, 19.65]], true);
    D.poly([[-44.55, 0.95, 19.7], [-44.55, 1.3, 19.7], [-44.55, 1.3, 19.5]]);
    col.box(-44.5, 19.45, 2.2, 0.6);
    // tavolo + sedie
    S.box(-46.8, 0.72, 15.2, 1.4, 0.06, 0.9);
    for (const [lx, lz] of [[-47.4, 14.85], [-46.2, 14.85], [-47.4, 15.55], [-46.2, 15.55]]) S.seg(lx, 0, lz, lx, 0.72, lz, { over: 0.02 });
    col.box(-46.8, 15.2, 1.4, 0.9);
    for (const cx of [-48, -45.6]) {
      S.box(cx, 0.44, 15.2, 0.45, 0.05, 0.45);
      const bx = cx < -46.8 ? cx - 0.2 : cx + 0.2;
      S.box(bx, 0.49, 15.2, 0.05, 0.5, 0.45);
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) S.seg(cx + dx, 0, 15.2 + dz, cx + dx, 0.44, 15.2 + dz, { over: 0.01 });
      col.box(cx, 15.2, 0.45, 0.45);
    }
    // TV
    S.box(-42.6, 0, 13.4, 0.6, 0.5, 1.6);
    S.box(-42.55, 0.5, 13.4, 0.12, 0.75, 1.3);
    D.seg(-42.63, 0.87, 12.9, -42.63, 0.87, 13.9, { over: 0 });
    col.box(-42.6, 13.4, 0.6, 1.6);
    A('tv', -42.6, 0.9, 13.4);
    // specchio
    D.rectV(-51.77, 0.9, 12.7, 0.8, 1.3, 'z');
    D.seg(-51.76, 1.4, 12.85, -51.76, 1.7, 13.1);
    D.seg(-51.76, 1.3, 12.95, -51.76, 1.5, 13.15);
    A('mirror', -51.7, 1.5, 13.1);
    // pianta (morta, ma disegnata con amore)
    S.cylinder(-51.2, 0, 11, 0.22, 0.45, 10);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      D.poly([[-51.2, 0.45, 11], [-51.2 + Math.cos(a) * 0.2, 0.9, 11 + Math.sin(a) * 0.2], [-51.2 + Math.cos(a) * 0.35, 0.8, 11 + Math.sin(a) * 0.35]]);
    }
    col.circle(-51.2, 11, 0.3);
    A('plant', -51.2, 0.6, 11);
    A('spawn', -48.5, 0, 18.1);
    A('spawnLook', -49.4, 1.0, 19.4);
    A('houseDoor', -47, 1.2, 9.5);

    // cortile sul retro
    for (let x = X0 - 2; x <= X1 + 2; x += 1.2) S.seg(x, 0, 28, x, 1.0, 28, { over: 0.03 });
    S.seg(X0 - 2, 0.8, 28, X1 + 2, 0.8, 28).seg(X0 - 2, 0.4, 28, X1 + 2, 0.4, 28);
    col.rect(X0 - 2, 27.9, X1 + 2, 28.1);
    tree(-45, 24, 0.9);
  }

  // =========================================================================
  // LATO NORD (z > 9)
  // =========================================================================
  building({ x0: -38, x1: -28, z0: 10, z1: 22, h: 9.2, face: '-z', sign: 'CONDOMINIO "VISTA MURO"', signW: 5.5 });
  A('painterWall', -33, 0, 10);
  // secchio e rullo del pittore
  S.cylinder(-31.5, 0, 8.6, 0.2, 0.35, 8);

  building({ x0: -24, x1: -12, z0: 10, z1: 20, h: 4.6, face: '-z', door: -18, sign: 'BAR DA GINO', signW: 5, shopWindow: true });
  // tende parasole a strisce
  D.poly([[-23.8, 3.0, 10], [-23.8, 2.5, 8.8], [-12.2, 2.5, 8.8], [-12.2, 3.0, 10]]);
  for (let x = -23.8; x < -12.2; x += 0.8) D.seg(x, 3.0, 10, x, 2.5, 8.8, { over: 0 });
  // tavolini
  for (const tx of [-21.5, -14.5]) {
    S.cylinder(tx, 0.74, 7.2, 0.5, 0.05, 14);
    S.seg(tx, 0, 7.2, tx, 0.74, 7.2);
    S.seg(tx - 0.3, 0, 7.2, tx + 0.3, 0, 7.2);
    for (const s of [-1, 1]) {
      S.box(tx + s * 0.85, 0.44, 7.2, 0.42, 0.05, 0.42);
      S.box(tx + s * 1.06, 0.49, 7.2, 0.05, 0.45, 0.42);
      col.box(tx + s * 0.85, 7.2, 0.42, 0.42);
    }
    col.circle(tx, 7.2, 0.55);
  }
  A('bar', -18, 1, 9);

  building({ x0: -7, x1: 0, z0: 10, z1: 19, h: 5.2, face: '-z', door: -3.5, sign: 'POSTA\n(sciopero delle buste)', signW: 3.6 });
  sign('Torniamo subito', -3.5, 1.4, 9.9, 1.0, 0.45, '-z', { font: HAND_FONT });

  building({ x0: 20, x1: 30, z0: 10, z1: 19, h: 4.6, face: '-z', door: 25, sign: 'NEGOZIO DI COSE', signW: 5.5, shopWindow: true });
  // cassette sul marciapiede
  S.box(21.3, 0, 9.3, 0.9, 0.5, 0.7).box(21.3, 0.5, 9.3, 0.9, 0.5, 0.7);
  col.box(21.3, 9.3, 0.9, 0.7);

  building({ x0: 33, x1: 45, z0: 10, z1: 21, h: 7, face: '-z', door: 39, doorW: 2, sign: 'BANCA DEI SOLDI\n(pochi)', signW: 5 });
  // colonne "importanti"
  for (const cx of [34.5, 36.8, 41.2, 43.5]) S.cylinder(cx, 0, 9.5, 0.3, 5.2, 10);
  S.box(39, 5.2, 9.5, 12, 0.4, 1.2);
  S.poly([[33, 5.6, 8.9], [39, 6.8, 8.9], [45, 5.6, 8.9]], true);
  for (const cx of [34.5, 36.8, 41.2, 43.5]) col.circle(cx, 9.5, 0.32);
  A('bank', 39, 1, 9);

  building({ x0: 48, x1: 58, z0: 10, z1: 24, h: 6, face: '-z', door: 53, doorW: 2.4, sign: 'PARALLELEPIPEDO', signW: 7 });
  {
    // porta nera del club
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.3), new THREE.MeshBasicMaterial({ color: INK }));
    door.position.set(53, 1.15, 9.95);
    door.rotation.y = Math.PI;
    group.add(door);
    sign('CHIUSO\n(il martedì)', 53, 1.5, 9.9, 1.2, 0.6, '-z', { font: HAND_FONT });
    // cordone da discoteca
    for (const px of [50.5, 55.5]) {
      S.seg(px, 0, 8.2, px, 0.95, 8.2);
      D.circle(px, 0.97, 8.2, 0.07, 'y', 8);
    }
    D.curve([[50.5, 0.9, 8.2], [51.8, 0.6, 8.2], [53, 0.55, 8.2], [54.2, 0.6, 8.2], [55.5, 0.9, 8.2]]);
    col.rect(50.4, 8.1, 55.6, 8.3);
    A('clubDoor', 53, 1.3, 9.6);
  }

  // =========================================================================
  // LATO SUD (z < -9)
  // =========================================================================
  building({ x0: -52, x1: -38, z0: -22, z1: -10, h: 7.5, face: '+z', door: -45, doorW: 2, sign: 'MUNICIPIO', signW: 5 });
  // torre dell'orologio
  S.box(-45, 7.85, -16, 3, 3, 3);
  S.roof(-45, 10.85, -16, 3, 3, 1.8, 'x', 0.2);
  S.circle(-45, 9.35, -14.47, 1.0, 'z', 24, 0.03);
  D.seg(-45, 9.35, -14.45, -45, 10.1, -14.45).seg(-45, 9.35, -14.45, -44.5, 9.1, -14.45);
  // statua del sindaco
  {
    S.box(-45, 0, -7.2, 1.5, 1.4, 1.5);
    col.box(-45, -7.2, 1.5, 1.5);
    sign('AL SINDACO\ndal Sindaco', -45, 0.75, -6.42, 1.2, 0.5, '+z', { font: HAND_FONT });
    const statue = new Stickman({ hat: 'top', eyes: false, scale: 1.15 });
    statue.action = 'speech';
    for (let i = 0; i < 40; i++) statue.update(0.05, 0);
    statue.action = 'none';
    statue.root.position.set(-45, 1.4, -7.2);
    statue.root.children[1].visible = false; // niente ombra sul piedistallo
    group.add(statue.root);
    A('statue', -45, 1.2, -6.3);
  }

  // fermata del bus
  {
    S.box(-30, 0, -8.6, 3.6, 2.3, 0.1);
    S.box(-30, 2.3, -8.1, 3.8, 0.1, 1.3);
    for (const px of [-31.8, -28.2]) S.seg(px, 0, -7.5, px, 2.3, -7.5);
    S.box(-30, 0.42, -8.3, 2.6, 0.06, 0.4);
    col.rect(-31.9, -8.7, -28.1, -8.5);
    S.seg(-26.5, 0, -6, -26.5, 2.6, -6);
    sign('BUS\nlinea 12', -26.5, 2.7, -5.98, 0.8, 0.8, '+z', { font: HAND_FONT });
    sign('ORARI', -26.5, 1.6, -5.97, 0.6, 0.35, '+z', { font: HAND_FONT });
    col.circle(-26.5, -6, 0.15);
    A('busSign', -26.5, 1.6, -5.8);
  }

  building({ x0: -36, x1: -24, z0: -20, z1: -10, h: 4.6, face: '+z', door: -30, sign: 'LAVANDERIA "SOLO BIANCO"', signW: 6, shopWindow: true });
  building({ x0: -21, x1: -11, z0: -19, z1: -10, h: 3.8, face: '+z', door: -16, roof: 'gable' });
  // giardinetto di nonna Pina
  for (let x = -20.8; x <= -11.2; x += 0.6) {
    if (x > -16.8 && x < -15.2) continue;
    S.seg(x, 0, -9.4, x, 0.7, -9.4, { over: 0.02 });
    S.poly([[x - 0.06, 0.7, -9.4], [x, 0.82, -9.4], [x + 0.06, 0.7, -9.4]]);
  }
  S.seg(-20.8, 0.5, -9.4, -16.8, 0.5, -9.4).seg(-15.2, 0.5, -9.4, -11.2, 0.5, -9.4);
  col.rect(-20.9, -9.5, -16.8, -9.3);
  col.rect(-15.2, -9.5, -11.1, -9.3);
  sign('Casa di Pina\n(attenti al cane)', -18.5, 1.6, -9.9, 2.2, 0.8, '+z', { font: HAND_FONT });

  // piazzale col furgone del kebab
  {
    const tx = -4, tz = -13.5;
    S.box(tx, 0.45, tz, 5.2, 2.3, 2.3);
    S.box(tx + 2.2, 0.45, tz, 1.4, 1.6, 2.3);
    for (const wx of [-1.6, 1.6]) for (const wz of [-1.16, 1.16]) S.circle(tx + wx, 0.42, tz + wz, 0.42, 'z', 16);
    D.rectV(tx - 1.8, 1.3, tz + 1.18, 2.6, 1.0, 'x');
    S.box(tx - 0.5, 2.28, tz + 1.45, 2.8, 0.06, 0.6);
    sign('KEBAB ESISTENZIALE', tx - 0.3, 3.2, tz + 0.05, 5, 0.8, '+z');
    col.box(tx, tz, 5.4, 2.4);
    A('kebab', tx - 0.5, 1.3, tz + 1.3);
    G.poly([[-8, 0.02, -9.5], [0.5, 0.02, -9.5], [0.5, 0.02, -22], [-8, 0.02, -22]], true);
  }

  // =========================================================================
  // PARCO
  // =========================================================================
  {
    const PX0 = 19.5, PX1 = 57.5, PZ0 = -49.5, PZ1 = -9.5;
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
        S.seg(x, 0, z, x, 0.9, z, { over: 0.02 });
      }
      S.seg(ax, 0.75, az, bx, 0.75, bz).seg(ax, 0.4, az, bx, 0.4, bz);
      col.rect(ax - 0.1, az - 0.1, bx + 0.1, bz + 0.1);
    };
    fence(PX0, PZ1, 35, PZ1);
    fence(41, PZ1, PX1, PZ1);
    fence(PX0, PZ0, PX1, PZ0);
    fence(PX1, PZ0, PX1, PZ1);
    fence(PX0, PZ0, PX0, -31);
    fence(PX0, -25, PX0, PZ1);
    sign('PARCO "VERDE"\n(immaginalo)', 38, 2.2, -9.1, 2.6, 0.9, '+z');
    S.seg(36.5, 0, -9.1, 36.5, 1.75, -9.1).seg(39.5, 0, -9.1, 39.5, 1.75, -9.1);

    // fontana
    const fx = 38, fz = -28;
    S.cylinder(fx, 0, fz, 3, 0.6, 28);
    S.cylinder(fx, 0.6, fz, 0.35, 1.2, 8);
    S.cylinder(fx, 1.8, fz, 1.1, 0.2, 18);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const rad = 1.1 + t * 1.2;
        pts.push([fx + Math.cos(a) * rad, 2.0 - t * t * 1.5 + Math.sin(t * 9) * 0.03, fz + Math.sin(a) * rad]);
      }
      D.curve(pts);
    }
    for (const rad of [1.2, 2.0, 2.6]) {
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        pts.push([fx + Math.cos(a) * rad, 0.5 + Math.sin(a * 6) * 0.02, fz + Math.sin(a) * rad]);
      }
      D.curve(pts);
    }
    col.circle(fx, fz, 3.05);
    A('fountain', fx, 0.8, fz + 3.1);
    // sentieri
    G.circle(fx, 0.02, fz, 7, 'y', 40, 0.02);
    G.circle(fx, 0.02, fz, 10, 'y', 48, 0.02);
    G.seg(36.5, 0.02, -9.5, 36.5, 0.02, -18.1).seg(39.5, 0.02, -9.5, 39.5, 0.02, -18.1);
    G.seg(19.5, 0.02, -26.5, 28.2, 0.02, -26.5).seg(19.5, 0.02, -29.5, 28.2, 0.02, -29.5);

    bench(30.5, -21.5, '-x');
    A('philosopherBench', 30.5, 0, -21.5);
    bench(46, -37, '+z');
    bench(47, -18, '-z');

    const trees: [number, number, number][] = [
      [24, -13, 1], [29, -14, 1.1], [51, -13, 1], [55, -20, 1.2], [24, -36, 1.1], [26, -44, 1],
      [33, -45, 1.2], [44, -46, 1], [53, -40, 1.1], [52, -30, 0.9], [23, -21, 0.95], [45, -13, 0.9],
    ];
    for (const [x, z, s] of trees) tree(x, z, s);
    for (const [x, z] of [[22, -47], [55, -47], [55, -44], [29, -35], [48, -24], [21, -11.5]] as const) bush(x, z, 1 + r() * 0.3);
    // ciuffi d'erba
    for (let i = 0; i < 120; i++) {
      const x = rr(PX0 + 0.5, PX1 - 0.5), z = rr(PZ0 + 0.5, PZ1 - 0.5);
      const d = Math.hypot(x - fx, z - fz);
      if (d > 6.5 && d < 10.5) continue;
      const s = rr(0.12, 0.2);
      G.poly([[x - s, 0.02, z], [x - s * 0.5, s, z], [x, 0.02, z], [x + s * 0.5, s * 1.2, z], [x + s, 0.02, z]], false, { over: 0, jitter: 0.01 });
    }
    A('dogSpot', 54, 0, -45.5);
  }

  // =========================================================================
  // ARREDO URBANO, AUTO, ALBERI
  // =========================================================================
  for (let x = -54; x <= 56; x += 16) {
    if (x > 0 && x < 20) continue;
    lamp(x, 8.7, -1);
    lamp(x + 8, -8.7, 1);
  }
  car(30, 3.2, 0);
  car(-38, -3.2, Math.PI);
  car(12.5, 30, Math.PI / 2);
  A('car', 30, 1, 3.2);
  // l'auto che Luca spinge (in mezzo alla strada)
  car(-6, -1.8, 0);
  A('lucaCar', -6, 1, -1.8);

  for (const [x, z] of [[-56, 28], [-36, 32], [-22, 26], [-5, 30], [26, 30], [40, 32], [52, 30], [-55, -30], [-40, -32], [-26, -28], [-14, -34], [-50, -44], [-30, -45], [-6, -42], [2, -30]] as const) {
    tree(x, z, 0.9 + r() * 0.35);
  }
  for (const [x, z] of [[-10, 25], [30, 25], [-25, -25], [-45, -38]] as const) bush(x, z);

  // =========================================================================
  // FINE DEL DISEGNO (a nord della via trasversale)
  // =========================================================================
  {
    // edificio non finito: solo linee di costruzione
    const x0 = 19, x1 = 31, z0 = 34, z1 = 46, h = 7;
    D.dashed(x0 - 3, 0.03, z0, x1 + 3, 0.03, z0, 0.6, 0.4);
    D.dashed(x0, 0.03, z0 - 3, x0, 0.03, z1 + 2, 0.6, 0.4);
    D.dashed(x1, 0.03, z0 - 3, x1, 0.03, z1 + 2, 0.6, 0.4);
    S.seg(x0, 0, z0, x0, h, z0).seg(x0, h, z0, x1 - 4, h, z0).seg(x1, 0, z0, x1, h * 0.6, z0);
    S.seg(x0, 0, z0, x1, 0, z0).seg(x0, 0, z0, x0, 0, z1);
    D.dashed(x0, h, z0, x0, h, z1, 0.5, 0.5);
    D.dashed(x1, 0, z0, x1, 0, z1, 0.5, 0.5);
    D.window(x0 + 1.5, 1, z0 - 0.03, 1.2, 1.4, 'x');
    D.rectV(x0 + 4, 1, z0 - 0.03, 1.2, 1.4, 'x');
    groundText('(finire dopo)', 25, 38, 5, 1.2, Math.PI);
    col.rect(x0, z0, x1, z1);
    A('unfinished', 22, 1.5, 33.5);
    // cartello
    S.seg(8.6, 0, 47.2, 8.6, 1.6, 47.2).seg(11.4, 0, 47.2, 11.4, 1.6, 47.2);
    sign('FINE DEL DISEGNO\nl\'autore ha finito la matita', 10, 1.9, 47.15, 4.2, 1.3, '-z');
    col.rect(8.4, 47.0, 11.6, 47.4);
    A('edgeSign', 10, 1.6, 46.4);
    // il tratto della strada si "sfilaccia"
    for (let i = 0; i < 14; i++) D.seg(rr(4, 16), 0.02, rr(47, 50), rr(4, 16), 0.02, rr(47, 50), { over: 0.3, jitter: 0.1 });
  }

  // =========================================================================
  // CIELO: sole, nuvole, montagne sullo sfondo
  // =========================================================================
  b.daySky();

  // =========================================================================
  // SVEGLIA (animata)
  // =========================================================================
  const alarm = new THREE.Group();
  {
    const a = new Sketch();
    a.style = { jitter: 0.004, over: 0.01 };
    a.box(0, 0, 0, 0.26, 0.22, 0.12);
    a.circle(0, 0.11, 0.065, 0.075, 'z', 14, 0.03);
    a.seg(0, 0.11, 0.066, 0, 0.16, 0.066, { over: 0 }).seg(0, 0.11, 0.066, 0.04, 0.11, 0.066, { over: 0 });
    a.cylinder(-0.08, 0.22, 0, 0.05, 0.05, 8).cylinder(0.08, 0.22, 0, 0.05, 0.05, 8);
    a.seg(-0.1, 0, 0, -0.12, -0.03, 0).seg(0.1, 0, 0, 0.12, -0.03, 0);
    alarm.add(a.build(b.lineMat(1.6), fill));
    alarm.position.set(-49.4, 0.58, 19.4);
    alarm.rotation.y = Math.PI + 0.3;
    group.add(alarm);
  }

  b.props.alarm = alarm;
  return b.finish({ isIndoor: (p) => p.x > -52 && p.x < -42 && p.z > 10.1 && p.z < 20 });
}
