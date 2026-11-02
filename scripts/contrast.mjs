// Checks text and background colour pairs from src/css/00-tokens.css against WCAG 2.2 AA.
// Prints a table and exits with an error if any pair is too low. Zero dependencies.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/css/00-tokens.css'), 'utf8');
const block = (re) => { const m = css.match(re); if (!m) throw new Error('Token block not found: ' + re); return m[1]; };
const parse = (txt) => Object.fromEntries([...txt.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8})\b/gi)].map((m) => [m[1], m[2]]));
const light = parse(block(/:root\s*\{([\s\S]*?)\n\}/));
const dark = { ...light, ...parse(block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)) };

const lum = (hex) => {
  let h = hex.slice(1); if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground token, background token, minimum ratio, what it is]
const pairs = [
  ['ink', 'bg', 4.5, 'Body text'], ['ink', 'bg-elev', 4.5, 'Text on cards'], ['ink', 'bg-sunk', 4.5, 'Text on sunk areas'],
  ['ink-2', 'bg', 4.5, 'Secondary text'], ['ink-2', 'bg-elev', 4.5, 'Secondary on cards'], ['ink-2', 'bg-sunk', 4.5, 'Secondary on sunk'],
  ['ink-3', 'bg', 4.5, 'Tertiary text'], ['ink-3', 'bg-elev', 4.5, 'Tertiary on cards'], ['ink-3', 'bg-sunk', 4.5, 'Tertiary on sunk'],
  ['brand', 'bg', 4.5, 'Links'], ['brand', 'bg-elev', 4.5, 'Links on cards'], ['brand', 'brand-tint', 4.5, 'Active nav item'],
  ['on-brand', 'brand-fill', 4.5, 'Primary button text'],
  ['signal', 'bg', 4.5, 'Signal text'], ['signal', 'signal-tint', 4.5, 'Signal on tint'],
  ['ok', 'ok-bg', 4.5, 'Success alert'], ['warn', 'warn-bg', 4.5, 'Warning alert'], ['crit', 'crit-bg', 4.5, 'Critical alert'], ['info', 'info-bg', 4.5, 'Info alert'],
  ['ok', 'bg', 4.5, 'Success text'], ['accent', 'bg', 4.5, 'Accent text'],
  ['brand-fill', 'bg', 3, 'Focus ring and node borders (non-text)'], ['line-strong', 'bg', 1.4, 'Divider (decorative)'],
];
let bad = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
  console.log(`\n${name} theme`);
  for (const [fg, bg, min, label] of pairs) {
    if (!t[fg] || !t[bg]) { console.log(`  skip ${fg} on ${bg}`); continue; }
    const r = ratio(t[fg], t[bg]); const ok = r >= min; if (!ok) bad++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (needs ${min})  ${label}  [${fg} ${t[fg]} on ${bg} ${t[bg]}]`);
  }
}
const codePairs = [['code-ink', 'code-bg'], ['code-muted', 'code-bar'], ['night-ink', 'night'], ['night-ink-2', 'night']];
console.log('\ncode and night surfaces (same in both themes)');
for (const [fg, bg] of codePairs) {
  const r = ratio(light[fg], light[bg]); const ok = r >= 4.5; if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}`);
}
if (bad) { console.log(`\nERROR: ${bad} colour pair(s) are below the contrast minimum. Adjust src/css/00-tokens.css.`); process.exit(1); }
console.log('\nAll colour pairs pass.');
