import * as THREE from 'three';
import { THEME, makeRng } from './palette';

// Tutte le texture sono disegnate a runtime su canvas: niente file immagine.

export const HAND_FONT = '"Patrick Hand", "Comic Sans MS", cursive';
export const MARKER_FONT = '"Permanent Marker", "Patrick Hand", "Comic Sans MS", cursive';

const r = makeRng(99);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Cerchio fatto a mano: raggio che oscilla e chiusura che "sborda".
export function wobblyCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number, wob = 0.05, turns = 1.12) {
  const start = r() * Math.PI * 2;
  const steps = 48;
  ctx.beginPath();
  for (let i = 0; i <= steps * turns; i++) {
    const t = start + (i / steps) * Math.PI * 2;
    const rr = rad * (1 + Math.sin(t * 3 + start) * wob * 0.5 + (r() - 0.5) * wob * 0.3);
    const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function headTexture(stroke = THEME.inkHex, fill = THEME.paperHex) {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(64, 64, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 9;
  wobblyCircle(ctx, 64, 64, 52, 0.05);
  return toTexture(c);
}

// Chioma d'albero: nuvola scarabocchiata.
export function crownTexture(seed: number) {
  const rr = makeRng(seed);
  const { c, ctx } = canvas(256, 256);
  const blobs: [number, number, number][] = [];
  const n = 6 + Math.floor(rr() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    blobs.push([128 + Math.cos(a) * 62, 118 + Math.sin(a) * 52, 44 + rr() * 16]);
  }
  blobs.push([128, 118, 70]);
  ctx.fillStyle = THEME.paperHex;
  for (const [x, y, rad] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // contorno: archi esterni
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 5;
  for (const [x, y, rad] of blobs.slice(0, -1)) {
    const a = Math.atan2(y - 118, x - 128);
    ctx.beginPath();
    ctx.arc(x, y, rad, a - 1.35, a + 1.35);
    ctx.stroke();
  }
  // qualche riccio interno
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x = 90 + rr() * 76, y = 90 + rr() * 60, rad = 8 + rr() * 8;
    ctx.beginPath();
    ctx.arc(x, y, rad, rr() * 3, rr() * 3 + 2.2);
    ctx.stroke();
  }
  // tratteggio d'ombra in basso a destra
  ctx.save();
  ctx.beginPath();
  for (const [x, y, rad] of blobs) {
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.lineWidth = 2.5;
  for (let i = -256; i < 256; i += 11) {
    ctx.beginPath();
    ctx.moveTo(150 + i, 256);
    ctx.lineTo(256 + i, 150);
    ctx.stroke();
  }
  ctx.restore();
  return toTexture(c);
}

export function bushTexture(seed: number) {
  const rr = makeRng(seed);
  const { c, ctx } = canvas(256, 128);
  ctx.fillStyle = THEME.paperHex;
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 5;
  const bumps = 5;
  ctx.beginPath();
  ctx.moveTo(14, 124);
  for (let i = 0; i < bumps; i++) {
    const x0 = 14 + (i / bumps) * 228;
    const x1 = 14 + ((i + 1) / bumps) * 228;
    const top = 20 + rr() * 30;
    ctx.bezierCurveTo(x0, top, x1, top, x1, 70 + rr() * 20);
  }
  ctx.lineTo(242, 124);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const x = 40 + rr() * 170, y = 60 + rr() * 40;
    ctx.beginPath();
    ctx.arc(x, y, 7, 3.4, 5.9);
    ctx.stroke();
  }
  return toTexture(c);
}

// Ombra tratteggiata sotto i personaggi.
export function shadowTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(64, 64, 58, 58, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = THEME.inkHex;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  for (let i = -128; i < 128; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 128);
    ctx.lineTo(i + 128, 0);
    ctx.stroke();
  }
  ctx.restore();
  return toTexture(c);
}

export function coinTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 7;
  wobblyCircle(ctx, 64, 64, 50, 0.04);
  ctx.lineWidth = 3;
  wobblyCircle(ctx, 64, 64, 38, 0.06, 1.0);
  ctx.fillStyle = THEME.inkHex;
  ctx.font = `bold 54px ${HAND_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('5', 64, 68);
  return toTexture(c);
}

export function sunTexture() {
  const { c, ctx } = canvas(256, 256);
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 6;
  ctx.fillStyle = THEME.paperHex;
  ctx.beginPath();
  ctx.arc(128, 128, 52, 0, Math.PI * 2);
  ctx.fill();
  wobblyCircle(ctx, 128, 128, 52, 0.05);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.1;
    const r0 = 68, r1 = 92 + (i % 2) * 18;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0);
    ctx.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
    ctx.stroke();
  }
  // faccina, perché sì
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 132, 22, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.fillStyle = THEME.inkHex;
  ctx.beginPath();
  ctx.arc(110, 115, 5, 0, 7);
  ctx.arc(146, 115, 5, 0, 7);
  ctx.fill();
  return toTexture(c);
}

export function cloudTexture(seed: number) {
  const rr = makeRng(seed);
  const { c, ctx } = canvas(512, 200);
  ctx.strokeStyle = THEME.inkHex;
  ctx.fillStyle = THEME.paperHex;
  ctx.lineWidth = 6;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) pts.push([110 + i * 72, 110 - Math.sin((i / 4) * Math.PI) * 30 + rr() * 10, 44 + rr() * 24]);
  for (const [x, y, rad] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(80, 110, 360, 50);
  for (const [x, y, rad] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, rad, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(60, 160);
  ctx.bezierCurveTo(40, 150, 50, 110, 80, 115);
  ctx.moveTo(60, 160);
  ctx.lineTo(460, 162);
  ctx.bezierCurveTo(490, 150, 480, 110, 440, 112);
  ctx.stroke();
  return toTexture(c);
}

// Cartelli e insegne scritti a mano.
export function textTexture(
  text: string,
  opts: { w?: number; h?: number; size?: number; font?: string; border?: boolean; bg?: string; color?: string; glow?: string } = {},
) {
  const w = opts.w ?? 512, h = opts.h ?? 128;
  const { c, ctx } = canvas(w, h);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
  }
  if (opts.border) {
    ctx.strokeStyle = THEME.inkHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(8, 10);
    ctx.lineTo(w - 6, 7);
    ctx.lineTo(w - 9, h - 8);
    ctx.lineTo(6, h - 10);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = opts.color ?? THEME.inkHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  let size = opts.size ?? Math.floor(h * 0.62 / lines.length);
  ctx.font = `${size}px ${opts.font ?? MARKER_FONT}`;
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (maxW > w * 0.9) {
    size = Math.floor(size * (w * 0.9) / maxW);
    ctx.font = `${size}px ${opts.font ?? MARKER_FONT}`;
  }
  const lh = size * 1.1;
  if (opts.glow) {
    // alone da neon: più passate sfocate sotto il testo
    ctx.save();
    ctx.shadowColor = opts.glow;
    for (const blur of [size * 0.6, size * 0.3]) {
      ctx.shadowBlur = blur;
      lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
    }
    ctx.restore();
  }
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  return toTexture(c);
}

// Righello per l'arma in prima persona.
export function rulerTexture() {
  const { c, ctx } = canvas(512, 64);
  ctx.fillStyle = '#fbf7ea';
  ctx.fillRect(0, 0, 512, 64);
  ctx.strokeStyle = THEME.inkHex;
  ctx.lineWidth = 3;
  for (let i = 0; i <= 30; i++) {
    const x = 8 + i * 16.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, i % 5 === 0 ? 26 : 14);
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, 508, 60);
  return toTexture(c);
}
