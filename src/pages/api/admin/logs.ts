import type { APIRoute } from 'astro';
import { db, quotationHistory, adminActivityLogs, quotations, users } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { desc, eq, sql, and, or, ilike } from 'drizzle-orm';

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

    const url = new URL(context.request.url);
    const type = url.searchParams.get('type') || 'all'; // 'all' | 'quotation' | 'admin'
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    if (type === 'quotation') {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(quotationHistory);

      const items = await db
        .select({
          id: quotationHistory.id,
          quotationId: quotationHistory.quotationId,
          quotationNumber: quotations.quotationNumber,
          projectTitle: quotations.projectTitle,
          userId: quotationHistory.userId,
          userFullName: users.fullName,
          userEmail: users.email,
          adminEmail: quotationHistory.adminEmail,
          fieldChanged: quotationHistory.fieldChanged,
          previousValue: quotationHistory.previousValue,
          newValue: quotationHistory.newValue,
          description: quotationHistory.description,
          createdAt: quotationHistory.createdAt,
        })
        .from(quotationHistory)
        .leftJoin(quotations, eq(quotationHistory.quotationId, quotations.id))
        .leftJoin(users, eq(quotationHistory.userId, users.id))
        .orderBy(desc(quotationHistory.createdAt))
        .limit(limit)
        .offset(offset);

      return new Response(
        JSON.stringify({
          logs: items,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (type === 'admin') {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(adminActivityLogs);

      const items = await db
        .select()
        .from(adminActivityLogs)
        .orderBy(desc(adminActivityLogs.createdAt))
        .limit(limit)
        .offset(offset);

      return new Response(
        JSON.stringify({
          logs: items,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Default 'all': Return both quotation history and admin actions unified or combined
    const qHistory = await db
      .select({
        id: quotationHistory.id,
        logType: sql<string>`'quotation'`,
        quotationId: quotationHistory.quotationId,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        adminEmail: quotationHistory.adminEmail,
        action: quotationHistory.fieldChanged,
        description: quotationHistory.description,
        previousValue: quotationHistory.previousValue,
        newValue: quotationHistory.newValue,
        createdAt: quotationHistory.createdAt,
      })
      .from(quotationHistory)
      .leftJoin(quotations, eq(quotationHistory.quotationId, quotations.id))
      .orderBy(desc(quotationHistory.createdAt))
      .limit(limit);

    const aLogs = await db
      .select({
        id: adminActivityLogs.id,
        logType: sql<string>`'admin_action'`,
        quotationId: sql<string | null>`NULL`,
        quotationNumber: sql<string | null>`NULL`,
        projectTitle: sql<string | null>`NULL`,
        adminEmail: adminActivityLogs.adminEmail,
        action: adminActivityLogs.action,
        description: adminActivityLogs.description,
        previousValue: sql<string | null>`NULL`,
        newValue: sql<string | null>`NULL`,
        createdAt: adminActivityLogs.createdAt,
      })
      .from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.createdAt))
      .limit(limit);

    const combined = [...qHistory, ...aLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        logs: combined,
        pagination: { page, limit, total: combined.length, totalPages: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/logs error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve activity logs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
