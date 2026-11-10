import type { APIRoute } from 'astro';
import { db, services, servicePricing, adminActivityLogs } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { dbRowToPricing } from '../../../../lib/pricing';
import { broadcastPricingUpdate } from '../../../../lib/pricing-events';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getAdminSession(context);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await context.request.json();
    const { serviceCode, status } = body;

    if (!serviceCode) {
      return new Response(JSON.stringify({ error: 'Missing serviceCode' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normCode = serviceCode.trim().toUpperCase();

    // Determine target status
    let targetStatus: 'open' | 'soon';
    if (status) {
      targetStatus = status === 'soon' ? 'soon' : 'open';
    } else {
      // Toggle existing
      const existing = await db
        .select({ status: servicePricing.status })
        .from(servicePricing)
        .where(eq(servicePricing.serviceCode, normCode))
        .limit(1);

      targetStatus = existing[0]?.status === 'open' ? 'soon' : 'open';
    }

    // 1. Update service_pricing in Neon
    const updatedPricing = await db
      .update(servicePricing)
      .set({
        status: targetStatus,
        updatedAt: new Date(),
      })
      .where(eq(servicePricing.serviceCode, normCode))
      .returning();

    // 2. Synchronize services.availability_status
    const availabilityStatus = targetStatus === 'open' ? 'live' : 'coming_soon';
    await db
      .update(services)
      .set({
        availabilityStatus,
        updatedAt: new Date(),
      })
      .where(eq(services.code, normCode));

    // 3. Log Admin Activity
    const action = targetStatus === 'open' ? 'unplug_coming_soon' : 'enable_coming_soon';
    const description =
      targetStatus === 'open'
        ? `Unplugged coming soon: set ${normCode} to LIVE with instant pricing active`
        : `Plugged coming soon: marked ${normCode} as COMING SOON`;

    try {
      await db.insert(adminActivityLogs).values({
        adminEmail: session.email,
        action,
        targetType: 'pricing',
        targetId: normCode,
        description,
        details: { code: normCode, newStatus: targetStatus, timestamp: new Date().toISOString() },
      });
    } catch {}

    // 4. Broadcast Real-time Event
    let convertedPricing: any = null;
    if (updatedPricing.length > 0) {
      convertedPricing = dbRowToPricing(updatedPricing[0]);
      broadcastPricingUpdate(normCode, convertedPricing);
    }

    return new Response(
      JSON.stringify({
        success: true,
        serviceCode: normCode,
        status: targetStatus,
        availabilityStatus,
        pricing: convertedPricing,
        message: targetStatus === 'open' ? `${normCode} is now LIVE!` : `${normCode} is now Coming Soon`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Admin API pricing toggle error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to toggle status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
