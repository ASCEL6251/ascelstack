import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// Load environment variables if not present
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envFile = readFileSync(resolve(root, '.env'), 'utf8');
    const match = envFile.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) databaseUrl = match[1];
  } catch {}
}

if (!databaseUrl) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const META = {
  'Technology & Software Development': { short: 'Software & Web', layer: 'build' },
  'AI, Automation & Emerging Technologies': { short: 'AI & Automation', layer: 'build' },
  'Digital Marketing & Online Growth': { short: 'Marketing', layer: 'grow' },
  'Branding, Graphics & Creative Studio': { short: 'Brand & Creative', layer: 'grow' },
  'E-commerce & Marketplace Management': { short: 'E-commerce', layer: 'grow' },
  'Business Management & Digital Operations': { short: 'Operations', layer: 'run' },
  'Restaurant, Cafe & Food Business Solutions': { short: 'Restaurants', layer: 'run' },
  'Business Registration, Licensing & Compliance': { short: 'Compliance', layer: 'run' },
  'IT Infrastructure & Technical Support': { short: 'IT Infrastructure', layer: 'build' },
  'HR & Recruitment Solutions': { short: 'HR & Hiring', layer: 'run' },
  'Education & Training': { short: 'Training', layer: 'grow' },
  'Startup & Business Consulting': { short: 'Consulting', layer: 'grow' },
  'Corporate Solutions': { short: 'Corporate', layer: 'build' },
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

async function seed() {
  const sql = neon(databaseUrl);
  const rawServices = JSON.parse(readFileSync(resolve(root, 'src/data/services.json'), 'utf8'));

  console.log(`Seeding ${rawServices.length} services into Neon PostgreSQL...`);

  let inserted = 0;
  for (const s of rawServices) {
    const meta = META[s.category] || { short: s.category, layer: 'build' };
    const baseSlug = slugify(s.name);
    const slug = `${baseSlug}-${s.id.toLowerCase()}`;
    const availabilityStatus = s.priority === 'future' ? 'coming_soon' : 'live';

    await sql`
      INSERT INTO services (code, name, slug, description, layer, discipline, availability_status, created_at, updated_at)
      VALUES (${s.id}, ${s.name}, ${slug}, ${s.description}, ${meta.layer}, ${meta.short}, ${availabilityStatus}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        layer = EXCLUDED.layer,
        discipline = EXCLUDED.discipline,
        availability_status = EXCLUDED.availability_status,
        updated_at = NOW();
    `;
    inserted++;
  }

  console.log(`Successfully seeded ${inserted} services!`);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
