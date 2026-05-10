// Live countdown to the wedding.

const WEDDING_DATE = new Date('2027-05-21T14:30:00-05:00');

function pad(n, len) {
  let s = String(Math.max(0, n));
  while (s.length < len) s = '0' + s;
  return s;
}

export function startCountdown(root) {
  if (!root) return;
  const days    = root.querySelector('[data-unit="days"]');
  const hours   = root.querySelector('[data-unit="hours"]');
  const minutes = root.querySelector('[data-unit="minutes"]');
  const seconds = root.querySelector('[data-unit="seconds"]');

  function tick() {
    const diff = WEDDING_DATE.getTime() - Date.now();
    if (diff <= 0) {
      days.textContent = '000';
      hours.textContent = minutes.textContent = seconds.textContent = '00';
      return false;
    }
    let s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);    s -= m * 60;
    days.textContent = pad(d, 3);
    hours.textContent = pad(h, 2);
    minutes.textContent = pad(m, 2);
    seconds.textContent = pad(s, 2);
    return true;
  }

  tick();
  const id = setInterval(() => { if (tick() === false) clearInterval(id); }, 1000);
}
