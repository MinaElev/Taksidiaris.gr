import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import matter from 'gray-matter';
import { writeFileToGitHub, deleteFileFromGitHub, isVercelRuntime } from './github-content';

const ROOT = process.cwd();
const DEST_DIR = join(ROOT, 'src', 'content', 'destinations');
const PLACE_DIR = join(ROOT, 'src', 'content', 'places');
const PERIOD_DIR = join(ROOT, 'src', 'content', 'periods');
const ARTICLE_DIR = join(ROOT, 'src', 'content', 'articles');
const TOUR_DIR = join(ROOT, 'src', 'content', 'tours');
const HOTEL_DIR = join(ROOT, 'src', 'content', 'hotels');

export type Region = 'ellada' | 'europi' | 'kosmos';

export interface DestinationFrontmatter {
  title: string;
  description: string;
  region: Region;
  hero?: string;
  intro?: string;
  bestTime?: string;
  duration?: string;
  highlights?: string[];
  faqs?: { q: string; a: string }[];
  keywords?: string[];
  draft?: boolean;
  updatedAt?: string;
}

export type PlaceType =
  | 'park'
  | 'beach'
  | 'village'
  | 'monument'
  | 'museum'
  | 'species'
  | 'island'
  | 'experience'
  | 'landmark';

export interface PlaceFrontmatter {
  title: string;
  description: string;
  // destination id: e.g. "ellada/alonnisos"
  destination: string;
  type: PlaceType;
  hero?: string;
  intro?: string;
  tagline?: string;
  faqs?: { q: string; a: string }[];
  keywords?: string[];
  sources?: { title: string; url: string }[];
  relatedPlaces?: string[];
  draft?: boolean;
  updatedAt?: string;
}

export interface PeriodFrontmatter {
  title: string;
  description: string;
  shortName?: string;
  dates?: string;
  intro?: string;
  hero?: string;
  popularDestinations?: string[];
  faqs?: { q: string; a: string }[];
  keywords?: string[];
  draft?: boolean;
}

export interface ArticleFrontmatter {
  title: string;
  description: string;
  cover?: string;
  publishedAt: string;
  updatedAt?: string;
  tags?: string[];
  related?: string[];
  draft?: boolean;
}

export interface HotelFrontmatter {
  name: string;
  aliases?: string[];
  description: string;
  destination: string;
  region: Region;
  city?: string;
  address?: string;
  stars?: number;
  category?: string;
  hero?: string;
  gallery?: string[];
  intro?: string;
  amenities?: string[];
  roomTypes?: { name: string; description?: string }[];
  distances?: { place: string; value: string }[];
  breakfast?: string;
  checkIn?: string;
  checkOut?: string;
  website?: string;
  coordinates?: { lat: number; lng: number };
  faqs?: { q: string; a: string }[];
  keywords?: string[];
  sources?: string[];
  draft?: boolean;
  updatedAt?: string;
}

export interface TourFrontmatter {
  title: string;
  description: string;
  destination: string;
  region: Region;
  period?: string;
  priceFrom?: number;
  currency?: string;
  duration: { days: number; nights: number };
  transport?: 'αεροπορικώς' | 'οδικώς' | 'ακτοπλοϊκώς' | 'συνδυαστικά';
  departureCities?: string[];
  pickupSchedule?: { city: string; location?: string; time?: string }[];
  dates?: { from: string; to: string; label?: string }[];
  hero?: string;
  gallery?: string[];
  intro?: string;
  itinerary?: { day: number; title: string; description: string }[];
  hotels?: { name: string; location?: string; nights?: number; board?: string; stars?: number }[];
  pricing?: { fromCity: string; perPerson: number; singleSupplement?: number; childDiscount?: string }[];
  includes?: string[];
  notIncludes?: string[];
  bookingProcess?: string[];
  cancellationPolicy?: string[];
  notes?: string[];
  faqs?: { q: string; a: string }[];
  keywords?: string[];
  related?: string[];
  draft?: boolean;
  updatedAt?: string;
}

interface ContentFile<T> {
  data: T;
  body: string;
}

function destPath(region: Region, slug: string) {
  return join(DEST_DIR, region, `${slug}.md`);
}
function placePath(destSlug: string, placeSlug: string) {
  return join(PLACE_DIR, destSlug, `${placeSlug}.md`);
}
function periodPath(slug: string) {
  return join(PERIOD_DIR, `${slug}.md`);
}
function articlePath(slug: string) {
  return join(ARTICLE_DIR, `${slug}.md`);
}
function tourPath(slug: string) {
  return join(TOUR_DIR, `${slug}.md`);
}
function hotelPath(slug: string) {
  return join(HOTEL_DIR, `${slug}.md`);
}

async function readMd<T>(path: string): Promise<ContentFile<T>> {
  const raw = await readFile(path, 'utf-8');
  const { data, content } = matter(raw);
  return { data: data as T, body: content };
}

// Coerce anything sortable into a comparable string. YAML parses unquoted
// dates like `2026-04-15` into Date objects, which break String.localeCompare
// downstream. Normalize here.
function asStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

// gray-matter → js-yaml σκάει σε `undefined` τιμές. Καθαρίζουμε αναδρομικά
// πριν το stringify ώστε να μην αποτυγχάνει το save όταν optional πεδία είναι κενά.
function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out;
  }
  return value;
}

async function writeMd<T>(path: string, data: T, body: string): Promise<void> {
  const cleanData = stripUndefined(data) as Record<string, unknown>;
  const out = matter.stringify(body, cleanData);
  if (isVercelRuntime()) {
    const relPath = relative(ROOT, path).replace(/\\/g, '/');
    const slug = path.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'unknown';
    await writeFileToGitHub(relPath, out, `Admin: update ${slug}`);
  } else {
    // Ensure the parent directory exists — new places for a destination that
    // has never had a place article before need the folder created first.
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, out, 'utf-8');
  }
}

export async function listDestinations(): Promise<{ region: Region; slug: string; data: DestinationFrontmatter }[]> {
  const out: { region: Region; slug: string; data: DestinationFrontmatter }[] = [];
  for (const region of ['ellada', 'europi', 'kosmos'] as Region[]) {
    const files = await readdir(join(DEST_DIR, region));
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      const slug = f.replace(/\.md$/, '');
      const { data } = await readMd<DestinationFrontmatter>(destPath(region, slug));
      out.push({ region, slug, data });
    }
  }
  return out.sort((a, b) => asStr(a.data.title).localeCompare(asStr(b.data.title), 'el'));
}

export async function readDestination(region: Region, slug: string) {
  return readMd<DestinationFrontmatter>(destPath(region, slug));
}
export async function writeDestination(region: Region, slug: string, data: DestinationFrontmatter, body: string) {
  return writeMd(destPath(region, slug), data, body);
}

// ─── Places CRUD ─────────────────────────────────────────────────────────────
// Places nest under a destination: src/content/places/{destSlug}/{placeSlug}.md
// The frontmatter `destination` field stores "{region}/{destSlug}" as FK.

export async function listPlaces(): Promise<{ region: Region; destSlug: string; placeSlug: string; data: PlaceFrontmatter }[]> {
  const out: { region: Region; destSlug: string; placeSlug: string; data: PlaceFrontmatter }[] = [];
  let destDirs: string[] = [];
  try {
    destDirs = await readdir(PLACE_DIR);
  } catch {
    return [];
  }
  for (const destSlug of destDirs) {
    let files: string[] = [];
    try {
      files = await readdir(join(PLACE_DIR, destSlug));
    } catch {
      continue;
    }
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      const placeSlug = f.replace(/\.md$/, '');
      try {
        const { data } = await readMd<PlaceFrontmatter>(placePath(destSlug, placeSlug));
        // Derive region from the `destination` FK, which is "{region}/{destSlug}"
        const [region] = (data.destination || '').split('/');
        if (['ellada', 'europi', 'kosmos'].includes(region)) {
          out.push({ region: region as Region, destSlug, placeSlug, data });
        }
      } catch {
        // Skip unreadable files rather than crashing the whole listing.
      }
    }
  }
  return out.sort((a, b) => asStr(a.data.title).localeCompare(asStr(b.data.title), 'el'));
}

export async function listPlacesForDestination(destSlug: string): Promise<{ placeSlug: string; data: PlaceFrontmatter }[]> {
  let files: string[] = [];
  try {
    files = await readdir(join(PLACE_DIR, destSlug));
  } catch {
    return [];
  }
  const out: { placeSlug: string; data: PlaceFrontmatter }[] = [];
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const placeSlug = f.replace(/\.md$/, '');
    try {
      const { data } = await readMd<PlaceFrontmatter>(placePath(destSlug, placeSlug));
      out.push({ placeSlug, data });
    } catch {
      // Skip unreadable files
    }
  }
  return out.sort((a, b) => asStr(a.data.title).localeCompare(asStr(b.data.title), 'el'));
}

export async function readPlace(destSlug: string, placeSlug: string) {
  return readMd<PlaceFrontmatter>(placePath(destSlug, placeSlug));
}

export async function writePlace(destSlug: string, placeSlug: string, data: PlaceFrontmatter, body: string) {
  return writeMd(placePath(destSlug, placeSlug), data, body);
}

export async function deletePlace(destSlug: string, placeSlug: string) {
  const path = placePath(destSlug, placeSlug);
  if (isVercelRuntime()) {
    const relPath = relative(ROOT, path).replace(/\\/g, '/');
    await deleteFileFromGitHub(relPath, `Admin: delete place ${destSlug}/${placeSlug}`);
  } else {
    const { unlink } = await import('node:fs/promises');
    await unlink(path);
  }
}

export async function listPeriods() {
  const files = await readdir(PERIOD_DIR);
  const out: { slug: string; data: PeriodFrontmatter }[] = [];
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const slug = f.replace(/\.md$/, '');
    const { data } = await readMd<PeriodFrontmatter>(periodPath(slug));
    out.push({ slug, data });
  }
  return out;
}
export async function readPeriod(slug: string) {
  return readMd<PeriodFrontmatter>(periodPath(slug));
}
export async function writePeriod(slug: string, data: PeriodFrontmatter, body: string) {
  return writeMd(periodPath(slug), data, body);
}

export async function listArticles() {
  const files = await readdir(ARTICLE_DIR);
  const out: { slug: string; data: ArticleFrontmatter }[] = [];
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const slug = f.replace(/\.md$/, '');
    const { data } = await readMd<ArticleFrontmatter>(articlePath(slug));
    out.push({ slug, data });
  }
  return out.sort((a, b) => asStr(b.data.publishedAt).localeCompare(asStr(a.data.publishedAt)));
}
export async function readArticle(slug: string) {
  return readMd<ArticleFrontmatter>(articlePath(slug));
}
export async function writeArticle(slug: string, data: ArticleFrontmatter, body: string) {
  return writeMd(articlePath(slug), data, body);
}

export async function listTours() {
  const files = await readdir(TOUR_DIR);
  const out: { slug: string; data: TourFrontmatter }[] = [];
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const slug = f.replace(/\.md$/, '');
    const { data } = await readMd<TourFrontmatter>(tourPath(slug));
    out.push({ slug, data });
  }
  return out.sort((a, b) => asStr(a.data.title).localeCompare(asStr(b.data.title), 'el'));
}
export async function readTour(slug: string) {
  return readMd<TourFrontmatter>(tourPath(slug));
}
export async function writeTour(slug: string, data: TourFrontmatter, body: string) {
  return writeMd(tourPath(slug), data, body);
}

export async function listHotels() {
  let files: string[] = [];
  try {
    files = await readdir(HOTEL_DIR);
  } catch {
    return [];
  }
  const out: { slug: string; data: HotelFrontmatter }[] = [];
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const slug = f.replace(/\.md$/, '');
    const { data } = await readMd<HotelFrontmatter>(hotelPath(slug));
    out.push({ slug, data });
  }
  return out.sort((a, b) => asStr(a.data.name).localeCompare(asStr(b.data.name), 'el'));
}
export async function readHotel(slug: string) {
  return readMd<HotelFrontmatter>(hotelPath(slug));
}
export async function writeHotel(slug: string, data: HotelFrontmatter, body: string) {
  return writeMd(hotelPath(slug), data, body);
}
export async function deleteHotel(slug: string) {
  const path = hotelPath(slug);
  if (isVercelRuntime()) {
    const relPath = relative(ROOT, path).replace(/\\/g, '/');
    await deleteFileFromGitHub(relPath, `Admin: delete hotel ${slug}`);
  } else {
    const { unlink } = await import('node:fs/promises');
    await unlink(path);
  }
}
