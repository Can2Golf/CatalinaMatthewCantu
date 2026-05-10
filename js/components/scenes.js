// City scene overlay — per-city background, particle systems, and silhouettes.
//
// One <canvas> handles particles for whichever city is active; on scene change
// we replace the active particle system. The silhouette is set via data-scene
// attribute (CSS supplies the SVG image).

import gsap from 'gsap';

const SCENE_BACKGROUNDS = {
  austin: `
    radial-gradient(ellipse at center 65%, #b86b2a 0%, #6e2f10 25%, #1c0a26 75%, #04030a 100%)
  `,
  neworleans: `
    radial-gradient(ellipse at center, #3b1f5e 0%, #1d0c3a 35%, #0a0420 70%, #02010a 100%)
  `,
  paris: `
    radial-gradient(ellipse at 50% 80%, #2c2150 0%, #1a1238 35%, #0a0820 70%, #03020a 100%)
  `,
  santorini: `
    linear-gradient(180deg, #f6c98a 0%, #e98c5e 22%, #c14a73 45%, #5e2369 65%, #1a1244 85%, #050414 100%)
  `,
  home: `
    radial-gradient(ellipse at center 70%, #c87d3c 0%, #6e371e 22%, #2c1418 55%, #0a0510 100%)
  `
};

/* ----------- Particle system (unified) ----------- */
class CanvasParticles {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.config = config;          // { count, render, step, init }
    this.particles = [];
    this._t0 = performance.now();
    this._stopped = false;
    this._resize = this._resize.bind(this);
    this._frame = this._frame.bind(this);
    this._lastFrame = this._t0;

    this._resize();
    window.addEventListener('resize', this._resize);
    config.init.call(this);
    requestAnimationFrame(this._frame);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width  = Math.max(1, Math.floor(r.width  * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(r.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;
  }
  _frame(now) {
    if (this._stopped) return;
    const dt = Math.min(.05, (now - this._lastFrame) / 1000);
    const t = (now - this._t0) / 1000;
    this._lastFrame = now;

    this.ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      this.config.step.call(this, p, dt, t);
      this.config.render.call(this, p, dt, t);
    }
    this.ctx.globalAlpha = 1;
    requestAnimationFrame(this._frame);
  }
  destroy() { this._stopped = true; window.removeEventListener('resize', this._resize); }
}

/* ---------- Per-city particle configs ---------- */

function austinSparkles() {
  return {
    count: 60,
    init() {
      this.particles = Array.from({ length: this.config.count }, () => this._spawn(true));
    },
    _spawn(initial) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : this.h + 10,
        size: 1 + Math.random() * 2.6,
        speed: 0.2 + Math.random() * 0.6,
        drift: (Math.random() - 0.5) * 0.4,
        color: Math.random() < 0.4 ? '#f0c878' : '#ffd285',
        opacity: 0.3 + Math.random() * 0.5,
        twinkle: Math.random() * Math.PI * 2
      };
    },
    step(p, dt, t) {
      p.y -= p.speed;
      p.x += p.drift;
      const r = 1 - p.y / this.h;
      let alpha = p.opacity;
      if (r < 0.15) alpha *= r / 0.15;
      if (r > 0.85) alpha *= (1 - r) / 0.15;
      alpha *= 0.7 + 0.3 * Math.sin(t * 3 + p.twinkle);
      p.alpha = Math.max(0, alpha);
      if (p.y < -20) Object.assign(p, this._spawn(false));
    },
    render(p) {
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = p.alpha * 0.4;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  };
}

function neworleansPetals() {
  return {
    count: 42,
    init() {
      this.particles = Array.from({ length: this.config.count }, () => this._spawn(true));
    },
    _spawn(initial) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : -20,
        vy: 0.5 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        size: 6 + Math.random() * 7,
        color: Math.random() < 0.5 ? '#c14a73' : '#8e2a52',
        opacity: 0.55 + Math.random() * 0.35
      };
    },
    step(p) {
      p.y += p.vy;
      p.x += p.vx;
      p.vx += (Math.random() - 0.5) * 0.04;
      p.vx = Math.max(-1.2, Math.min(1.2, p.vx));
      p.rot += p.rotSpeed;
      if (p.y > this.h + 20) Object.assign(p, this._spawn(false));
    },
    render(p) {
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rot);
      this.ctx.fillStyle = p.color;
      // Petal shape — two arcs forming an almond
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, p.size * 0.6, p.size, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  };
}

function parisBokeh() {
  return {
    count: 95,
    init() {
      this.particles = Array.from({ length: this.config.count }, () => this._spawn(true));
      this._sparkleT = 0;
    },
    _spawn(initial) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : this.h + Math.random() * 80,
        size: 2 + Math.random() * 4,
        speed: 0.1 + Math.random() * 0.45,
        drift: (Math.random() - 0.5) * 0.3,
        opacity: 0.35 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        speedPhase: 1 + Math.random() * 2.5,
        color: ['#f0c878', '#ffe4a8', '#d4a853'][Math.floor(Math.random() * 3)]
      };
    },
    step(p, dt, t) {
      p.y -= p.speed;
      p.x += p.drift;
      const r = 1 - p.y / this.h;
      let alpha = p.opacity * (0.55 + 0.45 * Math.sin(t * p.speedPhase + p.phase));
      if (r < 0.1) alpha *= r / 0.1;
      if (r > 0.9) alpha *= (1 - r) / 0.1;
      p.alpha = Math.max(0, alpha);
      if (p.y < -10) Object.assign(p, this._spawn(false));
    },
    render(p) {
      this.ctx.globalAlpha = p.alpha;
      // Soft bokeh — radial gradient
      const grad = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      grad.addColorStop(0,    p.color);
      grad.addColorStop(0.4,  p.color + '80');
      grad.addColorStop(1,    'transparent');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  };
}

function santoriniConfetti() {
  return {
    count: 36,
    init() {
      this.particles = Array.from({ length: this.config.count }, () => this._spawn(true));
    },
    _spawn(initial) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : this.h + 10,
        size: 4 + Math.random() * 6,
        vy: -(0.3 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 0.6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.06,
        opacity: 0.7 + Math.random() * 0.3
      };
    },
    step(p) {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.rotSpeed;
      if (p.y < -20) Object.assign(p, this._spawn(false));
    },
    render(p) {
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rot);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  };
}

function homeHearts() {
  return {
    count: 28,
    init() {
      this.particles = Array.from({ length: this.config.count }, () => this._spawn(true));
    },
    _spawn(initial) {
      return {
        x: Math.random() * this.w,
        y: initial ? Math.random() * this.h : this.h + 10,
        size: 8 + Math.random() * 12,
        speed: 0.3 + Math.random() * 0.7,
        drift: (Math.random() - 0.5) * 0.4,
        opacity: 0.5 + Math.random() * 0.4,
        color: ['#d4a853', '#f0c878', '#c17f5a'][Math.floor(Math.random() * 3)]
      };
    },
    step(p) {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -30) Object.assign(p, this._spawn(false));
    },
    render(p) {
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.scale(p.size / 30, p.size / 30);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      // Heart path
      this.ctx.moveTo(0, 8);
      this.ctx.bezierCurveTo(-12, -4, -16, 8, 0, 18);
      this.ctx.bezierCurveTo(16, 8, 12, -4, 0, 8);
      this.ctx.fill();
      this.ctx.restore();
    }
  };
}

const SCENE_PARTICLES = {
  austin:     austinSparkles,
  neworleans: neworleansPetals,
  paris:      parisBokeh,
  santorini:  santoriniConfetti,
  home:       homeHearts
};

/* ---------- Public manager ---------- */

export class SceneManager {
  constructor({ root, bg, canvas, dom, storyPoints, onClose, onPrev, onNext }) {
    this.root = root;
    this.bg = bg;
    this.canvas = canvas;
    this.dom = dom;          // { chapter, city, label, text }
    this.points = storyPoints;
    this.onClose = onClose;
    this.onPrev = onPrev;
    this.onNext = onNext;
    this._activeIndex = 0;
    this._particles = null;
  }

  open(point, index) {
    this._activeIndex = index;
    this.root.dataset.scene = point.scene;

    // Background gradient
    this.bg.style.background = SCENE_BACKGROUNDS[point.scene] || SCENE_BACKGROUNDS.home;

    // Card content
    this.dom.chapter.textContent = point.chapter;
    this.dom.city.textContent = point.city;
    this.dom.label.textContent = point.label;
    this.dom.text.textContent = point.text;

    // Particles
    this._setupParticles(point.scene);

    document.body.classList.add('is-locked');
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');

    gsap.fromTo(this.bg, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out' });
  }

  close() {
    return new Promise(resolve => {
      gsap.to(this.bg, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in',
        onComplete: () => {
          this.root.classList.remove('is-open');
          this.root.setAttribute('aria-hidden', 'true');
          document.body.classList.remove('is-locked');
          this._teardownParticles();
          resolve();
        }
      });
    });
  }

  /** Switch to next/prev without closing back to globe */
  showAt(index) {
    const wrap = (i) => (i + this.points.length) % this.points.length;
    const target = this.points[wrap(index)];
    this._activeIndex = wrap(index);

    // Cross-fade card content
    gsap.to([this.dom.chapter, this.dom.city, this.dom.label, this.dom.text], {
      opacity: 0, duration: 0.3, ease: 'power2.in',
      onComplete: () => {
        this.root.dataset.scene = target.scene;
        this.dom.chapter.textContent = target.chapter;
        this.dom.city.textContent = target.city;
        this.dom.label.textContent = target.label;
        this.dom.text.textContent = target.text;
        gsap.fromTo([this.dom.chapter, this.dom.city, this.dom.label, this.dom.text],
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
      }
    });

    // Crossfade background
    gsap.to(this.bg, {
      opacity: 0, duration: 0.4,
      onComplete: () => {
        this.bg.style.background = SCENE_BACKGROUNDS[target.scene] || SCENE_BACKGROUNDS.home;
        gsap.fromTo(this.bg, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' });
      }
    });

    this._setupParticles(target.scene);
  }

  _setupParticles(scene) {
    this._teardownParticles();
    const factory = SCENE_PARTICLES[scene];
    if (!factory) return;
    this._particles = new CanvasParticles(this.canvas, factory());
  }
  _teardownParticles() {
    if (this._particles) {
      this._particles.destroy();
      this._particles = null;
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  get activeIndex() { return this._activeIndex; }
}
