import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ImageMetadata } from 'astro';
import { describe, expect, it, vi } from 'vitest';
import { recommendations, honoraryMention, pull, teaser } from '../../src/data/recommendations';
import astroConfig from '../../astro.config.mjs';
import { path, projects } from '../../src/data/site';

function localAsset(image: ImageMetadata | string) {
  const src = typeof image === 'string' ? image : image.src;
  expect(src).toMatch(/^\/src\/assets\//);
  expect(existsSync(resolve(src.slice(1))), src).toBe(true);
}

describe('portfolio revamp content', () => {
  it('presents the six approved recommenders in the requested order', () => {
    expect(recommendations.map(({ name }) => name)).toEqual([
      'Iñigo Martín-Calero', 'Woundioun Sissoko', 'Jerry Jiang', 'Gavin Laugenie', 'Ian Green', 'Christoph Suessmeier',
    ]);
  });

  it('gives every recommendation an actual quote, LinkedIn, current role, wins and local portrait', () => {
    for (const rec of recommendations) {
      expect(rec.quote.length, rec.name).toBeGreaterThan(80);
      expect(rec.linkedin, rec.name).toMatch(/^https:\/\/www\.linkedin\.com\/in\/[^/]+\/?$/);
      expect(rec.position.title.length, rec.name).toBeGreaterThan(5);
      expect(rec.position.detail.length, rec.name).toBeGreaterThan(3);
      expect(rec.proof.length, rec.name).toBeGreaterThan(10);
      expect(rec.context.length, rec.name).toBeGreaterThan(10);
      localAsset(rec.portrait);
      if (rec.position.kind === 'employer') {
        expect(rec.position.company.length).toBeGreaterThan(2);
        expect(rec.position.companyUrl).toMatch(/^https:\/\//);
        localAsset(rec.position.logo);
      }
    }
    expect(recommendations.find((rec) => rec.name === 'Ian Green')?.position.kind).toBe('headline');
  });

  it('preserves the three existing recommendations verbatim', () => {
    const originalQuotes = {
      "Gavin Laugenie": "As a key member of the team tasked with the expansion of the business into the DACH region, Jerry has often been challenged with projects you would associate with more senior positions. … Jerry is a true gent and a hard working, professional, self motivated individual who is highly thought of throughout the marketing team.",
      "Ian Green": "He is a bright and switched on guy and one of those people whom one is easily inspired from. He doesn’t settle for mediocre. He has a broad knowledge of both offline and digital marketing and a great passion for everything media.",
      "Christoph Suessmeier": "Jerry's greatest strength is his extraordinary eye for user experience and user interface design. He pays attention to the smallest details that can elevate an app from ‘good’ to ‘great,’ and from ‘great’ to ‘delightful’."
};
    for (const [name, quote] of Object.entries(originalQuotes)) {
      expect(recommendations.find((rec) => rec.name === name)?.quote).toBe(quote);
    }
  });

  it('retains the NASA honorary mention, public comment and exact link', () => {
    expect(honoraryMention.name).toBe('Dan Goldin');
    expect(honoraryMention.title).toBe('9th NASA Administrator');
    expect(honoraryMention.quote).toBe('Congrats Jerry Schmalz, good luck lots of support from here!');
    expect(honoraryMention.source.href).toBe('https://www.linkedin.com/posts/jasdoughan_late-to-the-linkedin-party-but-weve-been-ugcPost-7222291638549671936-LUng');
    expect(honoraryMention.companyUrl).toBe('https://www.nasa.gov/');
    localAsset(honoraryMention.logo);
    localAsset(honoraryMention.portrait.image);
  });

  it('links Scenaryo to research and Leapfrog AI to its consulting site', () => {
    expect(projects.find((project) => project.id === 'scenaryo')?.url).toBe('https://scenaryo.app/research');
    const leapfrog = projects.find((project) => project.id === 'leapfrog');
    expect(leapfrog?.url).toBe('https://lfg-ai.com');
    expect(leapfrog?.summary).toContain('Europe and the US');
    expect(leapfrog?.presentation).toBe('website');
  });

  it('ships real local artwork for every project and both interactive Path models', () => {
    expect(projects).toHaveLength(5);
    for (const project of projects) {
      localAsset(project.logo);
      localAsset(project.phone.src);
      project.shots.forEach(localAsset);
    }
    const badge = path.find((stop) => stop.id === 'buildspace')?.badge;
    expect(badge).toBeDefined();
    if (!badge) throw new Error('Missing Buildspace badge');
    for (const image of Object.values(badge)) localAsset(image);
    expect(path.find((stop) => stop.id === 'desk')?.modelKind).toBe('desk');
  });

  it('credits sceneXtras with its first thousands of Reddit waitlist sign-ups', () => {
    const inigo = recommendations.find((rec) => rec.name === 'Iñigo Martín-Calero');
    expect(inigo?.quote).toContain('The Reddit response and the first thousands of waitlist sign-ups reflected the interest I was seeing.');
    expect(inigo?.quote).not.toMatch(/614/);
  });

  it('backs the declined TikTok offer with the censored recruiter email', () => {
    const tiktok = path.find((stop) => stop.id === 'tiktokdeclined');
    expect(tiktok?.flag).toBe('declined');
    expect(tiktok?.photos).toHaveLength(1);
    const [email] = tiktok?.photos ?? [];
    localAsset(email.src);
    expect(email.alt).toBe('Censored TikTok recruiter email following up on Jerry’s offer, May 2022');
  });

  it('configures the canonical domain and sitemap discovery', () => {
    expect(astroConfig.site).toBe('https://jerrydoughan.com');
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Sitemap: https://jerrydoughan.com/sitemap.xml');
  });

  it('fails clearly if an original recommendation is missing rather than publishing the wrong quote', async () => {
    vi.resetModules();
    vi.doMock('../../src/data/site', async () => ({
      ...await vi.importActual<typeof import('../../src/data/site')>('../../src/data/site'),
      testimonials: [],
    }));
    try {
      await expect(import('../../src/data/recommendations')).rejects.toThrow();
    } finally {
      vi.doUnmock('../../src/data/site');
      vi.resetModules();
    }
  });

  it('keeps a useful role detail when no additional public headline is supplied', async () => {
    vi.resetModules();
    vi.doMock('../../src/data/site', async () => {
      const actual = await vi.importActual<typeof import('../../src/data/site')>('../../src/data/site');
      return {
        ...actual,
        testimonials: actual.testimonials.map((person) => {
          if (person.name !== 'Ian Green') return person;
          const { also: _also, ...withoutExtraHeadline } = person;
          return withoutExtraHeadline;
        }),
      };
    });
    try {
      const content = await import('../../src/data/recommendations');
      expect(content.recommendations.find((person) => person.name === 'Ian Green')?.position.detail).toBe('Fintech, product strategy, SaaS and AI');
    } finally {
      vi.doUnmock('../../src/data/site');
      vi.resetModules();
    }
  });

});

describe('recommendations teaser', () => {
  it('lifts three short fragments verbatim from the recommendations, with who said them', () => {
    expect(teaser.map(({ name, org }) => `${name}, ${org}`)).toEqual([
      'Jerry Jiang, Akatos',
      'Iñigo Martín-Calero, Google',
      'Christoph Suessmeier, Exxeta',
    ]);
    for (const line of teaser) {
      expect(recommendations.find((rec) => rec.name === line.name)?.quote).toContain(line.fragment);
      expect(line.fragment.split(' ').length).toBeLessThanOrEqual(10);
      // The same photo and company mark as the full section, never a second copy.
      const rec = recommendations.find((item) => item.name === line.name)!;
      expect(line.portrait).toBe(rec.portrait);
      expect(line.logo).toBe(rec.position.kind === 'employer' ? rec.position.logo : undefined);
      expect(line.logo).toBeDefined();
    }
  });

  it('names a headline role when there is no employer, and refuses a misquote', () => {
    expect(pull('Ian Green', 'doesn’t settle for mediocre').org).toBe('Product Design Leader');
    expect(pull('Ian Green', 'doesn’t settle for mediocre').logo).toBeUndefined();
    expect(() => pull('Ian Green', 'the best designer alive')).toThrow(/not in Ian Green/);
    expect(() => pull('Nobody', 'anything')).toThrow(/not in Nobody/);
  });
});
