# Ascelstack Production-Ready Admin Panel: Architecture & Deployment Guide

## 1. Overview
The **Ascelstack Admin Panel** is fully implemented and integrated directly inside the existing Ascelstack application (`https://ascelstack.com`). It reuses the existing design system, sidebar layout, typography (*Bacasime Antique*, *Inter Tight*, *JetBrains Mono*), brand tokens (Ink `#1D2D3D`, Accent `#5980A6`, Tint `#94BCE3`, Paper `#F2F2F3`), and database infrastructure (Neon PostgreSQL + Drizzle ORM).

---

## 2. Admin Panel Navigation & Routes

| Route | View | Description |
|---|---|---|
| `/admin` | **Overview** | Real-time statistics (Registered Users, New Users, Total Quotations, Pending Review), circular progress indicators, recent customer inquiries, recent activity feed. |
| `/admin/users` | **Users** | User management table with search (name, email, UUID, Clerk ID), sorting, pagination, quotation count badges, and last active timestamps. |
| `/admin/users/[id]` | **User Profile** | Detailed customer account view, organization details, quotation history (strictly isolated to the user), and activity timeline. |
| `/admin/quotations` | **Quotations** | Comprehensive list of customer-submitted inquiries and scopes with multi-field search, filters for Quotation Status and Payment Status, and sorting. |
| `/admin/quotations/[id]` | **Quotation Detail & Editor** | Full management suite: customer information, scope requirements, editable quotation status, editable payment status with verification, independent project progress (0–100%), editable pricing breakdown, internal notes (hidden), customer notes (visible), and change history. |
| `/admin/logs` | **Activity Logs** | Complete audit trail of quotation modifications (delta tracking with previous/new values) and administrative actions with timestamps and admin identity. |
| `/admin/settings` | **Settings** | Cloudflare `ADMIN_EMAILS` allowlist status, active administrator count, instant revocation documentation, and system diagnostics. |
| `/admin/login` | **Admin Sign-In** | Professional Sign in with Google interface, Google Identity Services client, unauthorized access notices, and local development helper. |

---

## 3. Administrator Authentication & Cloudflare Access Control

### 3.1 Environment Variable
```env
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com,admin3@gmail.com
```

### 3.2 Security Specifications
- **Strict Server-Side Parsing**: Parses comma-separated emails, trims whitespace, normalizes to lowercase, and validates regex format.
- **Fail-Closed**: If `ADMIN_EMAILS` is missing or empty, all administrative operations fail closed (`403 Forbidden`).
- **Instant Revocation (No Waiting for Expiry)**: On **every privileged request**, the session token is re-validated against the current `ADMIN_EMAILS` environment variable. If an email is removed from Cloudflare, access is immediately revoked.
- **Secure Cookie**: `__asc_admin_session` cookie signed using Web Crypto HMAC-SHA256 (`HttpOnly`, `SameSite=Lax`, `Secure` in production).
- **Separation of Concerns**: Administrator authentication is completely separate from customer Clerk authentication. Ordinary customers cannot access admin routes or APIs.

---

## 4. Quotation Lifecycle & Financial Engine

### 4.1 Independent Statuses
1. **Quotation Status (12 stages)**:
   - *New Inquiry, Under Review, Processing, Estimation in Progress, Quotation Prepared, Quotation Sent, Awaiting Customer Approval, Approved, Rejected, On Hold, Completed, Cancelled*
2. **Payment Status (7 stages)**:
   - *Not Required, Payment Pending, Payment Processing, Partially Paid, Payment Completed, Payment Failed, Payment Refunded*
   - Payment completion requires verification confirmation or transaction reference.
3. **Project Progress (0% to 100%)**:
   - Independent progress slider and number input with visual indicator.
   - Modifying one status does not alter the others.

### 4.2 Estimation & Pricing Management
- **Initial Estimated Cost** vs **Final Quotation Amount**.
- **Additional Service Charges**, **Discounts**, **Taxes**.
- **Pricing Breakdown**: Itemized service lines.
- **Currency Support**: INR (₹) and USD ($).
- **Note Privacy Isolation**:
  - `internal_notes`: Strictly visible to administrators; never exposed to customer APIs or frontend views.
  - `customer_notes`: Propagated to customer portal dashboard in real-time.

---

## 5. Customer Dashboard Integration
Inside the customer portal (`/dashboard`):
- Added dedicated **Quotations** tab and portfolio view.
- Real-time display of quotation status, payment status, project progress bar, final agreed amount, and team update notes.
- Customer-submitted service requests automatically create and link quotation records.

---

## 6. Real-Time Synchronization
- `/api/admin/sync`: Provides both Server-Sent Events (`text/event-stream`) streaming and JSON delta polling with version hashing.
- Client automatically detects database mutations and updates UI without full-page reloads.

---

## 7. Cloudflare Deployment Instructions
To deploy the Admin Panel to Cloudflare Workers:
1. Open your Cloudflare Dashboard → **Workers & Pages** → **ascelstack**.
2. Go to **Settings** → **Variables and Secrets**.
3. Add the following variables:
   - `ADMIN_EMAILS`: `your_email@gmail.com,colleague@gmail.com`
   - `ADMIN_SESSION_SECRET`: A secure random string (e.g., 32+ characters).
   - `GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Web Client ID (from Google Cloud Console).
   - `DATABASE_URL`: Your pooled Neon PostgreSQL connection string.
4. Run `npm run deploy` to build and publish via Wrangler.
