import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

// ---------------------------------------------------------------------------
// Greek → Latin transliteration
// ---------------------------------------------------------------------------
// Per-character map. Covers all Modern Greek lowercase letters, accented
// vowels, and the final sigma (ς). Apply after String#toLowerCase().
const GR_LATIN: Record<string, string> = {
  α: 'a',  ά: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',  έ: 'e',
  ζ: 'z',
  η: 'i',  ή: 'i',
  θ: 'th',
  ι: 'i',  ί: 'i',  ϊ: 'i',  ΐ: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',  ό: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',  ς: 's',
  τ: 't',
  υ: 'y',  ύ: 'y',  ϋ: 'y',  ΰ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',  ώ: 'o',
};

export function slugifyCity(name: string): string {
  const lower = name.toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    out += GR_LATIN[ch] ?? ch;
  }
  // Anything that's not a-z/0-9 becomes a hyphen; collapse runs.
  return out
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Tour ↔ city queries
// ---------------------------------------------------------------------------

export interface DepartureCityEntry {
  /** Display name in Greek (canonical form, picked from the first tour that uses it). */
  name: string;
  /** URL slug (Latin, lowercase, hyphens). */
  slug: string;
  /** Tours that depart from this city (sorted by next upcoming date). */
  tours: CollectionEntry<'tours'>[];
}

/**
 * Walk all published tours, group them by every departure city they list,
 * and return the cities sorted alphabetically (Greek collation).
 */
export async function listDepartureCities(): Promise<DepartureCityEntry[]> {
  const all = await getCollection('tours', ({ data }) => !data.draft);
  const map = new Map<string, DepartureCityEntry>();
  for (const tour of all) {
    const cities = tour.data.departureCities ?? [];
    for (const raw of cities) {
      const name = String(raw).trim();
      if (!name) continue;
      const slug = slugifyCity(name);
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) {
        existing.tours.push(tour);
      } else {
        map.set(slug, { name, slug, tours: [tour] });
      }
    }
  }
  const out = Array.from(map.values());
  // Sort tours within each city by next upcoming departure (today first).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const city of out) {
    city.tours.sort((a, b) => {
      const ad = nextDate(a.data.dates ?? [], today);
      const bd = nextDate(b.data.dates ?? [], today);
      return ad - bd;
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

/** Find one city by slug, or undefined if no tour departs from it. */
export async function findDepartureCity(slug: string): Promise<DepartureCityEntry | undefined> {
  const all = await listDepartureCities();
  return all.find((c) => c.slug === slug);
}

function nextDate(
  dates: { from: string; to: string }[] | undefined,
  today: Date,
): number {
  if (!dates || dates.length === 0) return Number.MAX_SAFE_INTEGER;
  const future = dates
    .map((d) => new Date(d.from).getTime())
    .filter((t) => !isNaN(t) && t >= today.getTime())
    .sort((a, b) => a - b);
  if (future.length > 0) return future[0];
  // All past: sort by most recent past so they end up at the bottom but ordered.
  const past = dates
    .map((d) => new Date(d.from).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => b - a);
  return past.length > 0 ? Number.MAX_SAFE_INTEGER - past[0] : Number.MAX_SAFE_INTEGER;
}
