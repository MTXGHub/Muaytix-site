/* Assembles the paste-ready homepage block.
 *
 *   node gen.mjs && node build.mjs
 *
 * There is no banned-word list in this build. An earlier version carried one,
 * and it would have refused to build Document A's own approved wording. A
 * check that overrules approved copy is not a safety net, it is the fault.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const head = `<!--
  MUAYTIX HOMEPAGE
  Paste this whole thing into one HTML block (Tilda T123) on /

  Meta title, meta description, Open Graph and canonical are NOT in here.
  Tilda owns those; they go in the page's own settings. The exact approved
  text is in TILDA-PAGE-SETTINGS.txt beside this file.

  All visible wording is generated from document-a.txt, the approved editorial
  source. It is not typed into this file and must not be edited here.

  The week list ships with the next 21 nights in the markup and five on screen.
  The script at the foot drops a night the moment its real booking cutoff
  passes and moves the next one up.
-->
<div class="mtx-hp">
<style>
`;

const tonight = readFileSync('tonight.txt', 'utf8').trim();

const parts = [
  head,
  readFileSync('style.css', 'utf8'),
  '</style>\n\n',
  readFileSync('body.html', 'utf8'),
  readFileSync('tail.html', 'utf8'),
];

const source = parts.join('')
  .replace('@@TONIGHT@@', tonight)
  .replace('@@SCHEMA@@', readFileSync('schema.json', 'utf8').trim());
if (/@@[A-Z_]+@@/.test(source)) {
  console.error('A build token was left unfilled: ' + source.match(/@@[A-Z_]+@@/)[0]);
  process.exit(1);
}
writeFileSync('homepage-source.html', source);

const live = source
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, js) =>
    attrs.includes('ld+json') ? m
      : '<script' + attrs + '>' + js.replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n</script>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

writeFileSync('homepage-live.txt', live);
writeFileSync('muaytix-homepage-PASTE-INTO-TILDA.html', live);
console.log('source', (source.length / 1024).toFixed(1) + ' KB');
console.log('live  ', (live.length / 1024).toFixed(1) + ' KB  (written to 2 files)');
