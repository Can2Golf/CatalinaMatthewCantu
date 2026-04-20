(function () {
  'use strict';

  // Single-open accordion: opening one closes the others.
  var items = document.querySelectorAll('.faq__item');
  if (!items.length) return;

  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      items.forEach(function (other) {
        if (other !== item && other.open) other.open = false;
      });
    });
  });
})();
