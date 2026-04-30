export const prerender = false;

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { adminDb } from '@lib/db';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB raw upload
const MAX_DIM = 1920;
const TARGET_QUALITY = 80;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Multipart upload of a tour hero image.
 *   1. Read multipart/form-data — single field `file`
 *   2. Validate type & size
 *   3. Resize to ≤1920px wide, re-encode JPEG @80
 *   4. Upload to Supabase storage at tour-heroes/<agency-slug>-<ts>.jpg
 *   5. Return the public URL — caller writes it into the tour row
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const session = (locals as any).agency;
  if (!session) return jsonError('Unauthorized', 401);

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

  let outBuf: Buffer;
  try {
    const inBuf = Buffer.from(await file.arrayBuffer());
    outBuf = await sharp(inBuf)
      .rotate()
      .resize({ width: MAX_DIM, withoutEnlargement: true })
      .jpeg({ quality: TARGET_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();
  } catch (e: any) {
    console.error('[agency/upload-hero] sharp failed:', e?.message || e);
    return jsonError('Δεν μπόρεσα να επεξεργαστώ την εικόνα', 400);
  }

  const ts = Date.now();
  const path = `tour-heroes/${session.agencyId}-${ts}.jpg`;
  try {
    const { error } = await adminDb()
      .storage
      .from('uploads')
      .upload(path, outBuf, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });
    if (error) throw error;
  } catch (e: any) {
    console.error('[agency/upload-hero] storage upload failed:', e?.message || e);
    return jsonError('Σφάλμα μεταφόρτωσης: ' + (e?.message || ''), 500);
  }

  const supabaseUrl = process.env.SUPABASE_URL || (import.meta.env as any).SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${path}`;

  return new Response(JSON.stringify({ ok: true, url: publicUrl, sizeKb: Math.round(outBuf.length / 1024) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
