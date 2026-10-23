import type { PlayOptions, SoundName } from 'cuelume';

type Cue = 'tick' | 'press' | 'release' | 'bloom' | 'sparkle' | 'tear' | 'crumple' | 'success' | 'draw' | 'snap' | 'drift';
type Lib = typeof import('cuelume');

// Our cue names, mapped to cuelume's fourteen. press and release are the two halves of one tap.
const PLAY: Record<Exclude<Cue, 'press' | 'release' | 'drift'>, [SoundName, PlayOptions]> = {
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

const SAMPLES: Partial<Record<Cue, string>> = { bloom: 'open', tear: 'close', drift: 'whoosh' };

const closest = (target: EventTarget | null, selector: string) => (target as Element | null)?.closest?.(selector) ?? null;

// Loads custom audio samples into Web Audio buffers.
async function loadSamples() {
  ctx = new AudioContext();
  const ext = new Audio().canPlayType('audio/webm; codecs=opus') ? 'webm' : 'mp3';
  for (const name of new Set(Object.values(SAMPLES))) {
    const url = `/sfx/${name}.${ext}`;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffers.set(name, audioBuffer);
    } catch {
      // A missing or undecodable sample falls back to cuelume.
    }
  }
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
  } else if (name === 'drift') {
    return;
  } else {
    lib.play(...PLAY[name]);
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
    toggle.textContent = muted ? 'Sound off' : 'Sound on';
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
    void import('cuelume').then((loaded) => {
      lib = loaded;
      loaded.setEnabled(!muted);
      bindUi(loaded);
      void loadSamples();
    });
  };
  addEventListener('pointerdown', load, { once: true, passive: true });
  addEventListener('keydown', load, { once: true, passive: true });
}
