// The Day Timeline — stacking cards on scroll.
//
// Layout:
//   #day-timeline
//     .day-timeline__header (normal flow)
//     .day-stack (height: 100vh, overflow: hidden)
//       .day-card[1..N]   (absolutely positioned, layered)
//
// Behavior:
//   - Pin .day-stack while the user scrolls (N-1) viewport heights.
//   - Cards 2..N start translateY(100%) (offscreen below) and animate to 0
//     each across one viewport's worth of scroll, in sequence.
//   - When each card lands (progress = 1), its content reveals: time fades up,
//     icon strokes draw in, name + sub fade in, divider scales out from center.
//
// The first card's content reveals on initial enter.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initDayTimeline() {
  const section = document.getElementById('day-timeline');
  if (!section) return;
  const stack = section.querySelector('.day-stack');
  const cards = Array.from(stack.querySelectorAll('.day-card'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) {
    // Reduced motion: cards collapse into a vertical stack via CSS overrides.
    cards.forEach(card => animateCardIn(card, /*instant*/ true));
    return;
  }

  // Reveal first card's content on entry
  ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    once: true,
    onEnter: () => animateCardIn(cards[0])
  });

  // Pin the stack while user scrolls (N-1) viewports
  const totalCards = cards.length;
  ScrollTrigger.create({
    trigger: stack,
    start: 'top top',
    end: () => `+=${(totalCards - 1) * window.innerHeight}`,
    pin: true,
    pinSpacing: true,
    invalidateOnRefresh: true
  });

  // Each subsequent card slides up from below as the user scrolls past its
  // segment of the pinned section. We use scrub for the y movement, and a
  // separate ScrollTrigger to fire content reveals when the card lands.
  cards.forEach((card, i) => {
    if (i === 0) return;
    const segStart = (i - 1) * window.innerHeight;
    const segEnd   = i * window.innerHeight;

    gsap.fromTo(card,
      { y: '100%' },
      {
        y: '0%',
        ease: 'none',
        scrollTrigger: {
          trigger: stack,
          start: () => `top+=${segStart} top`,
          end:   () => `top+=${segEnd} top`,
          scrub: 1,
          invalidateOnRefresh: true
        }
      }
    );

    // When this card has fully covered the previous (progress > 0.85),
    // play its content arrival animation. Reverse it on scroll back.
    let played = false;
    ScrollTrigger.create({
      trigger: stack,
      start: () => `top+=${segStart + window.innerHeight * 0.65} top`,
      end:   () => `top+=${segEnd} top`,
      onEnter: () => { if (!played) { animateCardIn(card); played = true; } },
      onLeaveBack: () => { played = false; resetCardIn(card); }
    });
  });

  // Refresh ScrollTrigger after layout settles (fonts, images, viewport)
  setTimeout(() => ScrollTrigger.refresh(), 600);
}

function animateCardIn(card, instant = false) {
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

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.fromTo(time, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7 }, 0)
    .fromTo(rule, { scaleX: 0, transformOrigin: 'center' }, { scaleX: 1, duration: 0.55 }, 0.25)
    .fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.4)
    .fromTo(name, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.65 }, 0.6)
    .fromTo(sub,  { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6 }, 0.78);

  // Icon stroke draw-in (CSS handles the actual stroke transition)
  setTimeout(() => icon?.classList.add('is-drawn'), 500);
}

function resetCardIn(card) {
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
