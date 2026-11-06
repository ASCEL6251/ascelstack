import raw from './services.json';

export type Layer = 'build' | 'grow' | 'run';

export interface Service {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  priority: 'core' | 'future';
  notes: string;
}

export interface Category {
  name: string;
  slug: string;
  short: string;
  layer: Layer;
  /** Short positioning line. TEMP copy — replace with final marketing copy. */
  blurb: string;
  priority: 'core' | 'future';
  services: Service[];
  subgroups: { name: string; services: Service[] }[];
}

/** The three strata of the Layered A, top to bottom. */
export const LAYERS: Record<Layer, { label: string; title: string; color: string; summary: string }> = {
  build: {
    label: 'Layer 01 · Tint',
    title: 'Build',
    color: 'var(--tint)',
    summary: 'Software, web, apps and AI. The systems your business runs on.',
  },
  grow: {
    label: 'Layer 02 · Accent',
    title: 'Grow',
    color: 'var(--accent)',
    summary: 'Brand, marketing and marketplaces. The demand that keeps systems busy.',
  },
  run: {
    label: 'Layer 03 · Ink',
    title: 'Run',
    color: 'var(--ink)',
    summary: 'Operations, automation and compliance. The foundation that holds it up.',
  },
};

const META: Record<string, Pick<Category, 'slug' | 'short' | 'layer' | 'blurb'>> = {
  'Technology & Software Development': {
    slug: 'software-development',
    short: 'Software & Web',
    layer: 'build',
    blurb: 'Websites, web apps, mobile apps and custom software, engineered to be the backbone of how you work.',
  },
  'AI, Automation & Emerging Technologies': {
    slug: 'ai-automation',
    short: 'AI & Automation',
    layer: 'build',
    blurb: 'Agents that answer, book, bill and report, plugged into the tools you already use.',
  },
  'Digital Marketing & Online Growth': {
    slug: 'digital-marketing',
    short: 'Marketing',
    layer: 'grow',
    blurb: 'Search, social and paid growth, measured from first click to closed sale.',
  },
  'Branding, Graphics & Creative Studio': {
    slug: 'branding-creative',
    short: 'Brand & Creative',
    layer: 'grow',
    blurb: 'Identity, packaging, video and motion. A brand that looks as considered as it works.',
  },
  'E-commerce & Marketplace Management': {
    slug: 'ecommerce-marketplaces',
    short: 'E-commerce',
    layer: 'grow',
    blurb: 'Your own store plus Amazon, Flipkart and Meesho, with inventory kept in sync.',
  },
  'Business Management & Digital Operations': {
    slug: 'business-operations',
    short: 'Operations',
    layer: 'run',
    blurb: 'CRM, ERP, billing, payroll and dashboards, wired together so work moves on its own.',
  },
  'Restaurant, Cafe & Food Business Solutions': {
    slug: 'restaurant-food',
    short: 'Restaurants',
    layer: 'run',
    blurb: 'From Swiggy and Zomato onboarding to the kitchen display. Everything a food business runs on.',
  },
  'Business Registration, Licensing & Compliance': {
    slug: 'registration-compliance',
    short: 'Compliance',
    layer: 'run',
    blurb: 'Registration, GST, licences, trademarks and labour filings, coordinated end to end.',
  },
  'IT Infrastructure & Technical Support': {
    slug: 'it-infrastructure',
    short: 'IT Infrastructure',
    layer: 'build',
    blurb: 'Cloud, servers, backup, security and workplace IT.',
  },
  'HR & Recruitment Solutions': {
    slug: 'hr-recruitment',
    short: 'HR & Hiring',
    layer: 'run',
    blurb: 'Sourcing, screening, onboarding and HRMS.',
  },
  'Education & Training': {
    slug: 'education-training',
    short: 'Training',
    layer: 'grow',
    blurb: 'Hands-on workshops in programming, marketing and AI tools.',
  },
  'Startup & Business Consulting': {
    slug: 'startup-consulting',
    short: 'Consulting',
    layer: 'grow',
    blurb: 'Business plans, research, go-to-market and pitch decks.',
  },
  'Corporate Solutions': {
    slug: 'corporate-solutions',
    short: 'Corporate',
    layer: 'build',
    blurb: 'Enterprise software and end-to-end digital transformation.',
  },
};

export const services = raw as Service[];

function group(list: Service[]): Category[] {
  const map = new Map<string, Service[]>();
  for (const s of list) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  return [...map.entries()].map(([name, items]) => {
    const meta = META[name] ?? {
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      short: name,
      layer: 'build' as Layer,
      blurb: '',
    };
    const sub = new Map<string, Service[]>();
    for (const s of items) {
      const key = s.subcategory || '';
      if (!sub.has(key)) sub.set(key, []);
      sub.get(key)!.push(s);
    }
    return {
      name,
      ...meta,
      priority: items[0].priority,
      services: items,
      subgroups: [...sub.entries()].map(([n, s]) => ({ name: n, services: s })),
    };
  });
}

export const categories = group(services);
export const coreCategories = categories.filter((c) => c.priority === 'core');
export const futureCategories = categories.filter((c) => c.priority === 'future');

export const counts = {
  services: services.length,
  core: services.filter((s) => s.priority === 'core').length,
  future: services.filter((s) => s.priority === 'future').length,
  categories: categories.length,
};

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug);

/** Names that appear in more than one category (e.g. Product Photography). */
export const sharedServiceNames = new Set(
  Object.entries(
    services.reduce<Record<string, number>>((acc, s) => ((acc[s.name] = (acc[s.name] ?? 0) + 1), acc), {}),
  )
    .filter(([, n]) => n > 1)
    .map(([name]) => name),
);
