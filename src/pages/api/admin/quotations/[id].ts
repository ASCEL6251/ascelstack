import type { APIRoute } from 'astro';
import { db, quotations, users, businesses, quotationHistory, serviceRequests, services, agreements } from '../../../../db';
import { getAdminSession, logAdminAction } from '../../../../lib/admin-auth';
import { eq, desc, sql } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async (context) => {
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

    // 1. Fetch quotation record
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(sql`${quotations.id}::text = ${quotationId} OR ${quotations.quotationNumber} = ${quotationId}`)
      .limit(1);

    if (!quotation) {
      return new Response(JSON.stringify({ error: 'Quotation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch associated customer
    const [customer] = await db
      .select({
        id: users.id,
        clerkUserId: users.clerkUserId,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, quotation.userId))
      .limit(1);

    // 3. Fetch associated business if present
    let business = null;
    if (quotation.businessId) {
      [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, quotation.businessId))
        .limit(1);
    }

    // 4. Fetch quotation history
    const history = await db
      .select()
      .from(quotationHistory)
      .where(eq(quotationHistory.quotationId, quotation.id))
      .orderBy(desc(quotationHistory.createdAt));

    // 5. Fetch linked service requests with service details
    const requests = await db
      .select({
        id: serviceRequests.id,
        serviceId: serviceRequests.serviceId,
        requirements: serviceRequests.requirements,
        status: serviceRequests.status,
        requestedAt: serviceRequests.requestedAt,
        service: {
          id: services.id,
          code: services.code,
          name: services.name,
          slug: services.slug,
          description: services.description,
          layer: services.layer,
          discipline: services.discipline,
        },
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .where(eq(serviceRequests.quotationId, quotation.id));

    return new Response(
      JSON.stringify({
        quotation,
        customer,
        business,
        history,
        serviceRequests: requests,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/quotations/[id] error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve quotation details' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async (context) => {
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
    const historyRecords: any[] = [];

    // Project Title
    if (body.projectTitle !== undefined) {
      const title = String(body.projectTitle).trim();
      if (!title) {
        return new Response(JSON.stringify({ error: 'Project title cannot be empty' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (title !== current.projectTitle) {
        updatePayload.projectTitle = title;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'project_title',
          previousValue: current.projectTitle,
          newValue: title,
          description: `Project title updated to "${title}" by ${session.name}`,
        });
      }
    }

    // Project Description
    if (body.projectDescription !== undefined) {
      const desc = body.projectDescription ? String(body.projectDescription).trim() : null;
      if (desc !== current.projectDescription) {
        updatePayload.projectDescription = desc;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'project_description',
          previousValue: current.projectDescription || '',
          newValue: desc || '',
          description: `Project description updated by ${session.name}`,
        });
      }
    }

    // Requirements Scope
    if (body.requirements !== undefined) {
      const req = body.requirements ? String(body.requirements).trim() : null;
      if (req !== current.requirements) {
        updatePayload.requirements = req;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'requirements',
          previousValue: current.requirements || '',
          newValue: req || '',
          description: `Requirements scope updated by ${session.name}`,
        });
      }
    }

    // Quotation Status
    if (body.quotationStatus !== undefined) {
      const qStatus = String(body.quotationStatus).trim();
      if (qStatus && qStatus !== current.quotationStatus) {
        updatePayload.quotationStatus = qStatus;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'quotation_status',
          previousValue: current.quotationStatus,
          newValue: qStatus,
          description: `Quotation status updated to "${qStatus}" by ${session.name}`,
        });
      }
    }

    // Payment Status
    if (body.paymentStatus !== undefined) {
      const pStatus = String(body.paymentStatus).trim();
      if (pStatus && pStatus !== current.paymentStatus) {
        updatePayload.paymentStatus = pStatus;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'payment_status',
          previousValue: current.paymentStatus,
          newValue: pStatus,
          description: `Payment status updated to "${pStatus}" by ${session.name}`,
        });
      }
    }

    if (body.paymentReference !== undefined) {
      updatePayload.paymentReference = body.paymentReference ? String(body.paymentReference).trim() : null;
    }

    if (body.paymentVerified !== undefined) {
      updatePayload.paymentVerified = Boolean(body.paymentVerified);
    }

    if (body.projectProgress !== undefined) {
      const progress = Math.max(0, Math.min(100, parseInt(String(body.projectProgress), 10) || 0));
      if (progress !== current.projectProgress) {
        updatePayload.projectProgress = progress;
        historyRecords.push({
          quotationId: current.id,
          userId: current.userId,
          adminEmail: session.email,
          fieldChanged: 'project_progress',
          previousValue: `${current.projectProgress}%`,
          newValue: `${progress}%`,
          description: `Project progress updated to ${progress}% by ${session.name}`,
        });
      }
    }

    if (body.currency !== undefined) {
      updatePayload.currency = String(body.currency).trim().toUpperCase();
    }

    if (body.initialEstimatedCost !== undefined) {
      const initialCost = parseFloat(String(body.initialEstimatedCost)) || 0;
      updatePayload.initialEstimatedCost = initialCost.toFixed(2);
    }

    if (body.finalQuotationAmount !== undefined) {
      const finalAmount = parseFloat(String(body.finalQuotationAmount)) || 0;
      updatePayload.finalQuotationAmount = finalAmount.toFixed(2);
    }

    if (body.additionalCharges !== undefined) {
      const addCharges = parseFloat(String(body.additionalCharges)) || 0;
      updatePayload.additionalCharges = addCharges.toFixed(2);
    }

    if (body.discountAmount !== undefined) {
      const discount = parseFloat(String(body.discountAmount)) || 0;
      updatePayload.discountAmount = discount.toFixed(2);
    }

    if (body.internalNotes !== undefined) {
      updatePayload.internalNotes = body.internalNotes ? String(body.internalNotes).trim() : null;
    }

    if (body.customerNotes !== undefined) {
      updatePayload.customerNotes = body.customerNotes ? String(body.customerNotes).trim() : null;
    }

    const [updated] = await db
      .update(quotations)
      .set(updatePayload)
      .where(eq(quotations.id, current.id))
      .returning();

    if (historyRecords.length > 0) {
      await db.insert(quotationHistory).values(historyRecords);
    }

    await logAdminAction({
      adminEmail: session.email,
      action: 'UPDATE',
      targetType: 'quotation',
      targetId: current.id,
      description: `Updated quotation ${current.quotationNumber} (${updated.projectTitle})`,
      details: updatePayload,
      ipAddress: context.clientAddress || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, quotation: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin quotation PUT error:', error);
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

    // Unlink any agreements referencing this quotation
    await db
      .update(agreements)
      .set({ quotationId: null })
      .where(eq(agreements.quotationId, current.id));

    // Unlink any service requests referencing this quotation
    await db
      .update(serviceRequests)
      .set({ quotationId: null })
      .where(eq(serviceRequests.quotationId, current.id));

    // Delete quotation history
    await db
      .delete(quotationHistory)
      .where(eq(quotationHistory.quotationId, current.id));

    // Delete quotation itself
    await db
      .delete(quotations)
      .where(eq(quotations.id, current.id));

    await logAdminAction({
      adminEmail: session.email,
      action: 'DELETE',
      targetType: 'quotation',
      targetId: current.id,
      description: `Permanently deleted quotation ${current.quotationNumber} (${current.projectTitle})`,
      details: {
        quotationNumber: current.quotationNumber,
        projectTitle: current.projectTitle,
      },
      ipAddress: context.clientAddress || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Quotation deleted successfully', deletedId: current.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API admin quotation DELETE error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
