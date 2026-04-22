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
      changefreq: 'weekly',
      priority: 0.7,
      filter: (page) => !page.includes('/admin') && !page.includes('/api'),
    }),
  ],
  vite: {
    ssr: { noExternal: [] },
  },
});
