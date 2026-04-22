import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://taksidiaris.gr',
  trailingSlash: 'never',
  output: 'static',
  adapter: vercel(),
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
