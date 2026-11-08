import type { APIRoute } from 'astro';
import { eq, desc } from 'drizzle-orm';
import { db, activityLogs } from '../../../db';
import { getAuthenticatedUser } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, authData.user.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50);

    return new Response(JSON.stringify({ activities: logs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API activity GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activity logs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
