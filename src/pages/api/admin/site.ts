export const prerender = false;

import type { APIRoute } from 'astro';
import { readSiteConfig, writeSiteConfig } from '@lib/site-config';

export const GET: APIRoute = async () => {
  const config = await readSiteConfig();
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const config = {
    homeHero: String(payload?.homeHero || '').trim(),
    homeHeroAlt: String(payload?.homeHeroAlt || '').trim(),
  };
  await writeSiteConfig(config);
  return new Response(JSON.stringify({ ok: true, ...config }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
