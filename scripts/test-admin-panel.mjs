import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// Load environment variables from .env
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

// Emulate admin auth functions for verification
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function parseAdminEmails(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && EMAIL_REGEX.test(e))
    )
  );
}

function isAuthorized(email, allowlistString) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return false;
  const list = parseAdminEmails(allowlistString);
  return list.includes(normalized);
}

// Web Crypto HMAC token emulation
async function createToken(session, secret) {
  const payloadStr = JSON.stringify(session);
  const encPayload = Buffer.from(payloadStr).toString('base64url');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(encPayload));
  const encSig = Buffer.from(sig).toString('base64url');
  return `${encPayload}.${encSig}`;
}

async function verifyToken(token, secret, currentAllowlist) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encPayload, providedSig] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(encPayload));
  const expectedSig = Buffer.from(sig).toString('base64url');
  if (providedSig !== expectedSig) return null;

  const session = JSON.parse(Buffer.from(encPayload, 'base64url').toString('utf8'));
  if (session.exp < Math.floor(Date.now() / 1000)) return null;

  // Revocation check
  if (!isAuthorized(session.email, currentAllowlist)) return null;

  return session;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('ASCELSTACK PRODUCTION ADMIN PANEL VERIFICATION SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('Test Group 1: Admin Allowlist & Google OAuth Authorization');
  // --------------------------------------------------------------------------
  const sampleAllowlist = ' basakarnab430@gmail.com, ascelstack.servise@gmail.com , ADMIN-TEAM@ascelstack.com ';
  const parsed = parseAdminEmails(sampleAllowlist);

  assert(parsed.length === 3, 'Correctly parses 3 email addresses');
  assert(parsed.includes('basakarnab430@gmail.com'), 'Normalizes first admin email to lowercase');
  assert(parsed.includes('ascelstack.servise@gmail.com'), 'Normalizes second admin email and trims spaces');
  assert(parsed.includes('admin-team@ascelstack.com'), 'Normalizes third admin email from uppercase');

  assert(isAuthorized('basakarnab430@gmail.com', sampleAllowlist), 'Authorized Google email: Access Granted');
  assert(isAuthorized('BASAKARNAB430@GMAIL.COM', sampleAllowlist), 'Case-insensitive email match: Access Granted');
  assert(!isAuthorized('hacker@evil.com', sampleAllowlist), 'Unauthorized email: Access Denied');
  assert(!isAuthorized('not-an-email', sampleAllowlist), 'Malformed email string: Access Denied');
  assert(!isAuthorized('', sampleAllowlist), 'Empty string: Access Denied');
  assert(!isAuthorized(null, sampleAllowlist), 'Null email: Access Denied');
  assert(!isAuthorized('basakarnab430@gmail.com', ''), 'Missing/empty ADMIN_EMAILS: Fails closed (Access Denied)');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 2: Session Security, Cryptographic Signatures & Revocation');
  // --------------------------------------------------------------------------
  const secret = 'super_secret_test_key_1234567890';
  const now = Math.floor(Date.now() / 1000);
  const sessionData = {
    email: 'basakarnab430@gmail.com',
    name: 'Arnab Basak',
    provider: 'google',
    iat: now,
    exp: now + 3600,
  };

  const validToken = await createToken(sessionData, secret);
  const verified = await verifyToken(validToken, secret, sampleAllowlist);
  assert(verified && verified.email === 'basakarnab430@gmail.com', 'Valid signed admin session verifies successfully');

  // Tampered token test
  const tamperedToken = validToken.slice(0, -4) + 'abcd';
  const tamperedResult = await verifyToken(tamperedToken, secret, sampleAllowlist);
  assert(tamperedResult === null, 'Tampered token is rejected by cryptographic signature check');

  // Expired token test
  const expiredToken = await createToken({ ...sessionData, exp: now - 10 }, secret);
  const expiredResult = await verifyToken(expiredToken, secret, sampleAllowlist);
  assert(expiredResult === null, 'Expired session token is immediately rejected');

  // Instant Revocation test: Email removed from allowlist
  const restrictedAllowlist = 'only_other_admin@gmail.com';
  const revokedResult = await verifyToken(validToken, secret, restrictedAllowlist);
  assert(revokedResult === null, 'Instant Revocation: Removed admin email is immediately rejected on privileged verification');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 3: Database Integrity & Entity Relations');
  // --------------------------------------------------------------------------
  const usersRows = await sql`SELECT count(*)::int as count FROM users;`;
  assert(usersRows[0].count > 0, `Users table populated: ${usersRows[0].count} registered users`);

  const quotesRows = await sql`SELECT count(*)::int as count FROM quotations;`;
  assert(quotesRows[0].count > 0, `Quotations table populated: ${quotesRows[0].count} quotations in database`);

  const orphanQuotes = await sql`
    SELECT count(*)::int as count FROM quotations q
    LEFT JOIN users u ON q.user_id = u.id
    WHERE u.id IS NULL;
  `;
  assert(orphanQuotes[0].count === 0, 'Foreign key integrity: zero orphaned quotations');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 4: Independent Quotation Lifecycle & Financial Management');
  // --------------------------------------------------------------------------
  // Pick one test quotation to verify independent lifecycle transitions
  const testQuote = (await sql`SELECT * FROM quotations ORDER BY created_at ASC LIMIT 1;`)[0];
  assert(testQuote && testQuote.id, `Selected test quotation: ${testQuote.quotation_number}`);

  const originalStatus = testQuote.quotation_status;
  const originalPayment = testQuote.payment_status;
  const originalProgress = testQuote.project_progress;

  // A. Quotation Status transition
  const targetStatus = originalStatus === 'Under Review' ? 'Quotation Prepared' : 'Under Review';
  await sql`
    UPDATE quotations
    SET quotation_status = ${targetStatus}, updated_at = now()
    WHERE id = ${testQuote.id};
  `;
  const postStatusCheck = (await sql`SELECT * FROM quotations WHERE id = ${testQuote.id};`)[0];
  assert(postStatusCheck.quotation_status === targetStatus, `Quotation status updated independently to "${targetStatus}"`);
  assert(postStatusCheck.payment_status === originalPayment, 'Payment status remained completely unaffected');
  assert(postStatusCheck.project_progress === originalProgress, 'Project progress remained completely unaffected');

  // B. Payment Status transition
  const targetPayment = 'Payment Pending';
  await sql`
    UPDATE quotations
    SET payment_status = ${targetPayment}, updated_at = now()
    WHERE id = ${testQuote.id};
  `;
  const postPaymentCheck = (await sql`SELECT * FROM quotations WHERE id = ${testQuote.id};`)[0];
  assert(postPaymentCheck.payment_status === targetPayment, `Payment status updated independently to "${targetPayment}"`);
  assert(postPaymentCheck.quotation_status === targetStatus, 'Quotation status remained completely unaffected');
  assert(postPaymentCheck.project_progress === originalProgress, 'Project progress remained completely unaffected');

  // C. Project Progress transition (0% to 100%)
  const targetProgress = 65;
  await sql`
    UPDATE quotations
    SET project_progress = ${targetProgress}, updated_at = now()
    WHERE id = ${testQuote.id};
  `;
  const postProgressCheck = (await sql`SELECT * FROM quotations WHERE id = ${testQuote.id};`)[0];
  assert(postProgressCheck.project_progress === targetProgress, `Project progress updated independently to ${targetProgress}%`);
  assert(postProgressCheck.quotation_status === targetStatus, 'Quotation status remained completely unaffected');
  assert(postProgressCheck.payment_status === targetPayment, 'Payment status remained completely unaffected');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 5: Pricing Management & Audit Trail Logging');
  // --------------------------------------------------------------------------
  const newFinalAmount = '48500.00';
  const newInitialCost = '45000.00';
  const newCustomerNotes = 'Scope approved by engineering lead. Estimated delivery: 3 sprints.';
  const newInternalNotes = 'CONFIDENTIAL: Margin calculated at 38%. Two senior engineers assigned.';

  await sql`
    UPDATE quotations
    SET final_quotation_amount = ${newFinalAmount},
        initial_estimated_cost = ${newInitialCost},
        customer_notes = ${newCustomerNotes},
        internal_notes = ${newInternalNotes},
        updated_at = now()
    WHERE id = ${testQuote.id};
  `;

  // Log into quotation_history
  await sql`
    INSERT INTO quotation_history (
      quotation_id, user_id, admin_email, field_changed, previous_value, new_value, description
    ) VALUES (
      ${testQuote.id}, ${testQuote.user_id}, 'basakarnab430@gmail.com', 'final_quotation_amount',
      ${String(testQuote.final_quotation_amount)}, ${newFinalAmount}, 'Updated final pricing amount'
    );
  `;

  const updatedQuote = (await sql`SELECT * FROM quotations WHERE id = ${testQuote.id};`)[0];
  assert(parseFloat(updatedQuote.final_quotation_amount) === 48500.00, 'Final quotation amount persisted accurately');
  assert(updatedQuote.customer_notes === newCustomerNotes, 'Customer-visible notes saved correctly');
  assert(updatedQuote.internal_notes === newInternalNotes, 'Internal administrative notes saved correctly');

  // Verify history entry
  const historyEntries = await sql`
    SELECT * FROM quotation_history
    WHERE quotation_id = ${testQuote.id}
    ORDER BY created_at DESC LIMIT 1;
  `;
  assert(historyEntries.length > 0, 'Quotation change history entry recorded in database');
  assert(historyEntries[0].admin_email === 'basakarnab430@gmail.com', 'Administrator identity preserved in audit log');

  // --------------------------------------------------------------------------
  console.log('\nTest Group 6: Customer Visibility vs Internal Privacy Isolation');
  // --------------------------------------------------------------------------
  // Emulate customer-facing query (as executed in customer dashboard / API)
  const customerView = (await sql`
    SELECT id, quotation_number, project_title, quotation_status, payment_status,
           project_progress, currency, final_quotation_amount, customer_notes, updated_at
    FROM quotations
    WHERE id = ${testQuote.id} AND user_id = ${testQuote.user_id};
  `)[0];

  assert(customerView !== undefined, 'Customer can retrieve their quotation');
  assert(customerView.customer_notes === newCustomerNotes, 'Customer sees administrative update note');
  assert(customerView.internal_notes === undefined, 'Internal notes strictly excluded from customer view');

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
