import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from '@lib/admin-auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  const isAdmin = path.startsWith('/admin') && path !== '/admin/login';
  const isAdminApi = path.startsWith('/api/admin') && path !== '/api/admin/login';

  if (isAdmin || isAdminApi) {
    if (!isAuthenticated(context.request)) {
      if (isAdminApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/admin/login');
    }
  }

  return next();
});
