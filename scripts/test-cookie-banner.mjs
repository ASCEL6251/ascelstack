// scripts/test-cookie-banner.mjs
// Verification suite for Ascelstack Cookie Consent Banner & Preference Center

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
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

console.log('\n======================================================');
console.log('ASCELSTACK COOKIE BANNER & PREFERENCE CENTER TEST');
console.log('======================================================\n');

// 1. Verify CookieBanner.astro component
console.log('Group 1: Component File & Structure');
const bannerPath = resolve(ROOT, 'src/components/CookieBanner.astro');
assert(existsSync(bannerPath), 'src/components/CookieBanner.astro exists');

const bannerContent = readFileSync(bannerPath, 'utf8');

assert(
  bannerContent.includes('id="asc-cookie-banner"') && bannerContent.includes('data-cookie-banner'),
  'Banner element with data-cookie-banner attribute exists'
);

assert(
  bannerContent.includes('id="asc-cookie-backdrop"') && bannerContent.includes('data-cookie-backdrop'),
  'Full-page dimmer backdrop exists'
);

assert(
  bannerContent.includes('data-view-notice') && bannerContent.includes('data-view-customize'),
  'Both Initial Notice view and Customization view exist'
);

assert(
  bannerContent.includes('data-cookie-accept-all') &&
  bannerContent.includes('data-cookie-reject-nonessential') &&
  bannerContent.includes('data-cookie-open-customize'),
  'Accept All, Essential Only (reject non-essential), and Personalize action buttons exist'
);

// 2. Indian Startup DPDP & Transparency Guidelines
console.log('\nGroup 2: DPDP & Startup Guidelines Compliance');
assert(
  bannerContent.includes('/terms') && bannerContent.includes('/privacy'),
  'Direct links to Terms & Conditions and Privacy Policy are present'
);

assert(
  bannerContent.includes('Strictly Necessary') &&
  bannerContent.includes('Performance &') &&
  bannerContent.includes('Personalization &'),
  'Granular categories (Necessary, Analytics, Personalization) are explicitly articulated'
);

assert(
  bannerContent.includes('disabled') && bannerContent.includes('Always Active'),
  'Strictly Necessary cookies are locked as Always Active (cannot be disabled)'
);

// 3. Localhost and Persistence
console.log('\nGroup 3: Localhost Access & Persistence Mechanics');
assert(
  bannerContent.includes('localStorage.setItem') &&
  bannerContent.includes('ascelstack_cookie_consent_v1'),
  'LocalStorage persistence with versioned key is implemented'
);

assert(
  bannerContent.includes('document.cookie') &&
  bannerContent.includes('COOKIE_NAME'),
  'Cookie fallback persistence is implemented'
);

assert(
  bannerContent.includes("window.location.protocol === 'https:'"),
  'Localhost compatibility ensured (Secure flag omitted on non-HTTPS/localhost)'
);

assert(
  bannerContent.includes('data-open-cookie-preferences'),
  'Re-opening handler via [data-open-cookie-preferences] is registered'
);

// 4. Layout & Footer Integration
console.log('\nGroup 4: Layout & Footer Integration');
const baseLayoutPath = resolve(ROOT, 'src/layouts/Base.astro');
const baseContent = readFileSync(baseLayoutPath, 'utf8');
assert(
  baseContent.includes('CookieBanner') && baseContent.includes('<CookieBanner />'),
  'CookieBanner is mounted in Base.astro layout'
);

const footerPath = resolve(ROOT, 'src/components/Footer.astro');
const footerContent = readFileSync(footerPath, 'utf8');
assert(
  footerContent.includes('data-open-cookie-preferences') &&
  footerContent.includes('Cookie preferences'),
  'Footer contains link to customize/personalize cookie banner'
);

assert(
  footerContent.includes('footer-legal-btn'),
  'Footer styling classes for cookie button are defined'
);

// 5. Privacy Page Integration
console.log('\nGroup 5: Privacy Page Integration');
const privacyPath = resolve(ROOT, 'src/pages/privacy.astro');
const privacyContent = readFileSync(privacyPath, 'utf8');
assert(
  privacyContent.includes('Manage Cookie Preferences') &&
  privacyContent.includes('data-open-cookie-preferences'),
  'Privacy policy section 9 contains manage preferences trigger'
);

console.log('\n======================================================');
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
