// Video hero: copy reveal + floating thumbnail cards + IO-based off-screen
// pause for the background video to save bandwidth/battery.

import gsap from 'gsap';

export function initHeroVideo() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hero      = document.getElementById('hero');
  const heroVideo = document.getElementById('hero-video');
  const eyebrow   = hero.querySelector('.hero-video__eyebrow');
  const lines     = hero.querySelectorAll('.hero-video__line');
  const amp       = hero.querySelector('.hero-video__amp');
  const meta      = hero.querySelector('.hero-video__meta');
  const scroll    = hero.querySelector('.hero-video__scroll');
  const thumbs    = hero.querySelectorAll('.hero-thumb');

  // 1. Reveal copy
  if (!reduce) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.8 }, 0.4)
      .to(lines[0], { opacity: 1, y: 0, duration: 0.95 }, 0.6)
      .to(amp,      { opacity: 1, duration: 0.7 }, 1.05)
      .to(lines[1], { opacity: 1, y: 0, duration: 0.95 }, 1.2)
      .to(meta,     { opacity: 1, y: 0, duration: 0.8 }, 1.7)
      .to(scroll,   { opacity: .75, duration: 0.6 }, 2.1);

    // 2. Thumbnail cards float in from the right, staggered
    thumbs.forEach((card, i) => {
      tl.to(card, {
        opacity: 1,
        x: 0,
        duration: 0.85,
        ease: 'power3.out'
      }, 0.9 + i * 0.18);
    });

    // Subtle continuous floating bob on each thumb (different phases)
    thumbs.forEach((card, i) => {
      gsap.to(card, {
        y: -10, duration: 3 + i * 0.4,
        ease: 'sine.inOut', yoyo: true, repeat: -1,
        delay: 1.6 + i * 0.4
      });
    });
  } else {
    // Reduced motion: just show everything
    [eyebrow, ...lines, amp, meta, scroll, ...thumbs].forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }

  // 3. Pause the bg video when off-screen to save battery + bandwidth
  if (heroVideo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) heroVideo.play?.().catch(() => {});
        else heroVideo.pause?.();
      }
    }, { threshold: 0.05 });
    io.observe(hero);
  }

  // 4. If the user prefers reduced motion, hide the looping bg video
  // (poster shows instead). Already handled in CSS, but also pause the
  // element so it doesn't decode frames.
  if (reduce && heroVideo) heroVideo.pause?.();
}
