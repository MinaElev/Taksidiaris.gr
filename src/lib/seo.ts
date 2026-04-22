import { SITE } from './site';

export interface SeoMeta {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  publishedAt?: string;
  modifiedAt?: string;
}

export function buildTitle(title?: string): string {
  if (!title || title === SITE.name) return `${SITE.name} — ${SITE.shortDescription}`;
  return `${title} | ${SITE.name}`;
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${SITE.url}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function travelAgencyJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE.legalName,
    url: SITE.url,
    description: SITE.description,
    image: absoluteUrl(SITE.defaultOgImage),
    telephone: SITE.contact.phone,
    email: SITE.contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.contact.address,
      addressCountry: 'GR',
    },
    sameAs: Object.values(SITE.social),
  };
}

export function destinationJsonLd(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name,
    description,
    url: absoluteUrl(url),
    touristType: ['Family', 'Couples', 'Friends', 'Solo'],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function tourJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  image?: string;
  priceFrom?: number;
  currency?: string;
  duration?: { days: number };
  destination?: string;
  dates?: { from: string; to: string }[];
}) {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.url),
    provider: {
      '@type': 'TravelAgency',
      name: SITE.legalName,
      url: SITE.url,
    },
  };
  if (opts.image) obj.image = absoluteUrl(opts.image);
  if (opts.destination) obj.touristType = opts.destination;
  if (opts.priceFrom !== undefined) {
    obj.offers = {
      '@type': 'Offer',
      price: opts.priceFrom,
      priceCurrency: opts.currency === '€' ? 'EUR' : (opts.currency || 'EUR'),
      availability: 'https://schema.org/InStock',
    };
  }
  if (opts.duration) obj.duration = `P${opts.duration.days}D`;
  if (opts.dates && opts.dates.length > 0) {
    obj.itinerary = opts.dates.map((d) => ({
      '@type': 'TouristTrip',
      startDate: d.from,
      endDate: d.to,
    }));
  }
  return obj;
}

export function hotelJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  image?: string;
  city?: string;
  address?: string;
  stars?: number;
  amenities?: string[];
  coordinates?: { lat: number; lng: number };
}) {
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: opts.name,
    description: opts.description,
    url: absoluteUrl(opts.url),
  };
  if (opts.image) obj.image = absoluteUrl(opts.image);
  if (opts.address || opts.city) {
    obj.address = {
      '@type': 'PostalAddress',
      ...(opts.address ? { streetAddress: opts.address } : {}),
      ...(opts.city ? { addressLocality: opts.city } : {}),
    };
  }
  if (opts.stars) {
    obj.starRating = { '@type': 'Rating', ratingValue: opts.stars };
  }
  if (opts.amenities && opts.amenities.length > 0) {
    obj.amenityFeature = opts.amenities.map((a) => ({
      '@type': 'LocationFeatureSpecification',
      name: a,
    }));
  }
  if (opts.coordinates) {
    obj.geo = {
      '@type': 'GeoCoordinates',
      latitude: opts.coordinates.lat,
      longitude: opts.coordinates.lng,
    };
  }
  return obj;
}

export function faqJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
