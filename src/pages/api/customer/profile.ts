import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, users } from '../../../db';
import { getAuthenticatedUser, logActivity } from '../../../lib/auth';
import { profileUpdateSchema } from '../../../lib/validations';

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

    return new Response(
      JSON.stringify({
        user: authData.user,
        business: authData.business,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API profile GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authData.user.id))
      .returning();

    await logActivity({
      userId: authData.user.id,
      businessId: authData.business?.id,
      activityType: 'profile_updated',
      description: 'Customer profile updated',
      metadata: { fullName: parsed.data.fullName },
    });

    return new Response(JSON.stringify({ success: true, user: updatedUser }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API profile POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
