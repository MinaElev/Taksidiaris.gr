import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Collect every file under src/content so we can ship them with the Vercel
// serverless functions. The admin endpoints read these .md files at runtime
// (process.cwd()/src/content/...) — Vercel does not bundle them automatically.
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const contentFiles = walk(join(process.cwd(), 'src', 'content')).map((p) =>
  relative(process.cwd(), p).replace(/\\/g, '/'),
);

// https://astro.build/config
export default defineConfig({
  site: 'https://taksidiaris.gr',
  trailingSlash: 'never',
  output: 'static',
  adapter: vercel({
    includeFiles: contentFiles,
  }),
  security: {
    checkOrigin: false,
  },
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      i18n: {
        defaultLocale: 'el',
        locales: { el: 'el-GR' },
      },
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/api') &&
        !page.includes('/agency') &&
        !page.includes('/preview'),
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '') || '/';

        // Homepage — highest priority
        if (path === '/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        }
        // Place articles (deepest level, /proorismoi/<region>/<dest>/<place>)
        else if (/^\/proorismoi\/[^/]+\/[^/]+\/[^/]+$/.test(path)) {
          item.priority = 0.8;
          item.changefreq = 'monthly';
        }
        // Individual destinations (/proorismoi/<region>/<dest>)
        else if (/^\/proorismoi\/[^/]+\/[^/]+$/.test(path)) {
          item.priority = 0.9;
          item.changefreq = 'monthly';
        }
        // Destination region indexes (/proorismoi, /proorismoi/<region>)
        else if (/^\/proorismoi(\/[^/]+)?$/.test(path)) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        }
        // Period / seasonal tour pages (/ekdromes/<period>)
        else if (/^\/ekdromes\/[^/]+$/.test(path)) {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        }
        // Ekdromes index
        else if (path === '/ekdromes' || path === '/ekdromi') {
          item.priority = 0.8;
          item.changefreq = 'weekly';
        }
        // Blog articles
        else if (/^\/blog\/[^/]+$/.test(path)) {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        }
        else if (path === '/blog') {
          item.priority = 0.7;
          item.changefreq = 'weekly';
        }
        // Hotel pages
        else if (/^\/ksenodoxeia\/[^/]+$/.test(path)) {
          item.priority = 0.7;
          item.changefreq = 'monthly';
        }
        else if (path === '/ksenodoxeia') {
          item.priority = 0.7;
          item.changefreq = 'weekly';
        }
        // Supporting pages (company, contact, offices)
        else if (['/epikoinonia', '/etaireia', '/grafeia', '/anaxoriseis'].includes(path)) {
          item.priority = 0.4;
          item.changefreq = 'monthly';
        }
        // Agency (auth) pages — low priority, mostly internal
        else if (path.startsWith('/agency')) {
          item.priority = 0.2;
          item.changefreq = 'yearly';
        }
        else {
          item.priority = 0.5;
          item.changefreq = 'monthly';
        }

        // Add lastmod — signals freshness to Google on every deploy
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
  ],
  vite: {
    ssr: { noExternal: [] },
  },
});
