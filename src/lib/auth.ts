import type { APIContext } from 'astro';
import { clerkClient, createClerkClient } from '@clerk/astro/server';
import { eq, desc } from 'drizzle-orm';
import { db, users, businesses, activityLogs, type User, type Business } from '../db';

export interface AuthenticatedContext {
  userId: string; // Clerk User ID
  user: User; // Neon User
  business: Business | null; // Primary or most recent business
}

/**
 * Get or sync the authenticated user from Clerk into Neon PostgreSQL
 */
export async function getAuthenticatedUser(
  context: APIContext
): Promise<AuthenticatedContext | null> {
  const auth = context.locals.auth();
  if (!auth.isAuthenticated || !auth.userId) {
    return null;
  }

  const clerkUserId = auth.userId;

  // 1. Try to find the user in Neon
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  // 2. If user doesn't exist in Neon, fetch from Clerk API and insert
  if (!user) {
    let email = '';
    let fullName = '';
    let avatarUrl = '';

    try {
      let client;
      try {
        client = clerkClient(context);
      } catch {
        const secretKey =
          process.env.CLERK_SECRET_KEY || (import.meta as any).env?.CLERK_SECRET_KEY;
        client = createClerkClient({ secretKey });
      }

      const clerkUserData = await client.users.getUser(clerkUserId);
      email =
        clerkUserData.emailAddresses.find((e) => e.id === clerkUserData.primaryEmailAddressId)
          ?.emailAddress ||
        clerkUserData.emailAddresses[0]?.emailAddress ||
        '';
      fullName =
        `${clerkUserData.firstName || ''} ${clerkUserData.lastName || ''}`.trim() ||
        clerkUserData.username ||
        email.split('@')[0];
      avatarUrl = clerkUserData.imageUrl || '';
    } catch (e) {
      console.warn('Failed to fetch full user from Clerk API:', e);
      email = `user_${clerkUserId.slice(-8)}@customer.ascelstack.com`;
      fullName = 'Ascelstack Customer';
    }

    [user] = await db
      .insert(users)
      .values({
        clerkUserId,
        email: email || `user_${clerkUserId.slice(-8)}@customer.ascelstack.com`,
        fullName: fullName || 'Ascelstack Customer',
        avatarUrl,
      })
      .returning();

    // Log the registration/initial sync
    await db.insert(activityLogs).values({
      userId: user.id,
      activityType: 'account_created',
      description: 'Account created and synchronized with Ascelstack',
      metadata: { clerkUserId, email },
    });
  }

  // 3. Find user's primary/active business
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerUserId, user.id))
    .orderBy(desc(businesses.updatedAt))
    .limit(1);

  return {
    userId: clerkUserId,
    user,
    business: business || null,
  };
}

/**
 * Log activity helper
 */
export async function logActivity(params: {
  userId: string;
  businessId?: string | null;
  activityType: string;
  description: string;
  metadata?: Record<string, any>;
}) {
  try {
    await db.insert(activityLogs).values({
      userId: params.userId,
      businessId: params.businessId ?? null,
      activityType: params.activityType,
      description: params.description,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
