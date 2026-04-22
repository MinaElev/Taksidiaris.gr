#!/usr/bin/env node
// Generates authentic-sounding Greek travel content for destinations + periods
// using Claude Opus 4.7. Output is human-feeling, SEO-strong, schema-valid.
//
// Usage:
//   node scripts/generate-content.mjs                  # all destinations + periods
//   node scripts/generate-content.mjs --only=santorini # one destination
//   node scripts/generate-content.mjs --periods-only   # only periods
//   node scripts/generate-content.mjs --skip-existing  # skip files that look already-rich

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ──────────────────────────────── env ────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('Missing .env at', envPath);
    process.exit(1);
  }
  for (const raw of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const client = new Anthropic({ maxRetries: 5 });
const MODEL = 'claude-opus-4-7';
const CONCURRENCY = 1;
const MAX_TOKENS = 7500;

// ──────────────────────────────── data ────────────────────────────────
const DESTINATIONS = [
  // Ελλάδα (28)
  { slug: 'alonnisos',  name: 'Αλόννησος',   region: 'ellada' },
  { slug: 'astypalaia', name: 'Αστυπάλαια',  region: 'ellada' },
  { slug: 'zakynthos',  name: 'Ζάκυνθος',    region: 'ellada' },
  { slug: 'irakleio',   name: 'Ηράκλειο',    region: 'ellada' },
  { slug: 'thasos',     name: 'Θάσος',       region: 'ellada' },
  { slug: 'ios',        name: 'Ίος',         region: 'ellada' },
  { slug: 'kerkyra',    name: 'Κέρκυρα',     region: 'ellada' },
  { slug: 'kefalonia',  name: 'Κεφαλονιά',   region: 'ellada' },
  { slug: 'kos',        name: 'Κως',         region: 'ellada' },
  { slug: 'lesvos',     name: 'Λέσβος',      region: 'ellada' },
  { slug: 'lefkada',    name: 'Λευκάδα',     region: 'ellada' },
  { slug: 'limnos',     name: 'Λήμνος',      region: 'ellada' },
  { slug: 'milos',      name: 'Μήλος',       region: 'ellada' },
  { slug: 'mykonos',    name: 'Μύκονος',     region: 'ellada' },
  { slug: 'naxos',      name: 'Νάξος',       region: 'ellada' },
  { slug: 'paros',      name: 'Πάρος',       region: 'ellada' },
  { slug: 'patmos',     name: 'Πάτμος',      region: 'ellada' },
  { slug: 'rodos',      name: 'Ρόδος',       region: 'ellada' },
  { slug: 'santorini',  name: 'Σαντορίνη',   region: 'ellada' },
  { slug: 'sifnos',     name: 'Σίφνος',      region: 'ellada' },
  { slug: 'skiathos',   name: 'Σκιάθος',     region: 'ellada' },
  { slug: 'skopelos',   name: 'Σκόπελος',    region: 'ellada' },
  { slug: 'skyros',     name: 'Σκύρος',      region: 'ellada' },
  { slug: 'syros',      name: 'Σύρος',       region: 'ellada' },
  { slug: 'tinos',      name: 'Τήνος',       region: 'ellada' },
  { slug: 'folegandros',name: 'Φολέγανδρος', region: 'ellada' },
  { slug: 'chania',     name: 'Χανιά',       region: 'ellada' },
  { slug: 'chios',      name: 'Χίος',        region: 'ellada' },

  // Ευρώπη (28)
  { slug: 'amsterdam',  name: 'Άμστερνταμ',     region: 'europi' },
  { slug: 'barcelona',  name: 'Βαρκελώνη',      region: 'europi' },
  { slug: 'warsaw',     name: 'Βαρσοβία',       region: 'europi' },
  { slug: 'belgrade',   name: 'Βελιγράδι',      region: 'europi' },
  { slug: 'venice',     name: 'Βενετία',        region: 'europi' },
  { slug: 'berlin',     name: 'Βερολίνο',       region: 'europi' },
  { slug: 'budapest',   name: 'Βουδαπέστη',     region: 'europi' },
  { slug: 'bucharest',  name: 'Βουκουρέστι',    region: 'europi' },
  { slug: 'vienna',     name: 'Βιέννη',         region: 'europi' },
  { slug: 'brussels',   name: 'Βρυξέλλες',      region: 'europi' },
  { slug: 'zurich',     name: 'Ζυρίχη',         region: 'europi' },
  { slug: 'copenhagen', name: 'Κοπεγχάγη',      region: 'europi' },
  { slug: 'krakow',     name: 'Κρακοβία',       region: 'europi' },
  { slug: 'istanbul',   name: 'Κωνσταντινούπολη',region: 'europi' },
  { slug: 'lisbon',     name: 'Λισαβόνα',       region: 'europi' },
  { slug: 'london',     name: 'Λονδίνο',        region: 'europi' },
  { slug: 'madrid',     name: 'Μαδρίτη',        region: 'europi' },
  { slug: 'malta',      name: 'Μάλτα',          region: 'europi' },
  { slug: 'milan',      name: 'Μιλάνο',         region: 'europi' },
  { slug: 'bansko',     name: 'Μπάνσκο',        region: 'europi' },
  { slug: 'naples',     name: 'Νάπολη',         region: 'europi' },
  { slug: 'dubrovnik',  name: 'Ντουμπρόβνικ',   region: 'europi' },
  { slug: 'paris',      name: 'Παρίσι',         region: 'europi' },
  { slug: 'prague',     name: 'Πράγα',          region: 'europi' },
  { slug: 'rome',       name: 'Ρώμη',           region: 'europi' },
  { slug: 'sofia',      name: 'Σόφια',          region: 'europi' },
  { slug: 'tallinn',    name: 'Ταλίν',          region: 'europi' },
  { slug: 'florence',   name: 'Φλωρεντία',      region: 'europi' },

  // Κόσμος (14)
  { slug: 'egypt',      name: 'Αίγυπτος',     region: 'kosmos' },
  { slug: 'america',    name: 'Αμερική',      region: 'kosmos' },
  { slug: 'vietnam',    name: 'Βιετνάμ',      region: 'kosmos' },
  { slug: 'japan',      name: 'Ιαπωνία',      region: 'kosmos' },
  { slug: 'jordan',     name: 'Ιορδανία',     region: 'kosmos' },
  { slug: 'cappadocia', name: 'Καππαδοκία',   region: 'kosmos' },
  { slug: 'cuba',       name: 'Κούβα',        region: 'kosmos' },
  { slug: 'maldives',   name: 'Μαλδίβες',     region: 'kosmos' },
  { slug: 'morocco',    name: 'Μαρόκο',       region: 'kosmos' },
  { slug: 'bali',       name: 'Μπαλί',        region: 'kosmos' },
  { slug: 'dubai',      name: 'Ντουμπάι',     region: 'kosmos' },
  { slug: 'singapore',  name: 'Σιγκαπούρη',   region: 'kosmos' },
  { slug: 'thailand',   name: 'Ταϊλάνδη',     region: 'kosmos' },
  { slug: 'tunisia',    name: 'Τυνησία',      region: 'kosmos' },
];

const PERIODS = [
  { slug: 'pasxa',           name: 'Εκδρομές Πάσχα',                       shortName: 'Πάσχα',                      dates: 'Μεγάλη Εβδομάδα — Κυριακή του Πάσχα (Απρίλιος)' },
  { slug: 'christougenna',   name: 'Εκδρομές Χριστούγεννα & Πρωτοχρονιά', shortName: 'Χριστούγεννα & Πρωτοχρονιά', dates: '23 Δεκεμβρίου — 6 Ιανουαρίου' },
  { slug: 'agiou-pnevmatos', name: 'Εκδρομές Αγίου Πνεύματος',             shortName: 'Αγίου Πνεύματος',            dates: 'Παρασκευή — Δευτέρα Αγίου Πνεύματος (Ιούνιος)' },
  { slug: 'agiou-valentinou',name: 'Εκδρομές Αγίου Βαλεντίνου',            shortName: 'Αγίου Βαλεντίνου',           dates: '14 Φεβρουαρίου — Σαββατοκύριακο' },
  { slug: 'apokries',        name: 'Εκδρομές Απόκριες & Καθαρά Δευτέρα',  shortName: 'Απόκριες & Καθαρά Δευτέρα',  dates: 'Τσικνοπέμπτη — Καθαρά Δευτέρα (Φεβρουάριος/Μάρτιος)' },
  { slug: '25-martiou',      name: 'Εκδρομές 25ης Μαρτίου',                shortName: '25η Μαρτίου',                dates: '25 Μαρτίου — τριήμερο' },
  { slug: '28-oktovriou',    name: 'Εκδρομές 28ης Οκτωβρίου',              shortName: '28η Οκτωβρίου',              dates: '28 Οκτωβρίου — τριήμερο' },
  { slug: '17-noemvri',      name: 'Εκδρομές 17ης Νοεμβρίου',              shortName: '17 Νοέμβρη',                 dates: '17 Νοεμβρίου — τριήμερο' },
  { slug: 'protomagia',      name: 'Εκδρομές Πρωτομαγιάς',                 shortName: 'Πρωτομαγιά',                 dates: '1 Μαΐου — τριήμερο/τετραήμερο' },
  { slug: 'kalokairi',       name: 'Καλοκαιρινές Εκδρομές',                shortName: 'Καλοκαίρι',                  dates: 'Ιούνιος — Σεπτέμβριος' },
];

// ──────────────────────────────── prompts ────────────────────────────────
const STYLE_GUIDE = `Είσαι έμπειρος Έλληνας ταξιδιωτικός συντάκτης που γράφει για το ελληνικό ταξιδιωτικό γραφείο "Ταξιδιάρης". Γράφεις περιεχόμενο που μοιάζει 100% γραμμένο από άνθρωπο - όχι από AI. Στόχος: αυθεντικά, χρήσιμα, SEO-δυνατά κείμενα στα ελληνικά.

ΚΟΚΚΙΝΕΣ ΓΡΑΜΜΕΣ - μην γράψεις ΠΟΤΕ:
• Γενικότητες: "μαγικός προορισμός", "ονειρεμένη εμπειρία", "ξεχωριστές αναμνήσεις", "για μικρούς και μεγάλους"
• Επανάληψη ίδιων επιθέτων ("μοναδικός", "υπέροχος", "συναρπαστικός") σε κάθε παράγραφο
• Φράσεις-καλούπια: "είτε αναζητάτε... είτε...", "δεν υπάρχει καλύτερος τρόπος από...", "θα μείνετε άφωνοι"
• Υπερβολικά bullet lists. Χρησιμοποίησε λίστες ΜΟΝΟ όπου έχει νόημα. Γράψε σε παραγράφους κυρίως.
• Παρόμοιες δομές παραγράφων - όλες ίδιο μήκος, ίδιο pattern
• Markdown headers (##) μέσα στα sections - κάθε section επιστρέφεται ως ΚΑΘΑΡΟ κείμενο με παραγράφους
• Emojis
• Αμερικανικά clichés μεταφρασμένα ("nestled in", "boasting", "offering")
• Περιττή ευγένεια προς τον αναγνώστη ("όπως ξέρετε", "σίγουρα έχετε ακούσει")
• Πληροφορίες που δεν είσαι σίγουρος ότι ισχύουν - ΠΑΡΕΛΕΙΨΕ αντί να εφεύρεις

ΓΡΑΨΕ ΕΤΣΙ:
• Συγκεκριμένα ονόματα: αληθινές παραλίες (Σαρακήνικο, Έλαφονήσι), συνοικίες (Πλάκα, Αναφιώτικα), αξιοθέατα, πιάτα (αρακάς λαδερός, μελιτζανοσαλάτα), ταβέρνες-θεσμούς όπου το ξέρεις σίγουρα
• Πρακτικές πληροφορίες: "πτήση 3 ώρες από Αθήνα", "ferry 4ωρο από Πειραιά", "θερμοκρασίες 28-32°C τον Αύγουστο"
• Insider tips: "νωρίς το πρωί αποφεύγεις τα πούλμαν", "πάρε καπέλο για τη Θόλο", "αν κρατήσεις 2 βδομάδες πριν, βρίσκεις 30% κάτω"
• Ποικιλία ρυθμού: σύντομες προτάσεις δίπλα σε μακρύτερες. Καμιά φορά ελλειπτική φράση. Καμιά φορά 3 φράσεις σε μία παράγραφο, καμιά φορά 6.
• Καθημερινό λεξιλόγιο - όπως μιλάει Έλληνας ταξιδιωτικός πράκτορας, όχι ακαδημαϊκός
• Καμιά παρατήρηση που δείχνει ότι κάποιος πραγματικά πήγε εκεί ("το νερό είναι παγωμένο μέχρι τον Ιούνιο", "τα μαγαζιά κλείνουν στις 14:00 για σιέστα")
• Ορθογραφία και τονισμός άψογα, όχι μονοτονικό λάθος
• Όταν αναφέρεις πιθανότητα, να είσαι σαφής: "συνήθως", "τις περισσότερες χρονιές" - όχι ψευτο-βεβαιότητες

ΤΟΝΟΣ: Φιλικός, έμπειρος, χωρίς ψεύτικη οικειότητα. Σαν φίλος που γνωρίζει το θέμα. Δεν πουλάς - μοιράζεσαι ώφελος.

ΓΡΑΜΜΑΤΙΚΗ:
• Πάντα πολυτονικό σωστό... όχι, εννοώ μονοτονικό σωστό. Όλοι οι τόνοι στη θέση τους.
• Όχι ξενόγλωσσες λέξεις χωρίς λόγο. Π.χ. "καταλύματα" όχι "accommodations".
• Όνομα προορισμού: γράψε όπως είναι στα ελληνικά (Σαντορίνη, Παρίσι, Ιαπωνία).

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: Πάντα ΜΟΝΟ έγκυρο JSON object. Καμία εισαγωγή, κανένα code fence, κανένα σχόλιο πριν ή μετά. Ξεκίνα με { και τελείωσε με }.`;

function buildDestinationPrompt(d) {
  const regionLabel = { ellada: 'Ελλάδα', europi: 'Ευρώπη', kosmos: 'Εξωτερικό (Κόσμος)' }[d.region];
  const regionContext = {
    ellada: 'Ελληνικός νησιωτικός ή ηπειρωτικός προορισμός. Στο κοινό μιλάς Έλληνες που σκέφτονται διακοπές. Έμφαση: παραλίες, χωριά, κουζίνα, αξιοθέατα, πρακτική μεταφορά (ακτοπλοϊκό/πτήση/οδικό).',
    europi: 'Ευρωπαϊκή πόλη ή χώρα/περιοχή. Στο κοινό μιλάς Έλληνες που θα ταξιδέψουν αεροπορικώς για 3-7 ημέρες. Έμφαση: αξιοθέατα-must, κουζίνα, συνοικίες, μεταφορά από αεροδρόμιο, ασφάλεια, καιρός ανά εποχή.',
    kosmos: 'Μακρινός προορισμός εκτός Ευρώπης. Έλληνες ταξιδιώτες που σκέφτονται 7-14 ημέρες, οργανωμένο πακέτο. Έμφαση: visa/διαβατήριο, εμβολιασμοί όπου χρειάζεται, καλύτερη εποχή, διατροφή/υγεία, πολιτισμικά ζητήματα.'
  }[d.region];

  return `Γράψε αυθεντικό περιεχόμενο για τον προορισμό **${d.name}** (${regionLabel}).

Πλαίσιο: ${regionContext}

Επέστρεψε JSON με αυτή τη ΑΚΡΙΒΗ δομή:

{
  "description": "SEO meta description, 150-170 χαρακτήρες, που πραγματικά κάνει click. Όχι 'ταξιδιωτικός οδηγός για...' - κάτι ζωντανό.",
  "intro": "Μία παράγραφος (2-4 προτάσεις) που στήνει τον προορισμό. Συγκεκριμένη εικόνα, όχι γενικότητες. Π.χ. όχι 'υπέροχο νησί' αλλά 'βραχώδης βορειά πλαγιά πάνω από την Καλντέρα, ασβεστωμένα σπίτια στην Οία'.",
  "bestTime": "Σύντομα - π.χ. 'Μάιος έως Σεπτέμβριος' ή 'Όλο τον χρόνο, ιδανικά Απρίλιος-Οκτώβριος'",
  "duration": "Σύντομα - π.χ. '4-6 ημέρες' ή 'Σαββατοκύριακο 3 ημέρες'",
  "highlights": [
    "4-6 ΣΥΓΚΕΚΡΙΜΕΝΑ items - όχι 'όμορφες παραλίες' αλλά 'Παραλία Σίμου με τιρκουάζ νερά στην Ελαφόνησο'",
    "Μέγεθος: 5-12 λέξεις το καθένα"
  ],
  "faqs": [
    { "q": "Πραγματική ερώτηση που κάνει κόσμος", "a": "Συγκεκριμένη απάντηση 2-4 προτάσεων με πραγματικές πληροφορίες. Όχι 'εξαρτάται από τις προτιμήσεις σας'." },
    "...3-4 FAQs συνολικά. Διαφορετικά θέματα: εποχή, διάρκεια, μεταφορά, τι να φάει/δει, με παιδιά, κόστος γενικά κτλ. Όχι ίδιες σε κάθε προορισμό."
  ],
  "keywords": [
    "5-8 keywords στα ελληνικά - μίξη short-tail (π.χ. 'σαντορίνη') και long-tail (π.χ. 'σαντορίνη πασχα 2026 πακετα')",
    "Μην επαναλαμβάνεις τη λέξη keyword - απλά γράψε τη φράση"
  ],
  "sections": {
    "whyChoose": "120-180 λέξεις. Τι κάνει αυτόν τον προορισμό ξεχωριστό από τους ομοίους του (όχι από όλη τη γη). Χρησιμοποίησε σύγκριση όπου ταιριάζει ('σε αντίθεση με τη Μύκονο, η Πάρος...'). Καθαρό κείμενο, 1-2 παράγραφοι.",
    "whatToSee": "180-260 λέξεις. Συγκεκριμένα αξιοθέατα/τοποθεσίες με ονόματα και 1 πρόταση γιατί. Μπορείς να βάλεις 4-6 σημεία με τις περιγραφές τους σε ένα ροή κειμένου ή λίστα. Επίτρεψε ένα bullet list ΕΑΝ έχει νόημα.",
    "howToGet": "100-150 λέξεις. Πώς πας από Αθήνα/Θεσσαλονίκη: αεροπορικά (πτήση πόσες ώρες, ποιες αεροπορικές), ακτοπλοϊκά (ferry χρόνος, λιμάνι αναχώρησης), οδικά. Πραγματικές πληροφορίες όπου ξέρεις σίγουρα.",
    "whenToGo": "120-180 λέξεις. Καιρός ανά εποχή (θερμοκρασίες, βροχές), peak/shoulder/low season, πότε λειτουργούν τα μαγαζιά. Συμβουλή για την καλύτερη περίοδο και γιατί.",
    "whereToStay": "120-180 λέξεις. 2-3 περιοχές διαμονής με τα χαρακτηριστικά τους. Τύπος καταλύματος που ταιριάζει σε τι κοινό. Όχι συγκεκριμένα ξενοδοχεία ονομαστικά (μπορεί να μην υπάρχουν πια).",
    "tips": "100-160 λέξεις. 4-6 πρακτικές συμβουλές που μόνο insider ξέρει. Όχι γενικότητες όπως 'φέρε αντηλιακό'. Συγκεκριμένα: ωράρια, αποφυγή τουριστικών παγίδων, οικονομία, εθιμοτυπία.",
    "packages": "60-90 λέξεις. Σύντομο, μη-πιεστικό κάλεσμα προς τον αναγνώστη να επικοινωνήσει με το γραφείο 'Ταξιδιάρης' για οργανωμένο πακέτο. Όχι hard sell."
  }
}

ΠΡΟΣΟΧΗ: Κάθε section επιστρέφεται ως ΚΑΘΑΡΟ ΚΕΙΜΕΝΟ - χωρίς ## headers, χωρίς **bold** στις περισσότερες περιπτώσεις (επιτρεπτό μόνο όπου είναι φυσικό, π.χ. ονόματα παραλιών σε λίστα). Παράγραφοι χωρίζονται με κενή γραμμή (\\n\\n).

Επέστρεψε ΜΟΝΟ το JSON object. Καμία εισαγωγή.`;
}

function buildPeriodPrompt(p) {
  return `Γράψε αυθεντικό περιεχόμενο για την περίοδο εκδρομών: **${p.name}** (${p.dates}).

Στοχεύεις σε Έλληνες που σκέφτονται να φύγουν για διακοπές αυτή την περίοδο. Το γραφείο "Ταξιδιάρης" οργανώνει πακέτα.

Επέστρεψε JSON με αυτή τη ΑΚΡΙΒΗ δομή:

{
  "description": "SEO meta description, 150-170 χαρακτήρες, που τραβάει το μάτι. Όχι κλισέ.",
  "intro": "Μία παράγραφος (2-4 προτάσεις) - τι ξεχωρίζει αυτή την περίοδο για ταξίδι, τι είδους κοινό την επιλέγει.",
  "popularDestinations": [
    "5-8 ΣΥΓΚΕΚΡΙΜΕΝΟΙ προορισμοί που ταιριάζουν στην περίοδο. Π.χ. για Πάσχα: Κέρκυρα, Πάτμος, Ρώμη, Πράγα, Καππαδοκία. Για Καλοκαίρι: ελληνικά νησιά + εξωτικά. Σύντομα ονόματα μόνο."
  ],
  "faqs": [
    { "q": "Ερώτηση που κάνει κόσμος για ΑΥΤΗ την περίοδο", "a": "Απάντηση 2-4 προτάσεων με πραγματικές πληροφορίες." },
    "...3-4 FAQs συνολικά. Π.χ. πότε να κρατήσω, τι περιλαμβάνει το πακέτο, πόσο κοστίζει συνήθως, ταξίδι με παιδιά, ακυρώσεις."
  ],
  "keywords": [
    "5-8 ελληνικά keywords π.χ. 'εκδρομες πασχα 2026', 'πασχα στην κερκυρα', 'πακετα πασχα εξωτερικο'"
  ],
  "sections": {
    "intro": "150-220 λέξεις. Για ποιους είναι αυτή η περίοδος ιδανική, τι ατμόσφαιρα έχει, τι ξεχωρίζει σε σχέση με άλλες περιόδους. Καθαρό κείμενο σε 2-3 παραγράφους.",
    "destinations": "180-260 λέξεις. Παρουσίαση 4-6 κορυφαίων προορισμών για τη συγκεκριμένη περίοδο, με 1-2 προτάσεις περιγραφή ο καθένας γιατί ταιριάζει. Μπορεί να είναι λίστα ή ροή κειμένου.",
    "whatIncluded": "120-180 λέξεις. Τι περιλαμβάνει ένα τυπικό οργανωμένο πακέτο για την περίοδο: αεροπορικά/ακτοπλοϊκά, διαμονή, μεταφορές, ξεναγήσεις, συνοδός. Τι συνήθως δεν περιλαμβάνεται.",
    "tips": "100-160 λέξεις. 4-6 πρακτικές συμβουλές για την περίοδο: πότε να κάνεις κράτηση, τι να προσέξεις (peak prices, διαθεσιμότητα), έθιμα για θρησκευτικές εορτές κτλ.",
    "booking": "60-90 λέξεις. Σύντομο, μη πιεστικό κάλεσμα προς το γραφείο 'Ταξιδιάρης'. Πληροφορία ότι μπορούν να επικοινωνήσουν για διαθεσιμότητα και αναλυτικό πρόγραμμα."
  }
}

Επέστρεψε ΜΟΝΟ το JSON object. Όχι code fences, όχι εισαγωγή.`;
}

// ──────────────────────────────── markdown builders ────────────────────────────────
function yamlString(s) {
  // safe double-quoted YAML scalar
  const esc = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
  return '"' + esc + '"';
}
function yamlList(arr) {
  return arr.map(s => `  - ${yamlString(s)}`).join('\n');
}
function yamlFaqs(arr) {
  return arr.map(({ q, a }) => `  - q: ${yamlString(q)}\n    a: ${yamlString(a)}`).join('\n');
}

function buildDestinationMarkdown(d, c) {
  const today = new Date().toISOString().slice(0, 10);
  return `---
title: ${yamlString(d.name)}
description: ${yamlString(c.description)}
region: ${d.region}
intro: ${yamlString(c.intro)}
bestTime: ${yamlString(c.bestTime)}
duration: ${yamlString(c.duration)}
highlights:
${yamlList(c.highlights)}
faqs:
${yamlFaqs(c.faqs)}
keywords:
${yamlList(c.keywords)}
draft: false
updatedAt: ${today}
---

## Γιατί να επιλέξετε ${d.name}

${c.sections.whyChoose}

## Τι να δείτε

${c.sections.whatToSee}

## Πώς θα φτάσετε

${c.sections.howToGet}

## Πότε να πάτε

${c.sections.whenToGo}

## Πού θα μείνετε

${c.sections.whereToStay}

## Συμβουλές ταξιδιού

${c.sections.tips}

## Προτεινόμενα προγράμματα

${c.sections.packages}
`;
}

function buildPeriodMarkdown(p, c) {
  return `---
title: ${yamlString(p.name)}
description: ${yamlString(c.description)}
shortName: ${yamlString(p.shortName)}
dates: ${yamlString(p.dates)}
intro: ${yamlString(c.intro)}
popularDestinations:
${yamlList(c.popularDestinations)}
faqs:
${yamlFaqs(c.faqs)}
keywords:
${yamlList(c.keywords)}
draft: false
---

## ${p.shortName} με τον Ταξιδιάρη

${c.sections.intro}

## Δημοφιλείς προορισμοί

${c.sections.destinations}

## Τι περιλαμβάνει το πακέτο

${c.sections.whatIncluded}

## Συμβουλές για την κράτησή σας

${c.sections.tips}

## Πληροφορίες & κρατήσεις

${c.sections.booking}
`;
}

// ──────────────────────────────── claude call ────────────────────────────────
function extractJson(text) {
  let t = text.trim();
  // remove code fences if present
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  // strip leading non-json
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first > 0 || last < t.length - 1) {
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
  }
  return JSON.parse(t);
}

async function callClaude(userPrompt) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: STYLE_GUIDE, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: userPrompt }],
  });
  const finalMessage = await stream.finalMessage();
  let text = '';
  for (const block of finalMessage.content) {
    if (block.type === 'text') text += block.text;
  }
  return { text, usage: finalMessage.usage };
}

function isAlreadyGenerated(filePath) {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, 'utf-8');
  // Generated files have an updatedAt field in the frontmatter; stubs don't.
  return /^updatedAt:\s*\d{4}-\d{2}-\d{2}/m.test(content);
}

// ──────────────────────────────── one-item processors ────────────────────────────────
async function generateDestination(d, attempt = 1) {
  const label = `${d.region}/${d.slug}`.padEnd(28);
  const outPath = join(ROOT, 'src', 'content', 'destinations', d.region, `${d.slug}.md`);
  if (attempt === 1 && isAlreadyGenerated(outPath)) {
    console.log(`⊘ ${label}  already generated, skipping`);
    return { ok: true, skipped: true };
  }
  try {
    const { text, usage } = await callClaude(buildDestinationPrompt(d));
    const content = extractJson(text);
    const md = buildDestinationMarkdown(d, content);
    writeFileSync(outPath, md, 'utf-8');
    const cr = usage?.cache_read_input_tokens ?? 0;
    const cc = usage?.cache_creation_input_tokens ?? 0;
    const ot = usage?.output_tokens ?? 0;
    console.log(`✓ ${label}  out=${ot}  cache_read=${cr}  cache_create=${cc}`);
    return { ok: true };
  } catch (err) {
    if (attempt < 3) {
      console.warn(`⚠ ${label}  attempt ${attempt} failed: ${(err.message || err).toString().slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 30000 * attempt));
      return generateDestination(d, attempt + 1);
    }
    console.error(`✗ ${label}  FAILED after 3: ${(err.message || err).toString().slice(0, 200)}`);
    return { ok: false, error: err.message };
  }
}

async function generatePeriod(p, attempt = 1) {
  const label = `period/${p.slug}`.padEnd(28);
  const outPath = join(ROOT, 'src', 'content', 'periods', `${p.slug}.md`);
  if (attempt === 1 && existsSync(outPath) && /^dates:\s/m.test(readFileSync(outPath, 'utf-8'))) {
    console.log(`⊘ ${label}  already generated, skipping`);
    return { ok: true, skipped: true };
  }
  try {
    const { text, usage } = await callClaude(buildPeriodPrompt(p));
    const content = extractJson(text);
    const md = buildPeriodMarkdown(p, content);
    writeFileSync(outPath, md, 'utf-8');
    const cr = usage?.cache_read_input_tokens ?? 0;
    const cc = usage?.cache_creation_input_tokens ?? 0;
    const ot = usage?.output_tokens ?? 0;
    console.log(`✓ ${label}  out=${ot}  cache_read=${cr}  cache_create=${cc}`);
    return { ok: true };
  } catch (err) {
    if (attempt < 3) {
      console.warn(`⚠ ${label}  attempt ${attempt} failed: ${(err.message || err).toString().slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 30000 * attempt));
      return generatePeriod(p, attempt + 1);
    }
    console.error(`✗ ${label}  FAILED after 3: ${(err.message || err).toString().slice(0, 200)}`);
    return { ok: false, error: err.message };
  }
}

// ──────────────────────────────── batching ────────────────────────────────
async function processInBatches(items, batchSize, fn, label) {
  const results = [];
  const total = items.length;
  const totalBatches = Math.ceil(total / batchSize);
  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`\n── ${label} batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, total)} of ${total}) ──`);
    const r = await Promise.all(batch.map(fn));
    results.push(...r);
    // Rate-limit cool-off: after each batch that actually called the API
    // (i.e., not all skipped), wait long enough for the rolling 60s window
    // to clear the previous request's max_tokens reservation.
    const didApiCall = r.some(x => !x.skipped);
    const isLast = i + batchSize >= total;
    if (didApiCall && !isLast) {
      const waitMs = 65000;
      console.log(`   … sleeping ${waitMs / 1000}s for rate-limit window`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  return results;
}

// ──────────────────────────────── main ────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find(a => a.startsWith('--only='));
  const periodsOnly = args.includes('--periods-only');
  const destinationsOnly = args.includes('--destinations-only');

  const startTime = Date.now();
  const allResults = [];

  if (!periodsOnly) {
    let dests = DESTINATIONS;
    if (onlyArg) {
      const slug = onlyArg.split('=')[1];
      dests = DESTINATIONS.filter(d => d.slug === slug);
      if (!dests.length) {
        console.error(`No destination matches slug: ${slug}`);
        process.exit(1);
      }
    }
    console.log(`\n══════ Generating ${dests.length} destinations (concurrency=${CONCURRENCY}) ══════`);
    const r = await processInBatches(dests, CONCURRENCY, generateDestination, 'DEST');
    allResults.push(...r);
  }

  if (!destinationsOnly && !onlyArg) {
    console.log(`\n══════ Generating ${PERIODS.length} periods (concurrency=${CONCURRENCY}) ══════`);
    const r = await processInBatches(PERIODS, CONCURRENCY, generatePeriod, 'PER');
    allResults.push(...r);
  }

  const ok = allResults.filter(r => r.ok).length;
  const fail = allResults.length - ok;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n════════════════════════════════════════════`);
  console.log(`Done in ${elapsed}s — ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
