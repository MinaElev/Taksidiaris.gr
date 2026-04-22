// One-time content stub generator.
// Run with: node scripts/generate-stubs.mjs
// Creates a markdown stub for every destination + period if it doesn't already exist.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DESTINATIONS = [
  // Ελλάδα
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
  // Ευρώπη
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
  // Κόσμος
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
  { slug: 'pasxa',           name: 'Εκδρομές Πάσχα',                     shortName: 'Πάσχα',                       desc: 'Πασχαλινές εκδρομές σε Ελλάδα και εξωτερικό. Επιλεγμένα προγράμματα για να ζήσετε αξέχαστο Πάσχα.' },
  { slug: 'christougenna',   name: 'Εκδρομές Χριστούγεννα & Πρωτοχρονιά',shortName: 'Χριστούγεννα & Πρωτοχρονιά',  desc: 'Εορταστικές εκδρομές για τα Χριστούγεννα, την Πρωτοχρονιά και τα Θεοφάνεια — από χριστουγεννιάτικες αγορές μέχρι ζεστούς προορισμούς.' },
  { slug: 'agiou-pnevmatos', name: 'Εκδρομές Αγίου Πνεύματος',           shortName: 'Αγίου Πνεύματος',             desc: 'Τριήμερο Αγίου Πνεύματος — ιδανική περίοδος για τετραήμερες αποδράσεις σε Ελλάδα και Ευρώπη.' },
  { slug: 'agiou-valentinou',name: 'Εκδρομές Αγίου Βαλεντίνου',          shortName: 'Αγίου Βαλεντίνου',            desc: 'Ρομαντικά ταξίδια για δύο — πόλεις του έρωτα, εξωτικά νησιά και ξεχωριστά city breaks.' },
  { slug: 'apokries',        name: 'Εκδρομές Απόκριες & Καθαρά Δευτέρα', shortName: 'Απόκριες & Καθαρά Δευτέρα',   desc: 'Αποκριάτικα ταξίδια και τριήμερο Καθαράς Δευτέρας — καρναβάλια, παραδοσιακές εορτές και αποδράσεις στην εξοχή.' },
  { slug: '25-martiou',      name: 'Εκδρομές 25ης Μαρτίου',              shortName: '25η Μαρτίου',                 desc: 'Τριήμερο 25ης Μαρτίου — εκδρομές σε Ελλάδα και Ευρώπη για να αξιοποιήσετε τη μεγάλη εθνική αργία.' },
  { slug: '28-oktovriou',    name: 'Εκδρομές 28ης Οκτωβρίου',            shortName: '28η Οκτωβρίου',               desc: 'Φθινοπωρινές εκδρομές για το τριήμερο της 28ης Οκτωβρίου — επιλεγμένοι προορισμοί για όλα τα γούστα.' },
  { slug: '17-noemvri',      name: 'Εκδρομές 17ης Νοεμβρίου',            shortName: '17 Νοέμβρη',                  desc: 'Τριήμερο 17 Νοεμβρίου — αποδράσεις σε κοντινούς και μακρινούς προορισμούς.' },
  { slug: 'protomagia',      name: 'Εκδρομές Πρωτομαγιάς',               shortName: 'Πρωτομαγιά',                  desc: 'Εκδρομές Πρωτομαγιάς — ιδανική περίοδος για ανοιξιάτικα ταξίδια στη φύση και τις πόλεις.' },
  { slug: 'kalokairi',       name: 'Καλοκαιρινές Εκδρομές',              shortName: 'Καλοκαίρι',                   desc: 'Καλοκαιρινές διακοπές σε Ελλάδα, Ευρώπη και εξωτικούς προορισμούς — θάλασσα, πολιτισμός και ξεκούραση.' },
];

// Region-specific defaults for body & frontmatter
function regionDefaults(region) {
  if (region === 'ellada') {
    return {
      bestTime: 'Μάιος – Σεπτέμβριος',
      duration: '3 – 7 ημέρες',
      highlights: [
        'Παραλίες με κρυστάλλινα νερά',
        'Παραδοσιακά γραφικά χωριά',
        'Τοπική κουζίνα και θαλασσινά',
        'Ηλιοβασιλέματα και βραδινές βόλτες',
      ],
      introTpl: (n) => `${n}: ένας από τους πιο όμορφους ελληνικούς προορισμούς, με γνήσιο νησιωτικό χαρακτήρα, μοναδικά τοπία και αυθεντικές εμπειρίες για κάθε επισκέπτη.`,
    };
  }
  if (region === 'europi') {
    return {
      bestTime: 'Άνοιξη & Φθινόπωρο',
      duration: '3 – 5 ημέρες (city break)',
      highlights: [
        'Ιστορικό κέντρο και μνημεία',
        'Μουσεία παγκόσμιας κλάσης',
        'Πολιτιστική κουζίνα και καφέ',
        'Εμπορικοί δρόμοι και αγορές',
      ],
      introTpl: (n) => `${n}: ένας μοναδικός ευρωπαϊκός προορισμός με πλούσια ιστορία, ζωντανή πολιτιστική σκηνή και χαρακτήρα που σε κερδίζει από την πρώτη στιγμή.`,
    };
  }
  return {
    bestTime: 'Διαφέρει ανά εποχή',
    duration: '7 – 14 ημέρες',
    highlights: [
      'Μοναδικά φυσικά τοπία',
      'Αυθεντική τοπική κουλτούρα',
      'Εξωτική γαστρονομία',
      'Αξέχαστες εμπειρίες ζωής',
    ],
    introTpl: (n) => `${n}: ένας μακρινός, εξωτικός προορισμός που υπόσχεται αξέχαστες εμπειρίες, μοναδικά τοπία και βαθιά πολιτιστική επαφή.`,
  };
}

function destinationStub(d) {
  const def = regionDefaults(d.region);
  const intro = def.introTpl(d.name);
  const description = `Ταξιδιωτικός οδηγός για ${d.name}: τι να δείτε, πότε να πάτε, πώς θα φτάσετε, χρήσιμες συμβουλές και προτεινόμενα προγράμματα από τον Ταξιδιάρη.`;

  const fm = `---
title: "${d.name}"
description: "${description}"
region: ${d.region}
intro: "${intro}"
bestTime: "${def.bestTime}"
duration: "${def.duration}"
highlights:
${def.highlights.map((h) => `  - "${h}"`).join('\n')}
faqs:
  - q: "Πότε είναι η καλύτερη εποχή για να επισκεφτείτε ${d.name};"
    a: "Η ιδανική περίοδος για ${d.name} είναι ${def.bestTime}, καθώς ο καιρός είναι ευχάριστος και οι παροχές πλήρως διαθέσιμες."
  - q: "Πόσες ημέρες χρειάζομαι για να επισκεφτώ ${d.name};"
    a: "Για μια ολοκληρωμένη εμπειρία προτείνουμε ${def.duration}, ώστε να γνωρίσετε τα βασικά αξιοθέατα χωρίς βιασύνη."
  - q: "Πώς μπορώ να κλείσω εκδρομή για ${d.name};"
    a: "Επικοινωνήστε μαζί μας τηλεφωνικά ή με τη φόρμα επικοινωνίας — θα σας στείλουμε αναλυτικό πρόγραμμα και προσφορά."
keywords:
  - "διακοπές ${d.name.toLowerCase()}"
  - "εκδρομή ${d.name.toLowerCase()}"
  - "${d.name.toLowerCase()} ταξίδι"
  - "πακέτα ${d.name.toLowerCase()}"
draft: false
---

## Γιατί να επιλέξετε ${d.name}

${intro}

Ο ${d.name === 'Σαντορίνη' || d.name.endsWith('ίνη') ? 'προορισμός' : 'προορισμός'} προσφέρει μοναδικό συνδυασμό από φυσική ομορφιά, πολιτισμό και αυθεντική φιλοξενία — ιδανικός για ζευγάρια, οικογένειες και ομάδες φίλων.

## Τι να δείτε

> Συμπληρώστε εδώ τα κορυφαία αξιοθέατα του προορισμού: τοποθεσίες, μουσεία, παραλίες, σημεία ενδιαφέροντος.

- **Σημείο 1** — σύντομη περιγραφή
- **Σημείο 2** — σύντομη περιγραφή
- **Σημείο 3** — σύντομη περιγραφή

## Πώς θα φτάσετε

> Συμπληρώστε εδώ πληροφορίες για μετάβαση: αεροπορικά, οδικά, ακτοπλοϊκά, χρόνοι ταξιδιού.

## Πότε να πάτε

Η καλύτερη περίοδος για ${d.name} είναι ${def.bestTime}. Σε αυτή την εποχή θα απολαύσετε ευχάριστο καιρό, λιγότερο πλήθος (εκτός peak season) και πλήρη λειτουργία υπηρεσιών.

## Πού θα μείνετε

> Προτεινόμενες περιοχές διαμονής, τύποι καταλυμάτων, συμβουλές για κρατήσεις.

## Συμβουλές ταξιδιού

- Κρατήστε εισιτήρια και διαμονή νωρίς για καλύτερες τιμές
- Έχετε άνετα παπούτσια για περπάτημα
- Δοκιμάστε την τοπική κουζίνα

## Προτεινόμενα προγράμματα

Επικοινωνήστε μαζί μας για ολοκληρωμένα πακέτα προς ${d.name} — αεροπορικά, διαμονή, ξεναγήσεις και μεταφορές. Φτιάχνουμε προτάσεις προσαρμοσμένες στις ανάγκες σας.
`;

  return fm;
}

function periodStub(p) {
  return `---
title: "${p.name}"
description: "${p.desc}"
shortName: "${p.shortName}"
intro: "${p.desc}"
popularDestinations: []
faqs:
  - q: "Πότε ξεκινούν οι κρατήσεις για ${p.shortName};"
    a: "Συνιστούμε να κάνετε κράτηση όσο το δυνατόν νωρίτερα — οι θέσεις και τα καλύτερα ξενοδοχεία εξαντλούνται γρήγορα για την περίοδο."
  - q: "Τι περιλαμβάνεται στα προγράμματα μας για ${p.shortName};"
    a: "Τα προγράμματά μας τυπικά περιλαμβάνουν αεροπορικά εισιτήρια, διαμονή, μεταφορές, συνοδό και επιλεγμένες ξεναγήσεις. Οι λεπτομέρειες κάθε πακέτου διαφέρουν."
  - q: "Πώς θα ζητήσω αναλυτικό πρόγραμμα;"
    a: "Επικοινωνήστε μαζί μας τηλεφωνικά ή μέσω της φόρμας — θα σας στείλουμε αναλυτικό πρόγραμμα, διαθεσιμότητα και τιμές."
keywords:
  - "${p.shortName.toLowerCase()}"
  - "εκδρομές ${p.shortName.toLowerCase()}"
  - "πακέτα ${p.shortName.toLowerCase()}"
draft: false
---

## ${p.shortName} με τον Ταξιδιάρη

${p.desc}

Επιλέξτε ανάμεσα σε δεκάδες προγράμματα — από κοντινές αποδράσεις στην Ελλάδα μέχρι μακρινούς εξωτικούς προορισμούς.

## Τι να περιμένετε

- Επιλεγμένα ξενοδοχεία με καλή θέση
- Έμπειρους συνοδούς και τοπικούς ξεναγούς
- Ευέλικτα προγράμματα για κάθε γούστο
- Διαφανείς τιμές χωρίς κρυφές χρεώσεις

## Δημοφιλείς επιλογές

> Συμπληρώστε εδώ τους κορυφαίους προορισμούς για την περίοδο και προγραμματίστε τη λίστα \`popularDestinations\` στο frontmatter.

## Πληροφορίες & κρατήσεις

Επικοινωνήστε μαζί μας για διαθεσιμότητα, τιμές και αναλυτικό πρόγραμμα. Θα σας προτείνουμε την καλύτερη λύση βάσει προτιμήσεων και προϋπολογισμού.
`;
}

let created = 0;
let skipped = 0;

for (const d of DESTINATIONS) {
  const dir = join(ROOT, 'src', 'content', 'destinations', d.region);
  const file = join(dir, `${d.slug}.md`);
  if (existsSync(file)) {
    skipped++;
    continue;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, destinationStub(d), 'utf-8');
  created++;
}

for (const p of PERIODS) {
  const dir = join(ROOT, 'src', 'content', 'periods');
  const file = join(dir, `${p.slug}.md`);
  if (existsSync(file)) {
    skipped++;
    continue;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, periodStub(p), 'utf-8');
  created++;
}

// Articles directory placeholder
const articlesDir = join(ROOT, 'src', 'content', 'articles');
mkdirSync(articlesDir, { recursive: true });
const gitkeep = join(articlesDir, '.gitkeep');
if (!existsSync(gitkeep)) writeFileSync(gitkeep, '', 'utf-8');

console.log(`✓ Created ${created} files, skipped ${skipped} existing.`);
