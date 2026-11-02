// AI Studio to Android Guide: interface behaviour. No dependencies.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var base = new URL('../', doc.currentScript ? doc.currentScript.src : location.href).href;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var status = $('#sr-status');
  function announce(msg) { if (!status) return; status.textContent = ''; setTimeout(function () { status.textContent = msg; }, 30); }
  window.AISA = { base: base, announce: announce };

  // Theme: follows the system until the reader chooses; the choice is remembered
  var themeBtn = $('#theme-btn');
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : dark.matches; }
  function paintTheme() {
    if (!themeBtn) return;
    var d = isDark();
    themeBtn.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme');
    $('[data-icon-moon]', themeBtn).hidden = d;
    $('[data-icon-sun]', themeBtn).hidden = !d;
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('aisa-theme', next); } catch (e) { /* ignore */ }
      paintTheme();
    });
    if (dark.addEventListener) dark.addEventListener('change', paintTheme);
    paintTheme();
  }

  // Mobile navigation drawer: the page behind is inert while it is open, and focus stays inside
  var sidebar = $('#sidebar'), menuBtn = $('#menu-btn'), scrim = $('#scrim'), closeBtn = $('#menu-close');
  var inertTargets = [$('#shell'), $('#topbar')];
  function setNav(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('nav-open', open);
    inertTargets.forEach(function (el) { if (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } });
    if (open) { var first = $('.search-btn', sidebar); if (first) first.focus(); }
    else if (doc.activeElement && sidebar.contains(doc.activeElement)) menuBtn.focus();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setNav(true); });
    closeBtn.addEventListener('click', function () { setNav(false); });
    scrim.addEventListener('click', function () { setNav(false); });
    $$('.nav-link', sidebar).forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
    doc.addEventListener('keydown', function (e) {
      if (!sidebar.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setNav(false); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([hidden])', sidebar).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // If the window grows to the desktop layout while the drawer is open, close it
    window.matchMedia('(min-width: 64rem)').addEventListener('change', function (e) { if (e.matches) setNav(false); });
  }

  // Scroll: progress bar, topbar state, back-to-top
  var bar = $('.progress-bar'), topbar = $('#topbar'), toTop = $('#to-top'), ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    if (topbar) topbar.classList.toggle('is-scrolled', y > 8);
    if (toTop) toTop.hidden = y < 600;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); });

  // Copy buttons on code blocks
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
      doc.body.appendChild(ta); ta.select();
      try { if (doc.execCommand('copy')) resolve(); else reject(); } catch (e) { reject(e); } finally { doc.body.removeChild(ta); }
    });
  }
  window.AISA.copyText = copyText;
  $$('.copy-btn').forEach(function (btn) {
    var label = $('.code-label', btn.closest('.code'));
    btn.setAttribute('aria-label', 'Copy ' + (label ? label.textContent : 'code'));
    btn.addEventListener('click', function () {
      var pre = $('pre', btn.closest('.code'));
      copyText(pre.innerText.replace(/\n$/, '')).then(function () {
        btn.textContent = 'Copied'; btn.classList.add('is-done'); announce('Copied to clipboard');
      }, function () { btn.textContent = 'Press Ctrl+C'; }).then(function () {
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
      });
    });
  });

  // Troubleshooting: open the issue a link points at, one at a time
  function openHashIssue() {
    var el = location.hash.length > 1 ? doc.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openHashIssue); openHashIssue();
  $$('details.issue').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) $$('details.issue').forEach(function (o) { if (o !== d) o.open = false; }); });
  });

  // "On this page": highlight the section being read
  var tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          tocLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = map[en.target.id]; if (a) a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    Object.keys(map).forEach(function (id) { var t = doc.getElementById(id); if (t) io.observe(t); });
  }

  // Scroll reveals: elements start visible, and only fade in when the browser can observe them
  var revealEls = $$('[data-reveal]');
  if (revealEls.length && 'IntersectionObserver' in window && !reduceMotion.matches) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); seen.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el, i) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) { el.classList.add('is-in'); return; }
      el.classList.add('will-reveal'); el.style.setProperty('--d', String((i % 4) * 70) + 'ms'); seen.observe(el);
    });
  }

  // Search palette (Ctrl/Cmd+K or "/")
  var dlg = $('#palette'), input = $('#palette-input'), list = $('#palette-results'), empty = $('#palette-empty');
  var index = null, active = -1, shown = [], lastFocus = null;
  $$('[data-kbd]').forEach(function (k) { k.textContent = isMac ? '\u2318 K' : 'Ctrl K'; });
  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetch(base + 'search-index.json').then(function (r) { return r.json(); }).then(function (j) { index = j; return j; }).catch(function () { index = []; return index; });
  }
  function score(item, terms) {
    var t = item.t.toLowerCase(), x = item.x.toLowerCase(), s = 0;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i], hit = false;
      if (t.indexOf(q) === 0) { s += 6; hit = true; } else if (t.indexOf(q) > -1) { s += 4; hit = true; }
      if (x.indexOf(q) > -1) { s += 1; hit = true; }
      if (!hit) return 0;
    }
    return s;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    shown = terms.length ? index.map(function (it) { return { it: it, s: score(it, terms) }; }).filter(function (r) { return r.s; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (r) { return r.it; }) : [];
    list.innerHTML = shown.map(function (it, i) {
      return '<li role="option" id="pr-' + i + '"><a href="' + esc(base + it.u) + '"><span class="pr-title">' + esc(it.t) + '</span><span class="pr-where">' + esc(it.p) + '</span></a></li>';
    }).join('');
    empty.hidden = !(terms.length && !shown.length);
    if (terms.length) announce(shown.length ? shown.length + ' results' : 'No results');
    setActive(shown.length ? 0 : -1);
  }
  function setActive(i) {
    active = i;
    $$('li', list).forEach(function (li, n) { li.setAttribute('aria-selected', String(n === i)); });
    if (i > -1) { input.setAttribute('aria-activedescendant', 'pr-' + i); var el = $('#pr-' + i); if (el) el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function openPalette() {
    if (!dlg || !dlg.showModal) { location.href = base + 'index.html#hub'; return; }
    setNav(false);
    lastFocus = doc.activeElement;
    if (!dlg.open) dlg.showModal();
    input.value = ''; list.innerHTML = ''; empty.hidden = true;
    loadIndex(); input.focus();
  }
  if (dlg) {
    $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', openPalette); });
    input.addEventListener('input', function () { loadIndex().then(function () { render(input.value); }); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) setActive((active + 1) % shown.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) setActive((active - 1 + shown.length) % shown.length); }
      else if (e.key === 'Enter' && active > -1) { e.preventDefault(); location.href = base + shown[active].u; dlg.close(); }
    });
    list.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    doc.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (dlg.open) dlg.close(); else openPalette(); }
      else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); openPalette(); }
    });
  }

  // Offline page: a retry button
  $$('[data-reload]').forEach(function (b) { b.addEventListener('click', function () { location.reload(); }); });
})();
