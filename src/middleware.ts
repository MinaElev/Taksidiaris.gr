import { defineMiddleware } from 'astro:middleware';
import { isAuthenticated } from '@lib/admin-auth';
import { getAgencySession } from '@lib/agency-auth';

// Public sub-paths inside /agency that must work without a session.
// `/agency/login`         — the login form
// `/agency/auth/callback` — magic-link landing (sets the cookie)
// `/api/agency/auth/*`    — sending the magic link + the logout endpoint
function isPublicAgencyPath(path: string): boolean {
  return (
    path === '/agency/login' ||
    path.startsWith('/agency/auth/') ||
    path.startsWith('/api/agency/auth/')
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // ---- Admin guard (Mina) ----------------------------------------------
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

  // ---- Agency portal guard (third-party agencies) ----------------------
  const isAgencyPage = path.startsWith('/agency') && !isPublicAgencyPath(path);
  const isAgencyApi = path.startsWith('/api/agency') && !isPublicAgencyPath(path);

  if (isAgencyPage || isAgencyApi) {
    const session = getAgencySession(context.request);
    if (!session) {
      if (isAgencyApi) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/agency/login');
    }
    // Stash on locals so pages/API handlers can read userId/agencyId/role
    // without re-parsing the cookie.
    (context.locals as any).agency = session;
  }

  return next();
});
