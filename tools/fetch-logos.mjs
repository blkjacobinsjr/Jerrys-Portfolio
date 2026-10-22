// Downloads the logos for the tools loop into src/assets/logos and writes
// src/data/stack.json. With LOGO_DEV_TOKEN set (a logo.dev publishable key,
// kept in .env.local, never committed) every logo comes from logo.dev; without
// it, the ones Simple Icons has (CC0) are used in one ink colour.
// It also fetches the mark shown above each path stop's title in its drawer
// into src/assets/stops/logos/<stop id>.png: logo.dev with the token, the
// organisation's own touch icon or favicon without it.
//
//   LOGO_DEV_TOKEN=pk_... node tools/fetch-logos.mjs
import { mkdir, rm, writeFile } from 'node:fs/promises';

// Tools from the CV and the shipped projects. `icon` is the Simple Icons slug.
const TOOLS = [
  { name: 'React', domain: 'react.dev', icon: 'react' },
  { name: 'TypeScript', domain: 'typescriptlang.org', icon: 'typescript' },
  { name: 'Next.js', domain: 'nextjs.org', icon: 'nextdotjs' },
  { name: 'Astro', domain: 'astro.build', icon: 'astro' },
  { name: 'Expo', domain: 'expo.dev', icon: 'expo' },
  { name: 'Tailwind CSS', domain: 'tailwindcss.com', icon: 'tailwindcss' },
  { name: 'Node.js', domain: 'nodejs.org', icon: 'nodedotjs' },
  { name: 'NestJS', domain: 'nestjs.com', icon: 'nestjs' },
  { name: 'Supabase', domain: 'supabase.com', icon: 'supabase' },
  { name: 'PostgreSQL', domain: 'postgresql.org', icon: 'postgresql' },
  { name: 'Docker', domain: 'docker.com', icon: 'docker' },
  { name: 'Vite', domain: 'vite.dev', icon: 'vite' },
  { name: 'Vercel', domain: 'vercel.com', icon: 'vercel' },
  { name: 'GitHub', domain: 'github.com', icon: 'github' },
  { name: 'Figma', domain: 'figma.com', icon: 'figma' },
  { name: 'Adobe Creative Cloud', domain: 'adobe.com' },
  { name: 'Salesforce', domain: 'salesforce.com' },
  { name: 'Marketo', domain: 'marketo.com' },
  { name: 'Tableau', domain: 'tableau.com' },
  { name: 'Google Analytics', domain: 'analytics.google.com', icon: 'googleanalytics' },
  { name: 'Shopify', domain: 'shopify.com', icon: 'shopify' },
  { name: 'WordPress', domain: 'wordpress.org', icon: 'wordpress' },
  { name: 'Zendesk', domain: 'zendesk.com', icon: 'zendesk' },
  { name: 'AWS', domain: 'aws.amazon.com' },
];
// Path stops with an organisation behind them (src/data/site.ts `path`). Personal
// stops (Work in Ghana, the desk) have none; buildspace's site is gone, so it has
// no icon to fetch. Scenaryo reuses its Selected work logo. `icon` is the fallback.
const google = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const STOPS = [
  { id: 'coventry', domain: 'coventry.ac.uk', icon: 'https://www.coventry.ac.uk/apple-touch-icon.png' },
  { id: 'opentable', domain: 'opentable.com', icon: google('opentable.com') },
  { id: 'dotdigital', domain: 'dotdigital.com', icon: google('dotdigital.com') },
  { id: 'siteminder', domain: 'siteminder.com', icon: google('siteminder.com') },
  { id: 'peloton', domain: 'onepeloton.com', icon: google('onepeloton.com') },
  { id: 'tiktokdeclined', domain: 'tiktok.com', icon: 'https://www.tiktok.com/apple-touch-icon.png' },
  { id: 'benify', domain: 'benify.com', icon: google('benify.com') },
  { id: 'hkw', domain: 'hkw.de', icon: google('hkw.de') },
  { id: 'wbs', domain: 'wbscodingschool.com', icon: google('wbscodingschool.com') },
  { id: 'draper', domain: 'draperuniversity.com', icon: google('draperuniversity.com') },
];
// Ink for the monochrome marks: light scheme, dark scheme (Simple Icons CDN).
const INK = ['2f2f2c', 'd9d9d4'];

const token = process.env.LOGO_DEV_TOKEN;
const dir = new URL('../src/assets/logos/', import.meta.url);
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

const stack = [];
for (const tool of TOOLS) {
  const slug = tool.domain.replace(/[^a-z0-9]+/g, '-');
  const url = token
    ? `https://img.logo.dev/${tool.domain}?token=${token}&size=128&format=png&retina=true`
    : tool.icon && `https://cdn.simpleicons.org/${tool.icon}/${INK[0]}/${INK[1]}`;
  if (!url) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${tool.name}: ${res.status} from ${token ? 'logo.dev' : 'Simple Icons'}`);
  const file = `${slug}.${token ? 'png' : 'svg'}`;
  await writeFile(new URL(file, dir), Buffer.from(await res.arrayBuffer()));
  stack.push({ name: tool.name, file });
}

const stopDir = new URL('../src/assets/stops/logos/', import.meta.url);
await rm(stopDir, { recursive: true, force: true });
await mkdir(stopDir, { recursive: true });
for (const stop of STOPS) {
  const url = token ? `https://img.logo.dev/${stop.domain}?token=${token}&size=128&format=png&retina=true` : stop.icon;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${stop.id}: ${res.status} from ${token ? 'logo.dev' : url}`);
  await writeFile(new URL(`${stop.id}.png`, stopDir), Buffer.from(await res.arrayBuffer()));
}
console.log(`${STOPS.length} path stop logos from ${token ? 'logo.dev' : 'their own sites'}`);

await writeFile(new URL('../src/data/stack.json', import.meta.url), `${JSON.stringify({ source: token ? 'logo.dev' : 'simpleicons', stack }, null, 2)}\n`);
console.log(`${stack.length} logos from ${token ? 'logo.dev' : 'Simple Icons'}`);
