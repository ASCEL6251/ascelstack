import { formatINR, parseUnit, type Pricing, type Package } from '../lib/pricing';

declare global {
  interface Window {
    __ASCEL_PRICING__?: Record<string, Pricing>;
    __ascel_pricing_initialized__?: boolean;
  }
}

/**
 * Compute card price presentation
 */
function getCardPrice(p: Pricing): { amount: string; unit: string; prefix: string } {
  const t = p.small?.price !== null && p.small?.price !== undefined ? p.small : p.mid;
  if (!t || t.price === null || t.price === undefined) {
    return { amount: 'On quote', unit: t?.text || '', prefix: '' };
  }
  const { recurrence, per } = parseUnit(p.type === 'package' ? 'one-time' : t.unit);
  const unit = per
    ? `per ${per}`
    : recurrence !== 'once'
      ? `per ${recurrence}`
      : t.unit && t.unit.includes('govt') ? 'one-time + govt fee' : 'one-time';
  return {
    amount: formatINR(t.price),
    unit,
    prefix: p.type === 'fixed' ? '' : 'From',
  };
}

/**
 * Apply real-time update to ServiceCard DOM elements on the current page
 */
export function applyLivePricingToCard(code: string, p: Pricing) {
  // Update memory cache
  if (!window.__ASCEL_PRICING__) {
    window.__ASCEL_PRICING__ = {};
  }
  window.__ASCEL_PRICING__[code] = p;

  const cards = document.querySelectorAll<HTMLElement>(`article[data-card][data-service-code="${code}"]`);
  for (const card of cards) {
    const isOpen = p.status === 'open';
    const price = getCardPrice(p);
    const typeLabel = { package: '5 packages', fixed: 'Fixed price', starting: 'Starting price' }[p.type] || '';

    // 1. Status badge & class
    card.classList.toggle('card--future', !isOpen);
    const soonBadge = card.querySelector<HTMLElement>('[data-badge-soon]');
    if (soonBadge) soonBadge.hidden = isOpen;

    // 2. Price row
    const priceType = card.querySelector<HTMLElement>('[data-price-type]');
    if (priceType) priceType.textContent = typeLabel;

    const priceFrom = card.querySelector<HTMLElement>('[data-price-from]');
    if (priceFrom) {
      priceFrom.textContent = price.prefix;
      priceFrom.hidden = !price.prefix;
    }

    const priceAmt = card.querySelector<HTMLElement>('[data-price-amt]');
    if (priceAmt) priceAmt.textContent = price.amount;

    const priceUnit = card.querySelector<HTMLElement>('[data-price-unit]');
    if (priceUnit) priceUnit.textContent = price.unit;

    const priceMarket = card.querySelector<HTMLElement>('[data-price-market]');
    if (priceMarket) {
      priceMarket.textContent = p.market ? `Market: ${p.market}` : '';
      priceMarket.hidden = !p.market;
    }

    // 3. Actions
    const actions = card.querySelector<HTMLElement>('[data-card-actions]');
    const enquireLink = card.querySelector<HTMLElement>('[data-card-enquire]');

    if (actions) {
      if (isOpen) {
        const isPkg = p.type === 'package';
        actions.innerHTML = `
          <button type="button" class="card-add" data-add="${code}">
            <span class="card-add-label" data-add-label>${isPkg ? 'Choose package' : 'Add to estimate'}</span>
            <span class="card-add-plus" aria-hidden="true">+</span>
          </button>
          <a class="card-link" href="/contact?service=${code}" data-card-enquire>Enquire</a>
        `;
      } else {
        actions.innerHTML = `
          <a class="card-cta" href="/contact?service=${code}">
            Register interest <span class="arrow">→</span>
          </a>
        `;
      }
    } else if (enquireLink) {
      enquireLink.hidden = !isOpen;
    }

    // 4. Subtle flash highlight to indicate live update
    card.classList.remove('is-live-updated');
    void card.offsetWidth; // trigger reflow
    card.classList.add('is-live-updated');
  }

  // Also update Customer Portal Explore Cards if present
  const exploreCards = document.querySelectorAll<HTMLElement>(`.explore-card[data-code="${code}"]`);
  for (const card of exploreCards) {
    const isOpen = p.status === 'open';
    const price = getCardPrice(p);
    const badge = card.querySelector('.card-badge-soft');
    if (badge) badge.textContent = isOpen ? 'Live' : 'Coming Soon';

    const amt = card.querySelector('.explore-price-amt');
    if (amt) amt.textContent = price.amount;
  }

  // Dispatch global window event
  window.dispatchEvent(new CustomEvent('ascel:pricing-update', { detail: { code, pricing: p } }));
}

/**
 * Initialize real-time pricing synchronization
 */
export function initRealtimePricing() {
  if (typeof window === 'undefined' || window.__ascel_pricing_initialized__) return;
  window.__ascel_pricing_initialized__ = true;

  // 1. Initial background fetch to hydrate any fresh Neon changes
  fetch('/api/pricing')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data?.pricing) {
        window.__ASCEL_PRICING__ = data.pricing;
        for (const [code, p] of Object.entries(data.pricing as Record<string, Pricing>)) {
          applyLivePricingToCard(code, p);
        }
      }
    })
    .catch(() => {});

  // 2. BroadcastChannel for instant multi-tab sync
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('ascel_pricing');
    channel.onmessage = (e) => {
      if (e.data?.type === 'pricing_updated' && e.data?.code && e.data?.pricing) {
        applyLivePricingToCard(e.data.code, e.data.pricing);
      }
    };
  }

  // 3. Server-Sent Events (SSE) for server-to-client push
  let sse: EventSource | null = null;
  function connectSSE() {
    try {
      sse = new EventSource('/api/pricing/stream');
      sse.addEventListener('update', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.code && data?.pricing) {
            applyLivePricingToCard(data.code, data.pricing);
          }
        } catch {}
      });
      sse.onerror = () => {
        if (sse) sse.close();
        setTimeout(connectSSE, 10000); // Reconnect after 10s
      };
    } catch {}
  }

  connectSSE();

  // 4. Fallback Polling every 12 seconds
  setInterval(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.pricing) {
          const current = window.__ASCEL_PRICING__ || {};
          for (const [code, p] of Object.entries(data.pricing as Record<string, Pricing>)) {
            // Check if status or price changed
            if (
              !current[code] ||
              current[code].status !== p.status ||
              current[code].small?.price !== p.small?.price ||
              current[code].type !== p.type
            ) {
              applyLivePricingToCard(code, p);
            }
          }
        }
      })
      .catch(() => {});
  }, 12000);
}

// Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealtimePricing);
  } else {
    initRealtimePricing();
  }
}
