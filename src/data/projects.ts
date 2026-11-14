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
    slug: 'ascel-gym',
    name: 'Ascel Gym',
    category: 'Multi-club fitness brand',
    year: '2026',
    summary:
      'A loud, video-led site for a four-club gym chain: a "No days off" cinematic hero, club finder with live hours, 60+ weekly classes to book and an interactive 3D Body Lab that lights up the muscles behind every rep.',
    services: ['Brand experience', 'Website', '3D & motion', 'Class booking'],
    stack: ['Astro', 'Three.js', 'Lenis', 'Cloudflare'],
    image: '/projects/ascel-gym.jpg',
    url: 'https://ascelgym.ascelstack.com',
    demo: true,
    result: { value: '4', label: 'clubs, one membership' },
  },
  {
    slug: 'toxic-fit-world',
    name: 'Toxic Fit World',
    category: 'Strength & conditioning gym',
    year: '2026',
    summary:
      'A dark, premium site for a 15,000 sq. ft. strength arena: a scroll-to-lift 3D hero, frictionless QR member check-in with streak tracking, coach profiles, a 1RM training-zone calculator and membership plans.',
    services: ['Product design', 'Website', 'QR check-in', 'Motion'],
    stack: ['Astro', 'Three.js', 'Lenis', 'Cloudflare'],
    image: '/projects/toxic-fit.jpg',
    url: 'https://ascelgym-2.ascelstack.com',
    demo: true,
    result: { value: '1-tap', label: 'QR member check-in' },
  },
  {
    slug: 'ascel-bill',
    name: 'Ascel Bill',
    category: 'GST billing SaaS',
    year: '2026',
    summary:
      'Offline-first GST billing for Indian counters: keyboard-first Rule 46 invoices, automatic CGST/SGST/IGST to the paisa, UPI QR on every bill, GSTR-1 ready reports and an assistant that answers from your own books.',
    services: ['SaaS product', 'Web app', 'Compliance', 'AI assistant'],
    stack: ['Astro', 'TypeScript', 'Lenis', 'Cloudflare'],
    image: '/projects/ascel-bill.jpg',
    url: 'https://ascelbill.ascelstack.com',
    demo: true,
    result: { value: 'GSTR-1', label: 'ready, even offline' },
  },
];

export const featuredProject = projects.find((p) => p.featured) ?? projects[0];
