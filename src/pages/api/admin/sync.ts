import type { APIRoute } from 'astro';
import { db, quotations, users, quotationHistory, adminActivityLogs } from '../../../db';
import { getAdminSession } from '../../../lib/admin-auth';
import { sql, desc } from 'drizzle-orm';

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

    const acceptsSSE = context.request.headers.get('accept')?.includes('text/event-stream');

    // 1. Get latest database timestamps
    const [latestState] = await db.select({
      maxQuotationUpdate: sql<string | null>`max(${quotations.updatedAt})`,
      maxUserCreation: sql<string | null>`max(${users.createdAt})`,
      maxHistoryCreation: sql<string | null>`max(${quotationHistory.createdAt})`,
      maxAdminLog: sql<string | null>`max(${adminActivityLogs.createdAt})`,
      quotationCount: sql<number>`count(*)::int`,
    }).from(quotations);

    const [{ userCount }] = await db
      .select({ userCount: sql<number>`count(*)::int` })
      .from(users);

    const versionHash = `${latestState.maxQuotationUpdate || ''}_${latestState.maxUserCreation || ''}_${latestState.maxHistoryCreation || ''}_${latestState.quotationCount}_${userCount}`;

    // If client asks for Server-Sent Events (SSE) stream
    if (acceptsSSE) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          // Initial connection handshake
          sendEvent('connected', {
            versionHash,
            timestamp: new Date().toISOString(),
          });

          // Send current state
          sendEvent('sync', {
            versionHash,
            quotationCount: latestState.quotationCount,
            userCount,
            lastUpdated: latestState.maxQuotationUpdate,
          });

          // Cloudflare serverless handlers keep streams active during the request lifecycle
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    // JSON response for polling / delta check
    return new Response(
      JSON.stringify({
        versionHash,
        timestamp: new Date().toISOString(),
        quotationCount: latestState.quotationCount,
        userCount,
        latestQuotationUpdate: latestState.maxQuotationUpdate,
        latestUserCreation: latestState.maxUserCreation,
        latestHistory: latestState.maxHistoryCreation,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/admin/sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Real-time synchronization check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
