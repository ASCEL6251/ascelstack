// Real-time pricing event broadcaster for SSE connections and server subscribers
type PricingListener = (event: { type: string; code: string; pricing: any; timestamp: number }) => void;

const listeners = new Set<PricingListener>();

export function subscribePricingEvents(fn: PricingListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function broadcastPricingUpdate(code: string, pricing: any) {
  const event = {
    type: 'pricing_updated',
    code,
    pricing,
    timestamp: Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {}
  }
}
