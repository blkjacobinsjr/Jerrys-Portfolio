import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { earlier, path, person, projects, testimonials } from '../../src/data/site';

const allCopy = JSON.stringify({ person, projects: projects.map(({ shots, ...p }) => p), earlier: earlier.map(({ thumb, ...e }) => e), path, testimonials: testimonials.map(({ avatar, ...t }) => t) });

describe('content', () => {
  it('uses no em or en dashes anywhere (house style)', () => {
    expect(allCopy).not.toMatch(/[—–]/);
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

  it('keeps project and stop ids unique', () => {
    expect(new Set(projects.map((p) => p.id)).size).toBe(projects.length);
    expect(new Set(path.map((s) => s.id)).size).toBe(path.length);
  });

  it('links only to https or site-relative URLs', () => {
    for (const url of [person.linkedin, person.github, person.spotify, ...earlier.flatMap((e) => (e.url ? [e.url] : []))]) expect(url).toMatch(/^https:\/\//);
    expect(person.cv).toMatch(/^\/.+\.pdf$/);
  });
});
