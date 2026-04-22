// ---------------------------------------------------------------------------
// Agency portal session — HMAC-signed cookie holding the agency user's
// identity (Supabase auth.users.id), their agency_id, and role.
//
// Flow:
//   1. Agency user enters email at /agency/login → we ask Supabase to send a
//      magic link (auth.admin.generateLink).
//   2. They click the link → lands on /agency/auth/callback?token_hash=...&type=magiclink
//   3. The callback page verifies the OTP with Supabase → gets back the user.
//   4. We look up agency_users → confirm they're tied to an agency.
//   5. We sign our own cookie ({userId, agencyId, role, iat}) with HMAC + set it.
//
// Why our own cookie instead of the Supabase access_token?
//   • Stateless verification on every request — no Supabase round-trip.
//   • Mirrors the existing admin-auth pattern → familiar shape.
//   • We don't need full Supabase session features in the agency portal
//     (we never call Supabase-as-the-user; everything goes through our
//     scoped server APIs which use the service role with explicit ownership
//     checks via session.agencyId).
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AgencyRole } from './agencies-db';

const COOKIE_NAME = 'taksidiaris_agency';
const SESSION_DAYS = 30;

export interface AgencySession {
  userId: string;
  agencyId: string;
  role: AgencyRole;
  iat: number; // ms since epoch when issued
}

function secret(): string {
  const s = import.meta.env.SESSION_SECRET || process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET missing or too short in .env');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

function encodePayload(s: Omit<AgencySession, 'iat'>): string {
  const full: AgencySession = { ...s, iat: Date.now() };
  // base64url so dots / equals don't collide with our delimiter
  return Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
}

function decodePayload(b64: string): AgencySession | null {
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const obj = JSON.parse(json);
    if (
      typeof obj?.userId === 'string' &&
      typeof obj?.agencyId === 'string' &&
      typeof obj?.role === 'string' &&
      (obj.role === 'owner' || obj.role === 'editor') &&
      typeof obj?.iat === 'number'
    ) {
      return obj as AgencySession;
    }
    return null;
  } catch {
    return null;
  }
}

export function makeAgencyToken(s: Omit<AgencySession, 'iat'>): string {
  const payload = encodePayload(s);
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyAgencyToken(token: string | undefined): AgencySession | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }
  const session = decodePayload(payload);
  if (!session) return null;
  const ageDays = (Date.now() - session.iat) / (1000 * 60 * 60 * 24);
  if (ageDays < 0 || ageDays >= SESSION_DAYS) return null;
  return session;
}

export function buildAgencyCookie(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

export function clearAgencyCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function readAgencyToken(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return rest.join('=');
  }
  return undefined;
}

export function getAgencySession(req: Request): AgencySession | null {
  return verifyAgencyToken(readAgencyToken(req.headers.get('cookie')));
}
