export const STYLE_GUIDE = `Είσαι έμπειρος Έλληνας ταξιδιωτικός συντάκτης που γράφει για το ελληνικό ταξιδιωτικό γραφείο "Ταξιδιάρης". Γράφεις περιεχόμενο που μοιάζει 100% γραμμένο από άνθρωπο - όχι από AI. Στόχος: αυθεντικά, χρήσιμα, SEO-δυνατά κείμενα στα ελληνικά.

ΚΟΚΚΙΝΕΣ ΓΡΑΜΜΕΣ - μην γράψεις ΠΟΤΕ:
• Γενικότητες: "μαγικός προορισμός", "ονειρεμένη εμπειρία", "ξεχωριστές αναμνήσεις", "για μικρούς και μεγάλους"
• Επανάληψη ίδιων επιθέτων ("μοναδικός", "υπέροχος", "συναρπαστικός") σε κάθε παράγραφο
• Φράσεις-καλούπια: "είτε αναζητάτε... είτε...", "δεν υπάρχει καλύτερος τρόπος από...", "θα μείνετε άφωνοι"
• Υπερβολικά bullet lists. Χρησιμοποίησε λίστες ΜΟΝΟ όπου έχει νόημα. Γράψε σε παραγράφους κυρίως.
• Παρόμοιες δομές παραγράφων - όλες ίδιο μήκος, ίδιο pattern
• Markdown headers (##) μέσα στα sections - κάθε section επιστρέφεται ως ΚΑΘΑΡΟ κείμενο με παραγράφους
• Emojis
• Αμερικανικά clichés μεταφρασμένα ("nestled in", "boasting", "offering")
• Πληροφορίες που δεν είσαι σίγουρος ότι ισχύουν - ΠΑΡΕΛΕΙΨΕ αντί να εφεύρεις

ΓΡΑΨΕ ΕΤΣΙ:
• Συγκεκριμένα ονόματα: αληθινές παραλίες, συνοικίες, αξιοθέατα, πιάτα, ταβέρνες-θεσμούς όπου το ξέρεις σίγουρα
• Πρακτικές πληροφορίες: "πτήση 3 ώρες από Αθήνα", "ferry 4ωρο από Πειραιά", "θερμοκρασίες 28-32°C τον Αύγουστο"
• Insider tips: "νωρίς το πρωί αποφεύγεις τα πούλμαν", "πάρε καπέλο για τη Θόλο"
• Ποικιλία ρυθμού: σύντομες προτάσεις δίπλα σε μακρύτερες
• Καθημερινό λεξιλόγιο - όπως μιλάει Έλληνας ταξιδιωτικός πράκτορας
• Καμιά παρατήρηση που δείχνει ότι κάποιος πραγματικά πήγε εκεί
• Ορθογραφία και τονισμός άψογα

ΤΟΝΟΣ: Φιλικός, έμπειρος, χωρίς ψεύτικη οικειότητα. Σαν φίλος που γνωρίζει το θέμα. Δεν πουλάς - μοιράζεσαι ώφελος.

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: Πάντα ΜΟΝΟ έγκυρο JSON object. Καμία εισαγωγή, κανένα code fence, κανένα σχόλιο πριν ή μετά. Ξεκίνα με { και τελείωσε με }.`;

export function buildDestinationPrompt(name: string, region: 'ellada' | 'europi' | 'kosmos'): string {
  const regionLabel = { ellada: 'Ελλάδα', europi: 'Ευρώπη', kosmos: 'Εξωτερικό (Κόσμος)' }[region];
  const ctx = {
    ellada: 'Ελληνικός νησιωτικός ή ηπειρωτικός προορισμός. Έμφαση: παραλίες, χωριά, κουζίνα, αξιοθέατα, μεταφορά (ακτοπλοϊκό/πτήση/οδικό).',
    europi: 'Ευρωπαϊκή πόλη. Έλληνες ταξιδιώτες αεροπορικώς για 3-7 ημέρες. Έμφαση: αξιοθέατα, κουζίνα, μεταφορά από αεροδρόμιο, ασφάλεια.',
    kosmos: 'Μακρινός προορισμός. Έλληνες για 7-14 ημέρες, οργανωμένο πακέτο. Έμφαση: visa, εποχή, υγεία, πολιτισμικά ζητήματα.',
  }[region];

  return `Γράψε αυθεντικό περιεχόμενο για τον προορισμό **${name}** (${regionLabel}).

Πλαίσιο: ${ctx}

Επέστρεψε JSON με αυτή τη ΑΚΡΙΒΗ δομή:

{
  "title": "${name}",
  "description": "SEO meta 150-170 χαρακτήρες, ζωντανό, χωρίς κλισέ",
  "intro": "Μία παράγραφος 2-4 προτάσεων με συγκεκριμένη εικόνα",
  "bestTime": "π.χ. 'Μάιος έως Σεπτέμβριος'",
  "duration": "π.χ. '4-6 ημέρες'",
  "highlights": ["4-6 συγκεκριμένα items 5-12 λέξεις"],
  "faqs": [{"q":"...","a":"..."}, "3-4 FAQs με πραγματικές πληροφορίες"],
  "keywords": ["5-8 ελληνικά SEO keywords"],
  "_body": "ΟΛΟΚΛΗΡΟ το markdown σώμα του άρθρου με ## headers για κάθε ενότητα: 'Γιατί να επιλέξετε ${name}', 'Τι να δείτε', 'Πώς θα φτάσετε', 'Πότε να πάτε', 'Πού θα μείνετε', 'Συμβουλές ταξιδιού', 'Προτεινόμενα προγράμματα'. Κάθε ενότητα 100-260 λέξεις φυσικού κειμένου με παραγράφους. Για τα 'Προτεινόμενα προγράμματα' σύντομο κάλεσμα προς το γραφείο 'Ταξιδιάρης'."
}

Επέστρεψε ΜΟΝΟ το JSON. Όχι code fences.`;
}

export function buildPeriodPrompt(name: string, dates: string): string {
  return `Γράψε αυθεντικό περιεχόμενο για περίοδο εκδρομών: **${name}** (${dates}).

Επέστρεψε JSON:
{
  "title": "${name}",
  "description": "SEO meta 150-170 χαρακτήρες",
  "intro": "Μία παράγραφος 2-4 προτάσεων - τι ξεχωρίζει η περίοδος",
  "popularDestinations": ["5-8 συγκεκριμένοι προορισμοί που ταιριάζουν"],
  "faqs": [{"q":"...","a":"..."}, "3-4 FAQs για την περίοδο"],
  "keywords": ["5-8 ελληνικά SEO keywords"],
  "_body": "ΟΛΟΚΛΗΡΟ markdown με ## headers: '${name.replace(/^Εκδρομές /, '')} με τον Ταξιδιάρη', 'Δημοφιλείς προορισμοί', 'Τι περιλαμβάνει το πακέτο', 'Συμβουλές για την κράτησή σας', 'Πληροφορίες & κρατήσεις'. 100-260 λέξεις ανά ενότητα."
}

ΜΟΝΟ JSON.`;
}

export function buildArticlePrompt(topic: string, extraInstructions?: string): string {
  return `Γράψε ΑΥΘΕΝΤΙΚΟ ταξιδιωτικό άρθρο blog για το γραφείο "Ταξιδιάρης". Θέμα:

${topic}

${extraInstructions ? `Επιπλέον οδηγίες:\n${extraInstructions}\n` : ''}

Στόχος: SEO άρθρο 800-1500 λέξεις στα ελληνικά που πραγματικά βοηθάει αναγνώστη που σχεδιάζει ταξίδι.

Επέστρεψε JSON:
{
  "title": "Πιασάρικος τίτλος, 50-65 χαρακτήρες",
  "description": "SEO meta 150-170 χαρακτήρες",
  "tags": ["3-5 tags στα ελληνικά"],
  "_body": "ΟΛΟΚΛΗΡΟ markdown άρθρο. Ξεκίνα με μία hook παράγραφο (όχι ## title γιατί ο τίτλος εμφανίζεται από το frontmatter). Μετά χρησιμοποίησε ## subheadings, παραγράφους, λίστες όπου έχει νόημα. Κλείσε με ένα μη-πιεστικό call-to-action για επικοινωνία με το γραφείο."
}

ΜΟΝΟ JSON.`;
}

export function buildTourPrompt(opts: {
  destination: string;
  region: 'ellada' | 'europi' | 'kosmos';
  duration: { days: number; nights: number };
  departureCities?: string[];
  dates?: string;
  priceFrom?: number;
  transport?: string;
  extraInstructions?: string;
}): string {
  const regionLabel = { ellada: 'Ελλάδα', europi: 'Ευρώπη', kosmos: 'Εξωτερικό' }[opts.region];
  const cities = opts.departureCities && opts.departureCities.length > 0
    ? opts.departureCities.join(', ')
    : 'Αθήνα, Θεσσαλονίκη';

  return `Γράψε ολόκληρη οργανωμένη εκδρομή για το γραφείο "Ταξιδιάρης".

Στοιχεία:
- Προορισμός: ${opts.destination} (${regionLabel})
- Διάρκεια: ${opts.duration.days} ημέρες / ${opts.duration.nights} νύχτες
- Πόλεις αναχώρησης: ${cities}
- Μεταφορά: ${opts.transport || 'αεροπορικώς'}
${opts.dates ? `- Ημερομηνίες: ${opts.dates}` : ''}
${opts.priceFrom ? `- Τιμή από: ${opts.priceFrom}€` : ''}
${opts.extraInstructions ? `\nΕπιπλέον: ${opts.extraInstructions}` : ''}

Επέστρεψε JSON με ΑΚΡΙΒΩΣ αυτή τη δομή:

{
  "title": "Πιασάρικος τίτλος εκδρομής (60-80 χαρακτήρες) — π.χ. 'Πασχαλινό 5ήμερο στην Καππαδοκία αεροπορικώς'",
  "description": "SEO meta 150-170 χαρακτήρες με συγκεκριμένα στοιχεία",
  "intro": "Μία παράγραφος 2-3 προτάσεων - τι κάνει την εκδρομή ξεχωριστή, χωρίς κλισέ",
  "itinerary": [
    { "day": 1, "title": "Σύντομος τίτλος ημέρας", "description": "2-4 προτάσεις τι περιλαμβάνει η ημέρα: μεταφορές, ξεναγήσεις, ξενοδοχείο. Συγκεκριμένα ονόματα μνημείων/περιοχών." }
  ],
  "hotels": [{ "name": "Όνομα ξενοδοχείου", "location": "Πόλη/περιοχή", "nights": 4, "board": "π.χ. Πρωινό", "stars": 4 }],
  "pricing": [
    { "fromCity": "Θεσσαλονίκη", "perPerson": 595, "singleSupplement": 150, "childDiscount": "−80€ παιδί 2-12" }
  ],
  "includes": ["6-10 συγκεκριμένα στοιχεία που περιλαμβάνει το πακέτο"],
  "notIncludes": ["6-10 στοιχεία που δεν περιλαμβάνονται"],
  "bookingProcess": ["3-4 βήματα της διαδικασίας κράτησης"],
  "cancellationPolicy": ["3 κλιμακωτές ρήτρες ακύρωσης"],
  "notes": ["3-5 πρακτικές σημειώσεις (visa, διαβατήριο, νόμισμα κλπ.)"],
  "pickupSchedule": [{ "city": "Θεσσαλονίκη", "location": "Αεροδρόμιο", "time": "04:30" }],
  "faqs": [{"q":"...","a":"..."}, "3-5 FAQs με πραγματικές απαντήσεις"],
  "keywords": ["6-10 ελληνικά SEO keywords"],
  "imageQueries": ["3-5 σύντομα queries στα αγγλικά για αναζήτηση εικόνων στο Unsplash, π.χ. 'Cappadocia hot air balloons sunrise', 'Goreme rock churches'. Προτίμησε συγκεκριμένα τοπωνύμια, όχι γενικά."],
  "_body": "ΟΛΟΚΛΗΡΟ markdown 600-1000 λέξεις με ## headers: 'Γιατί αυτή η εκδρομή', 'Τι θα δεις', 'Διαμονή', 'Πρακτικά', 'Επικοινωνήστε για κρατήσεις'. Φυσικό ελληνικό κείμενο σε παραγράφους, χωρίς κλισέ."
}

ΔΩΣΕ ${opts.duration.days} ΑΝΤΙΚΕΙΜΕΝΑ στο "itinerary" - ένα για κάθε ημέρα. ΜΟΝΟ JSON, καμία εισαγωγή.`;
}

/**
 * Rewrite/improve a piece of existing text in-place. Used by the "✨ Βελτίωση
 * με AI" buttons in tour and article edit pages.
 *
 * The model returns plain text (no JSON wrapper) so we can drop it straight
 * back into the textarea. `kind` hints the model about expected length and
 * tone (e.g. an `intro` is short and punchy, a `body` is long-form markdown).
 */
export function buildRewritePrompt(opts: {
  text: string;
  kind: 'intro' | 'description' | 'body' | 'section' | 'faq' | 'free';
  instruction?: string;
  context?: string;
}): string {
  const kindHint: Record<typeof opts.kind, string> = {
    intro:       'Μία παράγραφος 2-3 προτάσεων. Δυναμικό άνοιγμα χωρίς κλισέ.',
    description: 'SEO meta description 150-170 χαρακτήρες. Συγκεκριμένα στοιχεία.',
    body:        'Ολόκληρο markdown σώμα με ## headers, παραγράφους, λίστες όπου έχει νόημα. Κράτα τα ίδια headers αν υπάρχουν.',
    section:     'Μία ενότητα κειμένου σε παραγράφους. Διατήρησε το ίδιο μέγεθος (±20%).',
    faq:         'Απάντηση σε ερώτηση FAQ. 1-3 προτάσεις, πρακτικές πληροφορίες.',
    free:        'Διατήρησε την ίδια μορφή και έκταση με το πρωτότυπο.',
  };

  return `Έχεις ένα υπάρχον κείμενο και θες να το ΞΑΝΑΓΡΑΨΕΙΣ ώστε να ακολουθεί τους κανόνες ποιότητας του "Ταξιδιάρη" (βλ. system prompt).

Είδος: ${opts.kind} — ${kindHint[opts.kind]}

${opts.context ? `Πλαίσιο (μην το συμπεριλάβεις στην απάντηση):\n${opts.context}\n` : ''}
${opts.instruction ? `Συγκεκριμένη οδηγία αλλαγής: ${opts.instruction}\n` : 'Γενική βελτίωση: αφαίρεσε κλισέ, πρόσθεσε συγκεκριμένα ονόματα/πληροφορίες όπου ξέρεις σίγουρα, βελτίωσε ροή.\n'}

Πρωτότυπο κείμενο:
"""
${opts.text}
"""

ΕΠΕΣΤΡΕΨΕ ΜΟΝΟ το νέο κείμενο, χωρίς εισαγωγή, χωρίς "Ορίστε", χωρίς JSON, χωρίς code fences. Καθαρό κείμενο έτοιμο για paste.`;
}

/**
 * Given an article topic + body, plus the catalogue of available tours,
 * pick the 2-3 tours that best fit as "related" cross-links. Helps SEO and
 * keeps the user on-site after reading a guide.
 */
export function buildRelatedToursPrompt(opts: {
  articleTitle: string;
  articleBody: string;
  candidates: { slug: string; title: string; destination: string; region: string }[];
}): string {
  const lines = opts.candidates.slice(0, 80).map((c) =>
    `- ${c.slug} | ${c.title} | ${c.destination} (${c.region})`,
  ).join('\n');
  // Trim body to keep prompt small.
  const bodyShort = opts.articleBody.length > 4000
    ? opts.articleBody.slice(0, 4000) + '…'
    : opts.articleBody;

  return `Είσαι editor του travel site "Ταξιδιάρης". Σου δίνω ένα άρθρο και έναν κατάλογο εκδρομών. Διάλεξε τις 2-3 εκδρομές που είναι ΠΙΟ σχετικές με το θέμα του άρθρου, ώστε να γίνουν εσωτερικά links.

ΑΡΘΡΟ:
Τίτλος: ${opts.articleTitle}

${bodyShort}

ΔΙΑΘΕΣΙΜΕΣ ΕΚΔΡΟΜΕΣ (slug | τίτλος | προορισμός):
${lines}

Επέστρεψε JSON:
{
  "related": ["slug1", "slug2", "slug3"],
  "reason": "1 πρόταση γιατί αυτές ταιριάζουν"
}

Διάλεξε ΜΟΝΟ slugs που εμφανίζονται στη λίστα. Αν καμία δεν είναι σχετική, επέστρεψε []. ΜΟΝΟ JSON.`;
}

export function buildScrapePrompt(url: string, html: string): string {
  const trimmed = html.length > 30000 ? html.slice(0, 30000) + '...[TRUNCATED]' : html;
  return `Παρέλαβες HTML από σελίδα ταξιδιωτικού γραφείου ή tour operator. URL: ${url}

Εξάγαγε όλες τις πληροφορίες της οργανωμένης εκδρομής σε δομημένο JSON για να αποθηκευτεί ως ΕΚΔΡΟΜΗ (tour) στο σύστημά μας. Μετάφρασε στα ελληνικά αν χρειάζεται. Παρέλειψε ό,τι δεν υπάρχει αντί να εφεύρεις.

Επέστρεψε JSON:
{
  "title": "Όνομα εκδρομής όπως θα φαίνεται στο site",
  "description": "SEO meta 150-170 χαρακτήρες με συγκεκριμένα στοιχεία",
  "destination": "Κύριος προορισμός π.χ. 'Καππαδοκία'",
  "region": "ellada|europi|kosmos",
  "duration": { "days": 7, "nights": 6 },
  "transport": "αεροπορικώς|οδικώς|ακτοπλοϊκώς|συνδυαστικά",
  "departureCities": ["Πόλεις αναχώρησης που βρήκες"],
  "pickupSchedule": [{ "city": "Θεσσαλονίκη", "location": "Αεροδρόμιο", "time": "04:30" }],
  "dates": [{ "from": "2026-07-01", "to": "2026-07-07", "label": "1-7 Ιουλίου 2026" }],
  "priceFrom": 695,
  "currency": "€",
  "intro": "Μία παράγραφος εισαγωγή",
  "itinerary": [{ "day": 1, "title": "...", "description": "..." }],
  "hotels": [{ "name": "...", "location": "...", "nights": 6, "board": "Πρωινό", "stars": 4 }],
  "pricing": [{ "fromCity": "Θεσσαλονίκη", "perPerson": 695, "singleSupplement": 150 }],
  "includes": ["Τι περιλαμβάνει το πακέτο"],
  "notIncludes": ["Τι δεν περιλαμβάνει"],
  "bookingProcess": ["Βήματα κράτησης"],
  "cancellationPolicy": ["Όροι ακύρωσης"],
  "notes": ["Σημειώσεις (visa, διαβατήριο, κτλ.)"],
  "faqs": [{ "q": "...", "a": "..." }],
  "keywords": ["SEO keywords"],
  "images": ["Πλήρη URLs εικόνων που βρήκες"],
  "imageQueries": ["3-5 αγγλικά Unsplash queries εφεδρικά αν δεν υπάρχουν εικόνες, π.χ. 'Cappadocia balloons sunrise'"],
  "originalLanguage": "el|en|other",
  "_body": "Markdown 400-700 λέξεις με ## headers: 'Γιατί αυτή η εκδρομή', 'Διαμονή', 'Πρακτικά', 'Επικοινωνήστε'. Στα ελληνικά."
}

ΜΟΝΟ JSON. Όχι code fences. Όχι εισαγωγή.

HTML:
${trimmed}`;
}
