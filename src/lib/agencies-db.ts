// ---------------------------------------------------------------------------
// Agencies data access.
//
// Mina's panel uses `*Admin` functions (service role, sees all agencies + can
// create/update). The public site uses `*Public` (RLS-filtered to `status =
// 'active'`).
//
// Agency users are linked via `agency_users` (auth.users.id → agencies.id).
// We rely on Supabase Auth for the login flow; this module exposes
// `inviteAgencyUser()` to send a magic link and link the new user to an agency.
// ---------------------------------------------------------------------------

import { adminDb, publicDb } from './db';
import {
  computeNextPeriodEnd,
  SUBSCRIPTION_MONTHLY_CENTS,
  type SubscriptionStatus,
} from './subscription';

export type AgencyStatus = 'active' | 'suspended' | 'pending';
export type AgencyRole = 'owner' | 'editor';

export interface Agency {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  vat?: string | null;
  eotLicense?: string | null;
  status: AgencyStatus;
  // Subscription (€20/month paywall) — see src/lib/subscription.ts.
  // Optional so create/update callers needn't set them (managed via
  // recordAgencyPayment / the daily cron); rowToAgency always populates them.
  subscriptionStatus?: SubscriptionStatus;
  subscriptionPeriodEnd?: string | null;
  subscriptionStartedAt?: string | null;
  subscriptionMonthlyCents?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionPayment {
  id: string;
  agencyId: string;
  amountCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  method: string;
  invoiceNumber?: string | null;
  note?: string | null;
  createdAt?: string;
}

export interface AgencyUser {
  userId: string;
  agencyId: string;
  role: AgencyRole;
  createdAt?: string;
}

// --------------------------------------------------------------------------
// row ↔ object conversion
// --------------------------------------------------------------------------

function rowToAgency(row: Record<string, any>): Agency {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    logoUrl: row.logo_url ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    vat: row.vat ?? null,
    eotLicense: row.eot_license ?? null,
    status: row.status as AgencyStatus,
    subscriptionStatus: (row.subscription_status ?? 'none') as SubscriptionStatus,
    subscriptionPeriodEnd: row.subscription_period_end ?? null,
    subscriptionStartedAt: row.subscription_started_at ?? null,
    subscriptionMonthlyCents:
      row.subscription_monthly_cents != null
        ? Number(row.subscription_monthly_cents)
        : SUBSCRIPTION_MONTHLY_CENTS,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function rowToPayment(row: Record<string, any>): SubscriptionPayment {
  return {
    id: row.id,
    agencyId: row.agency_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency ?? 'EUR',
    periodStart: row.period_start,
    periodEnd: row.period_end,
    method: row.method ?? 'invoice',
    invoiceNumber: row.invoice_number ?? null,
    note: row.note ?? null,
    createdAt: row.created_at ?? undefined,
  };
}

function agencyToRow(a: Partial<Agency>): Record<string, any> {
  const out: Record<string, any> = {};
  if (a.slug !== undefined) out.slug = a.slug;
  if (a.name !== undefined) out.name = a.name;
  if (a.description !== undefined) out.description = a.description;
  if (a.logoUrl !== undefined) out.logo_url = a.logoUrl;
  if (a.phone !== undefined) out.phone = a.phone;
  if (a.email !== undefined) out.email = a.email;
  if (a.website !== undefined) out.website = a.website;
  if (a.address !== undefined) out.address = a.address;
  if (a.city !== undefined) out.city = a.city;
  if (a.vat !== undefined) out.vat = a.vat;
  if (a.eotLicense !== undefined) out.eot_license = a.eotLicense;
  if (a.status !== undefined) out.status = a.status;
  return out;
}

// --------------------------------------------------------------------------
// Public reads (RLS = status='active' only)
// --------------------------------------------------------------------------

// Public visibility = active lifecycle AND a paid-through subscription.
// Enforced explicitly here (not via RLS) because publicDb() may run with the
// service role and bypass RLS. Kept in sync with isAgencyLive().
function applyLiveFilter(q: any) {
  return q
    .eq('status', 'active')
    .eq('subscription_status', 'active')
    .gt('subscription_period_end', new Date().toISOString());
}

export async function listAgenciesPublic(): Promise<Agency[]> {
  const { data, error } = await applyLiveFilter(
    publicDb().from('agencies').select('*'),
  ).order('name', { ascending: true });
  if (error) throw new Error(`listAgenciesPublic failed: ${error.message}`);
  return (data || []).map(rowToAgency);
}

export async function readAgencyPublic(slug: string): Promise<Agency | null> {
  const { data, error } = await applyLiveFilter(
    publicDb().from('agencies').select('*').eq('slug', slug),
  ).maybeSingle();
  if (error) throw new Error(`readAgencyPublic(${slug}) failed: ${error.message}`);
  return data ? rowToAgency(data) : null;
}

// --------------------------------------------------------------------------
// Admin reads/writes (service role, bypasses RLS)
// --------------------------------------------------------------------------

export async function listAgenciesAdmin(): Promise<Agency[]> {
  const { data, error } = await adminDb()
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listAgenciesAdmin failed: ${error.message}`);
  return (data || []).map(rowToAgency);
}

export async function readAgencyAdmin(slug: string): Promise<Agency | null> {
  const { data, error } = await adminDb()
    .from('agencies')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`readAgencyAdmin(${slug}) failed: ${error.message}`);
  return data ? rowToAgency(data) : null;
}

export async function readAgencyByIdAdmin(id: string): Promise<Agency | null> {
  const { data, error } = await adminDb()
    .from('agencies')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`readAgencyByIdAdmin(${id}) failed: ${error.message}`);
  return data ? rowToAgency(data) : null;
}

export async function createAgency(
  payload: Omit<Agency, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Agency> {
  const row = agencyToRow(payload);
  const { data, error } = await adminDb()
    .from('agencies')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`createAgency failed: ${error.message}`);
  return rowToAgency(data);
}

export async function updateAgency(
  slug: string,
  patch: Partial<Agency>,
): Promise<Agency> {
  const row = agencyToRow(patch);
  const { data, error } = await adminDb()
    .from('agencies')
    .update(row)
    .eq('slug', slug)
    .select('*')
    .single();
  if (error) throw new Error(`updateAgency(${slug}) failed: ${error.message}`);
  return rowToAgency(data);
}

export async function deleteAgency(slug: string): Promise<void> {
  // Tours' agency_id has ON DELETE SET NULL → tours survive as legacy.
  const { error } = await adminDb().from('agencies').delete().eq('slug', slug);
  if (error) throw new Error(`deleteAgency(${slug}) failed: ${error.message}`);
}

// --------------------------------------------------------------------------
// Agency users — link auth.users → agencies
// --------------------------------------------------------------------------

export async function listAgencyUsers(agencyId: string): Promise<AgencyUser[]> {
  const { data, error } = await adminDb()
    .from('agency_users')
    .select('*')
    .eq('agency_id', agencyId);
  if (error) throw new Error(`listAgencyUsers failed: ${error.message}`);
  return (data || []).map((r) => ({
    userId: r.user_id,
    agencyId: r.agency_id,
    role: r.role as AgencyRole,
    createdAt: r.created_at,
  }));
}

export async function getAgencyForUser(userId: string): Promise<Agency | null> {
  const db = adminDb();
  const { data: link, error: e1 } = await db
    .from('agency_users')
    .select('agency_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (e1) throw new Error(`getAgencyForUser link lookup failed: ${e1.message}`);
  if (!link?.agency_id) return null;
  return readAgencyByIdAdmin(link.agency_id);
}

/**
 * Send a magic-link invite to an email and pre-link them to the agency once
 * they sign in. Two-step flow:
 *   1. `inviteUserByEmail` creates the auth user (or reuses existing) and
 *      mails a one-click sign-in link to Supabase's hosted callback.
 *   2. We immediately upsert the `agency_users` row so the user is tied to
 *      the agency the moment they land.
 *
 * Caller (Mina's admin panel) is responsible for collecting the email and
 * setting the role (owner | editor). Service-role only.
 */
export async function inviteAgencyUser(
  email: string,
  agencyId: string,
  role: AgencyRole = 'owner',
): Promise<{ userId: string; invited: boolean }> {
  const db = adminDb();
  // 1) Issue the invite.
  const { data: inviteData, error: inviteError } =
    await db.auth.admin.inviteUserByEmail(email);
  let userId = inviteData?.user?.id;
  let invited = true;

  // If the email is already registered, Supabase returns an error; look the
  // user up by email instead and just attach them.
  if (inviteError || !userId) {
    invited = false;
    const { data: existing, error: listErr } = await db.auth.admin.listUsers();
    if (listErr) throw new Error(`inviteAgencyUser lookup failed: ${listErr.message}`);
    const found = existing.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!found) {
      throw new Error(
        `inviteAgencyUser failed: ${inviteError?.message || 'user not found and not invited'}`,
      );
    }
    userId = found.id;
  }

  // 2) Link to the agency.
  const { error: linkErr } = await db
    .from('agency_users')
    .upsert(
      { user_id: userId, agency_id: agencyId, role },
      { onConflict: 'user_id' },
    );
  if (linkErr) throw new Error(`inviteAgencyUser link failed: ${linkErr.message}`);

  return { userId: userId!, invited };
}

export async function removeAgencyUser(userId: string): Promise<void> {
  const { error } = await adminDb()
    .from('agency_users')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(`removeAgencyUser failed: ${error.message}`);
}

// --------------------------------------------------------------------------
// Subscriptions (€20/month) — manual-invoice billing. Service role only.
// --------------------------------------------------------------------------

/**
 * Record a subscription payment and extend the agency's paid-through date.
 * Stacks on the current period if it's still in the future. Flips the
 * subscription to 'active' and stamps `subscription_started_at` on first pay.
 */
export async function recordAgencyPayment(
  agencyId: string,
  opts: {
    amountCents: number;
    months: number;
    method?: string;
    invoiceNumber?: string | null;
    note?: string | null;
  },
): Promise<{ agency: Agency; payment: SubscriptionPayment }> {
  const db = adminDb();

  const current = await readAgencyByIdAdmin(agencyId);
  if (!current) throw new Error(`recordAgencyPayment: agency ${agencyId} not found`);

  const now = new Date();
  const periodStart =
    current.subscriptionPeriodEnd && new Date(current.subscriptionPeriodEnd) > now
      ? new Date(current.subscriptionPeriodEnd)
      : now;
  const periodEnd = computeNextPeriodEnd(current.subscriptionPeriodEnd, opts.months, now);

  // 1) Insert the payment record (invoicing history).
  const { data: payRow, error: payErr } = await db
    .from('subscription_payments')
    .insert({
      agency_id: agencyId,
      amount_cents: opts.amountCents,
      currency: 'EUR',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      method: opts.method || 'invoice',
      invoice_number: opts.invoiceNumber || null,
      note: opts.note || null,
    })
    .select('*')
    .single();
  if (payErr) throw new Error(`recordAgencyPayment insert failed: ${payErr.message}`);

  // 2) Extend the agency's subscription window.
  const { data: agRow, error: agErr } = await db
    .from('agencies')
    .update({
      subscription_status: 'active',
      subscription_period_end: periodEnd.toISOString(),
      subscription_started_at: current.subscriptionStartedAt || now.toISOString(),
    })
    .eq('id', agencyId)
    .select('*')
    .single();
  if (agErr) throw new Error(`recordAgencyPayment update failed: ${agErr.message}`);

  return { agency: rowToAgency(agRow), payment: rowToPayment(payRow) };
}

export async function listAgencyPayments(agencyId: string): Promise<SubscriptionPayment[]> {
  const { data, error } = await adminDb()
    .from('subscription_payments')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listAgencyPayments failed: ${error.message}`);
  return (data || []).map(rowToPayment);
}

/** Mark a lapsed subscription as past_due (used by the daily cron). */
export async function markAgencySubscriptionPastDue(agencyId: string): Promise<void> {
  const { error } = await adminDb()
    .from('agencies')
    .update({ subscription_status: 'past_due' })
    .eq('id', agencyId);
  if (error) throw new Error(`markAgencySubscriptionPastDue failed: ${error.message}`);
}
