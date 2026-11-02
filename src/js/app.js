// AI Studio to Android Guide: app behaviour. No dependencies.
// Progress on this device, install prompts, offline and update handling, sharing.
(function () {
  'use strict';
  var doc = document;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var base = new URL('../', doc.currentScript ? doc.currentScript.src : location.href).href;
  var announce = function (m) { if (window.AISA && window.AISA.announce) window.AISA.announce(m); };

  // Small storage helpers: every call is guarded, because storage can be blocked or full
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* progress simply will not be remembered */ } }

  // Toasts
  var toasts = $('#toasts');
  var CLOSE = '<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-close"/></svg>';
  function toast(text, opts) {
    opts = opts || {};
    if (!toasts) return null;
    var t = doc.createElement('div'); t.className = 'toast';
    var p = doc.createElement('p'); p.textContent = text; t.appendChild(p);
    function remove() { if (t.parentNode) t.parentNode.removeChild(t); }
    if (opts.action) {
      var a = doc.createElement('button'); a.type = 'button'; a.className = 'btn btn-primary btn-sm'; a.textContent = opts.action;
      a.addEventListener('click', function () { if (opts.onAction) opts.onAction(); remove(); }); t.appendChild(a);
    }
    var x = doc.createElement('button'); x.type = 'button'; x.className = 'icon-btn'; x.setAttribute('aria-label', 'Dismiss'); x.innerHTML = CLOSE;
    x.addEventListener('click', remove); t.appendChild(x);
    toasts.appendChild(t);
    if (!opts.sticky) setTimeout(remove, 6500);
    return t;
  }

  // ── Progress: which steps this reader has finished (kept on this device only) ──
  var KEY = 'aisa-progress';
  var done = new Set(load(KEY, []));
  var steps = null;
  var meter = $('#pc-meter'), fill = $('#pc-fill'), doneEl = $('#pc-done'), resetBtn = $('#pc-reset');
  var total = meter ? Number(meter.getAttribute('aria-valuemax')) : 0;

  function paintSteps() {
    $$('[data-done]').forEach(function (btn) {
      var id = btn.getAttribute('data-done'), on = done.has(id), li = btn.closest('[data-step]');
      btn.setAttribute('aria-pressed', String(on));
      $('.done-label', btn).textContent = on ? 'Done' : 'Mark as done';
      if (li) li.classList.toggle('is-done', on);
    });
  }
  function paintTotals() {
    if (!steps) return;
    var requiredDone = steps.filter(function (s) { return !s.o && done.has(s.id); }).length;
    if (doneEl) doneEl.textContent = String(requiredDone);
    if (meter) meter.setAttribute('aria-valuenow', String(requiredDone));
    if (fill) fill.style.setProperty('--p', total ? (requiredDone / total).toFixed(3) : '0');
    if (resetBtn) resetBtn.hidden = done.size === 0;
    $$('.nav-count').forEach(function (el) {
      var page = el.getAttribute('data-count-page'), n = Number(el.getAttribute('data-total'));
      var c = steps.filter(function (s) { return s.p === page && done.has(s.id); }).length;
      el.className = 'nav-count' + (c === n ? ' is-complete' : '') + (c ? ' has-progress' : '');
      el.innerHTML = '';
      var vis = doc.createElement('span'); vis.setAttribute('aria-hidden', 'true'); vis.textContent = c === n ? '' : (c ? c + '/' + n : '');
      var sr = doc.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' (' + c + ' of ' + n + ' steps done)';
      el.appendChild(vis); el.appendChild(sr);
    });
    paintResume();
  }
  function paintResume() {
    var card = $('#resume'); if (!card || !steps) return;
    var anyDone = steps.some(function (s) { return done.has(s.id); });
    var req = steps.filter(function (s) { return !s.o; }), last = -1;
    req.forEach(function (s, i) { if (done.has(s.id)) last = i; });
    var next = req.slice(last + 1).filter(function (s) { return !done.has(s.id); })[0] || req.filter(function (s) { return !done.has(s.id); })[0];
    card.hidden = !anyDone;
    if (!anyDone) return;
    var title = $('#resume-title'), link = $('#resume-link'), lead = $('#resume-lead');
    if (next) {
      title.textContent = 'Pick up at step ' + next.n;
      lead.textContent = next.t;
      link.textContent = 'Continue'; link.setAttribute('href', next.h);
    } else {
      title.textContent = 'You have finished the main route';
      lead.textContent = 'Every required step is marked as done. Something not working yet? The fixes are one page away.';
      link.textContent = 'Open troubleshooting'; link.setAttribute('href', 'troubleshoot.html');
    }
  }
  function persist() { save(KEY, Array.from(done)); paintSteps(); paintTotals(); }

  $$('[data-done]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-done'), num = (btn.getAttribute('aria-label') || '').replace(/^Mark step | as done$/g, '');
      if (done.has(id)) { done.delete(id); announce('Step ' + num + ' marked as not done'); } else { done.add(id); announce('Step ' + num + ' marked as done'); }
      persist();
    });
  });
  if (resetBtn) {
    var armed = 0;
    resetBtn.addEventListener('click', function () {
      if (!armed) {
        resetBtn.textContent = 'Tap again to clear'; armed = setTimeout(function () { armed = 0; resetBtn.textContent = 'Reset progress'; }, 4000); return;
      }
      clearTimeout(armed); armed = 0; resetBtn.textContent = 'Reset progress';
      done = new Set(); persist(); announce('Progress cleared');
    });
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) { done = new Set(load(KEY, [])); paintSteps(); paintTotals(); } });
  paintSteps();
  fetch(base + 'steps.json').then(function (r) { return r.json(); }).then(function (j) { steps = j; paintTotals(); }).catch(function () { /* the counters stay hidden */ });

  // ── Share ──
  $$('[data-share]').forEach(function (btn) {
    var canShare = !!navigator.share, canCopy = !!(navigator.clipboard && window.isSecureContext);
    if (!canShare && !canCopy) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var url = location.href.split('#')[0], title = btn.getAttribute('data-share-title') || doc.title;
      if (canShare) { navigator.share({ title: title, url: url }).catch(function () { /* cancelled */ }); return; }
      navigator.clipboard.writeText(url).then(function () { toast('Link copied.'); });
    });
  });

  // ── Install: Chrome and Edge prompt, iPhone gets a short illustrated guide ──
  var ua = navigator.userAgent;
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /android/i.test(ua);
  var standaloneMq = window.matchMedia('(display-mode: standalone)');
  var isInstalled = function () { return standaloneMq.matches || navigator.standalone === true; };
  var deferred = null;
  var installBtns = $$('[data-install]'), banner = $('#install-banner'), dismiss = $('#install-dismiss'), idlg = $('#install-dialog');
  var DISMISS_KEY = 'aisa-install-dismissed', THIRTY_DAYS = 30 * 24 * 3600 * 1000;

  function canInstall() { return !isInstalled() && !!(deferred || ios || android); }
  function paintInstall() { installBtns.forEach(function (b) { b.hidden = !canInstall(); }); if (!canInstall() && banner) banner.hidden = true; }
  function dismissed() { var t = Number(load(DISMISS_KEY, 0)); return t && Date.now() - t < THIRTY_DAYS; }
  function maybeBanner() {
    if (!banner || !canInstall() || dismissed()) return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    banner.hidden = false;
  }
  function openHowTo() {
    if (!idlg || !idlg.showModal) return;
    var other = !ios && !android;
    $('#how-ios').hidden = !(ios || other);
    $('#how-android').hidden = !(android || other);
    if (!idlg.open) idlg.showModal();
  }
  function runInstall() {
    if (deferred) {
      var d = deferred; deferred = null; paintInstall();
      d.prompt(); d.userChoice.then(function (c) { if (c && c.outcome === 'dismissed') save(DISMISS_KEY, Date.now()); });
    } else { openHowTo(); }
  }
  installBtns.forEach(function (b) { b.addEventListener('click', function () { if (banner) banner.hidden = true; runInstall(); }); });
  if (dismiss) dismiss.addEventListener('click', function () { banner.hidden = true; save(DISMISS_KEY, Date.now()); });
  if (idlg) {
    $$('[data-close-dialog]', idlg).forEach(function (b) { b.addEventListener('click', function () { idlg.close(); }); });
    idlg.addEventListener('click', function (e) { if (e.target === idlg) idlg.close(); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; paintInstall(); scheduleBanner(); });
  window.addEventListener('appinstalled', function () { deferred = null; paintInstall(); toast('Installed. Look for it on your home screen.'); });
  if (standaloneMq.addEventListener) standaloneMq.addEventListener('change', paintInstall);
  paintInstall();

  // The banner waits until the reader has had a look around: a second page view, or 20 seconds
  var views = 0;
  try { views = Number(sessionStorage.getItem('aisa-views') || 0) + 1; sessionStorage.setItem('aisa-views', String(views)); } catch (e) { /* ignore */ }
  var bannerTimer = 0;
  function scheduleBanner() { if (views >= 2) maybeBanner(); else if (!bannerTimer) bannerTimer = setTimeout(maybeBanner, 20000); }
  scheduleBanner();

  // ── Offline indicator ──
  var pill = $('#net-pill');
  function paintNet() { if (pill) pill.hidden = navigator.onLine; }
  window.addEventListener('offline', paintNet);
  window.addEventListener('online', function () { paintNet(); toast('You are back online.'); });
  paintNet();

  // ── Service worker, with an update the reader controls ──
  if ('serviceWorker' in navigator && window.isSecureContext) {
    var reloading = false, wanted = false, prompted = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (wanted && !reloading) { reloading = true; location.reload(); } });
    var promptUpdate = function (worker) {
      if (prompted) return; prompted = true;
      toast('A new version of the guide is ready.', { action: 'Refresh', sticky: true, onAction: function () { wanted = true; worker.postMessage('SKIP_WAITING'); } });
    };
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + 'sw.js', { scope: base }).then(function (reg) {
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing; if (!nw) return;
          nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw); });
        });
        doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') reg.update().catch(function () { /* offline */ }); });
      }).catch(function () { /* offline support is optional */ });
    });
  }
})();
