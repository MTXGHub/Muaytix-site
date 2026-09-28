/* Assembles the paste-ready block for /rajadamnern-stadium-seating.
 *
 *   node gen.mjs && node build.mjs
 *
 * Writes to files, not to stdout.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const head = `<!--
  RAJADAMNERN STADIUM LEO SECTION SEATS
  Paste this whole thing into one HTML block (Tilda T123) on
  /rajadamnern-stadium-seating/leo-section, replacing the block that is there now.

  Meta title, meta description, Open Graph and the URL are NOT in here.
  Tilda owns those; they go in the page's own settings. The exact approved
  text is in TILDA-PAGE-SETTINGS.txt beside this file.

  All visible wording is generated from document-a.txt, the approved
  editorial source. It is not typed into this file and must not be edited
  here.

  The booking widget is mounted in the booking section with
  . It needs the MuayTix header block already pasted into
  Tilda Site Settings, More, HTML code for the HEAD. That is already live.
-->
<div class="mtx-leo" id="mtx-leo">
<style>
`;

const parts = [
  head,
  readFileSync('style.css', 'utf8'),
  '</style>\n\n',
  readFileSync('body.html', 'utf8'),
  readFileSync('tail.html', 'utf8'),
];

const source = parts.join('').replace('@@SCHEMA@@', readFileSync('schema.json', 'utf8').trim());
if (/@@[A-Z_]+@@/.test(source)) {
  console.error('A build token was left unfilled: ' + source.match(/@@[A-Z_]+@@/)[0]);
  process.exit(1);
}
writeFileSync('leo-source.html', source);

const live = source
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

writeFileSync('leo-live.txt', live);
writeFileSync('rajadamnern-stadium-leo-PASTE-INTO-TILDA.html', live);
console.log('source', (source.length / 1024).toFixed(1) + ' KB');
console.log('live  ', (live.length / 1024).toFixed(1) + ' KB  (written to 2 files)');
