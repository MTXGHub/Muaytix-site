/* Builds ONE paste block for the whole homepage out of the two sources.

   The two blocks existed because a Tilda element was meant to sit between
   them, at "On this week". Each block therefore carried its own copy of the
   base CSS so it could stand alone. Merged into one block that duplication
   is dead weight, so the stylesheets are combined and any rule that appears
   in both is kept once.

   Rules are matched whole, never line by line, so a rule that only LOOKS
   like another one is never silently dropped. */
import fs from 'fs';

const read = (f) => fs.readFileSync(f, 'utf8');
const styleOf = (h) => h.match(/<style>([\s\S]*?)<\/style>/)[1];
const bodyOf  = (h) => h
  .replace(/^<div class="mtx-hp">/, '')
  .replace(/<style>[\s\S]*?<\/style>/, '')
  .replace(/<\/div>\s*$/, '')
  .trim();

/* Split a stylesheet into top-level chunks: one comment, rule or @media each.
   Brace depth does the work, so a nested @media block stays in one piece. */
function chunks(css) {
  const out = [];
  let buf = '', depth = 0;
  for (const ch of css) {
    buf += ch;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { out.push(buf.trim()); buf = ''; }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

const A = read('homepage-a.html');
const B = read('homepage-b.html');

const aChunks = chunks(styleOf(A));
const seen = new Set(aChunks);
const bOnly = chunks(styleOf(B)).filter((c) => !seen.has(c));

const css = aChunks.join('\n') + '\n\n' + bOnly.join('\n');

/* "On this week" was the heading that introduced the Tilda element in the
   gap between the blocks. The five event cards do that job now, so the
   heading and its line would read as the same promise made twice. */
const aBody = bodyOf(A).replace(
  /\s*<section class="mtx-hp__band" id="on-this-week">[\s\S]*?<\/section>\n/,
  '\n'
);

const one = '<div class="mtx-hp">\n<style>' + css + '</style>\n\n'
  + aBody.replace(/(<script type="application\/ld\+json">)/, '@@JSONLD@@$1')
  + '\n</div>\n';

/* The JSON-LD belongs at the end of the page, after the content it describes. */
const [beforeLd, ld] = one.split('@@JSONLD@@');
const merged = beforeLd.replace(/\n<\/div>\n$/, '')
  + '\n' + bodyOf(B) + '\n\n'
  + ld.replace(/\n<\/div>\n$/, '').trim()
  + '\n</div>\n';

const strip = (html) => html
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, c) =>
    '<style>' + c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim() + '</style>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

fs.writeFileSync('homepage-FULL-source.html', merged);
fs.writeFileSync('homepage-FULL-live.txt', strip(merged));
console.log('rules kept from A:', aChunks.length, '| added from B:', bOnly.length);
console.log('homepage-FULL-live.txt', (strip(merged).length / 1024).toFixed(1) + ' KB');
