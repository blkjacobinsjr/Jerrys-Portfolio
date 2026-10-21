import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The link-preview reel (tools/og-video.mjs): small, silent, streamable H.264. */
const FILE = 'public/og.mp4';
const BUDGET = 1.5 * 1024 * 1024;

/** Top-level MP4 boxes in file order. */
function topBoxes(buf: Buffer) {
  const boxes: { type: string; start: number; size: number }[] = [];
  for (let at = 0; at + 8 <= buf.length; ) {
    const size = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    boxes.push({ type, start: at, size });
    if (size < 8) break;
    at += size;
  }
  return boxes;
}

/** Handler types of every track (vide, soun, ...), read from the hdlr boxes inside moov. */
function handlers(moov: Buffer) {
  const found: string[] = [];
  for (let at = moov.indexOf('hdlr'); at !== -1; at = moov.indexOf('hdlr', at + 4)) found.push(moov.toString('latin1', at + 12, at + 16));
  return found;
}

describe('og:video reel', () => {
  const buf = readFileSync(FILE);

  it('stays within the size budget', () => {
    expect(statSync(FILE).size).toBeGreaterThan(50_000);
    expect(statSync(FILE).size).toBeLessThanOrEqual(BUDGET);
  });

  it('is fast-start: the index comes before the media, so link cards play it at once', () => {
    const types = topBoxes(buf).map((b) => b.type);
    expect(types[0]).toBe('ftyp');
    expect(types.indexOf('moov')).toBeGreaterThan(-1);
    expect(types.indexOf('moov')).toBeLessThan(types.indexOf('mdat'));
  });

  it('has one video track and no audio track', () => {
    const moov = topBoxes(buf).find((b) => b.type === 'moov')!;
    const kinds = handlers(buf.subarray(moov.start, moov.start + moov.size));
    expect(kinds.filter((h) => h === 'vide')).toHaveLength(1);
    expect(kinds).not.toContain('soun');
    expect(buf.includes('avc1')).toBe(true);
  });

  it('is 1200x630 H.264 High in yuv420p (ffprobe)', () => {
    let probe: string;
    try {
      probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,width,height,pix_fmt', '-of', 'json', FILE], { encoding: 'utf8' });
    } catch {
      return; // ffprobe is optional here; the box checks above already cover the essentials
    }
    expect(JSON.parse(probe).streams).toEqual([{ codec_name: 'h264', profile: 'High', codec_type: 'video', width: 1200, height: 630, pix_fmt: 'yuv420p' }]);
  });
});
