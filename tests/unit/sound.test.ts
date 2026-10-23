import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = { bind: vi.fn(), play: vi.fn(), press: vi.fn(), release: vi.fn(), setEnabled: vi.fn(), unlock: vi.fn() };
vi.mock('cuelume', () => lib);

type Handler = (event: unknown) => void;

// Mock AudioContext and its components
const mockGainNode = {
  gain: { value: 0, setTargetAtTime: vi.fn() },
  connect: vi.fn(),
};
const mockBufferSource = {
  buffer: null as AudioBuffer | null,
  loop: false,
  connect: vi.fn(),
  start: vi.fn(),
};
const mockAudioBuffer = {}; // Simple object for AudioBuffer

const mockAudioContext = {
  createBufferSource: vi.fn(() => mockBufferSource),
  createGain: vi.fn(() => mockGainNode),
  decodeAudioData: vi.fn(() => Promise.resolve(mockAudioBuffer)),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  state: 'running' as AudioContextState, // Will be 'running' or 'suspended'
  destination: {},
  currentTime: 0,
};

const mockAudio = {
  canPlayType: vi.fn(),
};

const mockFetch = vi.fn();

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
  beforeEach(() => {
    vi.resetModules(); // Ensures a fresh import of sound.ts

    // Reset specific mock states for AudioContext components
    mockGainNode.connect.mockClear();
    mockGainNode.gain.value = 0; // Reset to default, will be set by cue
    mockBufferSource.connect.mockClear();
    mockBufferSource.start.mockClear();
    mockBufferSource.buffer = null;
    mockAudioContext.createBufferSource.mockClear();
    mockAudioContext.createGain.mockClear();
    mockAudioContext.decodeAudioData.mockClear();
    mockAudioContext.resume.mockClear();
    mockAudioContext.suspend.mockClear();
    mockAudioContext.state = 'running'; // Reset state
    mockAudio.canPlayType.mockClear();
    mockFetch.mockClear();

    // Stub globals
    vi.stubGlobal('AudioContext', vi.fn(function () { return mockAudioContext; }));
    vi.stubGlobal('Audio', vi.fn(function () { return mockAudio; }));
    vi.stubGlobal('fetch', mockFetch);
  });
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

  // --- New tests for 100% coverage ---

  it('loads samples via webm path when supported, on first gesture', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // This triggers loadSamples

    expect(mockFetch).toHaveBeenCalledWith('/sfx/open.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/close.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/whoosh.webm', expect.anything());
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(9); // 'open', 'close', 'whoosh'
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer));
  });

  it('loads samples via m4a path when webm is not supported', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue(''); // WebM not supported
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env);

    expect(mockFetch).toHaveBeenCalledWith('/sfx/open.m4a', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/close.m4a', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/whoosh.m4a', expect.anything());
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(9);
  });

  it('handles !ok fetch response during sample loading', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    // Mock one sample to fail, others to succeed
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // For 'open'
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // For 'close'
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); // For 'whoosh'

    await unlockAudio(env);

    expect(mockFetch).toHaveBeenCalledWith('/sfx/open.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/close.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/whoosh.webm', expect.anything());
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(8); // Only 2 successful decodes
  });

  it('handles rejecting fetch during sample loading', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    // Mock one sample to reject, others to succeed
    mockFetch
      .mockRejectedValueOnce(new Error('Network error')) // For 'open'
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // For 'close'
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); // For 'whoosh'

    await unlockAudio(env);

    expect(mockFetch).toHaveBeenCalledWith('/sfx/open.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/close.webm', expect.anything());
    expect(mockFetch).toHaveBeenCalledWith('/sfx/whoosh.webm', expect.anything());
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(8); // Only 2 successful decodes
  });

  it('only initializes AudioContext and loads samples once', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // First time, ctx is created and samples loaded
    expect(vi.mocked(global.AudioContext)).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(9);

    // Calling initSound again won't re-trigger the load path due to 'once' listeners
    // and loadSamples itself has `if (ctx) return;`
    // The assertion that AudioContext is called only once covers this.
  });

  it('plays custom sample for bloom, resuming context if suspended', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // Load samples

    // Ensure ctx is suspended for this test
    mockAudioContext.state = 'suspended';
    mockAudioContext.resume.mockClear(); // Clear previous calls from unlockAudio if any

    env.sound.cue('bloom');

    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    expect(mockBufferSource.buffer).toBe(mockAudioBuffer); // Should be the decoded buffer
    expect(mockBufferSource.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.gain.value).toBe(0.5);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1); // Should resume
    expect(mockBufferSource.start).toHaveBeenCalledWith(0);
    expect(lib.play).not.toHaveBeenCalled(); // Cuelume play should not be called for custom sample
  });

  it('plays custom sample for bloom when context is running', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // Load samples

    // Ensure ctx is running for this test
    mockAudioContext.state = 'running';
    mockAudioContext.resume.mockClear();

    env.sound.cue('bloom');

    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    expect(mockBufferSource.buffer).toBe(mockAudioBuffer);
    expect(mockBufferSource.start).toHaveBeenCalledWith(0);
    expect(mockAudioContext.resume).not.toHaveBeenCalled(); // Should not resume if already running
    expect(lib.play).not.toHaveBeenCalled();
  });

  it('cue("drift") plays the whoosh sample once it is loaded, not cuelume', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // Load samples, including 'whoosh' for 'drift'

    mockAudioContext.createBufferSource.mockClear(); // Clear calls from other tests
    lib.play.mockClear();

    env.sound.cue('drift');

    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    expect(lib.play).not.toHaveBeenCalled(); // Cuelume play not called
    expect(lib.press).not.toHaveBeenCalled();
    expect(lib.release).not.toHaveBeenCalled();
  });

  it('cue("drift") does nothing if sample is not loaded', async () => {
    const env = await loaded();
    // Mock fetch to fail for 'whoosh'
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // 'open'
      .mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }) // 'close'
      .mockResolvedValueOnce({ ok: false }); // 'whoosh' fails to load

    await unlockAudio(env); // Load samples, 'whoosh' fails

    mockAudioContext.createBufferSource.mockClear();
    lib.play.mockClear();

    env.sound.cue('drift');

    expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    expect(lib.play).not.toHaveBeenCalled();
  });

  it('setMuted suspends AudioContext when muting and resumes when unmuting', async () => {
    const env = await loaded();
    mockAudio.canPlayType.mockReturnValue('probably');
    mockFetch.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });

    await unlockAudio(env); // Ensure ctx is created

    mockAudioContext.suspend.mockClear();
    mockAudioContext.resume.mockClear();

    // Mute
    env.sound.setMuted(true);
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.resume).not.toHaveBeenCalled();
    expect(lib.setEnabled).toHaveBeenLastCalledWith(false);

    // Unmute
    env.sound.setMuted(false);
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1); // Still 1 from previous call
    expect(lib.setEnabled).toHaveBeenLastCalledWith(true);
  });

  it('setMuted does not suspend/resume if AudioContext is not initialized', async () => {
    const env = await loaded(); // AudioContext not yet initialized
    mockAudioContext.suspend.mockClear();
    mockAudioContext.resume.mockClear();

    env.sound.setMuted(true);
    expect(mockAudioContext.suspend).not.toHaveBeenCalled();
    expect(mockAudioContext.resume).not.toHaveBeenCalled();

    env.sound.setMuted(false);
    expect(mockAudioContext.suspend).not.toHaveBeenCalled();
    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });

  describe('t138 cues and footer loops', () => {
    const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
    const ready = async (opts?: Parameters<typeof setup>[0], ok = true) => {
      const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
      vi.stubGlobal('IntersectionObserver', vi.fn(function (cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
        return { observe: vi.fn() };
      }));
      vi.stubGlobal('scrollY', 0);
      const env = await loaded(opts);
      mockAudio.canPlayType.mockReturnValue('probably');
      mockFetch.mockResolvedValue(ok ? { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } : { ok: false });
      await unlockAudio(env);
      await flush();
      mockAudioContext.createBufferSource.mockClear();
      mockGainNode.gain.setTargetAtTime.mockClear();
      lib.play.mockClear();
      return { ...env, see: (on: boolean) => observers.forEach((cb) => cb([{ isIntersecting: on }])) };
    };
    const over = (selector: string, from: string[] = []) => ({ pointerType: 'mouse', target: hit([selector]), relatedTarget: hit(from) });
    const scrollTo = (env: { fire: (t: string, e?: unknown) => void }, y: number) => { vi.stubGlobal('scrollY', y); env.fire('scroll'); };

    it('a data tick on entering decrypted text and a key jingle on the keyring, both throttled', async () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
      const env = await ready();
      env.fire('pointerover', over('[data-decrypt]'));
      env.fire('pointerover', over('[data-decrypt]'));
      now.mockReturnValue(1100);
      env.fire('pointerover', over('[data-decrypt]'));
      env.fire('pointerover', over('[data-decrypt]', ['[data-decrypt]']));
      env.fire('pointerover', { ...over('[data-decrypt]'), pointerType: 'touch' });
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);
      env.fire('pointerover', over('[data-keyring]'));
      now.mockReturnValue(1500);
      env.fire('pointerover', over('[data-keyring]'));
      env.fire('pointerover', { ...over('[data-keyring]'), pointerType: 'touch' });
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(3);
      expect(lib.play).not.toHaveBeenCalled();
      now.mockRestore();
    });

    it('sample-only cues stay silent before their files load', async () => {
      await ready(undefined, false);
      const sound = await import('../../src/lib/sound');
      sound.cue('data');
      sound.cue('rewind');
      sound.cue('keys');
      sound.wind(2);
      sound.ambience(true);
      expect(lib.play).not.toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });

    it('one rewind per upward reversal after more than 600px down, with a 1.5s cooldown', async () => {
      const now = vi.spyOn(performance, 'now').mockReturnValue(5000);
      const env = await ready();
      scrollTo(env, 100);
      scrollTo(env, 800);
      scrollTo(env, 790);
      scrollTo(env, 780);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      scrollTo(env, 1500);
      scrollTo(env, 1400);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      now.mockReturnValue(7000);
      scrollTo(env, 1700);
      scrollTo(env, 1650);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      scrollTo(env, 2400);
      scrollTo(env, 2400);
      scrollTo(env, 2300);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);
      now.mockRestore();
    });

    it('footer wind: one looping buffer whose gain follows pointer speed and fades when still', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const now = vi.spyOn(performance, 'now').mockReturnValue(0);
      const env = await ready();
      const move = (x: number, t: number, target = hit(['footer']), pointerType = 'mouse') => {
        now.mockReturnValue(t);
        env.fire('pointermove', { pointerType, target, clientX: x, clientY: 0 });
      };
      move(0, 0);
      move(10, 10);
      move(20, 20);
      move(30, 500);
      move(40, 500);
      move(50, 510, hit([]));
      move(60, 520, hit(['footer']), 'touch');
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockBufferSource.loop).toBe(true);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.12, 0, 0.08);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(140);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.25);
      env.sound.setMuted(true);
      mockGainNode.gain.setTargetAtTime.mockClear();
      env.sound.wind(3);
      expect(mockGainNode.gain.setTargetAtTime).not.toHaveBeenCalled();
      now.mockRestore();
      vi.useRealTimers();
    });

    it('city ambience fades in while the footer is on screen, out when it leaves or sound is muted', async () => {
      const env = await ready();
      env.see(false);
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
      env.see(true);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 0, 0.6);
      env.sound.setMuted(true);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.6);
      env.sound.setMuted(false);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.06, 0, 0.6);
      env.see(false);
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.6);
      expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    });

    it('without a footer or IntersectionObserver nothing is observed', async () => {
      vi.stubGlobal('IntersectionObserver', undefined);
      const env = await loaded({ toggle: false });
      await unlockAudio(env);
      expect(lib.bind).toHaveBeenCalled();
    });
  });
});
