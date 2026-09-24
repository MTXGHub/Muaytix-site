/* Assembles the seating page from its parts and writes the paste-ready copy.
   The parts exist so a section can be edited on its own; the file Jason pastes
   is generated, never hand-edited, so the two cannot drift apart. */
import fs from 'fs';

const head = `<!--
  RAJADAMNERN STADIUM SEATING - the hub page
  Paste this whole thing into one HTML block (Tilda T123).
  Page address: /rajadamnern-stadium-seats

  The meta title, meta description, Open Graph tags and canonical are NOT in
  here. Tilda owns those; they go in the page's own settings. The exact text
  to paste is in the report that came with this file.

  The booking widget is the site-wide one, started on seat class rather than
  on date (data-start="seats"), which is the order this page asks the guest
  to decide in.
-->
<div class="mtx-ss">
<style>
`;

const source = [
  head,
  fs.readFileSync('style.css', 'utf8'),
  '</style>\n\n',
  fs.readFileSync('body-a.html', 'utf8'),
  fs.readFileSync('body-b.html', 'utf8'),
  fs.readFileSync('body-c.html', 'utf8'),
  fs.readFileSync('tail.html', 'utf8'),
].join('');
fs.writeFileSync('seats-source.html', source);

const live = source
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<script>([\s\S]*?)<\/script>/g, (_, js) =>
    '<script>' + js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n</script>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';
fs.writeFileSync('seats-live.txt', live);
console.log('source', (source.length/1024).toFixed(1) + ' KB   live', (live.length/1024).toFixed(1) + ' KB');
