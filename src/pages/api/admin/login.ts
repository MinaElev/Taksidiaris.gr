export const prerender = false;

import type { APIRoute } from 'astro';
import { adminPassword, makeToken, buildCookie } from '@lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  // 1. Verify required env vars are configured (otherwise show a clear server error
  //    instead of a generic "wrong password" that confuses debugging on Vercel).
  let expected: string;
  try {
    expected = adminPassword();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured', detail: String(e?.message || e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 2. Parse body
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Verify password
  const pw = body?.password;
  if (typeof pw !== 'string' || pw !== expected) {
    await new Promise((r) => setTimeout(r, 500));
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Build session cookie. Catch SESSION_SECRET-missing here too.
  let token: string;
  try {
    token = makeToken();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured', detail: String(e?.message || e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildCookie(token),
    },
  });
};
