-- ============================================================
-- ai_usage — track every Claude call we make from the admin /
-- agency panels, so the dashboard can show "you spent ~$X this
-- month" without forcing you to log into the Anthropic Console.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- What feature triggered the call:
  -- 'tour' | 'article' | 'destination' | 'period' | 'scrape' |
  -- 'rewrite' | 'related' | 'bulk-regenerate'
  kind               text NOT NULL,

  -- Who called: 'admin' for Mina, or 'agency' for any agency portal user.
  caller             text NOT NULL CHECK (caller IN ('admin', 'agency')),
  -- For agency calls, which agency (FK so we can join for per-agency stats).
  agency_id          uuid REFERENCES public.agencies(id) ON DELETE SET NULL,

  -- Raw token counts straight from Anthropic's `usage` object.
  input_tokens       integer NOT NULL DEFAULT 0,
  output_tokens      integer NOT NULL DEFAULT 0,
  cache_read_tokens  integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,

  -- Pre-computed cost in USD so the dashboard doesn't redo math on every read.
  cost_usd           numeric(10,6) NOT NULL DEFAULT 0,

  -- Free-form context: { slug?: string, topic?: string, ok?: boolean,
  -- error?: string, ms?: number }. Indexable via GIN if we ever need it.
  meta               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_kind_idx       ON public.ai_usage (kind);
CREATE INDEX IF NOT EXISTS ai_usage_agency_id_idx  ON public.ai_usage (agency_id);

-- RLS: deny by default. Only the service role (admin backend) reads/writes.
-- Agencies see their own usage via a future scoped view if needed; for now,
-- the admin dashboard is the only consumer.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- (no policies = no access for anon/authenticated; service_role bypasses RLS)
