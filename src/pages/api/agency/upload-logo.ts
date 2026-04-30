export const prerender = false;

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { adminDb } from '@lib/db';
import { readAgencyByIdAdmin, updateAgency } from '@lib/agencies-db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5MB raw upload
const MAX_DIM = 600;                      // resize to 600px max
const TARGET_QUALITY = 82;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Multipart upload of an agency logo. Steps:
 *   1. Read multipart/form-data — single field `file`
 *   2. Validate type & size
 *   3. Resize to ≤600px via sharp (preserves aspect, no enlargement)
 *   4. Re-encode as WebP @82 quality (smaller + universal browser support)
 *   5. Upload to Supabase storage at agency-logos/<slug>-<ts>.webp (upsert false)
 *   6. Update the agency row with the new logoUrl
 *   7. Return the public URL
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

  // Require multipart
  const ct = request.headers.get('content-type') || '';
  if (!ct.startsWith('multipart/form-data')) {
    return jsonError('Use multipart/form-data');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Could not parse form');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return jsonError('Missing file');

  if (file.size > MAX_INPUT_BYTES) {
    return jsonError(`Το αρχείο ξεπερνά τα ${MAX_INPUT_BYTES / 1024 / 1024}MB`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonError('Επιτρέπονται μόνο εικόνες (jpg/png/webp/gif)');
  }

  const agency = await readAgencyByIdAdmin(session.agencyId);
  if (!agency) return jsonError('Agency not found', 404);

  // Resize + re-encode
  let outBuf: Buffer;
  try {
    const inBuf = Buffer.from(await file.arrayBuffer());
    outBuf = await sharp(inBuf)
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: TARGET_QUALITY })
      .toBuffer();
  } catch (e: any) {
    console.error('[agency/upload-logo] sharp failed:', e?.message || e);
    return jsonError('Δεν μπόρεσα να επεξεργαστώ την εικόνα', 400);
  }

  // Upload to Supabase storage
  const ts = Date.now();
  const path = `agency-logos/${agency.slug}-${ts}.webp`;
  try {
    const { error } = await adminDb()
      .storage
      .from('uploads')
      .upload(path, outBuf, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '3600',
      });
    if (error) throw error;
  } catch (e: any) {
    console.error('[agency/upload-logo] storage upload failed:', e?.message || e);
    return jsonError('Σφάλμα μεταφόρτωσης: ' + (e?.message || ''), 500);
  }

  // Public URL via the standard /storage/v1/object/public/{bucket}/{path}
  const supabaseUrl = process.env.SUPABASE_URL || (import.meta.env as any).SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${path}`;

  // Save to agency row
  try {
    await updateAgency(agency.slug, { logoUrl: publicUrl });
  } catch (e: any) {
    console.error('[agency/upload-logo] update agency failed:', e?.message || e);
    // The file is uploaded but DB update failed — return URL anyway, user can paste manually
  }

  return new Response(JSON.stringify({ ok: true, url: publicUrl, sizeKb: Math.round(outBuf.length / 1024) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
