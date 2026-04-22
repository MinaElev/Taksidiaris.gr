// ---------------------------------------------------------------------------
// Tours data access — Postgres (Supabase) edition.
//
// Mirrors the API surface of content-io.ts (`listTours`, `readTour`, `writeTour`,
// `deleteTour`) so call sites can swap to this module with minimal changes.
//
// Conversions:
//   • DB row uses snake_case + jsonb arrays. TourFrontmatter is camelCase.
//     `dbRowToTour()` and `tourToDbRow()` translate between the two.
//   • Slug is unique. We expose it as the primary identifier (same as the .md
//     filename), even though the table has a separate uuid `id`.
//   • `agencyId` is optional — null/undefined means "legacy / Mina-managed".
// ---------------------------------------------------------------------------

import { adminDb, publicDb } from './db';
import type { TourFrontmatter, Region } from './content-io';

export interface TourRecord {
  id: string;
  slug: string;
  agencyId: string | null;
  data: TourFrontmatter;
  body: string;
}

// --------------------------------------------------------------------------
// row ↔ frontmatter conversion
// --------------------------------------------------------------------------

function dbRowToTour(row: Record<string, any>): TourRecord {
  const data: TourFrontmatter = {
    title: row.title,
    description: row.description,
    destination: row.destination,
    region: row.region as Region,
    period: row.period ?? undefined,
    priceFrom: row.price_from != null ? Number(row.price_from) : undefined,
    currency: row.currency ?? '€',
    duration: {
      days: Number(row.duration_days),
      nights: Number(row.duration_nights),
    },
    transport: row.transport ?? undefined,
    departureCities: row.departure_cities ?? [],
    pickupSchedule: row.pickup_schedule ?? [],
    dates: row.dates ?? [],
    hero: row.hero ?? undefined,
    gallery: row.gallery ?? [],
    intro: row.intro ?? undefined,
    itinerary: row.itinerary ?? [],
    hotels: row.hotels ?? [],
    pricing: row.pricing ?? [],
    includes: row.includes ?? [],
    notIncludes: row.not_includes ?? [],
    bookingProcess: row.booking_process ?? [],
    cancellationPolicy: row.cancellation_policy ?? [],
    notes: row.notes ?? [],
    faqs: row.faqs ?? [],
    keywords: row.keywords ?? [],
    related: row.related ?? [],
    draft: Boolean(row.draft),
    updatedAt: row.updated_at ? String(row.updated_at).slice(0, 10) : undefined,
  };
  return {
    id: row.id,
    slug: row.slug,
    agencyId: row.agency_id ?? null,
    data,
    body: row.body ?? '',
  };
}

function tourToDbRow(
  slug: string,
  data: TourFrontmatter,
  body: string,
  agencyId: string | null,
): Record<string, any> {
  return {
    slug,
    agency_id: agencyId,
    title: data.title,
    description: data.description,
    destination: data.destination,
    region: data.region,
    period: data.period ?? null,
    price_from: data.priceFrom ?? null,
    currency: data.currency ?? '€',
    duration_days: data.duration.days,
    duration_nights: data.duration.nights,
    transport: data.transport ?? null,
    departure_cities: data.departureCities ?? [],
    pickup_schedule: data.pickupSchedule ?? [],
    dates: data.dates ?? [],
    hero: data.hero ?? null,
    gallery: data.gallery ?? [],
    intro: data.intro ?? null,
    itinerary: data.itinerary ?? [],
    hotels: data.hotels ?? [],
    pricing: data.pricing ?? [],
    includes: data.includes ?? [],
    not_includes: data.notIncludes ?? [],
    booking_process: data.bookingProcess ?? [],
    cancellation_policy: data.cancellationPolicy ?? [],
    notes: data.notes ?? [],
    faqs: data.faqs ?? [],
    keywords: data.keywords ?? [],
    related: data.related ?? [],
    body,
    draft: Boolean(data.draft),
  };
}

// --------------------------------------------------------------------------
// Public reads (RLS-filtered)
// --------------------------------------------------------------------------

/**
 * List tours that are visible to the public (non-draft + active agency or
 * legacy/no agency). Sorted by title (Greek collation).
 */
export async function listToursPublic(): Promise<TourRecord[]> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('*')
    .eq('draft', false)
    .order('title', { ascending: true });
  if (error) throw new Error(`listToursPublic failed: ${error.message}`);
  return (data || []).map(dbRowToTour);
}

/**
 * Read a single tour by slug from the public-visible set.
 * Returns null if not found / not public.
 */
export async function readTourPublic(slug: string): Promise<TourRecord | null> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('*')
    .eq('slug', slug)
    .eq('draft', false)
    .maybeSingle();
  if (error) throw new Error(`readTourPublic(${slug}) failed: ${error.message}`);
  return data ? dbRowToTour(data) : null;
}

// --------------------------------------------------------------------------
// Admin reads/writes (service role, bypasses RLS) — used by Mina's panel.
// Agency portal will gain a separate scoped variant later (Phase 0.2).
// --------------------------------------------------------------------------

/**
 * List ALL tours (including drafts and suspended-agency ones). Admin only.
 */
export async function listToursAdmin(): Promise<TourRecord[]> {
  const { data, error } = await adminDb()
    .from('tours')
    .select('*')
    .order('title', { ascending: true });
  if (error) throw new Error(`listToursAdmin failed: ${error.message}`);
  return (data || []).map(dbRowToTour);
}

export async function readTourAdmin(slug: string): Promise<TourRecord | null> {
  const { data, error } = await adminDb()
    .from('tours')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`readTourAdmin(${slug}) failed: ${error.message}`);
  return data ? dbRowToTour(data) : null;
}

/**
 * Upsert a tour by slug (insert if missing, otherwise update). Admin only.
 * `agencyId` defaults to keeping the existing value (or null on insert).
 */
export async function writeTourAdmin(
  slug: string,
  data: TourFrontmatter,
  body: string,
  agencyId?: string | null,
): Promise<TourRecord> {
  const db = adminDb();
  // Look up existing row to preserve agency_id if not specified explicitly.
  const existing = await readTourAdmin(slug);
  const finalAgencyId =
    agencyId !== undefined ? agencyId : existing?.agencyId ?? null;
  const row = tourToDbRow(slug, data, body, finalAgencyId);

  const { data: saved, error } = await db
    .from('tours')
    .upsert(row, { onConflict: 'slug' })
    .select('*')
    .single();
  if (error) throw new Error(`writeTourAdmin(${slug}) failed: ${error.message}`);
  return dbRowToTour(saved);
}

export async function deleteTourAdmin(slug: string): Promise<void> {
  const { error } = await adminDb().from('tours').delete().eq('slug', slug);
  if (error) throw new Error(`deleteTourAdmin(${slug}) failed: ${error.message}`);
}

// --------------------------------------------------------------------------
// Convenience: list tours that match a region or destination.
// Useful for the existing region/destination pages.
// --------------------------------------------------------------------------

export async function listToursByRegion(region: Region): Promise<TourRecord[]> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('*')
    .eq('region', region)
    .eq('draft', false)
    .order('title', { ascending: true });
  if (error) throw new Error(`listToursByRegion(${region}) failed: ${error.message}`);
  return (data || []).map(dbRowToTour);
}

export async function listToursByDestination(destination: string): Promise<TourRecord[]> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('*')
    .eq('destination', destination)
    .eq('draft', false);
  if (error) throw new Error(`listToursByDestination failed: ${error.message}`);
  return (data || []).map(dbRowToTour);
}

/**
 * Tours that include a given departure city in their `departure_cities` array.
 * Uses jsonb `contains` operator — backed by GIN index on departure_cities.
 */
export async function listToursByDepartureCity(city: string): Promise<TourRecord[]> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('*')
    .eq('draft', false)
    .contains('departure_cities', [city]);
  if (error) throw new Error(`listToursByDepartureCity(${city}) failed: ${error.message}`);
  return (data || []).map(dbRowToTour);
}
