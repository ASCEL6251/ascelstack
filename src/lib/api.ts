import type { User } from './mock-auth';
import type { Cart } from './cart';
import { buildEstimate, type Estimate } from './estimate';

export type EstimateStatus = 'submitted' | 'in_review' | 'quoted' | 'accepted';

export interface SavedEstimate {
  id: string;
  userId: string;
  createdAt: number;
  status: EstimateStatus;
  note: string;
  cart: Cart;
  totals: { recurrence: string; subtotal: number; gst: number; total: number }[];
  onQuoteCount: number;
}

export async function submitEstimate(user: User, cart: Cart, note = ''): Promise<SavedEstimate> {
  const est: Estimate = buildEstimate(cart);

  // Submit to real Neon PostgreSQL API
  const res = await fetch('/api/customer/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cart,
      note,
      totals: est.groups,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to submit estimate to server');
  }

  const result = await res.json();
  const estimateId = result.estimateId || `EST-${Date.now().toString(36).toUpperCase()}`;

  const saved: SavedEstimate = {
    id: estimateId,
    userId: user.id,
    createdAt: Date.now(),
    status: 'submitted',
    note,
    cart: structuredClone(cart),
    totals: est.groups,
    onQuoteCount: est.onQuote.length,
  };

  return saved;
}

export async function listEstimates(_user: User): Promise<any[]> {
  try {
    const res = await fetch('/api/customer/service-requests');
    if (res.ok) {
      const data = await res.json();
      return data.requests || [];
    }
  } catch (e) {
    console.warn('Failed to fetch requests from Neon API:', e);
  }
  return [];
}

export async function getEstimate(_user: User, id: string): Promise<any | null> {
  try {
    const res = await fetch('/api/customer/service-requests');
    if (res.ok) {
      const data = await res.json();
      return (data.requests || []).find((r: any) => r.id === id) ?? null;
    }
  } catch (e) {
    console.warn('Failed to fetch request from Neon API:', e);
  }
  return null;
}
