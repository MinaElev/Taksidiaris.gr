// Fetches a representative photo URL from Wikipedia for each period
// (Christmas, Easter, summer etc.) and writes it as `hero:` into the
// period's .md frontmatter.
//
// Same approach as fetch-destination-heroes.mjs but periods need an explicit
// per-slug Wikipedia article mapping since slugs don't map to a place.
//
// Run: node scripts/fetch-period-heroes.mjs [--force]

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PERIOD_DIR = join(ROOT, 'src', 'content', 'periods');
const FORCE = process.argv.includes('--force');

// Period slug → Wikipedia article that has a representative travel image
// for that holiday. Picked to match the typical mood/destination customers
// associate with each period.
const WIKI_TITLE = {
  'christougenna':    'Christkindlmarkt',          // Vienna/Nuremberg Christmas market
  'pasxa':            'Easter_in_Greece',          // Greek Orthodox Easter; fallback handled below
  'apokries':         'Carnival_of_Venice',        // iconic carnival mask
  'agiou-valentinou': 'Eiffel_Tower',              // romantic Paris
  'agiou-pnevmatos':  'Mykonos',                   // long-weekend Greek islands
  'kalokairi':        'Santorini',                 // summer Greek islands
  'protomagia':       'Keukenhof',                 // tulip season (Amsterdam region)
  '25-martiou':       'Acropolis_of_Athens',       // Greek Independence Day
  '28-oktovriou':     'Athens',                    // long weekend, autumn city
  '17-noemvri':       'Plaka',                     // autumn Athens stroll
};

// Fallback chain — if first article has no image or is missing, try these
const WIKI_FALLBACK = {
  'pasxa': ['Holy_Week_in_Greece', 'Patmos', 'Hydra_(island)'],
};

async function fetchWikiImage(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Taksidiaris.gr-content-bot (contact: admin@taksidiaris.gr)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Wiki ${res.status} for ${title}`);
  }
  const data = await res.json();
  const src = data.originalimage?.source || data.thumbnail?.source;
  if (!src) throw new Error(`No image found for ${title}`);
  return src;
}

async function tryFetch(slug) {
  const titles = [WIKI_TITLE[slug], ...(WIKI_FALLBACK[slug] || [])];
  let lastErr;
  for (const t of titles) {
    if (!t) continue;
    try {
      const img = await fetchWikiImage(t);
      return { img, title: t };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`No mapping for ${slug}`);
}

async function processFile(file) {
  const slug = file.replace(/\.md$/, '');
  const path = join(PERIOD_DIR, file);
  const raw = await readFile(path, 'utf-8');
  const parsed = matter(raw);
  if (parsed.data.hero && !FORCE) {
    console.log(`SKIP  ${slug} — already has hero`);
    return { ok: true, skipped: true };
  }

  try {
    const { img, title } = await tryFetch(slug);
    parsed.data.hero = img;
    const out = matter.stringify(parsed.content, parsed.data);
    await writeFile(path, out, 'utf-8');
    console.log(`OK    ${slug} ← ${title}`);
    return { ok: true, slug, hero: img };
  } catch (err) {
    console.error(`FAIL  ${slug}: ${err.message}`);
    return { ok: false, slug, error: err.message };
  }
}

async function main() {
  const files = (await readdir(PERIOD_DIR)).filter((f) => f.endsWith('.md'));
  const failures = [];
  for (const f of files) {
    const result = await processFile(f);
    if (!result.ok) failures.push(`${f.replace('.md', '')}: ${result.error}`);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('\n--- Summary ---');
  if (failures.length === 0) {
    console.log('All periods have a hero image.');
  } else {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) console.log('  - ' + f);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
