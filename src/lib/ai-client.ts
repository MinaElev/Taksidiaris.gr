import Anthropic from '@anthropic-ai/sdk';
import { STYLE_GUIDE } from './ai-prompts';

// ---------------------------------------------------------------------------
// Single place where we talk to Anthropic. Other modules import `callClaude`
// for one-shot requests and `streamClaude` for token-by-token SSE responses.
//
// Why both? `callClaude` is simpler — fire, wait for finalMessage, parse JSON.
// `streamClaude` exposes the text deltas so the admin/agency UI can render
// the response as it arrives (60-180s generation feels instant when you see
// tokens streaming in).
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing in .env');
  _client = new Anthropic({ apiKey, maxRetries: 5 });
  return _client;
}

export const MODEL = 'claude-opus-4-7';
// Opus 4.7 supports extended outputs. 12K covers even long tour bodies +
// itinerary arrays with headroom. We used to cap at 7500 which occasionally
// truncated tour JSON mid-array.
export const MAX_TOKENS = 12000;

// Pricing (USD per 1M tokens) — Claude Opus 4.7.
// Kept as a constant here so the cost tracker can compute $$ from usage.
export const PRICE_INPUT_PER_MTOK = 5.0;
export const PRICE_OUTPUT_PER_MTOK = 25.0;
// Cached input is 10% of input price for most models (90% discount).
export const PRICE_CACHE_READ_PER_MTOK = 0.5;
// Cache writes cost ~25% more than fresh input.
export const PRICE_CACHE_WRITE_PER_MTOK = 6.25;

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  server_tool_use?: {
    web_search_requests?: number;
  };
}

// Web search server-tool pricing — Anthropic charges per query.
// $10 per 1,000 searches as of 2026-04.
export const PRICE_WEB_SEARCH_PER_QUERY = 0.01;

/** Rough $USD estimate for a single request, given its usage object. */
export function estimateCostUsd(usage: ClaudeUsage): number {
  const input = (usage.input_tokens || 0) * PRICE_INPUT_PER_MTOK;
  const output = (usage.output_tokens || 0) * PRICE_OUTPUT_PER_MTOK;
  const cacheRead = (usage.cache_read_input_tokens || 0) * PRICE_CACHE_READ_PER_MTOK;
  const cacheWrite = (usage.cache_creation_input_tokens || 0) * PRICE_CACHE_WRITE_PER_MTOK;
  const tokenCost = (input + output + cacheRead + cacheWrite) / 1_000_000;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  return tokenCost + searches * PRICE_WEB_SEARCH_PER_QUERY;
}

/**
 * Parse a JSON object out of Claude's text output. Claude is told to return
 * only JSON, but reality intervenes — sometimes it adds a code fence, a
 * prose intro, or (rarely) truncates mid-object if MAX_TOKENS is hit.
 *
 * Strategy:
 *   1. Strip ```json … ``` code fences.
 *   2. Slice from the first `{` to the last `}`.
 *   3. Parse; on failure, try progressively shorter suffixes (drop trailing
 *      garbage), then last-ditch repair by closing unterminated strings and
 *      balancing braces.
 *
 * Throws with `text` preview if nothing works — caller surfaces that so the
 * user can retry or copy the raw text.
 */
export function extractJson<T = any>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) t = t.slice(first, last + 1);

  // Fast path.
  try {
    return JSON.parse(t);
  } catch {
    // fall through
  }

  // Try trimming trailing junk one char at a time until we hit a valid `}`.
  for (let end = t.length - 1; end > 0; end--) {
    if (t[end] !== '}') continue;
    try {
      return JSON.parse(t.slice(0, end + 1));
    } catch {
      // keep trying
    }
  }

  // Last-ditch: close dangling strings + balance braces.
  const repaired = attemptJsonRepair(t);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch {
      // fall through
    }
  }

  const preview = text.length > 400 ? text.slice(0, 200) + '…[truncated]…' + text.slice(-200) : text;
  throw new Error(`JSON parse failed. Raw model output (preview):\n${preview}`);
}

function attemptJsonRepair(s: string): string | null {
  let inStr = false;
  let escape = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  let out = s;
  if (inStr) out += '"';
  while (depth > 0) { out += '}'; depth--; }
  // Common: trailing comma before our added close.
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return out;
}

/**
 * One-shot call. Returns concatenated text + usage. Use when you don't need
 * token-by-token streaming to the client (e.g. short prompts like `rewrite`,
 * or any non-UI background task).
 */
export async function callClaude(
  userPrompt: string,
  opts: { system?: string; maxTokens?: number } = {},
): Promise<{ text: string; usage: ClaudeUsage }> {
  const client = getClient();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: opts.system ?? STYLE_GUIDE, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  const finalMessage = await stream.finalMessage();
  let text = '';
  for (const block of finalMessage.content) {
    if (block.type === 'text') text += block.text;
  }
  return { text, usage: finalMessage.usage as ClaudeUsage };
}

/**
 * Streaming call. Invokes `onToken` for every text delta as it arrives, then
 * resolves with the final concatenated text + usage. The admin/agency UI
 * uses this via an SSE endpoint so the user sees the model typing instead
 * of staring at a spinner for 1-3 minutes.
 *
 * `onToken` errors are caught so a failed client (e.g. connection drop)
 * doesn't abort the upstream SDK stream — we still want the usage record
 * persisted for cost tracking.
 */
export async function streamClaude(
  userPrompt: string,
  onToken: (delta: string) => void,
  opts: { system?: string; maxTokens?: number } = {},
): Promise<{ text: string; usage: ClaudeUsage }> {
  const client = getClient();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: opts.system ?? STYLE_GUIDE, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });

  let text = '';
  stream.on('text', (delta: string) => {
    text += delta;
    try { onToken(delta); } catch { /* swallow — see jsdoc */ }
  });

  const finalMessage = await stream.finalMessage();
  return { text, usage: finalMessage.usage as ClaudeUsage };
}

/**
 * Streaming call WITH the Anthropic-hosted `web_search` server tool enabled.
 * Use when we need Claude to ground its output in real, current web data
 * (e.g. building a hotel page from the actual hotel's website + reviews
 * instead of from training knowledge).
 *
 * Anthropic runs the searches server-side: we declare the tool, Claude
 * decides when to invoke it, results come back inline as part of the same
 * response. We get billed $0.01 per search via `usage.server_tool_use`.
 *
 * `onToken` only fires for the model's text deltas — search-tool blocks
 * (queries + results) are silent on the stream but counted in usage.
 */
export async function streamClaudeWithWebSearch(
  userPrompt: string,
  onToken: (delta: string) => void,
  opts: { system?: string; maxTokens?: number; maxSearches?: number } = {},
): Promise<{ text: string; usage: ClaudeUsage; webSearches: number }> {
  const client = getClient();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: opts.system ?? STYLE_GUIDE, cache_control: { type: 'ephemeral' } },
    ],
    // The SDK type definitions trail tool releases — cast to satisfy TS.
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: opts.maxSearches ?? 5,
      },
    ] as any,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let text = '';
  stream.on('text', (delta: string) => {
    text += delta;
    try { onToken(delta); } catch { /* swallow — see jsdoc */ }
  });

  const finalMessage = await stream.finalMessage();
  // If `text` came in via the streaming event handler, prefer it. Otherwise
  // fall back to assembling from final content blocks (some SDK paths skip
  // the on('text') events when tools are involved).
  if (!text) {
    for (const block of finalMessage.content) {
      if ((block as any).type === 'text') text += (block as any).text;
    }
  }

  const usage = finalMessage.usage as ClaudeUsage;
  const webSearches = usage?.server_tool_use?.web_search_requests || 0;
  return { text, usage, webSearches };
}
