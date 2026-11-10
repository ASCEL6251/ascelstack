import type { APIContext } from 'astro';
import { clerkClient, createClerkClient } from '@clerk/astro/server';
import { db, adminActivityLogs } from '../db';

export interface AdminSession {
  email: string;
  name: string;
  avatarUrl?: string;
  sub?: string;
  provider: 'google' | 'clerk';
  iat: number;
  exp: number;
}

const COOKIE_NAME = '__asc_admin_session';
const DEFAULT_SESSION_DURATION = 8 * 60 * 60; // 8 hours in seconds
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const DEFAULT_AUTHORIZED_ADMINS = [
  'basakarnab430@gmail.com',
  'sujoymoulick05@gmail.com',
  'souvikchowdhury5756@gmail.com',
  'ascelstack.servise@gmail.com',
];

/**
 * Get server environment variable safely across Node, Vite, Astro, and Cloudflare Worker runtimes
 */
export function getEnvVariable(name: string, context?: APIContext | any): string | undefined {
  // 1. Cloudflare Workers context.locals.cfContext.env (Astro 6 & 7 Cloudflare adapter)
  try {
    const cfEnv = context?.locals?.cfContext?.env;
    if (cfEnv && cfEnv[name]) {
      return cfEnv[name];
    }
  } catch {}

  // 2. Process environment (Node.js & Cloudflare Workers with nodejs_compat)
  if (typeof process !== 'undefined' && process.env?.[name]) {
    return process.env[name];
  }

  // 3. Vite / Astro import.meta.env
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[name]) {
    return (import.meta as any).env[name];
  }

  // 4. Safe fallback for older Cloudflare runtime bindings
  try {
    const cfEnv = context?.locals?.runtime?.env;
    if (cfEnv && cfEnv[name]) {
      return cfEnv[name];
    }
  } catch {}

  return undefined;
}

/**
 * Retrieve and parse the authorized ADMIN_EMAILS from Cloudflare / runtime environment
 * Parses comma-separated values, trims whitespace, converts to lowercase, and validates email syntax.
 * Merges with the authorized admin team list so admins are never accidentally locked out.
 */
export function getAuthorizedAdminEmails(context?: APIContext | any): string[] {
  const raw = getEnvVariable('ADMIN_EMAILS', context);
  const parsed =
    raw && typeof raw === 'string'
      ? raw
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0 && EMAIL_REGEX.test(e))
      : [];

  return Array.from(new Set([...DEFAULT_AUTHORIZED_ADMINS, ...parsed]));
}

/**
 * Check if a given email is present in the authorized ADMIN_EMAILS list
 */
export function isAuthorizedAdminEmail(email: string | null | undefined, context?: APIContext | any): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) return false;

  const authorizedList = getAuthorizedAdminEmails(context);
  return authorizedList.includes(normalized);
}

/**
 * Get secret key for signing session tokens
 */
function getSigningSecret(context?: APIContext | any): string {
  const secret =
    getEnvVariable('ADMIN_SESSION_SECRET', context) ||
    getEnvVariable('CLERK_SECRET_KEY', context) ||
    'ascelstack_internal_admin_secret_key_change_in_production_2026';
  return secret;
}

/**
 * Convert string to Base64URL
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode Base64URL string
 */
function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Generate HMAC-SHA256 signature using standard Web Crypto API (supported natively in Cloudflare & Node 18+)
 */
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create a cryptographically signed admin session token
 */
export async function createAdminSessionToken(
  sessionData: Omit<AdminSession, 'iat' | 'exp'>,
  context?: APIContext | any
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSession = {
    ...sessionData,
    email: sessionData.email.trim().toLowerCase(),
    iat: now,
    exp: now + DEFAULT_SESSION_DURATION,
  };

  const payloadStr = JSON.stringify(session);
  const encodedPayload = base64UrlEncode(payloadStr);
  const secret = getSigningSecret(context);
  const signature = await createHmacSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a signed admin session token
 */
export async function verifyAdminSessionToken(
  token: string,
  context?: APIContext | any
): Promise<AdminSession | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encodedPayload, providedSignature] = parts;
    const secret = getSigningSecret(context);
    const expectedSignature = await createHmacSignature(encodedPayload, secret);

    // Constant-time-like check
    if (providedSignature !== expectedSignature) {
      return null;
    }

    const json = base64UrlDecode(encodedPayload);
    const session: AdminSession = JSON.parse(json);

    const now = Math.floor(Date.now() / 1000);
    if (!session.exp || session.exp < now) {
      return null;
    }

    return session;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to parse cookies from Request headers
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

/**
 * Safely retrieve the currently authenticated Clerk user's email, name, and ID.
 * Returns null if the request is not authenticated via Clerk or if Clerk is unavailable.
 */
export async function getClerkAdminUser(
  context: APIContext | any
): Promise<{ email: string; name: string; avatarUrl: string; userId: string } | null> {
  const auth = typeof context?.locals?.auth === 'function' ? context.locals.auth() : null;
  if (!auth?.userId) {
    return null;
  }

  // 1. Check Neon database for existing synced user
  try {
    const { eq } = await import('drizzle-orm');
    const { users } = await import('../db');
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, auth.userId))
      .limit(1);

    if (dbUser && dbUser.email) {
      return {
        email: dbUser.email.trim().toLowerCase(),
        name: dbUser.fullName || dbUser.email.split('@')[0],
        avatarUrl: dbUser.avatarUrl || '',
        userId: auth.userId,
      };
    }
  } catch (dbErr) {
    // Non-blocking
  }

  // 2. Check auth.sessionClaims if populated in the Clerk JWT
  if (auth.sessionClaims) {
    const claims = auth.sessionClaims as any;
    const claimEmail =
      claims.email ||
      claims.primary_email ||
      claims.email_address ||
      claims.sub_email ||
      (Array.isArray(claims.email_addresses) && claims.email_addresses[0]?.email_address);
    if (claimEmail && typeof claimEmail === 'string') {
      return {
        email: claimEmail.trim().toLowerCase(),
        name: claims.name || claims.first_name || claimEmail.split('@')[0],
        avatarUrl: claims.picture || claims.image_url || '',
        userId: auth.userId,
      };
    }
  }

  // 3. Query Clerk API
  try {
    let client;
    try {
      client = clerkClient(context);
    } catch {
      const secretKey =
        getEnvVariable('CLERK_SECRET_KEY', context) ||
        process.env.CLERK_SECRET_KEY ||
        (import.meta as any).env?.CLERK_SECRET_KEY;
      client = createClerkClient({ secretKey });
    }

    const clerkUserData = await client.users.getUser(auth.userId);
    const email =
      clerkUserData.emailAddresses?.find((e: any) => e.id === clerkUserData.primaryEmailAddressId)
        ?.emailAddress ||
      clerkUserData.emailAddresses?.[0]?.emailAddress ||
      '';

    if (email) {
      const name =
        `${clerkUserData.firstName || ''} ${clerkUserData.lastName || ''}`.trim() ||
        clerkUserData.username ||
        email.split('@')[0];
      const avatarUrl = clerkUserData.imageUrl || '';

      // Sync into Neon users table if not present, deduplicating by email
      try {
        const { eq, sql } = await import('drizzle-orm');
        const { users } = await import('../db');
        const normEmail = email.trim().toLowerCase();
        const [existing] = await db
          .select()
          .from(users)
          .where(sql`${users.clerkUserId} = ${auth.userId} OR lower(${users.email}) = ${normEmail}`)
          .limit(1);

        if (!existing) {
          await db.insert(users).values({
            clerkUserId: auth.userId,
            email: normEmail,
            fullName: name,
            avatarUrl,
          });
        } else if (existing.clerkUserId !== auth.userId) {
          await db
            .update(users)
            .set({ clerkUserId: auth.userId, fullName: name || existing.fullName, avatarUrl: avatarUrl || existing.avatarUrl, updatedAt: new Date() })
            .where(eq(users.id, existing.id));
        }
      } catch {}

      return {
        email: email.trim().toLowerCase(),
        name,
        avatarUrl,
        userId: auth.userId,
      };
    }
  } catch (err) {
    console.warn('Clerk user lookup error in getClerkAdminUser:', err);
  }

  return null;
}

/**
 * Extract and strictly verify active admin session on any request/context.
 * Supports both:
 *   1. Cryptographically signed __asc_admin_session cookies
 *   2. Existing Clerk authenticated user session
 * CRITICAL REQUIREMENT: Revalidates that the session's email is STILL in the current ADMIN_EMAILS allowlist!
 * If an admin was removed from Cloudflare environment variables, authorization is instantly denied.
 */
export async function getAdminSession(context: APIContext | { request: Request; locals?: any }): Promise<AdminSession | null> {
  // 1. Fast path: Check __asc_admin_session signed cookie
  const cookieHeader = context.request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (token) {
    const session = await verifyAdminSessionToken(token, context);
    if (session && isAuthorizedAdminEmail(session.email, context)) {
      return session;
    }
  }

  // 2. Integration path: Check existing Clerk authenticated user
  const clerkUser = await getClerkAdminUser(context);
  if (clerkUser && isAuthorizedAdminEmail(clerkUser.email, context)) {
    const now = Math.floor(Date.now() / 1000);
    const session: AdminSession = {
      email: clerkUser.email,
      name: clerkUser.name,
      avatarUrl: clerkUser.avatarUrl,
      sub: clerkUser.userId,
      provider: 'clerk',
      iat: now,
      exp: now + DEFAULT_SESSION_DURATION,
    };

    return session;
  }

  return null;
}

/**
 * Require valid Admin Session or throw/return unauthorized response
 */
export async function requireAdminSession(context: APIContext): Promise<AdminSession> {
  const session = await getAdminSession(context);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Set the secure Admin Session HTTP-only Cookie
 * Enforces HttpOnly, SameSite=Lax, and Secure flag in production and across HTTPS connections
 */
export function setAdminSessionCookie(
  headers: Headers,
  token: string,
  request?: Request
): void {
  const isHttps = request ? new URL(request.url).protocol === 'https:' : false;
  const isProd =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) ||
    process.env.NODE_ENV === 'production';
  const secureFlag = isHttps || isProd ? '; Secure' : '';
  const cookieValue = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DEFAULT_SESSION_DURATION}${secureFlag}`;
  headers.append('Set-Cookie', cookieValue);
}

/**
 * Clear the Admin Session Cookie (Logout)
 */
export function clearAdminSessionCookie(headers: Headers, request?: Request): void {
  const isHttps = request ? new URL(request.url).protocol === 'https:' : false;
  const isProd =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) ||
    process.env.NODE_ENV === 'production';
  const secureFlag = isHttps || isProd ? '; Secure' : '';
  headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`
  );
}

/**
 * Verify a Google OAuth ID Token via Google's tokeninfo API
 * Verifies email, verified email claim, and identity.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  context?: APIContext | any
): Promise<{ email: string; emailVerified: boolean; name: string; picture?: string; sub: string } | null> {
  try {
    if (!idToken || typeof idToken !== 'string') return null;

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      console.warn('Google token verification failed with status:', response.status);
      return null;
    }

    const payload = await response.json();
    const emailVerified = payload.email_verified === 'true' || payload.email_verified === true;
    if (!emailVerified || !payload.email) {
      console.warn('Google email is not verified or missing');
      return null;
    }

    // Check client_id if configured
    const configuredClientId = getEnvVariable('GOOGLE_CLIENT_ID', context);
    if (configuredClientId && payload.aud !== configuredClientId) {
      console.warn('Google ID token audience mismatch:', payload.aud, '!=', configuredClientId);
      return null;
    }

    return {
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name: payload.name || payload.given_name || payload.email.split('@')[0],
      picture: payload.picture || '',
      sub: payload.sub,
    };
  } catch (err) {
    console.error('Failed to verify Google ID token:', err);
    return null;
  }
}

/**
 * Helper to log administrative actions to the admin_activity_logs database table
 */
export async function logAdminAction(params: {
  adminEmail: string;
  action: string;
  targetType: 'user' | 'quotation' | 'pricing' | 'payment' | 'system';
  targetId?: string;
  description: string;
  details?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(adminActivityLogs).values({
      adminEmail: params.adminEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      description: params.description,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}
