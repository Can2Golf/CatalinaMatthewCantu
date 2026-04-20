(function () {
  'use strict';

  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (t) { t.classList.add('reveal--visible'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry, i) {
      if (!entry.isIntersecting) return;
      var delay = 0;
      // Stagger siblings that reveal together (e.g., schedule rows).
      var parent = entry.target.parentElement;
      if (parent && parent.classList.contains('schedule__list')) {
        var index = Array.prototype.indexOf.call(parent.children, entry.target);
        delay = Math.min(index * 60, 600);
      }
      setTimeout(function () {
        entry.target.classList.add('reveal--visible');
      }, delay);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function (t) { io.observe(t); });

  // Subtle parallax on hero photo + eucalyptus decorations
  var heroPhoto = document.querySelector('.hero__photo');
  var euTL = document.querySelector('.eucalyptus--tl');
  var euBR = document.querySelector('.eucalyptus--br');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && (heroPhoto || euTL || euBR)) {
    var raf = null;
    var onScroll = function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        var y = window.scrollY || window.pageYOffset;
        if (heroPhoto) {
          heroPhoto.style.transform = 'scale(1.05) translate3d(0,' + (y * 0.18) + 'px, 0)';
        }
        if (euTL) euTL.style.transform = 'translate3d(' + (-y * 0.04) + 'px, ' + (-y * 0.05) + 'px, 0)';
        if (euBR) euBR.style.transform = 'translate3d(' + (y * 0.04) + 'px, ' + (y * 0.05) + 'px, 0)';
        raf = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
