// Cinematic intro: particle canvas + GSAP-staggered text reveal + CTA exit.

import gsap from 'gsap';

const COLORS = ['#d4a853', '#f0c878', '#f2e4c4'];

class Particle {
  constructor(w, h, isStar = false) {
    this.w = w; this.h = h;
    this.isStar = isStar;
    this.reset(true);
  }
  reset(initial = false) {
    this.x = Math.random() * this.w;
    this.y = initial ? Math.random() * this.h : this.h + Math.random() * 60;
    this.size = this.isStar ? 0.8 + Math.random() * 0.8 : 1 + Math.random() * 3;
    this.speed = 0.15 + Math.random() * 0.55;
    this.drift = (Math.random() - 0.5) * 0.25;
    this.opacityBase = this.isStar ? 0.5 + Math.random() * 0.5 : 0.25 + Math.random() * 0.55;
    this.opacity = 0;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.twinklePhase = Math.random() * Math.PI * 2;
    this.twinkleSpeed = 1.5 + Math.random() * 2.5;
  }
  step(dt, t) {
    this.y -= this.speed;
    this.x += this.drift;
    // Fade in near bottom, fade out near top
    const yRatio = 1 - this.y / this.h;
    let alpha = this.opacityBase;
    if (yRatio < 0.15) alpha *= yRatio / 0.15;
    if (yRatio > 0.85) alpha *= (1 - yRatio) / 0.15;
    if (this.isStar) {
      alpha *= 0.6 + 0.4 * Math.sin(t * this.twinkleSpeed + this.twinklePhase);
    }
    this.opacity = Math.max(0, alpha);

    if (this.y < -10 || this.x < -20 || this.x > this.w + 20) {
      this.reset();
    }
  }
  draw(ctx) {
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    if (this.isStar) {
      ctx.globalAlpha = this.opacity * 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class IntroParticles {
  constructor(canvas, count = 130) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.count = count;
    this._t0 = performance.now();
    this._lastFrame = this._t0;
    this._stopped = false;

    this._resize = this._resize.bind(this);
    this._step = this._step.bind(this);

    this._resize();
    window.addEventListener('resize', this._resize);
    this._init();
    requestAnimationFrame(this._step);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, Math.floor(r.width  * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
    this.particles.forEach(p => { p.w = this.w; p.h = this.h; });
  }
  _init() {
    for (let i = 0; i < this.count; i++) {
      const isStar = Math.random() < 0.3;
      this.particles.push(new Particle(this.w, this.h, isStar));
    }
  }
  _step(now) {
    if (this._stopped) return;
    const dt = (now - this._lastFrame) / 1000;
    const t = (now - this._t0) / 1000;
    this._lastFrame = now;

    this.ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      p.step(dt, t);
      p.draw(this.ctx);
    }
    this.ctx.globalAlpha = 1;
    requestAnimationFrame(this._step);
  }
  /** Accelerate particles upward and fade — for exit. */
  exitBurst(duration = 1.2) {
    return gsap.to(this.particles, {
      duration,
      ease: 'power3.in',
      onUpdate: () => {
        for (const p of this.particles) {
          p.speed *= 1 + (1 / 60);
          p.opacityBase *= 0.985;
        }
      }
    });
  }
  destroy() {
    this._stopped = true;
    window.removeEventListener('resize', this._resize);
  }
}

/**
 * Run the staggered text reveal timeline.
 * Returns a GSAP timeline, .then() it for completion.
 */
export function playIntroReveal(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return gsap.timeline();

  const names    = root.querySelectorAll('.intro__name');
  const amp      = root.querySelector('.intro__amp');
  const lines    = root.querySelectorAll('.intro__divider-line');
  const diamond  = root.querySelector('.intro__divider-diamond');
  const subtitle = root.querySelector('.intro__subtitle');
  const metas    = root.querySelectorAll('.intro__meta');
  const cta      = root.querySelector('#intro-cta');

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.to(names[0], { opacity: 1, y: 0, duration: 1.0 }, 0.3)
    .to(amp,      { opacity: 1, duration: 0.8 }, 0.8)
    .to(names[1], { opacity: 1, y: 0, duration: 1.0 }, 1.1)
    .to(lines,    { scaleX: 1, duration: 0.9, stagger: 0.08, ease: 'power2.out' }, 1.8)
    .to(diamond,  { scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, 1.95)
    .to(subtitle, { opacity: 1, duration: 0.9 }, 2.2)
    .to(metas,    { opacity: 1, duration: 0.9, stagger: 0.12 }, 2.6)
    .to(cta,      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 3.2);
  return tl;
}

/**
 * Exit animation when CTA is clicked. Returns a GSAP timeline.
 */
export function playIntroExit(root) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.in' } });
  const left  = root.querySelector('.intro__name:first-of-type');
  const right = root.querySelector('.intro__name:last-of-type');
  const amp   = root.querySelector('.intro__amp');
  const rest  = root.querySelectorAll('.intro__divider, .intro__subtitle, .intro__meta, #intro-cta');

  tl.to(left,  { x: -60, opacity: 0, duration: 0.7 }, 0)
    .to(right, { x:  60, opacity: 0, duration: 0.7 }, 0)
    .to(amp,   { scale: 1.3, opacity: 0, duration: 0.7 }, 0)
    .to(rest,  { y: -20, opacity: 0, duration: 0.5, stagger: 0.05 }, 0.05)
    .to(root,  { opacity: 0, duration: 0.6 }, 0.55);

  return tl;
}
