// Runs before first paint so the page never flashes the wrong theme.
(function () {
  try {
    var t = localStorage.getItem('aisa-theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage unavailable: follow the system theme */ }
})();
