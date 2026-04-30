export const prerender = false;

import type { APIRoute } from 'astro';
import {
  readAgencyAdmin,
  updateAgency,
  deleteAgency,
} from '@lib/agencies-db';
import { sendEmail } from '@lib/email';
import { tplAgencyApproved } from '@lib/email-templates';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export const GET: APIRoute = async ({ params }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');
  try {
    const agency = await readAgencyAdmin(slug);
    if (!agency) return jsonError('Not found', 404);
    return new Response(JSON.stringify(agency), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return jsonError(String(e?.message || e), 500);
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON');
  }

  const patch: Record<string, any> = {};
  if (payload.name !== undefined) {
    const v = trimOrNull(payload.name);
    if (!v) return jsonError('name cannot be empty');
    patch.name = v;
  }
  if (payload.description !== undefined) patch.description = trimOrNull(payload.description);
  if (payload.logoUrl !== undefined) patch.logoUrl = trimOrNull(payload.logoUrl);
  if (payload.phone !== undefined) patch.phone = trimOrNull(payload.phone);
  if (payload.email !== undefined) patch.email = trimOrNull(payload.email);
  if (payload.website !== undefined) patch.website = trimOrNull(payload.website);
  if (payload.address !== undefined) patch.address = trimOrNull(payload.address);
  if (payload.city !== undefined) patch.city = trimOrNull(payload.city);
  if (payload.vat !== undefined) patch.vat = trimOrNull(payload.vat);
  if (payload.eotLicense !== undefined) patch.eotLicense = trimOrNull(payload.eotLicense);
  if (payload.status !== undefined) {
    if (!['active', 'suspended', 'pending'].includes(payload.status)) {
      return jsonError('status must be active, suspended, or pending');
    }
    patch.status = payload.status;
  }

  try {
    // Read previous status so we can detect a pending → active transition
    // and email the agency owner exactly once on approval.
    const previous = await readAgencyAdmin(slug);
    const agency = await updateAgency(slug, patch);

    if (
      previous &&
      previous.status !== 'active' &&
      agency.status === 'active' &&
      agency.email
    ) {
      // Fire-and-forget — never blocks the response
      sendEmail({
        to: agency.email,
        ...tplAgencyApproved({ agencyName: agency.name, slug: agency.slug }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, agency }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/agency PUT ${slug}] update failed:`, detail);
    return new Response(JSON.stringify({ error: 'Update failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const slug = String(params.slug || '');
  if (!slug) return jsonError('slug required');
  try {
    await deleteAgency(slug);
    // Tours' agency_id has ON DELETE SET NULL → tours survive as legacy.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[admin/agency DELETE ${slug}] delete failed:`, detail);
    return new Response(JSON.stringify({ error: 'Delete failed', detail }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
