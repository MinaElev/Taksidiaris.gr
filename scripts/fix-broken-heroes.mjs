// For every place .md whose `hero:` is broken (local file missing OR remote
// returns non-200 OR fails to parse), replace it with the parent destination's
// hero URL. Keeps content rendering instead of a broken image / gradient
// fallback. Idempotent.
//
// Usage:
//   node scripts/fix-broken-heroes.mjs            # dry-run
//   node scripts/fix-broken-heroes.mjs --apply    # rewrite frontmatter

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith('.md')) yield p;
  }
}

function extractHero(text) {
  const single = text.match(/^hero:\s*['"]([^'"]+)['"]/m);
  if (single) return { url: single[1].trim(), kind: 'quoted', match: single[0] };
  const folded = text.match(/^hero:\s*>-?\s*\n((?:[ \t]+\S.*\n?)+)/m);
  if (folded) return { url: folded[1].replace(/\s+/g, '').trim(), kind: 'folded', match: folded[0] };
  const plain = text.match(/^hero:\s*(\S+)\s*$/m);
  if (plain && !plain[1].startsWith('>')) return { url: plain[1].trim(), kind: 'plain', match: plain[0] };
  return null;
}

async function isLocalOk(url) {
  if (!url.startsWith('/')) return null;
  try {
    await stat(join(ROOT, 'public', url));
    return true;
  } catch {
    return false;
  }
}

async function isRemoteOk(url) {
  if (!url.startsWith('http')) return null;
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return r.ok;
  } catch {
    return false;
  }
}

// Build a map of destination → hero URL
async function buildDestinationHeroes() {
  const map = new Map(); // key: "ellada/sifnos" → hero URL
  for await (const f of walk(join(ROOT, 'src', 'content', 'destinations'))) {
    const text = await readFile(f, 'utf-8');
    const hero = extractHero(text);
    if (!hero) continue;
    // path = src/content/destinations/<region>/<slug>.md
    const rel = f.replace(/\\/g, '/').split('src/content/destinations/')[1];
    const id = rel.replace(/\.md$/, ''); // "ellada/sifnos"
    map.set(id, hero.url);
  }
  return map;
}

function destinationKeyFromPlacePath(filePath) {
  // src/content/places/<dest-slug>/<place>.md  (region implicit "ellada"
  // since all current places are Greek). For future-proofing we read the
  // `destination:` frontmatter instead — it's "ellada/<slug>".
  return null;
}

const destHeroes = await buildDestinationHeroes();
console.log(`Found ${destHeroes.size} destination heroes\n`);

const fixes = []; // { file, oldUrl, newUrl, reason }
const stillBroken = [];

for await (const f of walk(join(ROOT, 'src', 'content', 'places'))) {
  const text = await readFile(f, 'utf-8');
  const hero = extractHero(text);
  if (!hero) continue;

  // Read destination from frontmatter
  const destMatch = text.match(/^destination:\s*["']?([^"'\n]+)["']?/m);
  if (!destMatch) continue;
  const destId = destMatch[1].trim();

  // Check if hero works
  let ok;
  if (hero.url.startsWith('/')) ok = await isLocalOk(hero.url);
  else if (hero.url.startsWith('http')) ok = await isRemoteOk(hero.url);
  else ok = false;

  if (ok) continue;

  // Broken — substitute with destination hero
  const fallback = destHeroes.get(destId);
  if (!fallback) {
    stillBroken.push({ file: f, hero: hero.url, reason: `no destination hero for ${destId}` });
    continue;
  }

  // Verify the fallback also works (quick sanity check, cached)
  const fbOk = fallback.startsWith('http') ? await isRemoteOk(fallback) : await isLocalOk(fallback);
  if (!fbOk) {
    stillBroken.push({ file: f, hero: hero.url, reason: `destination hero for ${destId} also broken: ${fallback}` });
    continue;
  }

  fixes.push({ file: f, oldUrl: hero.url, newUrl: fallback, oldMatch: hero.match, destId });
}

console.log(`\n${APPLY ? '[APPLY]' : '[DRY-RUN]'} ${fixes.length} broken heroes to fix:\n`);
for (const fix of fixes) {
  const rel = fix.file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  console.log(`  ${rel}`);
  console.log(`    OLD: ${fix.oldUrl.slice(0, 90)}`);
  console.log(`    NEW: ${fix.newUrl.slice(0, 90)}  (← ${fix.destId})`);
}

if (APPLY) {
  for (const fix of fixes) {
    let text = await readFile(fix.file, 'utf-8');
    // Replace the entire `hero:` block with a simple folded scalar (matches
    // existing convention for long URLs)
    const replacement = `hero: >-\n  ${fix.newUrl}`;
    text = text.replace(fix.oldMatch, replacement);
    await writeFile(fix.file, text, 'utf-8');
  }
  console.log(`\n✓ Wrote ${fixes.length} files`);
}

if (stillBroken.length) {
  console.log(`\n⚠ ${stillBroken.length} files still need manual attention:`);
  for (const b of stillBroken) {
    const rel = b.file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    console.log(`  ${rel}: ${b.reason}`);
  }
}

console.log(`\nTotal: ${fixes.length} fixed, ${stillBroken.length} need manual fix`);
