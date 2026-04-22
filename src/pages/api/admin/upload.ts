export const prerender = false;

import type { APIRoute } from 'astro';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const UPLOAD_DIR = join(process.cwd(), 'public', 'images', 'uploads');
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const MAX_BYTES = 8 * 1024 * 1024;

function safeName(name: string): string {
  const ext = extname(name).toLowerCase();
  const base = name.slice(0, name.length - ext.length)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'image';
  return `${base}-${Date.now().toString(36)}${ext}`;
}

export const POST: APIRoute = async ({ request }) => {
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

  const filename = safeName(file.name);
  await mkdir(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, filename), buf);

  const url = `/images/uploads/${filename}`;
  return new Response(JSON.stringify({ url, filename, size: file.size }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
