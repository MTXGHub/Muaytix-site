/* Assembles the paste-ready block for the Rajadamnern Stadium Seats trial.
 *
 *   node gen.mjs && node build.mjs
 *
 * TRIAL. Not the live page. Do not paste this over pages/seating-v2.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const head = `<!--
  RAJADAMNERN STADIUM SEATS -- TRIAL BUILD
  This is a trial, built from a self-contained page spec supplied 29
  September 2026, for Jason to look at before anything is decided. It is
  NOT the live page at /rajadamnern-stadium-seating (pages/seating-v2),
  which this build does not touch.

  Meta title, meta description, Open Graph and canonical are Tilda page
  settings and are NOT in this file. The exact approved text, if this is
  ever approved, is in TILDA-PAGE-SETTINGS.txt beside this file.

  All visible wording is generated from document-a.txt, transcribed
  verbatim from the spec. It is not typed into this file and must not be
  edited here.

  The booking widget is mounted in Tile 8 as the full date-first calendar.
  It needs the MuayTix header block already pasted into Tilda Site
  Settings, More, HTML code for the HEAD.
-->
<div class="mtx-rss" id="mtx-rss">
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
writeFileSync('seating-trial-source.html', source);

const live = source
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

writeFileSync('seating-trial-live.txt', live);
writeFileSync('rajadamnern-stadium-seats-TRIAL-PASTE-INTO-TILDA.html', live);
console.log('source', (source.length / 1024).toFixed(1) + ' KB');
console.log('live  ', (live.length / 1024).toFixed(1) + ' KB  (written to 2 files)');
