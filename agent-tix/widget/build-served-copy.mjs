// Produces the copy of the widget that is actually served to guests: the same
// code with the comments taken out. The commented widget.js stays the source
// of truth; this only shrinks what goes down the wire.
//
//   node agent-tix/widget/build-served-copy.mjs > served.js
import fs from 'node:fs';
const src = fs.readFileSync(new URL('./widget.js', import.meta.url), 'utf8');
const kept = src.split('\n').filter(l => {
  const t = l.trim();
  return !(t.startsWith('//') || (t.startsWith('/*') && t.endsWith('*/')));
});
// Indentation is dropped as well, and nothing else. The header block carries the
// whole widget inside the site's head, and Tilda is not known to take a block of
// any size, so it is kept as small as it can be without changing a single token.
// header-block.test.mjs proves the tokens are identical to widget.js.
const body = kept.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')).join('\n')
  .replace(/\n{3,}/g, '\n\n');
process.stdout.write(body);
