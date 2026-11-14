// Display currencies for service prices.
//
// Every price in the catalogue (src/data/pricing.json and the Neon `service_pricing`
// table edited from /admin/pricing) is stored in BASE_CURRENCY. Visitors pick a
// display currency from the navbar; prices are converted with the fixed rates below.
//
// To update a rate, change `perUnit`: how many units of BASE_CURRENCY (₹) one unit
// of that currency is worth. Example: USD perUnit 85 means $1 = ₹85.

export const BASE_CURRENCY = 'INR';
export const DEFAULT_CURRENCY = 'USD';

export const CURRENCIES = {
  USD: { code: 'USD', label: 'US dollar', symbol: '$', locale: 'en-US', perUnit: 85 },
  EUR: { code: 'EUR', label: 'Euro', symbol: '€', locale: 'en-IE', perUnit: 99 },
  INR: { code: 'INR', label: 'Indian rupee', symbol: '₹', locale: 'en-IN', perUnit: 1 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Order shown in the selector. */
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];
