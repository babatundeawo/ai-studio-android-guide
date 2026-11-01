// Quality gate for the built site (dist/). Zero dependencies.
// Errors (broken links, missing files) fail the run. Warnings are reported but never fail it.
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
  const is404 = p === '404.html' || p === 'offline.html';
  const title = h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const desc = h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (!title) errors.push(`${p}: missing <title>`);
  if (!desc) errors.push(`${p}: missing meta description`);
  if (title.length > 70) warnings.push(`${p}: title is ${title.length} characters (aim for 60 or fewer)`);
  if (desc.length > 170) warnings.push(`${p}: description is ${desc.length} characters (aim for 160 or fewer)`);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${p}: expected exactly one <h1>`);
  if (/<img\b(?![^>]*\balt=)/.test(h)) errors.push(`${p}: image without alt text`);
  if (/\sstyle="/.test(h)) warnings.push(`${p}: inline style attribute (blocked by the Content Security Policy)`);
  if (/\sonclick=/.test(h)) warnings.push(`${p}: inline onclick (blocked by the Content Security Policy)`);
  const seen = new Set();
  for (const m of h.matchAll(/\sid="([^"]+)"/g)) { if (seen.has(m[1])) errors.push(`${p}: duplicate id "${m[1]}"`); seen.add(m[1]); }
  for (const m of h.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/noopener/.test(m[0])) errors.push(`${p}: external link without rel="noopener noreferrer"`);
  // Links and assets (code samples are text, not links)
  const live = h.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '');
  for (const m of live.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|data:|tel:)/.test(u)) continue;
    const [pathPart, hash] = u.split('#');
    let target = pathPart.split('?')[0];
    if (is404 && target.startsWith('/')) {
      const base = new URL(h.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? 'http://x/').pathname;
      target = target.startsWith(base) ? target.slice(base.length) : target.replace(/^\/+/, '');
    }
    if (!target) target = p;
    if (target === '' || target === './') target = 'index.html';
    const file = resolve(dist, target);
    if (!existsSync(file) || (statSync(file).isDirectory() && !existsSync(join(file, 'index.html')))) { errors.push(`${p}: broken link "${u}"`); continue; }
    if (hash && target.endsWith('.html') && !idsByPage.get(target)?.has(decodeURIComponent(hash))) errors.push(`${p}: "${u}" points to a section that does not exist`);
  }
}
for (const f of ['sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js', 'search-index.json', 'steps.json', 'offline.html', 'og-image.png', 'favicon.ico']) if (!existsSync(join(dist, f))) errors.push(`missing ${f}`);

// ── Installable app checks: manifest, icons, screenshots, service worker ──
const pngSize = (f) => { const b = readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : null; };
if (existsSync(join(dist, 'manifest.webmanifest'))) {
  const m = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['id', 'name', 'short_name', 'description', 'lang', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) if (!m[k]) errors.push(`manifest: missing "${k}"`);
  const need = (src, sizes, what) => {
    const f = join(dist, src.split('?')[0]);
    if (!existsSync(f)) return errors.push(`manifest: ${what} "${src}" does not exist`);
    const real = pngSize(f);
    if (sizes && real && real !== sizes) errors.push(`manifest: ${what} "${src}" is ${real}, manifest says ${sizes}`);
  };
  for (const i of m.icons || []) need(i.src, i.sizes, 'icon');
  const sizes = (m.icons || []).map((i) => i.sizes);
  if (!sizes.includes('192x192') || !sizes.includes('512x512')) errors.push('manifest: needs 192x192 and 512x512 icons');
  if (!(m.icons || []).some((i) => i.purpose === 'maskable')) errors.push('manifest: needs a maskable icon');
  for (const s of m.screenshots || []) need(s.src, s.sizes, 'screenshot');
  for (const sc of m.shortcuts || []) if (!existsSync(join(dist, sc.url.split('#')[0]))) errors.push(`manifest: shortcut "${sc.name}" points to missing "${sc.url}"`);
  if (!(m.screenshots || []).some((s) => s.form_factor === 'wide') || !(m.screenshots || []).some((s) => s.form_factor === 'narrow')) warnings.push('manifest: add one wide and one narrow screenshot for the richer install prompt');
}
if (existsSync(join(dist, 'sw.js'))) {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  for (const name of ['CORE', 'ASSETS']) {
    const arr = sw.match(new RegExp(`const ${name} = (\\[.*?\\]);`))?.[1];
    if (!arr) { errors.push(`sw.js: could not read ${name} list`); continue; }
    for (const a of JSON.parse(arr)) { const f = a === './' ? 'index.html' : a.split('?')[0]; if (!existsSync(join(dist, f))) errors.push(`sw.js: cannot precache "${a}" (file missing)`); }
  }
}
if (existsSync(join(dist, 'steps.json'))) {
  const st = JSON.parse(readFileSync(join(dist, 'steps.json'), 'utf8'));
  for (const [name, meta] of Object.entries(st.pages)) for (const id of meta.ids) if (!idsByPage.get(`${name}.html`)?.has(id)) errors.push(`steps.json: ${name}.html has no element with id "${id}"`);
}

console.log(`Checked ${pages.length} pages.`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length) { console.log(`\n${errors.length} error(s). Fix the lines marked ERROR above.`); process.exit(1); }
console.log(warnings.length ? `\nPassed with ${warnings.length} warning(s).` : '\nAll checks passed.');
