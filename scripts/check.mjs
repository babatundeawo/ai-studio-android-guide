// Quality gate for the built site (dist/). Zero dependencies.
// Errors (broken links, missing files, invalid manifest) fail the run. Warnings are reported but never fail it.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const errors = [], warnings = [];
const pages = readdirSync(dist).filter((f) => f.endsWith('.html'));
const idsByPage = new Map();
const html = new Map(pages.map((p) => [p, readFileSync(join(dist, p), 'utf8')]));
for (const [p, h] of html) idsByPage.set(p, new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

for (const [p, h] of html) {
  const noindex = p === '404.html' || p === 'offline.html';
  const title = h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const desc = h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!title) errors.push(`${p}: missing <title>`);
  if (!desc) errors.push(`${p}: missing meta description`);
  if (title.length > 70) warnings.push(`${p}: title is ${title.length} characters (aim for 60 or fewer)`);
  if (desc.length > 170) warnings.push(`${p}: description is ${desc.length} characters (aim for 160 or fewer)`);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${p}: expected exactly one <h1>`);
  if (/<img\b(?![^>]*\balt=)/.test(h)) errors.push(`${p}: image without alt text`);
  if (/\sstyle="/.test(h)) errors.push(`${p}: inline style attribute (blocked by the Content Security Policy)`);
  if (/\son[a-z]+="/.test(h)) errors.push(`${p}: inline event handler (blocked by the Content Security Policy)`);
  if (/\{\{\w+\}\}/.test(h)) errors.push(`${p}: an unfilled {{placeholder}} is left in the page`);
  if (!noindex && !/<link rel="canonical"/.test(h)) errors.push(`${p}: missing canonical link`);
  if (/[\u2013\u2014]/.test(h.replace(/<script[\s\S]*?<\/script>/g, ''))) warnings.push(`${p}: contains an en dash or em dash`);
  const seen = new Set();
  for (const m of h.matchAll(/\sid="([^"]+)"/g)) { if (seen.has(m[1])) errors.push(`${p}: duplicate id "${m[1]}"`); seen.add(m[1]); }
  for (const m of h.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/noopener/.test(m[0])) errors.push(`${p}: external link without rel="noopener noreferrer"`);
  for (const m of h.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/g)) warnings.push(`${p}: button without a type attribute: ${m[0].slice(0, 60)}`);
  // Links and assets (code samples are text, not links)
  const live = h.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '');
  for (const m of live.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|data:|tel:)/.test(u)) continue;
    const [pathPart, hash] = u.split('#');
    let target = pathPart.split('?')[0];
    if (noindex && target.startsWith('/')) target = target.replace(/^\/[^/]+\//, '');
    if (!target) target = p;
    if (target === '' || target === './') target = 'index.html';
    const file = resolve(dist, target);
    if (!existsSync(file) || (statSync(file).isDirectory() && !existsSync(join(file, 'index.html')))) { errors.push(`${p}: broken link "${u}"`); continue; }
    if (hash && target.endsWith('.html') && !idsByPage.get(target)?.has(decodeURIComponent(hash))) errors.push(`${p}: "${u}" points to a section that does not exist`);
  }
}
for (const f of ['sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js', 'search-index.json', 'steps.json', 'og-image.png', 'favicon.ico', 'offline.html', '404.html', 'css/style.css', 'js/main.js', 'js/app.js', 'js/theme-init.js']) if (!existsSync(join(dist, f))) errors.push(`missing ${f}`);

// Web app manifest: required fields, and every icon and screenshot must exist
try {
  const m = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'id']) if (!m[k]) errors.push(`manifest: missing "${k}"`);
  if ((m.short_name || '').length > 12) warnings.push(`manifest: short_name is ${m.short_name.length} characters (12 or fewer is safest)`);
  const need = [[192, false], [512, false], [512, true]];
  for (const [size, mask] of need) if (!m.icons.some((i) => i.sizes === `${size}x${size}` && (mask ? i.purpose === 'maskable' : (i.purpose || 'any').includes('any')))) errors.push(`manifest: missing ${size}px ${mask ? 'maskable ' : ''}icon`);
  for (const i of [...(m.icons || []), ...(m.screenshots || []), ...(m.shortcuts || []).flatMap((s) => s.icons || [])]) if (!existsSync(join(dist, i.src))) errors.push(`manifest: file not found "${i.src}"`);
  for (const s of m.shortcuts || []) if (!existsSync(join(dist, s.url.split('?')[0]))) errors.push(`manifest: shortcut page not found "${s.url}"`);
} catch (e) { errors.push(`manifest: not valid JSON (${e.message})`); }

// Service worker: every precached file must exist, or installation fails for everyone
try {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  for (const a of list) { const f = a === './' ? 'index.html' : a.split('?')[0]; if (!existsSync(join(dist, f))) errors.push(`sw.js: precached file not found "${a}"`); }
  if (/__(BUILD|ASSETS)__/.test(sw)) errors.push('sw.js: an unfilled placeholder is left in the file');
  const css = readFileSync(join(dist, 'css/style.css'), 'utf8');
  if (!list.some((a) => a.startsWith('css/style.css?v='))) errors.push('sw.js: the stylesheet is not precached');
  if (!/prefers-color-scheme: dark/.test(css) && !/data-theme/.test(css)) errors.push('css: no dark theme found');
} catch (e) { errors.push(`sw.js: could not be checked (${e.message})`); }

console.log(`Checked ${pages.length} pages.`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length) { console.log(`\n${errors.length} error(s). Fix the lines marked ERROR above.`); process.exit(1); }
console.log(warnings.length ? `\nPassed with ${warnings.length} warning(s).` : '\nAll checks passed.');
