export const prerender = false;

import type { APIRoute } from 'astro';
import { adminPassword, makeToken, buildCookie } from '@lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const pw = body?.password;
  if (typeof pw !== 'string' || pw !== adminPassword()) {
    await new Promise((r) => setTimeout(r, 500));
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }
  const token = makeToken();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildCookie(token),
    },
  });
};
