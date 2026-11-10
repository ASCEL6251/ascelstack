import type { APIRoute } from 'astro';
import { db, users, quotations, activityLogs } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { sql, desc, asc, ilike, or, eq } from 'drizzle-orm';

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
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;

    // Build query with aggregated quotation count
    const whereConditions = search
      ? or(
          ilike(users.fullName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.clerkUserId, `%${search}%`),
          sql`${users.id}::text ILIKE ${'%' + search + '%'}`
        )
      : undefined;

    // Get total matching users count
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(users)
      .where(whereConditions);

    // Get users with quotation counts and last activity
    const userList = await db
      .select({
        id: users.id,
        clerkUserId: users.clerkUserId,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        quotationCount: sql<number>`(SELECT count(*)::int FROM quotations WHERE quotations.user_id = users.id)`,
        lastActivityAt: sql<string | null>`(SELECT max(created_at) FROM activity_logs WHERE activity_logs.user_id = users.id)`,
      })
      .from(users)
      .where(whereConditions)
      .orderBy(
        sortOrder === 'asc'
          ? sortBy === 'fullName'
            ? asc(users.fullName)
            : sortBy === 'email'
            ? asc(users.email)
            : asc(users.createdAt)
          : sortBy === 'fullName'
          ? desc(users.fullName)
          : sortBy === 'email'
          ? desc(users.email)
          : desc(users.createdAt)
      )
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({
        users: userList,
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
    console.error('API /api/admin/users error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve users' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
