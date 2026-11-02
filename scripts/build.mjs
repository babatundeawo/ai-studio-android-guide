// Static site builder. Zero dependencies: only Node's standard library.
// Reads src/ and public/, writes the finished site to dist/.
// Runs automatically in GitHub Actions; nobody needs to run it locally.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const site = JSON.parse(readFileSync(join(root, 'site.json'), 'utf8'));

// The site address is worked out automatically, so the same code works on
// username.github.io/repository/ and on a custom domain:
// 1. SITE_URL, set by the deploy workflow from GitHub Pages itself (covers custom domains)
// 2. the repository name GitHub gives every workflow run
// 3. the address written in site.json
const fromRepo = process.env.GITHUB_REPOSITORY
  ? (() => { const [o, r] = process.env.GITHUB_REPOSITORY.split('/'); return `https://${o.toLowerCase()}.github.io/${r}/`; })()
  : '';
const siteUrl = (process.env.SITE_URL || fromRepo || site.url).replace(/\/?$/, '/');
const basePath = new URL(siteUrl).pathname;

const read = (p) => readFileSync(join(root, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/&amp;/g, 'and').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
const hrefOf = (name) => (name === 'index' ? 'index.html' : `${name}.html`);

// ── Content files: a small header between --- lines, then the page body ──
function parsePage(name) {
  const raw = read(`src/pages/${name}.html`);
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`src/pages/${name}.html is missing its --- header`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { name, meta, body: m[2].trim() };
}

// ── Pass 1: number the steps across the whole guide ──
// A step with an empty number gets the next number automatically.
// A step with its own label (6B, R1) keeps it and counts as optional.
const pages = site.order.map(parsePage);
const steps = [];
let counter = 0;
const stepPatterns = [
  { re: /<li class="step([^"]*)"( id="[^"]+")?><span class="step-num">([^<]*)<\/span>([\s\S]*?<h2 class="step-title">)([^<]+)(<\/h2>)/g, kind: 'step' },
  { re: /<li class="phone-step([^"]*)"( id="[^"]+")?><span class="ps-num">([^<]*)<\/span>([\s\S]*?<div class="ps-title">)([^<]+)(<\/div>)/g, kind: 'phone' }
];
for (const p of pages) {
  p.steps = [];
  let body = p.body;
  for (const { re, kind } of stepPatterns) {
    body = body.replace(re, (all, cls, idAttr, num, mid, title, end) => {
      const label = num.trim() || String(++counter);
      const optional = p.meta.optional === 'true' || !/^\d+$/.test(label);
      const id = idAttr ? idAttr.match(/"([^"]+)"/)[1] : `step-${slug(label)}`;
      const item = { id, num: label, title: stripTags(title), page: p.name, optional, kind };
      p.steps.push(item); steps.push(item);
      const attrs = ` id="${id}" data-step="${id}"${optional ? ' data-optional="true"' : ''}`;
      return kind === 'step'
        ? `<li class="step${cls}"${attrs}><span class="step-num">${label}</span>${mid}${title}${end}`
        : `<li class="phone-step${cls}"${attrs}><span class="ps-num">${label}</span>${mid}${title}${end}`;
    });
  }
  p.body = body;
  const nums = p.steps.map((s) => s.num);
  p.stepsLabel = nums.length ? (nums.length === 1 ? `Step ${nums[0]}` : `Steps ${nums[0]} to ${nums[nums.length - 1]}`) : '';
  p.stepCount = nums.length;
}
const pageByName = Object.fromEntries(pages.map((p) => [p.name, p]));
const requiredSteps = steps.filter((s) => !s.optional).length;

// ── Body enhancements applied to every page ──
function enhance(body) {
  const toc = [];
  let out = body;
  // Steps: "On this page" entries and a "mark as done" control
  const doneBtn = (id, num) => `<button class="done-btn" type="button" data-done="${id}" aria-pressed="false" aria-label="Mark step ${esc(num)} as done"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg><span class="done-label">Mark as done</span></button>`;
  out = out.replace(/<li class="step([^"]*)" id="([^"]+)" data-step="[^"]+"([^>]*)><span class="step-num">([^<]+)<\/span>([\s\S]*?<div class="step-head"><h2 class="step-title">)([^<]+)(<\/h2>)((?:<span class="tag[^"]*">[^<]*<\/span>)?)(<\/div>)/g,
    (_, cls, id, extra, num, mid, title, h2end, tag, headEnd) => {
      toc.push({ id, label: `${num}. ${stripTags(title)}`, kind: 'step' });
      return `<li class="step${cls}" id="${id}" data-step="${id}"${extra}><span class="step-num">${num}</span>${mid}${title}${h2end}${tag}${doneBtn(id, num)}${headEnd}`;
    });
  out = out.replace(/(<li class="phone-step[^"]*" id="([^"]+)" data-step="[^"]+"[^>]*><span class="ps-num">([^<]+)<\/span>[\s\S]*?<div class="ps-title">([^<]+)<\/div>[\s\S]*?<div class="ps-desc">[\s\S]*?<\/div>)(<\/li>)/g,
    (_, head, id, num, title, end) => {
      toc.push({ id, label: `${num}. ${stripTags(title)}`, kind: 'step' });
      return `${head}${doneBtn(id, num)}${end}`;
    });
  // Second-level headings inside the body
  out = out.replace(/<h2( id="([^"]+)")?( class="subhead")>([^<]+)<\/h2>/g, (_, _i, id, cls, text) => {
    const hid = id || slug(text);
    toc.push({ id: hid, label: stripTags(text), kind: 'h2' });
    return `<h2 id="${hid}"${cls}>${text}</h2>`;
  });
  out = out.replace(/<details class="issue" id="(issue-\d+)"><summary><span class="iss-badge">([^<]+)<\/span><span class="iss-title">([^<]+)</g,
    (m0, id, badge, t) => { toc.push({ id, label: `${badge}: ${stripTags(t)}`, kind: 'issue' }); return m0; });
  // Alert titles, safe external links, keyboard-scrollable code, responsive tables
  out = out.replace(/<div class="alert-body"><strong>/g, '<div class="alert-body"><strong class="alert-title">');
  out = out.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" rel="noopener noreferrer" target="_blank" class="ext"');
  out = out.replace(/<pre>/g, '<pre tabindex="0">');
  out = out.replace(/<table class="([^"]+)">([\s\S]*?)<\/table>/g, (_, c, inner) => {
    inner = inner.replace(/<tr>(<th>[\s\S]*?)<\/tr>/, '<thead><tr>$1</tr></thead><tbody>').replace(/<th>/g, '<th scope="col">');
    return `<div class="table-wrap"><table class="${c}">${inner}</tbody></table></div>`;
  });
  out = out.replace(/<div class="env-all">/g, '<div class="env-all" aria-hidden="true">');
  out = out.replace(/<svg class="ico" aria-hidden="true">/g, '<svg class="ico" aria-hidden="true" focusable="false">');
  return { html: out, toc };
}

function navHtml(current) {
  return site.nav.map((g) => {
    const items = g.items.map((it) => {
      const cur = it.page === current ? ' aria-current="page"' : '';
      const p = pageByName[it.page];
      const count = p && p.stepCount
        ? `<span class="nav-count" data-count-page="${it.page}" data-total="${p.stepCount}"${it.optional ? ' data-optional="true"' : ''}></span>`
        : '';
      return `      <li><a class="nav-link" href="${hrefOf(it.page)}"${cur}><span class="nav-dot" aria-hidden="true"></span><span class="nav-text">${esc(it.label)}</span>${count}</a></li>`;
    }).join('\n');
    return `    <div class="nav-group"><p class="nav-label">${esc(g.label)}</p><ul>\n${items}\n    </ul></div>`;
  }).join('\n');
}

function pageHeader(p) {
  const { meta } = p;
  const part = esc(meta.part);
  const stepsChip = p.stepsLabel ? `<span class="meta-chip">${esc(p.stepsLabel)}</span>` : (meta.steps ? `<span class="meta-chip">${esc(meta.steps)}</span>` : '');
  const reviewed = meta.reviewed ? `<p class="reviewed"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>${esc(meta.reviewed)}</p>` : '';
  const share = `<button class="btn btn-ghost btn-sm" type="button" data-share data-share-title="${esc(meta.h1)}" hidden><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-share"/></svg>Share</button>`;
  return `<header class="page-head">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Guide</a></li><li aria-current="page">${part}</li></ol></nav>
      <h1 class="page-title">${esc(meta.h1)}</h1>
      ${meta.lead ? `<p class="page-lead">${esc(meta.lead)}</p>` : ''}
      <div class="page-meta">${stepsChip}${reviewed}${share}</div>
    </header>`;
}

function pagerTitle(n) {
  const p = pageByName[n];
  if (n === 'index') return 'Guide overview';
  if (['troubleshoot', 'tips', 'glossary'].includes(n)) return p.meta.nav;
  return (p.meta.part ? `${p.meta.part}: ` : '') + (p.meta.nav || p.meta.title);
}
function pager(name) {
  const order = site.order, i = order.indexOf(name);
  const prev = order[i - 1], next = order[i + 1];
  const link = (n, dir, label) => `<a class="pager-link pager-${dir}" href="${hrefOf(n)}" rel="${dir}"><span class="pager-dir">${label}</span><span class="pager-title">${esc(pagerTitle(n))}</span></a>`;
  if (name === 'glossary') {
    return `<nav class="pager" aria-label="Pages">${link(prev, 'prev', 'Previous')}<a class="pager-link pager-next" href="index.html"><span class="pager-dir">Back to</span><span class="pager-title">Guide overview</span></a></nav>`;
  }
  return `<nav class="pager" aria-label="Pages">${prev ? link(prev, 'prev', 'Previous') : '<span></span>'}${next ? link(next, 'next', 'Next') : ''}</nav>`;
}

// ── Build ──
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });
rmSync(join(dist, 'README.md'), { force: true });

// CSS: concatenated in file-name order. The dark palette is written once in
// 00-tokens.css and copied here into the "follow the system" rule.
const cssDir = join(root, 'src/css');
let css = readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort().map((f) => readFileSync(join(cssDir, f), 'utf8')).join('\n');
const darkBlock = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
if (!darkBlock) throw new Error('The [data-theme="dark"] block is missing from src/css/00-tokens.css');
if (site.themeMode === 'system') css += `\n@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {${darkBlock[1]}\n} }\n`;
css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{2,}/g, '\n');
mkdirSync(join(dist, 'css'), { recursive: true });
writeFileSync(join(dist, 'css/style.css'), css);
mkdirSync(join(dist, 'js'), { recursive: true });
const jsFiles = readdirSync(join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort();
for (const f of jsFiles) cpSync(join(root, 'src/js', f), join(dist, 'js', f));

const layout = read('src/partials/layout.html');
const icons = read('src/partials/icons.svg');
const hash = createHash('sha1').update(css).update(layout).update(icons).update(JSON.stringify(site));
for (const f of jsFiles) hash.update(read(`src/js/${f}`));
for (const p of pages) hash.update(p.body);
const build = hash.digest('hex').slice(0, 8);

const forced = site.themeMode === 'light' || site.themeMode === 'dark';
const themeToggle = forced ? '' : '<button class="icon-btn" type="button" id="theme-btn" aria-label="Switch to dark theme"><svg class="ico" data-icon-moon aria-hidden="true"><use href="#i-moon"/></svg><svg class="ico" data-icon-sun aria-hidden="true" hidden><use href="#i-sun"/></svg></button>';
const themeMetas = forced
  ? `<meta name="theme-color" content="${site.themeColor[site.themeMode]}">`
  : `<meta name="theme-color" content="${site.themeColor.light}" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="${site.themeColor.dark}" media="(prefers-color-scheme: dark)">`;

const common = () => ({
  icons, build, themeToggle, themeMetas,
  colorScheme: forced ? site.themeMode : 'light dark',
  htmlTheme: forced ? ` data-theme="${site.themeMode}" data-locked="true"` : '',
  siteName: esc(site.name), twitter: site.twitter, version: site.version, updated: site.updated,
  publisher: esc(site.publisher), repo: site.repo, ogImage: `${siteUrl}og-image.png`,
  stepsTotal: String(requiredSteps), shortName: esc(site.shortName)
});

const searchIndex = [];
const urls = [];
const precache = [];

// Placeholders that let the home page quote live numbers
const homeVars = (body) => body
  .replace(/\{\{steps:(\w+)\}\}/g, (_, n) => pageByName[n].stepsLabel)
  .replace(/\{\{count:(\w+)\}\}/g, (_, n) => String(pageByName[n].stepCount))
  .replace(/\{\{stepsTotal\}\}/g, String(steps.length))
  .replace(/\{\{pagesTotal\}\}/g, String(pages.length - 1));

for (const p of pages) {
  const isHome = p.meta.layout === 'home';
  const { html, toc } = enhance(isHome ? homeVars(p.body) : p.body);
  const fullTitle = isHome ? p.meta.title : `${p.meta.title} | ${site.name}`;
  const file = `${p.name}.html`;
  const canonical = isHome ? siteUrl : `${siteUrl}${file}`;
  const tocHtml = toc.length > 1 ? `<aside class="toc" aria-label="On this page"><p class="toc-label">On this page</p><ul>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.label)}</a></li>`).join('')}</ul></aside>` : '';
  const main = isHome
    ? `<div class="home">${html}</div>`
    : `<div class="doc">
    ${pageHeader(p)}
    <div class="doc-body">
      <article class="prose" aria-label="${esc(p.meta.h1)}">
${html}
      </article>
      ${tocHtml}
    </div>
    ${pager(p.name)}
  </div>`;
  const ld = isHome
    ? { '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebSite', name: site.name, url: siteUrl, description: p.meta.description, inLanguage: 'en', publisher: { '@type': 'Organization', name: site.publisher } },
        { '@type': 'LearningResource', name: site.name, description: site.tagline, url: siteUrl, inLanguage: 'en', learningResourceType: 'Tutorial', timeRequired: 'PT1H', author: { '@type': 'Person', name: site.author } } ] }
    : { '@context': 'https://schema.org', '@graph': [
        { '@type': 'TechArticle', headline: p.meta.h1, description: p.meta.description, url: canonical, inLanguage: 'en', image: `${siteUrl}og-image.png`, dateModified: site.updatedISO,
          author: { '@type': 'Person', name: site.author }, publisher: { '@type': 'Organization', name: site.publisher }, isPartOf: { '@type': 'WebSite', name: site.name, url: siteUrl } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Guide', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: p.meta.part, item: canonical } ] } ] };
  const page = fill(layout, {
    ...common(), nav: navHtml(p.name), main,
    jsonld: JSON.stringify(ld).replace(/</g, '\\u003c'), robots: '',
    bodyClass: isHome ? 'is-home' : 'is-doc', ogType: isHome ? 'website' : 'article',
    title: esc(fullTitle), description: esc(p.meta.description), canonical
  });
  writeFileSync(join(dist, file), page);
  urls.push(canonical); precache.push(file);

  // Search index: the page, then each anchored heading with the text that follows it
  searchIndex.push({ t: p.meta.h1 || p.meta.title, u: file, p: p.meta.part || 'Guide', x: stripTags(p.meta.lead || p.meta.description || '') + ' ' + stripTags(isHome ? html : '').slice(0, 600) });
  for (const t of toc) {
    const at = html.indexOf(`id="${t.id}"`);
    const chunk = stripTags(html.slice(at, at + 1400));
    searchIndex.push({ t: t.label, u: `${file}#${t.id}`, p: p.meta.h1, x: chunk });
  }
  if (p.name === 'glossary') {
    for (const m of html.matchAll(/<div class="gls-item" id="([^"]+)"><dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)) {
      searchIndex.push({ t: stripTags(m[2]), u: `${file}#${m[1]}`, p: 'Glossary', x: stripTags(m[3]) });
    }
  }
}

// 404 and offline pages. Both can be shown from any URL depth, so every
// relative address is rewritten to an absolute one.
function standalone(file, { title, description, body, bodyClass }) {
  let page = fill(layout, {
    ...common(), nav: navHtml(''), main: body, jsonld: '{}',
    robots: '<meta name="robots" content="noindex">', bodyClass, ogType: 'website',
    title: esc(title), description: esc(description), canonical: siteUrl
  });
  page = page.replace(/(href|src)="(?!https?:|#|\/|data:|mailto:)([^"]+)"/g, (_, a, u) => `${a}="${basePath}${u}"`);
  writeFileSync(join(dist, file), page);
}
standalone('404.html', {
  title: `Page not found | ${site.name}`, description: 'This page could not be found. Return to the AI Studio to Android deployment guide.', bodyClass: 'is-doc is-404',
  body: `<div class="doc not-found"><header class="page-head"><h1 class="page-title">That page is not on this route</h1>
    <p class="page-lead">The link may be old, or the address may have a typo. Start from the overview, or search the guide.</p></header>
    <p class="actions"><a class="btn btn-primary" href="${basePath}">Go to the guide overview</a> <button class="btn btn-ghost" type="button" data-open-search>Search the guide</button></p></div>`
});
standalone('offline.html', {
  title: `You are offline | ${site.name}`, description: 'You are offline. Pages you have already opened are still available.', bodyClass: 'is-doc is-offline',
  body: `<div class="doc not-found"><header class="page-head"><h1 class="page-title">You are offline</h1>
    <p class="page-lead">This page was not saved on your device before the connection dropped. Every page you have opened before still works without a connection.</p></header>
    <p class="actions"><a class="btn btn-primary" href="${basePath}">Open the guide overview</a> <button class="btn btn-ghost" type="button" data-reload>Try again</button></p></div>`
});

writeFileSync(join(dist, 'search-index.json'), JSON.stringify(searchIndex));
writeFileSync(join(dist, 'steps.json'), JSON.stringify(steps.map((s) => ({ id: s.id, n: s.num, t: s.title, p: s.page, o: s.optional ? 1 : 0, h: `${s.page}.html#${s.id}` }))));
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${site.updatedISO}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);

// Web app manifest. Every address is relative, so it works under /repository/ and on a custom domain.
const shot = (f, label, form) => (existsSync(join(root, 'public/screenshots', f)) ? [{ src: `screenshots/${f}`, sizes: form === 'wide' ? '1280x720' : '720x1280', type: 'image/png', form_factor: form, label }] : []);
const shortcutIcon = [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }];
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
  id: './', name: site.name, short_name: site.shortName, description: site.tagline, lang: 'en', dir: 'ltr',
  start_url: './?source=pwa', scope: './', display: 'standalone', orientation: 'any',
  background_color: site.themeColor.light, theme_color: site.themeColor.light, categories: ['education', 'productivity'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ],
  shortcuts: [
    { name: 'Start Part 1', short_name: 'Part 1', description: 'Set up your accounts', url: 'accounts.html', icons: shortcutIcon },
    { name: 'Install on Android', short_name: 'Install', description: 'Install your app on a phone', url: 'android.html', icons: shortcutIcon },
    { name: 'Troubleshooting', short_name: 'Fix a problem', description: 'Find a fix for a common error', url: 'troubleshoot.html', icons: shortcutIcon }
  ],
  screenshots: [...shot('wide.png', 'The guide home page on a computer', 'wide'), ...shot('narrow.png', 'The guide home page on a phone', 'narrow')]
}, null, 2));

// Service worker: caches the whole guide so it can be read offline, and
// waits for the reader's go-ahead before switching to a new version.
const assets = ['./', ...precache, '404.html', 'offline.html', `css/style.css?v=${build}`, ...jsFiles.filter((f) => f !== 'sw.template.js').map((f) => `js/${f}?v=${build}`), 'search-index.json', 'steps.json',
  'fonts/geist-latin-wght-normal.woff2', 'fonts/geist-mono-latin-wght-normal.woff2', 'icons/icon.svg', 'icons/icon-192.png', 'manifest.webmanifest', 'favicon.ico'];
writeFileSync(join(dist, 'sw.js'), read('src/js/sw.template.js').replace('__BUILD__', build).replace('__ASSETS__', JSON.stringify(assets, null, 1)));
rmSync(join(dist, 'js/sw.template.js'), { force: true });
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Built ${pages.length} pages + 404 + offline into dist/ (build ${build}) for ${siteUrl}`);
console.log(`Steps: ${steps.length} in total, ${requiredSteps} on the main route.`);
