// Shared conversion and formatting for every service price on the site.
// Amounts in data are always in BASE_CURRENCY (INR); this module converts them to
// the visitor's chosen display currency. Rates live in src/config/currency.ts.
//
// Server-rendered prices are printed in DEFAULT_CURRENCY and tagged so the browser
// can re-render them in the visitor's currency:
//   data-money="2999"              → element text becomes formatMoney(2999)
//   data-money-text="Market: ₹5,000–₹50,000" → ₹ amounts inside the text are converted

import { BASE_CURRENCY, CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, type CurrencyCode } from '../config/currency.ts';

export { BASE_CURRENCY, CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, type CurrencyCode };

/** localStorage key holding the visitor's choice (a functional preference, not tracking). */
export const CURRENCY_KEY = 'asc:currency';
/** Fired on window after the display currency changes. detail: { currency } */
export const CURRENCY_EVENT = 'ascel:currency-change';

export const isCurrency = (c: unknown): c is CurrencyCode => typeof c === 'string' && c in CURRENCIES;

/** The visitor's display currency. Always DEFAULT_CURRENCY on the server. */
export function getCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (isCurrency(saved)) return saved;
  } catch {}
  return DEFAULT_CURRENCY;
}

export function setCurrency(c: CurrencyCode) {
  if (typeof window === 'undefined' || !isCurrency(c)) return;
  try {
    localStorage.setItem(CURRENCY_KEY, c);
  } catch {}
  applyCurrency();
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: { currency: c } }));
}

/** Convert an amount in BASE_CURRENCY to `to`. */
export function convert(amount: number, to: CurrencyCode = getCurrency()): number {
  return amount / CURRENCIES[to].perUnit;
}

const formatters = new Map<string, Intl.NumberFormat>();
function formatter(c: CurrencyCode, digits: number) {
  const key = `${c}:${digits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCIES[c].locale, {
      style: 'currency',
      currency: c,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Format an amount given in BASE_CURRENCY, e.g. formatMoney(2999, 'USD') → "$35". */
export function formatMoney(amount: number, to: CurrencyCode = getCurrency()): string {
  const v = convert(amount, to);
  // Whole units read best for prices; keep cents only for small converted amounts.
  const digits = to !== BASE_CURRENCY && Math.abs(v) < 10 && Math.round(v) !== v ? 2 : 0;
  return formatter(to, digits).format(digits ? v : Math.round(v));
}

// ₹2,999 · ₹2,00,000 · ₹1.5L · ₹10k · ₹2Cr
const RUPEE_AMOUNT = /₹\s?(\d[\d,]*(?:\.\d+)?)(?:(k|K|L|Cr)(?![A-Za-z]))?/g;
const MULTIPLIER: Record<string, number> = { k: 1e3, K: 1e3, L: 1e5, Cr: 1e7 };

/** Convert every ₹ amount inside free text (market rates, notes, details). */
export function convertPriceText(text: string, to: CurrencyCode = getCurrency()): string {
  if (!text || to === BASE_CURRENCY) return text;
  return text.replace(RUPEE_AMOUNT, (match, num: string, suffix?: string) => {
    const n = Number(num.replace(/,/g, '')) * (suffix ? MULTIPLIER[suffix] : 1);
    return Number.isFinite(n) ? formatMoney(n, to) : match;
  });
}

/** Re-render every tagged price under `root` in the current currency. */
export function applyCurrency(root: ParentNode = document, to: CurrencyCode = getCurrency()) {
  root.querySelectorAll<HTMLElement>('[data-money]').forEach((el) => {
    const raw = el.dataset.money;
    if (raw === undefined || raw === '') return;
    const n = Number(raw);
    if (Number.isFinite(n)) el.textContent = formatMoney(n, to);
  });
  root.querySelectorAll<HTMLElement>('[data-money-text]').forEach((el) => {
    el.textContent = convertPriceText(el.dataset.moneyText ?? '', to);
  });
  if (root === document) document.documentElement.dataset.currency = to;
}

/** Run fn now and whenever the currency changes, including from another tab. */
export function onCurrency(fn: (c: CurrencyCode) => void) {
  fn(getCurrency());
  window.addEventListener(CURRENCY_EVENT, () => fn(getCurrency()));
  window.addEventListener('storage', (e) => {
    if (e.key !== CURRENCY_KEY) return;
    applyCurrency();
    fn(getCurrency());
  });
}
