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
function enhance(body, ctx) {
  const toc = [];
  let out = body;
  // Give every step a stable, shareable id and collect it for "On this page"
  out = out.replace(/<li class="step([^"]*)"( id="([^"]+)")?><span class="step-num">([^<]+)<\/span>([\s\S]*?<h2 class="step-title">)([^<]+)(<\/h2>)/g,
    (_, cls, _i, id, num, mid, title, end) => {
      const sid = id || `step-${slug(num)}`;
      toc.push({ id: sid, label: `${num}. ${stripTags(title)}`, kind: 'step' });
      return `<li class="step${cls}" id="${sid}"><span class="step-num">${num}</span>${mid}${title}${end}`;
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
      const href = it.page === 'index' ? 'index.html' : `${it.page}.html`;
      const cur = it.page === current ? ' aria-current="page"' : '';
      return `      <li><a class="nav-link" href="${href}"${cur}><span class="nav-dot" aria-hidden="true"></span>${esc(it.label)}</a></li>`;
    }).join('\n');
    return `    <div class="nav-group"><p class="nav-label">${esc(g.label)}</p><ul>\n${items}\n    </ul></div>`;
  }).join('\n');
}

function pageHeader(p, titleMap) {
  const { meta, name } = p;
  const part = esc(meta.part), steps = esc(meta.steps || '');
  const reviewed = meta.reviewed ? `<p class="reviewed"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>${esc(meta.reviewed)}</p>` : '';
  return `<header class="page-head">
      <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Guide</a></li><li aria-current="page">${part}</li></ol></nav>
      <h1 class="page-title">${esc(meta.h1)}</h1>
      ${meta.lead ? `<p class="page-lead">${esc(meta.lead)}</p>` : ''}
      <p class="page-meta">${steps ? `<span class="meta-chip">${steps}</span>` : ''}${reviewed}</p>
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

const build = createHash('sha1').update(css).update(readFileSync(join(root, 'src/js/main.js'))).update(JSON.stringify(site)).digest('hex').slice(0, 8);
const layout = read('src/partials/layout.html');
const icons = read('src/partials/icons.svg');

const pages = site.order.map(parsePage);
const titles = {};
for (const p of pages) {
  const navItem = site.nav.flatMap((g) => g.items).find((i) => i.page === p.name);
  titles[p.name] = { pager: p.name === 'index' ? 'Guide overview' : (p.meta.nav || p.meta.title), full: p.meta.title };
  if (p.name !== 'index') titles[p.name].pager = (p.meta.part ? `${p.meta.part}: ` : '') + (p.meta.nav || p.meta.title);
  if (navItem && p.name === 'index') titles[p.name].pager = 'Guide overview';
}
// Reference pages keep their plain names in the pager
for (const n of ['troubleshoot', 'tips', 'glossary']) titles[n].pager = pages.find((p) => p.name === n).meta.nav;

const searchIndex = [];
const urls = [];
const sw = [];

for (const p of pages) {
  const isHome = p.meta.layout === 'home';
  const { html, toc } = enhance(p.body, { name: p.name });
  const fullTitle = isHome ? p.meta.title : `${p.meta.title} — ${site.name}`;
  const file = `${p.name}.html`;
  const canonical = isHome ? siteUrl : `${siteUrl}${file}`;
  const tocHtml = toc.length > 1 ? `<aside class="toc" aria-label="On this page"><p class="toc-label">On this page</p><ul>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.label)}</a></li>`).join('')}</ul></aside>` : '';
  const main = isHome
    ? `<div class="home">${html}</div>`
    : `<div class="doc">
    ${pageHeader(p, titles)}
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
  const page = layout
    .replace('{{icons}}', icons)
    .replace('{{nav}}', navHtml(p.name))
    .replace('{{main}}', main)
    .replace('{{jsonld}}', JSON.stringify(ld).replace(/</g, '\\u003c'))
    .replace('{{robots}}', '')
    .replace('{{bodyClass}}', isHome ? 'is-home' : 'is-doc')
    .replace('{{ogType}}', isHome ? 'website' : 'article')
    .replace(/\{\{title\}\}/g, esc(fullTitle))
    .replace(/\{\{description\}\}/g, esc(p.meta.description))
    .replace(/\{\{canonical\}\}/g, canonical)
    .replace(/\{\{ogImage\}\}/g, `${siteUrl}og-image.png`)
    .replace('{{themeLight}}', site.themeColor.light).replace('{{themeDark}}', site.themeColor.dark)
    .replace(/\{\{siteName\}\}/g, esc(site.name)).replace('{{twitter}}', site.twitter)
    .replace(/\{\{version\}\}/g, site.version).replace(/\{\{updated\}\}/g, site.updated)
    .replace('{{publisher}}', esc(site.publisher)).replace('{{repo}}', site.repo)
    .replace(/\{\{build\}\}/g, build);
  writeFileSync(join(dist, file), page);
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

// 404 page (absolute paths, because it is served from any URL depth)
{
  const body = `<div class="doc not-found"><header class="page-head"><h1 class="page-title">That page isn't on this route</h1>
    <p class="page-lead">The link may be old, or the address may have a typo. Start from the overview, or search the guide.</p></header>
    <p class="actions"><a class="btn btn-primary" href="${basePath}">Go to the guide overview</a> <button class="btn btn-ghost" type="button" data-open-search>Search the guide</button></p></div>`;
  let page = layout.replace('{{icons}}', icons).replace('{{nav}}', navHtml('')).replace('{{main}}', body)
    .replace('{{jsonld}}', '{}').replace('{{robots}}', '<meta name="robots" content="noindex">').replace('{{bodyClass}}', 'is-doc is-404').replace('{{ogType}}', 'website')
    .replace(/\{\{title\}\}/g, 'Page not found — ' + esc(site.name))
    .replace(/\{\{description\}\}/g, 'This page could not be found. Return to the AI Studio to Android deployment guide.')
    .replace(/\{\{canonical\}\}/g, siteUrl).replace(/\{\{ogImage\}\}/g, `${siteUrl}og-image.png`)
    .replace('{{themeLight}}', site.themeColor.light).replace('{{themeDark}}', site.themeColor.dark)
    .replace(/\{\{siteName\}\}/g, esc(site.name)).replace('{{twitter}}', site.twitter)
    .replace(/\{\{version\}\}/g, site.version).replace(/\{\{updated\}\}/g, site.updated)
    .replace('{{publisher}}', esc(site.publisher)).replace('{{repo}}', site.repo).replace(/\{\{build\}\}/g, build);
  // Make every relative URL absolute so the page works at any depth
  page = page.replace(/(href|src)="(?!https?:|#|\/|data:)([^"]+)"/g, (_, a, u) => `${a}="${basePath}${u}"`)
;
  writeFileSync(join(dist, '404.html'), page);
}

writeFileSync(join(dist, 'search-index.json'), JSON.stringify(searchIndex));
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);

// Web app manifest (relative URLs keep it working on a custom domain)
writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
  name: site.name, short_name: site.shortName, description: 'Step-by-step guide to deploying Google AI Studio apps as installable Android PWAs.',
  start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: site.themeColor.light, theme_color: site.themeColor.light,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));

// Service worker: precache the guide so it can be read offline
const assets = ['./', ...sw, '404.html', 'css/style.css?v=' + build, 'js/main.js?v=' + build, 'js/theme-init.js', 'search-index.json', 'fonts/geist-latin-wght-normal.woff2', 'fonts/geist-mono-latin-wght-normal.woff2', 'icons/icon.svg', 'manifest.webmanifest'];
writeFileSync(join(dist, 'sw.js'), read('src/js/sw.template.js').replace('__BUILD__', build).replace('__ASSETS__', JSON.stringify(assets)));
rmSync(join(dist, 'js/sw.template.js'), { force: true });
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Built ${pages.length} pages + 404 into dist/ (build ${build}) for ${siteUrl}`);
