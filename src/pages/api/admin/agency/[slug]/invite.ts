export const prerender = false;

import type { APIRoute } from 'astro';
import { readAgencyAdmin, inviteAgencyUser } from '@lib/agencies-db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ params, request }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return jsonError('Valid email required');
  const role = ['owner', 'editor'].includes(payload?.role) ? payload.role : 'owner';

  const agency = await readAgencyAdmin(slug);
  if (!agency) return jsonError('Agency not found', 404);

  try {
    const result = await inviteAgencyUser(email, agency.id, role);
    return new Response(
      JSON.stringify({
        ok: true,
        userId: result.userId,
        invited: result.invited,
        message: result.invited
          ? 'Στάλθηκε email πρόσκλησης με magic link'
          : 'Ο χρήστης υπήρχε ήδη — απλά συνδέθηκε στο γραφείο',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/agency invite ${slug}] failed:`, detail);
    return new Response(JSON.stringify({ error: 'Invite failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
