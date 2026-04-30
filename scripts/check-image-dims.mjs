// Reads pixel dimensions of every hero image. Uses sharp on a downloaded
// 64KB head buffer (enough for JPEG SOF0 / PNG IHDR / WebP VP8) instead of
// downloading full files.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src', 'content');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith('.md')) yield p;
  }
}

function extractHero(text) {
  const single = text.match(/^hero:\s*['"]([^'"]+)['"]/m);
  if (single) return single[1].trim();
  const folded = text.match(/^hero:\s*>-?\s*\n((?:[ \t]+\S.*\n?)+)/m);
  if (folded) return folded[1].replace(/\s+/g, '').trim();
  const plain = text.match(/^hero:\s*(\S+)\s*$/m);
  if (plain && !plain[1].startsWith('>')) return plain[1].trim();
  return null;
}

const items = [];
for await (const f of walk(CONTENT)) {
  const text = await readFile(f, 'utf-8');
  const url = extractHero(text);
  if (!url) continue;
  items.push({ source: f.replace(ROOT + '\\', '').replace(ROOT + '/', ''), url });
}

// Deduplicate by URL — same hero used in multiple files = check once
const byUrl = new Map();
for (const it of items) {
  if (!byUrl.has(it.url)) byUrl.set(it.url, []);
  byUrl.get(it.url).push(it.source);
}

console.log(`\nFound ${items.length} hero references → ${byUrl.size} unique URLs\n`);

const results = [];
let i = 0;
const headers = { 'User-Agent': 'TaksidiarisImageAudit/1.0', Range: 'bytes=0-65535' };

for (const [url, sources] of byUrl) {
  i++;
  const label = url.length > 70 ? url.slice(0, 35) + '…' + url.slice(-30) : url;
  process.stdout.write(`[${i}/${byUrl.size}] ${label}  `);
  try {
    const r = await fetch(url, { headers });
    if (!r.ok && r.status !== 206) {
      console.log(`HTTP ${r.status}`);
      results.push({ url, sources, error: `HTTP ${r.status}` });
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const ext = url.match(/\.([a-z]+)(?:\?|$)/i)?.[1]?.toLowerCase() ?? meta.format;
    const sizeMb = +(buf.length / 1024 / 1024).toFixed(2);
    console.log(`${meta.width}×${meta.height} ${meta.format} (head ${sizeMb}MB)`);
    results.push({
      url, sources, w: meta.width, h: meta.height,
      format: meta.format, ext,
      pixels: meta.width * meta.height,
    });
    await new Promise((res) => setTimeout(res, 100));
  } catch (e) {
    console.log(`ERROR ${String(e.message).slice(0, 60)}`);
    results.push({ url, sources, error: String(e.message).slice(0, 80) });
  }
}

const ok = results.filter((r) => !r.error);
ok.sort((a, b) => b.pixels - a.pixels);

console.log('\n\n================ ΔΙΑΣΤΑΣΕΙΣ ================');
console.log(`Συνολικά ${ok.length} unique images analyzed\n`);

const buckets = {
  '>3000w (μεγαλύτερο από 4K)': ok.filter((r) => r.w > 3000),
  '1920-3000w (1080p-4K)':       ok.filter((r) => r.w > 1920 && r.w <= 3000),
  '1200-1920w (FullHD)':         ok.filter((r) => r.w > 1200 && r.w <= 1920),
  '800-1200w (HD)':              ok.filter((r) => r.w > 800 && r.w <= 1200),
  '<=800w (small)':              ok.filter((r) => r.w <= 800),
};
for (const [label, list] of Object.entries(buckets)) {
  console.log(`${label.padEnd(30)} ${String(list.length).padStart(3)} εικόνες`);
}

console.log('\n📐 Format breakdown:');
const formats = {};
for (const r of ok) formats[r.format] = (formats[r.format] || 0) + 1;
for (const [f, n] of Object.entries(formats)) console.log(`  ${f.padEnd(8)} ${n}`);

console.log('\n🔝 Top 10 μεγαλύτερες σε διαστάσεις:');
for (const r of ok.slice(0, 10)) {
  console.log(`  ${r.w}×${r.h} ${r.format.padEnd(5)} — ${r.sources[0]}`);
}

const usedManyTimes = ok.filter((r) => r.sources.length >= 5);
if (usedManyTimes.length) {
  console.log('\n♻️  Εικόνες που μοιράζονται 5+ σελίδες:');
  for (const r of usedManyTimes) {
    console.log(`  ${r.w}×${r.h}  ×${r.sources.length}  — ${r.url.split('/').pop()?.slice(0, 60)}`);
  }
}

const errs = results.filter((r) => r.error);
if (errs.length) {
  console.log(`\n❌ ${errs.length} errors:`);
  for (const r of errs) console.log(`  ${r.error} — ${r.sources[0]}`);
}
