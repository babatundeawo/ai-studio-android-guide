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
  const is404 = p === '404.html';
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
    if (is404 && target.startsWith('/')) target = target.replace(/^\/[^/]+\//, '');
    if (!target) target = p;
    if (target === '' || target === './') target = 'index.html';
    const file = resolve(dist, target);
    if (!existsSync(file) || (statSync(file).isDirectory() && !existsSync(join(file, 'index.html')))) { errors.push(`${p}: broken link "${u}"`); continue; }
    if (hash && target.endsWith('.html') && !idsByPage.get(target)?.has(decodeURIComponent(hash))) errors.push(`${p}: "${u}" points to a section that does not exist`);
  }
}
for (const f of ['sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js', 'search-index.json', 'og-image.png', 'favicon.ico']) if (!existsSync(join(dist, f))) errors.push(`missing ${f}`);

console.log(`Checked ${pages.length} pages.`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length) { console.log(`\n${errors.length} error(s). Fix the lines marked ERROR above.`); process.exit(1); }
console.log(warnings.length ? `\nPassed with ${warnings.length} warning(s).` : '\nAll checks passed.');
