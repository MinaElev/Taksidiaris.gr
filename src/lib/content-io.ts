import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import { writeFileToGitHub, deleteFileFromGitHub, isVercelRuntime } from './github-content';

const ROOT = process.cwd();
const DEST_DIR = join(ROOT, 'src', 'content', 'destinations');
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

async function writeMd<T>(path: string, data: T, body: string): Promise<void> {
  const out = matter.stringify(body, data as Record<string, unknown>);
  if (isVercelRuntime()) {
    const relPath = relative(ROOT, path).replace(/\\/g, '/');
    const slug = path.split(/[/\\]/).pop()?.replace(/\.md$/, '') || 'unknown';
    await writeFileToGitHub(relPath, out, `Admin: update ${slug}`);
  } else {
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
  return out.sort((a, b) => a.data.title.localeCompare(b.data.title, 'el'));
}

export async function readDestination(region: Region, slug: string) {
  return readMd<DestinationFrontmatter>(destPath(region, slug));
}
export async function writeDestination(region: Region, slug: string, data: DestinationFrontmatter, body: string) {
  return writeMd(destPath(region, slug), data, body);
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
  return out.sort((a, b) => (b.data.publishedAt || '').localeCompare(a.data.publishedAt || ''));
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
  return out.sort((a, b) => a.data.title.localeCompare(b.data.title, 'el'));
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
  return out.sort((a, b) => a.data.name.localeCompare(b.data.name, 'el'));
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
