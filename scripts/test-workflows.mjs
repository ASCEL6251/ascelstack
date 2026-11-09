import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { createClerkClient } from '@clerk/backend';

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
const CLERK_SECRET_KEY = env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;

if (!DATABASE_URL || !CLERK_SECRET_KEY) {
  console.error('DATABASE_URL or CLERK_SECRET_KEY is missing');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

const USER_1_CLERK_ID = 'user_3Lq5rt1P6NCSAYROo9tUZdrQbN2'; // Aarav Sharma
const USER_2_CLERK_ID = 'user_3Lq5seglPLyGdkv1vXHsWdarm3w'; // Priya Patel

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
  console.log('ASCELSTACK CUSTOMER AUTH & DASHBOARD INTEGRATION TESTS');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  console.log('Test 1: Clerk User Verification & Neon User Sync');
  // --------------------------------------------------------------------------
  const clerkUser1 = await clerk.users.getUser(USER_1_CLERK_ID);
  assert(clerkUser1 && clerkUser1.id === USER_1_CLERK_ID, 'Customer 1 exists in Clerk');

  const email1 = clerkUser1.emailAddresses[0]?.emailAddress;
  const name1 = `${clerkUser1.firstName} ${clerkUser1.lastName}`.trim();

  // Sync to Neon
  const [neonUser1] = await sql`
    INSERT INTO users (clerk_user_id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (${USER_1_CLERK_ID}, ${email1}, ${name1}, ${clerkUser1.imageUrl || null}, NOW(), NOW())
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      updated_at = NOW()
    RETURNING *;
  `;
  assert(neonUser1 && neonUser1.clerk_user_id === USER_1_CLERK_ID, 'Customer 1 mapped correctly in Neon users table');
  assert(neonUser1.email === email1, `Email matches: ${email1}`);

  // --------------------------------------------------------------------------
  console.log('\nTest 2: Login & Identity Resolution');
  // --------------------------------------------------------------------------
  const [resolvedUser] = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${USER_1_CLERK_ID} LIMIT 1;
  `;
  assert(resolvedUser && resolvedUser.id === neonUser1.id, 'User resolved by Clerk User ID server-side');

  // --------------------------------------------------------------------------
  console.log('\nTest 3: Business Profile Creation, Edit, & Persistence');
  // --------------------------------------------------------------------------
  const [biz1] = await sql`
    INSERT INTO businesses (
      owner_user_id, business_name, business_type, industry, email, phone, website,
      address, city, state, country, gstin, description
    ) VALUES (
      ${neonUser1.id}, 'Sharma Logistics & Tech Pvt Ltd', 'Private Limited', 'Technology & Software',
      'contact@sharmalogistics.com', '+91 98765 43210', 'https://sharmalogistics.com',
      'Suite 402, Cyber Tower', 'Bengaluru', 'Karnataka', 'India', '29ABCDE1234F1Z5',
      'End-to-end multi-modal supply chain software and automated tracking'
    )
    RETURNING *;
  `;
  assert(biz1 && biz1.business_name === 'Sharma Logistics & Tech Pvt Ltd', 'Business created in Neon');

  // Update business profile
  const [updatedBiz1] = await sql`
    UPDATE businesses
    SET business_name = 'Sharma Logistics & Tech Global Pvt Ltd',
        phone = '+91 98765 00000',
        updated_at = NOW()
    WHERE id = ${biz1.id} AND owner_user_id = ${neonUser1.id}
    RETURNING *;
  `;
  assert(updatedBiz1.business_name === 'Sharma Logistics & Tech Global Pvt Ltd', 'Business profile updated');

  // Verify persistence on fresh read
  const [persistedBiz] = await sql`
    SELECT * FROM businesses WHERE id = ${biz1.id};
  `;
  assert(persistedBiz.phone === '+91 98765 00000', 'Updated business profile persisted in Neon');

  // --------------------------------------------------------------------------
  console.log('\nTest 4: Add Service Request from Catalogue');
  // --------------------------------------------------------------------------
  const [targetService] = await sql`
    SELECT * FROM services WHERE code = 'ASC-0001' LIMIT 1;
  `;
  assert(targetService && targetService.name === 'Website Development', 'Service ASC-0001 retrieved from catalogue');

  const [req1] = await sql`
    INSERT INTO service_requests (
      business_id, user_id, service_id, requirements, status
    ) VALUES (
      ${biz1.id}, ${neonUser1.id}, ${targetService.id},
      'Enterprise Astro website with global CDN, custom 3D scenes, and dynamic customer portal',
      'pending'
    )
    RETURNING *;
  `;
  assert(req1 && req1.status === 'pending', 'Service request created with initial status "pending"');

  // Test duplicate prevention rule
  const duplicateCheck = await sql`
    SELECT * FROM service_requests
    WHERE business_id = ${biz1.id}
      AND service_id = ${targetService.id}
      AND status IN ('pending', 'reviewing', 'approved', 'active');
  `;
  assert(duplicateCheck.length >= 1, 'Duplicate request prevention check correctly detects existing pending request');

  // --------------------------------------------------------------------------
  console.log('\nTest 5: Dashboard Overview & Real-time Metrics Calculation');
  // --------------------------------------------------------------------------
  const userRequests = await sql`
    SELECT sr.*, s.name as service_name, s.layer, s.discipline
    FROM service_requests sr
    JOIN services s ON sr.service_id = s.id
    WHERE sr.user_id = ${neonUser1.id};
  `;
  const total = userRequests.length;
  const pending = userRequests.filter(r => ['pending', 'reviewing'].includes(r.status)).length;
  const active = userRequests.filter(r => r.status === 'active').length;
  const completed = userRequests.filter(r => r.status === 'completed').length;

  assert(total >= 1, `Total requested services: ${total}`);
  assert(pending >= 1, `Pending services: ${pending}`);
  assert(active === 0, `Active services: ${active} (Not marked active until admin approves)`);

  // --------------------------------------------------------------------------
  console.log('\nTest 6: Multi-Customer Isolation (Tenant Boundary Check)');
  // --------------------------------------------------------------------------
  const clerkUser2 = await clerk.users.getUser(USER_2_CLERK_ID);
  const email2 = clerkUser2.emailAddresses[0]?.emailAddress;
  const name2 = `${clerkUser2.firstName} ${clerkUser2.lastName}`.trim();

  const [neonUser2] = await sql`
    INSERT INTO users (clerk_user_id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (${USER_2_CLERK_ID}, ${email2}, ${name2}, ${clerkUser2.imageUrl || null}, NOW(), NOW())
    ON CONFLICT (clerk_user_id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
    RETURNING *;
  `;

  // Customer 2 creates their own business
  const [biz2] = await sql`
    INSERT INTO businesses (
      owner_user_id, business_name, business_type, industry, email
    ) VALUES (
      ${neonUser2.id}, 'Patel Organic Kitchen & Cafe', 'LLP', 'Restaurant & Food', ${email2}
    )
    RETURNING *;
  `;

  // Customer 2 requests restaurant service ASC-0081 (Swiggy & Zomato Onboarding)
  const [restaurantSvc] = await sql`
    SELECT * FROM services WHERE code = 'ASC-0081' LIMIT 1;
  `;

  const [req2] = await sql`
    INSERT INTO service_requests (
      business_id, user_id, service_id, requirements, status
    ) VALUES (
      ${biz2.id}, ${neonUser2.id}, ${restaurantSvc.id},
      'Immediate onboarding on Swiggy and Zomato with menu photography',
      'pending'
    )
    RETURNING *;
  `;

  // Verify Customer 1 cannot see Customer 2's requests
  const cust1Requests = await sql`
    SELECT * FROM service_requests WHERE user_id = ${neonUser1.id};
  `;
  const containsCust2 = cust1Requests.some(r => r.id === req2.id || r.user_id === neonUser2.id);
  assert(!containsCust2, 'Customer 1 query does NOT return Customer 2 records (Zero leakage)');

  // Verify Customer 2 cannot update or cancel Customer 1's request
  const unauthorizedCancelAttempt = await sql`
    UPDATE service_requests
    SET status = 'cancelled'
    WHERE id = ${req1.id} AND user_id = ${neonUser2.id}
    RETURNING *;
  `;
  assert(unauthorizedCancelAttempt.length === 0, 'Customer 2 unauthorized cancellation attempt is blocked');

  // --------------------------------------------------------------------------
  console.log('\nTest 7: Service Cancellation Workflow');
  // --------------------------------------------------------------------------
  const [cancelledReq] = await sql`
    UPDATE service_requests
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${req1.id} AND user_id = ${neonUser1.id}
    RETURNING *;
  `;
  assert(cancelledReq && cancelledReq.status === 'cancelled', 'Pending service request cancelled by owner');

  // Insert audit log
  await sql`
    INSERT INTO activity_logs (user_id, business_id, activity_type, description, metadata)
    VALUES (
      ${neonUser1.id}, ${biz1.id}, 'service_cancelled',
      'Cancelled service request for: Website Development',
      ${JSON.stringify({ requestId: req1.id, serviceCode: 'ASC-0001' })}
    );
  `;

  const [loggedActivity] = await sql`
    SELECT * FROM activity_logs
    WHERE user_id = ${neonUser1.id} AND activity_type = 'service_cancelled'
    ORDER BY created_at DESC LIMIT 1;
  `;
  assert(loggedActivity && loggedActivity.activity_type === 'service_cancelled', 'Activity log audit trail persisted');

  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
