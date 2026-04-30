// Walks src/content/ and reports any frontmatter title (or hotel `name`)
// that exceeds the safe SERP length once " | Ταξιδιάρης" (13 chars) is appended.
// Target: ≤47 chars body title → ≤60 chars in <title>.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'content');
const SUFFIX_LEN = ' | Ταξιδιάρης'.length; // 13
const MAX_TITLE = 60;
const SAFE_BODY = MAX_TITLE - SUFFIX_LEN; // 47

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.md')) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const offenders = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) continue;
  const fm = fmMatch[1];

  // Check both `title:` and `name:` (hotels use name)
  for (const key of ['title', 'name']) {
    const m =
      fm.match(new RegExp(`^${key}:\\s*"([^"]+)"`, 'm')) ||
      fm.match(new RegExp(`^${key}:\\s*'([^']+)'`, 'm')) ||
      fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!m) continue;
    const value = m[1].trim().replace(/^["']|["']$/g, '');
    if (value.length > SAFE_BODY) {
      offenders.push({
        file: file.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/'),
        key,
        len: value.length,
        full: value.length + SUFFIX_LEN,
        value,
      });
    }
    break; // only the first matching key
  }
}

offenders.sort((a, b) => b.len - a.len);

console.log(`Safe body title length: ≤${SAFE_BODY} chars  (full <title>: ≤${MAX_TITLE})`);
console.log(`Found ${offenders.length} title(s) over the limit:\n`);

const byCollection = {};
for (const o of offenders) {
  const coll = o.file.split('/')[0];
  (byCollection[coll] = byCollection[coll] || []).push(o);
}

for (const [coll, list] of Object.entries(byCollection)) {
  console.log(`\n=== ${coll} (${list.length}) ===`);
  for (const o of list) {
    console.log(`  ${String(o.len).padStart(3)} → ${o.full}  ${o.file}`);
    console.log(`        "${o.value}"`);
  }
}

console.log(`\nTotal: ${offenders.length} files need title trimming.`);
