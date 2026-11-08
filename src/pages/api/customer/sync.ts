import type { APIRoute } from 'astro';
import { eq, desc } from 'drizzle-orm';
import { db, serviceRequests, services, businesses, activityLogs } from '../../../db';
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

    const [userBusinesses, requests, activities] = await Promise.all([
      db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, authData.user.id))
        .orderBy(desc(businesses.updatedAt)),

      db
        .select({
          id: serviceRequests.id,
          businessId: serviceRequests.businessId,
          userId: serviceRequests.userId,
          serviceId: serviceRequests.serviceId,
          requirements: serviceRequests.requirements,
          status: serviceRequests.status,
          requestedAt: serviceRequests.requestedAt,
          updatedAt: serviceRequests.updatedAt,
          service: {
            id: services.id,
            code: services.code,
            name: services.name,
            slug: services.slug,
            description: services.description,
            layer: services.layer,
            discipline: services.discipline,
            availabilityStatus: services.availabilityStatus,
          },
          business: {
            id: businesses.id,
            businessName: businesses.businessName,
          },
        })
        .from(serviceRequests)
        .innerJoin(services, eq(serviceRequests.serviceId, services.id))
        .innerJoin(businesses, eq(serviceRequests.businessId, businesses.id))
        .where(eq(serviceRequests.userId, authData.user.id))
        .orderBy(desc(serviceRequests.requestedAt)),

      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, authData.user.id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(15),
    ]);

    const activeCount = requests.filter((r) => r.status === 'active').length;
    const pendingCount = requests.filter((r) => ['pending', 'reviewing'].includes(r.status)).length;
    const completedCount = requests.filter((r) => r.status === 'completed').length;
    const totalCount = requests.length;

    return new Response(
      JSON.stringify({
        user: authData.user,
        business: userBusinesses[0] || null,
        businesses: userBusinesses,
        requests,
        activities,
        stats: {
          total: totalCount,
          active: activeCount,
          pending: pendingCount,
          completed: completedCount,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('API sync error:', error);
    return new Response(JSON.stringify({ error: 'Failed to synchronize data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
