import type { APIRoute } from 'astro';
import { db, quotations, quotationHistory, activityLogs, serviceRequests } from '../../../../../db';
import { getAdminSession, logAdminAction } from '../../../../../lib/admin-auth';
import { eq, sql } from 'drizzle-orm';

export const prerender = false;

const VALID_QUOTATION_STATUSES = [
  'New Inquiry',
  'Under Review',
  'Processing',
  'Estimation in Progress',
  'Quotation Prepared',
  'Quotation Sent',
  'Awaiting Customer Approval',
  'Approved',
  'Rejected',
  'On Hold',
  'Completed',
  'Cancelled',
];

const VALID_PAYMENT_STATUSES = [
  'Not Required',
  'Payment Pending',
  'Payment Processing',
  'Partially Paid',
  'Payment Completed',
  'Payment Failed',
  'Payment Refunded',
];

export const PATCH: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const quotationId = context.params.id;
    if (!quotationId) {
      return new Response(JSON.stringify({ error: 'Quotation ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch current quotation
    const [current] = await db
      .select()
      .from(quotations)
      .where(sql`${quotations.id}::text = ${quotationId} OR ${quotations.quotationNumber} = ${quotationId}`)
      .limit(1);

    if (!current) {
      return new Response(JSON.stringify({ error: 'Quotation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const updatePayload: Partial<typeof quotations.$inferInsert> = {
      updatedAt: new Date(),
    };
    const historyRecords = [];

    // A. Quotation Status (Independent)
    if (body.quotationStatus !== undefined) {
      const newStatus = String(body.quotationStatus).trim();
      if (!VALID_QUOTATION_STATUSES.includes(newStatus)) {
        return new Response(
          JSON.stringify({
            error: `Invalid quotation status "${newStatus}". Must be one of: ${VALID_QUOTATION_STATUSES.join(', ')}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (newStatus !== current.quotationStatus) {
        updatePayload.quotationStatus = newStatus;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'quotation_status',
          previousValue: current.quotationStatus,
          newValue: newStatus,
          description: `Quotation status changed from "${current.quotationStatus}" to "${newStatus}" by ${session.name}`,
        });
      }
    }

    // B. Payment Status (Independent & Verified)
    if (body.paymentStatus !== undefined) {
      const newPaymentStatus = String(body.paymentStatus).trim();
      if (!VALID_PAYMENT_STATUSES.includes(newPaymentStatus)) {
        return new Response(
          JSON.stringify({
            error: `Invalid payment status "${newPaymentStatus}". Must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Safeguard: Marking as 'Payment Completed' requires explicit verification or reference
      if (newPaymentStatus === 'Payment Completed' && !current.paymentVerified && !body.paymentVerified && !body.paymentReference) {
        return new Response(
          JSON.stringify({
            error: 'Payment completion must be verified with a payment reference or verification confirmation.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (newPaymentStatus !== current.paymentStatus) {
        updatePayload.paymentStatus = newPaymentStatus;
        if (body.paymentVerified !== undefined) {
          updatePayload.paymentVerified = Boolean(body.paymentVerified);
        }
        if (body.paymentReference !== undefined) {
          updatePayload.paymentReference = String(body.paymentReference).trim();
        }

        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'payment_status',
          previousValue: current.paymentStatus,
          newValue: newPaymentStatus,
          description: `Payment status updated from "${current.paymentStatus}" to "${newPaymentStatus}" by ${session.name}`,
        });
      }
    }

    // C. Project Progress (Independent 0% - 100%)
    if (body.projectProgress !== undefined) {
      const progress = parseInt(String(body.projectProgress), 10);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        return new Response(
          JSON.stringify({ error: 'Project progress must be an integer between 0 and 100' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (progress !== current.projectProgress) {
        updatePayload.projectProgress = progress;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'project_progress',
          previousValue: `${current.projectProgress}%`,
          newValue: `${progress}%`,
          description: `Project progress updated from ${current.projectProgress}% to ${progress}% by ${session.name}`,
        });
      }
    }

    // Customer Visible Notes update
    if (body.customerNotes !== undefined && body.customerNotes !== current.customerNotes) {
      updatePayload.customerNotes = body.customerNotes;
      historyRecords.push({
        quotationId: current.id,
        userId: current.userId,
        adminEmail: session.email,
        fieldChanged: 'customer_notes',
        previousValue: current.customerNotes || '',
        newValue: body.customerNotes,
        description: `Customer-visible update note added: "${body.customerNotes.slice(0, 50)}${body.customerNotes.length > 50 ? '...' : ''}"`,
      });
    }

    // Internal Notes update (Strictly hidden from customer)
    if (body.internalNotes !== undefined && body.internalNotes !== current.internalNotes) {
      updatePayload.internalNotes = body.internalNotes;
      historyRecords.push({
        quotationId: current.id,
        userId: current.userId,
        adminEmail: session.email,
        fieldChanged: 'internal_notes',
        previousValue: current.internalNotes || '',
        newValue: body.internalNotes,
        description: `Internal administrative note updated`,
      });
    }

    // If nothing changed
    if (Object.keys(updatePayload).length <= 1) {
      return new Response(
        JSON.stringify({ message: 'No changes detected', quotation: current }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Perform Database Update
    const [updated] = await db
      .update(quotations)
      .set(updatePayload)
      .where(eq(quotations.id, current.id))
      .returning();

    // 2b. Synchronize linked service requests in database so customer dashboard updates immediately
    let newServiceStatus: string | null = null;
    if (
      updated.quotationStatus === 'Approved' ||
      updated.paymentStatus === 'Payment Completed' ||
      updated.paymentStatus === 'Partially Paid' ||
      (updated.projectProgress > 0 && updated.projectProgress < 100)
    ) {
      newServiceStatus = 'active';
    } else if (updated.quotationStatus === 'Completed' || updated.projectProgress === 100) {
      newServiceStatus = 'completed';
    } else if (updated.quotationStatus === 'Cancelled' || updated.quotationStatus === 'Rejected') {
      newServiceStatus = 'cancelled';
    } else if (
      ['Under Review', 'Processing', 'Estimation in Progress', 'Quotation Prepared', 'Quotation Sent', 'Awaiting Customer Approval'].includes(updated.quotationStatus)
    ) {
      newServiceStatus = 'reviewing';
    } else if (updated.quotationStatus === 'New Inquiry') {
      newServiceStatus = 'pending';
    }

    if (newServiceStatus) {
      await db
        .update(serviceRequests)
        .set({
          status: newServiceStatus,
          updatedAt: new Date(),
        })
        .where(eq(serviceRequests.quotationId, current.id));
    }

    // 3. Insert history records
    if (historyRecords.length > 0) {
      await db.insert(quotationHistory).values(historyRecords);
    }

    // 4. Log admin audit action
    await logAdminAction({
      adminEmail: session.email,
      action: 'update_quotation_status',
      targetType: 'quotation',
      targetId: current.id,
      description: `Updated status / progress on quotation ${current.quotationNumber}`,
      details: { updates: updatePayload },
    });

    // 5. If customer-visible fields changed, record an activity log for the customer so they see it in their timeline!
    if (updatePayload.quotationStatus || updatePayload.projectProgress !== undefined || updatePayload.customerNotes) {
      await db.insert(activityLogs).values({
        userId: current.userId,
        businessId: current.businessId,
        activityType: 'quotation_updated',
        description: `Project quotation "${current.projectTitle}" updated: Status is now "${updated.quotationStatus}", Progress is ${updated.projectProgress}%`,
        metadata: {
          quotationId: current.id,
          quotationNumber: current.quotationNumber,
          status: updated.quotationStatus,
          progress: updated.projectProgress,
          customerNotes: updated.customerNotes,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quotation updated successfully',
        quotation: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/quotations/[id]/status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update quotation status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
