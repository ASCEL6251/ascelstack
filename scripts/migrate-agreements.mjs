import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { STANDARD_25_CLAUSES, PRESET_TEMPLATES, DEFAULT_COMPANY_INFO } from '../src/lib/agreement-clauses.ts';

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

const sql = neon(databaseUrl);

async function migrate() {
  console.log('--- Starting Agreement Tables Migration on Neon PostgreSQL ---');

  // 1. agreement_templates
  console.log('1. Creating agreement_templates table...');
  await sql`
    CREATE TABLE IF NOT EXISTS "agreement_templates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "code" varchar(50) NOT NULL,
      "name" varchar(255) NOT NULL,
      "category" varchar(100) NOT NULL,
      "description" text,
      "clauses" jsonb NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "agreement_templates_code_unique" UNIQUE("code")
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "agreement_templates_code_uidx" ON "agreement_templates" ("code");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_templates_category_idx" ON "agreement_templates" ("category");`;

  // 2. company_settings
  console.log('2. Creating company_settings table...');
  await sql`
    CREATE TABLE IF NOT EXISTS "company_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "company_legal_name" varchar(255) DEFAULT 'Ascelstack Technologies Private Limited' NOT NULL,
      "company_brand_name" varchar(255) DEFAULT 'Ascelstack' NOT NULL,
      "registered_address" text DEFAULT 'Sector V, Bidhannagar, Salt Lake, Kolkata, West Bengal 700091, India' NOT NULL,
      "legal_email" varchar(255) DEFAULT 'legal@ascelstack.com' NOT NULL,
      "support_email" varchar(255) DEFAULT 'support@ascelstack.com' NOT NULL,
      "contact_phone" varchar(100) DEFAULT '+91 89428 41651' NOT NULL,
      "gstin" varchar(50),
      "gstin_enabled" boolean DEFAULT false NOT NULL,
      "logo_url" text DEFAULT '/brand/mark.svg' NOT NULL,
      "signatory_name" varchar(255) DEFAULT 'Authorized Signatory' NOT NULL,
      "signatory_title" varchar(255) DEFAULT 'Director / Legal Counsel' NOT NULL,
      "default_currency" varchar(10) DEFAULT 'INR' NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  // 3. agreements
  console.log('3. Creating agreements table...');
  await sql`
    CREATE TABLE IF NOT EXISTS "agreements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "agreement_number" varchar(100) NOT NULL,
      "secure_token" varchar(255) NOT NULL,
      "title" varchar(255) DEFAULT 'PROFESSIONAL SERVICE AGREEMENT' NOT NULL,
      "status" varchar(50) DEFAULT 'draft' NOT NULL,
      "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "business_id" uuid REFERENCES "businesses"("id") ON DELETE SET NULL,
      "quotation_id" uuid REFERENCES "quotations"("id") ON DELETE SET NULL,
      "template_id" uuid REFERENCES "agreement_templates"("id") ON DELETE SET NULL,
      "version" integer DEFAULT 1 NOT NULL,
      "is_immutable" boolean DEFAULT false NOT NULL,
      "provider_name" varchar(255) NOT NULL,
      "provider_logo" text DEFAULT '/brand/mark.svg' NOT NULL,
      "provider_address" text NOT NULL,
      "provider_email" varchar(255) NOT NULL,
      "provider_phone" varchar(100) NOT NULL,
      "provider_gstin" varchar(50),
      "provider_gstin_enabled" boolean DEFAULT false NOT NULL,
      "provider_signatory_name" varchar(255) DEFAULT 'Authorized Signatory' NOT NULL,
      "provider_signatory_title" varchar(255) DEFAULT 'Director / Legal Counsel' NOT NULL,
      "client_name" varchar(255) NOT NULL,
      "client_email" varchar(255) NOT NULL,
      "client_company" varchar(255),
      "client_address" text,
      "client_city" varchar(100),
      "client_state" varchar(100),
      "client_country" varchar(100) DEFAULT 'India',
      "client_phone" varchar(50),
      "client_gstin" varchar(50),
      "project_name" varchar(255) NOT NULL,
      "project_description" text,
      "scope_of_work" text,
      "deliverables" jsonb,
      "timeline" text,
      "milestones" jsonb,
      "currency" varchar(10) DEFAULT 'INR' NOT NULL,
      "total_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
      "advance_amount" numeric(12, 2) DEFAULT '0.00',
      "advance_percentage" integer DEFAULT 50,
      "payment_schedule" text,
      "tax_percentage" numeric(5, 2) DEFAULT '0.00',
      "tax_amount" numeric(12, 2) DEFAULT '0.00',
      "clauses" jsonb NOT NULL,
      "valid_until" timestamp with time zone,
      "sent_at" timestamp with time zone,
      "viewed_at" timestamp with time zone,
      "client_signed_at" timestamp with time zone,
      "provider_signed_at" timestamp with time zone,
      "signed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "agreements_number_unique" UNIQUE("agreement_number"),
      CONSTRAINT "agreements_token_unique" UNIQUE("secure_token")
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "agreements_number_uidx" ON "agreements" ("agreement_number");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "agreements_token_uidx" ON "agreements" ("secure_token");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreements_status_idx" ON "agreements" ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreements_user_id_idx" ON "agreements" ("user_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreements_business_id_idx" ON "agreements" ("business_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreements_quotation_id_idx" ON "agreements" ("quotation_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreements_created_at_idx" ON "agreements" ("created_at");`;

  // 4. agreement_signatures
  console.log('4. Creating agreement_signatures table...');
  await sql`
    CREATE TABLE IF NOT EXISTS "agreement_signatures" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "agreement_id" uuid NOT NULL REFERENCES "agreements"("id") ON DELETE CASCADE,
      "signer_role" varchar(50) NOT NULL,
      "signer_name" varchar(255) NOT NULL,
      "signer_email" varchar(255) NOT NULL,
      "signer_title" varchar(255),
      "signature_type" varchar(50) DEFAULT 'typed' NOT NULL,
      "signature_data" text NOT NULL,
      "ip_address" varchar(100),
      "user_agent" text,
      "consent_checked" boolean DEFAULT true NOT NULL,
      "signed_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_signatures_agreement_id_idx" ON "agreement_signatures" ("agreement_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_signatures_signer_role_idx" ON "agreement_signatures" ("signer_role");`;

  // 5. agreement_audit_logs
  console.log('5. Creating agreement_audit_logs table...');
  await sql`
    CREATE TABLE IF NOT EXISTS "agreement_audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "agreement_id" uuid NOT NULL REFERENCES "agreements"("id") ON DELETE CASCADE,
      "action" varchar(100) NOT NULL,
      "performed_by" varchar(255) NOT NULL,
      "role" varchar(50) NOT NULL,
      "description" text NOT NULL,
      "details" jsonb,
      "ip_address" varchar(100),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_audit_logs_agreement_id_idx" ON "agreement_audit_logs" ("agreement_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_audit_logs_action_idx" ON "agreement_audit_logs" ("action");`;
  await sql`CREATE INDEX IF NOT EXISTS "agreement_audit_logs_created_at_idx" ON "agreement_audit_logs" ("created_at");`;

  // 6. Seed initial company settings
  console.log('6. Seeding company_settings if empty...');
  const existingSettings = await sql`SELECT id FROM "company_settings" LIMIT 1`;
  if (existingSettings.length === 0) {
    await sql`
      INSERT INTO "company_settings" (
        "company_legal_name",
        "company_brand_name",
        "registered_address",
        "legal_email",
        "support_email",
        "contact_phone",
        "gstin",
        "gstin_enabled",
        "logo_url",
        "signatory_name",
        "signatory_title",
        "default_currency"
      ) VALUES (
        ${DEFAULT_COMPANY_INFO.legalName},
        ${DEFAULT_COMPANY_INFO.brandName},
        ${DEFAULT_COMPANY_INFO.address},
        ${DEFAULT_COMPANY_INFO.email},
        ${DEFAULT_COMPANY_INFO.supportEmail},
        ${DEFAULT_COMPANY_INFO.phone},
        ${DEFAULT_COMPANY_INFO.gstin || null},
        ${DEFAULT_COMPANY_INFO.gstinEnabled},
        ${DEFAULT_COMPANY_INFO.logoUrl},
        ${DEFAULT_COMPANY_INFO.signatoryName},
        ${DEFAULT_COMPANY_INFO.signatoryTitle},
        ${DEFAULT_COMPANY_INFO.defaultCurrency}
      );
    `;
    console.log('  ✓ Seeded default company_settings');
  } else {
    console.log('  → company_settings already exists');
  }

  // 7. Seed default templates
  console.log('7. Seeding agreement_templates if empty...');
  for (const tpl of PRESET_TEMPLATES) {
    const existing = await sql`SELECT id FROM "agreement_templates" WHERE "code" = ${tpl.code} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO "agreement_templates" (
          "code",
          "name",
          "category",
          "description",
          "clauses"
        ) VALUES (
          ${tpl.code},
          ${tpl.name},
          ${tpl.category},
          ${tpl.description},
          ${JSON.stringify(tpl.clauses)}
        );
      `;
      console.log(`  ✓ Seeded template ${tpl.code}`);
    } else {
      console.log(`  → template ${tpl.code} already exists`);
    }
  }

  console.log('--- Migration Completed Successfully ---');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
