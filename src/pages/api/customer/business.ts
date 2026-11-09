import type { APIRoute } from 'astro';
import { eq, and, desc } from 'drizzle-orm';
import { db, businesses } from '../../../db';
import { getAuthenticatedUser, logActivity } from '../../../lib/auth';
import { businessSchema } from '../../../lib/validations';

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

    const userBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, authData.user.id))
      .orderBy(desc(businesses.updatedAt));

    return new Response(JSON.stringify({ businesses: userBusinesses }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API business GET error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const authData = await getAuthenticatedUser(context);
    if (!authData) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json().catch(() => ({}));
    const parsed = businessSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.format() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id, ...data } = parsed.data;

    let savedBusiness;

    if (id) {
      // Ensure the business belongs to this authenticated user
      const [existing] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.id, id), eq(businesses.ownerUserId, authData.user.id)))
        .limit(1);

      if (!existing) {
        return new Response(
          JSON.stringify({ error: 'Business not found or access denied' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      [savedBusiness] = await db
        .update(businesses)
        .set({
          businessName: data.businessName,
          businessType: data.businessType || null,
          industry: data.industry || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          country: data.country || 'India',
          gstin: data.gstin || null,
          description: data.description || null,
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, id))
        .returning();

      await logActivity({
        userId: authData.user.id,
        businessId: savedBusiness.id,
        activityType: 'business_updated',
        description: `Updated business profile: ${savedBusiness.businessName}`,
        metadata: { businessId: savedBusiness.id, businessName: savedBusiness.businessName },
      });
    } else {
      // Create new business for this user
      [savedBusiness] = await db
        .insert(businesses)
        .values({
          ownerUserId: authData.user.id,
          businessName: data.businessName,
          businessType: data.businessType || null,
          industry: data.industry || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          country: data.country || 'India',
          gstin: data.gstin || null,
          description: data.description || null,
        })
        .returning();

      await logActivity({
        userId: authData.user.id,
        businessId: savedBusiness.id,
        activityType: 'business_created',
        description: `Registered business profile: ${savedBusiness.businessName}`,
        metadata: { businessId: savedBusiness.id, businessName: savedBusiness.businessName },
      });
    }

    return new Response(JSON.stringify({ success: true, business: savedBusiness }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('API business POST error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save business' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
