// Turns a cart into a priced estimate. Pure function, safe to reuse server-side later.

import raw from '../data/services.json';
import type { Cart } from './cart';
import { GST_RATE, getPricing, quote, type BizSize, type Quote, type Recurrence, type Pricing } from './pricing';

const names = Object.fromEntries((raw as { id: string; name: string; category: string }[]).map((s) => [s.id, s]));

export interface EstimateLine {
  id: string;
  pkg?: string;
  name: string;
  category: string;
  qty: number;
  pricing: Pricing;
  quote: Quote;
  /** price × qty, null when on quote */
  total: number | null;
}

export interface EstimateGroup {
  recurrence: Recurrence;
  subtotal: number;
  gst: number;
  total: number;
}

export interface Estimate {
  size: BizSize;
  lines: EstimateLine[];
  groups: EstimateGroup[];
  onQuote: EstimateLine[];
  hasStarting: boolean;
}

const ORDER: Recurrence[] = ['once', 'month', 'quarter', 'year'];

export function buildEstimate(cart: Cart): Estimate {
  const lines: EstimateLine[] = [];
  for (const item of cart.items) {
    const p = getPricing(item.id);
    if (!p) continue;
    const q = quote(p, cart.size, item.pkg);
    lines.push({
      id: item.id,
      pkg: item.pkg,
      name: names[item.id]?.name ?? item.id,
      category: names[item.id]?.category ?? '',
      qty: item.qty,
      pricing: p,
      quote: q,
      total: q.price === null ? null : q.price * item.qty,
    });
  }

  const sums = new Map<Recurrence, number>();
  for (const l of lines) if (l.total !== null) sums.set(l.quote.recurrence, (sums.get(l.quote.recurrence) ?? 0) + l.total);
  const groups = ORDER.filter((r) => sums.has(r)).map((r) => {
    const subtotal = sums.get(r)!;
    const gst = Math.round(subtotal * GST_RATE);
    return { recurrence: r, subtotal, gst, total: subtotal + gst };
  });

  return {
    size: cart.size,
    lines,
    groups,
    onQuote: lines.filter((l) => l.total === null),
    hasStarting: lines.some((l) => l.quote.isStarting),
  };
}
