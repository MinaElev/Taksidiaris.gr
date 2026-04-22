// Fetches a representative photo URL from Wikipedia for each destination
// and writes it as `hero:` into the destination's .md frontmatter.
//
// Strategy: query Wikipedia REST API summary endpoint, extract `originalimage.source`
// (or `thumbnail.source` as fallback). Wikimedia URLs are CC-licensed and stable.
//
// Run: node scripts/fetch-destination-heroes.mjs
// Pass --force to overwrite an existing hero. Default: skip files that already have hero.
//
// Per-slug English Wikipedia title overrides for cases where the slug doesn't
// map cleanly to a Wikipedia article. Most slugs work as-is.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEST_DIR = join(ROOT, 'src', 'content', 'destinations');
const FORCE = process.argv.includes('--force');

// Slug → Wikipedia article title (English). Most slugs already match the title.
// Only listed here when slug ≠ Wikipedia title, or when we want a more iconic article
// (e.g. "Acropolis_of_Athens" instead of "Athens").
const WIKI_TITLE = {
  // Greece — most slugs already match
  irakleio: 'Heraklion',
  kerkyra: 'Corfu',
  rodos: 'Rhodes',
  chios: 'Chios',
  chania: 'Chania',
  thasos: 'Thasos',
  lefkada: 'Lefkada',
  kefalonia: 'Kefalonia',
  zakynthos: 'Zakynthos',
  alonnisos: 'Alonnisos',
  astypalaia: 'Astypalaia',
  folegandros: 'Folegandros',
  ios: 'Ios_(island)',
  patmos: 'Patmos',
  skiathos: 'Skiathos',
  skopelos: 'Skopelos',
  skyros: 'Skyros',
  syros: 'Syros',
  tinos: 'Tinos',
  paros: 'Paros',
  naxos: 'Naxos',
  milos: 'Milos',
  sifnos: 'Sifnos',
  santorini: 'Santorini',
  mykonos: 'Mykonos',
  lesvos: 'Lesbos',
  limnos: 'Lemnos',
  kos: 'Kos',
  // Europe
  warsaw: 'Warsaw',
  belgrade: 'Belgrade',
  venice: 'Venice',
  berlin: 'Berlin',
  budapest: 'Budapest',
  bucharest: 'Bucharest',
  vienna: 'Vienna',
  brussels: 'Brussels',
  zurich: 'Zurich',
  copenhagen: 'Copenhagen',
  krakow: 'Kraków',
  istanbul: 'Istanbul',
  lisbon: 'Lisbon',
  london: 'London',
  madrid: 'Madrid',
  malta: 'Valletta', // Malta is a country; Valletta is the capital with iconic skyline
  milan: 'Milan',
  bansko: 'Bansko',
  naples: 'Naples',
  dubrovnik: 'Dubrovnik',
  paris: 'Paris',
  prague: 'Prague',
  rome: 'Rome',
  sofia: 'Sofia',
  tallinn: 'Tallinn',
  florence: 'Florence',
  amsterdam: 'Amsterdam',
  barcelona: 'Barcelona',
  // World
  egypt: 'Pyramids_of_Giza',
  america: 'New_York_City',
  vietnam: 'Hạ_Long_Bay',
  japan: 'Mount_Fuji',
  jordan: 'Petra',
  cappadocia: 'Cappadocia',
  cuba: 'Havana',
  maldives: 'Maldives',
  morocco: 'Marrakesh',
  bali: 'Bali',
  dubai: 'Dubai',
  singapore: 'Singapore',
  thailand: 'Bangkok',
  tunisia: 'Tunis',
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
  // Prefer original (full-res) over thumbnail
  const src = data.originalimage?.source || data.thumbnail?.source;
  if (!src) throw new Error(`No image found for ${title}`);
  return src;
}

async function processFile(region, file) {
  const slug = file.replace(/\.md$/, '');
  const path = join(DEST_DIR, region, file);
  const raw = await readFile(path, 'utf-8');
  const parsed = matter(raw);
  if (parsed.data.hero && !FORCE) {
    console.log(`SKIP  ${region}/${slug} — already has hero`);
    return { ok: true, skipped: true };
  }

  const wikiTitle = WIKI_TITLE[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
  try {
    const img = await fetchWikiImage(wikiTitle);
    parsed.data.hero = img;
    const out = matter.stringify(parsed.content, parsed.data);
    await writeFile(path, out, 'utf-8');
    console.log(`OK    ${region}/${slug} ← ${wikiTitle}`);
    return { ok: true, slug, hero: img };
  } catch (err) {
    console.error(`FAIL  ${region}/${slug} (tried "${wikiTitle}"): ${err.message}`);
    return { ok: false, slug, error: err.message };
  }
}

async function main() {
  const regions = ['ellada', 'europi', 'kosmos'];
  const failures = [];
  for (const region of regions) {
    const files = (await readdir(join(DEST_DIR, region))).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const result = await processFile(region, f);
      if (!result.ok) failures.push(`${region}/${f.replace('.md', '')}: ${result.error}`);
      // Be polite to Wikipedia — small delay between requests
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  console.log('\n--- Summary ---');
  if (failures.length === 0) {
    console.log('All destinations have a hero image.');
  } else {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) console.log('  - ' + f);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
