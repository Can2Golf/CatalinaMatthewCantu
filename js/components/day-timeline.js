// The Day Timeline — stacking cards on scroll.
//
// Single pinned ScrollTrigger driving one timeline. Card 2..N each take
// 1/(N-1) of the timeline to slide their translateY from 100% -> 0%.
// Content reveals fire via tl.call() at the right progress points.
//
// One trigger means one set of scroll handlers per frame, instead of N+1.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initDayTimeline() {
  const section = document.getElementById('day-timeline');
  if (!section) return;
  const stack = section.querySelector('.day-stack');
  const cards = Array.from(stack.querySelectorAll('.day-card'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) {
    cards.forEach(card => animateCardIn(card, /*instant*/ true));
    return;
  }

  // Reveal first card on initial entry to the stack
  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: () => animateCardIn(cards[0])
  });

  // One timeline drives the whole stack
  const segments = cards.length - 1;       // number of card transitions
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: stack,
      start: 'top top',
      end: () => `+=${segments * window.innerHeight}`,
      pin: true,
      pinSpacing: true,
      scrub: true,                        // tied directly to scroll, no smoothing inertia
      anticipatePin: 1
    }
  });

  // For each card after the first, slide it from y:100% -> 0% over 1 unit
  cards.slice(1).forEach((card, i) => {
    tl.fromTo(card, { y: '100%' }, { y: '0%', ease: 'none', duration: 1 }, i);

    // Fire the card's content reveal once it has covered ~85% of the way.
    // Forward = onEnter; backward = un-reveal so re-scrolling re-plays it.
    tl.call(() => animateCardIn(card),    null, i + 0.85);
    tl.call(() => resetCardIn(card),      null, i + 0.05);
  });
}

function animateCardIn(card, instant = false) {
  if (card.dataset.revealed === '1' && !instant) return;
  card.dataset.revealed = '1';

  const time = card.querySelector('.day-card__time');
  const rule = card.querySelector('.day-card__rule');
  const icon = card.querySelector('.line-icon');
  const name = card.querySelector('.day-card__name');
  const sub  = card.querySelector('.day-card__sub');
  const wrap = card.querySelector('.day-card__icon-wrap');

  if (instant) {
    gsap.set([time, name, sub, wrap], { opacity: 1, y: 0 });
    gsap.set(rule, { scaleX: 1 });
    icon?.classList.add('is-drawn');
    return;
  }

  const t = gsap.timeline({ defaults: { ease: 'power3.out' } });
  t.fromTo(time, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, 0)
   .fromTo(rule, { scaleX: 0, transformOrigin: 'center' }, { scaleX: 1, duration: 0.45 }, 0.2)
   .fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.32)
   .fromTo(name, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, 0.45)
   .fromTo(sub,  { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.55 }, 0.6);

  setTimeout(() => icon?.classList.add('is-drawn'), 380);
}

function resetCardIn(card) {
  if (card.dataset.revealed !== '1') return;
  card.dataset.revealed = '';

  const time = card.querySelector('.day-card__time');
  const rule = card.querySelector('.day-card__rule');
  const icon = card.querySelector('.line-icon');
  const name = card.querySelector('.day-card__name');
  const sub  = card.querySelector('.day-card__sub');
  const wrap = card.querySelector('.day-card__icon-wrap');

  gsap.set([time, name, sub, wrap], { opacity: 0, y: 20 });
  gsap.set(rule, { scaleX: 0 });
  icon?.classList.remove('is-drawn');
}
