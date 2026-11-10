import type { APIRoute } from 'astro';
import { eq, desc } from 'drizzle-orm';
import { db, serviceRequests, services, businesses, activityLogs, quotations } from '../../../db';
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

    const [userBusinesses, requests, customerQuotations, activities] = await Promise.all([
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
          quotationId: serviceRequests.quotationId,
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
          quotation: {
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
            quotationStatus: quotations.quotationStatus,
            paymentStatus: quotations.paymentStatus,
            paymentVerified: quotations.paymentVerified,
            projectProgress: quotations.projectProgress,
            finalQuotationAmount: quotations.finalQuotationAmount,
            initialEstimatedCost: quotations.initialEstimatedCost,
            currency: quotations.currency,
            customerNotes: quotations.customerNotes,
            updatedAt: quotations.updatedAt,
          },
        })
        .from(serviceRequests)
        .innerJoin(services, eq(serviceRequests.serviceId, services.id))
        .innerJoin(businesses, eq(serviceRequests.businessId, businesses.id))
        .leftJoin(quotations, eq(serviceRequests.quotationId, quotations.id))
        .where(eq(serviceRequests.userId, authData.user.id))
        .orderBy(desc(serviceRequests.requestedAt)),

      db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          projectTitle: quotations.projectTitle,
          projectDescription: quotations.projectDescription,
          requirements: quotations.requirements,
          quotationStatus: quotations.quotationStatus,
          paymentStatus: quotations.paymentStatus,
          paymentVerified: quotations.paymentVerified,
          projectProgress: quotations.projectProgress,
          currency: quotations.currency,
          initialEstimatedCost: quotations.initialEstimatedCost,
          finalQuotationAmount: quotations.finalQuotationAmount,
          customerNotes: quotations.customerNotes,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
        })
        .from(quotations)
        .where(eq(quotations.userId, authData.user.id))
        .orderBy(desc(quotations.createdAt)),

      db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.userId, authData.user.id))
        .orderBy(desc(activityLogs.createdAt))
        .limit(20),
    ]);

    // Accurate calculation taking into account both direct service requests and linked quotation statuses
    const isActive = (r: any) =>
      r.status === 'active' ||
      (r.quotation && (
        ['Approved', 'Processing', 'Estimation in Progress', 'Quotation Prepared', 'Quotation Sent', 'Awaiting Customer Approval'].includes(r.quotation.quotationStatus) ||
        ['Payment Completed', 'Partially Paid'].includes(r.quotation.paymentStatus) ||
        (r.quotation.projectProgress > 0 && r.quotation.projectProgress < 100)
      ));

    const isCompleted = (r: any) =>
      r.status === 'completed' ||
      (r.quotation && (r.quotation.quotationStatus === 'Completed' || r.quotation.projectProgress === 100));

    const isPending = (r: any) =>
      !isCompleted(r) && !isActive(r) && r.status !== 'cancelled';

    const activeCount = requests.filter(isActive).length;
    const completedCount = requests.filter(isCompleted).length;
    const pendingCount = requests.filter(isPending).length;
    const totalCount = requests.length;

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        business: userBusinesses[0] || null,
        businesses: userBusinesses,
        requests,
        quotations: customerQuotations,
        activities,
        role: authData.role,
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
          'Cache-Control': 'no-store, no-cache, must-revalidate',
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
