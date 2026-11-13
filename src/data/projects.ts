/**
 * Portfolio shown on /projects.
 *
 * To add a project: drop a 1440×900 screenshot in /public/projects/ and add an
 * entry below. `featured: true` puts it in the big scroll-in showcase at the top
 * (only the first featured project is used there). `demo: true` marks concept
 * work so it is labelled honestly on the page — remove the flag for real clients.
 */
export interface Project {
  slug: string;
  name: string;
  /** Short category line, e.g. "Consumer web app". */
  category: string;
  year: string;
  summary: string;
  /** What we did. Kept short — shown as chips. */
  services: string[];
  stack: string[];
  image: string;
  /** Live URL. Leave undefined for concept / private work. */
  url?: string;
  featured?: boolean;
  demo?: boolean;
  /** Optional headline result, e.g. { value: '3×', label: 'faster checkout' }. */
  result?: { value: string; label: string };
}

export const projects: Project[] = [
  {
    slug: 'sendvirtualgift',
    name: 'SendVirtualGift',
    category: 'Consumer web app',
    year: '2026',
    summary:
      'A playful platform to create and send personalised digital gifts in seconds — no sign-up needed. Interactive 3D mascot, premium templates, multilingual UI and a privacy-first cookie flow.',
    services: ['Product design', 'Web development', 'SEO', 'Payments'],
    stack: ['Astro', 'Cloudflare', 'Three.js', 'Postgres'],
    image: '/projects/sendvirtualgift.jpg',
    url: 'https://sendvirtualgift.com',
    featured: true,
    result: { value: '0', label: 'sign-ups needed to send a gift' },
  },
  {
    slug: 'virtux-gaming-hub',
    name: 'Virtux Gaming Hub',
    category: 'Esports & gaming lounge',
    year: '2026',
    summary:
      "Ranaghat's first premium gaming hub, online: a cinematic 3D hero, live PS5 arena availability, quick slot reservations, café menu and pricing in one bold, dark experience.",
    services: ['Brand experience', 'Web development', 'Booking flow', '3D & motion'],
    stack: ['Next.js', 'Tailwind CSS', 'Three.js'],
    image: '/projects/virtux.jpg',
    url: 'https://www.virtuxgaminghub.com',
  },
  {
    slug: 'ascel-store',
    name: 'Ascel Store',
    category: 'Fashion e-commerce',
    year: '2026',
    summary:
      'An editorial apparel storefront for men and women: a seasonal hero carousel, instant product search, category navigation and a checkout with COD, UPI and first-order offers.',
    services: ['E-commerce', 'Art direction', 'Web development', 'Payments'],
    stack: ['Astro', 'Cloudflare'],
    image: '/projects/ascel-store.jpg',
    url: 'https://store.ascelstack.com',
  },
  {
    slug: 'ascel-cafe',
    name: 'AscelCafe',
    category: 'Café & restaurant',
    year: '2026',
    summary:
      'A loud, joyful site for a café and brunch kitchen: a 3D floating-food hero, live open/closed status, opening hours and a menu that makes you hungry before you scroll.',
    services: ['Brand experience', 'Motion', 'Website'],
    stack: ['Astro', 'GSAP', 'Lenis', 'Cloudflare'],
    image: '/projects/ascel-cafe.jpg',
    url: 'https://cafe.ascelstack.com',
  },
  {
    slug: 'fleetline',
    name: 'Fleetline',
    category: 'Logistics operations',
    year: '2025',
    summary:
      'A live dispatch board that tracks every shipment, flags delays before customers notice and automates driver hand-offs.',
    services: ['Internal tools', 'AI automation', 'Maps'],
    stack: ['Vue', 'Go', 'Mapbox'],
    image: '/projects/fleet.jpg',
    demo: true,
  },
  {
    slug: 'studio-arc',
    name: 'Studio Arc',
    category: 'Architecture portfolio',
    year: '2025',
    summary:
      'A quiet, image-first portfolio for an architecture practice — big type, generous space and a project archive that loads instantly.',
    services: ['Art direction', 'Website', 'CMS'],
    stack: ['Astro', 'Sanity'],
    image: '/projects/arc.jpg',
    demo: true,
  },
  {
    slug: 'quill-ai',
    name: 'Quill AI',
    category: 'AI product launch',
    year: '2025',
    summary:
      'Launch site for an AI writing assistant: a live in-page editor demo, pricing and template gallery built to convert trial users.',
    services: ['Landing page', 'Motion', 'Growth'],
    stack: ['Next.js', 'Framer Motion', 'Vercel'],
    image: '/projects/quill.jpg',
    demo: true,
  },
];

export const featuredProject = projects.find((p) => p.featured) ?? projects[0];
