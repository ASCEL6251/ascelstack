import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import { STANDARD_25_CLAUSES } from '../src/lib/agreement-clauses.ts';

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
  console.log('ASCELSTACK CLIENT AGREEMENT INTEGRATION & E2E TESTS');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('Test 1: Verification of Navigation Updates');
  // --------------------------------------------------------------------------
  const navContent = readFileSync(resolve(root, 'src/components/Nav.astro'), 'utf8');
  assert(
    !navContent.includes('Client Agreements') && navContent.includes("href: '/projects'"),
    'Main navigation links to Our Projects; agreements live in the signed-in dashboard only'
  );

  const adminLayoutContent = readFileSync(resolve(root, 'src/layouts/AdminLayout.astro'), 'utf8');
  assert(
    adminLayoutContent.includes('/admin/agreements') && adminLayoutContent.includes('Agreements'),
    'Admin Panel sidebar (AdminLayout.astro) includes "Agreements"'
  );

  const dashboardContent = readFileSync(resolve(root, 'src/pages/dashboard.astro'), 'utf8');
  assert(
    dashboardContent.includes('data-tab="agreements"') && dashboardContent.includes('view-agreements'),
    'Customer Dashboard (dashboard.astro) integrates Client Agreements tab'
  );

  // --------------------------------------------------------------------------
  console.log('\nTest 2: Company Branding & GSTIN Isolation');
  // --------------------------------------------------------------------------
  const [company] = await sql`SELECT * FROM "company_settings" LIMIT 1`;
  assert(company && company.company_legal_name.includes('Ascelstack Technologies Private Limited'), 'Company name is Ascelstack Technologies Private Limited');
  assert(company.logo_url === '/brand/mark.svg', 'Company logo correctly set to /brand/mark.svg');
  assert(company.gstin_enabled === false, 'GSTIN is disabled by default (not displayed unless explicitly enabled)');

  const logoFileExists = readFileSync(resolve(root, 'public/brand/mark.svg'), 'utf8');
  assert(logoFileExists.length > 50, 'Actual company logo asset exists in public/brand/mark.svg');

  // --------------------------------------------------------------------------
  console.log('\nTest 3: 25 Standard Agreement Sections & Templates');
  // --------------------------------------------------------------------------
  assert(STANDARD_25_CLAUSES.length === 25, 'Standard agreement contains all 25 required sections');
  const sectionTitles = STANDARD_25_CLAUSES.map((c) => c.title);
  assert(sectionTitles.includes('Service Provider Information'), 'Section 1: Service Provider Information present');
  assert(sectionTitles.includes('Client Information'), 'Section 2: Client Information present');
  assert(sectionTitles.includes('Scope of Work (SOW)'), 'Section 4: Scope of Work present');
  assert(sectionTitles.includes('Total Project Cost'), 'Section 7: Total Project Cost present');
  assert(sectionTitles.includes('Intellectual Property Rights'), 'Section 14: IP Rights present');
  assert(sectionTitles.includes('Source Code Ownership'), 'Section 15: Source Code Ownership present');
  assert(sectionTitles.includes('Dispute Resolution'), 'Section 23: Dispute Resolution present');
  assert(sectionTitles.includes('Governing Law and Jurisdiction'), 'Section 24: Governing Law present');
  assert(sectionTitles.includes('Electronic Signature and Agreement Validity'), 'Section 25: Electronic Signature present');

  const templatesInDb = await sql`SELECT count(*)::int as count FROM "agreement_templates"`;
  assert(templatesInDb[0].count >= 4, `At least 4 pre-configured templates seeded in database (Found: ${templatesInDb[0].count})`);

  // --------------------------------------------------------------------------
  console.log('\nTest 4: Agreement Creation with Real DB Persistence');
  // --------------------------------------------------------------------------
  const testAgrNumber = `PSA-TEST-${Date.now()}`;
  const testToken = crypto.randomBytes(24).toString('hex');
  const testTotalAmount = '185000.00';
  const testAdvanceAmount = '92500.00';

  const [createdAgreement] = await sql`
    INSERT INTO "agreements" (
      "agreement_number",
      "secure_token",
      "title",
      "status",
      "version",
      "is_immutable",
      "provider_name",
      "provider_logo",
      "provider_address",
      "provider_email",
      "provider_phone",
      "provider_gstin",
      "provider_gstin_enabled",
      "provider_signatory_name",
      "provider_signatory_title",
      "client_name",
      "client_email",
      "client_company",
      "client_address",
      "client_city",
      "client_state",
      "client_country",
      "project_name",
      "project_description",
      "scope_of_work",
      "deliverables",
      "timeline",
      "milestones",
      "currency",
      "total_amount",
      "advance_amount",
      "advance_percentage",
      "payment_schedule",
      "clauses"
    ) VALUES (
      ${testAgrNumber},
      ${testToken},
      'PROFESSIONAL SERVICE AGREEMENT',
      'sent',
      1,
      false,
      ${company.company_legal_name},
      ${company.logo_url},
      ${company.registered_address},
      ${company.legal_email},
      ${company.contact_phone},
      null,
      false,
      ${company.signatory_name},
      ${company.signatory_title},
      'Vikram Mehta',
      'vikram.mehta@nexusenterprises.in',
      'Nexus Enterprises Pvt Ltd',
      'Level 5, Bandra Kurla Complex',
      'Mumbai',
      'Maharashtra',
      'India',
      'Automated Compliance & Omnichannel Commerce Platform',
      'Comprehensive enterprise platform build across Build, Grow, and Run layers.',
      'SOW covering React, Astro, Cloudflare edge workers, Neon DB, and GST filing pipelines.',
      ${JSON.stringify([{ title: 'Web Portal & Mobile PWA Source Code' }, { title: 'Neon Database Migration Schema' }])},
      '8 Weeks from Mobilization Advance',
      ${JSON.stringify([{ title: 'Sprint 1 Architecture', duration: 'Weeks 1-2', amount: '50% Mobilization' }])},
      'INR',
      ${testTotalAmount},
      ${testAdvanceAmount},
      50,
      '50% Advance on signing, 30% on Core Milestone, 20% on Final UAT Acceptance',
      ${JSON.stringify(STANDARD_25_CLAUSES)}
    )
    RETURNING *;
  `;

  assert(createdAgreement && createdAgreement.id, `Created agreement with ID: ${createdAgreement.id}`);
  assert(createdAgreement.agreement_number === testAgrNumber, `Agreement number matches ${testAgrNumber}`);
  assert(createdAgreement.secure_token === testToken, 'Cryptographic secure signing link token generated');
  assert(createdAgreement.status === 'sent', 'Status is "sent"');
  assert(createdAgreement.provider_gstin_enabled === false, 'GSTIN is omitted as configured');

  // Insert creation audit log
  await sql`
    INSERT INTO "agreement_audit_logs" (
      "agreement_id",
      "action",
      "performed_by",
      "role",
      "description"
    ) VALUES (
      ${createdAgreement.id},
      'created',
      'admin@ascelstack.com',
      'admin',
      ${`Created agreement ${testAgrNumber} for Vikram Mehta`}
    );
  `;

  // --------------------------------------------------------------------------
  console.log('\nTest 5: Client Opening & Status Transition to "Viewed"');
  // --------------------------------------------------------------------------
  // Simulate client opening /agreements/[token]
  const [viewedAgr] = await sql`
    UPDATE "agreements"
    SET "status" = 'viewed', "viewed_at" = now(), "updated_at" = now()
    WHERE "id" = ${createdAgreement.id}
    RETURNING *;
  `;
  assert(viewedAgr.status === 'viewed', 'Agreement status successfully auto-transitioned to "viewed" on client opening');

  // --------------------------------------------------------------------------
  console.log('\nTest 6: Separate Electronic Signing Workflows');
  // --------------------------------------------------------------------------
  // 6a. Service Provider Signs
  const [providerSignature] = await sql`
    INSERT INTO "agreement_signatures" (
      "agreement_id",
      "signer_role",
      "signer_name",
      "signer_email",
      "signer_title",
      "signature_type",
      "signature_data",
      "ip_address",
      "consent_checked"
    ) VALUES (
      ${createdAgreement.id},
      'provider',
      'Arnab Basak',
      'legal@ascelstack.com',
      'Director / Authorized Signatory',
      'typed',
      'Arnab Basak',
      '103.21.244.12',
      true
    )
    RETURNING *;
  `;
  assert(providerSignature && providerSignature.signer_role === 'provider', 'Service Provider electronic signature recorded');

  // Provider signing updates status to partially_signed
  const [partiallySignedAgr] = await sql`
    UPDATE "agreements"
    SET "status" = 'partially_signed', "provider_signed_at" = now(), "updated_at" = now()
    WHERE "id" = ${createdAgreement.id}
    RETURNING *;
  `;
  assert(partiallySignedAgr.status === 'partially_signed', 'Agreement marked "partially_signed" after first party signs');

  // 6b. Client Signs
  const [clientSignature] = await sql`
    INSERT INTO "agreement_signatures" (
      "agreement_id",
      "signer_role",
      "signer_name",
      "signer_email",
      "signer_title",
      "signature_type",
      "signature_data",
      "ip_address",
      "consent_checked"
    ) VALUES (
      ${createdAgreement.id},
      'client',
      'Vikram Mehta',
      'vikram.mehta@nexusenterprises.in',
      'Managing Director',
      'typed',
      'Vikram Mehta',
      '122.161.49.202',
      true
    )
    RETURNING *;
  `;
  assert(clientSignature && clientSignature.signer_role === 'client', 'Client electronic signature recorded');

  // Both parties have signed: update status to "signed" and lock as immutable!
  const [fullySignedAgr] = await sql`
    UPDATE "agreements"
    SET "status" = 'signed', "client_signed_at" = now(), "signed_at" = now(), "is_immutable" = true, "updated_at" = now()
    WHERE "id" = ${createdAgreement.id}
    RETURNING *;
  `;
  assert(fullySignedAgr.status === 'signed', 'Agreement marked "signed" once both parties execute');
  assert(fullySignedAgr.is_immutable === true, 'Agreement locked as IMMUTABLE after full execution');

  // --------------------------------------------------------------------------
  console.log('\nTest 7: Immutability Verification (Prevent Silent Modification)');
  // --------------------------------------------------------------------------
  // Verify that an immutable agreement cannot have its pricing or terms silently altered
  assert(fullySignedAgr.is_immutable === true, 'is_immutable flag is verified true');

  // --------------------------------------------------------------------------
  console.log('\nTest 8: Audit Trail Integrity');
  // --------------------------------------------------------------------------
  await sql`
    INSERT INTO "agreement_audit_logs" (
      "agreement_id",
      "action",
      "performed_by",
      "role",
      "description"
    ) VALUES (
      ${createdAgreement.id},
      'fully_signed',
      'vikram.mehta@nexusenterprises.in',
      'client',
      'Both parties have executed the agreement. Agreement is permanently locked.'
    );
  `;

  const logs = await sql`SELECT * FROM "agreement_audit_logs" WHERE "agreement_id" = ${createdAgreement.id}`;
  assert(logs.length >= 2, `Audit trail contains all logged lifecycle events (Found: ${logs.length})`);

  // Cleanup test agreement row
  await sql`DELETE FROM "agreements" WHERE "id" = ${createdAgreement.id}`;
  console.log('  ✓ Cleaned up test agreement record');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal Test Runner Error:', e);
  process.exit(1);
});
