import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, agreements, agreementAuditLogs } from '../../../../../db';
import { getAdminSession } from '../../../../../lib/admin-auth';

export const prerender = false;

const VALID_STATUSES = [
  'draft',
  'pending_review',
  'sent',
  'viewed',
  'pending_signature',
  'partially_signed',
  'signed',
  'rejected',
  'expired',
  'cancelled',
];

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
    if (!id) {
      return new Response(JSON.stringify({ error: 'Agreement ID required' }), {
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

    const body = await context.request.json().catch(() => ({}));
    const { status, note } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Don't allow changing from fully signed to draft
    if (agreement.status === 'signed' && status !== 'signed' && status !== 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Cannot revert a signed agreement back to draft or pending state.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updatePayload: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'sent' && !agreement.sentAt) {
      updatePayload.sentAt = new Date();
    }

    const [updated] = await db
      .update(agreements)
      .set(updatePayload)
      .where(eq(agreements.id, id))
      .returning();

    // Audit log
    await db.insert(agreementAuditLogs).values({
      agreementId: id,
      action: status === 'sent' ? 'sent' : 'status_changed',
      performedBy: session.email,
      role: 'admin',
      description: `Agreement status updated from "${agreement.status}" to "${status}"${note ? `: ${note}` : ''}`,
      details: {
        previousStatus: agreement.status,
        newStatus: status,
        note: note || null,
      },
      ipAddress: context.clientAddress || null,
    });

    return new Response(
      JSON.stringify({ success: true, agreement: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin agreement status error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
