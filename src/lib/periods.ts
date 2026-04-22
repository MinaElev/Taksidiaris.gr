export interface PeriodEntry {
  slug: string;
  name: string;
  shortName: string;
  group: 'ethnikes-argies' | 'thriskeftikes' | 'epoxiakes' | 'allies';
}

export const PERIODS: PeriodEntry[] = [
  { slug: 'pasxa',           name: 'Εκδρομές Πάσχα',                    shortName: 'Πάσχα',                       group: 'thriskeftikes' },
  { slug: 'christougenna',   name: 'Εκδρομές Χριστούγεννα & Πρωτοχρονιά',shortName: 'Χριστούγεννα & Πρωτοχρονιά',  group: 'thriskeftikes' },
  { slug: 'agiou-pnevmatos', name: 'Εκδρομές Αγίου Πνεύματος',          shortName: 'Αγίου Πνεύματος',             group: 'thriskeftikes' },
  { slug: 'agiou-valentinou',name: 'Εκδρομές Αγίου Βαλεντίνου',         shortName: 'Αγίου Βαλεντίνου',            group: 'thriskeftikes' },
  { slug: 'apokries',        name: 'Εκδρομές Απόκριες & Καθαρά Δευτέρα',shortName: 'Απόκριες & Καθαρά Δευτέρα',   group: 'thriskeftikes' },

  { slug: '25-martiou',      name: 'Εκδρομές 25ης Μαρτίου',             shortName: '25η Μαρτίου',                 group: 'ethnikes-argies' },
  { slug: '28-oktovriou',    name: 'Εκδρομές 28ης Οκτωβρίου',           shortName: '28η Οκτωβρίου',               group: 'ethnikes-argies' },
  { slug: '17-noemvri',      name: 'Εκδρομές 17ης Νοεμβρίου',           shortName: '17 Νοέμβρη',                  group: 'ethnikes-argies' },
  { slug: 'protomagia',      name: 'Εκδρομές Πρωτομαγιάς',              shortName: 'Πρωτομαγιά',                  group: 'ethnikes-argies' },

  { slug: 'kalokairi',       name: 'Καλοκαιρινές Εκδρομές',             shortName: 'Καλοκαίρι',                   group: 'epoxiakes' },
];

export const PERIOD_GROUP_LABEL: Record<PeriodEntry['group'], string> = {
  'thriskeftikes':   'Θρησκευτικές Αργίες',
  'ethnikes-argies': 'Εθνικές Αργίες',
  'epoxiakes':       'Εποχιακές',
  'allies':          'Άλλες',
};

export function periodUrl(p: PeriodEntry): string {
  return `/ekdromes/${p.slug}`;
}

export function findPeriod(slug: string): PeriodEntry | undefined {
  return PERIODS.find((p) => p.slug === slug);
}
