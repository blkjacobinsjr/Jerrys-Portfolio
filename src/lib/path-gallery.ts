/**
 * The path's circular gallery: the WebGL2 card renderer from React Bits Circular Gallery
 * (https://reactbits.dev/components/circular-gallery, MIT) with its input layer taken out.
 * Kept from it: the wave mesh, the arc bend, the edge fade, texture upload. Changed:
 *  - Position comes from the strip itself, not from a drag/wheel state: the native scroller on phones, or the
 *    GSAP-pinned track on desktop. Both move `.path-track`, so one formula reads either.
 *  - The strip's own buttons stay the labels, hit targets and focus order. Each `.stop` is bent along the same
 *    arc with a CSS transform, so text and diorama stay together and nothing is added to the tab order.
 *  - No wrap-around: the strip has a first and a last stop, so "Now" never sits beside 2013.
 *  - Cards keep their own alpha (the dioramas are transparent) and are fitted, not cropped. No shadow pass.
 * Hover and press are transitions.dev "Avatar group hover" (recipe 11) on the buttons; the canvas mirrors
 * the button's computed transform, so the recipe stays the single source of truth for that motion.
 */
import { cue } from './sound';

export interface PathStop {
  id: string;
  src: string;
  /** Desaturate (the declined offer). 0 to 1. */
  gray?: number;
}

const SEGMENTS_X = 32;
const SEGMENTS_Y = 24;
const WORLD_HEIGHT = 16.57;
const BEND = 2.2;
const WAVE = 1;
const FADE_EDGES = 0.1;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Where a card at horizontal offset `x` from the middle sits on the arc, y up. Same maths as the React Bits source. */
export function arcOf(x: number, width: number, height: number, bend: number) {
  if (!bend) return { y: 0, angle: 0 };
  const depth = (Math.abs(bend) * height) / WORLD_HEIGHT;
  const half = Math.max(width, height * 1.9) / 2;
  const radius = (half * half + depth * depth) / (2 * depth);
  const reach = Math.min(Math.abs(x), half, radius * 0.999);
  const arc = radius - Math.sqrt(radius * radius - reach * reach);
  const angle = Math.sign(x) * Math.asin(reach / radius);
  return bend > 0 ? { y: -arc, angle: -angle } : { y: arc, angle };
}

/** 0 at the canvas edge, 1 once `fade` of the width in. Quintic smoothstep, as in the shader. */
export function edgeFade(u: number, fade: number) {
  if (fade <= 0) return 1;
  const t = clamp(Math.min(u, 1 - u) / fade, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const VERTEX = `#version 300 es
in vec2 aPosition;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uSize;
uniform float uAngle;
uniform float uPad;
uniform float uWave;
uniform float uWaveTime;
uniform float uFocal;
out vec2 vUv;
void main() {
  vec2 local = aPosition * (uSize + 2.0 * uPad);
  vec2 unit = local / max(uSize, vec2(1.0));
  float z = uWave * (sin(unit.x * 4.0 + uWaveTime) + cos(unit.y * 2.0 + uWaveTime)) * 0.5;
  float depth = uFocal / max(uFocal - z, 1.0);
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 turned = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
  vUv = local / uSize + 0.5;
  gl_Position = vec4((uCenter + turned * depth) / (uResolution * 0.5), 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uGray;
uniform float uAlpha;
uniform float uFade;
in vec2 vUv;
out vec4 outColor;

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
  vec4 tex = texture(uTexture, vUv);
  float inside = step(0.0, vUv.x) * step(vUv.x, 1.0) * step(0.0, vUv.y) * step(vUv.y, 1.0);
  float u = gl_FragCoord.x / uResolution.x;
  float fade = uFade <= 0.0 ? 1.0 : smoother(u / uFade) * smoother((1.0 - u) / uFade);
  float luma = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
  tex.rgb = mix(tex.rgb, vec3(luma) * tex.a, uGray);
  outColor = tex * inside * uAlpha * fade;
}`;

interface Item {
  li: HTMLElement;
  btn: HTMLElement;
  stop: PathStop;
  /** Art centre from the track's left edge, and from the stage's top edge. */
  cx: number;
  cy: number;
  side: number;
}

interface Tex {
  texture: WebGLTexture | null;
  aspect: number;
  loaded: boolean;
}

/** Start the gallery on a stage that holds the strip. Returns its teardown, or undefined if WebGL2 is not there. */
export function startPathGallery(canvas: HTMLCanvasElement, stops: PathStop[]): (() => void) | undefined {
  const stage = canvas.closest<HTMLElement>('.path-stage');
  const section = stage?.closest<HTMLElement>('.path');
  const track = stage?.querySelector<HTMLElement>('[data-path-track]');
  if (!stage || !section || !track) return undefined;
  const lis = [...track.querySelectorAll<HTMLElement>('.stop')];
  const items: Item[] = [];
  for (const stop of stops) {
    const btn = track.querySelector<HTMLElement>(`[data-stop="${stop.id}"]`);
    const li = btn?.closest<HTMLElement>('.stop');
    if (btn && li && lis.includes(li)) items.push({ li, btn, stop, cx: 0, cy: 0, side: 0 });
  }
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl || !items.length) return undefined;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aPosition');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return undefined;
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) u[info.name] = gl.getUniformLocation(program, info.name);
  }

  const vertices: number[] = [];
  for (let y = 0; y <= SEGMENTS_Y; y++) for (let x = 0; x <= SEGMENTS_X; x++) vertices.push(x / SEGMENTS_X - 0.5, y / SEGMENTS_Y - 0.5);
  const indices: number[] = [];
  for (let y = 0; y < SEGMENTS_Y; y++) {
    for (let x = 0; x < SEGMENTS_X; x++) {
      const a = y * (SEGMENTS_X + 1) + x;
      const c = a + SEGMENTS_X + 1;
      indices.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

  const textures = new Map<string, Tex>();
  const textureFor = (item: Item) => {
    const existing = textures.get(item.stop.src);
    if (existing) return existing;
    const entry: Tex = { texture: null, aspect: 1, loaded: false };
    textures.set(item.stop.src, entry);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!alive) return;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      entry.texture = texture;
      entry.aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
      entry.loaded = true;
      wake();
    };
    image.src = item.stop.src;
    return entry;
  };

  let alive = true;
  let visible = true;
  let raf = 0;
  let last = 0;
  let lastPos = NaN;
  let velocity = 0;
  let waveTime = 0;
  let width = 1;
  let height = 1;
  let ratio = 1;
  let pitch = 1;
  let lastSnappedId: string | undefined;
  let focusedItem: Item | undefined;
  /** Buttons whose recipe transition is running: the canvas mirrors their computed transform until it ends. */
  const moving = new Map<HTMLElement, boolean>();
  const lift = new Map<Item, { dy: number; scale: number }>();

  const measure = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    for (const item of items) item.li.style.transform = 'none';
    const stageRect = stage.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    for (const item of items) {
      const liRect = item.li.getBoundingClientRect();
      const artRect = item.li.querySelector('.stop-art')!.getBoundingClientRect();
      // The art is square. Its height is not read: a stop skipped by content-visibility reports its intrinsic 280px.
      const artMiddle = artRect.top + artRect.width / 2;
      item.cx = liRect.left + liRect.width / 2 - trackRect.left;
      item.cy = artMiddle - stageRect.top;
      item.side = artRect.width;
      // Bend and lift turn about the diorama, not the middle of the whole button.
      item.li.style.transformOrigin = `${liRect.width / 2}px ${artMiddle - liRect.top}px`;
      item.btn.style.transformOrigin = `50% ${artMiddle - item.btn.getBoundingClientRect().top}px`;
    }
    pitch = items.length > 1 ? Math.abs(items[1]!.cx - items[0]!.cx) : width;
    wake();
  };

  const mirror = () => {
    for (const [btn, ended] of moving) {
      const item = items.find((i) => i.btn === btn)!;
      const t = getComputedStyle(btn).transform;
      const m = t === 'none' ? new DOMMatrix() : new DOMMatrix(t);
      lift.set(item, { dy: m.m42, scale: m.a });
      if (ended) {
        moving.delete(btn);
        if (!m.m42 && m.a === 1) lift.delete(item);
      }
    }
  };

  const draw = (cards: { item: Item; x: number; y: number; angle: number; side: number }[]) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u.uResolution!, canvas.width, canvas.height);
    gl.uniform1f(u.uFocal!, height * 1.207 * ratio);
    gl.uniform1f(u.uWaveTime!, waveTime);
    gl.uniform1f(u.uFade!, FADE_EDGES);
    gl.uniform1f(u.uPad!, 10 * ratio);
    gl.uniform1f(u.uAlpha!, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.uTexture!, 0);
    const wavePx = WAVE * Math.min(Math.abs(velocity) / Math.max(pitch * 4, 1), 1) * height * 0.08 * ratio;
    for (const card of cards) {
      const entry = textures.get(card.item.stop.src)!;
      if (!entry.loaded) continue;
      const w = entry.aspect >= 1 ? card.side : card.side * entry.aspect;
      const h = entry.aspect >= 1 ? card.side / entry.aspect : card.side;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.uniform2f(u.uCenter!, card.x * ratio, card.y * ratio);
      gl.uniform2f(u.uSize!, w * ratio, h * ratio);
      gl.uniform1f(u.uAngle!, card.angle);
      gl.uniform1f(u.uWave!, wavePx);
      gl.uniform1f(u.uGray!, card.item.stop.gray ?? 0);
      gl.drawElements(gl.TRIANGLES, SEGMENTS_X * SEGMENTS_Y * 6, gl.UNSIGNED_SHORT, 0);
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
    last = now;
    // How far the strip has travelled: the native scroller and the pinned track both move `.path-track`.
    const pos = stage.getBoundingClientRect().left - track.getBoundingClientRect().left;
    const step = Number.isNaN(lastPos) ? 0 : pos - lastPos;
    lastPos = pos;
    velocity += (step / dt - velocity) * (1 - Math.exp(-dt / 0.08));
    if (Math.abs(velocity) < 0.5) velocity = 0;
    waveTime += dt * 2.4;
    mirror();

    const cards: Parameters<typeof draw>[0] = [];
    for (const item of items) {
      const x = item.cx - pos - width / 2;
      if (Math.abs(x) > width / 2 + item.side * 1.5) continue;
      const entry = textureFor(item);
      const arc = arcOf(x, width, height, BEND);
      const l = lift.get(item);
      const y = height / 2 - item.cy + arc.y - (l ? l.dy : 0);
      cards.push({ item, x, y, angle: arc.angle, side: item.side * (l ? l.scale : 1) });
      item.li.style.transform = `translateY(${-arc.y}px) rotate(${-arc.angle}rad)`;
      item.li.style.opacity = String(edgeFade((x + width / 2) / width, FADE_EDGES));
      if (entry.loaded) item.li.dataset.gl = '';
    }
    cards.sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
    draw(cards);

    // The stop nearest the middle owns the caption: its text crossfades in while the others dim (Path.astro CSS).
    const focused = items.reduce<Item | undefined>((closest, item) => {
      const itemX = item.cx - pos - width / 2;
      const closestX = closest ? closest.cx - pos - width / 2 : Infinity;
      return Math.abs(itemX) < Math.abs(closestX) ? item : closest;
    }, undefined);
    if (focused && focused !== focusedItem) {
      if (focusedItem) delete focusedItem.li.dataset.focus;
      focused.li.dataset.focus = '';
      focusedItem = focused;
    }

    // Play a snap cue when a new stop comes into focus and movement settles.
    if (Math.abs(step) < 0.01 && velocity === 0) {
      if (focused && focused.stop.id !== lastSnappedId) {
        lastSnappedId = focused.stop.id;
        cue('snap');
      }
    }

    if (Math.abs(step) > 0.01 || velocity !== 0 || moving.size || items.some((i) => !textures.get(i.stop.src)?.loaded && Math.abs(i.cx - pos - width / 2) < width)) {
      raf = requestAnimationFrame(frame);
    } else {
      last = 0;
    }
  };

  function wake() {
    if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  // transitions.dev "Avatar group hover": lift the hovered stop, a falloff on its neighbours, a spring back.
  const root = getComputedStyle(document.documentElement);
  const num = (name: string, fallback: number) => {
    const v = parseFloat(root.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const curve = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  const setShifts = (active: number | null, phase: 'in' | 'out') => {
    const easing = phase === 'out' ? curve('--avatar-ease-out', 'cubic-bezier(0.34, 3.85, 0.64, 1)') : curve('--avatar-ease-in', 'cubic-bezier(0.22, 1, 0.36, 1)');
    items.forEach(({ btn }, i) => {
      btn.style.transitionTimingFunction = easing;
      if (active === null) {
        btn.style.setProperty('--shift', '0px');
        btn.style.setProperty('--scale-active', '1');
        return;
      }
      btn.style.setProperty('--shift', `${(num('--avatar-lift', -4) * Math.pow(num('--avatar-falloff', 0.45), Math.abs(i - active))).toFixed(3)}px`);
      btn.style.setProperty('--scale-active', i === active ? String(num('--avatar-scale', 1.05)) : '1');
    });
  };
  const hoverIn = items.map((_, i) => (event: PointerEvent) => event.pointerType === 'mouse' && setShifts(i, 'in'));
  const hoverOut = () => setShifts(null, 'out');
  items.forEach(({ btn }, i) => btn.addEventListener('pointerenter', hoverIn[i]!));
  track.addEventListener('pointerleave', hoverOut);

  const buttonOf = (event: Event) => (event.target as Element).closest<HTMLElement>('.stop-btn');
  const onRun = (event: TransitionEvent) => {
    const btn = buttonOf(event);
    if (btn && event.propertyName === 'transform' && items.some((i) => i.btn === btn)) {
      moving.set(btn, false);
      wake();
    }
  };
  const onEnd = (event: TransitionEvent) => {
    const btn = buttonOf(event);
    if (btn && moving.has(btn)) {
      moving.set(btn, true);
      wake();
    }
  };
  track.addEventListener('transitionrun', onRun);
  track.addEventListener('transitionend', onEnd);
  track.addEventListener('transitioncancel', onEnd);

  const scroller = track.closest<HTMLElement>('[data-path-scroller]');
  const onVisibility = () => wake();
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(stage);
  resizeObserver.observe(track);
  // A label that hydrates or swaps its font moves the art below it without resizing the stage.
  for (const { btn } of items) resizeObserver.observe(btn);
  document.fonts?.ready.then(() => alive && measure());
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) {
      last = 0;
      wake();
    }
  }, { rootMargin: '100px' });
  intersection.observe(stage);
  scroller?.addEventListener('scroll', wake, { passive: true });
  addEventListener('scroll', wake, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  section.setAttribute('data-gl', '');
  measure();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersection.disconnect();
    scroller?.removeEventListener('scroll', wake);
    removeEventListener('scroll', wake);
    document.removeEventListener('visibilitychange', onVisibility);
    track.removeEventListener('pointerleave', hoverOut);
    track.removeEventListener('transitionrun', onRun);
    track.removeEventListener('transitionend', onEnd);
    track.removeEventListener('transitioncancel', onEnd);
    items.forEach(({ btn }, i) => btn.removeEventListener('pointerenter', hoverIn[i]!));
    for (const { li, btn } of items) {
      delete li.dataset.gl;
      delete li.dataset.focus;
      li.style.removeProperty('transform');
      li.style.removeProperty('transform-origin');
      li.style.removeProperty('opacity');
      for (const prop of ['transform-origin', 'transition-timing-function', '--shift', '--scale-active']) btn.style.removeProperty(prop);
    }
    section.removeAttribute('data-gl');
    textures.forEach((entry) => entry.texture && gl.deleteTexture(entry.texture));
    gl.deleteProgram(program);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteBuffer(indexBuffer);
    gl.deleteVertexArray(vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
