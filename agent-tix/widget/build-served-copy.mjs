// Produces the copy of the widget that is actually served to guests: the same
// code with the comments taken out. The commented widget.js stays the source
// of truth; this only shrinks what goes down the wire.
//
//   node agent-tix/widget/build-served-copy.mjs > served.js
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const src = fs.readFileSync(new URL('./widget.js', import.meta.url), 'utf8');
const kept = src.split('\n').filter(l => {
  const t = l.trim();
  return !(t.startsWith('//') || (t.startsWith('/*') && t.endsWith('*/')));
});
// Then every space that is not needed. The header block carries the whole widget
// inside the site's head, and Tilda is not known to take a block of any size, so
// it is kept as small as it can be without changing a single token or moving a
// line break (so nothing that relies on one can change meaning).
// header-block.test.mjs proves the tokens are identical to widget.js. A parser
// is needed to do this safely; eslint ships one. Without it the copy is still
// correct, only larger, and that same test will say so.
function loadEspree() {
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(path.join(root, 'eslint', 'index.js'))('espree');
  } catch { return null; }
}
const WORDY = new Set(['Identifier', 'Keyword', 'Numeric', 'Boolean', 'Null', 'PrivateIdentifier']);
function needSpace(p, pt, n, nt) {
  if (WORDY.has(p.type) && WORDY.has(n.type)) return true;
  const last = pt.slice(-1), first = nt[0];
  if ((last === '+' && first === '+') || (last === '-' && first === '-')) return true;
  if (last === '/' && first === '/') return true;            // would start a comment
  if (last === '<' && first === '!') return true;            // would start an HTML comment
  if (pt === '?' && first === '.') return true;              // would read as optional chaining
  if (p.type === 'Numeric' && first === '.') return true;
  return false;
}
// The stylesheet is 25 KB, most of it the same few phrases over and over: every
// rule starts with "#mtx-booking .mtx-" (222 times), and "var(--", "background:",
// "font-weight:" and the like each turn up dozens of times. The header is not
// allowed to grow, so the served copy writes each phrase once and a stand-in
// character for the rest, and a short loop puts them back before the stylesheet
// is used. What reaches the browser is the very same stylesheet, character for
// character; header-block.test.mjs unpacks the string and proves it, then checks
// the result against widget.js. widget.js is untouched and stays readable, which
// is why this is done here and not there.
//
// Stand-ins are ASCII characters that appear nowhere in the stylesheet (checked
// below, and the build stops if one ever does). Never one that is special in
// HTML, and the replacing is split and join, not a pattern, so there is nothing
// in it for a tool that tidies scripts to misread. Longest phrase first, so a
// short phrase never splits a long one.
const PACKED = [
  ['~', '#mtx-booking .mtx-'], ['^', 'var(--'], ['|', 'background:'],
  ['$', 'font-weight:'], ['_', 'font-size:'], ['?', 'border-radius:'],
];
function packSelectors(literal) {
  for (const [code] of PACKED) {
    if (literal.includes(code)) throw new Error('the stylesheet already contains ' + code + ', pick another stand-in');
  }
  let packed = literal;
  for (const [code, phrase] of [...PACKED].sort((a, b) => b[1].length - a[1].length)) {
    packed = packed.split(phrase).join(code);
  }
  const table = '[' + PACKED.map(([code, phrase]) => '"' + code + '","' + phrase + '"').join(',') + ']';
  return '(function(s,d){for(var i=0;i<d.length;i+=2)s=s.split(d[i]).join(d[i+1]);return s})(' + packed + ',' + table + ')';
}
function compact(code, espree) {
  const toks = espree.tokenize(code, { ecmaVersion: 'latest', range: true, loc: true });
  let out = '', prev = null, prevText = '';
  for (const t of toks) {
    let text = code.slice(t.range[0], t.range[1]);
    // The stylesheet is one long string with a line break and indentation between
    // rules. In CSS any run of white space means the same as one space, so the
    // breaks and indentation go. Nothing else in any other string is touched.
    // Then the spaces CSS does not need: around { } ; , and after a colon. Never
    // before a colon, where a space means "any descendant" in a selector.
    if (t.type === 'String' && text.includes('#mtx-booking{')) {
      text = text.replace(/\\n\s*/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/:\s+/g, ':');
      text = packSelectors(text);
    }
    if (prev) {
      if (t.loc.start.line !== prev.loc.end.line) out += '\n';
      else if (needSpace(prev, prevText, t, text)) out += ' ';
    }
    out += text; prev = t; prevText = text;
  }
  return out + '\n';
}
const stripped = kept.join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const espree = loadEspree();
process.stdout.write(espree
  ? compact(stripped, espree)
  : stripped.split('\n').map(l => l.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n'));
