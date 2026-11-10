import type { APIRoute } from 'astro';
import {
  verifyGoogleIdToken,
  isAuthorizedAdminEmail,
  createAdminSessionToken,
  setAdminSessionCookie,
  logAdminAction,
  getAuthorizedAdminEmails,
  getEnvVariable,
} from '../../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({}));
    const { idToken, credential } = body;
    const tokenToVerify = credential || idToken;

    // Check allowlist configuration
    const allowedEmails = getAuthorizedAdminEmails(context);
    if (allowedEmails.length === 0) {
      console.error('ADMIN_EMAILS environment variable is not configured or contains no valid emails.');
      return new Response(
        JSON.stringify({
          error: 'Administrator access is not configured. Please configure ADMIN_EMAILS in Cloudflare environment variables.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let verifiedUser: { email: string; emailVerified: boolean; name: string; picture?: string; sub: string } | null = null;

    // 1. If Google ID Token is provided, verify it directly with Google API
    if (tokenToVerify && typeof tokenToVerify === 'string') {
      verifiedUser = await verifyGoogleIdToken(tokenToVerify, context);
    }

    // 2. Also support Clerk-authenticated Google session if admin signs in via existing Clerk Google OAuth flow
    if (!verifiedUser) {
      const auth = context.locals?.auth?.();
      if (auth?.isAuthenticated && auth?.userId) {
        try {
          // Fetch Clerk user details to verify email
          const secretKey = getEnvVariable('CLERK_SECRET_KEY', context);
          const clerkRes = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          });
          if (clerkRes.ok) {
            const clerkUser = await clerkRes.json();
            // Verify user has a verified email address from Google or verified provider
            const primaryEmailObj = clerkUser.email_addresses?.find(
              (e: any) => e.id === clerkUser.primary_email_address_id
            ) || clerkUser.email_addresses?.[0];

            if (primaryEmailObj && primaryEmailObj.verification?.status === 'verified') {
              verifiedUser = {
                email: primaryEmailObj.email_address,
                emailVerified: true,
                name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() || primaryEmailObj.email_address.split('@')[0],
                picture: clerkUser.image_url || '',
                sub: auth.userId,
              };
            }
          }
        } catch (e) {
          console.warn('Clerk Google session check failed:', e);
        }
      }
    }

    // 3. In local development only, if mock token is passed for testing with authorized email
    // Strictly disabled in production builds (import.meta.env.DEV === true)
    const isDev = import.meta.env.DEV === true;
    if (!verifiedUser && isDev && body.devEmail) {
      const devEmail = String(body.devEmail).trim().toLowerCase();
      if (isAuthorizedAdminEmail(devEmail, context)) {
        verifiedUser = {
          email: devEmail,
          emailVerified: true,
          name: devEmail.split('@')[0].toUpperCase() + ' (Admin)',
          picture: '',
          sub: 'dev_admin_' + devEmail.replace(/[^a-z0-9]/g, '_'),
        };
      }
    }

    if (!verifiedUser || !verifiedUser.emailVerified) {
      return new Response(
        JSON.stringify({
          error: 'Google authentication failed or email could not be verified. Please sign in with a valid Google account.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Server-Side Allowlist Enforcement against ADMIN_EMAILS
    const isAuthorized = isAuthorizedAdminEmail(verifiedUser.email, context);
    if (!isAuthorized) {
      console.warn(`Unauthorized administrator login attempt by: ${verifiedUser.email}`);
      return new Response(
        JSON.stringify({
          error: `Access Denied: The Google account "${verifiedUser.email}" is not authorized for administrator access. Please contact the site owner to add your email to the Cloudflare ADMIN_EMAILS allowlist.`,
          email: verifiedUser.email,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Create cryptographically signed Admin Session Token
    const sessionToken = await createAdminSessionToken(
      {
        email: verifiedUser.email,
        name: verifiedUser.name,
        avatarUrl: verifiedUser.picture,
        sub: verifiedUser.sub,
        provider: 'google',
      },
      context
    );

    // 6. Set HTTP-only, secure session cookie
    const headers = new Headers({ 'Content-Type': 'application/json' });
    setAdminSessionCookie(headers, sessionToken, context.request);

    // 7. Audit log the admin login
    const clientIp = context.request.headers.get('x-forwarded-for') || context.request.headers.get('cf-connecting-ip') || '127.0.0.1';
    await logAdminAction({
      adminEmail: verifiedUser.email,
      action: 'admin_login',
      targetType: 'system',
      description: `Administrator signed in via Google OAuth (${verifiedUser.email})`,
      details: { clientIp, userAgent: context.request.headers.get('user-agent') },
      ipAddress: clientIp,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Administrator authenticated successfully',
        admin: {
          email: verifiedUser.email,
          name: verifiedUser.name,
          avatarUrl: verifiedUser.picture,
        },
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('API /api/admin/auth/google error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal authentication error. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
