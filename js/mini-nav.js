(function () {
  'use strict';

  var nav = document.getElementById('mini-nav');
  var hero = document.getElementById('hero');
  if (!nav || !hero) return;

  function onScroll() {
    var heroBottom = hero.getBoundingClientRect().bottom;
    nav.classList.toggle('is-visible', heroBottom < 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
