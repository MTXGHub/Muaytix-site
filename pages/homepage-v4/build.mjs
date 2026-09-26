/* Assembles the homepage and writes the paste-ready copy.
 *
 *   node build.mjs
 *
 * The parts exist so one block can be edited on its own. The file Jason pastes
 * is generated, never hand-edited, so the two cannot drift apart.
 *
 * The build refuses to write if banned copy appears in the output. A warning
 * gets ignored at 3am; a failure does not.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const head = `<!--
  MUAYTIX HOMEPAGE
  Paste this whole thing into one HTML block (Tilda T123) on /

  The meta title, meta description, Open Graph tags and canonical are NOT in
  here. Tilda owns those; they go in the page's own settings. The exact text
  to paste is in the report that came with this file.

  The week list ships with the next 21 nights in the markup and five on screen.
  The script at the foot drops a night the moment its booking closes and moves
  the next one up, so the block is right as pasted, right to a crawler, and
  right for three weeks without being touched.
-->
<div class="mtx-hp">
<style>
`;

const parts = [
  head,
  readFileSync('style.css', 'utf8'),
  '</style>\n\n',
  readFileSync('body-1-hero.html', 'utf8'),
  readFileSync('body-2-events.html', 'utf8'),
  readFileSync('body-3-seats.html', 'utf8'),
  readFileSync('body-4-buy.html', 'utf8'),
  readFileSync('body-5-venue.html', 'utf8'),
  readFileSync('tail.html', 'utf8'),
];

const heroTonight = readFileSync('hero-tonight.txt', 'utf8').trim();
const seatCards = readFileSync('seat-cards.html', 'utf8').trimEnd();
const source = parts.join('')
  .replace('@@HERO_TONIGHT@@', heroTonight)
  .replace('@@SEAT_CARDS@@', seatCards);
if (source.includes('@@')) { console.error('A build token was left unfilled.'); process.exit(1); }
writeFileSync('homepage-source.html', source);

/* Comments are for us, not for the page. */
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

/* The banned list from CLAUDE.md section 2, plus the two the audit rules out.
   Checked against the generated file, which is the thing that goes live. */
const banned = [
  [/\bofficial/i,                     '"official" is banned everywhere: copy, alt text, file names, schema'],
  [/\bLimited\b/,                     '"Limited" is not a guest-facing status; use Available'],
  [/—/,                          'em dash; use a comma, a full stop or a colon'],
  [/book your seat/i,                 'use "Book Tickets"'],
  [/\b(un)?assigned seat(ing|s)?\b/i, 'trade words, not guest words; say what actually happens'],
  [/selling fast|% booked|hurry|don't miss out|only \d+ left/i, 'scarcity copy'],
  [/\bmiddleman\b/i,                  'the audit rules this claim out'],
  [/on standby at every event/i,      'the audit rules this claim out until verified'],
  [/every bout has a clear winner/i,  'the audit rules this out: not safely universal'],
  [/no dress code/i,                  'unverified; the audit holds it back'],
  [/wa\.me|whatsapp/i,                'WhatsApp is off the homepage'],
];
const hits = banned.filter(([re]) => re.test(live))
                   .map(([re, why]) => `  "${live.match(re)[0]}" : ${why}`);
if (hits.length) {
  console.error('REFUSING TO BUILD. Banned copy in the output:\n' + hits.join('\n'));
  process.exit(1);
}

writeFileSync('homepage-live.txt', live);
writeFileSync('muaytix-homepage-PASTE-INTO-TILDA.html', live);
console.log('source', (source.length / 1024).toFixed(1) + ' KB');
console.log('live  ', (live.length / 1024).toFixed(1) + ' KB  (written to 2 files)');
