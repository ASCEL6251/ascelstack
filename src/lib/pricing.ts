// Pricing helpers. Source data: Neon database `service_pricing` table,
// with static fallback from src/data/pricing.json. All prices exclude 18% GST.

import raw from '../data/pricing.json' with { type: 'json' };
import { BASE_CURRENCY, formatMoney, type CurrencyCode } from './currency.ts';

export type BizSize = 'small' | 'mid';
export type Recurrence = 'once' | 'month' | 'quarter' | 'year';

export interface Tier {
  price: number | null;
  /** Non-numeric price, e.g. "15% of campaign budget". */
  text: string;
  unit: string;
  detail: string;
}

export interface Package {
  key: string;
  name: string;
  price: number | null;
  includes: string;
  delivery: string;
  notes: string;
}

export interface Pricing {
  id: string;
  status: 'open' | 'soon';
  type: 'package' | 'fixed' | 'starting';
  small: Tier;
  mid: Tier;
  billing: string;
  market: string;
  notes: string;
  packages?: Package[];
}

export const staticPricing = raw as Record<string, Pricing>;
export const pricing = staticPricing;
export const GST_RATE = 0.18;

// Client-side dynamic pricing cache
declare global {
  interface Window {
    __ASCEL_PRICING__?: Record<string, Pricing>;
  }
}

/**
 * Gets pricing for a service.
 * In the browser, prioritizes live dynamic pricing updated from Neon;
 * falls back to static catalog.
 */
export function getPricing(id: string): Pricing | undefined {
  if (typeof window !== 'undefined' && window.__ASCEL_PRICING__ && window.__ASCEL_PRICING__[id]) {
    return window.__ASCEL_PRICING__[id];
  }
  return pricing[id];
}

/**
 * Update browser dynamic pricing cache and dispatch change event
 */
export function updateClientPricing(id: string, p: Pricing) {
  if (typeof window === 'undefined') return;
  if (!window.__ASCEL_PRICING__) {
    window.__ASCEL_PRICING__ = { ...pricing };
  }
  window.__ASCEL_PRICING__[id] = p;
  window.dispatchEvent(new CustomEvent('ascel:pricing-change', { detail: { id, pricing: p } }));
}

/**
 * Update full client pricing map
 */
export function setClientPricingMap(map: Record<string, Pricing>) {
  if (typeof window === 'undefined') return;
  window.__ASCEL_PRICING__ = { ...pricing, ...map };
  window.dispatchEvent(new CustomEvent('ascel:pricing-reload', { detail: { map: window.__ASCEL_PRICING__ } }));
}

/**
 * Maps a raw database row from service_pricing table to the application Pricing interface
 */
export function dbRowToPricing(row: any): Pricing {
  const smallPrice = row.smallPrice !== null && row.smallPrice !== undefined
    ? Number(row.smallPrice)
    : (row.small_price !== null && row.small_price !== undefined ? Number(row.small_price) : null);

  const midPrice = row.midPrice !== null && row.midPrice !== undefined
    ? Number(row.midPrice)
    : (row.mid_price !== null && row.mid_price !== undefined ? Number(row.mid_price) : null);

  let pkgs: Package[] = [];
  if (Array.isArray(row.packages)) {
    pkgs = row.packages;
  } else if (typeof row.packages === 'string') {
    try {
      pkgs = JSON.parse(row.packages);
    } catch {}
  }

  return {
    id: row.serviceCode || row.service_code || row.id,
    status: (row.status === 'open' ? 'open' : 'soon') as 'open' | 'soon',
    type: (row.type || 'starting') as 'package' | 'fixed' | 'starting',
    small: {
      price: isNaN(smallPrice as number) ? null : smallPrice,
      text: row.smallText ?? row.small_text ?? '',
      unit: row.smallUnit ?? row.small_unit ?? '',
      detail: row.smallDetail ?? row.small_detail ?? '',
    },
    mid: {
      price: isNaN(midPrice as number) ? null : midPrice,
      text: row.midText ?? row.mid_text ?? '',
      unit: row.midUnit ?? row.mid_unit ?? '',
      detail: row.midDetail ?? row.mid_detail ?? '',
    },
    billing: row.billing ?? '',
    market: row.market ?? '',
    notes: row.notes ?? '',
    packages: pkgs.length ? pkgs : undefined,
  };
}

/** Format an amount in the base currency (INR). Admin screens use this; the public site uses formatMoney. */
export const formatINR = (n: number) => formatMoney(n, BASE_CURRENCY);

/** Turns a unit label ("per month", "per SKU", "one-time setup") into how it bills. */
export function parseUnit(unit: string): { recurrence: Recurrence; per: string | null } {
  const u = (unit || '').toLowerCase();
  let recurrence: Recurrence = 'once';
  if (/\/\s*month|per month/.test(u)) recurrence = 'month';
  else if (/per quarter/.test(u)) recurrence = 'quarter';
  else if (/per year/.test(u)) recurrence = 'year';

  // "per server / month" → per server; "per SKU" → per SKU
  const m = (unit || '').trim().match(/^per ([a-z ]+?)(?:\s*\/.*)?(?:\s*\(.*\))?(?: \+.*)?$/i);
  const per = m && !['month', 'quarter', 'year'].includes(m[1].trim().toLowerCase()) ? m[1].trim() : null;
  return { recurrence, per };
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'One-time',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
};
export const RECURRENCE_SUFFIX: Record<Recurrence, string> = { once: '', month: '/mo', quarter: '/qtr', year: '/yr' };

export interface Quote {
  /** Unit price, null when it can only be quoted (%, N/A, custom package). */
  price: number | null;
  text: string;
  recurrence: Recurrence;
  per: string | null;
  label: string;
  isStarting: boolean;
}

/** Price one line of the cart for the chosen business size and package. */
export function quote(p: Pricing, size: BizSize, pkgKey?: string): Quote {
  if (p.type === 'package' && p.packages && p.packages.length) {
    const pkg = p.packages.find((x) => x.key === pkgKey) ?? p.packages[0];
    return {
      price: pkg.price,
      text: pkg.price === null ? 'Custom quote' : '',
      recurrence: 'once',
      per: null,
      label: `${pkg.name} package`,
      isStarting: false,
    };
  }
  const t = p[size] || p.small || { price: null, text: '', unit: '', detail: '' };
  const { recurrence, per } = parseUnit(t.unit);
  return {
    price: t.price,
    text: t.price === null ? t.text : '',
    recurrence,
    per,
    label: t.unit,
    isStarting: p.type === 'starting',
  };
}

/**
 * Short "From ₹2,999" style label for cards.
 * `amount` is formatted in `currency` (base currency by default); `base` is the raw
 * amount in the base currency so the browser can re-render it in another currency.
 */
export function cardPrice(
  p: Pricing,
  currency: CurrencyCode = BASE_CURRENCY,
): { amount: string; unit: string; prefix: string; base: number | null } {
  const t = p.small?.price !== null && p.small?.price !== undefined ? p.small : p.mid;
  if (!t || t.price === null || t.price === undefined) return { amount: 'On quote', unit: t?.text || '', prefix: '', base: null };
  const { recurrence, per } = parseUnit(p.type === 'package' ? 'one-time' : t.unit);
  const unit = per
    ? `per ${per}`
    : recurrence !== 'once'
      ? `per ${recurrence}`
      : t.unit?.includes('govt') ? 'one-time + govt fee' : 'one-time';
  return {
    amount: formatMoney(t.price, currency),
    unit,
    prefix: p.type === 'fixed' ? '' : 'From',
    base: t.price,
  };
}
