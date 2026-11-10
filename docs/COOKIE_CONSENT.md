# Ascelstack Cookie & Privacy Consent System

## Overview & Regulatory Compliance

The Ascelstack Cookie Consent Banner and Preference Center is engineered in strict accordance with the **Digital Personal Data Protection Act, 2023 (DPDPA)** of India, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, and global privacy standards.

### Core Principles
1. **Unambiguous Plain-Language Notice:** Transparently communicates the specific purposes for which cookies and local browser storage are utilized (session authentication, CSRF security, service cart & quotation persistence, anonymous performance metrics, and tailored workflow settings).
2. **Granular Consent & Category Separation:**
   - **Strictly Necessary (Always Active):** Essential for client portal sessions, security tokens, and estimate cart persistence. Cannot be disabled.
   - **Performance & Analytics (Optional):** Measures site loading speed, latency, and feature usage in an aggregated format with zero third-party cross-site profiling.
   - **Personalization & Workflows (Optional):** Stores client industry selections and tailored quotation scope parameters across visits.
3. **Equal Prominence of User Choices:** Equal visual hierarchy for "Accept All", "Essential Only" (reject non-essential), and "Personalize Choices" — eliminating deceptive dark patterns.
4. **Permanent Right to Withdraw / Re-configure:** Users can re-open their preference center at any time via:
   - The **"Cookie preferences"** link in the footer's Legal & Trust section.
   - The **"Cookie Preferences"** button in the footer's bottom legal bar.
   - The **"Manage Cookie Preferences"** button within Section 9 of the `/privacy#cookies` page.
   - Programmatic events via `window.dispatchEvent(new CustomEvent('ascelstack:open-cookie-preferences'))`.

---

## Technical Architecture & Localhost Compatibility

### Storage & Persistence Layer
Consent preferences are simultaneously recorded across both **LocalStorage** and **Document Cookies** for redundancy and server-side capability:
- **LocalStorage Key:** `ascelstack_cookie_consent_v1`
- **Cookie Name:** `ascelstack_consent` (Duration: 365 days, `SameSite=Lax`)
- **Localhost Safety:** The `Secure` cookie flag is dynamically applied only when `window.location.protocol === 'https:'`. This ensures full operational compatibility on `http://localhost`, `127.0.0.1`, and development ports without cookie rejection.

### Schema
```typescript
interface CookieConsent {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
  timestamp: string; // ISO 8601
  version: number;   // 1
}
```

### Visual & Layout Specifications
- **Edge-to-Edge Full Skin Layout:** Spans the entire viewport width (`100vw`, `left: 0`, `right: 0`, `bottom: 0`) pinned to the bottom of the main screen.
- **Translucent Scrim Backdrop:** An interactive backdrop (`#asc-cookie-backdrop`) dims the underlying screen on initial unconsented visit to guide focus to the privacy choices.
- **Ascelstack Brand Tokens:**
  - Ink `#1D2D3D` & Deep Ink `#142130`
  - Accent `#5980A6`
  - Tint `#94BCE3`
  - Paper `#F2F2F3`
  - Typography: `Inter Tight` (bold, crisp, highly legible) and `JetBrains Mono` for tags.

---

## Verification & Testing
Run the dedicated verification test:
```bash
npm run test:cookie
```
All 16 unit assertions validate component rendering, DPDP compliance, categories, localhost cookie fallback, footer hooks, and privacy policy integration.
