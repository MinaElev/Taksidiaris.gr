export const prerender = false;

import type { APIRoute } from 'astro';
import { writeDestination, listDestinations, type Region } from '@lib/content-io';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_REGIONS: Region[] = ['ellada', 'europi', 'kosmos'];

const GR_LATIN: Record<string, string> = {
  α:'a', ά:'a', β:'v', γ:'g', δ:'d', ε:'e', έ:'e', ζ:'z',
  η:'i', ή:'i', θ:'th', ι:'i', ί:'i', ϊ:'i', ΐ:'i',
  κ:'k', λ:'l', μ:'m', ν:'n', ξ:'x', ο:'o', ό:'o',
  π:'p', ρ:'r', σ:'s', ς:'s', τ:'t', υ:'y', ύ:'y', ϋ:'y', ΰ:'y',
  φ:'f', χ:'ch', ψ:'ps', ω:'o', ώ:'o',
};
function slugify(s: string): string {
  const lower = s.toLowerCase().trim();
  let out = '';
  for (const ch of lower) out += GR_LATIN[ch] ?? ch;
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Lightweight stub-destination creation for agencies.
 *
 * Agencies sometimes promote tours to destinations the admin hasn't
 * curated yet (small Greek villages, niche European cities, etc.). Rather
 * than block the tour-creation flow, we let the agency open a stub
 * destination on the spot — title + region only, marked as draft. The
 * admin enriches it later from /admin/destinations/<region>/<slug>.
 *
 * Body: { title: string, region: 'ellada' | 'europi' | 'kosmos' }
 *
 * Returns: { ok: true, slug, region, title } on success, or
 *          { ok: true, slug, region, title, alreadyExists: true } if a
 *          destination with that title/slug already exists in the same
 *          region (idempotent — caller treats both cases the same way).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  let body: any;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON'); }

  const title = String(body?.title || '').trim();
  if (title.length < 2) return jsonError('Title too short (min 2 chars)');
  if (title.length > 100) return jsonError('Title too long');

  const region = String(body?.region || '').trim() as Region;
  if (!VALID_REGIONS.includes(region)) {
    return jsonError('region must be ellada, europi, or kosmos');
  }

  const slug = slugify(title);
  if (!slug) return jsonError('Could not derive slug from title');

  // Check for existing destination by either slug or exact title (case-insensitive)
  // — if found, return the canonical slug so the caller can wire the tour to it.
  const all = await listDestinations();
  const titleNorm = title.toLowerCase();
  const existing = all.find(
    (d) => d.region === region && (d.slug === slug || d.data.title.toLowerCase() === titleNorm),
  );
  if (existing) {
    return new Response(
      JSON.stringify({
        ok: true,
        alreadyExists: true,
        slug: existing.slug,
        region: existing.region,
        title: existing.data.title,
        draft: existing.data.draft,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Create a draft stub. The admin will enrich (intro, hero, FAQs, body, etc.)
  // from /admin/destinations/<region>/<slug>.
  const today = new Date().toISOString().slice(0, 10);
  const stubData = {
    title,
    description: `${title}: ταξιδιωτικός οδηγός και οργανωμένες εκδρομές για ${title}.`,
    region,
    intro: undefined,
    bestTime: undefined,
    duration: undefined,
    highlights: [],
    faqs: [],
    keywords: [title],
    draft: true, // agency-created stub stays hidden until admin reviews
    updatedAt: today,
  };
  const stubBody = `## ${title}\n\nΑναλυτικός οδηγός σύντομα. (Stub δημιουργημένο από γραφείο ${session.agencyId} στις ${today}.)\n`;

  try {
    await writeDestination(region, slug, stubData, stubBody);
    return new Response(
      JSON.stringify({ ok: true, slug, region, title, draft: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[agency/destination/create]', e?.message || e);
    return jsonError('Failed to create destination: ' + (e?.message || ''), 500);
  }
};
