// Runs before first paint so the page never flashes the wrong theme.
(function () {
  var root = document.documentElement;
  root.className = root.className.replace('no-js', 'js');
  if (root.getAttribute('data-locked')) return;
  try {
    var t = localStorage.getItem('aisa-theme');
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  } catch (e) { /* storage unavailable: follow the system theme */ }
})();
