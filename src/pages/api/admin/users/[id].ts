import type { APIRoute } from 'astro';
import { db, users, businesses, quotations, activityLogs, serviceRequests, services } from '../../../../db';
import { getAdminSession } from '../../../../lib/admin-auth';
import { clerkClient, createClerkClient } from '@clerk/astro/server';
import { eq, desc, sql } from 'drizzle-orm';

export const prerender = false;

async function getClerkData(context: any, clerkUserId: string) {
  try {
    let client;
    try {
      client = clerkClient(context);
    } catch {
      const secretKey =
        process.env.CLERK_SECRET_KEY || (import.meta as any).env?.CLERK_SECRET_KEY;
      client = createClerkClient({ secretKey });
    }
    const clerkUser = await client.users.getUser(clerkUserId);
    return {
      id: clerkUser.id,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      username: clerkUser.username,
      imageUrl: clerkUser.imageUrl,
      primaryEmailAddressId: clerkUser.primaryEmailAddressId,
      emailAddresses: clerkUser.emailAddresses.map((e) => ({
        id: e.id,
        emailAddress: e.emailAddress,
        verification: e.verification?.status || 'unverified',
      })),
      externalAccounts: clerkUser.externalAccounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        emailAddress: a.emailAddress,
      })),
      lastSignInAt: clerkUser.lastSignInAt,
      createdAt: clerkUser.createdAt,
      banned: clerkUser.banned,
    };
  } catch (err: any) {
    return null;
  }
}

export const GET: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = context.params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch user by id or clerkUserId
    const [user] = await db
      .select()
      .from(users)
      .where(sql`${users.id}::text = ${userId} OR ${users.clerkUserId} = ${userId} OR lower(${users.email}) = lower(${userId})`)
      .limit(1);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Optional query param: ?sync=true to sync with Clerk
    const url = new URL(context.request.url);
    const shouldSync = url.searchParams.get('sync') === 'true';

    let clerkData = null;
    if (user.clerkUserId) {
      clerkData = await getClerkData(context, user.clerkUserId);
      if (shouldSync && clerkData) {
        const email = clerkData.emailAddresses[0]?.emailAddress || user.email;
        const fullName = `${clerkData.firstName || ''} ${clerkData.lastName || ''}`.trim() || clerkData.username || user.fullName;
        const avatarUrl = clerkData.imageUrl || user.avatarUrl;
        await db
          .update(users)
          .set({
            email: email.trim().toLowerCase(),
            fullName,
            avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        user.email = email.trim().toLowerCase();
        user.fullName = fullName;
        user.avatarUrl = avatarUrl;
      }
    }

    // 2. Fetch user's registered businesses
    const userBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerUserId, user.id))
      .orderBy(desc(businesses.updatedAt));

    // 3. Fetch user's quotation history
    const userQuotations = await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        projectTitle: quotations.projectTitle,
        projectDescription: quotations.projectDescription,
        requirements: quotations.requirements,
        quotationStatus: quotations.quotationStatus,
        paymentStatus: quotations.paymentStatus,
        paymentVerified: quotations.paymentVerified,
        projectProgress: quotations.projectProgress,
        currency: quotations.currency,
        initialEstimatedCost: quotations.initialEstimatedCost,
        finalQuotationAmount: quotations.finalQuotationAmount,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
      })
      .from(quotations)
      .where(eq(quotations.userId, user.id))
      .orderBy(desc(quotations.createdAt));

    // 4. Fetch all individual service requests submitted by this user
    const userRequests = await db
      .select({
        id: serviceRequests.id,
        businessId: serviceRequests.businessId,
        serviceId: serviceRequests.serviceId,
        quotationId: serviceRequests.quotationId,
        requirements: serviceRequests.requirements,
        status: serviceRequests.status,
        requestedAt: serviceRequests.requestedAt,
        updatedAt: serviceRequests.updatedAt,
        service: {
          id: services.id,
          code: services.code,
          name: services.name,
          slug: services.slug,
          layer: services.layer,
          discipline: services.discipline,
        },
      })
      .from(serviceRequests)
      .innerJoin(services, eq(serviceRequests.serviceId, services.id))
      .where(eq(serviceRequests.userId, user.id))
      .orderBy(desc(serviceRequests.requestedAt));

    // 5. Fetch user's activity logs
    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, user.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(30);

    return new Response(
      JSON.stringify({
        user,
        clerkAuth: clerkData,
        businesses: userBusinesses,
        quotations: userQuotations,
        serviceRequests: userRequests,
        activityLogs: logs,
        syncedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/users/[id] error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve user details' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized admin access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = context.params.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`${users.id}::text = ${userId} OR ${users.clerkUserId} = ${userId} OR lower(${users.email}) = lower(${userId})`)
      .limit(1);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clerkData = await getClerkData(context, user.clerkUserId);
    if (clerkData) {
      const email = clerkData.emailAddresses[0]?.emailAddress || user.email;
      const fullName = `${clerkData.firstName || ''} ${clerkData.lastName || ''}`.trim() || clerkData.username || user.fullName;
      const avatarUrl = clerkData.imageUrl || user.avatarUrl;

      const [updatedUser] = await db
        .update(users)
        .set({
          email: email.trim().toLowerCase(),
          fullName,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User synchronized successfully with Clerk & Neon',
          user: updatedUser,
          clerkAuth: clerkData,
          syncedAt: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database profile confirmed. Clerk API did not return remote updates.',
        user,
        syncedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('API /api/admin/users/[id] sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to synchronize user account' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
