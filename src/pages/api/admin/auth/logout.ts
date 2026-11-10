import type { APIRoute } from 'astro';
import { clearAdminSessionCookie, getAdminSession, logAdminAction } from '../../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getAdminSession(context);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  clearAdminSessionCookie(headers);

  if (session) {
    await logAdminAction({
      adminEmail: session.email,
      action: 'admin_logout',
      targetType: 'system',
      description: `Administrator signed out (${session.email})`,
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Logged out successfully' }),
    { status: 200, headers }
  );
};

export const GET: APIRoute = async (context) => {
  return POST(context);
};
