/* Assembles the paste block. Writes the files itself: a builder that only
 * prints to stdout looks like it did nothing. */
import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync('style.css','utf8');
const body = readFileSync('body.html','utf8');
const schema = readFileSync('schema.json','utf8');
const out = `<div class="mtx-rt">
<style>
${css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim()}
</style>

${body}
</div>

<script type="application/ld+json">
${schema}
</script>
`;
writeFileSync('live.txt', out);
writeFileSync('RAJADAMNERN-STADIUM-TICKETS-PASTE-INTO-TILDA.html', out);
console.log(`${(out.length/1024).toFixed(1)} KB -> live.txt and RAJADAMNERN-STADIUM-TICKETS-PASTE-INTO-TILDA.html`);
