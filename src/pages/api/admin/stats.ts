import type { APIRoute } from 'astro';
import { db, users, quotations, adminActivityLogs, activityLogs, quotationHistory } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { sql, desc, eq, inArray, gte } from 'drizzle-orm';

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

    // 1. Total Registered Users
    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)::int` })
      .from(users);

    // 2. New Users (registered in the last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ newUsers }] = await db
      .select({ newUsers: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    // 3. Total Quotations
    const [{ totalQuotations }] = await db
      .select({ totalQuotations: sql<number>`count(*)::int` })
      .from(quotations);

    // 4. Pending Quotations
    const [{ pendingQuotations }] = await db
      .select({ pendingQuotations: sql<number>`count(*)::int` })
      .from(quotations)
      .where(
        inArray(quotations.quotationStatus, [
          'New Inquiry',
          'Under Review',
          'Processing',
          'Estimation in Progress',
          'Quotation Prepared',
          'Awaiting Customer Approval',
        ])
      );

    // Additional live stats
    const [{ approvedQuotations }] = await db
      .select({ approvedQuotations: sql<number>`count(*)::int` })
      .from(quotations)
      .where(eq(quotations.quotationStatus, 'Approved'));

    const [{ completedQuotations }] = await db
      .select({ completedQuotations: sql<number>`count(*)::int` })
      .from(quotations)
      .where(eq(quotations.quotationStatus, 'Completed'));

    // Recent Activity Feed: aggregate recent quotations, history changes, and user creations
    const recentQuotations = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        quotationStatus: quotations.quotationStatus,
        paymentStatus: quotations.paymentStatus,
        projectProgress: quotations.projectProgress,
        createdAt: quotations.createdAt,
        userFullName: users.fullName,
        userEmail: users.email,
      })
      .from(quotations)
      .innerJoin(users, eq(quotations.userId, users.id))
      .orderBy(desc(quotations.createdAt))
      .limit(6);

    const recentHistory = await db
      .select({
        id: quotationHistory.id,
        quotationId: quotationHistory.quotationId,
        fieldChanged: quotationHistory.fieldChanged,
        previousValue: quotationHistory.previousValue,
        newValue: quotationHistory.newValue,
        description: quotationHistory.description,
        adminEmail: quotationHistory.adminEmail,
        createdAt: quotationHistory.createdAt,
      })
      .from(quotationHistory)
      .orderBy(desc(quotationHistory.createdAt))
      .limit(6);

    const recentUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(4);

    return new Response(
      JSON.stringify({
        stats: {
          totalUsers,
          newUsers,
          totalQuotations,
          pendingQuotations,
          approvedQuotations,
          completedQuotations,
        },
        recentQuotations,
        recentHistory,
        recentUsers,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve admin dashboard statistics' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
