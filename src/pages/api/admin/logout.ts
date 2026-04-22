export const prerender = false;

import type { APIRoute } from 'astro';
import { clearCookie } from '@lib/admin-auth';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': clearCookie(),
    },
  });
};
