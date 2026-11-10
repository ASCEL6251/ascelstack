import type { APIRoute } from 'astro';
import { getAdminSession, getAuthorizedAdminEmails } from '../../../../lib/admin-auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        admin: {
          email: session.email,
          name: session.name,
          avatarUrl: session.avatarUrl,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ authenticated: false, error: 'Session check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
