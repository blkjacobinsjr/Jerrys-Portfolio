import type { PlayOptions, SoundName } from 'cuelume';

type Cue = 'tick' | 'press' | 'release' | 'bloom' | 'sparkle' | 'tear' | 'crumple' | 'success';
type Lib = typeof import('cuelume');

// Our cue names, mapped to cuelume's fourteen. press and release are the two halves of one tap.
const PLAY: Record<Exclude<Cue, 'press' | 'release'>, [SoundName, PlayOptions]> = {
  tick: ['select', { emphasis: 'subtle' }],
  bloom: ['open', {}],
  sparkle: ['success', { emphasis: 'subtle' }],
  tear: ['close', { emphasis: 'strong' }],
  crumple: ['close', { emphasis: 'subtle' }],
  success: ['success', { emphasis: 'strong' }],
};

const KEY = 'sound';
const HOVER = '.dock-list a, .work-card, .stop-btn';
const BUTTON = 'button, [role="button"]';

let lib: Lib | undefined;
let muted = false;

const closest = (target: EventTarget | null, selector: string) => (target as Element | null)?.closest?.(selector) ?? null;

/** Play a cue. Silent until cuelume has loaded (after a first gesture), when muted, and under reduced motion. */
export function cue(name: Cue) {
  if (!lib || muted || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (name === 'press') lib.press('tap');
  else if (name === 'release') lib.release('tap');
  else lib.play(...PLAY[name]);
}

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem(KEY, value ? 'off' : 'on');
  lib?.setEnabled(!value);
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

  // The signature's last stroke finishing.
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
    });
  };
  addEventListener('pointerdown', load, { once: true, passive: true });
  addEventListener('keydown', load, { once: true, passive: true });
}
