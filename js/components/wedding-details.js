// Wedding Details section animations:
//  - Polaroid floats in from left at -10deg as the section enters view
//  - Icon rows stagger fade+slide from the right
//  - Line-drawn SVG icons animate stroke-dashoffset on each row's reveal

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initWeddingDetails() {
  const section = document.getElementById('wedding-details');
  if (!section) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // CSS reduced-motion overrides handle the static state; nothing to wire.
    return;
  }

  const polaroid = section.querySelector('.polaroid');
  const rows     = section.querySelectorAll('.details__row');
  const icons    = section.querySelectorAll('.line-icon');

  // Header chars are split by the global setupScrollReveals; this module owns
  // the polaroid + rows + icons.

  ScrollTrigger.create({
    trigger: section,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      // Polaroid: slide in from left, settling at a -6deg tilt
      gsap.to(polaroid, {
        opacity: 1,
        x: 0,
        rotate: -6,
        duration: 1.1,
        ease: 'power3.out'
      });

      // Rows: stagger from right
      gsap.to(rows, {
        opacity: 1,
        x: 0,
        duration: 0.7,
        stagger: 0.18,
        ease: 'power3.out',
        delay: 0.3
      });

      // Icons: draw their strokes per row, slightly offset from the row entry
      icons.forEach((svg, i) => {
        setTimeout(() => svg.classList.add('is-drawn'), 500 + i * 180);
      });
    }
  });
}
