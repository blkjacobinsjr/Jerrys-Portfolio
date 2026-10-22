// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mailto, TOPICS } from '../../src/lib/letter';
import { canUseGL, glAllowed, probeWebGL2 } from '../../src/lib/gl';

const decode = (url: string) => {
  const [to, query] = url.split('?');
  const params = new URLSearchParams(query);
  return { to, subject: params.get('subject'), body: params.get('body') };
};

describe('the /contact letter', () => {
  it('offers the three reasons to write', () => {
    expect(TOPICS).toEqual(['A new product', 'Consultancy', 'Just a hello']);
  });

  it('becomes an email in the visitor’s own mail app, signed and with a way to reply', () => {
    const mail = decode(mailto('jerry@example.com', { topic: 'Consultancy', from: ' ana@studio.com ', body: '  An AI rollout.  ', name: ' Ana ' }));
    expect(mail).toEqual({
      to: 'mailto:jerry@example.com',
      subject: 'Consultancy, from Ana',
      body: 'Dear Jerry,\n\nAn AI rollout.\n\nSincerely,\nAna\nana@studio.com',
    });
  });

  it('still reads well unsigned and without a reply address', () => {
    const mail = decode(mailto('jerry@example.com', { topic: 'Just a hello', from: ' ', body: 'Hi', name: '' }));
    expect(mail.subject).toBe('Just a hello');
    expect(mail.body).toBe('Dear Jerry,\n\nHi\n\nSincerely,\nA visitor');
  });
});

describe('the WebGL gate', () => {
  const env = { search: '', reducedMotion: false, probe: () => true };
  it('allows decorative WebGL where it is cheap and wanted', () => {
    expect(glAllowed(env)).toBe(true);
    expect(glAllowed({ ...env, deviceMemory: 2 })).toBe(true);
  });

  it('keeps the static fallback for ?gl=off, reduced motion, data saver, low memory or no WebGL2', () => {
    expect(glAllowed({ ...env, search: '?gl=off' })).toBe(false);
    expect(glAllowed({ ...env, reducedMotion: true })).toBe(false);
    expect(glAllowed({ ...env, saveData: true })).toBe(false);
    expect(glAllowed({ ...env, deviceMemory: 1 })).toBe(false);
    expect(glAllowed({ ...env, probe: () => false })).toBe(false);
  });

  it('probes WebGL2 and releases the probe context', () => {
    let lost = 0;
    const gl = { getExtension: () => ({ loseContext: () => (lost += 1) }) };
    const doc = (ctx: unknown) => ({ createElement: () => ({ getContext: () => ctx }) }) as unknown as Document;
    expect(probeWebGL2(doc(gl))).toBe(true);
    expect(lost).toBe(1);
    expect(probeWebGL2(doc(null))).toBe(false);
    const broken = { createElement: () => { throw new Error('no canvas'); } } as unknown as Document;
    expect(probeWebGL2(broken)).toBe(false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads the real browser: URL, motion preference, data saver, memory and a WebGL2 probe', () => {
    const webgl = { getExtension: () => null };
    vi.stubGlobal('location', { search: '' });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { connection: { saveData: false }, deviceMemory: 8 });
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => webgl }) });
    expect(canUseGL()).toBe(true);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(canUseGL()).toBe(false);
  });
});
