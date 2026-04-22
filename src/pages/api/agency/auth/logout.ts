export const prerender = false;

import type { APIRoute } from 'astro';
import { clearAgencyCookie } from '@lib/agency-auth';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/agency/login',
      'Set-Cookie': clearAgencyCookie(),
    },
  });
};
