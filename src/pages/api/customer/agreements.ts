import type { APIRoute } from 'astro';
import { eq, or, desc, sql } from 'drizzle-orm';
import { db, agreements, agreementAuditLogs } from '../../../db';
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

    // Find agreements matched by user.id, clientEmail (case-insensitive), or business.id
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
          sql`lower(${agreements.clientEmail}) = lower(${user.email})`,
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

/**
 * POST /api/customer/agreements
 * Link an agreement to the authenticated customer using its unique Agreement Code or Token
 */
export const POST: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in to link your agreement.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    let rawCode = (body.code || body.token || '').trim();

    if (!rawCode) {
      return new Response(JSON.stringify({ error: 'Agreement code or token is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Strip full URL if user pasted a link
    if (rawCode.includes('/agreements/')) {
      const parts = rawCode.split('/agreements/');
      rawCode = parts[parts.length - 1].replace(/\/print.*$/, '').replace(/\/$/, '');
    }

    const cleanCode = rawCode.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);

    const conditions = [
      eq(agreements.secureToken, cleanCode),
      sql`lower(${agreements.agreementNumber}) = lower(${cleanCode})`,
    ];
    if (isUuid) {
      conditions.push(eq(agreements.id, cleanCode));
    }

    const [agreement] = await db
      .select()
      .from(agreements)
      .where(or(...conditions))
      .limit(1);

    if (!agreement) {
      return new Response(
        JSON.stringify({
          error: `No agreement found matching code "${cleanCode}". Please verify the code from your email or contact support.`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Link agreement to authenticated Clerk customer and their business
    const updatePayload: any = {
      userId: authData.user.id,
      updatedAt: new Date(),
    };
    if (authData.business && !agreement.businessId) {
      updatePayload.businessId = authData.business.id;
    }

    const [updatedAgreement] = await db
      .update(agreements)
      .set(updatePayload)
      .where(eq(agreements.id, agreement.id))
      .returning();

    // Log in audit trail
    await db.insert(agreementAuditLogs).values({
      agreementId: agreement.id,
      action: 'linked_by_client',
      performedBy: authData.user.email,
      role: 'client',
      description: `Agreement ${agreement.agreementNumber} was linked to client account (${authData.user.email})`,
      details: {
        agreementNumber: agreement.agreementNumber,
        userId: authData.user.id,
        userEmail: authData.user.email,
      },
      ipAddress: context.clientAddress || null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agreement ${agreement.agreementNumber} linked to your dashboard!`,
        agreement: updatedAgreement,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API customer link agreement error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to link agreement' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
