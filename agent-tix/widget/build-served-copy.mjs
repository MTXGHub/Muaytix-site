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
function compact(code, espree) {
  const toks = espree.tokenize(code, { ecmaVersion: 'latest', range: true, loc: true });
  let out = '', prev = null, prevText = '';
  for (const t of toks) {
    const text = code.slice(t.range[0], t.range[1]);
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
