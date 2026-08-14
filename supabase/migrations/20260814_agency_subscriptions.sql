-- ============================================================
-- Taksidiaris.gr — Agency subscriptions (€20 / month paywall)
-- ============================================================
-- Adds a subscription layer on top of the existing `agencies.status`
-- lifecycle. An agency is publicly visible AND allowed to publish tours
-- only when:
--     status = 'active'
--     AND subscription_status = 'active'
--     AND subscription_period_end > now()
--
-- Billing is manual invoicing: the admin records each payment (default
-- €20 × N months) via /admin/agencies/[slug], which extends the period.
-- Enforcement lives in the application layer (src/lib/subscription.ts +
-- the public read helpers) because publicDb() runs with the service role
-- and therefore bypasses RLS.
-- ============================================================

-- ---- agencies: subscription columns --------------------------------
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN ('none', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS subscription_period_end   timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_monthly_cents integer NOT NULL DEFAULT 2000;

-- Fast lookup for the daily cron (reminders / expiry sweep).
CREATE INDEX IF NOT EXISTS agencies_subscription_idx
  ON public.agencies (subscription_status, subscription_period_end);

-- ---- subscription_payments: invoicing history ----------------------
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  amount_cents   integer NOT NULL,
  currency       text NOT NULL DEFAULT 'EUR',
  period_start   timestamptz NOT NULL,
  period_end     timestamptz NOT NULL,
  -- how the money arrived: invoice / bank_transfer / card / cash / comp
  method         text NOT NULL DEFAULT 'invoice',
  invoice_number text,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_payments_agency_idx
  ON public.subscription_payments (agency_id, created_at DESC);

-- Payments are never public. Enable RLS with no anon/authenticated policy
-- → only the service role (admin backend) can read/write them.
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- ---- Backfill: don't nuke agencies that are already live -----------
-- Give every currently-active agency a 30-day grace subscription so their
-- published tours stay visible at launch and they receive renewal emails
-- before anything is hidden. Pending/suspended agencies stay 'none'.
UPDATE public.agencies
SET subscription_status  = 'active',
    subscription_started_at = COALESCE(subscription_started_at, now()),
    subscription_period_end = now() + interval '30 days'
WHERE status = 'active'
  AND subscription_status = 'none';
