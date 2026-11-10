import type { APIContext } from 'astro';
import { clerkClient, createClerkClient } from '@clerk/astro/server';
import { eq, desc, sql } from 'drizzle-orm';
import { db, users, businesses, activityLogs, type User, type Business } from '../db';
import { isAdminAuthorized } from './admin-auth';

export type UserRole = 'admin' | 'customer';

export interface AuthenticatedContext {
  userId: string; // Cloud Auth User ID
  user: User; // Database User
  business: Business | null; // Primary or most recent business
  role: UserRole; // Role-based access level
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

  // 2. If user doesn't exist by clerkUserId in Neon, fetch from Clerk API and check by email to prevent duplicate accounts
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

    const normalizedEmail = email.trim().toLowerCase();

    // Deduplication check: Check if an account with this email already exists in Neon
    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existingByEmail) {
      // Re-link the existing account with the current Clerk user ID and latest details
      const [updated] = await db
        .update(users)
        .set({
          clerkUserId,
          fullName: fullName || existingByEmail.fullName,
          avatarUrl: avatarUrl || existingByEmail.avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      user = updated;
    } else {
      // Brand new user registration
      [user] = await db
        .insert(users)
        .values({
          clerkUserId,
          email: normalizedEmail || `user_${clerkUserId.slice(-8)}@customer.ascelstack.com`,
          fullName: fullName || 'Ascelstack Customer',
          avatarUrl,
        })
        .returning();

      // Log the registration/initial sync
      await db.insert(activityLogs).values({
        userId: user.id,
        activityType: 'account_created',
        description: 'Account created and synchronized with Ascelstack',
        metadata: { clerkUserId, email: normalizedEmail },
      });
    }
  }

  // 3. Find user's primary/active business
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerUserId, user.id))
    .orderBy(desc(businesses.updatedAt))
    .limit(1);

  // 4. Role-based privilege resolution
  const isAdmin = isAdminAuthorized(user.email, context);
  const role: UserRole = isAdmin ? 'admin' : ((user as any).role as UserRole) || 'customer';

  // Keep database user role synchronized with current policy
  if ((user as any).role !== role) {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      if (updatedUser) {
        user = updatedUser;
      }
    } catch (e) {
      console.warn('Could not update user role column:', e);
    }
  }

  return {
    userId: clerkUserId,
    user,
    business: business || null,
    role,
  };
}

/**
 * Role-based access guard helper
 */
export async function requireUserRole(
  context: APIContext,
  allowedRoles: UserRole[] = ['customer', 'admin']
): Promise<AuthenticatedContext | Response> {
  const authData = await getAuthenticatedUser(context);
  if (!authData) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!allowedRoles.includes(authData.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient privileges' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return authData;
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
