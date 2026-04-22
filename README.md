# Ταξιδιάρης — Travel Agency & Tourist Guide

SEO-first ταξιδιωτικό site για 70+ προορισμούς (Ελλάδα, Ευρώπη, Κόσμος) και 10 περιόδους εκδρομών.

## Stack
- **Astro 5** — static site generation, μηδέν JS by default
- **Tailwind CSS 3** — design system
- **TypeScript strict mode**
- **Content Collections** — markdown για κάθε προορισμό/περίοδο

## Εκκίνηση

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # production build → ./dist
npm run preview      # preview production build
```

## Δομή
```
src/
├── components/      # UI components (Header, MegaMenu, Card, FAQ, ...)
├── content/
│   ├── destinations/{ellada,europi,kosmos}/*.md
│   └── periods/*.md
├── content.config.ts
├── layouts/         # BaseLayout, DestinationLayout, PeriodLayout
├── lib/             # site config, destinations, periods, seo helpers
├── pages/           # routes
└── styles/          # global.css
```

## URLs (SEO-friendly)
- `/` — Αρχική
- `/proorismoi` — όλοι οι προορισμοί
- `/proorismoi/ellada/santorini` — μεμονωμένος προορισμός
- `/ekdromes/pasxa` — εκδρομές περιόδου
- `/blog` — άρθρα
- `/epikoinonia` — φόρμα επικοινωνίας

## Επεξεργασία περιεχομένου
Κάθε προορισμός είναι ένα markdown αρχείο στο `src/content/destinations/<περιοχή>/<slug>.md`. Επεξεργαστείτε:
- `title`, `description` — SEO meta
- `intro`, `bestTime`, `highlights[]`, `faqs[]`
- το κύριο σώμα (markdown)

Το ίδιο για `src/content/periods/<slug>.md`.

## Deployment
Το site είναι 100% στατικό. Deploy σε Vercel / Netlify / Cloudflare Pages / οποιοδήποτε CDN.
