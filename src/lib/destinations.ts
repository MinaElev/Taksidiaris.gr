import type { Region } from './site';

export interface DestinationEntry {
  slug: string;
  name: string;
  region: Region;
}

export const DESTINATIONS: DestinationEntry[] = [
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

export function destinationsByRegion(region: Region): DestinationEntry[] {
  return DESTINATIONS.filter((d) => d.region === region).sort((a, b) =>
    a.name.localeCompare(b.name, 'el'),
  );
}

export function destinationUrl(d: DestinationEntry): string {
  return `/proorismoi/${d.region}/${d.slug}`;
}

export function findDestination(region: string, slug: string): DestinationEntry | undefined {
  return DESTINATIONS.find((d) => d.region === region && d.slug === slug);
}
