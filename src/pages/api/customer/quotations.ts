import type { APIRoute } from 'astro';
import { db, quotations, quotationHistory, serviceRequests, services } from '../../../db';
import { getAuthenticatedUser } from '../../../lib/auth';
import { eq, desc } from 'drizzle-orm';

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

    // Customer can only view their own quotations
    // Note: internalNotes is strictly excluded to protect administrative privacy!
    const userQuotations = await db
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
      .orderBy(desc(quotations.createdAt));

    return new Response(
      JSON.stringify({ quotations: userQuotations }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/customer/quotations error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve customer quotations' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
