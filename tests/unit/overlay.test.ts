import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInsideOverlay, lockScroll, LOCK_ATTR, onScrollLock, OVERLAY_ATTR } from '../../src/lib/overlay';

function fakeRoot() {
  const attrs = new Set<string>();
  return {
    attrs,
    root: {
      setAttribute: (name: string) => attrs.add(name),
      removeAttribute: (name: string) => attrs.delete(name),
    } as unknown as HTMLElement,
  };
}

function fakeWindow(x = 0, y = 0) {
  const win = { scrollX: x, scrollY: y, scrollTo: vi.fn((o: { left: number; top: number }) => Object.assign(win, { scrollX: o.left, scrollY: o.top })) };
  return win;
}

const node = (match: boolean) => ({ closest: vi.fn((selector: string) => (match ? { selector } : null)) });

describe('overlay contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recognises events that start inside an overlay or an open dialog', () => {
    const inside = node(true);
    expect(isInsideOverlay(inside as unknown as EventTarget)).toBe(true);
    expect(inside.closest).toHaveBeenCalledWith(`[${OVERLAY_ATTR}], dialog[open]`);
    expect(isInsideOverlay(node(false) as unknown as EventTarget)).toBe(false);
  });

  it('ignores targets that are not elements', () => {
    expect(isInsideOverlay(null)).toBe(false);
    expect(isInsideOverlay({} as EventTarget)).toBe(false);
    expect(isInsideOverlay({ closest: 'nope' } as unknown as EventTarget)).toBe(false);
  });

  it('locks the page, tells listeners, and puts the page back exactly where it was', () => {
    const { root, attrs } = fakeRoot();
    const win = fakeWindow(0, 1200);
    const heard: boolean[] = [];
    const off = onScrollLock((locked) => heard.push(locked));
    const unlock = lockScroll(root, win);
    expect(attrs.has(LOCK_ATTR)).toBe(true);
    expect(LOCK_ATTR).toBe('data-scroll-locked');
    expect(heard).toEqual([true]);
    win.scrollY = 40; // e.g. a focus jump behind the drawer
    unlock();
    expect(attrs.has(LOCK_ATTR)).toBe(false);
    expect(heard).toEqual([true, false]);
    expect(win.scrollTo).toHaveBeenCalledWith({ left: 0, top: 1200, behavior: 'instant' });
    off();
  });

  it('a listener that throws never strands the lock: the others still hear it, and unlock still restores', async () => {
    const { root, attrs } = fakeRoot();
    const win = fakeWindow(0, 900);
    const heard: boolean[] = [];
    const thrown: unknown[] = [];
    const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((fn) => {
      try {
        fn();
      } catch (error) {
        thrown.push(error);
      }
    });
    const offBad = onScrollLock(() => {
      throw new Error('listener broke');
    });
    const off = onScrollLock((locked) => heard.push(locked));
    const unlock = lockScroll(root, win);
    expect(attrs.has(LOCK_ATTR)).toBe(true);
    expect(heard).toEqual([true]);
    win.scrollY = 10;
    unlock();
    expect(attrs.has(LOCK_ATTR)).toBe(false);
    expect(heard).toEqual([true, false]);
    expect(win.scrollTo).toHaveBeenCalledWith({ left: 0, top: 900, behavior: 'instant' });
    // The error is still reported, just outside the lock.
    expect(thrown).toHaveLength(2);
    expect((thrown[0] as Error).message).toBe('listener broke');
    spy.mockRestore();
    offBad();
    off();
  });

  it('restores the horizontal offset too', () => {
    const { root } = fakeRoot();
    const win = fakeWindow(30, 500);
    const unlock = lockScroll(root, win);
    win.scrollX = 0;
    unlock();
    expect(win.scrollTo).toHaveBeenCalledWith({ left: 30, top: 500, behavior: 'instant' });
  });

  it('does not jump when the page never moved', () => {
    const { root } = fakeRoot();
    const win = fakeWindow(0, 800);
    lockScroll(root, win)();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('nests: the page unlocks only when the last overlay closes, and unlock is idempotent', () => {
    const { root, attrs } = fakeRoot();
    const win = fakeWindow();
    const heard: boolean[] = [];
    const off = onScrollLock((locked) => heard.push(locked));
    const first = lockScroll(root, win);
    const second = lockScroll(root, win);
    expect(heard).toEqual([true]);
    first();
    first();
    expect(attrs.has(LOCK_ATTR)).toBe(true);
    second();
    expect(attrs.has(LOCK_ATTR)).toBe(false);
    expect(heard).toEqual([true, false]);
    second();
    expect(heard).toEqual([true, false]);
    const third = lockScroll(root, win);
    expect(attrs.has(LOCK_ATTR)).toBe(true);
    third();
    off();
  });

  it('stops telling a listener once it unsubscribes', () => {
    const { root } = fakeRoot();
    const heard: boolean[] = [];
    onScrollLock((locked) => heard.push(locked))();
    lockScroll(root, fakeWindow())();
    expect(heard).toEqual([]);
  });

  it('locks the real document by default', () => {
    const { root, attrs } = fakeRoot();
    const win = fakeWindow(0, 10);
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', win);
    const unlock = lockScroll();
    expect(attrs.has(LOCK_ATTR)).toBe(true);
    unlock();
    expect(attrs.has(LOCK_ATTR)).toBe(false);
  });
});

describe('every overlay uses the shared Drawer', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  const source = files('src').filter((f) => /\.(tsx?|astro|css)$/.test(f));

  it('opens sheets, dialogs and modals only through components/Drawer.tsx', () => {
    const offenders = source.filter(
      (f) => !f.endsWith('.css') && !f.endsWith('components/Drawer.tsx') && /Sheet\.Root|Sheet\.Content|<dialog|showModal\(|role=["']dialog/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('adds no new fixed-position layers outside the known, non-scrolling dock', () => {
    // A fixed layer that holds content is an overlay: build it with Drawer instead.
    const fixed = source.filter((f) => /position:\s*fixed/.test(readFileSync(f, 'utf8')));
    expect(fixed.map((f) => f.replace(/\\/g, '/'))).toEqual(['src/components/Dock.css']);
  });
});
