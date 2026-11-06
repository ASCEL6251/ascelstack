// Industry "service trees" for the home page Industries section.
// Branches grow above ground (what the business sees); roots sit below
// (registrations and compliance that hold it up). Counts come from the catalogue.
import { services, type Layer } from './catalog';

interface BranchDef {
  name: string;
  layer: Layer;
  /** Service names; `category` disambiguates duplicates such as Product Photography. */
  items: string[];
  category?: string;
}

interface RootDef {
  name: string;
  subcategory: string;
}

interface IndustryDef {
  id: string;
  tag: string;
  title: string;
  body: string;
  slug: string;
  branches: BranchDef[];
  roots: RootDef[];
  trending: { name: string; why: string }[];
}

const DEFS: IndustryDef[] = [
  {
    id: 'restaurants',
    tag: 'Food & Hospitality',
    title: 'Restaurants & cafés',
    body: 'Get listed, take orders directly, and run the kitchen and inventory from one place.',
    slug: 'restaurant-food',
    branches: [
      {
        name: 'Orders & delivery',
        layer: 'grow',
        items: ['Swiggy Onboarding', 'Zomato Onboarding', 'Online Ordering System', 'Table Reservation System', 'Delivery Management'],
      },
      {
        name: 'Kitchen & stock',
        layer: 'run',
        items: ['Restaurant POS Setup', 'Kitchen Display System', 'Restaurant Inventory', 'Food Cost Management'],
      },
      {
        name: 'Menus & listings',
        layer: 'build',
        items: ['Digital Menu Card', 'QR Code Menu', 'Google Business Profile', 'Restaurant Website'],
      },
      {
        name: 'Brand & reviews',
        layer: 'grow',
        items: [
          'Restaurant Branding', 'Food Photography', 'Food Packaging Design', 'Social Media Management',
          'Restaurant Advertisement', 'Customer Review Management', 'Loyalty & Membership Programs',
        ],
      },
    ],
    roots: [{ name: 'FSSAI & food compliance', subcategory: 'Food Business & FSSAI Compliance' }],
    trending: [
      {
        name: 'Online Ordering System',
        why: 'Direct orders through your own link or QR code skip aggregator commission on repeat customers.',
      },
      {
        name: 'Customer Review Management',
        why: 'Ratings decide where you rank on Swiggy, Zomato and Google Maps, so replies are now a growth lever.',
      },
      {
        name: 'Kitchen Display System',
        why: 'Aggregator and dine-in orders land on one screen per station, which cuts missed and late tickets.',
      },
    ],
  },
  {
    id: 'ecommerce',
    tag: 'Retail & D2C',
    title: 'E-commerce sellers',
    body: 'Launch your own store and sell across marketplaces, with orders and stock kept in sync.',
    slug: 'ecommerce-marketplaces',
    branches: [
      {
        name: 'Marketplaces',
        layer: 'grow',
        items: ['Amazon Seller Onboarding', 'Flipkart Seller Onboarding', 'Meesho Seller Onboarding', 'Marketplace Account Management', 'Marketplace Advertising'],
      },
      {
        name: 'Your own store',
        layer: 'build',
        items: ['E-commerce Store Development', 'Shopify Store Setup', 'WooCommerce Setup'],
      },
      {
        name: 'Catalogue',
        layer: 'grow',
        category: 'E-commerce & Marketplace Management',
        items: ['Product Listing', 'Product SEO', 'Product Photography'],
      },
      {
        name: 'Fulfilment & care',
        layer: 'run',
        items: ['Order Management', 'Inventory Synchronization', 'Returns & Refund Management', 'Customer Support Management', 'Sales Analytics'],
      },
    ],
    roots: [
      { name: 'Tax & GST', subcategory: 'Taxation & Financial Registrations' },
      { name: 'Import & export', subcategory: 'Import & Export Registrations' },
    ],
    trending: [
      {
        name: 'Inventory Synchronization',
        why: 'Selling on three or more channels only works when every channel shows the same stock count.',
      },
      {
        name: 'Marketplace Advertising',
        why: 'Sponsored listings now take the top results on most marketplace searches, so organic reach alone is shrinking.',
      },
      {
        name: 'Product SEO',
        why: 'Titles, attributes and images written for the marketplace algorithm decide whether a listing is found at all.',
      },
    ],
  },
  {
    id: 'startups',
    tag: 'New ventures',
    title: 'Startups & MSMEs',
    body: 'Register the company, file the paperwork, build the product and find the first customers.',
    slug: 'registration-compliance',
    branches: [
      {
        name: 'Build the product',
        layer: 'build',
        items: ['SaaS Development', 'Web Application Development', 'Mobile App Development', 'UI/UX Design', 'AI Integration'],
      },
      {
        name: 'Launch the brand',
        layer: 'grow',
        items: ['Logo Designing', 'Brand Identity', 'Website Development', 'SEO', 'Lead Generation'],
      },
      {
        name: 'Run the back office',
        layer: 'run',
        items: ['Business Analytics', 'Billing & Invoicing', 'CRM Setup & Management', 'Payroll Software Setup'],
      },
    ],
    roots: [
      { name: 'Company registration', subcategory: 'Business Registration & Startup Establishment' },
      { name: 'Brand protection', subcategory: 'Intellectual Property & Brand Protection' },
      { name: 'Tax & GST', subcategory: 'Taxation & Financial Registrations' },
    ],
    trending: [
      {
        name: 'Startup India Registration',
        why: 'DPIIT recognition is the first step towards several government schemes and benefits for eligible startups.',
      },
      {
        name: 'Trademark Registration',
        why: 'Filing early protects the name before you spend on a brand, a domain and marketing.',
      },
      {
        name: 'AI Integration',
        why: 'Small teams are adding AI support and AI-assisted operations from day one instead of hiring for them.',
      },
    ],
  },
];

const find = (name: string, category?: string) =>
  services.find((s) => s.name === name && (!category || s.category === category));

export interface Branch {
  name: string;
  layer: Layer;
  count: number;
  services: { id: string; name: string }[];
}
export interface Root {
  name: string;
  count: number;
}
export interface Industry extends Omit<IndustryDef, 'branches' | 'roots' | 'trending'> {
  branches: Branch[];
  roots: Root[];
  trending: { id: string; name: string; why: string }[];
  total: number;
}

export const industries: Industry[] = DEFS.map((d) => {
  const branches = d.branches.map((b) => {
    const list = b.items.map((n) => find(n, b.category)).filter((s) => !!s);
    return { name: b.name, layer: b.layer, count: list.length, services: list.map((s) => ({ id: s!.id, name: s!.name })) };
  });
  const roots = d.roots.map((r) => ({ name: r.name, count: services.filter((s) => s.subcategory === r.subcategory).length }));
  const trending = d.trending.map((t) => ({ ...t, id: find(t.name)?.id ?? '' }));
  const ids = new Set(branches.flatMap((b) => b.services.map((s) => s.id)));
  const total = ids.size + roots.reduce((a, r) => a + r.count, 0);
  return { ...d, branches, roots, trending, total };
});
