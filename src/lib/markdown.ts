import { marked } from 'marked';

// ---------------------------------------------------------------------------
// Server-side markdown rendering for tour bodies stored in Postgres.
//
// Astro's content collections do this automatically for .md files at build
// time. We don't have that luxury for DB-stored bodies, so we render via
// marked at request time (or build time, depending on the page mode).
//
// Configured to match what Astro's default markdown produces well enough for
// our content (tour itineraries are simple — h2/h3, lists, paragraphs, links).
// ---------------------------------------------------------------------------

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(body: string | null | undefined): string {
  if (!body) return '';
  // marked.parse is sync when called without async-only extensions.
  return marked.parse(body) as string;
}
