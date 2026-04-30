export const prerender = false;

import type { APIRoute } from 'astro';
import { adminDb } from '@lib/db';
import { makeAgencyToken, buildAgencyCookie } from '@lib/agency-auth';

// Self-signup for travel agencies. Creates:
//   1. A Supabase auth.users row (email + password, email pre-confirmed)
//   2. An `agencies` row with status='pending' (Mina approves before
//      the agency goes public on the marketplace)
//   3. An `agency_users` link tying the user to the agency as 'owner'
//   4. Sets the HMAC session cookie so the user is logged in immediately
//
// Body: { agencyName, email, password, phone?, city?, description? }

const GR_LATIN: Record<string, string> = {
  α:'a', ά:'a', β:'v', γ:'g', δ:'d', ε:'e', έ:'e', ζ:'z',
  η:'i', ή:'i', θ:'th', ι:'i', ί:'i', ϊ:'i', ΐ:'i',
  κ:'k', λ:'l', μ:'m', ν:'n', ξ:'x', ο:'o', ό:'o',
  π:'p', ρ:'r', σ:'s', ς:'s', τ:'t', υ:'y', ύ:'y', ϋ:'y', ΰ:'y',
  φ:'f', χ:'ch', ψ:'ps', ω:'o', ώ:'o',
};
function slugify(name: string): string {
  const lower = name.toLowerCase().trim();
  let out = '';
  for (const ch of lower) out += GR_LATIN[ch] ?? ch;
  return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return jsonError('Μη έγκυρο JSON'); }

  const agencyName = String(body?.agencyName || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const phone = String(body?.phone || '').trim() || null;
  const city = String(body?.city || '').trim() || null;
  const description = String(body?.description || '').trim() || null;

  // --- Validation ---
  if (agencyName.length < 3) return jsonError('Το όνομα γραφείου πρέπει να έχει τουλάχιστον 3 χαρακτήρες');
  if (agencyName.length > 100) return jsonError('Το όνομα γραφείου είναι πολύ μεγάλο');
  if (!email.includes('@') || email.length < 5 || email.length > 254) return jsonError('Μη έγκυρο email');
  if (password.length < 8) return jsonError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες');
  if (password.length > 200) return jsonError('Ο κωδικός είναι υπερβολικά μεγάλος');

  const baseSlug = slugify(agencyName);
  if (!baseSlug || baseSlug.length < 2) {
    return jsonError('Το όνομα του γραφείου δεν παράγει έγκυρο URL — δοκίμασε άλλο');
  }

  const db = adminDb();

  // --- Check email isn't already in use ---
  try {
    const { data: list, error: listErr } = await db.auth.admin.listUsers();
    if (listErr) throw listErr;
    if (list.users.some((u) => u.email?.toLowerCase() === email)) {
      return jsonError('Το email χρησιμοποιείται ήδη. Πήγαινε στη σελίδα εισόδου.', 409);
    }
  } catch (e: any) {
    console.error('[agency/signup] listUsers failed:', e?.message || e);
    return jsonError('Τεχνικό σφάλμα κατά τον έλεγχο email', 500);
  }

  // --- Generate unique slug (append -2, -3, … if base is taken) ---
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix++) {
    const { data } = await db.from('agencies').select('id').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${suffix}`;
  }

  // --- Create auth user ---
  let userId: string;
  try {
    const { data: userData, error: userErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userErr || !userData?.user) throw userErr || new Error('no user returned');
    userId = userData.user.id;
  } catch (e: any) {
    console.error('[agency/signup] createUser failed:', e?.message || e);
    return jsonError('Σφάλμα δημιουργίας χρήστη: ' + (e?.message || 'unknown'), 500);
  }

  // --- Create agency (status='pending', awaits admin approval) ---
  let agencyId: string;
  try {
    const { data: agency, error: agencyErr } = await db
      .from('agencies')
      .insert({
        slug,
        name: agencyName,
        description,
        phone,
        email,
        city,
        status: 'pending',
      })
      .select('id')
      .single();
    if (agencyErr || !agency) throw agencyErr || new Error('no agency returned');
    agencyId = agency.id;
  } catch (e: any) {
    // Roll back the auth user so the user can retry without "email exists"
    await db.auth.admin.deleteUser(userId).catch(() => {});
    console.error('[agency/signup] createAgency failed:', e?.message || e);
    return jsonError('Σφάλμα δημιουργίας γραφείου: ' + (e?.message || 'unknown'), 500);
  }

  // --- Link user → agency ---
  try {
    const { error: linkErr } = await db
      .from('agency_users')
      .insert({ user_id: userId, agency_id: agencyId, role: 'owner' });
    if (linkErr) throw linkErr;
  } catch (e: any) {
    // Roll back agency + auth user
    await db.from('agencies').delete().eq('id', agencyId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
    console.error('[agency/signup] link user→agency failed:', e?.message || e);
    return jsonError('Σφάλμα σύνδεσης χρήστη με γραφείο: ' + (e?.message || 'unknown'), 500);
  }

  // --- Sign HMAC cookie so the user is logged in immediately ---
  const token = makeAgencyToken({ userId, agencyId, role: 'owner' });

  return new Response(
    JSON.stringify({ ok: true, redirectTo: '/agency', slug, status: 'pending' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildAgencyCookie(token),
      },
    },
  );
};
