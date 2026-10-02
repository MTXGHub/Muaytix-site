/* Assembles the paste-ready block for /rajadamnern-stadium-seating/leo-section.
 *
 *   node extract-copy.mjs && node gen.mjs && node build.mjs
 *
 * Writes to files, not to stdout.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const head = `<!--
  LEO SECTION AT RAJADAMNERN STADIUM
  Paste this whole thing into one HTML block (Tilda T123) on
  /rajadamnern-stadium-seating/leo-section, replacing the block that is there now.

  Meta title, meta description, Open Graph and canonical are NOT in here.
  Tilda owns those; the exact text is in TILDA-PAGE-SETTINGS.txt.

  The copy is the brief's Part E, read out of brief.txt by extract-copy.mjs.
  It is not typed into any file and must not be edited here.

  The booking widget mounts into the element marked data-mtx-slot. It needs
  the MuayTix header block already pasted into Tilda Site Settings, More,
  HTML code for the HEAD. That is already live.
-->
<div class="mtx-leo-page" id="mtx-leo">
<style>
`;

const parts = [head, readFileSync('style.css', 'utf8'), '</style>\n\n', readFileSync('body.html', 'utf8'), readFileSync('tail.html', 'utf8')];
const CTA = JSON.parse(readFileSync('copy.json', 'utf8')).sections['1']['Primary CTA'][0][0];
const source = parts.join('').replace('@@SCHEMA@@', readFileSync('schema.json', 'utf8').trim()).replace('@@CTA_LABEL@@', CTA);
if (/@@[A-Z_]+@@/.test(source)) { console.error('A build token was left unfilled'); process.exit(1); }
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
