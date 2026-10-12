// Runs before the page paints so a saved light/dark choice never flashes the other theme.
// Kept in sync with src/lib/theme.ts. No saved choice means "follow the device".
(function () {
  try {
    var choice = window.localStorage.getItem('rr-theme');
    if (choice === 'light' || choice === 'dark') document.documentElement.dataset.theme = choice;
  } catch (e) {
    // Storage can be blocked (private mode); the device setting still applies.
  }
})();
