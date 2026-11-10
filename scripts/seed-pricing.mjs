import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

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

async function seed() {
  const sql = neon(databaseUrl);
  const rawPricing = JSON.parse(readFileSync(resolve(root, 'src/data/pricing.json'), 'utf8'));
  const rawServices = JSON.parse(readFileSync(resolve(root, 'src/data/services.json'), 'utf8'));

  console.log(`Mapping ${Object.keys(rawPricing).length} pricing entries to Neon PostgreSQL...`);

  // First fetch existing services to get their UUIDs
  const serviceRows = await sql`SELECT id, code FROM services`;
  const serviceMap = new Map();
  for (const s of serviceRows) {
    if (s.code) serviceMap.set(s.code, s.id);
  }

  let count = 0;
  for (const [code, p] of Object.entries(rawPricing)) {
    const serviceId = serviceMap.get(code) || null;
    const status = p.status || 'open';
    const type = p.type || 'starting';
    const smallPrice = p.small?.price !== null && p.small?.price !== undefined ? p.small.price : null;
    const smallText = p.small?.text || '';
    const smallUnit = p.small?.unit || '';
    const smallDetail = p.small?.detail || '';
    const midPrice = p.mid?.price !== null && p.mid?.price !== undefined ? p.mid.price : null;
    const midText = p.mid?.text || '';
    const midUnit = p.mid?.unit || '';
    const midDetail = p.mid?.detail || '';
    const billing = p.billing || '';
    const market = p.market || '';
    const notes = p.notes || '';
    const packages = JSON.stringify(p.packages || []);

    await sql`
      INSERT INTO service_pricing (
        service_code, service_id, status, type,
        small_price, small_text, small_unit, small_detail,
        mid_price, mid_text, mid_unit, mid_detail,
        billing, market, notes, packages,
        updated_at
      )
      VALUES (
        ${code}, ${serviceId}, ${status}, ${type},
        ${smallPrice}, ${smallText}, ${smallUnit}, ${smallDetail},
        ${midPrice}, ${midText}, ${midUnit}, ${midDetail},
        ${billing}, ${market}, ${notes}, ${packages}::jsonb,
        NOW()
      )
      ON CONFLICT (service_code) DO UPDATE SET
        service_id = EXCLUDED.service_id,
        status = EXCLUDED.status,
        type = EXCLUDED.type,
        small_price = EXCLUDED.small_price,
        small_text = EXCLUDED.small_text,
        small_unit = EXCLUDED.small_unit,
        small_detail = EXCLUDED.small_detail,
        mid_price = EXCLUDED.mid_price,
        mid_text = EXCLUDED.mid_text,
        mid_unit = EXCLUDED.mid_unit,
        mid_detail = EXCLUDED.mid_detail,
        billing = EXCLUDED.billing,
        market = EXCLUDED.market,
        notes = EXCLUDED.notes,
        packages = EXCLUDED.packages,
        updated_at = NOW();
    `;

    // Also sync availability_status on the services table:
    // status 'open' -> 'live'; status 'soon' -> 'coming_soon'
    const availabilityStatus = status === 'open' ? 'live' : 'coming_soon';
    await sql`
      UPDATE services
      SET availability_status = ${availabilityStatus}, updated_at = NOW()
      WHERE code = ${code};
    `;

    count++;
  }

  console.log(`Successfully seeded ${count} service pricing records into Neon!`);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
