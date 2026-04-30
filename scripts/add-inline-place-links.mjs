// Adds inline cross-links between place articles within the same destination.
// For each .md file in src/content/places/<dest>/, finds the first occurrence of
// every OTHER place's canonical name in the body and turns it into a markdown
// link to /proorismoi/ellada/<dest>/<other-slug>.
//
// Idempotent: skips lines that already contain markdown links and headings.
// Usage:  node scripts/add-inline-place-links.mjs [--dry-run]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'content', 'places');
const DESTINATIONS = ['lefkada', 'rodos', 'kos', 'kerkyra', 'kefalonia', 'lesvos'];
const REGION = 'ellada';
const DRY_RUN = process.argv.includes('--dry-run');

// Greek letters incl. accented + diacritic combos — used as "word boundary"
const GREEK = 'Α-Ωα-ωάέήίόύώϊϋΐΰΆΈΉΊΌΎΏ';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract candidate short names from a frontmatter title.
// Tries the full pre-colon segment AND its sub-parts split on "και" / commas /
// "&", so "Λίνδος και Ακρόπολη" yields ["Λίνδος και Ακρόπολη", "Λίνδος", "Ακρόπολη"].
// Returned longest-first so the most specific match wins.
const GENERIC_BLOCKLIST = new Set([
  'Ακρόπολη', 'Φρούριο', 'Παλιά Πόλη', 'Νέα Πόλη', 'Παλιό Φρούριο', 'Νέο Φρούριο',
  'Χώρα', 'Κάστρο', 'Λιμάνι', 'Παραλία', 'Παραλίες', 'Μουσείο', 'Σπήλαιο',
  'Μοναστήρι', 'Εκκλησία', 'Πλατεία', 'Αγορά', 'Πύργος', 'Νησί',
]);
function candidateNames(title) {
  const head = title.split(/[:—–]/)[0].trim();
  const parts = head
    .split(/\s+και\s+|\s*,\s*|\s+&\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const all = new Set([head, ...parts]);
  return [...all]
    .filter((s) => s.length >= 4)
    .filter((s) => !GENERIC_BLOCKLIST.has(s))
    .sort((a, b) => b.length - a.length);
}

function parseFrontmatter(raw) {
  const m = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

function extractTitle(fm) {
  const m = fm.match(/^title:\s*"([^"]+)"/m) || fm.match(/^title:\s*'([^']+)'/m);
  return m ? m[1] : null;
}

function buildPlaceMap(dest) {
  const dir = join(ROOT, dest);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const map = []; // [{ slug, names: [string], file }]
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const raw = readFileSync(join(dir, file), 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;
    const title = extractTitle(parsed.fm);
    if (!title) continue;
    const names = candidateNames(title);
    if (names.length === 0) continue;
    map.push({ slug, names, file });
  }
  // Drop names that are shared between two different places — would link
  // ambiguously. Build a usage map across all places first.
  const counts = new Map();
  for (const { names } of map) {
    for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);
  }
  for (const entry of map) {
    entry.names = entry.names.filter((n) => counts.get(n) === 1);
  }
  return map.filter((e) => e.names.length > 0);
}

function addLinksToBody(body, others, dest, ownSlug) {
  const lines = body.split('\n');
  const linked = new Set();
  let totalAdded = 0;
  const log = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#')) continue;          // heading
    if (line.trim().startsWith('---')) continue;        // divider
    if (/\]\(/.test(line)) continue;                    // already has a link

    // Try each other place; first match wins for that line, then continue scanning.
    let updated = line;
    for (const { slug, names } of others) {
      if (slug === ownSlug) continue;
      if (linked.has(slug)) continue;

      // Try names longest-first; first hit wins.
      let hit = null;
      for (const name of names) {
        // Word-boundary against Greek letters so "Λευκάδα" doesn't match inside
        // "Λευκαδίτικη". Allow trailing ς/ν/υ for Greek inflections.
        const pattern = new RegExp(
          `(?<![${GREEK}\\[])${escapeRegex(name)}(?:[ςνυ])?(?![${GREEK}\\]])`,
          'u',
        );
        const m = updated.match(pattern);
        if (m) { hit = m; break; }
      }
      if (!hit) continue;

      const before = updated.slice(0, hit.index);
      const after = updated.slice(hit.index + hit[0].length);
      const href = `/proorismoi/${REGION}/${dest}/${slug}`;
      updated = `${before}[${hit[0]}](${href})${after}`;
      linked.add(slug);
      totalAdded += 1;
      log.push(`    + ${slug} ← "${hit[0]}"`);
    }
    lines[i] = updated;
  }

  return { body: lines.join('\n'), added: totalAdded, log };
}

let grandTotal = 0;
const skipped = [];

for (const dest of DESTINATIONS) {
  const dir = join(ROOT, dest);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch (e) {
    console.log(`\n=== ${dest} — directory not found, skipping ===`);
    continue;
  }

  console.log(`\n=== ${dest} (${files.length} files) ===`);
  const placeMap = buildPlaceMap(dest);

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const filePath = join(dir, file);
    const raw = readFileSync(filePath, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      console.log(`  ! ${file} — no frontmatter`);
      continue;
    }

    const { body: newBody, added, log } = addLinksToBody(
      parsed.body,
      placeMap,
      dest,
      slug,
    );

    if (added === 0) {
      console.log(`  - ${file} (no cross-links found)`);
      skipped.push(`${dest}/${file}`);
      continue;
    }

    console.log(`  ✓ ${file} — ${added} link(s)`);
    for (const l of log) console.log(l);

    if (!DRY_RUN) {
      writeFileSync(filePath, parsed.fm + newBody, 'utf8');
    }
    grandTotal += added;
  }
}

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Total links added: ${grandTotal}`);
if (skipped.length > 0) {
  console.log(`\nFiles with 0 cross-links (review manually):`);
  for (const s of skipped) console.log(`  - ${s}`);
}
