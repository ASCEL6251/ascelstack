import type { APIRoute } from 'astro';
import { eq, or, and, inArray } from 'drizzle-orm';
import { db, serviceRequests, services, businesses } from '../../../db';
import { getAuthenticatedUser, logActivity } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in to submit your estimate.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const { cart, note } = body;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve or auto-create business profile for this user in Neon
    let businessId = authData.business?.id;
    if (!businessId) {
      const [existingBiz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, authData.user.id))
        .limit(1);

      if (existingBiz) {
        businessId = existingBiz.id;
      } else {
        const [newBiz] = await db
          .insert(businesses)
          .values({
            ownerUserId: authData.user.id,
            businessName: `${authData.user.fullName || 'My'} Business`,
            email: authData.user.email,
          })
          .returning();
        businessId = newBiz.id;
      }
    }

    const createdRequests = [];

    for (const item of cart.items) {
      // Find service in catalogue by code (e.g. ASC-0001) or slug
      const [service] = await db
        .select()
        .from(services)
        .where(or(eq(services.code, item.id), eq(services.slug, item.id)))
        .limit(1);

      if (!service) continue;

      const reqDetails = [
        item.pkg ? `Package: ${item.pkg}` : null,
        item.qty && item.qty > 1 ? `Quantity: ${item.qty}` : null,
        cart.size ? `Scale: ${cart.size === 'mid' ? 'Mid-market' : 'Small business'}` : null,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      // Check for existing pending or active request for this service & business
      const [existingReq] = await db
        .select()
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.businessId, businessId),
            eq(serviceRequests.serviceId, service.id),
            inArray(serviceRequests.status, ['pending', 'reviewing', 'active'])
          )
        )
        .limit(1);

      if (existingReq) {
        // Update requirements with latest estimate note
        const [updated] = await db
          .update(serviceRequests)
          .set({
            requirements: reqDetails,
            updatedAt: new Date(),
          })
          .where(eq(serviceRequests.id, existingReq.id))
          .returning();
        createdRequests.push({ ...updated, service });
      } else {
        // Create new pending service request
        const [newReq] = await db
          .insert(serviceRequests)
          .values({
            businessId,
            userId: authData.user.id,
            serviceId: service.id,
            requirements: reqDetails,
            status: 'pending',
          })
          .returning();
        createdRequests.push({ ...newReq, service });
      }
    }

    const estimateId = `EST-${Date.now().toString(36).toUpperCase()}`;

    // Log the event to Neon activityLogs
    await logActivity({
      userId: authData.user.id,
      businessId,
      activityType: 'estimate_submitted',
      description: `Submitted estimate for ${createdRequests.length} service(s)`,
      metadata: {
        estimateId,
        serviceCodes: cart.items.map((i: any) => i.id),
        servicesCount: createdRequests.length,
        note: note || undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        estimateId,
        count: createdRequests.length,
        requests: createdRequests,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API estimate submission error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to submit estimate' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
