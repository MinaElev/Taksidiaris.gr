export const SITE = {
  name: 'Ταξιδιάρης',
  legalName: 'Ταξιδιάρης Travel',
  shortDescription: 'Οργανωμένα ταξίδια και ταξιδιωτικός οδηγός για Ελλάδα, Ευρώπη και Κόσμο.',
  description:
    'Ανακαλύψτε προορισμούς σε όλο τον κόσμο με τον Ταξιδιάρη. Οργανωμένες εκδρομές για Πάσχα, Καλοκαίρι, Χριστούγεννα και αργίες. Αναλυτικοί ταξιδιωτικοί οδηγοί για κάθε προορισμό.',
  url: 'https://taksidiaris.gr',
  locale: 'el-GR',
  language: 'el',
  defaultOgImage: '/og-default.jpg',
  // Background hero φωτογραφία της αρχικής σελίδας. Άλλαξέ το με URL Supabase
  // (κάνε upload από οποιαδήποτε admin φόρμα, αντίγραψε το URL) ή με όποιο
  // άλλο public image URL θέλεις.
  homeHero: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Poros_aerial_viw.jpg',
  homeHeroAlt: 'Λιμάνι του Πόρου με τα παραδοσιακά καΐκια',
  contact: {
    phone: '+30 210 0000000',
    phoneDisplay: '210 000 0000',
    email: 'info@taksidiaris.gr',
    address: 'Αθήνα, Ελλάδα',
  },
  social: {
    facebook: 'https://facebook.com/taksidiaris',
    instagram: 'https://instagram.com/taksidiaris',
  },
  nav: [
    { label: 'Αρχική', href: '/' },
    { label: 'Προορισμοί', href: '/proorismoi' },
    { label: 'Εκδρομές', href: '/ekdromes' },
    { label: 'Άρθρα', href: '/blog' },
    { label: 'Η Εταιρεία', href: '/etaireia' },
    { label: 'Επικοινωνία', href: '/epikoinonia' },
  ],
} as const;

export type Region = 'ellada' | 'europi' | 'kosmos';

export const REGION_LABEL: Record<Region, string> = {
  ellada: 'Ελλάδα',
  europi: 'Ευρώπη',
  kosmos: 'Κόσμος',
};

export const REGION_INTRO: Record<Region, string> = {
  ellada: 'Ελληνικά νησιά και ηπειρωτικοί προορισμοί',
  europi: 'Πρωτεύουσες, city breaks και εξορμήσεις στην Ευρώπη',
  kosmos: 'Εξωτικοί και μακρινοί προορισμοί σε όλο τον κόσμο',
};
