import type { APIRoute } from 'astro';
import { eq, desc } from 'drizzle-orm';
import { db, agreements, agreementSignatures, agreementAuditLogs } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { agreementUpdateSchema } from '../../../../lib/validations';

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = context.params;
    if (!id || !UUID_REGEX.test(id)) {
      return new Response(JSON.stringify({ error: 'Valid Agreement UUID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [agreement] = await db.select().from(agreements).where(eq(agreements.id, id)).limit(1);

    if (!agreement) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const signatures = await db
      .select()
      .from(agreementSignatures)
      .where(eq(agreementSignatures.agreementId, id))
      .orderBy(desc(agreementSignatures.signedAt));

    const auditLogs = await db
      .select()
      .from(agreementAuditLogs)
      .where(eq(agreementAuditLogs.agreementId, id))
      .orderBy(desc(agreementAuditLogs.createdAt));

    return new Response(
      JSON.stringify({
        agreement,
        signatures,
        auditLogs,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreement GET error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = context.params;
    if (!id || !UUID_REGEX.test(id)) {
      return new Response(JSON.stringify({ error: 'Valid Agreement UUID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [existing] = await db.select().from(agreements).where(eq(agreements.id, id)).limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // IMMUTABILITY CHECK: If agreement is signed or explicitly locked, prevent modifications!
    if (existing.isImmutable || existing.status === 'signed') {
      return new Response(
        JSON.stringify({
          error: 'This agreement has been digitally signed and is legally locked. It cannot be modified.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = agreementUpdateSchema.safeParse({ ...body, id });

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data;

    // Calculate advance amount if percentages/totals were modified
    let advanceAmount = data.advanceAmount !== undefined ? data.advanceAmount : Number(existing.advanceAmount);
    if (data.totalAmount !== undefined && data.advancePercentage !== undefined && data.advanceAmount === undefined) {
      advanceAmount = Number(((data.totalAmount * data.advancePercentage) / 100).toFixed(2));
    }

    const updatePayload: Record<string, any> = {
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.clientName !== undefined) updatePayload.clientName = data.clientName;
    if (data.clientEmail !== undefined) updatePayload.clientEmail = data.clientEmail;
    if (data.clientCompany !== undefined) updatePayload.clientCompany = data.clientCompany;
    if (data.clientAddress !== undefined) updatePayload.clientAddress = data.clientAddress;
    if (data.clientCity !== undefined) updatePayload.clientCity = data.clientCity;
    if (data.clientState !== undefined) updatePayload.clientState = data.clientState;
    if (data.clientCountry !== undefined) updatePayload.clientCountry = data.clientCountry;
    if (data.clientPhone !== undefined) updatePayload.clientPhone = data.clientPhone;
    if (data.clientGstin !== undefined) updatePayload.clientGstin = data.clientGstin;

    if (data.projectName !== undefined) updatePayload.projectName = data.projectName;
    if (data.projectDescription !== undefined) updatePayload.projectDescription = data.projectDescription;
    if (data.scopeOfWork !== undefined) updatePayload.scopeOfWork = data.scopeOfWork;
    if (data.deliverables !== undefined) updatePayload.deliverables = data.deliverables;
    if (data.timeline !== undefined) updatePayload.timeline = data.timeline;
    if (data.milestones !== undefined) updatePayload.milestones = data.milestones;

    if (data.currency !== undefined) updatePayload.currency = data.currency;
    if (data.totalAmount !== undefined) updatePayload.totalAmount = String(data.totalAmount);
    if (data.advancePercentage !== undefined) updatePayload.advancePercentage = data.advancePercentage;
    updatePayload.advanceAmount = String(advanceAmount);
    if (data.paymentSchedule !== undefined) updatePayload.paymentSchedule = data.paymentSchedule;
    if (data.taxPercentage !== undefined) updatePayload.taxPercentage = String(data.taxPercentage);
    if (data.taxAmount !== undefined) updatePayload.taxAmount = String(data.taxAmount);

    if (data.clauses !== undefined) updatePayload.clauses = data.clauses;
    if (data.validUntil !== undefined) updatePayload.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.providerGstinEnabled !== undefined) updatePayload.providerGstinEnabled = data.providerGstinEnabled;
    if (data.providerGstin !== undefined) updatePayload.providerGstin = data.providerGstinEnabled ? data.providerGstin : null;

    if (data.status === 'sent' && !existing.sentAt) {
      updatePayload.sentAt = new Date();
    }

    const [updatedAgreement] = await db
      .update(agreements)
      .set(updatePayload)
      .where(eq(agreements.id, id))
      .returning();

    // Audit log
    await db.insert(agreementAuditLogs).values({
      agreementId: id,
      action: 'updated',
      performedBy: session.email,
      role: 'admin',
      description: `Updated agreement terms (Version ${updatedAgreement.version})`,
      details: {
        newVersion: updatedAgreement.version,
        status: updatedAgreement.status,
      },
      ipAddress: context.clientAddress || null,
    });

    return new Response(
      JSON.stringify({ success: true, agreement: updatedAgreement }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreement PUT error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = context.params;
    if (!id || !UUID_REGEX.test(id)) {
      return new Response(JSON.stringify({ error: 'Valid Agreement UUID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [existing] = await db.select().from(agreements).where(eq(agreements.id, id)).limit(1);

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Agreement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (existing.status === 'signed' || existing.isImmutable) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete signed agreements.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark as cancelled or delete
    const [cancelled] = await db
      .update(agreements)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, id))
      .returning();

    await db.insert(agreementAuditLogs).values({
      agreementId: id,
      action: 'cancelled',
      performedBy: session.email,
      role: 'admin',
      description: `Agreement ${existing.agreementNumber} cancelled by admin`,
      ipAddress: context.clientAddress || null,
    });

    return new Response(
      JSON.stringify({ success: true, agreement: cancelled }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreement DELETE error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
