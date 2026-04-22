// Extracts every `hero:` URL from src/content + src/data/site.json
// and HEADs each one to report Content-Length in KB.
// Run: node scripts/check-image-sizes.mjs

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src', 'content');
const SITE_JSON = join(ROOT, 'src', 'data', 'site.json');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith('.md')) yield p;
  }
}

function extractHero(text) {
  // Matches  hero: 'url'  OR  hero: "url"  OR  hero: >- \n   url
  const single = text.match(/^hero:\s*['"]([^'"]+)['"]/m);
  if (single) return single[1].trim();
  const folded = text.match(/^hero:\s*>-?\s*\n((?:[ \t]+\S.*\n?)+)/m);
  if (folded) return folded[1].replace(/\s+/g, '').trim();
  const plain = text.match(/^hero:\s*(\S+)\s*$/m);
  if (plain && !plain[1].startsWith('>')) return plain[1].trim();
  return null;
}

const items = [];

// Walk content
for await (const f of walk(CONTENT)) {
  const text = await readFile(f, 'utf-8');
  const url = extractHero(text);
  if (!url) continue;
  const rel = f.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  items.push({ source: rel, url });
}

// site.json
try {
  const cfg = JSON.parse(await readFile(SITE_JSON, 'utf-8'));
  if (cfg.homeHero) items.push({ source: 'src/data/site.json (homepage)', url: cfg.homeHero });
} catch {}

console.log(`\nFound ${items.length} hero images. Checking sizes...\n`);

const results = [];
let i = 0;
for (const it of items) {
  i++;
  process.stdout.write(`[${i}/${items.length}] ${it.source.padEnd(60).slice(0, 60)} `);
  try {
    if (it.url.startsWith('/')) {
      // Local file under public/
      const p = join(ROOT, 'public', it.url);
      const s = await stat(p);
      const kb = Math.round(s.size / 1024);
      results.push({ ...it, kb, type: 'local' });
      console.log(`${kb} KB (local)`);
      continue;
    }
    // Wikipedia requires a UA and rate-limits. Throttle + send a real UA.
    const headers = { 'User-Agent': 'TaksidiarisImageSizeAudit/1.0 (info@taksidiaris.gr)' };
    let r = await fetch(it.url, { method: 'HEAD', redirect: 'follow', headers });
    // Retry once on 429
    if (r.status === 429) {
      await new Promise((res) => setTimeout(res, 2000));
      r = await fetch(it.url, { method: 'HEAD', redirect: 'follow', headers });
    }
    if (r.status !== 200) {
      results.push({ ...it, kb: -1, type: 'http-error', err: `HTTP ${r.status}` });
      console.log(`HTTP ${r.status}`);
      await new Promise((res) => setTimeout(res, 200));
      continue;
    }
    const len = r.headers.get('content-length');
    if (!len) {
      const g = await fetch(it.url, { headers });
      const buf = await g.arrayBuffer();
      const kb = Math.round(buf.byteLength / 1024);
      results.push({ ...it, kb, type: 'remote' });
      console.log(`${kb} KB (GET)`);
    } else {
      const kb = Math.round(parseInt(len, 10) / 1024);
      results.push({ ...it, kb, type: 'remote' });
      console.log(`${kb} KB`);
    }
    // small delay to be polite
    await new Promise((res) => setTimeout(res, 200));
  } catch (e) {
    results.push({ ...it, kb: -1, type: 'error', err: String(e.message || e) });
    console.log(`ERROR ${e.message}`);
  }
}

// Summary
results.sort((a, b) => b.kb - a.kb);
const total = results.filter((r) => r.kb > 0).reduce((s, r) => s + r.kb, 0);
const avg = Math.round(total / results.filter((r) => r.kb > 0).length);

console.log('\n\n================ SUMMARY ================');
console.log(`Total images:    ${results.length}`);
console.log(`Total weight:    ${(total / 1024).toFixed(1)} MB`);
console.log(`Average size:    ${avg} KB`);
console.log(`Median:          ${results[Math.floor(results.length / 2)]?.kb} KB`);
console.log(`Largest:         ${results[0]?.kb} KB — ${results[0]?.source}`);
console.log(`Smallest:        ${results[results.length - 1]?.kb} KB — ${results[results.length - 1]?.source}`);

const huge = results.filter((r) => r.kb > 1024);
const big = results.filter((r) => r.kb > 500 && r.kb <= 1024);
const ok = results.filter((r) => r.kb > 0 && r.kb <= 500);
console.log(`\nBuckets:`);
console.log(`  > 1 MB:        ${huge.length} εικόνες`);
console.log(`  500 KB – 1 MB: ${big.length} εικόνες`);
console.log(`  ≤ 500 KB:      ${ok.length} εικόνες`);

if (huge.length > 0) {
  console.log('\n⚠️  ΤΕΡΑΣΤΙΕΣ (>1 MB) — προτεραιότητα συμπίεσης:');
  for (const r of huge) console.log(`  ${String(r.kb).padStart(5)} KB — ${r.source}`);
}
if (big.length > 0) {
  console.log('\n⚠️  ΜΕΓΑΛΕΣ (500 KB – 1 MB) — αξίζει συμπίεση:');
  for (const r of big) console.log(`  ${String(r.kb).padStart(5)} KB — ${r.source}`);
}
