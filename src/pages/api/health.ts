import type { APIRoute } from 'astro';
import { db, services } from '../../db';
import { sql } from 'drizzle-orm';

export const prerender = false;

/**
 * Health check endpoint for system monitoring, uptime tracking, and CI/CD validation.
 * Verifies server availability, database connectivity, and catalog integrity.
 * Returns HTTP 200 OK with system diagnostics.
 */
export const GET: APIRoute = async () => {
  const startTime = Date.now();
  try {
    // 1. Verify database connectivity via lightweight query
    const [{ ping }] = await db.select({ ping: sql<number>`1` }).from(services).limit(1);

    // 2. Count available services
    const [{ totalServices }] = await db
      .select({ totalServices: sql<number>`count(*)::int` })
      .from(services);

    const latencyMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status: 'ok',
        healthy: true,
        timestamp: new Date().toISOString(),
        latencyMs,
        checks: {
          server: 'healthy',
          database: ping === 1 ? 'connected' : 'degraded',
          catalog: totalServices > 0 ? 'available' : 'empty',
        },
        servicesCount: totalServices,
        version: '0.1.0',
        environment: typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD ? 'production' : 'development',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        status: 'degraded',
        healthy: false,
        timestamp: new Date().toISOString(),
        latencyMs,
        checks: {
          server: 'healthy',
          database: 'disconnected',
          catalog: 'unavailable',
        },
        error: error?.message || 'Database health check failed',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
};
