-- ============================================================
-- Taksidiaris.gr — Multi-tenant marketplace foundation
-- ============================================================
-- Phase 0: agencies, agency_users, tours.
-- No payments, no reviews, no bookings — those come later.
-- Existing 4 markdown tours migrate in with agency_id = NULL
-- (legacy / Mina-managed) and stay publicly visible.
-- ============================================================

-- Required extensions (Supabase enables pgcrypto by default; safe to keep)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- agencies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  logo_url    text,

  -- Public contact info shown on every tour they post
  phone       text,
  email       text,
  website     text,
  address     text,
  city        text,

  -- Optional regulatory metadata (Greek travel agencies need an EOT licence)
  vat         text,        -- ΑΦΜ
  eot_license text,        -- αριθμός αδείας ΕΟΤ

  -- Lifecycle: 'active' = visible & can post; 'suspended' = hidden;
  -- 'pending' = created but not yet onboarded (no auth user invited yet)
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agencies_status_idx ON public.agencies (status);

-- ============================================================
-- agency_users — links Supabase Auth user → agency
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agency_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id  uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_users_agency_id_idx
  ON public.agency_users (agency_id);

-- ============================================================
-- tours — mirror of the existing markdown frontmatter schema
-- ============================================================
-- agency_id is nullable on purpose: existing markdown tours migrate in
-- with NULL (the 'legacy' bucket) and stay publicly visible. Mina can
-- assign them to a real agency later, or delete.
CREATE TABLE IF NOT EXISTS public.tours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id   uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  slug        text UNIQUE NOT NULL,

  -- Required core
  title       text NOT NULL,
  description text NOT NULL,
  destination text NOT NULL,
  region      text NOT NULL CHECK (region IN ('ellada', 'europi', 'kosmos')),
  period      text,

  -- Pricing & duration
  price_from        numeric,
  currency          text DEFAULT '€',
  duration_days     integer NOT NULL CHECK (duration_days  >= 1),
  duration_nights   integer NOT NULL CHECK (duration_nights >= 0),

  transport text CHECK (transport IN
    ('αεροπορικώς', 'οδικώς', 'ακτοπλοϊκώς', 'συνδυαστικά')),

  -- Structured data — kept as jsonb so the existing frontmatter schema
  -- maps 1:1 without exploding into 12 child tables.
  departure_cities    jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  pickup_schedule     jsonb NOT NULL DEFAULT '[]'::jsonb, -- {city, location?, time?}[]
  dates               jsonb NOT NULL DEFAULT '[]'::jsonb, -- {from, to, label?}[]
  hero                text,
  gallery             jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  intro               text,
  itinerary           jsonb NOT NULL DEFAULT '[]'::jsonb, -- {day, title, description}[]
  hotels              jsonb NOT NULL DEFAULT '[]'::jsonb, -- {name, location?, nights?, board?, stars?}[]
  pricing             jsonb NOT NULL DEFAULT '[]'::jsonb, -- {fromCity, perPerson, ...}[]
  includes            jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  not_includes        jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  booking_process     jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  cancellation_policy jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  notes               jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  faqs                jsonb NOT NULL DEFAULT '[]'::jsonb, -- {q, a}[]
  keywords            jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  related             jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  body                text NOT NULL DEFAULT '',           -- markdown body

  draft       boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tours_agency_id_idx        ON public.tours (agency_id);
CREATE INDEX IF NOT EXISTS tours_destination_idx      ON public.tours (destination);
CREATE INDEX IF NOT EXISTS tours_region_idx           ON public.tours (region);
CREATE INDEX IF NOT EXISTS tours_published_idx        ON public.tours (draft) WHERE draft = false;
-- GIN index for filtering by departure city (jsonb array contains)
CREATE INDEX IF NOT EXISTS tours_departure_cities_idx
  ON public.tours USING gin (departure_cities);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agencies_set_updated_at ON public.agencies;
CREATE TRIGGER agencies_set_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tours_set_updated_at ON public.tours;
CREATE TRIGGER tours_set_updated_at
  BEFORE UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- Rules in plain Greek:
--   • Public site: βλέπει active γραφεία και tours που είναι μη-draft
--     από active γραφεία (ή legacy χωρίς γραφείο).
--   • Logged-in agency user: βλέπει + γράφει ΜΟΝΟ τα δικά του γραφείου tours.
--   • Service role (= η Mina από το admin / backend): bypass — βλέπει όλα.

ALTER TABLE public.agencies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours        ENABLE ROW LEVEL SECURITY;

-- ---- agencies -------------------------------------------------
DROP POLICY IF EXISTS agencies_public_read ON public.agencies;
CREATE POLICY agencies_public_read
  ON public.agencies FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- An agency user can read their own agency row even if suspended/pending
-- (so the dashboard can tell them "your account is suspended")
DROP POLICY IF EXISTS agencies_self_read ON public.agencies;
CREATE POLICY agencies_self_read
  ON public.agencies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

-- ---- agency_users ---------------------------------------------
DROP POLICY IF EXISTS agency_users_self_read ON public.agency_users;
CREATE POLICY agency_users_self_read
  ON public.agency_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---- tours ----------------------------------------------------
-- Public reads non-draft tours of active agencies, plus legacy (no agency).
DROP POLICY IF EXISTS tours_public_read ON public.tours;
CREATE POLICY tours_public_read
  ON public.tours FOR SELECT
  TO anon, authenticated
  USING (
    draft = false
    AND (
      agency_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id = public.tours.agency_id AND a.status = 'active'
      )
    )
  );

-- An agency user sees ALL their own tours (incl. drafts)
DROP POLICY IF EXISTS tours_agency_full_read ON public.tours;
CREATE POLICY tours_agency_full_read
  ON public.tours FOR SELECT
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tours_agency_insert ON public.tours;
CREATE POLICY tours_agency_insert
  ON public.tours FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tours_agency_update ON public.tours;
CREATE POLICY tours_agency_update
  ON public.tours FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS tours_agency_delete ON public.tours;
CREATE POLICY tours_agency_delete
  ON public.tours FOR DELETE
  TO authenticated
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

-- service_role bypasses RLS automatically (used by the admin backend / Mina)
