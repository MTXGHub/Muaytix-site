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
process.stdout.write(
  kept.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n'));
