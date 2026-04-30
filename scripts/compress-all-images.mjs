// Compresses every image referenced from the site to ~100KB.
//
// Targets:
//   • Supabase storage URLs in src/content/**.md  (hero, cover, gallery)
//   • Tour heroes/galleries from Postgres (covers agency-created tours)
//   • Local files under public/images/**
//
// Pipeline per image:
//   1. Download (or read from disk)
//   2. If already ≤110KB, skip — already good
//   3. sharp.resize({ width: ≤1920, withoutEnlargement: true })
//   4. Re-encode in same format with adaptive quality (binary-ish search):
//        targetMax 130KB; if output bigger, drop quality and retry.
//   5. Upload back to same Supabase path (overwrite via upsert) or write
//      back to local disk.
//   6. Skip non-Supabase remote URLs (Wikipedia etc) — can't write back.
//
// Usage:
//   node --env-file=.env scripts/compress-all-images.mjs              # dry-run
//   node --env-file=.env scripts/compress-all-images.mjs --apply      # commit
//   node --env-file=.env scripts/compress-all-images.mjs --apply --only=URL_PART

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);

const TARGET_MIN_KB = 80;
const TARGET_MAX_KB = 130;
const SKIP_BELOW_KB = 110; // already small enough
const MAX_WIDTH = 1920;
const QUALITY_LADDER = [82, 75, 68, 60, 52, 45]; // try in this order
const HARD_RESIZE_FALLBACK = 1280; // if even q=45 doesn't fit, downsize more

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const SUPABASE_HOST = new URL(SUPABASE_URL).host;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// -----------------------------------------------------------------------------

async function* walk(dir, ext = '.md') {
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) yield* walk(p, ext);
      else if (e.isFile() && p.endsWith(ext)) yield p;
    }
  } catch {}
}

function extractAllImageUrls(text) {
  const urls = new Set();
  // hero, cover (single, possibly folded YAML)
  for (const key of ['hero', 'cover']) {
    const single = text.match(new RegExp(`^${key}:\\s*['"]([^'"\\n]+)['"]`, 'm'));
    if (single) urls.add(single[1].trim());
    const folded = text.match(new RegExp(`^${key}:\\s*>-?\\s*\\n((?:[ \\t]+\\S.*\\n?)+)`, 'm'));
    if (folded) urls.add(folded[1].replace(/\s+/g, '').trim());
    const plain = text.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, 'm'));
    if (plain && !plain[1].startsWith('>') && !plain[1].startsWith("'") && !plain[1].startsWith('"')) {
      urls.add(plain[1].trim());
    }
  }
  // gallery: list — pull every URL-shaped line in the gallery block
  const galleryMatch = text.match(/^gallery:\s*\n((?:\s+-\s+.+\n?)+)/m)
    || text.match(/^gallery:\s*\n((?:\s+-\s+>-?\s*\n\s+\S.*\n)+)/m);
  if (galleryMatch) {
    const re = /https?:\/\/\S+|\/images\/\S+/g;
    let m;
    while ((m = re.exec(galleryMatch[1]))) urls.add(m[0].replace(/['",]+$/, ''));
  }
  return [...urls];
}

function parseSupabasePath(url) {
  // https://X.supabase.co/storage/v1/object/public/<bucket>/<path>
  if (!url.startsWith('http')) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.host !== SUPABASE_HOST) return null;
  const m = u.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function fetchBuffer(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function pickEncoder(format) {
  // sharp output API by detected format
  if (format === 'webp') return (img, q) => img.webp({ quality: q });
  if (format === 'png') return (img, q) => img.jpeg({ quality: q, mozjpeg: true }); // png→jpeg for size
  return (img, q) => img.jpeg({ quality: q, mozjpeg: true, progressive: true });
}

async function compressBuffer(buf, format) {
  const meta = await sharp(buf).rotate().metadata();
  const targetWidth = Math.min(meta.width || MAX_WIDTH, MAX_WIDTH);
  const enc = pickEncoder(format);

  for (const q of QUALITY_LADDER) {
    const out = await enc(
      sharp(buf).rotate().resize({ width: targetWidth, withoutEnlargement: true }),
      q,
    ).toBuffer();
    const kb = out.length / 1024;
    if (kb <= TARGET_MAX_KB) return { buffer: out, kb, q, width: targetWidth };
  }
  // Fallback: harder resize
  const out = await enc(
    sharp(buf).rotate().resize({ width: HARD_RESIZE_FALLBACK, withoutEnlargement: true }),
    50,
  ).toBuffer();
  return { buffer: out, kb: out.length / 1024, q: 50, width: HARD_RESIZE_FALLBACK };
}

const detectFormat = (url) => {
  const ext = (url.match(/\.([a-z]+)(?:\?|$)/i)?.[1] || '').toLowerCase();
  if (ext === 'webp') return 'webp';
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  return 'jpeg';
};

const contentType = (format) =>
  format === 'webp' ? 'image/webp' : 'image/jpeg';

// -----------------------------------------------------------------------------
// Collect URLs
// -----------------------------------------------------------------------------

console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${ONLY ? `  filter=${ONLY}` : ''}`);
console.log('Collecting image URLs...');

const seen = new Map(); // url → { sources: [paths] }
function add(url, source) {
  if (!url) return;
  if (ONLY && !url.includes(ONLY)) return;
  if (!seen.has(url)) seen.set(url, { sources: [] });
  seen.get(url).sources.push(source);
}

// 1. Markdown content
for await (const f of walk(join(ROOT, 'src', 'content'))) {
  const text = await readFile(f, 'utf-8');
  const rel = f.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  for (const u of extractAllImageUrls(text)) add(u, rel);
}

// 2. Postgres tours (covers agency-created tours that may have no markdown)
try {
  const { data, error } = await sb
    .from('tours')
    .select('slug, hero, gallery')
    .eq('draft', false);
  if (!error && data) {
    for (const t of data) {
      if (t.hero) add(t.hero, `db:tour/${t.slug}`);
      for (const g of t.gallery || []) add(g, `db:tour/${t.slug}/gallery`);
    }
  }
} catch (e) {
  console.warn('Could not enumerate DB tours:', e.message);
}

// 3. Local public/images/**
for await (const f of walk(join(ROOT, 'public', 'images'), '.jpg')) {
  add(f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\/public/, ''), 'local');
}
for await (const f of walk(join(ROOT, 'public', 'images'), '.jpeg')) {
  add(f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\/public/, ''), 'local');
}
for await (const f of walk(join(ROOT, 'public', 'images'), '.png')) {
  add(f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\/public/, ''), 'local');
}
for await (const f of walk(join(ROOT, 'public', 'images'), '.webp')) {
  add(f.replace(ROOT, '').replace(/\\/g, '/').replace(/^\/public/, ''), 'local');
}

console.log(`Found ${seen.size} unique image URLs\n`);

// -----------------------------------------------------------------------------
// Process each
// -----------------------------------------------------------------------------

const summary = { skipped: 0, compressed: 0, savedBytes: 0, errors: 0, nonWritable: 0 };
let i = 0;

for (const [url, { sources }] of seen) {
  i++;
  const isLocal = url.startsWith('/');
  const sb_loc = isLocal ? null : parseSupabasePath(url);
  const writable = isLocal || sb_loc;
  const label = url.length > 70 ? url.slice(0, 35) + '…' + url.slice(-30) : url;
  process.stdout.write(`[${i}/${seen.size}] ${label}  `);

  if (!writable) {
    console.log('SKIP (external, not writable)');
    summary.nonWritable++;
    continue;
  }

  // Load original
  let original;
  try {
    if (isLocal) original = await readFile(join(ROOT, 'public', url));
    else original = await fetchBuffer(url);
  } catch (e) {
    console.log(`ERROR fetch: ${e.message}`);
    summary.errors++;
    continue;
  }

  const origKB = original.length / 1024;
  if (origKB <= SKIP_BELOW_KB) {
    console.log(`skip (${Math.round(origKB)}KB ≤ ${SKIP_BELOW_KB})`);
    summary.skipped++;
    continue;
  }

  const format = detectFormat(url);
  let result;
  try {
    result = await compressBuffer(original, format);
  } catch (e) {
    console.log(`ERROR encode: ${e.message.slice(0, 60)}`);
    summary.errors++;
    continue;
  }

  const newKB = result.kb;
  const saved = original.length - result.buffer.length;
  const pct = Math.round((saved / original.length) * 100);
  console.log(
    `${Math.round(origKB)}KB → ${Math.round(newKB)}KB (q=${result.q} w=${result.width})  −${pct}%${APPLY ? '' : '  [dry]'}`,
  );

  if (!APPLY) {
    summary.compressed++;
    summary.savedBytes += saved;
    continue;
  }

  // Upload back
  try {
    if (isLocal) {
      await writeFile(join(ROOT, 'public', url), result.buffer);
    } else {
      const { error } = await sb.storage
        .from(sb_loc.bucket)
        .upload(sb_loc.path, result.buffer, {
          contentType: contentType(format),
          upsert: true,
          cacheControl: '3600',
        });
      if (error) throw error;
    }
    summary.compressed++;
    summary.savedBytes += saved;
  } catch (e) {
    console.log(`     ✗ upload failed: ${e.message.slice(0, 80)}`);
    summary.errors++;
  }
}

console.log('\n=========== SUMMARY ===========');
console.log(`Compressed:        ${summary.compressed}`);
console.log(`Skipped (small):   ${summary.skipped}`);
console.log(`Skipped (external):${summary.nonWritable}`);
console.log(`Errors:            ${summary.errors}`);
console.log(`Bytes saved:       ${(summary.savedBytes / 1024 / 1024).toFixed(1)} MB`);
if (!APPLY) console.log('\n(dry run — re-run with --apply to actually upload)');
