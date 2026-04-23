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

// ---------------------------------------------------------------------------
// Destination — uses web_search to ground content in CURRENT data.
// Important reasons we want web_search and not just training knowledge:
//   • Prices, transit fares, ticket costs change yearly — training is stale
//   • Recent events: monument restorations (Notre Dame Dec 2024), new
//     museums, closures, visa rule changes
//   • Climate normals shift — "best time" should reflect recent years
//   • Currency / exchange rates for the practical budget paragraph
// We also pass our own hotels + tours for this destination so the AI's
// "Πού θα μείνετε" / "Προτεινόμενα προγράμματα" sections cross-link to
// real pages on our own site.
// ---------------------------------------------------------------------------

export interface BuildDestinationPromptOpts {
  name: string;
  region: 'ellada' | 'europi' | 'kosmos';
  /** Hotels in our DB that are in this destination — for cross-linking. */
  ourHotels?: { name: string; slug: string; city?: string; stars?: number }[];
  /** Tours in our DB going to this destination — for the "Προτεινόμενα προγράμματα" hint. */
  ourTours?: { title: string; slug: string; nights?: number }[];
}

export function buildDestinationPrompt(opts: BuildDestinationPromptOpts | string, regionArg?: 'ellada' | 'europi' | 'kosmos'): string {
  // Backwards-compatible signature — old callers pass (name, region).
  const o: BuildDestinationPromptOpts = typeof opts === 'string'
    ? { name: opts, region: regionArg as any }
    : opts;
  const { name, region, ourHotels = [], ourTours = [] } = o;

  const regionLabel = { ellada: 'Ελλάδα', europi: 'Ευρώπη', kosmos: 'Εξωτερικό (Κόσμος)' }[region];
  const ctx = {
    ellada: 'Ελληνικός νησιωτικός ή ηπειρωτικός προορισμός. Έμφαση: παραλίες, χωριά, κουζίνα, αξιοθέατα, μεταφορά (ακτοπλοϊκό/πτήση/οδικό).',
    europi: 'Ευρωπαϊκή πόλη. Έλληνες ταξιδιώτες αεροπορικώς για 3-7 ημέρες. Έμφαση: αξιοθέατα, κουζίνα, μεταφορά από αεροδρόμιο, ασφάλεια.',
    kosmos: 'Μακρινός προορισμός. Έλληνες για 7-14 ημέρες, οργανωμένο πακέτο. Έμφαση: visa, εποχή, υγεία, πολιτισμικά ζητήματα.',
  }[region];

  const hotelLines = ourHotels.length
    ? ourHotels.slice(0, 10).map((h) => `  • ${h.name}${h.stars ? ` ${h.stars}*` : ''}${h.city ? ` (${h.city})` : ''}`).join('\n')
    : '  (κανένα ξενοδοχείο στη βάση μας ακόμη)';

  const tourLines = ourTours.length
    ? ourTours.slice(0, 8).map((t) => `  • "${t.title}"${t.nights ? ` · ${t.nights} νύχτες` : ''}`).join('\n')
    : '  (καμία εκδρομή στη βάση μας ακόμη)';

  // Tailored search queries — Claude needs concrete starting points,
  // especially for Greek-language sources.
  const transportQueries = region === 'ellada'
    ? [`"${name}" ferry schedule from Piraeus 2026`, `"${name}" αεροπορικά εισιτήρια από Αθήνα`]
    : region === 'europi'
      ? [`flights Athens to ${name} duration price`, `${name} airport transfer to city center cost`]
      : [`flights Athens to ${name} indirect`, `${name} visa requirements Greek passport`];

  const baseQueries = [
    `"${name}" τι να δω 2026`,
    `${name} best time to visit weather`,
    `${name} top attractions opening hours 2026`,
    ...transportQueries,
  ];

  return `${STYLE_GUIDE}

ΑΠΟΣΤΟΛΗ: γράψε ΑΛΗΘΙΝΟ, ΕΝΗΜΕΡΩΜΕΝΟ περιεχόμενο για τον προορισμό **${name}** (${regionLabel}) βασισμένο ΜΟΝΟ σε δεδομένα που βρήκες με web_search.

Πλαίσιο τύπου προορισμού: ${ctx}

📚 ΕΣΩΤΕΡΙΚΟ CONTEXT (περιεχόμενο που ΗΔΗ έχουμε για να γίνουν cross-links):

Ξενοδοχεία στη βάση μας στον προορισμό:
${hotelLines}

Εκδρομές μας στον προορισμό:
${tourLines}

🔍 ΥΠΟΧΡΕΩΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ — WEB SEARCH FIRST:

ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, χρησιμοποίησε το web_search 4-6 φορές. Προτεινόμενα queries:
${baseQueries.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

Από τα αποτελέσματα συγκέντρωσε:
• **Καλύτερη εποχή** — θερμοκρασίες, βροχοπτώσεις, υψηλή/χαμηλή τουριστική περίοδος (από κλιματικές πηγές, όχι "συνήθως καλοκαίρι")
• **Διάρκεια** — τι λένε travel guides ότι αρκεί για first-time visit
• **Αξιοθέατα** — με ΣΥΓΚΕΚΡΙΜΕΝΑ ονόματα, ώρες λειτουργίας, τιμές εισόδου, αν έχουν ανοίξει/κλείσει πρόσφατα
• **Πρόσβαση από Ελλάδα** — διάρκεια πτήσης, αεροπορικές εταιρείες, transfer κόστος αεροδρόμιο→κέντρο, εναλλακτικές (ferry για ελληνικά νησιά)
• **Πρακτικά** — visa (αν χρειάζεται), νόμισμα + τρέχουσα ισοτιμία, εξτρεμικές καιρικές συνθήκες
• **Ασφάλεια / σύγχρονες προειδοποιήσεις** (πορτοφολάδες σε συγκεκριμένα μέρη, demonstrations, κλπ.)
• **Πρόσφατα events** — αναστηλώσεις, νέα μουσεία/σταθμοί μετρό, πρόσφατες αλλαγές που πρέπει να ξέρει ο επισκέπτης

🚫 ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ — ΜΗΔΕΝΙΚΗ ΕΠΙΝΟΗΣΗ:
• Αν δεν επιβεβαιώθηκε από web_search → άφησέ το έξω. Πρόσθεσέ το στο _missing.
• ΜΗΝ μάντεψες τιμές. Αν δεν βρήκες € για το μετρό, μην γράψεις "περίπου €2".
• ΜΗΝ εφεύρεις ονόματα ταβερνών/εστιατορίων. Αν τα ονόματα δεν αναφέρθηκαν σε αναγνωρίσιμη πηγή, χρησιμοποίησε γενικές κατευθύνσεις γειτονιάς.
• Στο "Πού θα μείνετε" αναφέρου ΣΥΓΚΕΚΡΙΜΕΝΑ στα ξενοδοχεία της βάσης μας ΟΝΟΜΑΣΤΙΚΑ (παραπάνω) — έτσι θα γίνουν αυτόματα hyperlinks στο public site.
• Στο "Προτεινόμενα προγράμματα" αναφέρου τις εκδρομές μας ονομαστικά αν υπάρχουν.

Επέστρεψε ΜΟΝΟ JSON με αυτή την ακριβή δομή:

{
  "title": "${name}",
  "description": "[MUST] SEO meta 150-170 χαρακτήρες, συγκεκριμένο, χωρίς κλισέ",
  "intro": "[MUST] 1 παράγραφος 2-4 προτάσεων με ΣΥΓΚΕΚΡΙΜΕΝΗ εικόνα/γεγονός που βρήκες",
  "bestTime": "[MUST IF FOUND] π.χ. 'Απρίλιος-Ιούνιος και Σεπτέμβριος-Οκτώβριος' με σύντομη αιτιολόγηση",
  "duration": "[MUST IF FOUND] π.χ. '4-6 ημέρες'",
  "highlights": ["[MUST] 4-7 ΣΥΓΚΕΚΡΙΜΕΝΑ items 6-14 λέξεις, με πραγματικά ονόματα"],
  "faqs": [{"q":"...","a":"..."}],
  "keywords": ["5-8 ελληνικά SEO keywords βασισμένα στον πραγματικό προορισμό"],
  "officialTourismSite": "[OPTIONAL] URL επίσημου τουριστικού site (π.χ. visitparis.com), αλλιώς null",
  "sources": ["[MUST] 3-6 URLs που χρησιμοποίησες"],
  "_body": "ΟΛΟΚΛΗΡΟ markdown με ## headers: 'Γιατί να επιλέξετε ${name}', 'Τι να δείτε', 'Πώς θα φτάσετε', 'Πότε να πάτε', 'Πού θα μείνετε', 'Συμβουλές ταξιδιού', 'Προτεινόμενα προγράμματα'. 100-260 λέξεις/section, παράγραφοι κυρίως. Στο 'Πού θα μείνετε' ανάφερε ονομαστικά τα ξενοδοχεία μας. Στο 'Προτεινόμενα προγράμματα' ανάφερε τις εκδρομές μας + σύντομο κάλεσμα στο 'Ταξιδιάρης'.",
  "_missing": "[MUST] Array από field names που δεν επιβεβαιώθηκαν (π.χ. ['bestTime']). [] αν τα βρήκες όλα."
}

ΜΟΝΟ έγκυρο JSON. Καμία εισαγωγή. Καμία code fence.`;
}

// ---------------------------------------------------------------------------
// Period — religious/national holidays where the EXACT date shifts each year
// (Πάσχα, Αγ. Πνεύματος, Απόκριες) AND consumer demand patterns drift.
// Web_search nails: this year's actual dates, current trending destinations,
// any flight strike / event affecting travel that period. Plus, like
// destinations, we feed in our existing destinations so popularDestinations
// links to real pages on our own site.
// ---------------------------------------------------------------------------

export interface BuildPeriodPromptOpts {
  name: string;
  dates: string;
  /** Existing destinations in our DB — popularDestinations should pick from these. */
  ourDestinations?: { title: string; slug: string; region: 'ellada' | 'europi' | 'kosmos' }[];
}

export function buildPeriodPrompt(opts: BuildPeriodPromptOpts | string, datesArg?: string): string {
  // Backwards-compat: old callers pass (name, dates) positional.
  const o: BuildPeriodPromptOpts = typeof opts === 'string'
    ? { name: opts, dates: datesArg || '' }
    : opts;
  const { name, dates, ourDestinations = [] } = o;

  const destByRegion = {
    ellada: ourDestinations.filter((d) => d.region === 'ellada').map((d) => d.title),
    europi: ourDestinations.filter((d) => d.region === 'europi').map((d) => d.title),
    kosmos: ourDestinations.filter((d) => d.region === 'kosmos').map((d) => d.title),
  };
  const destLines =
    `  Ελλάδα: ${destByRegion.ellada.slice(0, 15).join(', ') || '—'}\n` +
    `  Ευρώπη: ${destByRegion.europi.slice(0, 15).join(', ') || '—'}\n` +
    `  Κόσμος: ${destByRegion.kosmos.slice(0, 10).join(', ') || '—'}`;

  // Strip "Εκδρομές " prefix to get the bare period name for the H2.
  const bareName = name.replace(/^Εκδρομές\s+/i, '');

  return `${STYLE_GUIDE}

ΑΠΟΣΤΟΛΗ: γράψε ΕΝΗΜΕΡΩΜΕΝΟ περιεχόμενο για την περίοδο εκδρομών **${name}**${dates ? ` (${dates})` : ''} βασισμένο ΣΕ ΑΛΗΘΙΝΑ web_search δεδομένα.

📚 ΕΣΩΤΕΡΙΚΟ CONTEXT — οι προορισμοί που ΗΔΗ έχουμε στη βάση μας:
${destLines}

🔍 ΥΠΟΧΡΕΩΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ — WEB SEARCH FIRST:

Χρησιμοποίησε web_search 2-4 φορές. Στόχοι:

1. **ΕΠΙΒΕΒΑΙΩΣΗ ΗΜΕΡΟΜΗΝΙΩΝ ${new Date().getFullYear()}-${new Date().getFullYear() + 1}** — ψάξε:
   "${bareName} ${new Date().getFullYear() + 1} ημερομηνίες"  (για κινητές γιορτές: Πάσχα, Αγ. Πνεύματος, Απόκριες)
   "${bareName} αργία 2026 ημέρες"

2. **ΤΑΣΕΙΣ ΠΡΟΟΡΙΣΜΩΝ** — ψάξε:
   "δημοφιλείς προορισμοί ${bareName} 2026"
   "where to travel ${bareName} Greece"

3. **ΠΡΑΚΤΙΚΑ ΑΥΤΗΝ ΤΗΝ ΠΕΡΙΟΔΟ** — ψάξε:
   "${bareName} flight prices Greece 2026"
   "${bareName} ταξιδιωτικές συμβουλές" (για συγκεκριμένα events/απεργίες/εκδηλώσεις)

🚫 ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ:
• Στο popularDestinations ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΜΟΝΟ προορισμούς από τη λίστα μας παραπάνω. Αυτοί θα γίνουν αυτόματα hyperlinks στο public site.
• ΜΗΝ μάντεψες τιμές πτήσεων αν δεν επιβεβαιώθηκαν. Πες "οι τιμές κυμαίνονται αρκετά, ζητήστε τρέχουσα προσφορά" αντί για ψεύτικο εύρος.
• Αν είναι κινητή γιορτή και δεν βρήκες σίγουρα τις φετινές ημερομηνίες, βάλε το "dates" στο _missing.

Επέστρεψε ΜΟΝΟ JSON:

{
  "title": "${name}",
  "description": "[MUST] SEO meta 150-170 χαρακτήρες — με την επιβεβαιωμένη ημερομηνία αν τη βρήκες",
  "shortName": "[OPTIONAL] σύντομη μορφή π.χ. 'Πάσχα'",
  "dates": "[MUST IF MOVABLE] επιβεβαιωμένες ημερομηνίες π.χ. '11-13 Απριλίου 2026', αλλιώς null",
  "intro": "[MUST] 1 παράγραφος 2-4 προτάσεων που ξεχωρίζει την περίοδο",
  "popularDestinations": ["[MUST] 5-10 προορισμοί ΑΠΟΚΛΕΙΣΤΙΚΑ από τη λίστα της βάσης μας. Όνομα ακριβώς όπως στη λίστα ώστε να ταιριάξει το slug."],
  "faqs": [{"q":"...","a":"..."}],
  "keywords": ["5-8 ελληνικά SEO keywords"],
  "sources": ["[MUST] 2-4 URLs που χρησιμοποίησες"],
  "_body": "ΟΛΟΚΛΗΡΟ markdown με ## headers: '${bareName} με τον Ταξιδιάρη', 'Δημοφιλείς προορισμοί', 'Τι περιλαμβάνει το πακέτο', 'Συμβουλές για την κράτησή σας', 'Πληροφορίες & κρατήσεις'. 100-260 λέξεις/section. Στο 'Δημοφιλείς προορισμοί' ανάφερε ονομαστικά μερικούς από τη λίστα μας — θα γίνουν links.",
  "_missing": "[MUST] Array από field names που δεν επιβεβαιώθηκαν, [] αλλιώς."
}

ΜΟΝΟ έγκυρο JSON. Καμία εισαγωγή.`;
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
  const trimmed = html.length > 60000 ? html.slice(0, 60000) + '...[TRUNCATED]' : html;
  return `Παρέλαβες HTML από σελίδα οργανωμένης εκδρομής (URL: ${url}). Είσαι ΚΑΘΑΡΟΣ EXTRACTOR — όχι συγγραφέας.

🚫 ΜΗΔΕΝΙΚΗ ΕΠΙΝΟΗΣΗ — ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ:
• Κάθε τιμή στο JSON ΠΡΕΠΕΙ να προέρχεται από κάτι που είδες ΑΥΤΟΛΕΞΕΙ στο HTML (ή λογική μετάφραση/μορφοποίηση).
• ΑΠΑΓΟΡΕΥΕΤΑΙ να συμπληρώσεις "λογικά κενά", default values, παραδείγματα, ή πληροφορίες που "συνήθως ισχύουν" για τέτοιες εκδρομές.
• ΑΝ ΔΕΝ ΕΙΔΕΣ ΚΑΤΙ → άφησε το πεδίο null / κενό array []. Πρόσθεσέ το επίσης στο "_missing" για να το ξέρει ο χρήστης.
• Παραδείγματα τιμών (π.χ. "Καππαδοκία", "Θεσσαλονίκη", "695") στο schema παρακάτω είναι ΜΟΝΟ για να δείξουν μορφή. ΜΗΝ τα αντιγράψεις αν δεν υπάρχουν στο HTML.

🎯 ΥΠΟΧΡΕΩΤΙΚΑ ΠΕΔΙΑ — ΨΑΞΕ ΣΚΛΗΡΑ:
Πριν πεις "δεν υπάρχει", σαρώνεις ΟΛΟ το HTML για:

• **ημερομηνίες (dates)** — ψάξε σε: πίνακες αναχωρήσεων, calendar widgets, λίστες με μήνες/μέρες, JSON-LD <script type="application/ld+json">, "Αναχωρήσεις:", "Departures:", "Ημερομηνίες:", "Dates:", "από...έως...", patterns όπως "1-7 Ιουλίου", "12/06/2026", "June 1-7". Αν δεις πολλές αναχωρήσεις, βάλε τις ΟΛΕΣ.
• **τιμή (priceFrom)** — ψάξε: "από €", "€...", "from $", "Τιμή:", "Price:", "starting at", JSON-LD offers/price. Πάρε τη ΜΙΚΡΟΤΕΡΗ τιμή που είδες.
• **διάρκεια (duration)** — ψάξε: "X ημέρες", "X days", "X nights", "X νύχτες", "X-day tour", "διήμερο/τριήμερο/τετραήμερο/πενθήμερο/εξαήμερο/επταήμερο/οκταήμερο/εννιαήμερο/δεκαήμερο" (αυτές οι λέξεις ΥΠΟΝΟΟΥΝ τις ημέρες — π.χ. πενθήμερο = 5 ημέρες/4 νύχτες).
• **προορισμός (destination)** — η ΚΥΡΙΑ πόλη/περιοχή της εκδρομής. Συνήθως στον τίτλο.
• **πόλεις αναχώρησης (departureCities)** — ψάξε: "Αναχώρηση από", "Departure from", "από Θεσσαλονίκη/Αθήνα/Λάρισα", JSON-LD pickup points.
• **μεταφορά (transport)** — αν δεις "πτήση/flight/αεροπορική" → "αεροπορικώς". "πούλμαν/coach/bus/οδικώς" → "οδικώς". "πλοίο/ferry/ακτοπλοϊκώς" → "ακτοπλοϊκώς". Συνδυασμός → "συνδυαστικά". Αν δεν υπάρχει στοιχείο → null.

📋 SCHEMA — ΚΑΘΕ field σημαδεμένο [MUST] / [SHOULD] / [OPTIONAL]:

{
  "title": "[MUST] Ο τίτλος όπως ακριβώς εμφανίζεται (στα ελληνικά)",
  "description": "[MUST] SEO meta 150-170 χαρακτήρες — γράψε το ΜΕ ΒΑΣΗ ΜΟΝΟ ό,τι είδες (ποτέ φανταστικά). Ελληνικά.",
  "destination": "[MUST] Η κύρια πόλη/περιοχή — αυτολεξεί από HTML",
  "region": "[MUST] ellada|europi|kosmos — απόφασε με βάση τον προορισμό",
  "duration": "[MUST] { days, nights } — αν λείπει είτε days είτε nights, υπολόγισε το άλλο (συνήθως nights = days - 1). Αν ΚΑΝΕΝΑ από τα δύο δεν αναφέρεται, βάλε null.",
  "transport": "[SHOULD] αεροπορικώς|οδικώς|ακτοπλοϊκώς|συνδυαστικά — null αν δεν φαίνεται",
  "departureCities": "[SHOULD] array με πόλεις. [] αν δεν αναφέρονται.",
  "pickupSchedule": "[OPTIONAL] [{ city, location, time }] — μόνο αν αναφέρονται συγκεκριμένα σημεία/ώρες",
  "dates": "[MUST IF ANY] Όλες οι αναχωρήσεις που βρήκες, format ISO YYYY-MM-DD. [] αν δεν υπάρχει πίνακας ημερομηνιών.",
  "priceFrom": "[MUST IF ANY] Νούμερο (η ΜΙΚΡΟΤΕΡΗ τιμή που είδες). null αν δεν υπάρχει τιμή πουθενά.",
  "currency": "[OPTIONAL] '€' / '$' / 'GBP' — από context",
  "intro": "[OPTIONAL] Μία παράγραφος εισαγωγή — αυτολεξεί ή μετάφραση από το lead text. Αν δεν υπάρχει intro paragraph, null.",
  "itinerary": "[SHOULD] [{ day, title, description }] — αν υπάρχει day-by-day πρόγραμμα. ΚΑΘΕ μέρα από το HTML, όχι παραπάνω/λιγότερες.",
  "hotels": "[OPTIONAL] [{ name, location, nights, board, stars }] — αν αναφέρονται συγκεκριμένα ξενοδοχεία. ΟΧΙ generic.",
  "pricing": "[OPTIONAL] [{ fromCity, perPerson, singleSupplement }] — αν υπάρχει πίνακας τιμών ανά πόλη.",
  "includes": "[SHOULD] array — μόνο αν υπάρχει λίστα 'Περιλαμβάνει' / 'Includes'. [] αλλιώς.",
  "notIncludes": "[SHOULD] array — μόνο αν υπάρχει λίστα 'Δεν περιλαμβάνει' / 'Excludes'. [] αλλιώς.",
  "bookingProcess": "[OPTIONAL] array με βήματα κράτησης. [] αν δεν αναφέρεται.",
  "cancellationPolicy": "[OPTIONAL] array με όρους ακύρωσης. [] αν δεν αναφέρεται.",
  "notes": "[OPTIONAL] array με πρακτικές σημειώσεις (visa, διαβατήριο). [] αν δεν αναφέρεται.",
  "faqs": "[OPTIONAL] [{ q, a }] — μόνο αν υπάρχει FAQ section. [] αλλιώς.",
  "keywords": "[OPTIONAL] 5-10 SEO keywords στα ελληνικά — βγαλμένα από τον προορισμό + θέμα της εκδρομής (ΟΧΙ φανταστικά)",
  "images": "[OPTIONAL] Πλήρη URLs εικόνων που βρήκες (από <img src> ή srcset). Παρέλειψε logos/icons.",
  "imageQueries": "[OPTIONAL] 3-5 αγγλικά Unsplash queries (π.χ. 'Cappadocia balloons sunrise') — βασισμένα στον πραγματικό προορισμό",
  "originalLanguage": "[OPTIONAL] el|en|other",
  "_body": "[MUST] Markdown σύνοψη ΜΟΝΟ από εξαγμένα facts. Δομή: ## Στοιχεία (διάρκεια, μεταφορά, αναχωρήσεις) ## Τι περιλαμβάνει ## Πρόγραμμα ## Σημειώσεις. ΧΩΡΙΣ creative writing — μόνο reformatted facts. Αν λείπει ένα τμήμα από HTML, παρέλειψέ το (μην το γράψεις generic).",
  "_missing": "[MUST] Array από strings — ποια από τα MUST/SHOULD πεδία ΔΕΝ μπόρεσες να βρεις στο HTML. π.χ. ['dates', 'priceFrom', 'departureCities']. Άδειο [] αν τα βρήκες όλα.",
  "_evidence": "[OPTIONAL] { dates: 'snippet from html', priceFrom: 'snippet', duration: 'snippet' } — μικρά text snippets (≤80 χαρ.) που στηρίζουν κάθε key extraction. Βοηθάει τον χρήστη να επαληθεύσει."
}

ΜΟΝΟ JSON. Καμία εισαγωγή. Καμία code fence.

HTML:
${trimmed}`;
}

// ---------------------------------------------------------------------------
// Scrape verification — second-pass call AFTER the HTML extraction. Uses
// web_search to: (a) confirm each hotel actually exists + locate its
// official website (so we can scrape real photos and offer auto-create),
// and (b) cross-check the headline facts (price, dates, duration) against
// other listings of the same itinerary. Only the AI knows what to search
// for; we just hand it the extracted facts and let it verify.
// ---------------------------------------------------------------------------

export interface BuildScrapeVerifyOpts {
  sourceUrl: string;
  title: string;
  destination?: string;
  region?: 'ellada' | 'europi' | 'kosmos';
  duration?: { days?: number | null; nights?: number | null } | null;
  priceFrom?: number | null;
  currency?: string | null;
  dates?: string[];          // ISO strings, may be empty
  hotels: { name: string; location?: string; stars?: number }[];
}

export function buildScrapeVerifyPrompt(opts: BuildScrapeVerifyOpts): string {
  const {
    sourceUrl, title, destination, duration, priceFrom, currency = '€',
    dates = [], hotels = [],
  } = opts;

  const hotelLines = hotels.length
    ? hotels.map((h, i) => `  ${i + 1}. "${h.name}"${h.location ? ` (${h.location})` : ''}${h.stars ? ` ${h.stars}*` : ''}`).join('\n')
    : '  (κανένα συγκεκριμένο ξενοδοχείο δεν αναφέρθηκε)';

  const datesLine = dates.length
    ? dates.slice(0, 8).join(', ') + (dates.length > 8 ? ` (+${dates.length - 8} ακόμη)` : '')
    : '(δεν βρέθηκαν στο HTML)';

  const durationLine = duration && (duration.days || duration.nights)
    ? `${duration.days || '?'} ημέρες / ${duration.nights || '?'} νύχτες`
    : '(δεν βρέθηκε)';

  const priceLine = priceFrom ? `από ${currency}${priceFrom}` : '(δεν βρέθηκε)';

  return `Είσαι travel research analyst. Μόλις έγινε scrape μια εκδρομή από ${sourceUrl}. Πρέπει να **επαληθεύσεις** τα κρίσιμα δεδομένα με web_search ΠΡΙΝ καταχωρηθεί στο σύστημά μας.

📋 ΕΞΑΓΜΕΝΑ ΔΕΔΟΜΕΝΑ ΑΠΟ ΤΟ HTML:
• Τίτλος: ${title}
• Προορισμός: ${destination || '(άγνωστος)'}
• Διάρκεια: ${durationLine}
• Τιμή: ${priceLine}
• Ημερομηνίες: ${datesLine}
• Ξενοδοχεία:
${hotelLines}

🎯 ΕΡΓΑΣΙΕΣ — χρησιμοποίησε web_search 3-6 φορές, με αυτή τη σειρά:

**1. ΕΠΙΒΕΒΑΙΩΣΗ ΞΕΝΟΔΟΧΕΙΩΝ (προτεραιότητα Α — ΚΡΙΣΙΜΟ):**
Για ΚΑΘΕ ξενοδοχείο παραπάνω, ψάξε ξεχωριστά:
   "{όνομα ξενοδοχείου} {πόλη/προορισμός} official site"
Πρέπει να βρεις:
   • Το πραγματικό υπάρχον ξενοδοχείο (ή να επιβεβαιώσεις ότι δεν υπάρχει με αυτό το όνομα)
   • Το επίσημο URL του (ΟΧΙ booking.com / expedia / tripadvisor — αυτά είναι καλά μόνο ως cross-check)
   • Την ΑΚΡΙΒΗ ονομασία όπως αναφέρεται από το ίδιο
   • Την πόλη/συνοικία (επαλήθευσε)
   • Τα αστέρια (αν φαίνονται από επίσημη πηγή)

**2. ΔΙΑΣΤΑΥΡΩΣΗ ΤΙΜΗΣ + ΗΜΕΡΟΜΗΝΙΩΝ (προτεραιότητα Β):**
Μία αναζήτηση: "${title} ${destination || ''} τιμή 2026"
ή: "${destination || title} ${duration?.days || ''} ημέρες πακέτο 2026"
Στόχος: να δεις αν η ίδια ή παρόμοια εκδρομή πωλείται από άλλο γραφείο. Αν βρεις:
   • Σημαντικά μικρότερη τιμή (>15% διαφορά) → warning
   • Διαφορετικές ημερομηνίες (πάνω από 1 μήνα διαφορά) → warning
   • Ίδιο πρόγραμμα ίδια τιμή → όλα ΟΚ
Αν δεν βρεις τίποτα συγκρίσιμο, μην κάνεις warning — απλά παρέλειψε.

**3. ΕΠΙΒΕΒΑΙΩΣΗ ΠΡΟΟΡΙΣΜΟΥ (γρήγορο):**
Αν ο προορισμός είναι ασαφής (π.χ. "Λάρισα" — Ελλάδα ή Κύπρος;) διευκρίνισε με μία αναζήτηση. Αλλιώς παρέλειψε.

🚫 ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ:
• ΜΗΝ επινοείς. Αν το web_search δεν επιβεβαίωσε ένα ξενοδοχείο, βάλε confirmed: false.
• ΜΗΝ βάζεις generic warnings ("προσοχή στις τιμές"). Μόνο ΣΥΓΚΕΚΡΙΜΕΝΑ findings από αναζητήσεις.
• ΜΗΝ προσθέτεις πεδία πέρα από αυτά του schema.

Επέστρεψε ΜΟΝΟ JSON, αυτή την ακριβή δομή:

{
  "hotels": [
    {
      "name": "[ακριβώς όπως μου το έδωσες — για να μπορώ να κάνω match]",
      "confirmed": true/false,
      "officialName": "[όπως αναφέρεται από το ίδιο το ξενοδοχείο, αλλιώς null]",
      "officialWebsite": "[URL επίσημου site, αλλιώς null. ΟΧΙ booking.com.]",
      "city": "[επιβεβαιωμένη πόλη, αλλιώς null]",
      "stars": [επιβεβαιωμένα αστέρια ή null],
      "note": "[1 πρόταση μόνο αν χρειάζεται διευκρίνιση, αλλιώς null]"
    }
  ],
  "warnings": [
    "Συγκεκριμένο finding 1 (π.χ. 'Η ίδια εκδρομή πωλείται από Aegean Travel για €495, vs €595 εδώ')",
    "Συγκεκριμένο finding 2"
  ],
  "destinationCanonical": "[π.χ. 'Καππαδοκία, Τουρκία' — αλλιώς null αν ήδη ξεκάθαρο]",
  "_searchesUsed": [σύντομη λίστα queries που έκανες, για διαφάνεια]
}

ΜΟΝΟ JSON. Καμία εισαγωγή. Καμία code fence.`;
}

// ---------------------------------------------------------------------------
// Hotel — used when an admin spots a hotel mentioned by tours but with no
// hotel page yet, and wants AI to draft the entry. Context tours give the
// model real grounding (location, board type, what tours have observed)
// instead of generic invention.
// ---------------------------------------------------------------------------

export interface BuildHotelPromptOpts {
  name: string;
  /** Suggested destination from the orphan detector (often the tour's destination). */
  destination?: string;
  region?: 'ellada' | 'europi' | 'kosmos';
  /** City hint extracted from the tour hotel mention's `location` field, if any. */
  city?: string;
  /** Stars hint from the tour hotel mention. */
  stars?: number;
  /** Tours that mention this hotel — gives the model grounding. */
  contextTours?: { title: string; destination: string; nights?: number; board?: string }[];
}

export function buildHotelPrompt(opts: BuildHotelPromptOpts): string {
  const { name, destination, region, city, stars, contextTours = [] } = opts;
  const regionLabel = region
    ? { ellada: 'Ελλάδα', europi: 'Ευρώπη', kosmos: 'Κόσμος (εξωτερικό)' }[region]
    : '(άγνωστη)';

  const tourLines = contextTours.length
    ? contextTours
        .slice(0, 8)
        .map((t) => `  • "${t.title}" → προορισμός: ${t.destination}${t.nights ? ` · ${t.nights} νύχτες` : ''}${t.board ? ` · ${t.board}` : ''}`)
        .join('\n')
    : '  (καμία γνωστή εκδρομή)';

  // Search query suggestions — fed verbatim into the prompt so Claude knows
  // exactly what to look for. Mix English (for international sources) and
  // Greek (when the city is Greek).
  const cityHint = city || destination || '';
  const searchSuggestions = [
    `"${name}" ${cityHint} official site`,
    `"${name}" ${cityHint} address rooms amenities`,
    `"${name}" hotel reviews ${cityHint}`,
    `"${name}" ${cityHint} photos`,
  ];

  return `${STYLE_GUIDE}

ΑΠΟΣΤΟΛΗ: γράψε ΑΛΗΘΙΝΗ καταχώρηση για το ξενοδοχείο **${name}** βασισμένη ΜΟΝΟ σε δεδομένα που βρήκες με web search.

Συμφραζόμενα από εκδρομές μας:
${tourLines}

Hints (μπορεί να είναι ελλιπή — ΕΠΑΛΗΘΕΥΣΕ μέσω web_search):
• destination: ${destination || '(άγνωστο)'}
• region: ${regionLabel}
• city: ${city || '(άγνωστη)'}
• stars: ${stars || '(άγνωστα)'}

🔍 ΥΠΟΧΡΕΩΤΙΚΗ ΔΙΑΔΙΚΑΣΙΑ — WEB SEARCH FIRST, WRITE LATER:

ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, χρησιμοποίησε το web_search tool 3-5 φορές. Προτεινόμενα queries:
${searchSuggestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

Από τα αποτελέσματα ΠΡΟΣΕΞΕ:
• Επίσημο website του ίδιου του ξενοδοχείου (όχι Booking.com/Expedia/TripAdvisor — αυτά είναι απλώς πηγές για cross-check)
• Ακριβής διεύθυνση
• Πραγματικές παροχές (όπως αναφέρονται στο επίσημο site ή στο Booking)
• Πραγματικά room types και ονόματα κατηγοριών
• Αστέρια κατηγορίας (πιστοποιημένα, όχι rating από reviews)
• Check-in/check-out hours, τύπος πρωινού
• Συντεταγμένες (αν φαίνονται σε Google Maps embed)

🚫 ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ — ΜΗΔΕΝΙΚΗ ΕΠΙΝΟΗΣΗ:
• Αν ένα πεδίο ΔΕΝ φαίνεται σε κάποιο search result → null / [] / κενό. ΜΗΝ μάντεψες.
• ΜΗΝ εφεύρεις παροχές ("κανείς δε λέει spa" → ΟΧΙ spa).
• ΜΗΝ εφεύρεις room types ("δε γράφει Honeymoon Suite" → ΟΧΙ Honeymoon Suite).
• ΜΗΝ μάντεψες URLs — μόνο όσα έδωσε το web_search.
• ΜΗΝ γράψεις generic FAQ σε στιλ "Έχει το ξενοδοχείο πισίνα;" αν δεν βρήκες την πληροφορία.
• Πρόσθεσε στο _missing array οτιδήποτε δεν βρήκες (π.χ. ['breakfast', 'checkIn', 'coordinates']).

Επέστρεψε ΜΟΝΟ JSON, ακριβώς αυτή τη δομή:

{
  "name": "${name}",
  "aliases": ["σύντομη παραλλαγή ονόματος όπως εμφανίζεται σε διαφορετικές πηγές"],
  "description": "[MUST] SEO meta 140-180 χαρακτήρες — συγκεκριμένο, βασισμένο σε αληθινά facts. Όχι κλισέ.",
  "destination": "${destination || 'βρες τον προορισμό από web_search'}",
  "region": "${region || 'ellada|europi|kosmos — διάλεξε βάσει χώρας'}",
  "city": "η πόλη/συνοικία ακριβώς όπως αναφέρεται σε επίσημες πηγές",
  "address": "[MUST IF FOUND] πλήρης διεύθυνση όπως αναφέρεται στο site του ξενοδοχείου, αλλιώς null",
  "stars": "[MUST IF FOUND] 1-5 από επίσημη κατηγορία, αλλιώς null",
  "category": "σύντομη κατηγορία π.χ. 'Boutique', 'Resort 5*', 'Cave Hotel'",
  "intro": "1 παράγραφος 2-4 προτάσεων με αληθινά χαρακτηριστικά — όχι generic.",
  "amenities": ["[MUST IF FOUND] 6-15 ΠΡΑΓΜΑΤΙΚΕΣ παροχές από το επίσημο site/Booking. [] αν δεν βρήκες λίστα παροχών."],
  "roomTypes": [
    { "name": "[ακριβές όνομα κατηγορίας από το site]", "description": "1-2 προτάσεις από επίσημη περιγραφή" }
  ],
  "distances": [
    { "place": "Πραγματικό σημείο που αναφέρεται", "value": "π.χ. '500μ' ή '5 λεπτά με τα πόδια'" }
  ],
  "breakfast": "[MUST IF FOUND] όπως αναφέρεται, αλλιώς null",
  "checkIn": "[MUST IF FOUND] π.χ. '14:00', αλλιώς null",
  "checkOut": "[MUST IF FOUND] π.χ. '12:00', αλλιώς null",
  "officialWebsite": "[MUST IF FOUND] το URL του ίδιου του ξενοδοχείου, αλλιώς null. ΟΧΙ booking.com.",
  "coordinates": "[OPTIONAL] { lat, lng } αν φαίνονται σε Google Maps, αλλιώς null",
  "faqs": [
    { "q": "Πραγματική ερώτηση με γνωστή απάντηση από τα search results", "a": "Συγκεκριμένη απάντηση βασισμένη σε facts" }
  ],
  "keywords": ["5-8 ελληνικά SEO keywords βασισμένα σε αληθινά χαρακτηριστικά + προορισμό"],
  "sources": ["URL1", "URL2", "URL3 — όλα τα URLs που χρησιμοποίησες ως πηγές"],
  "_body": "Markdown σώμα 350-600 λέξεις με ## headers: 'Γιατί το ${name}', 'Τοποθεσία', 'Τύποι δωματίων', 'Παροχές', 'Πρακτικά'. Παράγραφοι κυρίως. ΜΟΝΟ από web_search facts. Αν ένα τμήμα δεν έχει αρκετά facts, παρέλειψέ το.",
  "_missing": "[MUST] Array από field names που δεν μπόρεσες να βρεις (π.χ. ['address','breakfast','coordinates']). [] αν τα βρήκες όλα."
}

ΜΟΝΟ έγκυρο JSON. Καμία εισαγωγή, κανένα code fence.`;
}
