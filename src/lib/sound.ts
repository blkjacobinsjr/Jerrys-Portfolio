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
  music();
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
      music();
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

let imported: Promise<Lib> | undefined;
const importLib = () => (imported ??= import('cuelume').then((loaded) => (lib = loaded)));

/** Import and bind cuelume, then decode the samples. Safe to call more than once. */
function loadLib() {
  loading ??= importLib().then((loaded) => {
    loaded.setEnabled(!muted);
    bindUi(loaded);
    return loadSamples().then(() => ambience(footerSeen));
  });
  return loading;
}

// The enter screen's own sounds (ElevenLabs, see public/sfx/README.md): fetched on intent (hover or focus on
// 'Enter with sound'), decoded in the click. The jazz loop is fetched only after the click.
const ext = () => (new Audio().canPlayType('audio/webm; codecs=opus') ? 'webm' : 'm4a');
let enterBuffers: Promise<(AudioBuffer | undefined)[]> | undefined;
let enterReady: (AudioBuffer | undefined)[] | undefined;
/** Fetches and decodes the click's two sounds on intent. An OfflineAudioContext decodes without a gesture or a
 * console warning, and AudioBuffers play in any context, so the click itself only schedules them. */
export function preloadEnter() {
  // Cuelume too (9 kB), so the click can unlock it and play its tap inside the gesture, as its docs ask.
  void importLib().catch(() => undefined);
  enterBuffers ??= (async () => {
    const offline = new OfflineAudioContext(1, 1, 48000);
    return Promise.all(['drop', 'enter'].map(async (n) => {
      try {
        return await offline.decodeAudioData(await (await fetch(`/sfx/${n}.${ext()}`)).arrayBuffer());
      } catch {
        return undefined;
      }
    }));
  })().catch(() => [undefined, undefined]).then((b) => (enterReady = b));
  return enterBuffers;
}

/** Plays a decoded buffer `at` seconds from now at `gain`. */
function shot(buffer: AudioBuffer, at: number, gain: number) {
  const source = ctx!.createBufferSource();
  source.buffer = buffer;
  const g = ctx!.createGain();
  g.gain.value = gain;
  source.connect(g);
  g.connect(ctx!.destination);
  source.start(ctx!.currentTime + at);
}

// The music bed: a seamless 28.5 s loop at -18 LUFS, faded in under the swell, at a low bed level. It follows
// the mute toggle, fades out while the tab is hidden, and ducks under the footer's city ambience.
const BED = 0.32;
let musicGain: GainNode | undefined;
let setDone = false;
const musicLevel = () => (setDone || muted || document.hidden ? 0 : footerSeen ? BED * 0.35 : BED);
function music() {
  if (!musicGain || !ctx) return;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setTargetAtTime(musicLevel(), ctx.currentTime, setDone ? 2.7 : muted || document.hidden ? 0.25 : 1.2);
}
async function startMusic() {
  if (!ctx || musicGain) return;
  const audio = ctx;
  musicGain = audio.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(audio.destination);
  try {
    const buffer = await audio.decodeAudioData(await (await fetch(`/sfx/jazz.${ext()}`)).arrayBuffer());
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // The AAC file decodes 64 samples (1.3 ms) of frame padding past the 28.5 s loop; loop on the music only.
    source.loopEnd = Math.min(buffer.duration, 28.5);
    source.connect(musicGain);
    source.start();
    // Fade in over ~4 s (time constant 1.2 s) once the swell has peaked. Three passes (~85 s) make one set; then
    // it fades out over ~8 s and stays off, so the loop never wears thin and the city ambience is left alone.
    musicGain.gain.setTargetAtTime(musicLevel(), audio.currentTime + 0.6, 1.2);
    setTimeout(() => {
      setDone = true;
      music();
      setTimeout(() => source.stop(), 12_000);
    }, buffer.duration * 3 * 1000 - 8000);
  } catch {
    // No music; the cues still work.
  }
  addEventListener('visibilitychange', music);
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
  ctx ??= new AudioContext();
  setMuted(false);
  // The click's own sounds first, before the other samples: Cuelume's tap and the oil drop under the finger, then the
  // air swell as the Berlin shot rises (its peak lands ~0.55 s in, mid-way through the 1.1 s rise).
  // Already decoded on intent: schedule synchronously, inside the click, before the page's own leave work runs.
  const decoded = enterReady ?? (await preloadEnter());
  if (ctx.state === 'suspended') void ctx.resume();
  // Cuelume owns the button's UI cue (a primary button is `tap`, per its docs); ElevenLabs owns the scene.
  const warm = lib;
  if (warm) {
    warm.setEnabled(true);
    void warm.unlock();
    warm.play('tap');
  }
  if (decoded[0]) shot(decoded[0], 0, 0.9);
  if (decoded[1]) shot(decoded[1], 0.06, 0.8);
  else cue('drift');
  void startMusic();
  await loadLib();
  if (!warm) void lib?.unlock();
}
