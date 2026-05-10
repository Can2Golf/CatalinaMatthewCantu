// Top-level orchestrator. Wires intro → globe → scenes; mounts the lower
// sections (countdown, people grid, RSVP, footer).

import gsap from 'gsap';

import { STORY_POINTS, PEOPLE } from './data/story.js';
import { Globe } from './utils/globe.js';
import { IntroParticles, playIntroReveal, playIntroExit } from './components/intro.js';
import { SceneManager } from './components/scenes.js';
import { startCountdown } from './components/countdown.js';
import { bindRsvp } from './components/rsvp.js';

// ----------------- DOM refs -----------------
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

// ----------------- 1. Initial load -----------------
window.addEventListener('load', () => {
  // Hide loader after first frame
  requestAnimationFrame(() => {
    setTimeout(() => $loader.classList.add('is-hidden'), 350);
    setTimeout(() => $loader.remove(), 1400);
  });

  // Intro particles + reveal
  const introParticles = new IntroParticles(document.getElementById('intro-particles'));
  playIntroReveal($intro);

  // CTA → exit intro → mount globe
  $cta.addEventListener('click', () => {
    introParticles.exitBurst();
    playIntroExit($intro).then(() => {
      $intro.style.display = 'none';
      mountStorySection();
      // smooth-scroll into view
      ($globe.hidden ? $mobileTimeline : $globe).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Lower sections — independent of the globe flow
  startCountdown(document.getElementById('countdown'));
  renderPeopleGrid();
  bindRsvp(document.getElementById('rsvp-form'));
});

// ----------------- 2. Story section (globe or mobile timeline) -----------------
function mountStorySection() {
  if (isMobile) {
    mountMobileTimeline();
    return;
  }
  $globe.hidden = false;
  mountGlobe();
}

let globeInstance = null;
let sceneManager  = null;

function mountGlobe() {
  // Build chapter nav dots
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

  // Reveal markers + arcs in sequence
  globeInstance.revealMarkers();

  // Scene manager
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

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const open = $sceneRoot.classList.contains('is-open');
    if (open) {
      if (e.key === 'Escape')      closeScene();
      else if (e.key === 'ArrowLeft')  switchScene(-1);
      else if (e.key === 'ArrowRight') switchScene(+1);
      return;
    }
    // Globe shortcuts
    if (!$globe.hidden) {
      if (e.key === 'ArrowLeft')  cycleGlobe(-1);
      else if (e.key === 'ArrowRight') cycleGlobe(+1);
    }
  });

  $skipDetails.addEventListener('click', () => {
    document.getElementById('save-the-date').scrollIntoView({ behavior: 'smooth' });
  });
}

let activeIndex = 0;
function setActiveDot(i) {
  activeIndex = i;
  [...$chapterDots.querySelectorAll('.chapter-dot')].forEach((d, idx) => {
    d.classList.toggle('is-active', idx === i);
  });
}

function openScene(point, index) {
  setActiveDot(index);
  globeInstance?.flashMarker(point);
  globeInstance?.focusOn(point, { duration: 1.5, zoomTo: 2.2 });
  // Slight delay so the globe motion feels intentional before overlay appears
  setTimeout(() => {
    sceneManager.open(point, index);
  }, 700);
}

function closeScene() {
  sceneManager.close().then(() => {
    globeInstance?.resumeAutoRotate();
    // Camera back to default
    gsap.to(globeInstance.camera.position, { z: 2.8, duration: 0.9, ease: 'power2.out' });
  });
}

function switchScene(dir) {
  const next = (sceneManager.activeIndex + dir + STORY_POINTS.length) % STORY_POINTS.length;
  setActiveDot(next);
  sceneManager.showAt(next);
  globeInstance?.focusOn(STORY_POINTS[next], { duration: 1.5, zoomTo: 2.2 });
}

function cycleGlobe(dir) {
  const next = (activeIndex + dir + STORY_POINTS.length) % STORY_POINTS.length;
  openScene(STORY_POINTS[next], next);
}

// ----------------- 3. Mobile timeline -----------------
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

// ----------------- 4. People grid -----------------
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
