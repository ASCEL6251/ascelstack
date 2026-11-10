import type { APIRoute } from 'astro';
import { db, quotations, quotationHistory, activityLogs } from '../../../../../db';
import { getAdminSession, logAdminAction } from '../../../../../lib/admin-auth';
import { eq, sql } from 'drizzle-orm';

export const prerender = false;

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

    // 1. Initial Estimated Cost
    if (body.initialEstimatedCost !== undefined) {
      const initialCost = parseFloat(String(body.initialEstimatedCost)) || 0;
      const prevCost = parseFloat(String(current.initialEstimatedCost)) || 0;
      if (initialCost !== prevCost) {
        updatePayload.initialEstimatedCost = initialCost.toFixed(2);
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'initial_estimated_cost',
          previousValue: `${current.currency} ${prevCost.toLocaleString()}`,
          newValue: `${current.currency} ${initialCost.toLocaleString()}`,
          description: `Initial estimated cost updated to ${current.currency} ${initialCost.toLocaleString()} by ${session.name}`,
        });
      }
    }

    // 2. Final Quotation Amount
    if (body.finalQuotationAmount !== undefined) {
      const finalAmount = parseFloat(String(body.finalQuotationAmount)) || 0;
      const prevFinal = parseFloat(String(current.finalQuotationAmount)) || 0;
      if (finalAmount !== prevFinal) {
        updatePayload.finalQuotationAmount = finalAmount.toFixed(2);
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'final_quotation_amount',
          previousValue: `${current.currency} ${prevFinal.toLocaleString()}`,
          newValue: `${current.currency} ${finalAmount.toLocaleString()}`,
          description: `Final quotation amount set to ${current.currency} ${finalAmount.toLocaleString()} by ${session.name}`,
        });
      }
    }

    // 3. Additional Charges
    if (body.additionalCharges !== undefined) {
      const addCharges = parseFloat(String(body.additionalCharges)) || 0;
      updatePayload.additionalCharges = addCharges.toFixed(2);
    }

    // 4. Discount Amount
    if (body.discountAmount !== undefined) {
      const discount = parseFloat(String(body.discountAmount)) || 0;
      updatePayload.discountAmount = discount.toFixed(2);
    }

    // 5. Tax Amount
    if (body.taxAmount !== undefined) {
      const tax = parseFloat(String(body.taxAmount)) || 0;
      updatePayload.taxAmount = tax.toFixed(2);
    }

    // 6. Pricing Breakdown
    if (body.pricingBreakdown !== undefined) {
      updatePayload.pricingBreakdown = Array.isArray(body.pricingBreakdown) ? body.pricingBreakdown : [];
    }

    // 7. Internal Notes (hidden from customer)
    if (body.internalNotes !== undefined && body.internalNotes !== current.internalNotes) {
      updatePayload.internalNotes = body.internalNotes;
    }

    // 8. Customer Notes (visible to customer)
    if (body.customerNotes !== undefined && body.customerNotes !== current.customerNotes) {
      updatePayload.customerNotes = body.customerNotes;
      historyRecords.push({
        quotationId: current.id,
        userId: current.userId,
        adminEmail: session.email,
        fieldChanged: 'customer_notes',
        previousValue: current.customerNotes || '',
        newValue: body.customerNotes,
        description: `Customer pricing notes updated`,
      });
    }

    // 9. Currency (INR / USD)
    if (body.currency !== undefined && ['INR', 'USD'].includes(body.currency)) {
      updatePayload.currency = body.currency;
    }

    // Update database
    const [updated] = await db
      .update(quotations)
      .set(updatePayload)
      .where(eq(quotations.id, current.id))
      .returning();

    // Insert history
    if (historyRecords.length > 0) {
      await db.insert(quotationHistory).values(historyRecords);
    }

    // Audit log
    await logAdminAction({
      adminEmail: session.email,
      action: 'update_quotation_pricing',
      targetType: 'pricing',
      targetId: current.id,
      description: `Updated estimation & pricing for quotation ${current.quotationNumber}: Final Amount ${updated.currency} ${updated.finalQuotationAmount}`,
      details: { updates: updatePayload },
    });

    // Notify customer activity feed
    await db.insert(activityLogs).values({
      userId: current.userId,
      businessId: current.businessId,
      activityType: 'pricing_updated',
      description: `Updated project quotation pricing: ${updated.currency} ${parseFloat(String(updated.finalQuotationAmount)).toLocaleString()}`,
      metadata: {
        quotationId: current.id,
        quotationNumber: current.quotationNumber,
        finalAmount: updated.finalQuotationAmount,
        currency: updated.currency,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Project estimation and pricing saved successfully',
        quotation: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/quotations/[id]/pricing error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update quotation pricing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
