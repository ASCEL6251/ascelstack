import { dev } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// Load .env
let env = {};
try {
  const envContent = readFileSync(resolve(root, '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
} catch (e) {}

// Populate process.env
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) {
    process.env[k] = v;
  }
}

process.env.ASTRO_TELEMETRY_DISABLED = '1';

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
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

async function run() {
  console.log('\n======================================================');
  console.log('ASCELSTACK END-TO-END PORTAL & HEALTH ROUTING SUITE');
  console.log('======================================================\n');

  // 1. Core Health & Database Diagnostics
  console.log('Test Group 1: Core Health & Database Diagnostics');
  try {
    const startTime = Date.now();
    const [{ ping }] = await sql`SELECT 1 as ping`;
    const latency = Date.now() - startTime;
    assert(ping === 1, `Neon Database ping: 200 OK (Latency: ${latency}ms)`);

    const [{ totalServices }] = await sql`SELECT count(*)::int as "totalServices" FROM services`;
    assert(totalServices > 0, `Services catalogue populated: ${totalServices} active services available`);

    const [{ totalQuotes }] = await sql`SELECT count(*)::int as "totalQuotes" FROM quotations`;
    assert(totalQuotes >= 20, `Quotations database operational: ${totalQuotes} quotation records`);
  } catch (err) {
    assert(false, `Database health check failed: ${err.message}`);
  }

  // 2. Start Astro dev server in-process
  console.log('\nTest Group 2: Live HTTP Server Endpoint Verification');
  const PORT = 4399;
  const baseUrl = `http://127.0.0.1:${PORT}`;

  let server;
  try {
    server = await dev({
      root,
      server: {
        port: PORT,
        host: '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to start Astro server:', err);
    process.exit(1);
  }

  async function checkRoute(urlPath, expectedStatus, description, redirectTarget = null) {
    try {
      const res = await fetch(`${baseUrl}${urlPath}`, { redirect: 'manual' });
      const statusOk = res.status === expectedStatus;
      assert(statusOk, `${urlPath} -> HTTP ${res.status} (Expected ${expectedStatus}) - ${description}`);
      if (redirectTarget && (res.status === 302 || res.status === 307)) {
        const loc = res.headers.get('location') || '';
        assert(loc.includes(redirectTarget), `  ↳ Redirect target includes "${redirectTarget}" (Actual: "${loc}")`);
      }
    } catch (err) {
      assert(false, `${urlPath} -> Network error: ${err.message}`);
    }
  }

  try {
    // Test Public Routes
    console.log('\n-- Public Portal & Service Catalogue Pages --');
    await checkRoute('/', 200, 'Home page renders successfully');
    await checkRoute('/services', 200, 'Service catalogue index renders');
    await checkRoute('/services/software-development', 200, 'Software Development category page');
    await checkRoute('/services/ai-automation', 200, 'AI & Automation category page');
    await checkRoute('/services/digital-marketing', 200, 'Digital Marketing category page');
    await checkRoute('/contact', 200, 'Contact page renders');
    await checkRoute('/automation', 200, 'Automation interactive page renders');
    await checkRoute('/api/services', 200, 'Services API returns 200 OK catalogue data');
    await checkRoute('/api/health', 200, 'System Health Check endpoint returns 200 OK');

    // Test Customer Portal Auth Protection & Redirections
    console.log('\n-- Customer Portal Authentication & Redirections --');
    await checkRoute('/login', 200, 'Customer login page accessible');
    await checkRoute('/dashboard', 302, 'Unauthenticated /dashboard redirects to login', '/login');
    await checkRoute('/api/customer/quotations', 401, 'Customer quotations API blocks unauthenticated access');
    await checkRoute('/api/customer/service-requests', 401, 'Customer service requests API blocks unauthenticated access');

    // Test Admin Portal Auth Protection & Redirections
    console.log('\n-- Admin Portal Access Control & Redirections --');
    await checkRoute('/admin/login', 200, 'Admin login page renders accessible');
    await checkRoute('/admin', 302, 'Unauthenticated /admin redirects to admin login', '/admin/login');
    await checkRoute('/admin/users', 302, 'Unauthenticated /admin/users redirects to admin login', '/admin/login');
    await checkRoute('/admin/quotations', 302, 'Unauthenticated /admin/quotations redirects to admin login', '/admin/login');
    await checkRoute('/admin/logs', 302, 'Unauthenticated /admin/logs redirects to admin login', '/admin/login');
    await checkRoute('/admin/settings', 302, 'Unauthenticated /admin/settings redirects to admin login', '/admin/login');
    await checkRoute('/api/admin/stats', 401, 'Admin stats API blocks unauthenticated access');
    await checkRoute('/api/admin/quotations', 401, 'Admin quotations API blocks unauthenticated access');
  } finally {
    if (server) {
      await server.stop();
    }
  }

  console.log('\n======================================================');
  console.log(`END-TO-END VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
