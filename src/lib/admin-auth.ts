import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'taksidiaris_admin';
const SESSION_DAYS = 14;

function secret(): string {
  const s = import.meta.env.SESSION_SECRET || process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET missing or too short in .env');
  return s;
}

export function adminPassword(): string {
  const p = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!p) throw new Error('ADMIN_PASSWORD missing in .env');
  return p;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function makeToken(): string {
  const payload = String(Date.now());
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch {
    return false;
  }
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  const ageDays = (Date.now() - issuedAt) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays < SESSION_DAYS;
}

export function buildCookie(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function readToken(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE_NAME) return rest.join('=');
  }
  return undefined;
}

export function isAuthenticated(req: Request): boolean {
  return verifyToken(readToken(req.headers.get('cookie')));
}
