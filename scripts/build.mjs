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
const siteUrl = (process.env.SITE_URL || site.url).replace(/\/?$/, '/');
const basePath = new URL(siteUrl).pathname;

// Safety net: if this repository is renamed, links would silently break on GitHub Pages.
// Fail with a readable message instead of publishing a broken site.
if (process.env.GITHUB_REPOSITORY) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const host = new URL(siteUrl).hostname.toLowerCase();
  if (host === `${owner.toLowerCase()}.github.io`) {
    const expected = repo.toLowerCase() === host ? '/' : `/${repo.toLowerCase()}/`;
    if (basePath.toLowerCase() !== expected) {
      console.error(`\nERROR: site.json says the site lives at ${siteUrl}\nbut this repository is named "${repo}", so GitHub Pages will publish it at https://${host}${expected}\nOpen site.json on GitHub, change "url" to that address (keep the trailing slash), and commit again.\n`);
      process.exit(1);
    }
  }
}

const read = (p) => readFileSync(join(root, p), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/&amp;/g, 'and').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

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

// ── Body enhancements applied to every page ──
const doneBtn = (id) => `<button type="button" class="done-btn" data-done="${id}" aria-pressed="false" hidden><span class="done-box" aria-hidden="true"></span><span class="done-label">Mark done</span></button>`;

function enhance(body) {
  const toc = [];
  const track = [];
  let out = body;
  // Give every step a stable, shareable id and collect it for "On this page"
  out = out.replace(/<li class="step([^"]*)"( id="([^"]+)")?><span class="step-num">([^<]+)<\/span>([\s\S]*?<h2 class="step-title">)([^<]+)(<\/h2>)/g,
    (_, cls, _i, id, num, mid, title, end) => {
      const sid = id || `step-${slug(num)}`;
      toc.push({ id: sid, label: `${num}. ${stripTags(title)}`, kind: 'step' });
      track.push(sid);
      return `<li class="step${cls}" id="${sid}"><span class="step-num">${num}</span>${mid}${title}${end}${doneBtn(sid)}`;
    });
  // Phone steps (Part 5) can be ticked off too
  out = out.replace(/<div class="phone-step"><span class="ps-num">([^<]+)<\/span>([\s\S]*?<div class="ps-desc">[\s\S]*?<\/div>)<\/div>/g, (_, num, inner) => {
    const sid = `step-${slug(num)}`;
    track.push(sid);
    return `<div class="phone-step" id="${sid}"><span class="ps-num">${num}</span>${inner}${doneBtn(sid)}</div>`;
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
  return { html: out, toc, track };
}

function navHtml(current, stepsMap = {}) {
  return site.nav.map((g) => {
    const items = g.items.map((it) => {
      const href = it.page === 'index' ? 'index.html' : `${it.page}.html`;
      const cur = it.page === current ? ' aria-current="page"' : '';
      const n = (stepsMap[it.page] || []).length;
      return `      <li><a class="nav-link" href="${href}" data-page="${it.page}"${n ? ` data-total="${n}"` : ''}${cur}><span class="nav-dot" aria-hidden="true"></span>${esc(it.label)}</a></li>`;
    }).join('\n');
    return `    <div class="nav-group"><p class="nav-label">${esc(g.label)}</p><ul>\n${items}\n    </ul></div>`;
  }).join('\n');
}

function pageHeader(p, trackCount) {
  const { meta, name } = p;
  const part = esc(meta.part), steps = esc(meta.steps || '');
  const reviewed = meta.reviewed ? `<p class="reviewed"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>${esc(meta.reviewed)}</p>` : '';
  return `<header class="page-head">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Guide</a></li><li aria-current="page">${part}</li></ol></nav>
      <h1 class="page-title">${esc(meta.h1)}</h1>
      ${meta.lead ? `<p class="page-lead">${esc(meta.lead)}</p>` : ''}
      <p class="page-meta">${steps ? `<span class="meta-chip">${steps}</span>` : ''}${reviewed}<button class="btn btn-ghost btn-sm share-btn" type="button" data-share hidden><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-share"/></svg>Share</button></p>
      ${trackCount ? `<div class="page-progress" data-progress hidden><span class="pp-bar" aria-hidden="true"><span class="pp-fill"></span></span><span class="pp-text" role="status"></span></div>` : ''}
    </header>`;
}

function pager(name, titles) {
  const order = site.order, i = order.indexOf(name);
  const prev = order[i - 1], next = order[i + 1];
  const link = (n, dir) => {
    const href = n === 'index' ? 'index.html' : `${n}.html`;
    const label = dir === 'prev' ? 'Previous' : (n ? 'Next' : '');
    return `<a class="pager-link pager-${dir}" href="${href}"><span class="pager-dir">${label}</span><span class="pager-title">${esc(titles[n].pager)}</span></a>`;
  };
  if (name === 'glossary') {
    return `<nav class="pager" aria-label="Pages">${link(prev, 'prev')}<a class="pager-link pager-next" href="index.html"><span class="pager-dir">Back to</span><span class="pager-title">Guide overview</span></a></nav>`;
  }
  return `<nav class="pager" aria-label="Pages">${prev ? link(prev, 'prev') : '<span></span>'}${next ? link(next, 'next') : ''}</nav>`;
}

// ── Build ──
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

// CSS: concatenated in file-name order, comments removed
const cssDir = join(root, 'src/css');
const css = readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort()
  .map((f) => readFileSync(join(cssDir, f), 'utf8')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{2,}/g, '\n');
mkdirSync(join(dist, 'css'), { recursive: true });
writeFileSync(join(dist, 'css/style.css'), css);
mkdirSync(join(dist, 'js'), { recursive: true });
for (const f of readdirSync(join(root, 'src/js'))) cpSync(join(root, 'src/js', f), join(dist, 'js', f));

// The build id changes whenever ANY content changes, so visitors always get an "update available" prompt.
const hash = createHash('sha1').update(css).update(JSON.stringify(site));
for (const f of ['src/js/main.js', 'src/js/sw.template.js', 'src/partials/layout.html', 'src/partials/icons.svg']) hash.update(read(f));
for (const f of site.order) hash.update(read(`src/pages/${f}.html`));
const build = hash.digest('hex').slice(0, 8);
const layout = read('src/partials/layout.html');
const icons = read('src/partials/icons.svg');

const pages = site.order.map(parsePage);
const enhanced = Object.fromEntries(pages.map((p) => [p.name, enhance(p.body)]));
const stepsMap = Object.fromEntries(Object.entries(enhanced).filter(([, e]) => e.track.length).map(([n, e]) => [n, e.track]));

const titles = {};
for (const p of pages) {
  titles[p.name] = { pager: p.name === 'index' ? 'Guide overview' : (p.meta.nav || p.meta.title), full: p.meta.title };
  if (p.name !== 'index') titles[p.name].pager = (p.meta.part ? `${p.meta.part}: ` : '') + (p.meta.nav || p.meta.title);
}
// Reference pages keep their plain names in the pager
for (const n of ['troubleshoot', 'tips', 'glossary']) titles[n].pager = pages.find((p) => p.name === n).meta.nav;

// One renderer for every page type (guide pages, 404, offline)
function render(o) {
  const vars = {
    icons, main: o.main, nav: navHtml(o.navCurrent ?? '', stepsMap), jsonld: o.jsonld ?? '{}', robots: o.robots ?? '',
    bodyClass: o.bodyClass, ogType: o.ogType ?? 'website', page: o.page, title: esc(o.title), description: esc(o.description),
    canonical: o.canonical, ogImage: `${siteUrl}og-image.png`, themeLight: site.themeColor.light, themeDark: site.themeColor.dark,
    siteName: esc(site.name), twitter: site.twitter, version: site.version, updated: site.updated,
    publisher: esc(site.publisher), repo: site.repo, build,
  };
  // Single pass, so text inside page content can never be mistaken for a placeholder
  let out = layout.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  if (o.absolute) out = out.replace(/(href|src)="(?!https?:|#|\/|data:)([^"]+)"/g, (_, a, u) => `${a}="${basePath}${u}"`);
  return out;
}

const searchIndex = [];
const urls = [];
const sw = [];

for (const p of pages) {
  const isHome = p.meta.layout === 'home';
  const { html, toc, track } = enhanced[p.name];
  const fullTitle = isHome ? p.meta.title : `${p.meta.title} — ${site.name}`;
  const file = `${p.name}.html`;
  const canonical = isHome ? siteUrl : `${siteUrl}${file}`;
  const tocHtml = toc.length > 1 ? `<aside class="toc" aria-label="On this page"><p class="toc-label">On this page</p><ul>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.label)}</a></li>`).join('')}</ul></aside>` : '';
  const main = isHome
    ? `<div class="home">${html}</div>`
    : `<div class="doc">
    ${pageHeader(p, track.length)}
    <div class="doc-body">
      <article class="prose" aria-label="${esc(p.meta.h1)}">
${html}
      </article>
      ${tocHtml}
    </div>
    ${pager(p.name, titles)}
  </div>`;
  const ld = isHome
    ? { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: siteUrl, description: p.meta.description, inLanguage: 'en', publisher: { '@type': 'Organization', name: site.publisher } }
    : { '@context': 'https://schema.org', '@graph': [
        { '@type': 'TechArticle', headline: p.meta.h1, description: p.meta.description, url: canonical, inLanguage: 'en', image: `${siteUrl}og-image.png`,
          author: { '@type': 'Person', name: site.author }, publisher: { '@type': 'Organization', name: site.publisher }, isPartOf: { '@type': 'WebSite', name: site.name, url: siteUrl } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Guide', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: p.meta.part, item: canonical } ] } ] };
  writeFileSync(join(dist, file), render({
    main, navCurrent: p.name, jsonld: JSON.stringify(ld).replace(/</g, '\\u003c'), bodyClass: isHome ? 'is-home' : 'is-doc',
    ogType: isHome ? 'website' : 'article', page: p.name, title: fullTitle, description: p.meta.description, canonical,
  }));
  urls.push(canonical); sw.push(file);

  // Search index: page, then each anchored heading with the text that follows it
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

// 404 and offline pages use absolute paths, because they are served from any URL depth
const linkList = pages.map((p) => `<li><a href="${p.name}.html">${esc(p.meta.h1 || p.meta.title)}</a></li>`).join('');
writeFileSync(join(dist, '404.html'), render({
  absolute: true, page: 'notfound', bodyClass: 'is-doc is-404', robots: '<meta name="robots" content="noindex">',
  title: 'Page not found — ' + site.name, canonical: siteUrl,
  description: 'This page could not be found. Return to the AI Studio to Android deployment guide.',
  main: `<div class="doc not-found"><header class="page-head"><h1 class="page-title">That page isn't on this route</h1>
    <p class="page-lead">The link may be old, or the address may have a typo. Start from the overview, or search the guide.</p></header>
    <p class="actions"><a class="btn btn-primary" href="${basePath}">Go to the guide overview</a> <button class="btn btn-ghost" type="button" data-open-search>Search the guide</button></p></div>`,
}));
writeFileSync(join(dist, 'offline.html'), render({
  absolute: true, page: 'offline', bodyClass: 'is-doc is-404', robots: '<meta name="robots" content="noindex">',
  title: 'You are offline — ' + site.name, canonical: siteUrl,
  description: 'You are offline and this page has not been saved on this device yet.',
  main: `<div class="doc not-found"><header class="page-head"><h1 class="page-title">You're offline</h1>
    <p class="page-lead">This page isn't saved on your device yet, and there's no connection right now. Pages you have opened before, and the ones listed below, still work.</p></header>
    <ul class="offline-list">${linkList}</ul>
    <p class="actions"><button class="btn btn-primary" type="button" data-reload>Try again</button></p></div>`,
}));

writeFileSync(join(dist, 'search-index.json'), JSON.stringify(searchIndex));
// Which steps each page has: powers progress, "continue where you left off" and the route map
const stepsOut = { order: site.order.filter((n) => stepsMap[n]), pages: Object.fromEntries(Object.entries(stepsMap).map(([n, ids]) => [n, { title: titles[n].pager, ids }])) };
writeFileSync(join(dist, 'steps.json'), JSON.stringify(stepsOut));
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);

// Web app manifest (relative URLs keep it working on a custom domain)
const shot = (src, sizes, form, label) => ({ src, sizes, type: 'image/png', form_factor: form, label });
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
  id: basePath, name: site.name, short_name: site.shortName, description: 'Step-by-step guide to deploying Google AI Studio apps as installable Android PWAs.',
  lang: 'en', dir: 'ltr', start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: site.themeColor.light, theme_color: site.themeColor.light, categories: ['education', 'productivity'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ],
  shortcuts: [
    { name: 'Start: Account setup', short_name: 'Start', url: 'accounts.html', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    { name: 'Install on Android', short_name: 'Install', url: 'android.html', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    { name: 'Troubleshooting', short_name: 'Fix a problem', url: 'troubleshoot.html', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] }
  ],
  screenshots: [
    shot('screenshots/home-wide.png', '1280x820', 'wide', 'The guide home page with the route from AI Studio to Android'),
    shot('screenshots/steps-wide.png', '1280x820', 'wide', 'A guide page with numbered steps and copy buttons'),
    shot('screenshots/home-narrow.png', '780x1560', 'narrow', 'The guide home page on a phone')
  ]
}, null, 2));

// Service worker: precache the guide so it can be read offline
const core = ['./', 'offline.html', 'css/style.css?v=' + build, 'js/main.js?v=' + build, 'js/theme-init.js', 'manifest.webmanifest'];
const rest = [...sw, '404.html', 'search-index.json', 'steps.json', 'fonts/geist-latin-wght-normal.woff2', 'fonts/geist-mono-latin-wght-normal.woff2', 'icons/icon.svg'];
writeFileSync(join(dist, 'sw.js'), read('src/js/sw.template.js').replace('__BUILD__', build).replace('__CORE__', JSON.stringify(core)).replace('__ASSETS__', JSON.stringify(rest)));
rmSync(join(dist, 'js/sw.template.js'), { force: true });
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Built ${pages.length} pages + 404 + offline into dist/ (build ${build}) for ${siteUrl}`);
