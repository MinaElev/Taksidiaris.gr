// Tour expiration logic — a tour is considered "expired" when ALL its
// departure dates have already passed.
//
// Rules:
//   • No dates at all → NOT expired (evergreen tour, always shown)
//   • At least one upcoming date (future `to`) → NOT expired
//   • All dates' `to` field is in the past → EXPIRED
//
// Used by:
//   • Public listings (ekdromi/index, anaxoriseis, destination/hotel matched
//     tours) → filter expired tours out
//   • TourLayout → show "Ολοκληρώθηκε" badge on the standalone page
//   • Tour JSON-LD → set availability=SoldOut

export interface TourDate {
  from: string;
  to: string;
  label?: string;
}

/**
 * Returns true when every departure date's `to` field is in the past.
 * If `dates` is empty/missing, returns false (the tour is treated as
 * evergreen — agencies that don't set explicit dates keep their tour
 * publicly visible).
 */
export function isTourExpired(dates?: TourDate[] | null): boolean {
  if (!dates || dates.length === 0) return false;
  const now = Date.now();
  let latestMs = -Infinity;
  for (const d of dates) {
    if (!d?.to) continue;
    const ms = new Date(d.to).getTime();
    if (Number.isFinite(ms) && ms > latestMs) latestMs = ms;
  }
  if (latestMs === -Infinity) return false; // no parseable dates → keep visible
  return latestMs < now;
}
