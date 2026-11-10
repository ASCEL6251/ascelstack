import type { APIRoute } from 'astro';
import { db, quotations, users, businesses, quotationHistory, serviceRequests, services } from '../../../../db';
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

    const quotationId = context.params.id;
    if (!quotationId) {
      return new Response(JSON.stringify({ error: 'Quotation ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch quotation record
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(sql`${quotations.id}::text = ${quotationId} OR ${quotations.quotationNumber} = ${quotationId}`)
      .limit(1);

    if (!quotation) {
      return new Response(JSON.stringify({ error: 'Quotation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch associated customer
    const [customer] = await db
      .select({
        id: users.id,
        clerkUserId: users.clerkUserId,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, quotation.userId))
      .limit(1);

    // 3. Fetch associated business if present
    let business = null;
    if (quotation.businessId) {
      [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, quotation.businessId))
        .limit(1);
    }

    // 4. Fetch quotation history
    const history = await db
      .select()
      .from(quotationHistory)
      .where(eq(quotationHistory.quotationId, quotation.id))
      .orderBy(desc(quotationHistory.createdAt));

    // 5. Fetch linked service requests with service details
    const requests = await db
      .select({
        id: serviceRequests.id,
        serviceId: serviceRequests.serviceId,
        requirements: serviceRequests.requirements,
        status: serviceRequests.status,
        requestedAt: serviceRequests.requestedAt,
        service: {
          id: services.id,
          code: services.code,
          name: services.name,
          slug: services.slug,
          description: services.description,
          layer: services.layer,
          discipline: services.discipline,
        },
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .where(eq(serviceRequests.quotationId, quotation.id));

    return new Response(
      JSON.stringify({
        quotation,
        customer,
        business,
        history,
        serviceRequests: requests,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/quotations/[id] error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve quotation details' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
