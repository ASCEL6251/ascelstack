// MOCK BACKEND — prototype only. Every function here stands in for a future
// API route backed by Neon Postgres (see db/schema.sql). Data is kept in
// localStorage so the full flow (cart → sign in → submit → account) can be
// clicked through. Keep the signatures when wiring the real endpoints:
//
//   submitEstimate  → POST /api/estimates     (insert estimates + estimate_items)
//   listEstimates   → GET  /api/estimates     (rows for the Clerk user id)
//   getEstimate     → GET  /api/estimates/:id

import type { User } from './auth';
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
  /** Snapshot of totals at submit time, so later price changes don't rewrite history. */
  totals: { recurrence: string; subtotal: number; gst: number; total: number }[];
  onQuoteCount: number;
}

const KEY = 'asc:mock-estimates';
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const readAll = (): SavedEstimate[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
};

export async function submitEstimate(user: User, cart: Cart, note = ''): Promise<SavedEstimate> {
  await delay();
  const est: Estimate = buildEstimate(cart);
  const saved: SavedEstimate = {
    id: `EST-${Date.now().toString(36).toUpperCase()}`,
    userId: user.id,
    createdAt: Date.now(),
    status: 'submitted',
    note,
    cart: structuredClone(cart),
    totals: est.groups,
    onQuoteCount: est.onQuote.length,
  };
  localStorage.setItem(KEY, JSON.stringify([saved, ...readAll()]));
  return saved;
}

export async function listEstimates(user: User): Promise<SavedEstimate[]> {
  await delay(150);
  return readAll().filter((e) => e.userId === user.id);
}

export async function getEstimate(user: User, id: string): Promise<SavedEstimate | null> {
  await delay(150);
  return readAll().find((e) => e.userId === user.id && e.id === id) ?? null;
}
