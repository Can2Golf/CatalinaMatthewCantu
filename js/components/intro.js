// Intro: theater curtain split, particle burst+drift, letter-blur reveal,
// handwriting "Catalina", and shatter exit.
//
// State machine:
//   1. Curtains start closed (full-screen).
//   2. window load -> particles in burst mode -> curtains pull apart.
//   3. As curtains finish, particles transition to slow upward drift.
//   4. GSAP timeline reveals letters / divider / subtitle / meta / CTA.
//   5. CSS gold sweep auto-plays (.intro.is-revealed).
//   6. CTA click -> shatter letters + implode particles -> white flash -> done.

import gsap from 'gsap';

const COLORS = ['#d4a853', '#f0c878', '#f2e4c4', '#ffe4a8'];

class Particle {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.mode = 'idle';
    this.reset(true);
  }
  reset(initial = false) {
    this.x = Math.random() * this.w;
    this.y = initial ? Math.random() * this.h : this.h + Math.random() * 60;
    this.size = Math.random() < 0.18 ? 3 + Math.random() * 3.5 : 1 + Math.random() * 2;
    this.vy = -(0.18 + Math.random() * 0.6);
    this.vx = (Math.random() - 0.5) * 0.25;
    this.opacityBase = 0.3 + Math.random() * 0.55;
    this.opacity = 0;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.twinkle = Math.random() * Math.PI * 2;
    this.twinkleSpd = 1.5 + Math.random() * 2.5;
    this.trail = this.size > 2.2;     // bigger particles leave a trail
    this.trailX = []; this.trailY = [];
    this.dead = false;
  }
  /**
   * Re-spawn at center of viewport with outward radial velocity. Used for
   * the explosion burst when the curtains open. Smaller particles travel
   * faster than bigger ones for a fireworks read.
   */
  burstFromCenter() {
    this.x = this.w / 2;
    this.y = this.h / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.opacity = this.opacityBase;
    this.mode = 'burst';
    this._burstAge = 0;
    this.trailX.length = this.trailY.length = 0;
  }
  step(dt, t) {
    if (this.mode === 'burst') {
      this._burstAge += dt;
      // Decay velocity over ~1.2s, then transition to drift
      const decay = Math.exp(-this._burstAge * 2.5);
      this.x += this.vx * decay * 1.6;
      this.y += this.vy * decay * 1.6;
      // Bigger particles leave brief light trails
      if (this.trail) {
        this.trailX.unshift(this.x); this.trailY.unshift(this.y);
        if (this.trailX.length > 6) { this.trailX.pop(); this.trailY.pop(); }
      }
      if (this._burstAge > 1.2) {
        this.mode = 'drift';
        // Re-base velocity to gentle upward float
        this.vy = -(0.2 + Math.random() * 0.55);
        this.vx = (Math.random() - 0.5) * 0.25;
      }
      this.opacity = this.opacityBase * (0.6 + 0.4 * Math.sin(t * this.twinkleSpd + this.twinkle));
    } else if (this.mode === 'drift') {
      this.y += this.vy;
      this.x += this.vx;
      const yRatio = 1 - this.y / this.h;
      let alpha = this.opacityBase;
      if (yRatio < 0.15) alpha *= yRatio / 0.15;
      if (yRatio > 0.85) alpha *= (1 - yRatio) / 0.15;
      alpha *= 0.65 + 0.35 * Math.sin(t * this.twinkleSpd + this.twinkle);
      this.opacity = Math.max(0, alpha);
      if (this.trail) this.trailX.length = 0;
      if (this.y < -10 || this.x < -20 || this.x > this.w + 20) this.reset();
    } else if (this.mode === 'implode') {
      // Rush toward center
      const cx = this.w / 2, cy = this.h / 2;
      const dx = cx - this.x, dy = cy - this.y;
      const d = Math.hypot(dx, dy);
      const speed = 18;
      this.x += (dx / Math.max(1, d)) * speed;
      this.y += (dy / Math.max(1, d)) * speed;
      this.opacity = Math.max(0, this.opacity - 0.04);
      if (d < 6 || this.opacity <= 0) this.dead = true;
    }
  }
  draw(ctx) {
    if (this.dead) return;
    if (this.trail && this.trailX.length > 1) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size * 0.75;
      ctx.lineCap = 'round';
      ctx.globalAlpha = this.opacity * 0.5;
      ctx.beginPath();
      ctx.moveTo(this.trailX[0], this.trailY[0]);
      for (let i = 1; i < this.trailX.length; i++) {
        ctx.lineTo(this.trailX[i], this.trailY[i]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    if (this.size > 2) {
      ctx.globalAlpha = this.opacity * 0.35;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class IntroParticles {
  constructor(canvas, count = 220) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.count = count;
    this.particles = [];
    this._t0 = performance.now();
    this._lastFrame = this._t0;
    this._stopped = false;
    this._mode = 'idle';

    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);

    this._resize();
    window.addEventListener('resize', this._resize);
    for (let i = 0; i < count; i++) this.particles.push(new Particle(this.w, this.h));
    requestAnimationFrame(this._frame);
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
  _frame(now) {
    if (this._stopped) return;
    const dt = Math.min(.05, (now - this._lastFrame) / 1000);
    const t  = (now - this._t0) / 1000;
    this._lastFrame = now;
    this.ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      p.step(dt, t);
      p.draw(this.ctx);
    }
    this.ctx.globalAlpha = 1;
    requestAnimationFrame(this._frame);
  }
  /** Start the burst — call when curtains begin to part. */
  burst() {
    for (const p of this.particles) p.burstFromCenter();
  }
  /** Implode toward center — exit. */
  implode() {
    for (const p of this.particles) p.mode = 'implode';
  }
  destroy() {
    this._stopped = true;
    window.removeEventListener('resize', this._resize);
  }
}

/**
 * Replace `data-letters` text content with one <span class="char"> per letter
 * so each letter can blur/sharp animate independently. Idempotent.
 */
function buildLetters(el) {
  if (el.dataset.split === '1') return;
  const text = el.dataset.letters || el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
  el.dataset.split = '1';
}

/**
 * Same as buildLetters but for the handwriting "Catalina" — each char gets
 * a tiny stagger and slight rotation as it writes in.
 */
function buildHandwriting(el) {
  if (el.dataset.split === '1') return;
  const text = el.dataset.handwrite || el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
  el.dataset.split = '1';
}

/* ----------------- Sequenced reveal ----------------- */

export function playIntroReveal(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const blockName = root.querySelector('.intro__name[data-letters]');
  const scriptName = root.querySelector('.intro__name[data-handwrite]');
  buildLetters(blockName);
  buildHandwriting(scriptName);

  const blockChars  = blockName.querySelectorAll('.char');
  const scriptChars = scriptName.querySelectorAll('.char');
  const amp         = root.querySelector('.intro__amp');
  const lines       = root.querySelectorAll('.intro__divider-line');
  const diamond     = root.querySelector('.intro__divider-diamond');
  const subtitle    = root.querySelector('.intro__subtitle');
  const metas       = root.querySelectorAll('.intro__meta');
  const cta         = root.querySelector('#intro-cta');

  if (reduce) {
    [...blockChars, ...scriptChars].forEach(c => c.classList.add('is-sharp', 'is-written'));
    return gsap.timeline();
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // 1. MATTHEW — letters blur->sharp 40ms apart
  blockChars.forEach((c, i) => {
    tl.add(() => c.classList.add('is-sharp'), 0.1 + i * 0.04);
  });

  // 2. Ampersand fade in
  tl.fromTo(amp, { opacity: 0, scale: .85 }, { opacity: 1, scale: 1, duration: .8 }, 0.5);

  // 3. Catalina — handwriting (each char appears w/ slight rotation) 70ms apart
  scriptChars.forEach((c, i) => {
    tl.add(() => c.classList.add('is-written'), 0.85 + i * 0.07);
  });

  // 4. Divider line draw + diamond pop
  tl.to(lines,   { scaleX: 1, duration: .9, stagger: .08, ease: 'power2.out' }, 1.85)
    .to(diamond, { scale: 1, duration: .55, ease: 'back.out(2.4)' }, 2.0);

  // 5. Subtitle + meta + CTA
  tl.to(subtitle, { opacity: 1, duration: .9 }, 2.25)
    .to(metas,    { opacity: 1, y: 0, duration: .9, stagger: .12 }, 2.6)
    .to(cta,      { opacity: 1, y: 0, duration: .9, ease: 'power3.out' }, 3.15);

  return tl;
}

/* ----------------- Curtain split ----------------- */

export function openCurtains() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    document.querySelectorAll('.curtain').forEach(c => c.style.display = 'none');
    document.getElementById('intro').classList.add('is-revealed');
    return Promise.resolve();
  }
  return new Promise(resolve => {
    gsap.to('.curtain--left', {
      x: '-100%', duration: 2, ease: 'power3.inOut'
    });
    gsap.to('.curtain--right', {
      x:  '100%', duration: 2, ease: 'power3.inOut',
      onStart: () => document.getElementById('intro').classList.add('is-revealed'),
      onComplete: () => {
        document.querySelectorAll('.curtain').forEach(c => c.remove());
        resolve();
      }
    });
  });
}

/* ----------------- Shatter exit ----------------- */

export function playIntroExit(root) {
  return new Promise(resolve => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.to(root, { opacity: 0, duration: .5, onComplete: resolve });
      return;
    }

    const allChars = [
      ...root.querySelectorAll('.intro__name .char'),
      ...root.querySelectorAll('.intro__name--script .char')
    ];
    const amp     = root.querySelector('.intro__amp');
    const rest    = root.querySelectorAll('.intro__divider, .intro__subtitle, .intro__meta, #intro-cta');
    const flash   = root.querySelector('.intro__flash');

    const tl = gsap.timeline({
      onComplete: resolve,
      defaults: { ease: 'power3.in' }
    });

    // Letters shatter — random direction per letter
    allChars.forEach((c, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 220 + Math.random() * 320;
      tl.to(c, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        rotation: (Math.random() - 0.5) * 90,
        opacity: 0,
        duration: 0.85,
        ease: 'power2.in'
      }, 0 + i * 0.012);
    });

    tl.to(amp,  { y: -80, scale: 1.5, opacity: 0, duration: .8 }, 0)
      .to(rest, { y: 24, opacity: 0, duration: .55, stagger: .04 }, 0.05);

    // White flash mid-shatter
    tl.to(flash, { opacity: 1, duration: .25, ease: 'power2.in' }, 0.7)
      .to(flash, { opacity: 0, duration: .55, ease: 'power2.out' }, 0.95);

    // Final root fade so the section can be removed
    tl.to(root, { opacity: 0, duration: .5 }, 1.05);
  });
}
