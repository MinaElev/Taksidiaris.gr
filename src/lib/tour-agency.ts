// ---------------------------------------------------------------------------
// Tour ↔ Agency bridge.
//
// Why this exists: Phase 0 keeps tour CONTENT in markdown (where Mina is
// already comfortable editing) but stores the agency ASSIGNMENT in Postgres
// (so it can change without git commits and so multi-agency portal works).
//
// Each tour has a row in `public.tours` (via the migration script) keyed by
// `slug`. Its `agency_id` column tells us which agency owns it; NULL means
// legacy / Mina-managed.
//
// Public site: tour page reads markdown for content + asks
//   `getAgencyForTourSlug(slug)` for agency contact info to show.
//
// Admin: `/admin/tours/<slug>` has a dropdown that calls
//   `setAgencyForTourSlug(slug, agencyId)` via PUT /api/admin/tour/[slug]/agency.
// ---------------------------------------------------------------------------

import { adminDb, publicDb } from './db';
import type { Agency } from './agencies-db';
import { readAgencyByIdAdmin } from './agencies-db';

interface TourAgencyRow {
  agency_id: string | null;
  agencies: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    vat: string | null;
    eot_license: string | null;
    status: string;
  } | null;
}

function rowAgencyToAgency(row: TourAgencyRow['agencies']): Agency | null {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    logoUrl: row.logo_url,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
    city: row.city,
    vat: row.vat,
    eotLicense: row.eot_license,
    status: row.status as Agency['status'],
  };
}

/**
 * Public read: returns the active agency for a given tour slug, or null.
 * Used by tour pages at build time to show contact info.
 *
 * Returns null if:
 *   - tour slug not in DB (somehow)
 *   - tour has no agency_id (legacy)
 *   - the agency is suspended/pending (RLS hides it via publicDb)
 */
export async function getAgencyForTourSlug(slug: string): Promise<Agency | null> {
  // Two queries, simpler than a join — and the agency lookup is RLS-filtered
  // (publicDb only returns active agencies).
  const { data: tourRow, error: e1 } = await adminDb()
    .from('tours')
    .select('agency_id')
    .eq('slug', slug)
    .maybeSingle();
  if (e1) {
    console.error(`[tour-agency] tour lookup failed for ${slug}:`, e1.message);
    return null;
  }
  if (!tourRow?.agency_id) return null;

  const { data: agencyRow, error: e2 } = await publicDb()
    .from('agencies')
    .select('*')
    .eq('id', tourRow.agency_id)
    .maybeSingle();
  if (e2) {
    console.error(`[tour-agency] agency lookup failed for ${slug}:`, e2.message);
    return null;
  }
  return agencyRow ? rowAgencyToAgency(agencyRow as any) : null;
}

/**
 * Admin read: same as above but uses the admin client so suspended/pending
 * agencies are also returned. Used in /admin/tours/<slug> to show "currently
 * assigned to X".
 */
export async function getAgencyForTourSlugAdmin(slug: string): Promise<Agency | null> {
  const { data: tourRow, error } = await adminDb()
    .from('tours')
    .select('agency_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`getAgencyForTourSlugAdmin(${slug}) failed: ${error.message}`);
  if (!tourRow?.agency_id) return null;
  return readAgencyByIdAdmin(tourRow.agency_id);
}

/**
 * Admin write: assign / unassign a tour's agency.
 * Pass `null` to make it legacy (Mina-managed). Pass an agency id to assign.
 * Throws if tour slug not in DB.
 */
export async function setAgencyForTourSlug(
  slug: string,
  agencyId: string | null,
): Promise<void> {
  const { error } = await adminDb()
    .from('tours')
    .update({ agency_id: agencyId })
    .eq('slug', slug);
  if (error) throw new Error(`setAgencyForTourSlug(${slug}) failed: ${error.message}`);
}

/**
 * List public tours grouped by agency_id. Used by /grafeio/[slug] to render
 * "all tours by this agency" without N+1 queries from the agency profile page.
 */
export async function listTourSlugsByAgency(agencyId: string): Promise<string[]> {
  const { data, error } = await publicDb()
    .from('tours')
    .select('slug')
    .eq('agency_id', agencyId)
    .eq('draft', false)
    .order('title', { ascending: true });
  if (error) throw new Error(`listTourSlugsByAgency(${agencyId}) failed: ${error.message}`);
  return (data || []).map((r) => r.slug);
}
