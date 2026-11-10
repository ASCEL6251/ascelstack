import type { APIRoute } from 'astro';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { db, serviceRequests, services, businesses, quotations } from '../../../db';
import { getAuthenticatedUser, logActivity } from '../../../lib/auth';
import { serviceRequestCreateSchema, serviceRequestUpdateSchema } from '../../../lib/validations';

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

    // Fetch all requests owned by this customer
    const requests = await db
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
          industry: businesses.industry,
        },
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .innerJoin(businesses, eq(serviceRequests.businessId, businesses.id))
      .where(eq(serviceRequests.userId, authData.user.id))
      .orderBy(desc(serviceRequests.requestedAt));

    return new Response(JSON.stringify({ requests }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API service-requests GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch service requests' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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
    const parsed = serviceRequestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { serviceId, requirements } = parsed.data;
    let businessId = parsed.data.businessId;

    // Verify service exists (by UUID, code, or slug)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
    const [service] = await db
      .select()
      .from(services)
      .where(isUuid ? eq(services.id, serviceId) : or(eq(services.code, serviceId), eq(services.slug, serviceId)))
      .limit(1);

    if (!service) {
      return new Response(JSON.stringify({ error: 'Service not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve or verify business
    if (businessId) {
      const [biz] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, businessId), eq(businesses.ownerUserId, authData.user.id)))
        .limit(1);

      if (!biz) {
        return new Response(JSON.stringify({ error: 'Invalid business selected' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else if (authData.business) {
      businessId = authData.business.id;
    } else {
      // Auto-create initial default business for customer if none exists yet
      const [newBiz] = await db
        .insert(businesses)
        .values({
          ownerUserId: authData.user.id,
          businessName: `${authData.user.fullName || 'My'} Enterprise`,
          email: authData.user.email,
        })
        .returning();
      businessId = newBiz.id;
    }

    // Rule: Prevent duplicate active or pending requests for the same service and business.
    const [existingRequest] = await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.businessId, businessId),
          eq(serviceRequests.serviceId, service.id),
          inArray(serviceRequests.status, ['pending', 'reviewing', 'approved', 'active'])
        )
      )
      .limit(1);

    if (existingRequest) {
      return new Response(
        JSON.stringify({
          error: `You already have an active or ${existingRequest.status} request for "${service.name}".`,
          existingRequestId: existingRequest.id,
          status: existingRequest.status,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create quotation entry for inquiry tracking
    const qCountResult = await db.select({ count: sql<number>`count(*)::int` }).from(quotations);
    const nextQNum = `QUO-${new Date().getFullYear()}-${String((qCountResult[0]?.count || 0) + 1).padStart(4, '0')}`;
    
    const [newQuotation] = await db
      .insert(quotations)
      .values({
        quotationNumber: nextQNum,
        userId: authData.user.id,
        businessId,
        projectTitle: service.name,
        projectDescription: service.description,
        requirements: requirements || null,
        quotationStatus: 'New Inquiry',
        paymentStatus: 'Not Required',
        projectProgress: 0,
        initialEstimatedCost: '25000.00',
        finalQuotationAmount: '25000.00',
      })
      .returning();

    // Insert new request with initial status 'pending' and link to quotation
    const [newRequest] = await db
      .insert(serviceRequests)
      .values({
        businessId,
        userId: authData.user.id,
        serviceId: service.id,
        quotationId: newQuotation.id,
        requirements: requirements || null,
        status: 'pending',
      })
      .returning();

    await logActivity({
      userId: authData.user.id,
      businessId,
      activityType: 'service_requested',
      description: `Requested service: ${service.name} (${service.discipline})`,
      metadata: {
        requestId: newRequest.id,
        serviceId: service.id,
        serviceName: service.name,
        serviceCode: service.code,
        layer: service.layer,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        request: {
          ...newRequest,
          service,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API service-requests POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create service request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = serviceRequestUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { requestId, requirements } = parsed.data;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(serviceRequests)
      .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.userId, authData.user.id)))
      .limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Service request not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [updated] = await db
      .update(serviceRequests)
      .set({
        requirements,
        updatedAt: new Date(),
      })
      .where(eq(serviceRequests.id, requestId))
      .returning();

    await logActivity({
      userId: authData.user.id,
      businessId: existing.businessId,
      activityType: 'requirements_updated',
      description: 'Updated service requirements',
      metadata: { requestId },
    });

    return new Response(JSON.stringify({ success: true, request: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API service-requests PATCH error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update service request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
