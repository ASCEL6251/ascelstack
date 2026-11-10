import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, companySettings } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { companySettingsSchema } from '../../../lib/validations';
import { DEFAULT_COMPANY_INFO } from '../../../lib/agreement-clauses';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let [settings] = await db.select().from(companySettings).limit(1);

    if (!settings) {
      // Seed if not yet present
      [settings] = await db
        .insert(companySettings)
        .values({
          companyLegalName: DEFAULT_COMPANY_INFO.legalName,
          companyBrandName: DEFAULT_COMPANY_INFO.brandName,
          registeredAddress: DEFAULT_COMPANY_INFO.address,
          legalEmail: DEFAULT_COMPANY_INFO.email,
          supportEmail: DEFAULT_COMPANY_INFO.supportEmail,
          contactPhone: DEFAULT_COMPANY_INFO.phone,
          gstin: DEFAULT_COMPANY_INFO.gstin || null,
          gstinEnabled: DEFAULT_COMPANY_INFO.gstinEnabled,
          logoUrl: DEFAULT_COMPANY_INFO.logoUrl,
          signatoryName: DEFAULT_COMPANY_INFO.signatoryName,
          signatoryTitle: DEFAULT_COMPANY_INFO.signatoryTitle,
          defaultCurrency: DEFAULT_COMPANY_INFO.defaultCurrency,
        })
        .returning();
    }

    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API company settings GET error:', error);
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

    const body = await context.request.json().catch(() => ({}));
    const parsed = companySettingsSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parsed.data;

    let [existing] = await db.select().from(companySettings).limit(1);

    let updated;
    if (existing) {
      [updated] = await db
        .update(companySettings)
        .set({
          companyLegalName: data.companyLegalName,
          companyBrandName: data.companyBrandName,
          registeredAddress: data.registeredAddress,
          legalEmail: data.legalEmail,
          supportEmail: data.supportEmail,
          contactPhone: data.contactPhone,
          gstin: data.gstinEnabled ? (data.gstin || null) : null,
          gstinEnabled: data.gstinEnabled,
          logoUrl: data.logoUrl,
          signatoryName: data.signatoryName,
          signatoryTitle: data.signatoryTitle,
          defaultCurrency: data.defaultCurrency,
          updatedAt: new Date(),
        })
        .where(eq(companySettings.id, existing.id))
        .returning();
    } else {
      [updated] = await db
        .insert(companySettings)
        .values({
          companyLegalName: data.companyLegalName,
          companyBrandName: data.companyBrandName,
          registeredAddress: data.registeredAddress,
          legalEmail: data.legalEmail,
          supportEmail: data.supportEmail,
          contactPhone: data.contactPhone,
          gstin: data.gstinEnabled ? (data.gstin || null) : null,
          gstinEnabled: data.gstinEnabled,
          logoUrl: data.logoUrl,
          signatoryName: data.signatoryName,
          signatoryTitle: data.signatoryTitle,
          defaultCurrency: data.defaultCurrency,
        })
        .returning();
    }

    return new Response(
      JSON.stringify({ success: true, settings: updated }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API company settings PUT error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
