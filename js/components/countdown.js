// Live countdown to the wedding — airport-departure-board flip per cell.
// Each cell has a `.flip-card` with `.flip-front` (current) and `.flip-back`
// (next). When the value changes we set the back face, toggle .is-flipping
// (CSS transitions rotateX from 0 -> -180deg), then on transitionend swap
// front to the new value and reset.

const WEDDING_DATE = new Date('2027-05-21T14:30:00-05:00');

function pad(n, len) {
  let s = String(Math.max(0, n));
  while (s.length < len) s = '0' + s;
  return s;
}

export function startCountdown(root) {
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cells = {
    days:    root.querySelector('[data-unit="days"]'),
    hours:   root.querySelector('[data-unit="hours"]'),
    minutes: root.querySelector('[data-unit="minutes"]'),
    seconds: root.querySelector('[data-unit="seconds"]')
  };

  const state = { days: null, hours: null, minutes: null, seconds: null };

  function setCell(cell, newValue) {
    if (!cell) return;
    const card = cell.querySelector('.flip-card');
    const front = card.querySelector('.flip-front');
    const back  = card.querySelector('.flip-back');
    const current = front.textContent;

    if (current === newValue) return;

    if (reduce || card.classList.contains('is-flipping')) {
      // Reduced motion or already mid-flip — set immediately.
      front.textContent = newValue;
      back.textContent  = newValue;
      return;
    }

    back.textContent = newValue;
    card.classList.add('is-flipping');
    const onEnd = () => {
      card.removeEventListener('transitionend', onEnd);
      card.classList.remove('is-flipping');
      front.textContent = newValue;
      // back stays as new value too — both faces match until next change
      back.textContent  = newValue;
      // Reset transform without animating (briefly disable transition)
      card.style.transition = 'none';
      card.style.transform  = 'rotateX(0deg)';
      // Force reflow then restore
      void card.offsetWidth;
      card.style.transition = '';
      card.style.transform  = '';
    };
    card.addEventListener('transitionend', onEnd);
  }

  function pulseGlow() {
    Object.values(cells).forEach(cell => {
      if (!cell) return;
      cell.classList.add('glow');
      setTimeout(() => cell.classList.remove('glow'), 1100);
    });
  }

  function tick() {
    const diff = WEDDING_DATE.getTime() - Date.now();
    if (diff <= 0) {
      setCell(cells.days,    '000');
      setCell(cells.hours,   '00');
      setCell(cells.minutes, '00');
      setCell(cells.seconds, '00');
      return false;
    }
    let s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;

    setCell(cells.days,    pad(d, 3));
    setCell(cells.hours,   pad(h, 2));
    setCell(cells.minutes, pad(m, 2));
    setCell(cells.seconds, pad(s, 2));
    return true;
  }

  tick();
  const id = setInterval(() => { if (tick() === false) clearInterval(id); }, 1000);
  if (!reduce) setInterval(pulseGlow, 10_000);
}
