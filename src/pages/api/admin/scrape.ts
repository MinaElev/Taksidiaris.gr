export const prerender = false;

import type { APIRoute } from 'astro';
import {
  streamClaude,
  streamClaudeWithWebSearch,
  extractJson,
  type ClaudeUsage,
} from '@lib/ai-client';
import { buildScrapePrompt, buildScrapeVerifyPrompt } from '@lib/ai-prompts';
import { recordUsage } from '@lib/ai-usage';
import { listHotels } from '@lib/content-io';

// ---------------------------------------------------------------------------
// /api/admin/scrape — multi-phase SSE pipeline.
//
// THIS IS THE FLAGSHIP FEATURE. Admins paste a competitor's tour URL and we
// turn it into a publishable draft. Three things matter most:
//   (1) ZERO HALLUCINATION on the headline facts (price, dates, hotels)
//   (2) REAL hotel verification — so we can later auto-link the tour to
//       hotel pages on our own site
//   (3) REAL images — both from the source page AND from each verified
//       hotel's official website.
//
// Pipeline emits these SSE events:
//   event: status   data: "🌐 Λήψη HTML…"           (multiple, one per phase)
//   event: token    data: "<text delta>"            (Phase 1 streaming)
//   event: phase    data: { phase: "extract"|"verify", done: false }
//   event: done     data: { ...all extracted+verified+enriched data }
//   event: error    data: { message: "..." }
//
// Phases:
//   1. Fetch source HTML.
//   2. Extract images via regex (server-side; replaces unreliable AI URLs).
//   3. Stream Claude extraction prompt — pure HTML→JSON, no web_search.
//   4. Web_search verification pass — verify each hotel + cross-check facts.
//   5. For each verified hotel with officialWebsite, scrape its photos.
//   6. Cross-reference scraped hotels with our hotel DB — flag orphans.
//   7. Emit `done` with the fully enriched payload.
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const url = String(body?.url || '').trim();
  if (!url || !/^https?:\/\//.test(url)) {
    return new Response('valid URL required', { status: 400 });
  }

  const startedAt = Date.now();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        // We aggregate usage across all Claude calls so the dashboard sees
        // the total cost of one scrape, not three separate cents.
        const totalUsage: ClaudeUsage = {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          server_tool_use: { web_search_requests: 0 },
        };
        const accumUsage = (u: ClaudeUsage | undefined) => {
          if (!u) return;
          totalUsage.input_tokens += u.input_tokens || 0;
          totalUsage.output_tokens += u.output_tokens || 0;
          totalUsage.cache_creation_input_tokens! += u.cache_creation_input_tokens || 0;
          totalUsage.cache_read_input_tokens! += u.cache_read_input_tokens || 0;
          totalUsage.server_tool_use!.web_search_requests! +=
            u.server_tool_use?.web_search_requests || 0;
        };

        try {
          // -----------------------------------------------------------------
          // PHASE 1 — Fetch the source HTML.
          // -----------------------------------------------------------------
          let host: string;
          try { host = new URL(url).hostname; } catch { host = url; }
          send('status', `🌐 Λήψη HTML από ${host}…`);

          let html: string;
          try {
            const r = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TaksidiariBot/1.0; +https://taksidiaris.gr)',
                Accept: 'text/html',
              },
              redirect: 'follow',
              signal: AbortSignal.timeout(20000),
            });
            if (!r.ok) {
              send('error', { message: `Fetch failed: HTTP ${r.status}` });
              controller.close();
              return;
            }
            html = await r.text();
          } catch (err: any) {
            send('error', { message: `Fetch error: ${err?.message || err}` });
            controller.close();
            return;
          }

          // -----------------------------------------------------------------
          // PHASE 2 — Regex-extract images from source HTML.
          // We do this BEFORE asking the model so they're already in hand
          // even if the AI step fails. Keeping image extraction server-side
          // avoids hallucinated URLs the model invents from training data.
          // -----------------------------------------------------------------
          send('status', '🖼 Συλλογή εικόνων από την πηγή…');
          const sourceImages = extractImagesFromHtml(html, url);

          // Pull JSON-LD blocks BEFORE stripping scripts — they often hold
          // structured tour data (dates, offers) the model would otherwise miss.
          const jsonLdBlocks: string[] = [];
          html.replace(
            /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
            (_, body) => {
              const trimmed = String(body || '').trim();
              if (trimmed) jsonLdBlocks.push(trimmed);
              return '';
            },
          );
          let cleaned = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\s+/g, ' ');
          if (jsonLdBlocks.length) {
            cleaned += '\n\n<!-- JSON-LD STRUCTURED DATA -->\n' + jsonLdBlocks.join('\n---\n');
          }

          // -----------------------------------------------------------------
          // PHASE 3 — Claude extracts facts from HTML (streaming, no web_search).
          // We stream tokens to the UI so the user sees progress during the
          // 60-180s wait. Adding web_search here would 2-3x cost without
          // benefit — the HTML already grounds extraction.
          // -----------------------------------------------------------------
          send('status', '🤖 Εξαγωγή στοιχείων από Claude (streaming)…');
          send('phase', { phase: 'extract', done: false });

          const { text: extractText, usage: extractUsage } = await streamClaude(
            buildScrapePrompt(url, cleaned),
            (delta) => send('token', delta),
            { maxTokens: 9000 },
          );
          accumUsage(extractUsage);

          let extracted: any;
          try {
            extracted = extractJson(extractText);
          } catch (parseErr: any) {
            send('error', { message: parseErr?.message || 'JSON parse failed', raw: extractText });
            recordUsage({
              kind: 'scrape', caller: 'admin', usage: totalUsage,
              meta: { url, ok: false, error: 'parse-extract', ms: Date.now() - startedAt },
            });
            controller.close();
            return;
          }
          send('phase', { phase: 'extract', done: true });

          // -----------------------------------------------------------------
          // PHASE 4 — Web_search verification of hotels + cross-check.
          // -----------------------------------------------------------------
          const extractedHotels: { name: string; location?: string; stars?: number }[] =
            Array.isArray(extracted.hotels)
              ? extracted.hotels
                  .filter((h: any) => h && typeof h.name === 'string' && h.name.trim())
                  .slice(0, 8)
                  .map((h: any) => ({
                    name: String(h.name).trim(),
                    location: h.location ? String(h.location) : undefined,
                    stars: h.stars ? Number(h.stars) : undefined,
                  }))
              : [];

          let verifyResult: any = { hotels: [], warnings: [] };
          if (extractedHotels.length || extracted.priceFrom || (extracted.dates || []).length) {
            const hotelCountLabel = extractedHotels.length
              ? `${extractedHotels.length} ξενοδοχείων`
              : 'βασικών στοιχείων';
            send('status', `🔍 Επιβεβαίωση ${hotelCountLabel} με web_search…`);
            send('phase', { phase: 'verify', done: false });

            const verifyPrompt = buildScrapeVerifyPrompt({
              sourceUrl: url,
              title: String(extracted.title || ''),
              destination: extracted.destination ? String(extracted.destination) : undefined,
              region: ['ellada','europi','kosmos'].includes(extracted.region) ? extracted.region : undefined,
              duration: extracted.duration || null,
              priceFrom: extracted.priceFrom ? Number(extracted.priceFrom) : null,
              currency: extracted.currency || '€',
              dates: Array.isArray(extracted.dates)
                ? extracted.dates.filter((d: any) => typeof d === 'string').slice(0, 12)
                : [],
              hotels: extractedHotels,
            });

            try {
              const { text: verifyText, usage: verifyUsage } = await streamClaudeWithWebSearch(
                verifyPrompt,
                () => { /* swallow tokens — verify step is short and noisy */ },
                { maxSearches: 6, maxTokens: 3000 },
              );
              accumUsage(verifyUsage);
              try {
                verifyResult = extractJson(verifyText);
              } catch {
                // Soft failure — verification is best-effort, don't break the whole scrape.
                verifyResult = { hotels: [], warnings: ['(αυτόματη επαλήθευση απέτυχε — έλεγξε χειροκίνητα)'] };
              }
            } catch (err: any) {
              verifyResult = {
                hotels: [],
                warnings: [`(η επαλήθευση απέτυχε: ${String(err?.message || err).slice(0, 100)})`],
              };
            }
            send('phase', { phase: 'verify', done: true });
          }

          // -----------------------------------------------------------------
          // PHASE 5 — Scrape images from each verified hotel's official website.
          // -----------------------------------------------------------------
          const verifiedHotels: any[] = Array.isArray(verifyResult.hotels) ? verifyResult.hotels : [];
          const hotelImagesByName = new Map<string, string[]>();
          for (const vh of verifiedHotels) {
            const officialWebsite = String(vh?.officialWebsite || '').trim();
            if (!officialWebsite || !/^https?:\/\//.test(officialWebsite)) continue;
            send('status', `🖼 Συλλογή φωτογραφιών για "${vh.name}"…`);
            const imgs = await fetchAndExtractImages(officialWebsite);
            if (imgs.length) hotelImagesByName.set(String(vh.name), imgs.slice(0, 12));
          }

          // -----------------------------------------------------------------
          // PHASE 6 — Cross-reference verified hotels with our DB.
          // Mirrors TourLayout's fuzzy match (lowercase + NFD strip accents
          // against name + aliases) so what we mark "in DB" is exactly what
          // would auto-link as a hyperlink on the public tour page.
          // -----------------------------------------------------------------
          send('status', '🔗 Σύγκριση με ξενοδοχεία της βάσης…');
          let knownHotels: { slug: string; data: any }[] = [];
          try {
            knownHotels = await listHotels();
          } catch { /* DB may not exist on first run; treat as empty */ }
          const knownIndex = new Map<string, { slug: string; name: string }>();
          for (const h of knownHotels) {
            knownIndex.set(normalizeName(h.data.name), { slug: h.slug, name: h.data.name });
            for (const alias of h.data.aliases || []) {
              knownIndex.set(normalizeName(alias), { slug: h.slug, name: h.data.name });
            }
          }

          // Merge: enrich extracted.hotels[] with verification + DB info.
          const enrichedHotels = (extracted.hotels || []).map((h: any) => {
            if (!h || !h.name) return h;
            const verifyMatch = verifiedHotels.find((v) => v.name === h.name) || {};
            const dbMatch = knownIndex.get(normalizeName(h.name));
            return {
              ...h,
              verified: Boolean(verifyMatch.confirmed),
              officialName: verifyMatch.officialName || null,
              officialWebsite: verifyMatch.officialWebsite || null,
              verifiedCity: verifyMatch.city || null,
              verifiedStars: verifyMatch.stars || null,
              note: verifyMatch.note || null,
              imageCandidates: hotelImagesByName.get(h.name) || [],
              inOurDb: Boolean(dbMatch),
              ourSlug: dbMatch?.slug || null,
            };
          });

          // -----------------------------------------------------------------
          // PHASE 7 — Emit done with full payload.
          // -----------------------------------------------------------------
          const payload = {
            ...extracted,
            sourceUrl: url,
            hotels: enrichedHotels,
            sourceImages,                     // regex-scraped from source HTML
            warnings: verifyResult.warnings || [],
            destinationCanonical: verifyResult.destinationCanonical || null,
            _verifySearches: Array.isArray(verifyResult._searchesUsed) ? verifyResult._searchesUsed : [],
          };
          send('done', payload);

          recordUsage({
            kind: 'scrape', caller: 'admin', usage: totalUsage,
            meta: {
              url,
              ok: true,
              ms: Date.now() - startedAt,
              hotelsExtracted: extractedHotels.length,
              hotelsVerified: verifiedHotels.filter((v: any) => v.confirmed).length,
              hotelsInDb: enrichedHotels.filter((h: any) => h.inOurDb).length,
              warningsCount: (verifyResult.warnings || []).length,
              sourceImagesCount: sourceImages.length,
              webSearches: totalUsage.server_tool_use?.web_search_requests || 0,
            },
          });
        } catch (err: any) {
          send('error', { message: String(err?.message || err) });
        } finally {
          controller.close();
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  );
};

// ---------------------------------------------------------------------------
// Helpers — name normalization (mirrors TourLayout) + image extraction.
// ---------------------------------------------------------------------------

function normalizeName(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function fetchAndExtractImages(url: string): Promise<string[]> {
  let html: string;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TaksidiariBot/1.0; +https://taksidiaris.gr)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    html = await r.text();
  } catch {
    return [];
  }
  return extractImagesFromHtml(html, url);
}

/**
 * Server-side image extraction. Walks <img>/<source>/srcset/og:image/lazy-load
 * attributes + CSS background-image, resolves to absolute URLs, then filters
 * logos/icons/sprites and tiny thumbnails. Same rules as the hotel scraper —
 * if anything regresses there it should regress here too.
 */
function extractImagesFromHtml(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  let base: URL;
  try { base = new URL(baseUrl); } catch { return []; }

  const push = (raw: string) => {
    if (!raw) return;
    let u = raw.trim();
    u = u.split(/\s+/)[0]; // strip srcset width descriptor
    if (!u || u.startsWith('data:')) return;
    try {
      const abs = new URL(u, base).toString();
      if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) return;
      if (/(^|[\/_-])(logo|icon|favicon|sprite|placeholder|loader|spinner|thumb-|thumbnail-)/i.test(abs)) return;
      // Skip very small thumbnails — common sizes: 16, 32, 48, 64, 100, 150
      if (/[_-](\d{2,3})x\1[-_.]/.test(abs)) return;
      out.add(abs);
    } catch { /* bad URL — skip */ }
  };

  const imgRe = /<img\b[^>]*?\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) push(m[1]);

  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  const sourceRe = /<source\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = sourceRe.exec(html))) {
    for (const part of m[1].split(',')) push(part.trim());
  }

  const ogRe = /<meta\b[^>]*?\bproperty\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/gi;
  while ((m = ogRe.exec(html))) push(m[1]);

  const bgRe = /background(?:-image)?\s*:\s*url\(["']?([^)"']+)["']?\)/gi;
  while ((m = bgRe.exec(html))) push(m[1]);

  return Array.from(out).slice(0, 40);
}
