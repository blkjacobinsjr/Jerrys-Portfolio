import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Geometry, Triangle, Texture, RenderTarget } from 'ogl';

/**
 * React Bits "Ripple Distortion" (https://reactbits.dev/animations/ripple-distortion, ogl). Shaders, wave field and
 * composite as published, plus the texture's alpha. Adapted for the selected-work cards: the wave field spans the
 * whole card and warps what the card shows (the phone, drawn into a transparent 2D canvas at the card's size, drawn
 * only inside the wake, so the card's own img shows everywhere else and never goes away); the canvas never takes a pointer, and the hover listener is
 * the card's own. Defaults tuned down: colour kept, no tint, low quality field.
 */
const MAX_WAVES = 100;
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);

const waveVertex = `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;

varying vec2 vUv;
varying float vOpacity;

void main() {
  vUv = uv;
  vOpacity = iOpacity;
  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
}
`;

const waveFragment = `
precision highp float;

varying vec2 vUv;
varying float vOpacity;

uniform float uRings;

const float PI = 3.141592653589793;
const float EDGE = 0.006737947;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;

  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);

  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);

  gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
}
`;

const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const compositeFragment = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform vec3 uHighlight;
uniform float uStrength;
uniform float uSwirl;
uniform float uDispersion;
uniform float uGlint;
uniform float uTintAmount;
uniform float uGrayscale;

const float TAU = 6.283185307179586;

vec2 coverUV(vec2 uv) {
  vec2 safe = max(uTextureSize, vec2(1.0));
  vec2 s = uResolution / safe;
  vec2 scaledSize = safe * max(s.x, s.y);
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  float amount = texture2D(uDisplacement, vUv).r;
  vec2 base = coverUV(vUv);

  float theta = amount * uSwirl * TAU;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 push = dir * amount * uStrength;

  vec3 color;
  float alpha = texture2D(uTexture, base + push).a;
  if (uDispersion > 0.001) {
    float split = uDispersion * 0.25;
    color.r = texture2D(uTexture, base + push * (1.0 + split)).r;
    color.g = texture2D(uTexture, base + push).g;
    color.b = texture2D(uTexture, base + push * (1.0 - split)).b;
  } else {
    color = texture2D(uTexture, base + push).rgb;
  }

  if (uGrayscale > 0.001) {
    color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uGrayscale);
  }

  if (uTintAmount > 0.001) {
    color = mix(color, color * uTint * 1.9, clamp(amount * 1.6, 0.0, 1.0) * uTintAmount);
  }

  if (uGlint > 0.001) {
    float ex = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
    float ey = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));
    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
    float raw = pow(max(dot(normal, light), 0.0), 22.0);
    float flatSpec = pow(max(light.z, 0.0), 22.0);
    color += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;
  }

  // The canvas carries the whole phone (the card's img is hidden while it runs), so the wake never doubles it.
  gl_FragColor = vec4(color, alpha);
}
`;


const FIELD_SCALE = 0.4;

/** Paint the card's phone into a transparent 2D canvas the card's size, at the place it is shown, with its shadow. */
function snapshot(face: HTMLElement, width: number, height: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(width * dpr);
  c.height = Math.round(height * dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const box = face.getBoundingClientRect();
  const img = face.querySelector<HTMLImageElement>('.work-phone');
  if (img?.complete && img.naturalWidth) {
    const r = img.getBoundingClientRect();
    ctx.filter = getComputedStyle(img).filter;
    ctx.drawImage(img, r.left - box.left, r.top - box.top, r.width, r.height);
  }
  return c;
}

export default function WorkRipple({ face, onReady }: { face: HTMLElement; onReady?: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false, antialias: false, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const imageTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    const offsets = new Float32Array(MAX_WAVES * 2);
    const scales = new Float32Array(MAX_WAVES * 2);
    const opacities = new Float32Array(MAX_WAVES);
    const waves = Array.from({ length: MAX_WAVES }, () => ({ x: 0, y: 0, scale: START_SCALE, target: START_SCALE, size: 1, opacity: 0 }));
    let current = 0;

    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]) },
      uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]) },
      iOffset: { instanced: 1, size: 2, data: offsets },
      iScale: { instanced: 1, size: 2, data: scales },
      iOpacity: { instanced: 1, size: 1, data: opacities },
    });
    const waveProgram = new Program(gl, {
      vertex: waveVertex,
      fragment: waveFragment,
      uniforms: { uRings: { value: 4 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    });
    waveProgram.setBlendFunc(gl.ONE, gl.ONE);
    const waveMesh = new Mesh(gl, { geometry, program: waveProgram, frustumCulled: false });
    const field = new RenderTarget(gl, { width: 2, height: 2, depth: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE });
    const uniforms = {
      uTexture: { value: imageTexture },
      uDisplacement: { value: field.texture },
      uResolution: { value: [1, 1] },
      uTextureSize: { value: [1, 1] },
      uTexel: { value: [1, 1] },
      uTint: { value: [1, 1, 1] },
      uHighlight: { value: [1, 1, 1] },
      uStrength: { value: 0.12 },
      uSwirl: { value: 1 },
      uDispersion: { value: 0 },
      uGlint: { value: 0 },
      uTintAmount: { value: 0 },
      uGrayscale: { value: 0 },
    };
    const composite = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, { vertex: screenVertex, fragment: compositeFragment, uniforms, depthTest: false, depthWrite: false }),
    });

    let width = 1;
    let height = 1;
    let painted = false;
    const resize = () => {
      width = Math.max(1, mount.clientWidth);
      height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height);
      uniforms.uResolution.value = [width, height];
      const fw = Math.max(2, Math.round(width * FIELD_SCALE));
      const fh = Math.max(2, Math.round(height * FIELD_SCALE));
      field.setSize(fw, fh);
      uniforms.uTexel.value = [1 / fw, 1 / fh];
      const snap = snapshot(face, width, height, dpr);
      imageTexture.image = snap;
      imageTexture.needsUpdate = true;
      uniforms.uTextureSize.value = [snap.width, snap.height];
    };
    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(mount);
    resize();

    let px = 0;
    let py = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = mount.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = rect.height - (event.clientY - rect.top);
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      if (Math.abs(x - px) <= 15 && Math.abs(y - py) <= 15) return;
      px = x;
      py = y;
      const wave = waves[current]!;
      current = (current + 1) % MAX_WAVES;
      Object.assign(wave, { x, y, scale: START_SCALE, target: START_SCALE * 5, size: 150, opacity: 1 });
      wake();
    };
    // A click starts the page transition: hand the phone back to the real img so its snapshot is not blank.
    const release = () => delete face.dataset.rippling;
    face.addEventListener('pointerdown', release, true);
    face.addEventListener('pointermove', onMove, { passive: true });

    // Renders on demand: a pointer move or a resize wakes the loop, and it stops on the frame after the last wave fades.
    let raf = 0;
    let last = 0;
    const wake = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const loop = (now: number) => {
      let alive = false;
      const delta = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const growth = 1 - Math.exp(-delta * 1.09);
      const decay = Math.exp((-delta * LIFE_CONSTANT) / 3);
      for (let i = 0; i < MAX_WAVES; i += 1) {
        const wave = waves[i]!;
        if (wave.opacity <= 0) {
          opacities[i] = 0;
          continue;
        }
        wave.opacity *= decay;
        wave.scale += (wave.target - wave.scale) * growth;
        if (wave.opacity < 0.002) {
          wave.opacity = 0;
          opacities[i] = 0;
          continue;
        }
        const half = (wave.scale * wave.size) / 2;
        offsets[i * 2] = (wave.x / width) * 2 - 1;
        offsets[i * 2 + 1] = (wave.y / height) * 2 - 1;
        scales[i * 2] = (half / width) * 2;
        scales[i * 2 + 1] = (half / height) * 2;
        opacities[i] = wave.opacity;
        alive = true;
      }
      geometry.attributes.iOffset!.needsUpdate = true;
      geometry.attributes.iScale!.needsUpdate = true;
      geometry.attributes.iOpacity!.needsUpdate = true;
      renderer.render({ scene: waveMesh, target: field, clear: true });
      renderer.render({ scene: composite });
      if (!painted) {
        painted = true;
        mount.dataset.ready = 'true';
        face.dataset.rippling = '';
        onReady?.();
      }
      raf = alive ? requestAnimationFrame(loop) : 0;
    };
    wake();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      face.removeEventListener('pointermove', onMove);
      face.removeEventListener('pointerdown', release, true);
      delete mount.dataset.ready;
      delete face.dataset.rippling;
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [face, onReady]);

  return <div ref={mountRef} className="work-ripple" aria-hidden="true" />;
}
