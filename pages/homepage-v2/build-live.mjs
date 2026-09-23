/* Builds the two paste-ready blocks from the commented sources.
   The comments are for us, not for the page: they are stripped here so the
   blocks Jason pastes into Tilda stay as small as they can be. Nothing else
   about the markup changes, so what he pastes is what we rendered. */
import fs from 'fs';

const strip = (html) => html
  .replace(/<style>([\s\S]*?)<\/style>/g, (_, css) =>
    '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '')
                   .replace(/\n{3,}/g, '\n\n')
                   .trim() + '</style>')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim() + '\n';

for (const [src, out] of [
  ['homepage-a.html', 'homepage-block-A-live.txt'],
  ['homepage-b.html', 'homepage-block-B-live.txt'],
]) {
  const live = strip(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(out, live);
  console.log(out, (live.length / 1024).toFixed(1) + ' KB');
}
