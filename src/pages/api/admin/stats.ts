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

    const [{ paidQuotations }] = await db
      .select({ paidQuotations: sql<number>`count(*)::int` })
      .from(quotations)
      .where(eq(quotations.paymentStatus, 'Payment Completed'));

    const [{ partiallyPaidQuotations }] = await db
      .select({ partiallyPaidQuotations: sql<number>`count(*)::int` })
      .from(quotations)
      .where(eq(quotations.paymentStatus, 'Partially Paid'));

    const [{ newInquiriesCount }] = await db
      .select({ newInquiriesCount: sql<number>`count(*)::int` })
      .from(quotations)
      .where(eq(quotations.quotationStatus, 'New Inquiry'));

    const [{ totalRevenue, pipelineValue }] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${quotations.paymentStatus} = 'Payment Completed' THEN ${quotations.finalQuotationAmount}::numeric ELSE 0 END), 0)::float`,
        pipelineValue: sql<number>`COALESCE(SUM(COALESCE(${quotations.finalQuotationAmount}::numeric, ${quotations.initialEstimatedCost}::numeric, 0)), 0)::float`,
      })
      .from(quotations);

    // Recent Activity Feed: ordered by latest update/created time so status changes appear at the top in real time!
    const recentQuotations = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        quotationStatus: quotations.quotationStatus,
        paymentStatus: quotations.paymentStatus,
        projectProgress: quotations.projectProgress,
        finalQuotationAmount: quotations.finalQuotationAmount,
        currency: quotations.currency,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        userFullName: users.fullName,
        userEmail: users.email,
      })
      .from(quotations)
      .innerJoin(users, eq(quotations.userId, users.id))
      .orderBy(desc(sql`COALESCE(${quotations.updatedAt}, ${quotations.createdAt})`))
      .limit(8);

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
          paidQuotations,
          partiallyPaidQuotations,
          newInquiriesCount,
          totalRevenue,
          pipelineValue,
        },
        recentQuotations,
        recentHistory,
        recentUsers,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/admin/stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve admin dashboard statistics' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
