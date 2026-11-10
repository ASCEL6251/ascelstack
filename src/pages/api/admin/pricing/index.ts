import type { APIRoute } from 'astro';
import { db, services, servicePricing, adminActivityLogs } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { dbRowToPricing, staticPricing, type Pricing } from '../../../../lib/pricing';
import { broadcastPricingUpdate } from '../../../../lib/pricing-events';
import { eq, asc } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getAdminSession(context);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Fetch all services and pricing from Neon
    const allServices = await db
      .select({
        id: services.id,
        code: services.code,
        name: services.name,
        slug: services.slug,
        description: services.description,
        layer: services.layer,
        discipline: services.discipline,
        availabilityStatus: services.availabilityStatus,
      })
      .from(services)
      .orderBy(asc(services.code));

    const allPricingRows = await db.select().from(servicePricing);
    const pricingByCode = new Map<string, any>();
    for (const p of allPricingRows) {
      if (p.serviceCode) {
        pricingByCode.set(p.serviceCode, p);
      }
    }

    // Combine into unified service items
    const items = allServices.map((svc) => {
      const code = svc.code || '';
      const dbPrice = pricingByCode.get(code);
      const fallback = staticPricing[code];

      let pricingData: Pricing;
      if (dbPrice) {
        pricingData = dbRowToPricing(dbPrice);
      } else if (fallback) {
        pricingData = fallback;
      } else {
        pricingData = {
          id: code,
          status: svc.availabilityStatus === 'live' ? 'open' : 'soon',
          type: 'starting',
          small: { price: null, text: 'On quote', unit: 'one-time', detail: '' },
          mid: { price: null, text: 'On quote', unit: 'one-time', detail: '' },
          billing: 'Project',
          market: '',
          notes: '',
        };
      }

      return {
        serviceId: svc.id,
        code: svc.code,
        name: svc.name,
        slug: svc.slug,
        description: svc.description,
        layer: svc.layer,
        discipline: svc.discipline,
        availabilityStatus: svc.availabilityStatus,
        pricing: pricingData,
        lastUpdated: dbPrice?.updatedAt ? new Date(dbPrice.updatedAt).toISOString() : null,
      };
    });

    const liveCount = items.filter((i) => i.pricing.status === 'open').length;
    const soonCount = items.filter((i) => i.pricing.status === 'soon').length;

    return new Response(
      JSON.stringify({
        success: true,
        services: items,
        total: items.length,
        stats: {
          total: items.length,
          live: liveCount,
          comingSoon: soonCount,
          packageType: items.filter((i) => i.pricing.type === 'package').length,
          fixedType: items.filter((i) => i.pricing.type === 'fixed').length,
          startingType: items.filter((i) => i.pricing.type === 'starting').length,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Admin API pricing GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch services pricing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

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
    const {
      serviceCode,
      status, // 'open' | 'soon'
      type, // 'package' | 'fixed' | 'starting'
      smallPrice,
      smallText,
      smallUnit,
      smallDetail,
      midPrice,
      midText,
      midUnit,
      midDetail,
      billing,
      market,
      notes,
      packages,
    } = body;

    if (!serviceCode || typeof serviceCode !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing valid serviceCode' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normCode = serviceCode.trim().toUpperCase();
    const cleanStatus = status === 'soon' ? 'soon' : 'open';
    const cleanType = ['package', 'fixed', 'starting'].includes(type) ? type : 'starting';

    // Parse numeric prices safely
    const numSmallPrice =
      smallPrice !== '' && smallPrice !== null && smallPrice !== undefined && !isNaN(Number(smallPrice))
        ? Number(smallPrice)
        : null;

    const numMidPrice =
      midPrice !== '' && midPrice !== null && midPrice !== undefined && !isNaN(Number(midPrice))
        ? Number(midPrice)
        : null;

    // Fetch existing service ID
    const serviceRows = await db
      .select({ id: services.id, name: services.name, availabilityStatus: services.availabilityStatus })
      .from(services)
      .where(eq(services.code, normCode))
      .limit(1);

    const serviceId = serviceRows[0]?.id || null;
    const serviceName = serviceRows[0]?.name || normCode;

    // Clean packages array
    const cleanPackages = Array.isArray(packages) ? packages : [];

    // 1. Upsert into service_pricing
    const existing = await db
      .select()
      .from(servicePricing)
      .where(eq(servicePricing.serviceCode, normCode))
      .limit(1);

    let updatedRow: any;
    if (existing.length > 0) {
      const result = await db
        .update(servicePricing)
        .set({
          serviceId: serviceId || existing[0].serviceId,
          status: cleanStatus,
          type: cleanType,
          smallPrice: numSmallPrice !== null ? String(numSmallPrice) : null,
          smallText: String(smallText ?? ''),
          smallUnit: String(smallUnit ?? ''),
          smallDetail: String(smallDetail ?? ''),
          midPrice: numMidPrice !== null ? String(numMidPrice) : null,
          midText: String(midText ?? ''),
          midUnit: String(midUnit ?? ''),
          midDetail: String(midDetail ?? ''),
          billing: String(billing ?? ''),
          market: String(market ?? ''),
          notes: String(notes ?? ''),
          packages: cleanPackages,
          updatedAt: new Date(),
        })
        .where(eq(servicePricing.serviceCode, normCode))
        .returning();
      updatedRow = result[0];
    } else {
      const result = await db
        .insert(servicePricing)
        .values({
          serviceCode: normCode,
          serviceId,
          status: cleanStatus,
          type: cleanType,
          smallPrice: numSmallPrice !== null ? String(numSmallPrice) : null,
          smallText: String(smallText ?? ''),
          smallUnit: String(smallUnit ?? ''),
          smallDetail: String(smallDetail ?? ''),
          midPrice: numMidPrice !== null ? String(numMidPrice) : null,
          midText: String(midText ?? ''),
          midUnit: String(midUnit ?? ''),
          midDetail: String(midDetail ?? ''),
          billing: String(billing ?? ''),
          market: String(market ?? ''),
          notes: String(notes ?? ''),
          packages: cleanPackages,
          updatedAt: new Date(),
        })
        .returning();
      updatedRow = result[0];
    }

    // 2. Synchronize availabilityStatus on the services table:
    // status 'open' -> 'live' (unplugged coming soon!)
    // status 'soon' -> 'coming_soon'
    const newAvailability = cleanStatus === 'open' ? 'live' : 'coming_soon';
    if (serviceId) {
      await db
        .update(services)
        .set({ availabilityStatus: newAvailability, updatedAt: new Date() })
        .where(eq(services.id, serviceId));
    }

    // 3. Log Admin Activity
    const formattedPrice = numSmallPrice !== null ? `₹${numSmallPrice.toLocaleString('en-IN')}` : 'On Quote';
    const actionDesc =
      cleanStatus === 'open' && serviceRows[0]?.availabilityStatus === 'coming_soon'
        ? `Unplugged coming soon for ${normCode} (${serviceName}) and updated pricing to ${formattedPrice}`
        : `Updated pricing & status for ${normCode} (${serviceName}) to ${cleanStatus.toUpperCase()} (${formattedPrice})`;

    try {
      await db.insert(adminActivityLogs).values({
        adminEmail: session.email,
        action: cleanStatus === 'open' ? 'unplug_coming_soon' : 'update_pricing',
        targetType: 'pricing',
        targetId: normCode,
        description: actionDesc,
        details: {
          code: normCode,
          serviceName,
          status: cleanStatus,
          type: cleanType,
          smallPrice: numSmallPrice,
          midPrice: numMidPrice,
          packagesCount: cleanPackages.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logErr) {
      console.warn('Failed to insert admin activity log:', logErr);
    }

    // 4. Broadcast Real-time Event to Connected Clients
    const convertedPricing = dbRowToPricing(updatedRow);
    broadcastPricingUpdate(normCode, convertedPricing);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated pricing for ${normCode}`,
        pricing: convertedPricing,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Admin API pricing POST error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to update pricing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
