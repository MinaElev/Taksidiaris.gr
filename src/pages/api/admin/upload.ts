export const prerender = false;

import type { APIRoute } from 'astro';
import { extname } from 'node:path';
import { supabase, SUPABASE_BUCKET, publicUrl } from '@lib/supabase';

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const MAX_BYTES = 8 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

function safeName(name: string, ext: string): string {
  const base = name.slice(0, name.length - ext.length)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'image';
  return `${base}-${Date.now().toString(36)}${ext}`;
}

export const POST: APIRoute = async ({ request, url }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return new Response('file is required', { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(`File too large (max ${MAX_BYTES / 1024 / 1024}MB)`, { status: 413 });
  }
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return new Response(`Extension ${ext || '(none)'} not allowed`, { status: 415 });
  }

  const folder = String(form.get('folder') || 'misc').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'misc';
  const filename = safeName(file.name, ext);
  const path = `${folder}/${filename}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, buf, {
      contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    return new Response(`Upload failed: ${error.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({
    url: publicUrl(path),
    path,
    filename,
    size: file.size,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
