import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = { bind: vi.fn(), play: vi.fn(), press: vi.fn(), release: vi.fn(), setEnabled: vi.fn(), unlock: vi.fn() };
vi.mock('cuelume', () => lib);

type Handler = (event: unknown) => void;

function setup({ stored = null, reduced = false, toggle = true }: { stored?: string | null; reduced?: boolean; toggle?: boolean } = {}) {
  const handlers = new Map<string, Handler[]>();
  const store = new Map<string, string>(stored ? [['sound', stored]] : []);
  const button = { setAttribute: vi.fn(), textContent: '', addEventListener: (_: string, fn: Handler) => handlers.set('toggle', [fn]) };
  const masks = [{ id: 'a' }, { id: 'b' }];
  vi.stubGlobal('addEventListener', (type: string, fn: Handler) => handlers.set(type, [...(handlers.get(type) ?? []), fn]));
  vi.stubGlobal('removeEventListener', (type: string) => handlers.delete(type));
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  vi.stubGlobal('document', { querySelector: () => (toggle ? button : null), querySelectorAll: () => masks });
  const fire = (type: string, event: unknown = {}) => handlers.get(type)?.forEach((fn) => fn(event));
  return { handlers, store, button, masks, fire };
}

const hit = (selectors: string[]) => ({ closest: (s: string) => (selectors.includes(s) ? {} : null) });
const BUTTON = 'button, [role="button"]';
const HOVER = '.dock-list a, .work-card, .stop-btn';

describe('sound', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const loaded = async (opts?: Parameters<typeof setup>[0]) => {
    const env = setup(opts);
    const sound = await import('../../src/lib/sound');
    sound.initSound();
    return { ...env, sound };
  };
  const unlockAudio = async (env: Awaited<ReturnType<typeof loaded>>) => {
    env.fire('keydown');
    await vi.dynamicImportSettled();
  };

  it('does nothing audible before a gesture', async () => {
    const { sound } = await loaded();
    sound.cue('bloom');
    expect(lib.play).not.toHaveBeenCalled();
    expect(lib.bind).not.toHaveBeenCalled();
  });

  it('loads and binds cuelume once, on the first pointerdown or key', async () => {
    const env = await loaded();
    await unlockAudio(env);
    expect(lib.bind).toHaveBeenCalledTimes(1);
    expect(lib.setEnabled).toHaveBeenCalledWith(true);
    expect(env.handlers.has('keydown')).toBe(false);
    expect(env.handlers.has('pointerdown')).toBe(true); // the button listener replaces the loader
  });

  it('plays mapped cues, and respects mute, storage and reduced motion', async () => {
    const env = await loaded();
    await unlockAudio(env);
    env.sound.cue('bloom');
    env.sound.cue('tear');
    expect(lib.play).toHaveBeenNthCalledWith(1, 'open', {});
    expect(lib.play).toHaveBeenNthCalledWith(2, 'close', { emphasis: 'strong' });
    env.sound.cue('press');
    env.sound.cue('release');
    expect(lib.press).toHaveBeenCalledWith('tap');
    expect(lib.release).toHaveBeenCalledWith('tap');
    env.sound.setMuted(true);
    expect(env.sound.isMuted()).toBe(true);
    expect(env.store.get('sound')).toBe('off');
    expect(lib.setEnabled).toHaveBeenLastCalledWith(false);
    env.sound.cue('bloom');
    expect(lib.play).toHaveBeenCalledTimes(2);
  });

  it('plays cues even under reduced motion', async () => {
    const env = await loaded({ reduced: true });
    await unlockAudio(env);
    env.sound.cue('bloom');
    expect(lib.play).toHaveBeenCalledWith('open', {});
  });

  it('starts muted from storage and toggles from the footer button', async () => {
    const env = await loaded({ stored: 'off' });
    expect(env.sound.isMuted()).toBe(true);
    expect(env.button.textContent).toBe('Sound off');
    env.fire('toggle');
    expect(env.sound.isMuted()).toBe(false);
    expect(env.button.textContent).toBe('Sound on');
    expect(env.button.setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
    await unlockAudio(env);
    env.fire('toggle'); // mute
    env.fire('toggle'); // unmute, audio already loaded
    expect(lib.unlock).toHaveBeenCalledTimes(1);
  });

  it('works without a toggle on the page', async () => {
    const env = await loaded({ toggle: false });
    expect(env.sound.isMuted()).toBe(false);
  });

  it('presses on mouse down and releases on click; other inputs press and release on click', async () => {
    const env = await loaded();
    await unlockAudio(env);
    env.fire('pointerdown', { pointerType: 'mouse', target: hit([BUTTON]) });
    env.fire('click', { target: hit([BUTTON]) });
    expect(lib.press).toHaveBeenCalledTimes(1);
    expect(lib.release).toHaveBeenCalledTimes(1);
    env.fire('pointerdown', { pointerType: 'touch', target: hit([BUTTON]) });
    env.fire('pointerdown', { pointerType: 'mouse', target: hit([]) });
    env.fire('click', { target: hit([]) });
    expect(lib.press).toHaveBeenCalledTimes(1);
    env.fire('click', { target: hit([BUTTON]) });
    expect(lib.press).toHaveBeenCalledTimes(2);
    expect(lib.release).toHaveBeenCalledTimes(2);
    env.fire('click', { target: null });
    expect(lib.release).toHaveBeenCalledTimes(2);
  });

  it('ticks when a mouse enters nav or a project, not when moving within it', async () => {
    const env = await loaded();
    await unlockAudio(env);
    env.fire('pointerover', { pointerType: 'mouse', target: hit([HOVER]), relatedTarget: null });
    expect(lib.play).toHaveBeenCalledWith('select', { emphasis: 'subtle' });
    const same = hit([HOVER]);
    const inner = { closest: () => same };
    env.fire('pointerover', { pointerType: 'mouse', target: inner, relatedTarget: inner });
    env.fire('pointerover', { pointerType: 'touch', target: hit([HOVER]), relatedTarget: null });
    env.fire('pointerover', { pointerType: 'mouse', target: hit([]), relatedTarget: null });
    expect(lib.play).toHaveBeenCalledTimes(1);
  });

  it('draws when the first signature stroke starts', async () => {
    const env = await loaded();
    await unlockAudio(env);
    env.fire('animationstart', { target: env.masks[0] });
    expect(lib.play).toHaveBeenCalledWith('close', { emphasis: 'subtle' });
  });

  it('sparkles when the last signature stroke ends', async () => {
    const env = await loaded();
    await unlockAudio(env);
    env.fire('animationend', { target: env.masks[0] });
    expect(lib.play).not.toHaveBeenCalled();
    env.fire('animationend', { target: env.masks[1] });
    expect(lib.play).toHaveBeenCalledWith('success', { emphasis: 'subtle' });
  });
});
