import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function getDatabaseUrl(): string {
  // Check Node / Vite / Astro environment variables
  const url =
    (typeof process !== 'undefined' && process.env?.DATABASE_URL) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.DATABASE_URL);

  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Please add it to your .env file or deployment settings.'
    );
  }
  return url;
}

export const getDb = () => {
  const url = getDatabaseUrl();
  const sql = neon(url);
  return drizzle(sql, { schema });
};

// Singleton db instance for standard calls
let _db: ReturnType<typeof getDb> | null = null;
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (!_db) {
      _db = getDb();
    }
    return (_db as any)[prop];
  },
});

export * from './schema';
