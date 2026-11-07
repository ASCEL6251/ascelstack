// Client-side estimate cart. PROTOTYPE: lives in localStorage only.
// Later: sync to Neon (cart_items table) for signed-in users via src/lib/api.ts.

import type { BizSize } from './pricing';

export interface CartItem {
  /** Service ID, e.g. ASC-0001 */
  id: string;
  /** Package key for package-priced services (starter, basic, ... custom). */
  pkg?: string;
  qty: number;
  addedAt: number;
}

export interface Cart {
  items: CartItem[];
  size: BizSize;
}

const KEY = 'asc:cart';
export const CART_EVENT = 'cart:change';

const empty = (): Cart => ({ items: [], size: 'small' });

export function getCart(): Cart {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (c && Array.isArray(c.items)) return { size: c.size === 'mid' ? 'mid' : 'small', items: c.items };
  } catch {}
  return empty();
}

function save(cart: Cart) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {}
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: cart }));
}

const same = (a: CartItem, id: string, pkg?: string) => a.id === id && (a.pkg ?? '') === (pkg ?? '');

export function addItem(id: string, pkg?: string) {
  const cart = getCart();
  const hit = cart.items.find((i) => same(i, id, pkg));
  if (hit) hit.qty += 1;
  else cart.items.push({ id, pkg, qty: 1, addedAt: Date.now() });
  save(cart);
}

export function removeItem(id: string, pkg?: string) {
  const cart = getCart();
  cart.items = cart.items.filter((i) => !same(i, id, pkg));
  save(cart);
}

export function setQty(id: string, pkg: string | undefined, qty: number) {
  const cart = getCart();
  const hit = cart.items.find((i) => same(i, id, pkg));
  if (!hit) return;
  hit.qty = Math.max(1, Math.min(999, Math.round(qty) || 1));
  save(cart);
}

/** Swap the package on a line (merges if that package is already in the cart). */
export function setPackage(id: string, from: string | undefined, to: string) {
  const cart = getCart();
  const line = cart.items.find((i) => same(i, id, from));
  if (!line || from === to) return;
  const dupe = cart.items.find((i) => same(i, id, to));
  if (dupe) {
    dupe.qty += line.qty;
    cart.items = cart.items.filter((i) => i !== line);
  } else line.pkg = to;
  save(cart);
}

export function setSize(size: BizSize) {
  const cart = getCart();
  cart.size = size;
  save(cart);
}

export function clearCart() {
  save({ ...getCart(), items: [] });
}

export const count = (cart = getCart()) => cart.items.reduce((n, i) => n + i.qty, 0);
export const inCart = (id: string, cart = getCart()) => cart.items.some((i) => i.id === id);

/** Run fn now and on every change, including changes from other tabs. */
export function onCart(fn: (cart: Cart) => void) {
  fn(getCart());
  window.addEventListener(CART_EVENT, () => fn(getCart()));
  window.addEventListener('storage', (e) => e.key === KEY && fn(getCart()));
}
