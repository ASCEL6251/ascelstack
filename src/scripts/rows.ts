import { gsap, reducedMotion } from './motion';

/**
 * Reveal service rows in small staggered batches as they come into view.
 * Uses IntersectionObserver (not ScrollTrigger) so rows also appear after
 * jump scrolls: tab clicks, deep links, find-in-page.
 */
export function revealRows(selector = '.rows [data-row]') {
  const rows = gsap.utils.toArray<HTMLElement>(selector);
  if (reducedMotion || !('IntersectionObserver' in window)) {
    gsap.set(rows, { opacity: 1, y: 0 });
    return;
  }

  let queue: HTMLElement[] = [];
  let frame = 0;
  const flush = () => {
    frame = 0;
    const batch = queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    queue = [];
    gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.045, overwrite: true });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          queue.push(el);
          io.unobserve(el);
        } else if (e.boundingClientRect.bottom < 0) {
          // Already scrolled past: show without animating.
          gsap.set(el, { opacity: 1, y: 0 });
          io.unobserve(el);
        }
      }
      if (queue.length && !frame) frame = requestAnimationFrame(flush);
    },
    { rootMargin: '0px 0px -5% 0px' },
  );
  rows.forEach((r) => io.observe(r));
}
