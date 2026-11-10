import type { APIRoute } from 'astro';
import { db, quotations, users, businesses } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { sql, desc, asc, ilike, or, eq, and } from 'drizzle-orm';

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
    const search = url.searchParams.get('q')?.trim() || '';
    const statusFilter = url.searchParams.get('status')?.trim() || '';
    const paymentFilter = url.searchParams.get('payment')?.trim() || '';
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(quotations.quotationNumber, `%${search}%`),
          ilike(quotations.projectTitle, `%${search}%`),
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          sql`${quotations.id}::text ILIKE ${'%' + search + '%'}`
        )
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(quotations.quotationStatus, statusFilter));
    }

    if (paymentFilter && paymentFilter !== 'all') {
      conditions.push(eq(quotations.paymentStatus, paymentFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(quotations)
      .innerJoin(users, eq(quotations.userId, users.id))
      .where(whereClause);

    // List query
    const items = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        quotationStatus: quotations.quotationStatus,
        paymentStatus: quotations.paymentStatus,
        paymentVerified: quotations.paymentVerified,
        projectProgress: quotations.projectProgress,
        currency: quotations.currency,
        initialEstimatedCost: quotations.initialEstimatedCost,
        finalQuotationAmount: quotations.finalQuotationAmount,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        customer: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
        business: {
          id: businesses.id,
          businessName: businesses.businessName,
        },
      })
      .from(quotations)
      .innerJoin(users, eq(quotations.userId, users.id))
      .leftJoin(businesses, eq(quotations.businessId, businesses.id))
      .where(whereClause)
      .orderBy(
        sortOrder === 'asc'
          ? sortBy === 'progress'
            ? asc(quotations.projectProgress)
            : sortBy === 'amount'
            ? asc(quotations.finalQuotationAmount)
            : sortBy === 'title'
            ? asc(quotations.projectTitle)
            : asc(quotations.createdAt)
          : sortBy === 'progress'
          ? desc(quotations.projectProgress)
          : sortBy === 'amount'
          ? desc(quotations.finalQuotationAmount)
          : sortBy === 'title'
          ? desc(quotations.projectTitle)
          : desc(quotations.createdAt)
      )
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        quotations: items,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/quotations error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve quotations' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
