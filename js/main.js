// ═══════════════════════════════════════════
// AI Studio → Android Guide — shared site script
// ═══════════════════════════════════════════

// ── READING PROGRESS ──
window.addEventListener('scroll', () => {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const max = document.body.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  bar.style.width = pct + '%';
});

// ── MOBILE MENU ──
function toggleNav() {
  document.getElementById('sidebar').classList.toggle('open');
}
document.querySelectorAll('.nav-item, .nav-section-link').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 960) document.getElementById('sidebar')?.classList.remove('open');
  });
});

// ── ISSUE ACCORDION ──
function toggleIssue(btn) {
  const body = btn.nextElementSibling;
  const isOpen = btn.classList.contains('open');
  document.querySelectorAll('.issue-trigger').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.issue-body').forEach(b => b.classList.remove('open'));
  if (!isOpen) { btn.classList.add('open'); body.classList.add('open'); }
}

// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('revealed');
  });
}, { threshold: 0.08 });
document.querySelectorAll('.doc-section, .bento-section').forEach(s => revealObserver.observe(s));

// ── ACTIVE NAV (highlight current page + in-page section while scrolling) ──
(function () {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item, .hub-card').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.split('#')[0] === path) link.classList.add('current');
  });

  const sections = document.querySelectorAll('main [id]');
  const inPageLinks = document.querySelectorAll('.nav-section-link');
  if (sections.length && inPageLinks.length) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          inPageLinks.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.nav-section-link[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(s => navObserver.observe(s));
  }
})();

// ── COPY CODE ──
function copyCode(btn) {
  const pre = btn.closest('.code-block').querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(() => {
    btn.textContent = 'copied!';
    btn.style.color = 'var(--green)';
    setTimeout(() => { btn.textContent = 'copy'; btn.style.color = ''; }, 2000);
  });
}

// ── SIDEBAR SEARCH (client-side filter across nav items) ──
function filterNav(input) {
  const q = input.value.trim().toLowerCase();
  document.querySelectorAll('.nav-section').forEach(section => {
    let anyVisible = false;
    section.querySelectorAll('.nav-item').forEach(item => {
      const match = item.textContent.toLowerCase().includes(q);
      item.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    if (!q) { section.querySelectorAll('.nav-item').forEach(i => i.style.display = ''); anyVisible = true; }
    section.style.display = anyVisible ? '' : 'none';
  });
}

// ── BACK TO TOP ──
(function () {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 500);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// ── THEME TOGGLE (persists for the session via a cookie-free in-memory flag on load) ──
(function () {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const apply = (dark) => {
    document.documentElement.classList.toggle('dark', dark);
    toggle.querySelector('.tt-label').textContent = dark ? 'Light mode' : 'Dark mode';
    toggle.querySelector('.tt-icon').textContent = dark ? '☀️' : '🌙';
  };
  let dark = false;
  try { dark = localStorage.getItem('aig-theme') === 'dark'; } catch (e) {}
  apply(dark);
  toggle.addEventListener('click', () => {
    dark = !dark;
    apply(dark);
    try { localStorage.setItem('aig-theme', dark ? 'dark' : 'light'); } catch (e) {}
  });
})();
