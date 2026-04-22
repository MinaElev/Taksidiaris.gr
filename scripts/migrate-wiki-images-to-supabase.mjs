// Downloads every Wikipedia hero image referenced in the content collection,
// compresses to a target file size (~100 KB), uploads to Supabase Storage,
// and rewrites the .md file's `hero` field to point at the Supabase URL.
//
// Usage: node --env-file=.env scripts/migrate-wiki-images-to-supabase.mjs [--dry-run] [--only=<slug>]
//
// Behaviour:
//  - Only touches URLs that start with https://upload.wikimedia.org/
//  - Idempotent: if hero is already a Supabase URL, skips
//  - Throttles to avoid Wikipedia 429s
//  - Uses Wikipedia thumbnail service (1600px) so we don't pull originals
//  - Compresses iteratively (quality 82 → 75 → 65 → resize down) to hit ~100KB target
//  - Writes back via gray-matter to preserve YAML formatting

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src', 'content');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const SUPABASE_HOST = new URL(SUPABASE_URL).host;

const TARGET_KB = 100;
const TARGET_MIN_KB = 70;
const TARGET_MAX_KB = 140;
const UA = 'TaksidiarisImageMigrator/1.0 (info@taksidiaris.gr)';

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith('.md')) yield p;
  }
}

// Convert e.g. https://upload.wikimedia.org/wikipedia/commons/2/21/Ios_collage.png
// → https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Ios_collage.png/1600px-Ios_collage.png
// PNGs become 1600px-{name}.png.jpg in Wikipedia's thumb naming for some files,
// but for our use-case we just need a thumbnail that's smaller than the original.
function toWikiThumb(url, width = 1600) {
  try {
    const u = new URL(url);
    if (u.host !== 'upload.wikimedia.org') return url;
    const parts = u.pathname.split('/');
    // /wikipedia/commons/2/21/Ios_collage.png
    if (parts.length < 6) return url;
    if (parts[3] === 'thumb') return url; // already a thumb
    // Insert 'thumb' after 'commons' (or 'en') and append /{width}px-{filename}
    const filename = parts[parts.length - 1];
    const newPath = [
      parts[1], // wikipedia
      parts[2], // commons (or en)
      'thumb',
      ...parts.slice(3),
      `${width}px-${filename}`,
    ];
    return `${u.protocol}//${u.host}/${newPath.join('/')}`;
  } catch {
    return url;
  }
}

async function downloadBuffer(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf;
}

// Compress a buffer to ~TARGET_KB using sharp. Returns { buf, kb, attempts }.
async function compressToTarget(inputBuf) {
  // Strategies, in order: (width, quality)
  const strategies = [
    [1600, 82],
    [1600, 75],
    [1400, 75],
    [1280, 72],
    [1280, 65],
    [1024, 70],
    [1024, 60],
  ];
  let best = null;
  for (const [width, quality] of strategies) {
    const buf = await sharp(inputBuf)
      .rotate() // honour EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    const kb = Math.round(buf.byteLength / 1024);
    if (kb >= TARGET_MIN_KB && kb <= TARGET_MAX_KB) return { buf, kb, strategy: { width, quality } };
    // Keep the smallest result that's still ≥ TARGET_MIN_KB, fallback to the smallest overall
    if (!best || kb < best.kb) best = { buf, kb, strategy: { width, quality } };
  }
  return best;
}

async function uploadToSupabase(buf, supabasePath) {
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(supabasePath, buf, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(supabasePath);
  return data.publicUrl;
}

// Determine the Supabase folder + filename for a given .md path
function targetPathFor(mdPath) {
  // src/content/destinations/ellada/santorini.md → destinations-ellada/santorini.jpg
  // src/content/periods/pasxa.md                  → periods/pasxa.jpg
  // src/content/tours/foo.md                      → tours/foo.jpg
  // src/content/hotels/foo.md                     → hotels/foo.jpg
  const rel = mdPath.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/');
  const m = rel.match(/^src\/content\/([^/]+)\/(?:([^/]+)\/)?([^/]+)\.md$/);
  if (!m) throw new Error(`Cannot derive Supabase path from ${rel}`);
  const [, type, region, slug] = m;
  const folder = region ? `${type}-${region}` : type;
  return `${folder}/${slug}.jpg`;
}

const items = [];
for await (const f of walk(CONTENT)) {
  const text = await readFile(f, 'utf-8');
  const parsed = matter(text);
  const hero = parsed.data?.hero;
  if (typeof hero !== 'string' || !hero.trim()) continue;
  if (!hero.startsWith('https://upload.wikimedia.org/')) continue;
  if (ONLY && !f.includes(ONLY)) continue;
  items.push({ path: f, parsed, hero, raw: text });
}

console.log(`\nMigrating ${items.length} Wikipedia images to Supabase`);
console.log(`Bucket: ${SUPABASE_BUCKET}`);
console.log(`Target size: ${TARGET_KB} KB (acceptable ${TARGET_MIN_KB}-${TARGET_MAX_KB} KB)`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN — no uploads, no file writes' : 'LIVE'}\n`);

const results = [];
let i = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const it of items) {
  i++;
  const supaPath = targetPathFor(it.path);
  const label = supaPath.padEnd(40).slice(0, 40);
  process.stdout.write(`[${String(i).padStart(2)}/${items.length}] ${label} `);

  try {
    const thumbUrl = toWikiThumb(it.hero, 1600);
    const buf = await downloadBuffer(thumbUrl);
    const beforeKb = Math.round(buf.byteLength / 1024);
    totalBefore += beforeKb;

    const { buf: outBuf, kb: afterKb, strategy } = await compressToTarget(buf);
    totalAfter += afterKb;

    if (DRY_RUN) {
      console.log(`${beforeKb} KB → ${afterKb} KB (${strategy.width}px q${strategy.quality}) [DRY]`);
      results.push({ path: it.path, supaPath, beforeKb, afterKb, ok: true });
    } else {
      const publicUrl = await uploadToSupabase(outBuf, supaPath);
      // Update the .md file: rewrite `hero` and persist with gray-matter
      it.parsed.data.hero = publicUrl;
      const newRaw = matter.stringify(it.parsed.content, it.parsed.data);
      await writeFile(it.path, newRaw, 'utf-8');
      console.log(`${beforeKb} KB → ${afterKb} KB (${strategy.width}px q${strategy.quality}) ✓`);
      results.push({ path: it.path, supaPath, publicUrl, beforeKb, afterKb, ok: true });
    }
    // throttle Wikipedia
    await new Promise((r) => setTimeout(r, 600));
  } catch (e) {
    console.log(`FAIL — ${e.message}`);
    results.push({ path: it.path, supaPath, ok: false, err: String(e.message || e) });
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const ok = results.filter((r) => r.ok);
const fail = results.filter((r) => !r.ok);

console.log('\n================ SUMMARY ================');
console.log(`Processed:      ${results.length}`);
console.log(`Successful:     ${ok.length}`);
console.log(`Failed:         ${fail.length}`);
console.log(`Total BEFORE:   ${(totalBefore / 1024).toFixed(1)} MB`);
console.log(`Total AFTER:    ${(totalAfter / 1024).toFixed(1)} MB`);
if (totalBefore > 0) {
  const saved = totalBefore - totalAfter;
  const pct = Math.round((saved / totalBefore) * 100);
  console.log(`Saved:          ${(saved / 1024).toFixed(1)} MB (${pct}%)`);
}
if (fail.length > 0) {
  console.log('\nFailures:');
  for (const f of fail) console.log(`  ${f.supaPath} — ${f.err}`);
}
