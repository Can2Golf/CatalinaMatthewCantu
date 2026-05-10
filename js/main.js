// Top-level orchestrator. Curtain split -> intro reveal -> CTA shatter ->
// globe entrance + marker arrival -> click marker -> camera rush + scene.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { STORY_POINTS, PEOPLE } from './data/story.js';
import { Globe } from './utils/globe.js';
import { IntroParticles, playIntroReveal, playIntroExit, openCurtains } from './components/intro.js';
import { SceneManager } from './components/scenes.js';
import { startCountdown } from './components/countdown.js';
import { bindRsvp } from './components/rsvp.js';

gsap.registerPlugin(ScrollTrigger);

const $loader  = document.getElementById('loader');
const $intro   = document.getElementById('intro');
const $cta     = document.getElementById('intro-cta');
const $globe   = document.getElementById('globe');
const $globeCanvas = document.getElementById('globe-canvas');
const $tooltip = document.getElementById('globe-tooltip');
const $tooltipCity  = $tooltip.querySelector('.globe-tooltip__city');
const $tooltipLabel = $tooltip.querySelector('.globe-tooltip__label');
const $chapterDots  = document.getElementById('chapter-dots');
const $skipDetails  = document.getElementById('skip-to-details');
const $sceneRoot    = document.getElementById('scene-overlay');
const $sceneBg      = document.getElementById('scene-background');
const $sceneCanvas  = document.getElementById('scene-particles');
const $sceneClose   = document.getElementById('scene-close');
const $scenePrev    = document.getElementById('scene-prev');
const $sceneNext    = document.getElementById('scene-next');
const $mobileTimeline = document.getElementById('mobile-timeline');
const $mobileList   = document.getElementById('mobile-timeline-list');

const isMobile = matchMedia('(max-width: 820px)').matches;

let introParticles = null;

window.addEventListener('load', () => {
  // Hide loader after first frame
  requestAnimationFrame(() => {
    setTimeout(() => $loader.classList.add('is-hidden'), 350);
    setTimeout(() => $loader.remove(), 1400);
  });

  // 1. Particles begin (idle drift below curtains)
  introParticles = new IntroParticles(document.getElementById('intro-particles'));

  // 2. Curtain split — when they begin moving, fire the burst
  setTimeout(() => introParticles.burst(), 350);

  openCurtains().then(() => {
    // 3. Stagger reveal once curtains are gone
    playIntroReveal($intro);
  });

  // 4. CTA -> shatter exit -> mount story section
  $cta.addEventListener('click', () => {
    introParticles.implode();
    playIntroExit($intro).then(() => {
      $intro.style.display = 'none';
      mountStorySection();
      ($globe.hidden ? $mobileTimeline : $globe).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 5. Lower sections — independent of intro flow
  startCountdown(document.getElementById('countdown'));
  renderPeopleGrid();
  bindRsvp(document.getElementById('rsvp-form'));

  // 6. ScrollTrigger reveals
  setupScrollReveals();
});

/* ============================ STORY SECTION ============================ */

let globeInstance = null;
let sceneManager  = null;
let activeIndex   = 0;

function mountStorySection() {
  if (isMobile) {
    mountMobileTimeline();
    return;
  }
  $globe.hidden = false;
  mountGlobe();
}

function mountGlobe() {
  // Chapter dots
  STORY_POINTS.forEach((p, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'chapter-dot';
    btn.type = 'button';
    btn.textContent = String(i + 1);
    btn.setAttribute('aria-label', `${p.city} — ${p.label}`);
    btn.addEventListener('click', () => openScene(p, i));
    li.appendChild(btn);
    $chapterDots.appendChild(li);
  });

  globeInstance = new Globe($globeCanvas, STORY_POINTS, {
    onMarkerHover: (point, client) => {
      if (!client) return;
      $tooltipCity.textContent = point.city;
      $tooltipLabel.textContent = point.label;
      $tooltip.style.left = client.x + 'px';
      $tooltip.style.top  = client.y + 'px';
      $tooltip.classList.add('is-visible');
      $tooltip.setAttribute('aria-hidden', 'false');
    },
    onMarkerLeave: () => {
      $tooltip.classList.remove('is-visible');
      $tooltip.setAttribute('aria-hidden', 'true');
    },
    onMarkerClick: (point) => {
      const idx = STORY_POINTS.indexOf(point);
      openScene(point, idx);
    }
  });

  // Globe enters with a shockwave; markers arrive as shooting stars.
  // Fade canvas in from black for added cinema.
  gsap.fromTo($globe, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' });
  globeInstance.playEntrance();
  setTimeout(() => globeInstance.revealMarkers(), 1000);

  sceneManager = new SceneManager({
    root: $sceneRoot,
    bg: $sceneBg,
    canvas: $sceneCanvas,
    dom: {
      chapter: document.getElementById('scene-chapter'),
      city:    document.getElementById('scene-city'),
      label:   document.getElementById('scene-label'),
      text:    document.getElementById('scene-text')
    },
    storyPoints: STORY_POINTS
  });

  $sceneClose.addEventListener('click', closeScene);
  $scenePrev.addEventListener('click', () => switchScene(-1));
  $sceneNext.addEventListener('click', () => switchScene(+1));

  window.addEventListener('keydown', (e) => {
    const open = $sceneRoot.classList.contains('is-open');
    if (open) {
      if (e.key === 'Escape')          closeScene();
      else if (e.key === 'ArrowLeft')  switchScene(-1);
      else if (e.key === 'ArrowRight') switchScene(+1);
      return;
    }
    if (!$globe.hidden) {
      if (e.key === 'ArrowLeft')       cycleGlobe(-1);
      else if (e.key === 'ArrowRight') cycleGlobe(+1);
    }
  });

  $skipDetails.addEventListener('click', () => {
    document.getElementById('save-the-date').scrollIntoView({ behavior: 'smooth' });
  });
}

function setActiveDot(i) {
  activeIndex = i;
  [...$chapterDots.querySelectorAll('.chapter-dot')].forEach((d, idx) => {
    d.classList.toggle('is-active', idx === i);
  });
}

function openScene(point, index) {
  setActiveDot(index);
  globeInstance?.flashMarker(point);
  // Fast spin + camera rush to z=1.4 + marker explosion
  globeInstance?.focusOn(point, { duration: 0.6, zoomTo: 1.4, explode: true });
  // Open scene right as the camera reaches the surface
  setTimeout(() => sceneManager.open(point, index), 850);
}

function closeScene() {
  sceneManager.close().then(() => {
    globeInstance?.resetCamera(0.9);
  });
}

function switchScene(dir) {
  const next = (sceneManager.activeIndex + dir + STORY_POINTS.length) % STORY_POINTS.length;
  setActiveDot(next);
  sceneManager.showAt(next, dir);
  globeInstance?.focusOn(STORY_POINTS[next], { duration: 0.9, zoomTo: 1.6 });
}

function cycleGlobe(dir) {
  const next = (activeIndex + dir + STORY_POINTS.length) % STORY_POINTS.length;
  openScene(STORY_POINTS[next], next);
}

/* ============================ MOBILE TIMELINE ============================ */

function mountMobileTimeline() {
  $mobileTimeline.hidden = false;
  STORY_POINTS.forEach((p) => {
    const card = document.createElement('article');
    card.className = 'mobile-card';
    card.dataset.scene = p.scene;
    card.innerHTML = `
      <p class="mobile-card__chapter">${p.chapter}</p>
      <h3 class="mobile-card__city">${p.city}</h3>
      <p class="mobile-card__label">${p.label}</p>
      <p class="mobile-card__text">${p.text}</p>
    `;
    $mobileList.appendChild(card);
  });
}

/* ============================ PEOPLE GRID ============================ */

function renderPeopleGrid() {
  const grid = document.getElementById('people-grid');
  if (!grid) return;
  PEOPLE.forEach(p => {
    const div = document.createElement('div');
    div.className = 'person';
    div.innerHTML = `
      <div class="person__photo" style="background-image:url('${p.photo}')" aria-hidden="true"></div>
      <p class="person__name">${p.name}</p>
      <p class="person__role">${p.role}</p>
    `;
    grid.appendChild(div);
  });
}

/* ============================ SCROLL REVEALS ============================ */

/** Split a heading into per-character spans so we can stagger them. */
function splitChars(el) {
  if (!el || el.dataset.split === '1') return;
  const text = el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  }
  el.dataset.split = '1';
  el.classList.add('split-chars');
}

function setupScrollReveals() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // Section headings: split + stagger up
  document.querySelectorAll('.section-header h2, .save-the-date__title')
    .forEach(h => {
      splitChars(h);
      gsap.to(h.querySelectorAll('.char'), {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.04,
        ease: 'power3.out',
        scrollTrigger: { trigger: h, start: 'top 85%', once: true }
      });
    });

  // Wedding party — fan-in from a stacked center position
  ScrollTrigger.create({
    trigger: '.people__grid',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      const cards = document.querySelectorAll('.person');
      gsap.fromTo(cards,
        { opacity: 0, scale: 0.85, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.75, stagger: 0.08, ease: 'power3.out' }
      );
    }
  });

  // RSVP fields — fade up on entry
  ScrollTrigger.create({
    trigger: '#rsvp-form',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      gsap.fromTo('.rsvp__form > .field, .rsvp__form > button',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out' }
      );
    }
  });

  // Save-the-date venue + city + flip clock fade-in
  ScrollTrigger.create({
    trigger: '.save-the-date__inner',
    start: 'top 80%',
    once: true,
    onEnter: () => {
      gsap.fromTo('.save-the-date__venue, .save-the-date__city',
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }
      );
      gsap.fromTo('.flip-clock .flip-cell',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.2 }
      );
    }
  });

  // Footer title fade-up
  ScrollTrigger.create({
    trigger: '.site-footer',
    start: 'top 90%',
    once: true,
    onEnter: () => {
      gsap.fromTo('.site-footer__title, .site-footer__date, .site-footer__nav, .site-footer__note',
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.65, stagger: 0.08, ease: 'power3.out' }
      );
    }
  });
}
