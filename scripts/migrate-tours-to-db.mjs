// Migrates the existing markdown tours into the Postgres `tours` table.
//
// All migrated tours land with `agency_id = NULL` — they're "legacy" /
// Mina-managed and stay publicly visible (the RLS policy allows
// `agency_id IS NULL`). Mina can reassign them to a real agency later from
// the admin panel.
//
// Usage:
//   node --env-file=.env scripts/migrate-tours-to-db.mjs            # dry run by default
//   node --env-file=.env scripts/migrate-tours-to-db.mjs --apply    # actually upsert
//   node --env-file=.env scripts/migrate-tours-to-db.mjs --apply --only=<slug>
//
// Idempotent: uses `upsert` on the unique `slug` column. Safe to re-run.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const TOUR_DIR = join(ROOT, 'src', 'content', 'tours');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// --------------------------------------------------------------------------

function asStr(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function asNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asArr(v) {
  return Array.isArray(v) ? v : [];
}

// YAML may have parsed dates inside `dates: [{from, to, label}]` to Date objects.
// Convert back to YYYY-MM-DD strings so the jsonb column stores plain text.
function normalizeDates(arr) {
  return asArr(arr).map((d) => ({
    from: asStr(d?.from),
    to: asStr(d?.to),
    ...(d?.label ? { label: String(d.label) } : {}),
  }));
}

function frontmatterToRow(slug, data, body) {
  return {
    slug,
    agency_id: null, // legacy / Mina-managed
    title: String(data.title),
    description: String(data.description),
    destination: String(data.destination),
    region: String(data.region),
    period: data.period ? String(data.period) : null,
    price_from: asNum(data.priceFrom),
    currency: data.currency || '€',
    duration_days: asNum(data?.duration?.days),
    duration_nights: asNum(data?.duration?.nights),
    transport: data.transport || null,
    departure_cities: asArr(data.departureCities).map(String),
    pickup_schedule: asArr(data.pickupSchedule).map((p) => ({
      city: String(p.city),
      ...(p.location ? { location: String(p.location) } : {}),
      ...(p.time ? { time: String(p.time) } : {}),
    })),
    dates: normalizeDates(data.dates),
    hero: data.hero || null,
    gallery: asArr(data.gallery).map(String),
    intro: data.intro || null,
    itinerary: asArr(data.itinerary).map((d, i) => ({
      day: asNum(d.day) ?? i + 1,
      title: String(d.title || `Ημέρα ${i + 1}`),
      description: String(d.description || ''),
    })),
    hotels: asArr(data.hotels).map((h) => ({
      name: String(h.name),
      ...(h.location ? { location: String(h.location) } : {}),
      ...(h.nights != null ? { nights: asNum(h.nights) } : {}),
      ...(h.board ? { board: String(h.board) } : {}),
      ...(h.stars != null ? { stars: asNum(h.stars) } : {}),
    })),
    pricing: asArr(data.pricing).map((p) => ({
      fromCity: String(p.fromCity),
      perPerson: asNum(p.perPerson),
      ...(p.singleSupplement != null ? { singleSupplement: asNum(p.singleSupplement) } : {}),
      ...(p.childDiscount ? { childDiscount: String(p.childDiscount) } : {}),
    })),
    includes: asArr(data.includes).map(String),
    not_includes: asArr(data.notIncludes).map(String),
    booking_process: asArr(data.bookingProcess).map(String),
    cancellation_policy: asArr(data.cancellationPolicy).map(String),
    notes: asArr(data.notes).map(String),
    faqs: asArr(data.faqs)
      .filter((f) => f && typeof f.q === 'string' && typeof f.a === 'string')
      .map((f) => ({ q: String(f.q), a: String(f.a) })),
    keywords: asArr(data.keywords).map(String),
    related: asArr(data.related).map(String),
    body: body || '',
    draft: Boolean(data.draft),
  };
}

// --------------------------------------------------------------------------

async function main() {
  console.log(`[migrate-tours] mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  if (ONLY) console.log(`[migrate-tours] only: ${ONLY}`);

  let files = [];
  try {
    files = await readdir(TOUR_DIR);
  } catch (e) {
    console.error(`Cannot read ${TOUR_DIR}: ${e.message}`);
    process.exit(1);
  }
  files = files.filter((f) => f.endsWith('.md'));

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    if (ONLY && slug !== ONLY) {
      skipped++;
      continue;
    }
    const path = join(TOUR_DIR, f);
    const raw = await readFile(path, 'utf-8');
    const { data, content } = matter(raw);

    let row;
    try {
      row = frontmatterToRow(slug, data, content);
    } catch (e) {
      console.error(`  ✗ ${slug}: convert failed: ${e.message}`);
      failed++;
      continue;
    }

    // Required-field sanity check (mirrors the CHECK constraints).
    const missing = [];
    if (!row.title) missing.push('title');
    if (!row.description) missing.push('description');
    if (!row.destination) missing.push('destination');
    if (!['ellada', 'europi', 'kosmos'].includes(row.region)) missing.push('region');
    if (!row.duration_days || row.duration_days < 1) missing.push('duration.days');
    if (row.duration_nights == null || row.duration_nights < 0) missing.push('duration.nights');
    if (missing.length) {
      console.error(`  ✗ ${slug}: missing/invalid fields → ${missing.join(', ')}`);
      failed++;
      continue;
    }

    if (!APPLY) {
      console.log(
        `  • ${slug} → would upsert (region=${row.region}, dest=${row.destination}, days=${row.duration_days}, departures=${row.departure_cities.length})`,
      );
      ok++;
      continue;
    }

    const { error } = await db
      .from('tours')
      .upsert(row, { onConflict: 'slug' });
    if (error) {
      console.error(`  ✗ ${slug}: upsert failed → ${error.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${slug} → upserted`);
      ok++;
    }
  }

  console.log('---');
  console.log(`done: ok=${ok}, failed=${failed}, skipped=${skipped}`);
  if (!APPLY) {
    console.log('(dry run — re-run with --apply to actually write)');
  }
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[migrate-tours] fatal:', e);
  process.exit(1);
});
