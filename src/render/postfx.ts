import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Post-processing "foglio di carta":
//  - line boil: l'immagine trema leggermente a scatti (~8 fps), come un cartone animato
//  - grana della carta e vignettatura
const PaperShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBoil: { value: 1.3 },
    uDamage: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uBoil;
    uniform float uDamage;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }

    void main() {
      float t = floor(uTime * 8.0);
      vec2 px = vUv * uRes;
      vec2 off = vec2(noise(px * 0.012 + t * 17.13), noise(px * 0.012 + t * 9.71 + 40.0)) - 0.5;
      vec3 c = texture2D(tDiffuse, vUv + off * uBoil * 2.0 / uRes).rgb;

      // grana della carta
      float g = noise(px * 0.9) * 0.4 + noise(px * 0.18) * 0.35 + noise(px * 0.03) * 0.25;
      c *= 0.955 + 0.06 * g;

      // vignettatura
      float v = length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0));
      c *= mix(1.0, 0.82, smoothstep(0.45, 1.05, v));

      // danno: bordi rossi a matita
      if (uDamage > 0.0) {
        float edge = smoothstep(0.35, 0.95, v + noise(px * 0.05 + t) * 0.15);
        c = mix(c, vec3(0.62, 0.05, 0.07), edge * uDamage * 0.7);
      }
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }
  `,
};

export class PaperPost {
  composer: EffectComposer;
  paper: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, samples = 4) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // L'ultimo passaggio (carta) scrive direttamente sullo schermo e fa anche la conversione sRGB:
    // niente OutputPass, un disegno a schermo intero in meno per frame.
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples, type: THREE.UnsignedByteType });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.paper = new ShaderPass(PaperShader);
    this.composer.addPass(this.paper);
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.paper.uniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  }

  render(time: number, damage: number) {
    this.paper.uniforms.uTime.value = time;
    this.paper.uniforms.uDamage.value = damage;
    this.composer.render();
  }
}
