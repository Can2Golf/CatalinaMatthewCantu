(function () {
  'use strict';

  // The big day. Change this one string if the date shifts.
  var WEDDING_DATE = new Date('2027-05-21T14:30:00-05:00');

  var el = document.getElementById('countdown');
  if (!el) return;

  var units = {
    days:    el.querySelector('[data-unit="days"]'),
    hours:   el.querySelector('[data-unit="hours"]'),
    minutes: el.querySelector('[data-unit="minutes"]'),
    seconds: el.querySelector('[data-unit="seconds"]')
  };

  function pad(n, len) {
    var s = String(Math.max(0, n));
    while (s.length < len) s = '0' + s;
    return s;
  }

  function tick() {
    var diff = WEDDING_DATE.getTime() - Date.now();

    if (diff <= 0) {
      units.days.textContent    = '000';
      units.hours.textContent   = '00';
      units.minutes.textContent = '00';
      units.seconds.textContent = '00';
      el.classList.add('is-today');
      return false;
    }

    var s = Math.floor(diff / 1000);
    var days = Math.floor(s / 86400); s -= days * 86400;
    var hours = Math.floor(s / 3600); s -= hours * 3600;
    var minutes = Math.floor(s / 60); s -= minutes * 60;

    units.days.textContent    = pad(days, 3);
    units.hours.textContent   = pad(hours, 2);
    units.minutes.textContent = pad(minutes, 2);
    units.seconds.textContent = pad(s, 2);
    return true;
  }

  tick();
  var id = setInterval(function () {
    if (tick() === false) clearInterval(id);
  }, 1000);
})();
