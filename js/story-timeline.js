(function () {
  'use strict';

  var tabs = document.querySelectorAll('.story__tab');
  var panels = document.querySelectorAll('.story__panel');
  if (!tabs.length || !panels.length) return;

  function activate(chapter) {
    tabs.forEach(function (t) {
      var isMe = t.dataset.chapter === chapter;
      t.classList.toggle('is-active', isMe);
      t.setAttribute('aria-selected', isMe ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      var isMe = p.dataset.chapter === chapter;
      if (isMe) {
        p.hidden = false;
        // next frame to allow transition
        requestAnimationFrame(function () { p.classList.add('is-active'); });
      } else {
        p.classList.remove('is-active');
        // Hide after transition completes so hidden content is removed from flow
        setTimeout(function () { if (!p.classList.contains('is-active')) p.hidden = true; }, 550);
      }
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { activate(tab.dataset.chapter); });
    tab.addEventListener('keydown', function (e) {
      var idx = Array.prototype.indexOf.call(tabs, tab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        tabs[(idx + 1) % tabs.length].focus();
        activate(tabs[(idx + 1) % tabs.length].dataset.chapter);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        var prev = (idx - 1 + tabs.length) % tabs.length;
        tabs[prev].focus();
        activate(tabs[prev].dataset.chapter);
      }
    });
  });
})();
