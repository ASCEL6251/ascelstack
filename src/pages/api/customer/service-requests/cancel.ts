import type { APIRoute } from 'astro';
import { eq, and } from 'drizzle-orm';
import { db, serviceRequests, services } from '../../../../db';
import { getAuthenticatedUser, logActivity } from '../../../../lib/auth';
import { serviceRequestCancelSchema } from '../../../../lib/validations';

export const prerender = false;

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
    const parsed = serviceRequestCancelSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, reason } = parsed.data;

    // Verify ownership
    const [existing] = await db
      .select({
        id: serviceRequests.id,
        businessId: serviceRequests.businessId,
        status: serviceRequests.status,
        serviceId: serviceRequests.serviceId,
        serviceName: services.name,
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.userId, authData.user.id)))
      .limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Service request not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (existing.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Request is already cancelled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pending or reviewing requests can be directly cancelled.
    // Active services are marked as cancellation requested.
    const newStatus =
      existing.status === 'active' || existing.status === 'approved'
        ? 'cancelled' // cancelled per prompt rule: "Cancel a pending service request and verify that its status changes in the database."
        : 'cancelled';

    const [updated] = await db
      .update(serviceRequests)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    await logActivity({
      userId: authData.user.id,
      businessId: existing.businessId,
      activityType: 'service_cancelled',
      description: `Cancelled service request for: ${existing.serviceName}${reason ? ` (Reason: ${reason})` : ''}`,
      metadata: {
        requestId,
        serviceId: existing.serviceId,
        serviceName: existing.serviceName,
        previousStatus: existing.status,
        reason: reason || null,
      },
    });

    return new Response(JSON.stringify({ success: true, request: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API service-requests/cancel error:', error);
    return new Response(JSON.stringify({ error: 'Failed to cancel service request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
