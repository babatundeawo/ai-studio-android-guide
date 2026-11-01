// AI Studio → Android Guide: shared behaviour. No dependencies.
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var base = new URL('../', doc.currentScript ? doc.currentScript.src : location.href).href;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  // ── Theme: follows the system until the reader chooses; the choice is remembered ──
  var themeBtn = $('#theme-btn');
  var dark = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : dark.matches;
  }
  // Keep the browser/status-bar colour in step with a manual theme choice
  function syncThemeColor() {
    if (!root.getAttribute('data-theme')) return;
    var c = getComputedStyle(root).getPropertyValue('--bg').trim();
    $$('meta[name="theme-color"]').forEach(function (m) { m.removeAttribute('media'); m.setAttribute('content', c); });
  }
  function paintTheme() {
    syncThemeColor();
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
    dark.addEventListener && dark.addEventListener('change', paintTheme);
    paintTheme();
  }

  // ── Mobile navigation drawer ──
  var sidebar = $('#sidebar'), menuBtn = $('#menu-btn'), scrim = $('#scrim'), closeBtn = $('#menu-close');
  function setNav(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('nav-open', open);
    // While the drawer is open, the page behind it can't be tabbed into
    [$('.shell'), $('#topbar')].forEach(function (el) { if (el) el.inert = open; });
    if (open) { var first = $('.nav-link, .search-btn', sidebar); first && first.focus(); }
    else if (doc.activeElement && sidebar.contains(doc.activeElement)) menuBtn.focus();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () { setNav(true); });
    closeBtn.addEventListener('click', function () { setNav(false); });
    scrim.addEventListener('click', function () { setNav(false); });
    $$('.nav-link', sidebar).forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sidebar.classList.contains('is-open')) setNav(false); });
  }

  // ── Scroll: progress bar, topbar state, back-to-top ──
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

  // ── Copy buttons on code blocks ──
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr-only';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); } finally { doc.body.removeChild(ta); }
    });
  }
  $$('.copy-btn').forEach(function (btn) {
    var label = $('.code-label', btn.closest('.code'));
    btn.setAttribute('aria-label', 'Copy ' + (label ? label.textContent : 'code'));
    btn.addEventListener('click', function () {
      var pre = $('pre', btn.closest('.code'));
      copyText(pre.innerText.replace(/\n$/, '')).then(function () {
        btn.textContent = 'Copied'; btn.classList.add('is-done');
      }, function () { btn.textContent = 'Press Ctrl+C'; }).then(function () {
        setTimeout(function () { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
      });
    });
  });

  // ── Troubleshooting: open the issue a link points at ──
  function openHashIssue() {
    var el = location.hash.length > 1 ? doc.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openHashIssue); openHashIssue();
  $$('details.issue').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) $$('details.issue').forEach(function (o) { if (o !== d) o.open = false; }); });
  });

  // ── "On this page": highlight the section being read ──
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

  // ── Search palette (Ctrl/Cmd+K or "/") ──
  var dlg = $('#palette'), input = $('#palette-input'), list = $('#palette-results'), empty = $('#palette-empty');
  var index = null, active = -1, shown = [];
  $$('[data-kbd]').forEach(function (k) { k.textContent = isMac ? '⌘ K' : 'Ctrl K'; });
  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetch(base + 'search-index.json').then(function (r) { return r.json(); }).then(function (j) { index = j; return j; }).catch(function () { index = []; });
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
      return '<li role="presentation"><a role="option" id="pr-' + i + '" href="' + esc(it.u) + '"><span class="pr-title">' + esc(it.t) + '</span><span class="pr-where">' + esc(it.p) + '</span></a></li>';
    }).join('');
    empty.hidden = !(terms.length && !shown.length);
    setActive(shown.length ? 0 : -1);
  }
  function setActive(i) {
    active = i;
    $$('a', list).forEach(function (a, n) { a.setAttribute('aria-selected', String(n === i)); });
    input.setAttribute('aria-expanded', String(shown.length > 0));
    if (i > -1) { input.setAttribute('aria-activedescendant', 'pr-' + i); var el = $('#pr-' + i); el && el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }
  function openPalette() {
    if (!dlg || !dlg.showModal) { location.href = base + 'index.html#hub'; return; }
    setNav(false);
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
      else if (e.key === 'Enter' && active > -1) { e.preventDefault(); location.href = shown[active].u; dlg.close(); }
    });
    list.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    doc.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName) || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dlg.open ? dlg.close() : openPalette(); }
      else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); openPalette(); }
    });
  }

  // ── Small helpers: safe storage and toast messages ──
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  var toastBox = $('#toasts');
  function toast(msg, o) {
    o = o || {};
    if (!toastBox) return { close: function () {} };
    var el = doc.createElement('div'), p = doc.createElement('p'), row = doc.createElement('div');
    el.className = 'toast'; p.textContent = msg; row.className = 'toast-actions';
    el.appendChild(p); el.appendChild(row);
    function close() { if (el.parentNode) el.parentNode.removeChild(el); }
    (o.actions || []).forEach(function (a) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm ' + (a.primary ? 'btn-primary' : 'btn-ghost'); b.textContent = a.label;
      b.addEventListener('click', function () { close(); if (a.run) a.run(); });
      row.appendChild(b);
    });
    toastBox.appendChild(el);
    if (!o.persist) setTimeout(close, o.ms || 4500);
    return { close: close };
  }
  var page = doc.body.getAttribute('data-page') || '';

  // ── Progress: tick steps off, remembered on this device only ──
  var PROG = 'aisa-progress', LAST = 'aisa-last';
  var stepsData = null;
  function doneIds(name) { var p = store.get(PROG, {}); return Array.isArray(p[name]) ? p[name] : []; }
  function loadSteps() {
    if (stepsData) return Promise.resolve(stepsData);
    return fetch(base + 'steps.json').then(function (r) { return r.json(); }).then(function (j) { stepsData = j; return j; }).catch(function () { stepsData = { order: [], pages: {} }; return stepsData; });
  }
  function doneCount(name) {
    var meta = stepsData && stepsData.pages[name];
    if (!meta) return 0;
    var ids = doneIds(name);
    return meta.ids.filter(function (id) { return ids.indexOf(id) > -1; }).length;
  }
  var doneBtns = $$('[data-done]');
  var meter = $('[data-progress]');
  function paintPage() {
    var total = doneBtns.length, n = doneBtns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length;
    if (!meter || !total) return;
    meter.hidden = false;
    $('.pp-fill', meter).style.setProperty('--p', String(n / total));
    $('.pp-text', meter).textContent = n === total ? 'All ' + total + ' steps done' : n + ' of ' + total + ' steps done';
  }
  function paintNav() {
    $$('.nav-link[data-total]').forEach(function (a) {
      var name = a.getAttribute('data-page'), total = +a.getAttribute('data-total');
      var n = name === page ? doneBtns.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length : doneCount(name);
      var mark = $('.sr-done', a);
      a.classList.toggle('is-complete', n >= total && total > 0);
      if (n >= total && total > 0 && !mark) { mark = doc.createElement('span'); mark.className = 'sr-only sr-done'; mark.textContent = ' (all steps done)'; a.appendChild(mark); }
      if (mark && !(n >= total)) mark.parentNode.removeChild(mark);
    });
  }
  if (doneBtns.length) {
    var mine = doneIds(page);
    doneBtns.forEach(function (b) {
      var id = b.getAttribute('data-done'), host = b.closest('.step, .phone-step');
      var num = $('.step-num, .ps-num', host);
      b.hidden = false;
      b.setAttribute('aria-label', 'Mark step ' + (num ? num.textContent : '') + ' done');
      function paint(on) { b.setAttribute('aria-pressed', String(on)); host.classList.toggle('is-done', on); $('.done-label', b).textContent = on ? 'Done' : 'Mark done'; }
      paint(mine.indexOf(id) > -1);
      b.addEventListener('click', function () {
        var all = store.get(PROG, {}), list = Array.isArray(all[page]) ? all[page] : [], on = b.getAttribute('aria-pressed') !== 'true';
        list = list.filter(function (x) { return x !== id; }); if (on) list.push(id);
        all[page] = list; store.set(PROG, all); store.set(LAST, { page: page, id: id });
        paint(on); paintPage(); paintNav();
      });
    });
    paintPage();
    store.set(LAST, { page: page, id: (store.get(LAST, {}) || {}).page === page ? (store.get(LAST, {}) || {}).id : null });
  }
  loadSteps().then(function () {
    paintNav();
    // Home page: route map, part rows and "continue where you left off"
    $$('.route-stop').forEach(function (stop) {
      var a = $('a', stop), name = (a.getAttribute('href') || '').replace('.html', '');
      var names = name === 'vercel' ? ['vercel', 'replit'] : [name];
      var best = names.map(function (nm) { var m = stepsData.pages[nm]; return m ? { n: doneCount(nm), t: m.ids.length } : { n: 0, t: 0 }; })
        .sort(function (x, y) { return (y.n / (y.t || 1)) - (x.n / (x.t || 1)); })[0];
      if (!best || !best.t || !best.n) return;
      var full = best.n >= best.t;
      stop.setAttribute('data-state', full ? 'done' : 'active');
      var nm = $('.route-name', stop), tag = doc.createElement('span');
      tag.className = 'sr-only'; tag.textContent = full ? ' (completed)' : ' (in progress)'; nm.appendChild(tag);
    });
    $$('.hub-row').forEach(function (row) {
      var name = (row.getAttribute('href') || '').replace('.html', ''), m = stepsData.pages[name];
      if (!m) return;
      var n = doneCount(name); if (!n) return;
      var meta = $('.hub-meta', row), sp = doc.createElement('span');
      sp.className = 'hub-progress'; sp.textContent = n >= m.ids.length ? 'All done' : n + ' of ' + m.ids.length + ' done'; meta.appendChild(sp);
    });
    var card = $('[data-resume]');
    if (card) {
      var last = store.get(LAST, null), order = stepsData.order, started = order.some(function (nm) { return doneCount(nm) > 0; });
      if (!last && !started) return;
      var cur = last && stepsData.pages[last.page] ? last.page : order.filter(function (nm) { return doneCount(nm) > 0; })[0];
      var target = cur && doneCount(cur) < stepsData.pages[cur].ids.length ? cur : null;
      if (!target) { var from = Math.max(0, order.indexOf(cur)); target = order.slice(from).concat(order.slice(0, from)).filter(function (nm) { return doneCount(nm) < stepsData.pages[nm].ids.length; })[0]; }
      var link = $('[data-resume-link]', card);
      if (!target) {
        $('[data-resume-title]', card).textContent = 'You have completed every step.';
        $('[data-resume-sub]', card).textContent = 'Keep the update workflow handy for later changes.';
        link.href = 'updates.html'; link.textContent = 'Open the update workflow';
      } else {
        var meta2 = stepsData.pages[target], ids = doneIds(target), first = meta2.ids.filter(function (id) { return ids.indexOf(id) < 0; })[0];
        $('[data-resume-title]', card).textContent = meta2.title;
        $('[data-resume-sub]', card).textContent = doneCount(target) + ' of ' + meta2.ids.length + ' steps done on this page';
        link.href = target + '.html' + (first ? '#' + first : ''); link.textContent = 'Continue';
      }
      card.hidden = false;
    }
  });

  // ── Share this page (Web Share where available, otherwise copy the link) ──
  $$('[data-share]').forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var canon = $('link[rel="canonical"]'), url = canon ? canon.href : location.href;
      var desc = $('meta[name="description"]');
      if (navigator.share) {
        navigator.share({ title: doc.title, text: desc ? desc.content : '', url: url }).catch(function () { /* cancelled */ });
      } else {
        copyText(url).then(function () { toast('Link copied.'); }, function () { toast('Could not copy. Copy the address from your browser instead.'); });
      }
    });
  });
  $$('[data-reload]').forEach(function (b) { b.addEventListener('click', function () { location.reload(); }); });

  // ── Install as an app: Chrome and Android prompt, iPhone instructions ──
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var installBtn = $('#install-btn'), installBox = $('#sidebar-install'), iosDlg = $('#ios-install');
  var deferred = null, offered = false, DISMISS = 'aisa-install-dismissed';
  function canInstall() { return !standalone && (deferred || (isIOS && iosDlg && iosDlg.showModal)); }
  function showInstall() { if (installBox && canInstall()) installBox.hidden = false; }
  function runInstall() {
    if (deferred) {
      var d = deferred; deferred = null; d.prompt();
      d.userChoice.then(function () { if (installBox) installBox.hidden = true; });
    } else if (isIOS && iosDlg) { setNav(false); iosDlg.showModal(); }
  }
  function maybeOffer() {
    var gone = store.get(DISMISS, 0), views = store.get('aisa-views', 0);
    if (offered || !canInstall() || (gone && Date.now() - gone < 14 * 864e5)) return;
    function go() {
      if (offered || !canInstall()) return; offered = true;
      toast('Install this guide on your device to keep it one tap away, even offline.', { persist: true, actions: [
        { label: 'Install', primary: true, run: runInstall },
        { label: 'Not now', run: function () { store.set(DISMISS, Date.now()); } } ] });
    }
    // Not on the first screen: after the second page view, or after 45 seconds of reading
    if (views >= 2) setTimeout(go, 4000); else setTimeout(go, 45000);
  }
  store.set('aisa-views', store.get('aisa-views', 0) + 1);
  if (installBtn) installBtn.addEventListener('click', runInstall);
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showInstall(); maybeOffer(); });
  window.addEventListener('appinstalled', function () { deferred = null; standalone = true; if (installBox) installBox.hidden = true; toast('Installed. Open it from your home screen.'); });
  if (iosDlg) iosDlg.addEventListener('click', function (e) { if (e.target === iosDlg) iosDlg.close(); });
  if (isIOS) { showInstall(); maybeOffer(); }

  // ── Online and offline status ──
  var offlineToast = null;
  function netState() {
    if (!navigator.onLine && !offlineToast) offlineToast = toast("You're offline. Pages you have opened still work.", { persist: true });
    else if (navigator.onLine && offlineToast) { offlineToast.close(); offlineToast = null; toast('Back online.'); }
  }
  window.addEventListener('offline', netState); window.addEventListener('online', netState);
  if (!navigator.onLine) netState();

  // ── Offline support and a safe update flow ──
  if ('serviceWorker' in navigator && window.isSecureContext) {
    var hadController = !!navigator.serviceWorker.controller, reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return; reloading = true; location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + 'sw.js').then(function (reg) {
        function offer(worker) {
          toast('A new version of the guide is ready.', { persist: true, actions: [
            { label: 'Refresh', primary: true, run: function () { worker.postMessage('SKIP_WAITING'); } },
            { label: 'Later' } ] });
        }
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (nw) nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw); });
        });
        doc.addEventListener('visibilitychange', function () { if (!doc.hidden) reg.update().catch(function () { /* offline */ }); });
      }).catch(function () { /* offline support is optional */ });
    });
  }
})();
