(function () {
  'use strict';

  var modal = document.getElementById('rsvp-modal');
  var openBtn = document.getElementById('open-rsvp');
  var form = document.getElementById('rsvp-form');
  if (!modal || !openBtn) return;

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // focus first field
    var first = modal.querySelector('input, button, textarea, select');
    if (first) first.focus();
    document.addEventListener('keydown', onKey);
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  openBtn.addEventListener('click', open);
  modal.querySelectorAll('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', close);
  });

  // Graceful mailto compose on submit (no backend needed).
  if (form) {
    form.addEventListener('submit', function (e) {
      // Only intercept if no custom action override (Formspree etc.)
      var action = form.getAttribute('action') || '';
      if (action.indexOf('mailto:') !== 0) return;

      e.preventDefault();
      var to = action.replace(/^mailto:/, '');
      var data = new FormData(form);
      var lines = [];
      data.forEach(function (v, k) { lines.push(k + ': ' + v); });
      var body = encodeURIComponent(lines.join('\n'));
      var subject = encodeURIComponent('Wedding RSVP — ' + (data.get('Name') || 'Guest'));
      window.location.href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;

      // Friendly inline confirmation.
      var confirm = document.createElement('p');
      confirm.className = 'modal__subtitle';
      confirm.style.color = 'var(--olive-dark)';
      confirm.textContent = 'Thank you! Your email client should open with your response.';
      form.replaceChildren(confirm);
    });
  }
})();
