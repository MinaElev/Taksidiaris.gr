// HTML templates for transactional emails. Each function returns
// { subject, html } — pass to sendEmail({ to, subject, html }).
import { SITE } from './site';

const BRAND = '#13496e';
const ACCENT = '#f97a07';
const INK = '#1a202c';
const MUTED = '#718096';
const BG = '#f6f7f9';

function shell(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string): string {
  const cta =
    ctaUrl && ctaLabel
      ? `<p style="text-align:center; margin: 28px 0;"><a href="${ctaUrl}" style="display:inline-block; background:${ACCENT}; color:white; padding:12px 28px; border-radius:6px; text-decoration:none; font-weight:600;">${ctaLabel}</a></p>`
      : '';
  return `<!doctype html>
<html lang="el"><head><meta charset="utf-8" />
<title>${title}</title></head>
<body style="margin:0; padding:0; background:${BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:${INK};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG}; padding: 24px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:white; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
<tr><td style="background:${BRAND}; color:white; padding:18px 28px; font-weight:700; font-size:18px;">
✈ Ταξιδιάρης
</td></tr>
<tr><td style="padding: 28px;">
${bodyHtml}
${cta}
</td></tr>
<tr><td style="padding:16px 28px; background:${BG}; border-top:1px solid #e2e8f0; font-size:12px; color:${MUTED}; text-align:center;">
<a href="${SITE.url}" style="color:${BRAND}; text-decoration:none;">${SITE.url.replace(/^https?:\/\//, '')}</a>
&nbsp;·&nbsp;
<a href="${SITE.url}/etaireia" style="color:${MUTED}; text-decoration:none;">Σχετικά</a>
&nbsp;·&nbsp;
<a href="${SITE.url}/epikoinonia" style="color:${MUTED}; text-decoration:none;">Επικοινωνία</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

// ─── Templates ─────────────────────────────────────────────────────────

export function tplAgencySignupAdmin(opts: {
  agencyName: string;
  email: string;
  city?: string | null;
  description?: string | null;
  slug: string;
}) {
  const adminUrl = `${SITE.url}/admin/agencies/${opts.slug}`;
  return {
    subject: `Νέα εγγραφή γραφείου: ${opts.agencyName}`,
    html: shell(
      'Νέα εγγραφή γραφείου',
      `<h2 style="margin:0 0 12px; font-size:20px; color:${INK};">Νέα εγγραφή γραφείου</h2>
<p style="margin:0 0 16px; color:${INK}; line-height:1.5;">
Ένα νέο γραφείο μόλις εγγράφηκε στον Ταξιδιάρη και περιμένει έγκριση.
</p>
<table cellpadding="0" cellspacing="0" style="width:100%; background:${BG}; border-radius:8px; padding:16px;">
<tr><td style="padding:6px 12px;"><strong>Όνομα:</strong></td><td style="padding:6px 12px;">${opts.agencyName}</td></tr>
<tr><td style="padding:6px 12px;"><strong>Email:</strong></td><td style="padding:6px 12px;"><a href="mailto:${opts.email}" style="color:${BRAND};">${opts.email}</a></td></tr>
${opts.city ? `<tr><td style="padding:6px 12px;"><strong>Πόλη:</strong></td><td style="padding:6px 12px;">${opts.city}</td></tr>` : ''}
${opts.description ? `<tr><td style="padding:6px 12px; vertical-align:top;"><strong>Περιγραφή:</strong></td><td style="padding:6px 12px; color:${MUTED}; line-height:1.5;">${opts.description}</td></tr>` : ''}
</table>
<p style="margin:20px 0 0; color:${MUTED}; font-size:14px;">Πάτα παρακάτω για να ελέγξεις και να εγκρίνεις:</p>`,
      adminUrl,
      'Άνοιγμα στο Admin',
    ),
  };
}

export function tplAgencySignupOwner(opts: { agencyName: string }) {
  const dashUrl = `${SITE.url}/agency`;
  return {
    subject: `Καλωσήρθες στον Ταξιδιάρη — ${opts.agencyName}`,
    html: shell(
      'Καλωσόρισες',
      `<h2 style="margin:0 0 12px; font-size:20px; color:${INK};">Καλωσόρισες, ${opts.agencyName}!</h2>
<p style="margin:0 0 14px; line-height:1.6;">
Η εγγραφή σου ολοκληρώθηκε. Ο λογαριασμός σου είναι σε <strong style="color:#92400e;">εκκρεμή έγκριση</strong> —
συνήθως την κοιτάμε εντός 24 ωρών.
</p>
<p style="margin:0 0 14px; line-height:1.6;">
Στο μεσοδιάστημα μπορείς:
</p>
<ul style="margin:0 0 16px; padding-left:20px; line-height:1.8;">
<li>Να συμπληρώσεις το <a href="${dashUrl}/profile" style="color:${BRAND};">προφίλ του γραφείου</a> (logo, περιγραφή, στοιχεία επικοινωνίας)</li>
<li>Να φτιάξεις τις πρώτες εκδρομές σε <em>draft</em> — θα γίνουν αυτόματα ορατές μόλις εγκριθεί ο λογαριασμός</li>
<li>Να ελέγξεις τις προτάσεις προορισμών και να ξεκινήσεις caching content</li>
</ul>
<p style="margin:0; color:${MUTED}; font-size:14px;">
Ο Ταξιδιάρης δεν διεκπεραιώνει κρατήσεις — όταν ένας ταξιδιώτης ενδιαφέρεται, θα επικοινωνήσει απευθείας μαζί σου.
</p>`,
      dashUrl,
      'Στο dashboard μου',
    ),
  };
}

export function tplAgencyApproved(opts: { agencyName: string; slug: string }) {
  const profileUrl = `${SITE.url}/grafeio/${opts.slug}`;
  return {
    subject: `Εγκρίθηκε ο λογαριασμός σου, ${opts.agencyName}!`,
    html: shell(
      'Εγκρίθηκε ο λογαριασμός σου',
      `<h2 style="margin:0 0 12px; font-size:20px; color:#047857;">✓ Εγκρίθηκε!</h2>
<p style="margin:0 0 14px; line-height:1.6;">
Ο λογαριασμός του γραφείου σου <strong>${opts.agencyName}</strong> είναι πλέον <strong>ενεργός</strong>.
Όλες οι εκδρομές σου που είναι δημοσιευμένες (όχι draft) εμφανίζονται τώρα στο public site.
</p>
<p style="margin:0 0 14px; line-height:1.6;">
Το δημόσιο προφίλ σου: <a href="${profileUrl}" style="color:${BRAND};">${profileUrl}</a>
</p>
<p style="margin:0; color:${MUTED}; font-size:14px;">
Καλωσόρισες στην ομάδα · ευχόμαστε καλά ταξίδια και καλές κρατήσεις!
</p>`,
      profileUrl,
      'Δες το προφίλ σου',
    ),
  };
}

export function tplContactToAgency(opts: {
  agencyName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  subject: string;
  message: string;
  tourUrl?: string;
  tourTitle?: string;
}) {
  return {
    subject: `Νέο ενδιαφέρον για ${opts.tourTitle || opts.subject || 'εκδρομή'}`,
    html: shell(
      'Νέο ενδιαφέρον',
      `<h2 style="margin:0 0 8px; font-size:20px; color:${INK};">Νέο ενδιαφέρον για εκδρομή</h2>
<p style="margin:0 0 16px; color:${MUTED}; font-size:14px;">
Ένας ταξιδιώτης ενδιαφέρθηκε για το γραφείο σας μέσω του Ταξιδιάρη. Επικοινωνήστε άμεσα μαζί του.
</p>
<table cellpadding="0" cellspacing="0" style="width:100%; background:${BG}; border-radius:8px; padding:16px; margin:0 0 16px;">
<tr><td style="padding:6px 12px;"><strong>Όνομα:</strong></td><td style="padding:6px 12px;">${opts.visitorName}</td></tr>
<tr><td style="padding:6px 12px;"><strong>Email:</strong></td><td style="padding:6px 12px;"><a href="mailto:${opts.visitorEmail}" style="color:${BRAND};">${opts.visitorEmail}</a></td></tr>
${opts.visitorPhone ? `<tr><td style="padding:6px 12px;"><strong>Τηλέφωνο:</strong></td><td style="padding:6px 12px;"><a href="tel:${opts.visitorPhone}" style="color:${BRAND};">${opts.visitorPhone}</a></td></tr>` : ''}
${opts.tourTitle ? `<tr><td style="padding:6px 12px;"><strong>Εκδρομή:</strong></td><td style="padding:6px 12px;">${opts.tourUrl ? `<a href="${opts.tourUrl}" style="color:${BRAND};">${opts.tourTitle}</a>` : opts.tourTitle}</td></tr>` : ''}
${opts.subject ? `<tr><td style="padding:6px 12px;"><strong>Θέμα:</strong></td><td style="padding:6px 12px;">${opts.subject}</td></tr>` : ''}
</table>
<div style="background:${BG}; border-left:3px solid ${ACCENT}; padding:12px 16px; border-radius:6px;">
<p style="margin:0 0 4px; font-size:13px; color:${MUTED}; font-weight:600;">ΜΗΝΥΜΑ:</p>
<p style="margin:0; line-height:1.6; white-space:pre-wrap;">${opts.message.replace(/</g, '&lt;')}</p>
</div>
<p style="margin:20px 0 0; color:${MUTED}; font-size:13px;">
Απάντησε απευθείας σε αυτό το email για να επικοινωνήσεις με τον ταξιδιώτη.
</p>`,
    ),
  };
}

export function tplContactToAdmin(opts: {
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  subject: string;
  message: string;
  routedToAgency?: string;
}) {
  return {
    subject: `[Ταξιδιάρης] Νέο μήνυμα: ${opts.subject || 'γενικό ενδιαφέρον'}`,
    html: shell(
      'Νέο μήνυμα από contact form',
      `<h2 style="margin:0 0 12px; font-size:20px;">Νέο μήνυμα</h2>
<table cellpadding="0" cellspacing="0" style="width:100%; background:${BG}; border-radius:8px; padding:16px;">
<tr><td style="padding:6px 12px;"><strong>Όνομα:</strong></td><td style="padding:6px 12px;">${opts.visitorName}</td></tr>
<tr><td style="padding:6px 12px;"><strong>Email:</strong></td><td style="padding:6px 12px;"><a href="mailto:${opts.visitorEmail}" style="color:${BRAND};">${opts.visitorEmail}</a></td></tr>
${opts.visitorPhone ? `<tr><td style="padding:6px 12px;"><strong>Τηλέφωνο:</strong></td><td style="padding:6px 12px;">${opts.visitorPhone}</td></tr>` : ''}
${opts.subject ? `<tr><td style="padding:6px 12px;"><strong>Θέμα:</strong></td><td style="padding:6px 12px;">${opts.subject}</td></tr>` : ''}
${opts.routedToAgency ? `<tr><td style="padding:6px 12px;"><strong>Προωθήθηκε:</strong></td><td style="padding:6px 12px; color:#047857;">→ ${opts.routedToAgency}</td></tr>` : ''}
</table>
<div style="margin-top:16px; background:${BG}; border-left:3px solid ${ACCENT}; padding:12px 16px; border-radius:6px;">
<p style="margin:0; line-height:1.6; white-space:pre-wrap;">${opts.message.replace(/</g, '&lt;')}</p>
</div>`,
    ),
  };
}

export function tplDailyDigest(opts: {
  pendingAgencies: number;
  newToursToday: number;
  expiredToursToday: number;
  stubDestinations: number;
}) {
  const total = opts.pendingAgencies + opts.newToursToday + opts.expiredToursToday + opts.stubDestinations;
  if (total === 0) return null;
  const adminUrl = `${SITE.url}/admin`;
  return {
    subject: `Ταξιδιάρης daily — ${opts.pendingAgencies} εκκρεμή · ${opts.newToursToday} νέες εκδρομές`,
    html: shell(
      'Ταξιδιάρης daily',
      `<h2 style="margin:0 0 12px; font-size:20px;">Σύνοψη της ημέρας</h2>
<table cellpadding="0" cellspacing="0" style="width:100%; margin:16px 0;">
${opts.pendingAgencies > 0 ? `<tr><td style="padding:8px 12px; background:#fffbeb; border-left:3px solid #f59e0b; border-radius:4px;"><strong>${opts.pendingAgencies}</strong> γραφεία περιμένουν έγκριση</td></tr><tr><td style="height:8px;"></td></tr>` : ''}
${opts.newToursToday > 0 ? `<tr><td style="padding:8px 12px; background:#f0fdf4; border-left:3px solid #10b981; border-radius:4px;"><strong>${opts.newToursToday}</strong> νέες εκδρομές δημοσιεύτηκαν σήμερα</td></tr><tr><td style="height:8px;"></td></tr>` : ''}
${opts.expiredToursToday > 0 ? `<tr><td style="padding:8px 12px; background:${BG}; border-left:3px solid ${MUTED}; border-radius:4px;"><strong>${opts.expiredToursToday}</strong> εκδρομές έληξαν σήμερα</td></tr><tr><td style="height:8px;"></td></tr>` : ''}
${opts.stubDestinations > 0 ? `<tr><td style="padding:8px 12px; background:#fef2f2; border-left:3px solid #ef4444; border-radius:4px;"><strong>${opts.stubDestinations}</strong> stub destinations χρειάζονται enrichment</td></tr>` : ''}
</table>`,
      adminUrl,
      'Άνοιγμα Admin',
    ),
  };
}

export function tplNewsletterWelcome(opts: { email: string }) {
  return {
    subject: 'Καλωσόρισες στο newsletter του Ταξιδιάρη',
    html: shell(
      'Καλωσόρισες',
      `<h2 style="margin:0 0 12px; font-size:20px;">Ευχαριστούμε για την εγγραφή!</h2>
<p style="margin:0 0 14px; line-height:1.6;">
Στο newsletter μας θα λαμβάνεις:
</p>
<ul style="margin:0 0 16px; padding-left:20px; line-height:1.8;">
<li>Νέες οργανωμένες εκδρομές κάθε εβδομάδα</li>
<li>Ταξιδιωτικούς οδηγούς για προορισμούς εποχής</li>
<li>Πρώιμα deals και ειδικές προσφορές γραφείων</li>
</ul>
<p style="margin:0; color:${MUTED}; font-size:13px;">
Αν δεν έκανες εσύ την εγγραφή, αγνόησε αυτό το email.
</p>`,
      `${SITE.url}/proorismoi`,
      'Δες προορισμούς',
    ),
  };
}
