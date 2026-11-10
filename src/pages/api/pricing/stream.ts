import type { APIRoute } from 'astro';
import { subscribePricingEvents } from '../../../lib/pricing-events';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;
  let keepAliveInterval: any = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`)
      );

      // Subscribe to real-time pricing updates
      cleanup = subscribePricingEvents((evt) => {
        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(evt)}\n\n`)
          );
        } catch {}
      });

      // Keepalive ping every 20 seconds
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 20000);
    },
    cancel() {
      if (cleanup) cleanup();
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};
