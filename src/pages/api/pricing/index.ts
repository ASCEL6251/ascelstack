import type { APIRoute } from 'astro';
import { db, servicePricing, services } from '../../../db';
import { dbRowToPricing, staticPricing, type Pricing } from '../../../lib/pricing';
import { eq } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const code = url.searchParams.get('code')?.trim().toUpperCase();

    // If a specific service code was requested
    if (code) {
      try {
        const rows = await db
          .select()
          .from(servicePricing)
          .where(eq(servicePricing.serviceCode, code))
          .limit(1);

        if (rows.length > 0) {
          const item = dbRowToPricing(rows[0]);
          return new Response(
            JSON.stringify({ success: true, service: item }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            }
          );
        }
      } catch (err) {
        console.warn('Fallback to static pricing for single code:', code, err);
      }

      const fallback = staticPricing[code];
      return new Response(
        JSON.stringify({ success: Boolean(fallback), service: fallback || null }),
        {
          status: fallback ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch all pricing records from Neon
    const pricingMap: Record<string, Pricing> = { ...staticPricing };
    try {
      const rows = await db.select().from(servicePricing);
      for (const row of rows) {
        if (row.serviceCode) {
          pricingMap[row.serviceCode] = dbRowToPricing(row);
        }
      }
    } catch (dbErr) {
      console.warn('Neon DB query error in /api/pricing, serving fallback:', dbErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pricing: pricingMap,
        total: Object.keys(pricingMap).length,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3, s-maxage=5',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/pricing GET error:', error);
    return new Response(
      JSON.stringify({ success: false, pricing: staticPricing, error: error.message }),
      {
        status: 200, // Return static fallback with 200 so UI continues working smoothly
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
