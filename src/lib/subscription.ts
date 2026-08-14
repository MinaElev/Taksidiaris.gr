// ---------------------------------------------------------------------------
// Agency subscription logic — the single source of truth for "is this agency
// paid-up and therefore live?".
//
// Pricing: €20 / month, billed by manual invoice (the admin records payments
// which extend `subscription_period_end`). See migration
// 20260814_agency_subscriptions.sql.
//
// An agency is LIVE (publicly visible + allowed to publish) when:
//     lifecycle status === 'active'
//     AND subscription_status === 'active'
//     AND subscription_period_end is in the future
//
// We enforce this in the application layer (not RLS) because publicDb() runs
// with the service role and bypasses RLS when SUPABASE_ANON_KEY is unset.
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_MONTHLY_CENTS = 2000; // €20 / month
export const SUBSCRIPTION_CURRENCY = 'EUR';

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

/** True when the subscription is 'active' and paid through a future date. */
export function isSubscriptionCurrent(
  status: string | null | undefined,
  periodEnd: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== 'active') return false;
  if (!periodEnd) return false;
  const end = periodEnd instanceof Date ? periodEnd.getTime() : new Date(periodEnd).getTime();
  return Number.isFinite(end) && end > now.getTime();
}

/**
 * True when an agency is publicly visible + allowed to publish. Accepts either
 * camelCase (Agency object) or snake_case (raw DB row from an embedded join).
 */
export function isAgencyLive(
  a: {
    status?: string | null;
    subscriptionStatus?: string | null;
    subscription_status?: string | null;
    subscriptionPeriodEnd?: string | Date | null;
    subscription_period_end?: string | Date | null;
  } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!a) return false;
  if (a.status !== 'active') return false;
  const subStatus = a.subscriptionStatus ?? a.subscription_status;
  const periodEnd = a.subscriptionPeriodEnd ?? a.subscription_period_end;
  return isSubscriptionCurrent(subStatus, periodEnd, now);
}

/** Whole days until the period ends (negative if already expired). null if no end. */
export function daysUntil(
  periodEnd: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!periodEnd) return null;
  const end = periodEnd instanceof Date ? periodEnd.getTime() : new Date(periodEnd).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

/**
 * Next period end when a payment of `months` is recorded. Extends from the
 * current end if it's still in the future (stacking), otherwise from now.
 */
export function computeNextPeriodEnd(
  currentEnd: string | Date | null | undefined,
  months: number = 1,
  now: Date = new Date(),
): Date {
  const cur = currentEnd
    ? currentEnd instanceof Date
      ? currentEnd
      : new Date(currentEnd)
    : null;
  const base = cur && cur.getTime() > now.getTime() ? new Date(cur) : new Date(now);
  base.setMonth(base.getMonth() + Math.max(1, Math.round(months)));
  return base;
}

export function eurosFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Human label for a subscription state (Greek). */
export function subscriptionLabel(
  status: string | null | undefined,
  periodEnd: string | Date | null | undefined,
  now: Date = new Date(),
): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (isSubscriptionCurrent(status, periodEnd, now)) {
    const d = daysUntil(periodEnd, now);
    if (d !== null && d <= 7) return { text: `Λήγει σε ${d} ημέρες`, tone: 'warn' };
    return { text: 'Ενεργή', tone: 'ok' };
  }
  if (status === 'past_due') return { text: 'Έληξε — εκκρεμεί ανανέωση', tone: 'bad' };
  if (status === 'canceled') return { text: 'Ακυρωμένη', tone: 'bad' };
  return { text: 'Χωρίς συνδρομή', tone: 'bad' };
}
