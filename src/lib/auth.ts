// MOCK AUTH — prototype only. Not secure: anyone can "sign in" with any
// registered email and nothing leaves the browser. No password is stored.
//
// To replace with Clerk later:
//   1. npm i @clerk/astro, add clerk() to astro.config.mjs (needs output: 'server' or hybrid
//      routes), set PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY.
//   2. Swap /sign-in and /sign-up pages for <SignIn /> and <SignUp />.
//   3. Re-implement the functions below on top of Clerk (window.Clerk.user, signOut()).
//      Keep the same names so cart/checkout/account pages keep working.

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: number;
}

const USERS = 'asc:mock-users';
const SESSION = 'asc:mock-session';
export const AUTH_EVENT = 'auth:change';

const read = <T>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
const emit = () => window.dispatchEvent(new CustomEvent(AUTH_EVENT));
const norm = (e: string) => e.trim().toLowerCase();

export function getUser(): User | null {
  const id = read<string | null>(SESSION, null);
  if (!id) return null;
  return read<User[]>(USERS, []).find((u) => u.id === id) ?? null;
}

export function signUp(input: Omit<User, 'id' | 'createdAt'>): User {
  const users = read<User[]>(USERS, []);
  if (users.some((u) => norm(u.email) === norm(input.email))) {
    throw new Error('An account with this email already exists. Sign in instead.');
  }
  const user: User = { ...input, email: norm(input.email), id: `usr_${crypto.randomUUID().slice(0, 12)}`, createdAt: Date.now() };
  write(USERS, [...users, user]);
  write(SESSION, user.id);
  emit();
  return user;
}

export function signIn(email: string): User {
  const user = read<User[]>(USERS, []).find((u) => norm(u.email) === norm(email));
  if (!user) throw new Error('No account found for this email. Create one first.');
  write(SESSION, user.id);
  emit();
  return user;
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION);
  } catch {}
  emit();
}

export function updateUser(patch: Partial<Omit<User, 'id' | 'createdAt' | 'email'>>) {
  const me = getUser();
  if (!me) return null;
  const users = read<User[]>(USERS, []).map((u) => (u.id === me.id ? { ...u, ...patch } : u));
  write(USERS, users);
  emit();
  return getUser();
}

/** Only allow same-site relative redirects. */
export function safeRedirect(target: string | null, fallback = '/account') {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : fallback;
}

export function onAuth(fn: (user: User | null) => void) {
  fn(getUser());
  window.addEventListener(AUTH_EVENT, () => fn(getUser()));
  window.addEventListener('storage', (e) => (e.key === SESSION || e.key === USERS) && fn(getUser()));
}
