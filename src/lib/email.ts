// Thin Resend client — uses fetch (no SDK dependency).
// Set RESEND_API_KEY in env to enable. Without it, emails silently log
// to stderr instead of throwing — safe to deploy before keys are wired.
//
// Required env:
//   RESEND_API_KEY     — from https://resend.com/api-keys
//   RESEND_FROM        — verified sender (e.g. "Ταξιδιάρης <noreply@taksidiaris.gr>")
//                        Falls back to "noreply@<your-supabase-project>.send.dev"
//                        which works in dev but bounces in production.
//   ADMIN_EMAIL        — where admin notifications go (default: info@taksidiaris.gr)

const RESEND_URL = 'https://api.resend.com/emails';

function envVar(name: string): string | undefined {
  return process.env[name] ?? (import.meta.env as any)[name];
}

export interface SendEmailOpts {
  to: string | string[];
  subject: string;
  html: string;
  /** Optional plaintext fallback (falls back to stripped HTML when omitted) */
  text?: string;
  /** Override the default from address for a specific message */
  from?: string;
  /** Reply-to address (e.g. for contact-form messages set to user's email) */
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** True when no API key is configured — we logged instead of sending. */
  skipped?: boolean;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail(opts: SendEmailOpts): Promise<SendResult> {
  const apiKey = envVar('RESEND_API_KEY');
  const from = opts.from ?? envVar('RESEND_FROM') ?? 'Ταξιδιάρης <noreply@taksidiaris.gr>';

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY missing — skipping send to ${recipients.join(', ')} ` +
      `(subject: "${opts.subject}")`,
    );
    return { ok: true, skipped: true };
  }

  const payload: Record<string, unknown> = {
    from,
    to: recipients,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? htmlToText(opts.html),
  };
  if (opts.replyTo) payload.reply_to = opts.replyTo;

  try {
    const r = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const text = await r.text();
      console.error(`[email] Resend ${r.status}: ${text.slice(0, 300)}`);
      return { ok: false, error: `Resend ${r.status}: ${text.slice(0, 200)}` };
    }
    const j = (await r.json()) as { id: string };
    return { ok: true, id: j.id };
  } catch (e: any) {
    console.error('[email] network error:', e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}

export function getAdminEmail(): string {
  return envVar('ADMIN_EMAIL') ?? envVar('RESEND_TO') ?? 'info@taksidiaris.gr';
}
