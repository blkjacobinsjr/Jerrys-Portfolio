// Draws the scrap note on /contact that you crumple to start the letter over
// (React Bits PaperCrumple takes an image). Run: node tools/contact-note.mjs
import sharp from 'sharp';

const W = 480;
const H = 320;
const mono = "font-family='Menlo, ui-monospace, monospace'";
const lines = Array.from({ length: 5 }, (_, i) => `<line x1="32" x2="${W - 32}" y1="${118 + i * 40}" y2="${118 + i * 40}" stroke="#1c1b19" stroke-opacity="0.09" stroke-width="2"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#f4f0e8"/>
  ${lines}
  <text x="32" y="64" ${mono} font-size="22" letter-spacing="2" fill="#1c1b19" fill-opacity="0.55">DRAFT</text>
  <text x="32" y="150" ${mono} font-size="30" fill="#1c1b19">Not quite right?</text>
  <text x="32" y="230" ${mono} font-size="24" fill="#1c1b19" fill-opacity="0.7">Crumple this to</text>
  <text x="32" y="270" ${mono} font-size="24" fill="#1c1b19" fill-opacity="0.7">start over.</text>
</svg>`;
await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(new URL('../src/assets/contact/note.webp', import.meta.url).pathname);
console.log('wrote src/assets/contact/note.webp');
