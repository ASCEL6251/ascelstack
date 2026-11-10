import { $userStore, $clerkStore } from '@clerk/astro/client';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: number;
}

export const AUTH_EVENT = 'auth:change';

let cachedUser: User | null = null;
const listeners = new Set<(u: User | null) => void>();

function mapClerkUser(clerkUser: any): User | null {
  if (!clerkUser) return null;
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    '';
  const name =
    clerkUser.fullName ||
    `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() ||
    clerkUser.username ||
    email.split('@')[0] ||
    'Ascelstack Partner';

  return {
    id: clerkUser.id,
    name,
    email,
    phone: clerkUser.primaryPhoneNumber?.phoneNumber || clerkUser.phoneNumbers?.[0]?.phoneNumber,
    company: clerkUser.publicMetadata?.company,
    createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt).getTime() : Date.now(),
  };
}

if (typeof window !== 'undefined') {
  $userStore.subscribe((clerkUser) => {
    if (clerkUser === undefined) return;
    cachedUser = mapClerkUser(clerkUser);
    listeners.forEach((fn) => {
      try {
        fn(cachedUser);
      } catch (e) {
        console.warn('Auth listener error:', e);
      }
    });
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: cachedUser }));
  });
}

export function getUser(): User | null {
  if (cachedUser) return cachedUser;
  if (typeof window !== 'undefined') {
    const clerk = (window as any).Clerk;
    if (clerk?.user) {
      cachedUser = mapClerkUser(clerk.user);
      return cachedUser;
    }
    const storeVal = $userStore.get();
    if (storeVal) {
      cachedUser = mapClerkUser(storeVal);
      return cachedUser;
    }
  }
  return null;
}

export function setCachedUser(u: User | null) {
  cachedUser = u;
  listeners.forEach((fn) => {
    try {
      fn(cachedUser);
    } catch (e) {
      console.warn('Auth listener error:', e);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: cachedUser }));
  }
}

export function onAuth(cb: (user: User | null) => void): () => void {
  listeners.add(cb);
  const u = getUser();
  if (u) {
    try {
      cb(u);
    } catch (e) {}
  }
  return () => listeners.delete(cb);
}

export function signIn(redirectUrl = '/dashboard') {
  if (typeof window !== 'undefined') {
    window.location.href = `/login?redirect=${encodeURIComponent(redirectUrl)}`;
  }
}

export function signUp(redirectUrl = '/dashboard') {
  if (typeof window !== 'undefined') {
    window.location.href = `/sign-up?redirect=${encodeURIComponent(redirectUrl)}`;
  }
}

export async function signOut() {
  if (typeof window !== 'undefined') {
    const clerk = (window as any).Clerk || $clerkStore.get();
    if (clerk?.signOut) {
      await clerk.signOut();
    }
    cachedUser = null;
    listeners.forEach((fn) => {
      try {
        fn(null);
      } catch (e) {}
    });
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: null }));
    window.location.href = '/login';
  }
}

export function updateUser(_patch: any) {
  return getUser();
}

/** Only allow same-site relative redirects. */
export function safeRedirect(target: string | null, fallback = '/dashboard') {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : fallback;
}
