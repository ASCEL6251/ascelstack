import type { APIRoute } from 'astro';
import { eq, or, desc } from 'drizzle-orm';
import { db, agreements } from '../../../db';
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

    const { user, business } = authData;

    // Find agreements matched by user.id, clientEmail, or business.id
    const userAgreements = await db
      .select({
        id: agreements.id,
        agreementNumber: agreements.agreementNumber,
        secureToken: agreements.secureToken,
        title: agreements.title,
        status: agreements.status,
        version: agreements.version,
        projectName: agreements.projectName,
        currency: agreements.currency,
        totalAmount: agreements.totalAmount,
        advanceAmount: agreements.advanceAmount,
        clientSignedAt: agreements.clientSignedAt,
        providerSignedAt: agreements.providerSignedAt,
        signedAt: agreements.signedAt,
        createdAt: agreements.createdAt,
      })
      .from(agreements)
      .where(
        or(
          eq(agreements.userId, user.id),
          eq(agreements.clientEmail, user.email),
          business ? eq(agreements.businessId, business.id) : undefined
        )
      )
      .orderBy(desc(agreements.createdAt));

    return new Response(
      JSON.stringify({ agreements: userAgreements }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API customer agreements error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
