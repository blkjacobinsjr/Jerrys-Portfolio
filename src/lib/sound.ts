import type { PlayOptions, SoundName } from 'cuelume';

type Cue = 'tick' | 'press' | 'release' | 'bloom' | 'sparkle' | 'tear' | 'crumple' | 'success' | 'draw' | 'snap' | 'drift' | 'data' | 'rewind' | 'keys' | 'mark';
type Lib = typeof import('cuelume');

// Our cue names, mapped to cuelume's fourteen. press and release are the two halves of one tap.
const PLAY: Record<Exclude<Cue, 'press' | 'release' | 'drift' | 'data' | 'rewind' | 'keys' | 'mark'>, [SoundName, PlayOptions]> = {
  tick: ['select', { emphasis: 'subtle' }],
  bloom: ['open', {}],
  sparkle: ['success', { emphasis: 'subtle' }],
  tear: ['close', { emphasis: 'strong' }],
  crumple: ['close', { emphasis: 'subtle' }],
  success: ['success', { emphasis: 'strong' }],
  draw: ['close', { emphasis: 'subtle' }],
  snap: ['select', { emphasis: 'subtle' }],
};

const KEY = 'sound';
const HOVER = '.dock-list a, .work-card, .stop-btn';
const BUTTON = 'button, [role="button"]';

let lib: Lib | undefined;
let muted = false;

let ctx: AudioContext | undefined;
const buffers = new Map<string, AudioBuffer>();

const SAMPLES: Partial<Record<Cue, string>> = { bloom: 'open', tear: 'close', drift: 'whoosh', data: 'data', rewind: 'rewind', keys: 'keys', mark: 'mark' };

const last = new Map<Cue, number>();
// Footer loops: wind follows pointer speed, the city ambience follows footer visibility.
let windSource: AudioBufferSourceNode | undefined;
let windGain: GainNode | undefined;
let windStill: ReturnType<typeof setTimeout> | undefined;
let citySource: AudioBufferSourceNode | undefined;
let cityGain: GainNode | undefined;
let lastMove: { x: number; y: number; t: number } | null = null;
let footerSeen = false;

const closest = (target: EventTarget | null, selector: string) => (target as Element | null)?.closest?.(selector) ?? null;

// Calls cue(name) only if enough time has passed since the last call.
function cueAtMost(name: Cue, ms: number) {
  const now = performance.now();
  if (now - (last.get(name) ?? -Infinity) >= ms) {
    last.set(name, now);
    cue(name);
  }
}

// Loads custom audio samples into Web Audio buffers.
async function loadSamples() {
  ctx ??= new AudioContext();
  const ext = new Audio().canPlayType('audio/webm; codecs=opus') ? 'webm' : 'm4a';
  const samplesToLoad = new Set(Object.values(SAMPLES));
  samplesToLoad.add('wind');
  samplesToLoad.add('city');

  // In parallel: the enter screen's whoosh must not wait behind the city loop.
  const audio = ctx;
  await Promise.all(
    [...samplesToLoad].map(async (name) => {
      try {
        const response = await fetch(`/sfx/${name}.${ext}`);
        if (!response.ok) return;
        buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()));
      } catch {
        // A missing or undecodable sample falls back to cuelume.
      }
    }),
  );
}

/** Play a cue. Silent until cuelume has loaded (after a first gesture) and when muted. */
export function cue(name: Cue) {
  if (!lib || muted) return;

  const sampleName = SAMPLES[name];
  if (sampleName && buffers.has(sampleName) && ctx) {
    const source = ctx.createBufferSource();
    source.buffer = buffers.get(sampleName)!;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.5;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    if (ctx.state === 'suspended') void ctx.resume();
    source.start(0);
    return;
  }

  if (name === 'press') {
    lib.press('tap');
  } else if (name === 'release') {
    lib.release('tap');
  } else {
    // Sample-only cues (drift, data, rewind, keys) stay silent until their file has loaded.
    const play = PLAY[name as keyof typeof PLAY] as [SoundName, PlayOptions] | undefined;
    if (play) lib.play(...play);
  }
}

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem(KEY, value ? 'off' : 'on');
  lib?.setEnabled(!value);
  if (ctx) {
    if (value) {
      void ctx.suspend();
    } else {
      void ctx.resume();
    }
  }
  ambience(footerSeen);
  globalThis.dispatchEvent?.(new Event('soundchange'));
}

// Controls the wind sound based on pointer speed.
export function wind(speed: number) {
  if (!ctx || muted || !buffers.has('wind')) return;

  if (!windSource) {
    windSource = ctx.createBufferSource();
    windSource.buffer = buffers.get('wind')!;
    windSource.loop = true;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start(0);
  }

  windGain!.gain.setTargetAtTime(Math.min(0.35, speed * 0.12), ctx.currentTime, 0.08);

  clearTimeout(windStill);
  windStill = setTimeout(() => windGain?.gain.setTargetAtTime(0, ctx!.currentTime, 0.25), 140);
}

// Controls the city ambience sound.
export function ambience(on: boolean) {
  const target = on && !muted ? 0.06 : 0;
  if (!ctx || !buffers.has('city') || (!citySource && !target)) return;

  if (!citySource) {
    citySource = ctx.createBufferSource();
    citySource.buffer = buffers.get('city')!;
    citySource.loop = true;
    cityGain = ctx.createGain();
    cityGain.gain.value = 0;
    citySource.connect(cityGain);
    cityGain.connect(ctx.destination);
    citySource.start(0);
  }

  cityGain!.gain.setTargetAtTime(target, ctx.currentTime, 0.6);
}

function bindUi(bound: Lib) {
  bound.bind();
  let down = false;
  addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || !closest(event.target, BUTTON)) return;
    down = true;
    cue('press');
  }, true);
  addEventListener('click', (event) => {
    if (!closest(event.target, BUTTON)) return;
    if (!down) cue('press');
    down = false;
    cue('release');
  }, true);
  addEventListener('pointerover', (event) => {
    const el = closest(event.target, HOVER);
    if (event.pointerType === 'mouse' && el && el !== closest(event.relatedTarget, HOVER)) cue('tick');
  }, true);

  // Play 'data' cue on pointerover of data-decrypt elements.
  addEventListener('pointerover', (event) => {
    if (event.pointerType === 'mouse') {
      const targetDecrypt = closest(event.target, '[data-decrypt]');
      const relatedDecrypt = closest(event.relatedTarget, '[data-decrypt]');
      if (targetDecrypt && targetDecrypt !== relatedDecrypt) cueAtMost('data', 90);
    }
  }, true);

  // Play 'keys' cue on pointerover of data-keyring elements.
  addEventListener('pointerover', (event) => {
    if (event.pointerType === 'mouse') {
      const targetKeyring = closest(event.target, '[data-keyring]');
      const relatedKeyring = closest(event.relatedTarget, '[data-keyring]');
      if (targetKeyring && targetKeyring !== relatedKeyring) cueAtMost('keys', 900);
    }
  }, true);

  // Scroll reversal detection.
  let lastY = -1;
  let runStart = 0;
  let goingDown = true;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (lastY < 0) lastY = runStart = y;
    if (y > lastY) {
      if (!goingDown) {
        goingDown = true;
        runStart = lastY;
      }
    } else if (y < lastY && goingDown) {
      goingDown = false;
      if (lastY - runStart > 600) cueAtMost('rewind', 1500);
    }
    lastY = y;
  }, { passive: true });

  // Footer wind sound based on pointer movement.
  addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !closest(event.target, 'footer')) {
      lastMove = null;
      return;
    }

    const now = performance.now();
    if (lastMove && now - lastMove.t < 100 && now > lastMove.t) {
      wind(Math.hypot(event.clientX - lastMove.x, event.clientY - lastMove.y) / (now - lastMove.t));
    }
    lastMove = { x: event.clientX, y: event.clientY, t: now };
  }, { passive: true });

  // City ambience based on footer visibility.
  const footer = document.querySelector('footer');
  if (footer && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(([entry]) => {
      footerSeen = entry.isIntersecting;
      ambience(footerSeen);
    }, { threshold: 0.1 });
    observer.observe(footer);
  }
}

/**
 * Called once on page load. Nothing audio-related loads until the first pointerdown or
 * keydown; then cuelume is imported and bound. The mute toggle works from the start.
 */
export function initSound() {
  muted = localStorage.getItem(KEY) === 'off';
  const toggle = document.querySelector<HTMLElement>('[data-sound-toggle]');
  const paint = () => {
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(!muted));
    const label = toggle.querySelector?.('[data-sound-label]') ?? toggle;
    label.textContent = muted ? 'Sound off' : 'Sound on';
    toggle.querySelector?.('.t-icon-swap')?.setAttribute('data-state', muted ? 'b' : 'a');
  };
  paint();
  toggle?.addEventListener('click', () => {
    setMuted(!muted);
    paint();
    if (!muted) void lib?.unlock();
  });

  // The signature's first stroke starting and last stroke finishing.
  addEventListener('animationstart', (event) => {
    const masks = document.querySelectorAll('[data-signature-mask]');
    if (event.target === masks[0]) cue('draw');
  }, true);
  addEventListener('animationend', (event) => {
    const masks = document.querySelectorAll('[data-signature-mask]');
    if (event.target === masks[masks.length - 1]) cue('sparkle');
  }, true);

  const load = () => {
    removeEventListener('pointerdown', load);
    removeEventListener('keydown', load);
    void loadLib();
  };
  addEventListener('pointerdown', load, { once: true, passive: true });
  addEventListener('keydown', load, { once: true, passive: true });
  addEventListener('soundchange', paint);
}

let loading: Promise<void> | undefined;

/** Import and bind cuelume, then decode the samples. Safe to call more than once. */
function loadLib() {
  loading ??= import('cuelume').then((loaded) => {
    lib = loaded;
    loaded.setEnabled(!muted);
    bindUi(loaded);
    return loadSamples().then(() => ambience(footerSeen));
  });
  return loading;
}

/**
 * The enter screen's choice (ENTER_SCREEN). With sound: `audio` is an AudioContext created inside the click, so
 * Safari counts it as unlocked; the whoosh plays as the screen dissolves. Without: muted, as the footer toggle does.
 */
export async function enter(withSound: boolean, audio?: AudioContext) {
  muted = localStorage.getItem(KEY) === 'off';
  if (!withSound) {
    setMuted(true);
    return;
  }
  if (audio) ctx ??= audio;
  setMuted(false);
  await loadLib();
  void lib?.unlock();
  cue('drift');
}
