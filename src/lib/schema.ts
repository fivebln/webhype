/**
 * JSON-LD Schema Helpers · webhype
 *
 * Site-wide @graph (Organization, WebSite, Person) + per-page helpers.
 * Source: ci-guide.md §13 + sitemap.md §6
 */

const SITE_URL = 'https://web-hype.de';

export const organizationSchema = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'webhype',
  alternateName: 'webhype – Websites für mittelständische Unternehmen',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/og-default.png`,
    width: 1200,
    height: 630,
  },
  description:
    'webhype baut moderne Websites für mittelständische Unternehmen in 7 Tagen zum Festpreis. Zwei Pakete: Starter 499 € (bis zu 5 Unterseiten) oder Business 999 € (bis zu 10 Unterseiten). Alle Preise netto zzgl. MwSt.',
  founder: { '@id': `${SITE_URL}/#founder` },
  legalName: 'Gil Miguel Holding UG (haftungsbeschränkt)',
  vatID: 'DE359941428',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Westfälische Straße 46',
    postalCode: '10711',
    addressLocality: 'Berlin',
    addressCountry: 'DE',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'hallo@web-hype.de',
      areaServed: ['DE', 'AT', 'CH'],
      availableLanguage: ['German'],
    },
  ],
} as const;

export const personSchema = {
  '@type': 'Person',
  '@id': `${SITE_URL}/#founder`,
  name: 'Gil Miguel Peixoto Cordeiro',
  jobTitle: 'Gründer & Geschäftsführer',
  worksFor: { '@id': `${SITE_URL}/#organization` },
} as const;

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'webhype',
  inLanguage: 'de-DE',
  publisher: { '@id': `${SITE_URL}/#organization` },
} as const;

export const siteGraph = {
  '@context': 'https://schema.org',
  '@graph': [organizationSchema, websiteSchema, personSchema],
};

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function serviceSchema(opts: {
  name: string;
  description: string;
  url: string;
  price: number;
  priceCurrency?: string;
  pages: string;
  deliveryDays: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: { '@type': 'Country', name: ['Germany', 'Austria', 'Switzerland'] },
    url: opts.url.startsWith('http') ? opts.url : `${SITE_URL}${opts.url}`,
    offers: {
      '@type': 'Offer',
      price: opts.price,
      priceCurrency: opts.priceCurrency ?? 'EUR',
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: opts.price,
        priceCurrency: opts.priceCurrency ?? 'EUR',
        valueAddedTaxIncluded: false,
      },
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      eligibleQuantity: { '@type': 'QuantitativeValue', value: opts.pages, unitText: 'Unterseiten' },
      deliveryLeadTime: {
        '@type': 'QuantitativeValue',
        minValue: opts.deliveryDays,
        maxValue: opts.deliveryDays,
        unitCode: 'DAY',
      },
    },
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function howToSchema(opts: { name: string; description: string; steps: { name: string; text: string }[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    totalTime: 'P7D',
    step: opts.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}
