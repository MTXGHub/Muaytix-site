/* Assembles the homepage from its parts, then writes the paste-ready copy.
   The parts exist so a block can be edited on its own; the file Jason pastes
   is generated, never hand-edited, so the two cannot drift apart. */
import fs from 'fs';

const head = `<!--
  MUAYTIX HOMEPAGE
  Paste this whole thing into one HTML block (Tilda T123) on /

  The meta title, meta description, Open Graph tags and canonical are NOT in
  here. Tilda owns those; they go in the page's own settings. The exact text
  to paste is in the report that came with this file.

  The week list ships with tonight first and already marked, so the page is
  right as pasted and right to a crawler. The script at the foot only keeps it
  right tomorrow. It never decides whether tickets are on sale: the ticket
  selector on the event pages reads the real cutoff and is the only thing
  allowed to answer that.
-->
<div class="mtx-hp">
<style>
`;

const parts = [
  head,
  fs.readFileSync('style.css', 'utf8'),
  '</style>\n\n',
  fs.readFileSync('body-1-4.html', 'utf8'),
  fs.readFileSync('body-5-8.html', 'utf8'),
  fs.readFileSync('tail.html', 'utf8'),
];

const source = parts.join('');
fs.writeFileSync('homepage-source.html', source);

/* The comments are for us, not for the page. */
const live = source
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<script>([\s\S]*?)<\/script>/g, (_, js) =>
    '<script>' + js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n</script>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

fs.writeFileSync('homepage-live.txt', live);
console.log('source', (source.length / 1024).toFixed(1) + ' KB');
console.log('live  ', (live.length / 1024).toFixed(1) + ' KB');
