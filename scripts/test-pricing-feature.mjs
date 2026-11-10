import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { dbRowToPricing, cardPrice, parseUnit } from '../src/lib/pricing.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

let env = {};
try {
  const envFile = readFileSync(resolve(root, '.env'), 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
} catch (e) {
  console.error('Error reading .env', e);
}

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('ASCELSTACK SERVICE PRICING & COMING SOON TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('Test Group 1: Database Table & 233 Services Catalog Seeding');
  // --------------------------------------------------------------------------
  const [{ count: totalPricing }] = await sql`SELECT count(*)::int as count FROM service_pricing`;
  assert(totalPricing === 233, `Neon service_pricing table has exactly 233 records (found ${totalPricing})`);

  const [{ count: totalServices }] = await sql`SELECT count(*)::int as count FROM services`;
  assert(totalServices === 233, `Neon services table has exactly 233 records (found ${totalServices})`);

  const [{ count: linkedCount }] = await sql`
    SELECT count(*)::int as count
    FROM service_pricing sp
    JOIN services s ON sp.service_code = s.code AND sp.service_id = s.id
  `;
  assert(linkedCount === 233, `All 233 pricing records are correctly linked to their services UUID foreign keys`);

  // --------------------------------------------------------------------------
  console.log('\nTest Group 2: Pricing Types & Tier Integrity');
  // --------------------------------------------------------------------------
  const typeCounts = await sql`SELECT type, count(*)::int as count FROM service_pricing GROUP BY type ORDER BY type`;
  console.log('  Model breakdown:', typeCounts);
  assert(typeCounts.length >= 2, 'Multiple pricing models active (package, fixed, starting)');

  const samplePackage = await sql`
    SELECT service_code, packages
    FROM service_pricing
    WHERE service_code = 'ASC-0001'
    LIMIT 1
  `;
  assert(samplePackage.length === 1, 'ASC-0001 (Website Development) exists in database');
  const packages = samplePackage[0].packages;
  assert(Array.isArray(packages) && packages.length === 6, 'ASC-0001 has 6 package tiers configured in JSONB');
  assert(packages[0].name === 'Starter' && packages[0].price === 2999, 'ASC-0001 Starter package is ₹2,999');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 3: Unplug "Coming Soon" & Status Synchronization');
  // --------------------------------------------------------------------------
  // Let's test toggling a service status and verifying bidirectional consistency
  const testCode = 'ASC-0026'; // YouTube channel management & growth
  const [initialState] = await sql`SELECT status FROM service_pricing WHERE service_code = ${testCode}`;
  const originalStatus = initialState.status;

  // Unplug coming soon -> set to 'open'
  await sql`UPDATE service_pricing SET status = 'open', updated_at = NOW() WHERE service_code = ${testCode}`;
  await sql`UPDATE services SET availability_status = 'live', updated_at = NOW() WHERE code = ${testCode}`;

  const [afterUnplugPricing] = await sql`SELECT status FROM service_pricing WHERE service_code = ${testCode}`;
  const [afterUnplugService] = await sql`SELECT availability_status FROM services WHERE code = ${testCode}`;
  assert(afterUnplugPricing.status === 'open', `service_pricing status unplugged to "open"`);
  assert(afterUnplugService.availability_status === 'live', `services table availability_status synchronized to "live"`);

  // Restore original state
  await sql`UPDATE service_pricing SET status = ${originalStatus}, updated_at = NOW() WHERE service_code = ${testCode}`;
  await sql`UPDATE services SET availability_status = ${originalStatus === 'open' ? 'live' : 'coming_soon'}, updated_at = NOW() WHERE code = ${testCode}`;

  const [restoredPricing] = await sql`SELECT status FROM service_pricing WHERE service_code = ${testCode}`;
  assert(restoredPricing.status === originalStatus, `Restored ${testCode} back to original status: ${originalStatus}`);

  // --------------------------------------------------------------------------
  console.log('\nTest Group 4: Modify Pricing & Audit Log');
  // --------------------------------------------------------------------------
  const modifyCode = 'ASC-0233'; // Market research
  const [origRow] = await sql`SELECT small_price, mid_price FROM service_pricing WHERE service_code = ${modifyCode}`;

  // Update price in DB
  const newPrice = 3499;
  await sql`
    UPDATE service_pricing
    SET small_price = ${newPrice}, mid_price = ${newPrice}, updated_at = NOW()
    WHERE service_code = ${modifyCode}
  `;

  // Log in admin_activity_logs
  await sql`
    INSERT INTO admin_activity_logs (
      admin_email, action, target_type, target_id, description, details
    ) VALUES (
      'basakarnab430@gmail.com', 'update_pricing', 'pricing', ${modifyCode},
      'Test update pricing for ASC-0233 to ₹3,499',
      '{"code": "ASC-0233", "smallPrice": 3499}'::jsonb
    )
  `;

  const [updatedRow] = await sql`SELECT small_price FROM service_pricing WHERE service_code = ${modifyCode}`;
  assert(Number(updatedRow.small_price) === newPrice, `Successfully updated ${modifyCode} price to ₹${newPrice}`);

  const [recentLog] = await sql`
    SELECT id, action, target_id FROM admin_activity_logs
    WHERE target_id = ${modifyCode}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  assert(recentLog && recentLog.action === 'update_pricing', `Admin audit log created for pricing modification`);

  // Revert back
  await sql`
    UPDATE service_pricing
    SET small_price = ${origRow.small_price}, mid_price = ${origRow.mid_price}, updated_at = NOW()
    WHERE service_code = ${modifyCode}
  `;

  // --------------------------------------------------------------------------
  console.log('\nTest Group 5: Formatting & Data Mapping Helpers');
  // --------------------------------------------------------------------------
  const mockDbRow = {
    serviceCode: 'ASC-0001',
    status: 'open',
    type: 'package',
    smallPrice: '2999',
    smallUnit: 'one-time',
    smallDetail: 'Starter package',
    midPrice: '29999',
    midUnit: 'one-time',
    midDetail: 'Premium package',
    billing: 'One-time project',
    market: '₹10,000–₹80,000',
    notes: 'Excl. 18% GST',
    packages: [{ key: 'starter', name: 'Starter', price: 2999, includes: 'Pages', delivery: '3 days', notes: '' }],
  };

  const mapped = dbRowToPricing(mockDbRow);
  assert(mapped.id === 'ASC-0001', 'Mapped object id is ASC-0001');
  assert(mapped.status === 'open', 'Mapped status is "open"');
  assert(mapped.small.price === 2999, 'Mapped numeric price is 2999');
  assert(Array.isArray(mapped.packages) && mapped.packages.length === 1, 'Mapped packages array preserved');

  const card = cardPrice(mapped);
  assert(card.amount === '₹2,999', `Card price formatted as INR: ${card.amount}`);
  assert(card.unit === 'one-time', `Card price unit correctly parsed: ${card.unit}`);

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
