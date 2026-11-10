import type { APIRoute } from 'astro';
import { db, users, businesses, quotations, activityLogs } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { eq, desc, sql } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = context.params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch user by id or clerkUserId
    const [user] = await db
      .select()
      .from(users)
      .where(sql`${users.id}::text = ${userId} OR ${users.clerkUserId} = ${userId}`)
      .limit(1);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch user's registered businesses
    const userBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, user.id))
      .orderBy(desc(businesses.updatedAt));

    // 3. Fetch user's quotation history (strictly isolated by user.id)
    const userQuotations = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        projectDescription: quotations.projectDescription,
        requirements: quotations.requirements,
        quotationStatus: quotations.quotationStatus,
        paymentStatus: quotations.paymentStatus,
        paymentVerified: quotations.paymentVerified,
        projectProgress: quotations.projectProgress,
        currency: quotations.currency,
        initialEstimatedCost: quotations.initialEstimatedCost,
        finalQuotationAmount: quotations.finalQuotationAmount,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
      })
      .from(quotations)
      .where(eq(quotations.userId, user.id))
      .orderBy(desc(quotations.createdAt));

    // 4. Fetch user's activity logs
    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, user.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(30);

    return new Response(
      JSON.stringify({
        user,
        businesses: userBusinesses,
        quotations: userQuotations,
        activityLogs: logs,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/users/[id] error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve user details' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
