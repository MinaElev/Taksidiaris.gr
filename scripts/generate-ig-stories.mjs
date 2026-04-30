// Generates 10 Instagram-story-sized JPGs (1080x1920) from Wikimedia images
// with badges, titles, and link stickers — ready to upload to Instagram.
//
// Run: node scripts/generate-ig-stories.mjs
// Output: ig-stories/01-*.jpg ... 10-*.jpg at project root.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'ig-stories');

const W = 1080, H = 1920;

const stories = [
  { n: 1, slug: 'milos-katakomves',
    img: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Catacombsmain.JPG',
    badge: 'DID YOU KNOW',
    title: 'Στη Μήλο είναι οι 3ες σημαντικότερες χριστιανικές κατακόμβες στον κόσμο.',
    sub: 'Το ήξερες;',
    cta: 'Δες τις Κατακόμβες',
    href: 'taksidiaris.gr/proorismoi/ellada/milos/katakomves',
    accent: '#fbbf24' },
  { n: 2, slug: 'milos-sarakiniko',
    img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sarakiniko%20Beach%20on%20Milos%20Island,%20Greece%20with%20a%20view%20of%20the%20Aegean%20Sea.jpg',
    badge: 'PHOTO SPOT',
    title: 'Σαρακήνικο',
    sub: 'Γιατί όλοι το λένε «φεγγαρικό τοπίο» — και πότε να πας για να το έχεις μόνος σου.',
    cta: 'Οδηγός Σαρακήνικου',
    href: 'taksidiaris.gr/proorismoi/ellada/milos/sarakiniko',
    accent: '#7dd3fc' },
  { n: 3, slug: 'sifnos-revithada',
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Sifnos09view.jpg',
    badge: 'ΓΕΥΣΗ',
    title: 'Ρεβιθάδα στο μαστέλο',
    sub: 'Ψήνεται 8 ώρες σε ξυλόφουρνο. Δες πού θα τη φας σωστά στη Σίφνο.',
    cta: 'Σιφνέικη γαστρονομία',
    href: 'taksidiaris.gr/proorismoi/ellada/sifnos/revithada-mastelo',
    accent: '#fde68a' },
  { n: 4, slug: 'folegandros-chrysospilia',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Chora%2C_Folegandros%2C_Greece.jpg/3840px-Chora%2C_Folegandros%2C_Greece.jpg',
    badge: 'HIDDEN GEM',
    title: 'Χρυσοσπηλιά Φολεγάνδρου',
    sub: 'Αρχαίο ιερό μέσα σε σπήλαιο 60μ. πάνω από τη θάλασσα.',
    cta: 'Διάβασε',
    href: 'taksidiaris.gr/proorismoi/ellada/folegandros/chrysospilia',
    accent: '#fcd34d' },
  { n: 5, slug: 'santorini-pyrgos',
    img: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Pyrgos-Santorini.jpg',
    badge: 'TIP',
    title: 'Ξέχνα την Οία στις 7μ.μ.',
    sub: 'Ο Πύργος έχει ίδια θέα — χωρίς selfie sticks.',
    cta: 'Πύργος Σαντορίνης',
    href: 'taksidiaris.gr/proorismoi/ellada/santorini/pyrgos',
    accent: '#fb923c' },
  { n: 6, slug: 'santorini-akrotiri',
    img: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Akrotiri003.jpg',
    badge: 'HISTORY',
    title: 'Η «Πομπηία του Αιγαίου»',
    sub: 'Μια πόλη παγωμένη στον χρόνο 3.500 χρόνια πριν. Ακρωτήρι, Σαντορίνη.',
    cta: 'Προϊστορικό Ακρωτήρι',
    href: 'taksidiaris.gr/proorismoi/ellada/santorini/akrotiri-proistorikos',
    accent: '#f59e0b' },
  { n: 7, slug: 'folegandros-monopatia',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Chora%2C_Folegandros%2C_Greece.jpg/3840px-Chora%2C_Folegandros%2C_Greece.jpg',
    badge: 'TRAIL',
    title: '4 μονοπάτια στη Φολέγανδρο',
    sub: 'Σου δείχνουν το νησί που δεν χωράει στο αμάξι.',
    cta: 'Πεζοπορία',
    href: 'taksidiaris.gr/proorismoi/ellada/folegandros/monopatia-folegandros',
    accent: '#bef264' },
  { n: 8, slug: 'sifnos-tselemendes',
    img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Greek%20geometric%20pottery,%20Sifnos,%208th%20c%20BC,%20AM%20Sifnos,%20153410.jpg',
    badge: 'QUIZ',
    title: 'Ποιος μεγάλος Έλληνας μάγειρας γεννήθηκε στη Σίφνο;',
    sub: '👉 Νικόλαος Τσελεμεντές',
    cta: 'Διάβασε',
    href: 'taksidiaris.gr/proorismoi/ellada/sifnos/tselemendes-gastronomia',
    accent: '#fde047' },
  { n: 9, slug: 'folegandros-panigyria',
    img: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cyclades%20Folegandros%20Hora%20Panagia%20Kimissis%20Porche%20-%20panoramio.jpg',
    badge: 'ΠΑΝΗΓΥΡΙ',
    title: 'Πανηγύρι στη Φολέγανδρο;',
    sub: 'Ξέχνα το ξενοδοχείο — θα φας και θα χορέψεις μέχρι το πρωί.',
    cta: 'Ημερολόγιο πανηγυριών',
    href: 'taksidiaris.gr/proorismoi/ellada/folegandros/panigyria-folegandros',
    accent: '#fbbf24' },
  { n: 10, slug: 'milos-plaka',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Panagia_Korfiatissa%2C_Plaka%2C_Milos%2C_152634.jpg/3840px-Panagia_Korfiatissa%2C_Plaka%2C_Milos%2C_152634.jpg',
    badge: 'SAVE FOR LATER',
    title: 'Το πιο όμορφο ηλιοβασίλεμα της Μήλου',
    sub: 'δεν είναι στο Σαρακήνικο. Είναι από το Κάστρο της Πλάκας.',
    cta: 'Πλάκα & Κάστρο',
    href: 'taksidiaris.gr/proorismoi/ellada/milos/plaka-kastro',
    accent: '#fff7ed' },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Word-wrap by character count (rough but works for display copy)
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length <= maxChars) {
      line = (line + ' ' + w).trim();
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildSvg(s) {
  const FONT = "Manrope, 'Segoe UI', Arial, sans-serif";

  const titleSize = s.title.length > 40 ? 70 : s.title.length > 25 ? 84 : 100;
  const titleLines = wrap(s.title, s.title.length > 40 ? 22 : 18);
  const titleLineH = Math.round(titleSize * 1.05);

  const subSize = 38;
  const subLines = s.sub ? wrap(s.sub, 38) : [];
  const subLineH = Math.round(subSize * 1.25);

  // Layout from bottom up
  const padX = 80;
  const stickerY = H - 280;            // link sticker top
  const stickerH = 130;
  const stickerW = W - padX * 2;

  const subBlockH = subLines.length * subLineH;
  const subBottom = stickerY - 60;
  const subTop = subBottom - subBlockH;

  const titleBlockH = titleLines.length * titleLineH;
  const titleBottom = subLines.length ? subTop - 30 : stickerY - 60;
  const titleTop = titleBottom - titleBlockH;

  const titleSpans = titleLines
    .map((l, i) => `<tspan x="${padX}" dy="${i === 0 ? 0 : titleLineH}">${escapeXml(l)}</tspan>`)
    .join('');
  const subSpans = subLines
    .map((l, i) => `<tspan x="${padX}" dy="${i === 0 ? 0 : subLineH}">${escapeXml(l)}</tspan>`)
    .join('');

  // Badge sizing — scale by text length
  const badgeText = s.badge;
  const badgePadX = 28, badgePadY = 16;
  const badgeFont = 32;
  const badgeW = Math.round(badgeText.length * badgeFont * 0.62) + badgePadX * 2;
  const badgeH = badgeFont + badgePadY * 2;

  const ctaFont = 38;
  const ctaText = s.cta;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.55)"/>
      <stop offset="30%" stop-color="rgba(0,0,0,0.15)"/>
      <stop offset="55%" stop-color="rgba(0,0,0,0.25)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
    </linearGradient>
    <filter id="textshadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#grad)"/>

  <!-- Badge -->
  <g>
    <rect x="${padX}" y="80" rx="${badgeH / 2}" ry="${badgeH / 2}" width="${badgeW}" height="${badgeH}" fill="${s.accent}"/>
    <text x="${padX + badgeW / 2}" y="${80 + badgeH / 2 + badgeFont * 0.35}" font-family="${FONT}" font-size="${badgeFont}" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="3">${escapeXml(badgeText)}</text>
  </g>

  <!-- Brand handle -->
  <text x="${W - padX}" y="${80 + badgeH / 2 + 28 * 0.35}" font-family="${FONT}" font-size="32" font-weight="700" fill="rgba(255,255,255,0.92)" text-anchor="end" filter="url(#textshadow)">@taksidiaris</text>

  <!-- Title -->
  <text x="${padX}" y="${titleTop + titleSize}" font-family="${FONT}" font-size="${titleSize}" font-weight="900" fill="#ffffff" filter="url(#textshadow)">${titleSpans}</text>

  ${subLines.length ? `<text x="${padX}" y="${subTop + subSize}" font-family="${FONT}" font-size="${subSize}" font-weight="500" fill="rgba(255,255,255,0.95)" filter="url(#textshadow)">${subSpans}</text>` : ''}

  <!-- Link sticker -->
  <g>
    <rect x="${padX}" y="${stickerY}" rx="32" ry="32" width="${stickerW}" height="${stickerH}" fill="#ffffff"/>
    <!-- link icon -->
    <g transform="translate(${padX + 40}, ${stickerY + stickerH / 2 - 22}) scale(1.8)" stroke="#334155" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </g>
    <text x="${padX + 130}" y="${stickerY + stickerH / 2 + ctaFont * 0.35}" font-family="${FONT}" font-size="${ctaFont}" font-weight="800" fill="#0f172a">${escapeXml(ctaText)}</text>
  </g>
</svg>`;
}

async function fetchBuffer(url, attempt = 1) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'TaksidiarisIGStoryGen/1.0 (https://taksidiaris.gr; contact@taksidiaris.gr)',
      'Accept': 'image/jpeg,image/png,image/*,*/*;q=0.8',
    },
  });
  if (res.status === 429 && attempt <= 3) {
    const wait = 1500 * attempt;
    console.log(`       … 429 rate-limited, retry in ${wait}ms (attempt ${attempt})`);
    await new Promise(r => setTimeout(r, wait));
    return fetchBuffer(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function processStory(s) {
  console.log(`  [${s.n}] ${s.slug} ...`);
  const imgBuf = await fetchBuffer(s.img);

  const base = await sharp(imgBuf)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const svg = buildSvg(s);

  const out = await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const fname = `${String(s.n).padStart(2, '0')}-${s.slug}.jpg`;
  await writeFile(join(OUT_DIR, fname), out);
  console.log(`       ✓ ${fname}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating 10 IG stories → ${OUT_DIR}`);
  for (const s of stories) {
    try {
      await processStory(s);
    } catch (e) {
      console.error(`  [${s.n}] FAILED: ${e.message}`);
    }
  }
  console.log('Done.');
}

main();
