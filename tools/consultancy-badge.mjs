// Draws the Leapfrog AI badge textures for /consultancy's lanyard (components/Lanyard.tsx),
// in the same 1024x1440 card and 1152x192 strap format as the buildspace ones.
// The mark is Leapfrog AI's own logo, copied from the header at https://lfg-ai.com.
// Run: node tools/consultancy-badge.mjs
import sharp from 'sharp';

const out = new URL('../src/assets/lanyard/', import.meta.url);
const GREEN = '#064E3B';
const LEAF = '#047857';
const font = "font-family='Helvetica Neue, Helvetica, Arial, sans-serif'";

const mark = (x, y, s, dot = '#ffffff', arc = '#ffffff') => `
  <g transform="translate(${x} ${y}) scale(${s / 100})">
    <circle cx="18" cy="76" r="8" fill="${dot}"/>
    <circle cx="82" cy="24" r="11" fill="${dot}"/>
    <path d="M26 69 C36 54, 50 40, 66 30 L65 33 C50 43, 37 56, 28 70 Z" fill="${arc}"/>
  </g>`;

const W = 1024;
const H = 1440;
const portrait = await sharp(new URL('../src/assets/consultancy/jerry-source.webp', import.meta.url).pathname)
  .resize(360, 360)
  .composite([{ input: Buffer.from(`<svg width="360" height="360"><circle cx="180" cy="180" r="180"/></svg>`), blend: 'dest-in' }])
  .png()
  .toBuffer();

const front = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="78%" cy="30%" r="70%">
      <stop offset="0" stop-color="${LEAF}"/><stop offset="1" stop-color="${GREEN}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${mark(72, 92, 112)}
  <text x="952" y="150" text-anchor="end" ${font} font-weight="700" font-size="44" fill="#fff">consultancy</text>
  <circle cx="512" cy="560" r="188" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="4"/>
  <text x="72" y="1000" ${font} font-weight="700" font-size="150" letter-spacing="-6" fill="#fff">Jerry</text>
  <text x="72" y="1140" ${font} font-weight="700" font-size="150" letter-spacing="-6" fill="#fff">Doughan</text>
  <text x="72" y="1300" ${font} font-weight="500" font-size="46" fill="#ffffff" fill-opacity="0.78">Founder of</text>
  <text x="952" y="1300" text-anchor="end" ${font} font-weight="700" font-size="46" fill="#fff">Leapfrog AI</text>
</svg>`;

const back = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#f6f5f1"/>
  ${mark(312, 420, 400, GREEN, LEAF)}
  <text x="512" y="1060" text-anchor="middle" ${font} font-weight="700" font-size="96" letter-spacing="-3" fill="${GREEN}">LFG</text>
  <text x="512" y="1300" text-anchor="middle" ${font} font-weight="500" font-size="44" fill="${GREEN}" fill-opacity="0.7">lfg-ai.com</text>
</svg>`;

const strapWords = Array.from({ length: 4 }, (_, i) => `<text x="${40 + i * 288}" y="112" ${font} font-weight="700" font-size="44" fill="#fff" fill-opacity="0.9">LEAPFROG AI</text>`).join('');
const strap = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="192"><rect width="1152" height="192" fill="${GREEN}"/>${strapWords}</svg>`;

await sharp(Buffer.from(front))
  .composite([{ input: portrait, left: 512 - 180, top: 560 - 180 }])
  .webp({ quality: 88 })
  .toFile(new URL('leapfrog-front.webp', out).pathname);
await sharp(Buffer.from(back)).webp({ quality: 88 }).toFile(new URL('leapfrog-back.webp', out).pathname);
await sharp(Buffer.from(strap)).webp({ quality: 88 }).toFile(new URL('leapfrog-strap.webp', out).pathname);
console.log('wrote leapfrog-{front,back,strap}.webp');
