import type { APIRoute } from 'astro';
import { eq, and, or } from 'drizzle-orm';
import { db, serviceRequests, services, quotations } from '../../../../db';
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

    // 1. Try to find service request by serviceRequests.id or linked quotationId
    const [existing] = await db
      .select({
        id: serviceRequests.id,
        businessId: serviceRequests.businessId,
        status: serviceRequests.status,
        serviceId: serviceRequests.serviceId,
        quotationId: serviceRequests.quotationId,
        serviceName: services.name,
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .where(
        and(
          or(eq(serviceRequests.id, requestId), eq(serviceRequests.quotationId, requestId)),
          eq(serviceRequests.userId, authData.user.id)
        )
      )
      .limit(1);

    if (existing) {
      // If already cancelled, ensure quotation is also cancelled and return success gracefully
      if (existing.status === 'cancelled') {
        if (existing.quotationId) {
          await db
            .update(quotations)
            .set({ quotationStatus: 'Cancelled', updatedAt: new Date() })
            .where(eq(quotations.id, existing.quotationId));
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Request is already cancelled', request: existing }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Mark request as cancelled in Neon DB
      const [updated] = await db
        .update(serviceRequests)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.id, existing.id))
        .returning();

      // Synchronize linked quotation status to Cancelled as well
      if (existing.quotationId) {
        await db
          .update(quotations)
          .set({
            quotationStatus: 'Cancelled',
            updatedAt: new Date(),
          })
          .where(eq(quotations.id, existing.quotationId));
      }

      await logActivity({
        userId: authData.user.id,
        businessId: existing.businessId,
        activityType: 'service_cancelled',
        description: `Cancelled service request for: ${existing.serviceName}${reason ? ` (Reason: ${reason})` : ''}`,
        metadata: {
          requestId: existing.id,
          quotationId: existing.quotationId,
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
    }

    // 2. If not found in service requests, check if requestId is a direct quotationId
    const [existingQuote] = await db
      .select()
      .from(quotations)
      .where(and(eq(quotations.id, requestId), eq(quotations.userId, authData.user.id)))
      .limit(1);

    if (!existingQuote) {
      return new Response(JSON.stringify({ error: 'Service request or quotation not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cancel the quotation
    const [updatedQuote] = await db
      .update(quotations)
      .set({
        quotationStatus: 'Cancelled',
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, existingQuote.id))
      .returning();

    // Cancel any linked service requests
    await db
      .update(serviceRequests)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.quotationId, existingQuote.id));

    await logActivity({
      userId: authData.user.id,
      businessId: existingQuote.businessId,
      activityType: 'quotation_cancelled',
      description: `Cancelled quotation ${existingQuote.quotationNumber} (${existingQuote.projectTitle})`,
      metadata: {
        quotationId: existingQuote.id,
        quotationNumber: existingQuote.quotationNumber,
        projectTitle: existingQuote.projectTitle,
      },
    });

    return new Response(JSON.stringify({ success: true, quotation: updatedQuote }), {
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
