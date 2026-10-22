import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { backedBy, earlier, path, person, projects, testimonials } from '../../src/data/site';

const allCopy = JSON.stringify({
  person: { ...person, email: '' },
  projects: projects.map(({ shots, ...p }) => p),
  earlier: earlier.map(({ thumb, ...e }) => e),
  path: path.map(({ photos, ...s }) => s),
  testimonials,
  backedBy,
});

describe('content', () => {
  it('uses no em or en dashes anywhere (house style)', () => {
    expect(allCopy).not.toMatch(/[—–]/);
  });

  it('lists the seven programmes that back the work, once each', () => {
    expect(backedBy).toHaveLength(7);
    expect(new Set(backedBy).size).toBe(7);
  });

  it('has a diorama for every stop on the path', () => {
    const icons = new Set(readdirSync('src/assets/icons').map((f) => f.replace(/\.webp$/, '')));
    for (const stop of path) expect(icons, stop.id).toContain(stop.id);
  });

  it('marks exactly one stop as now, and it is the last one', () => {
    expect(path.filter((s) => s.flag === 'now')).toHaveLength(1);
    expect(path.at(-1)?.flag).toBe('now');
  });

  it('gives every project three shots, alt text, and a secure link', () => {
    for (const p of projects) {
      expect(p.shots).toHaveLength(3);
      expect(p.shotAlts.every((alt) => alt.length > 10)).toBe(true);
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.shaped.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every stop a hex glow, and every photo real alt text', () => {
    for (const stop of path) {
      expect(stop.glow, stop.id).toMatch(/^#[0-9a-f]{6}$/);
      for (const photo of stop.photos ?? []) expect(photo.alt.length, stop.id).toBeGreaterThan(20);
      if (stop.link) expect(stop.link.href).toMatch(/^https:\/\//);
    }
  });

  it('signs every stop with an abbreviated city and country, like BER · DE', () => {
    for (const stop of path) expect(stop.code, stop.id).toMatch(/^([A-Z]{3} · )?[A-Z]{2}$/);
  });

  it('names every recommender with a current title and how they know Jerry', () => {
    expect(testimonials.length).toBeGreaterThanOrEqual(4);
    for (const t of testimonials) {
      expect(t.title.length, t.name).toBeGreaterThan(5);
      expect(t.context.length, t.name).toBeGreaterThan(10);
      expect(t.quote.length, t.name).toBeGreaterThan(80);
    }
  });

  it('uses the name Jerry Doughan', () => {
    expect(person.name).toBe('Jerry Doughan');
    expect(person.linkedin).toContain('jasdoughan');
    expect(allCopy).not.toMatch(/Schmalz/);
  });

  it('keeps project and stop ids unique', () => {
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(path.map((s) => s.id)).size).toBe(path.length);
  });

  it('links only to https or site-relative URLs', () => {
    for (const url of [person.linkedin, person.github, person.spotify, ...earlier.flatMap((e) => (e.url ? [e.url] : []))]) expect(url).toMatch(/^https:\/\//);
    expect(person.cv).toMatch(/^\/.+\.pdf$/);
  });
});
