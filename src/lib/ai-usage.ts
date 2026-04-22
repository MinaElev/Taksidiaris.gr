// ---------------------------------------------------------------------------
// ai_usage — record every Claude call and aggregate spend for the dashboard.
//
// Design:
//   • `recordUsage()` is fire-and-forget on the request path. We `.catch`
//     internally so a tracking failure never breaks the user-facing AI feature.
//   • Costs are computed from the SDK's usage object via estimateCostUsd().
//   • The admin dashboard reads `getMonthlyUsage()` to show the current
//     month's total + breakdown by `kind`.
// ---------------------------------------------------------------------------
import { adminDb } from './db';
import { estimateCostUsd, type ClaudeUsage } from './ai-client';

export type UsageKind =
  | 'tour'
  | 'article'
  | 'destination'
  | 'period'
  | 'scrape'
  | 'rewrite'
  | 'related'
  | 'bulk-regenerate';

export interface RecordOpts {
  kind: UsageKind;
  caller: 'admin' | 'agency';
  agencyId?: string | null;
  usage: ClaudeUsage;
  meta?: Record<string, unknown>;
}

/** Persist a single AI call. Never throws — failures are logged only. */
export async function recordUsage(opts: RecordOpts): Promise<void> {
  try {
    const cost = estimateCostUsd(opts.usage);
    const { error } = await adminDb().from('ai_usage').insert({
      kind: opts.kind,
      caller: opts.caller,
      agency_id: opts.agencyId ?? null,
      input_tokens: opts.usage.input_tokens || 0,
      output_tokens: opts.usage.output_tokens || 0,
      cache_read_tokens: opts.usage.cache_read_input_tokens || 0,
      cache_write_tokens: opts.usage.cache_creation_input_tokens || 0,
      cost_usd: cost,
      meta: opts.meta ?? {},
    });
    if (error) console.error('[ai-usage] insert failed:', error.message);
  } catch (e: any) {
    console.error('[ai-usage] recordUsage threw:', e?.message || e);
  }
}

export interface MonthlySummary {
  totalUsd: number;
  totalCalls: number;
  byKind: Record<string, { calls: number; usd: number }>;
  monthLabel: string; // e.g. "Απρ 2026"
}

const GR_MONTHS_SHORT = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];

/**
 * Aggregate spend for the current calendar month (UTC). Cheap query — only
 * pulls the current month's rows, then sums in JS (Postgres lacks a clean
 * GROUP BY without writing a SQL function and we don't want the migration
 * dance for one dashboard widget).
 */
export async function getMonthlyUsage(date: Date = new Date()): Promise<MonthlySummary> {
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const { data, error } = await adminDb()
    .from('ai_usage')
    .select('kind, cost_usd')
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', nextMonth.toISOString());
  if (error) throw new Error(`getMonthlyUsage failed: ${error.message}`);

  const byKind: Record<string, { calls: number; usd: number }> = {};
  let totalUsd = 0;
  let totalCalls = 0;
  for (const row of (data || []) as { kind: string; cost_usd: number | string }[]) {
    const usd = Number(row.cost_usd) || 0;
    totalUsd += usd;
    totalCalls += 1;
    const slot = byKind[row.kind] ??= { calls: 0, usd: 0 };
    slot.calls += 1;
    slot.usd += usd;
  }
  return {
    totalUsd,
    totalCalls,
    byKind,
    monthLabel: `${GR_MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
  };
}
