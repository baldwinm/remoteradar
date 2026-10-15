// Runs before the page paints, so neither the theme nor the layout flashes.
// The theme: a saved light/dark choice, kept in sync with src/lib/theme.ts. No saved choice means "follow the device".
// The layout: desktop and phone have separately designed pages, picked by width (src/lib/layout.ts keeps it updated).
(function () {
  var root = document.documentElement;
  try {
    var choice = window.localStorage.getItem('rr-theme');
    if (choice === 'light' || choice === 'dark') root.dataset.theme = choice;
  } catch (e) {
    // Storage can be blocked (private mode); the device setting still applies.
  }
  var phone = !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
  root.classList.add(phone ? 'is-phone' : 'is-desk');
})();
