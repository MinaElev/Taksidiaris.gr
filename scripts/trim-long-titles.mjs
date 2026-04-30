// Trims frontmatter `title` (or hotel `name`) fields that exceed the safe SERP
// length once " | Ταξιδιάρης" (13 chars) is appended. Target: ≤47 chars.
//
// Strategy:
//   1. Cut at the first separator (`:`, `—`, `–`, or ` - `) when the resulting
//      head is between 15 and 47 chars — keeps the SEO core (place name, etc.).
//   2. Fallback: trim to last word boundary ≤47 chars and drop trailing
//      punctuation / Greek stopwords (της, του, και, με, σε, από...).
//
// Usage: node scripts/trim-long-titles.mjs [--apply]
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'content');
const SAFE_BODY = 47;
const APPLY = process.argv.includes('--apply');

const TRAILING_STOPWORDS = new Set([
  'της', 'του', 'το', 'τη', 'την', 'τα', 'τις', 'τους', 'των',
  'ο', 'η', 'οι', 'στο', 'στη', 'στην', 'στις', 'στους', 'στα',
  'και', 'με', 'σε', 'από', 'για', 'προς', 'στον',
]);

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

function trimTitle(title) {
  if (title.length <= SAFE_BODY) return title;

  // 1. Cut at first separator
  const sepMatch = title.match(/^(.+?)(?:\s*[:—–]\s*|\s+-\s+)/);
  if (sepMatch) {
    const head = sepMatch[1].trim();
    if (head.length >= 15 && head.length <= SAFE_BODY) return head;
  }

  // 2. Word-boundary trim at <=47, drop trailing stopwords/punctuation
  let trimmed = title.slice(0, SAFE_BODY);
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > 25) trimmed = trimmed.slice(0, lastSpace);
  // Drop trailing punctuation
  trimmed = trimmed.replace(/[,:;—–\-\s.·]+$/u, '');
  // Drop trailing Greek stopwords (one or two iterations)
  for (let i = 0; i < 2; i++) {
    const m = trimmed.match(/^(.+?)\s+(\S+)$/u);
    if (!m) break;
    if (TRAILING_STOPWORDS.has(m[2].toLowerCase())) {
      trimmed = m[1].replace(/[,:;—–\-\s.·]+$/u, '');
    } else break;
  }
  return trimmed;
}

const files = walk(ROOT);
const changes = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) continue;
  const [, openFence, fmBody, closeFence] = fmMatch;
  const fmStart = 0;
  const fmEnd = fmMatch[0].length;

  for (const key of ['title', 'name']) {
    // Match on its own line (handles double-quoted, single-quoted, or unquoted)
    const re = new RegExp(`^(${key}:\\s*)("([^"]+)"|'([^']+)'|([^\\n]+))$`, 'm');
    const m = fmBody.match(re);
    if (!m) continue;
    const value = (m[3] ?? m[4] ?? m[5] ?? '').trim();
    if (value.length <= SAFE_BODY) break;

    const newValue = trimTitle(value);
    if (newValue === value) break;

    // Reserialize with double quotes (escape any internal double quotes)
    const safe = newValue.replace(/"/g, '\\"');
    const newLine = `${m[1]}"${safe}"`;
    const newFmBody = fmBody.replace(re, newLine);
    const newRaw = openFence + newFmBody + closeFence + raw.slice(fmEnd);

    changes.push({
      file: file.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/'),
      key,
      oldLen: value.length,
      newLen: newValue.length,
      old: value,
      new: newValue,
      newRaw,
      filePath: file,
    });
    break;
  }
}

changes.sort((a, b) => b.oldLen - a.oldLen);

console.log(`${APPLY ? '[APPLY]' : '[DRY-RUN]'} Trimming ${changes.length} titles to ≤${SAFE_BODY} chars\n`);

let unchanged = 0;
for (const c of changes) {
  if (c.newLen > SAFE_BODY) unchanged += 1;
  console.log(`${String(c.oldLen).padStart(3)} → ${String(c.newLen).padStart(3)}  ${c.file}`);
  console.log(`        OLD: "${c.old}"`);
  console.log(`        NEW: "${c.new}"`);
  if (APPLY) writeFileSync(c.filePath, c.newRaw, 'utf8');
}

if (unchanged > 0) {
  console.log(`\n⚠ ${unchanged} title(s) still over limit after trim — manual review needed.`);
}
console.log(`\n${APPLY ? 'Applied' : 'Dry-run'}: ${changes.length} files.`);
