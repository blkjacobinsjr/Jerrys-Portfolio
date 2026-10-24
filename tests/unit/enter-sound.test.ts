import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = { bind: vi.fn(), play: vi.fn(), press: vi.fn(), release: vi.fn(), setEnabled: vi.fn(), unlock: vi.fn(() => Promise.resolve()) };
vi.mock('cuelume', () => lib);

// The enter screen's sounds: decoded on intent, scheduled inside the click, then the music bed.
const gain = () => ({ gain: { value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn() });
const source = () => ({ buffer: null as unknown, loop: false, loopEnd: 0, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
let ctx: ReturnType<typeof makeCtx>;
function makeCtx(state = 'running', decode: () => Promise<unknown> = () => Promise.resolve({ duration: 28.6 })) {
  const gains: ReturnType<typeof gain>[] = [];
  const sources: ReturnType<typeof source>[] = [];
  return {
    gains, sources, state, currentTime: 0, destination: {},
    createGain: vi.fn(() => { const g = gain(); gains.push(g); return g; }),
    createBufferSource: vi.fn(() => { const s = source(); sources.push(s); return s; }),
    decodeAudioData: vi.fn(decode),
    resume: vi.fn(() => Promise.resolve()),
  };
}

let handlers: Map<string, (() => void)[]>;
let store: Map<string, string>;
let doc: { hidden: boolean; querySelector: () => null; querySelectorAll: () => never[]; addEventListener: () => void };
function stub({ opus = true, offline = true, fetchFails = false } = {}) {
  handlers = new Map();
  store = new Map();
  doc = { hidden: false, querySelector: () => null, querySelectorAll: () => [], addEventListener: vi.fn() };
  vi.stubGlobal('addEventListener', (t: string, fn: () => void) => handlers.set(t, [...(handlers.get(t) ?? []), fn]));
  vi.stubGlobal('removeEventListener', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Audio', vi.fn(function () { return { canPlayType: () => (opus ? 'probably' : '') }; }));
  vi.stubGlobal('fetch', vi.fn((url: string) => (fetchFails ? Promise.reject(new Error(url)) : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }))));
  vi.stubGlobal('OfflineAudioContext', vi.fn(function () {
    if (!offline) throw new Error('no offline');
    return { decodeAudioData: () => Promise.resolve({ duration: 1 }) };
  }));
  vi.stubGlobal('AudioContext', vi.fn(function () { return ctx; }));
}

describe('enter screen sounds', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    ctx = makeCtx();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('preloads drop and enter once (webm when opus plays), and Cuelume with them', async () => {
    stub();
    const sound = await import('../../src/lib/sound');
    const first = sound.preloadEnter();
    expect(sound.preloadEnter()).toBe(first);
    expect(await first).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toEqual(['/sfx/drop.webm', '/sfx/enter.webm']);
  });

  it('with sound: tap, drop and swell inside the click, then the jazz bed fades in and out after three passes', async () => {
    stub({ opus: false });
    ctx = makeCtx('suspended');
    const sound = await import('../../src/lib/sound');
    await sound.preloadEnter();
    await vi.dynamicImportSettled();
    await sound.enter(true);
    await vi.waitFor(() => expect(ctx.sources.length).toBe(3));
    expect(ctx.resume).toHaveBeenCalled();
    expect(lib.play).toHaveBeenCalledWith('tap');
    expect(store.get('sound')).toBe('on');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/sfx/jazz.m4a');
    const bed = ctx.sources[2];
    expect(bed.loop).toBe(true);
    expect(bed.loopEnd).toBe(28.5);
    const level = ctx.gains[2].gain;
    expect(level.setTargetAtTime).toHaveBeenLastCalledWith(0.32, 0.6, 1.2);
    doc.hidden = true;
    handlers.get('visibilitychange')!.forEach((fn) => fn());
    expect(level.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.25);
    doc.hidden = false;
    handlers.get('visibilitychange')!.forEach((fn) => fn());
    expect(level.setTargetAtTime).toHaveBeenLastCalledWith(0.32, 0, 1.2);
    vi.advanceTimersByTime(28.6 * 3 * 1000 - 8000);
    expect(level.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 2.7);
    vi.advanceTimersByTime(12_000);
    expect(bed.stop).toHaveBeenCalled();
  });

  it('decodes in the click when not preloaded; missing swell falls back to drift; no music if it fails', async () => {
    stub({ offline: false });
    ctx = makeCtx('running', () => Promise.reject(new Error('bad')));
    const sound = await import('../../src/lib/sound');
    await sound.enter(true, ctx as unknown as AudioContext);
    expect(ctx.sources).toHaveLength(0);
    expect(lib.unlock).toHaveBeenCalled();
    await sound.enter(true);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it('a failed fetch or a missing Cuelume leaves the click silent, and leaving the page aborts the sample loads', async () => {
    stub({ fetchFails: true });
    vi.doMock('cuelume', () => Promise.reject(new Error('offline')));
    const sound = await import('../../src/lib/sound');
    expect(await sound.preloadEnter()).toEqual([undefined, undefined]);
    vi.doUnmock('cuelume');
    stub();
    vi.resetModules();
    const fresh = await import('../../src/lib/sound');
    await fresh.enter(true);
    await vi.waitFor(() => expect(handlers.get('pagehide')).toBeDefined());
    const signal = vi.mocked(fetch).mock.calls.map((c) => (c as unknown[])[1] as { signal?: AbortSignal } | undefined).find((o) => o?.signal)?.signal;
    handlers.get('pagehide')!.forEach((fn) => fn());
    expect(signal?.aborted).toBe(true);
  });

  it('without sound: muted, nothing fetched', async () => {
    stub();
    const sound = await import('../../src/lib/sound');
    await sound.enter(false);
    expect(store.get('sound')).toBe('off');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('flagState', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('true is on, false is off, preview needs its query except in Vercel production', async () => {
    const { flagState } = await import('../../src/data/site');
    expect(flagState(true)).toBe('on');
    expect(flagState(false)).toBe('off');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(flagState('preview')).toBe('query');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(flagState('preview')).toBe('off');
  });
});
