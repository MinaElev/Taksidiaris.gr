// Renders public/og-default.jpg (1200×630) — fallback Open Graph image used by
// every page that doesn't set its own. Built from the brand SVG so it stays in
// sync with the wordmark; no external image dependency.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const W = 1200;
const H = 630;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B2545"/>
      <stop offset="100%" stop-color="#13496e"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Subtle world-map dot grid -->
  <g fill="#ffffff" opacity="0.05">
    ${Array.from({ length: 18 }, (_, r) =>
      Array.from({ length: 36 }, (_, c) =>
        `<circle cx="${50 + c * 32}" cy="${50 + r * 32}" r="2"/>`
      ).join('')
    ).join('')}
  </g>

  <!-- Flight trail arc -->
  <path d="M 130 410 Q 600 470 1070 410"
        stroke="#E76F51" stroke-width="3" fill="none"
        stroke-linecap="round" stroke-dasharray="3,12" opacity="0.6"/>

  <!-- Wordmark "Ταξιδιάρης" -->
  <text x="${W / 2}" y="335" text-anchor="middle"
        font-family="'Segoe UI', 'Helvetica Neue', system-ui, sans-serif"
        font-weight="900" font-size="170" fill="#FFFFFF"
        letter-spacing="-6">Ταξιδιάρης</text>

  <!-- Paper airplane replacing the tonos above 'ά' -->
  <g transform="translate(723, 130) rotate(-18)">
    <path d="M 0 0 L 70 24 L 33 30 L 42 60 Z" fill="#E76F51"/>
    <path d="M 33 30 L 42 60" stroke="#B9543E" stroke-width="2" fill="none"/>
  </g>

  <!-- Tagline -->
  <text x="${W / 2}" y="430" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif"
        font-weight="600" font-size="30" fill="#E8C547"
        letter-spacing="6">ΟΡΓΑΝΩΜΕΝΑ ΤΑΞΙΔΙΑ · ΤΑΞΙΔΙΩΤΙΚΟΣ ΟΔΗΓΟΣ</text>

  <!-- Domain footer -->
  <text x="${W / 2}" y="540" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif"
        font-weight="600" font-size="26" fill="#E76F51"
        letter-spacing="14">TAKSIDIARIS.GR</text>
</svg>
`;

const outPath = join(process.cwd(), 'public', 'og-default.jpg');
const buf = await sharp(Buffer.from(svg))
  .jpeg({ quality: 90, progressive: true, mozjpeg: true })
  .toBuffer();
writeFileSync(outPath, buf);
console.log(`✓ Wrote ${outPath}  (${buf.length.toLocaleString()} bytes, ${W}×${H})`);
