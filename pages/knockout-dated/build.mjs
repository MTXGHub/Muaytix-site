/* Assembles the two paste-ready blocks.
 *
 *   node gen.mjs && node build.mjs
 *
 * No banned-word list: a check that overrules approved copy is not a safety
 * net, it is the fault.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PAGES = [
  { key: 'sep29', url: '/rajadamnern-knockout/2026-09-29', out: 'knockout-29-SEP-PASTE-INTO-TILDA.html' },
  { key: 'oct02', url: '/rajadamnern-knockout/2026-10-02', out: 'knockout-02-OCT-PASTE-INTO-TILDA.html' },
];

const css = readFileSync('style.css', 'utf8');

for (const p of PAGES) {
  const head = `<!--
  RAJADAMNERN KNOCKOUT
  Paste this whole thing into one HTML block (Tilda T123) on ${p.url}

  Meta title, meta description, Open Graph and canonical are NOT in here.
  Tilda owns those; they go in the page's own settings. The approved text is
  in TILDA-PAGE-SETTINGS-${p.key}.txt beside this file.

  All visible wording is generated from document-a.txt, the approved editorial
  source. It is not typed into this file and must not be edited here.
-->
<div class="mtx-kd">
<style>
`;
  const source = head + css + '</style>\n\n'
    + readFileSync(`${p.key}-body.html`, 'utf8')
    + `\n<script type="application/ld+json">\n${readFileSync(`${p.key}-schema.json`, 'utf8').trim()}\n</script>\n</div>\n`;

  if (/@@[A-Z_]+@@/.test(source)) {
    console.error(`${p.key}: a build token was left unfilled`); process.exit(1);
  }
  writeFileSync(`${p.key}-source.html`, source);

  const live = source
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, c) =>
      '<style>' + c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';

  writeFileSync(`${p.key}-live.txt`, live);
  writeFileSync(p.out, live);
  console.log(`${p.key.padEnd(6)} ${(live.length / 1024).toFixed(1)} KB -> ${p.out}`);
}
