import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;

export function initMotion() {
  document.documentElement.classList.add('js');

  if (!reducedMotion && !lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis?.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);

    // Smooth in-page anchor links
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href^="/#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const hash = a.getAttribute('href')!.replace(/^\//, '');
        const target = hash.length > 1 ? document.querySelector(hash) : null;
        if (target && location.pathname === '/') {
          e.preventDefault();
          lenis?.scrollTo(target as HTMLElement, { offset: -60 });
        }
      });
    });
  }

  // Reveal on scroll — reverses when scrolling back up.
  const items = gsap.utils.toArray<HTMLElement>('[data-reveal]');
  if (reducedMotion) return;
  items.forEach((el) => {
    const delay = Number(el.dataset.revealDelay ?? 0);
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      delay,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 88%',
        toggleActions: 'play none none reverse',
      },
    });
  });
}

export { gsap, ScrollTrigger };
export const getLenis = () => lenis;
