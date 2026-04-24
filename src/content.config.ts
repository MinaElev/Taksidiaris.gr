import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const destinations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/destinations' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    region: z.enum(['ellada', 'europi', 'kosmos']),
    hero: z.string().optional(),
    intro: z.string().optional(),
    bestTime: z.string().optional(),
    duration: z.string().optional(),
    highlights: z.array(z.string()).default([]),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),
    keywords: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

const places = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/places' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // destination id: e.g. "ellada/alonnisos" — foreign key into destinations
    destination: z.string(),
    // what kind of place this is — drives icon / filter / schema.org type
    type: z.enum([
      'park',
      'beach',
      'village',
      'monument',
      'museum',
      'species',
      'island',
      'experience',
      'landmark',
    ]),
    hero: z.string().optional(),
    intro: z.string().optional(),
    // short one-liner shown on the card
    tagline: z.string().optional(),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),
    keywords: z.array(z.string()).default([]),
    // attribution — each article should cite real sources
    sources: z
      .array(z.object({ title: z.string(), url: z.string().url() }))
      .default([]),
    // related place ids in the same destination (e.g. "alonnisos/kokkinokastro")
    relatedPlaces: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

const periods = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/periods' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    shortName: z.string().optional(),
    dates: z.string().optional(),
    intro: z.string().optional(),
    hero: z.string().optional(),
    popularDestinations: z.array(z.string()).default([]),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),
    keywords: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    cover: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const tours = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tours' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    destination: z.string(),
    region: z.enum(['ellada', 'europi', 'kosmos']),
    period: z.string().optional(),
    priceFrom: z.number().optional(),
    currency: z.string().default('€'),
    duration: z.object({
      days: z.number(),
      nights: z.number(),
    }),
    transport: z.enum(['αεροπορικώς', 'οδικώς', 'ακτοπλοϊκώς', 'συνδυαστικά']).default('αεροπορικώς'),
    departureCities: z.array(z.string()).default([]),
    pickupSchedule: z
      .array(
        z.object({
          city: z.string(),
          location: z.string().optional(),
          time: z.string().optional(),
        }),
      )
      .default([]),
    dates: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
          label: z.string().optional(),
        }),
      )
      .default([]),
    hero: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    intro: z.string().optional(),
    itinerary: z
      .array(
        z.object({
          day: z.number(),
          title: z.string(),
          description: z.string(),
        }),
      )
      .default([]),
    hotels: z
      .array(
        z.object({
          name: z.string(),
          location: z.string().optional(),
          nights: z.number().optional(),
          board: z.string().optional(),
          stars: z.number().optional(),
        }),
      )
      .default([]),
    pricing: z
      .array(
        z.object({
          fromCity: z.string(),
          perPerson: z.number(),
          singleSupplement: z.number().optional(),
          childDiscount: z.string().optional(),
        }),
      )
      .default([]),
    includes: z.array(z.string()).default([]),
    notIncludes: z.array(z.string()).default([]),
    bookingProcess: z.array(z.string()).default([]),
    cancellationPolicy: z.array(z.string()).default([]),
    notes: z.array(z.string()).default([]),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),
    keywords: z.array(z.string()).default([]),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

const hotels = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/hotels' }),
  schema: z.object({
    name: z.string(),
    aliases: z.array(z.string()).default([]),
    description: z.string(),
    destination: z.string(),
    region: z.enum(['ellada', 'europi', 'kosmos']),
    city: z.string().optional(),
    address: z.string().optional(),
    stars: z.number().min(1).max(5).optional(),
    category: z.string().optional(),
    hero: z.string().optional(),
    gallery: z.array(z.string()).default([]),
    intro: z.string().optional(),
    amenities: z.array(z.string()).default([]),
    roomTypes: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
        }),
      )
      .default([]),
    distances: z
      .array(z.object({ place: z.string(), value: z.string() }))
      .default([]),
    breakfast: z.string().optional(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    website: z.string().url().optional(),
    coordinates: z
      .object({ lat: z.number(), lng: z.number() })
      .optional(),
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),
    keywords: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    updatedAt: z.coerce.date().optional(),
  }),
});

export const collections = { destinations, places, periods, articles, tours, hotels };
