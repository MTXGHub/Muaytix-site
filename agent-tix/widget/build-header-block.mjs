// Builds the block that goes ONCE into the site-wide header, the same way the
// old widget was loaded. Every page then only needs the div:
//
//     <div class="muaytix-ticket-selector"></div>
//
// Updating the widget then means changing one place, not every page.
//
//   node agent-tix/widget/build-header-block.mjs > paste-into-tilda-header.html
import { execSync } from 'node:child_process';
const js = execSync('node ' + new URL('./build-served-copy.mjs', import.meta.url).pathname,
                    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (js.includes('</scr' + 'ipt>')) throw new Error('cannot be inlined');
process.stdout.write(
`<!--
  MuayTix booking widget. Paste once in the site HEAD (Tilda: Site Settings > More > HTML code for the HEAD).
  A page then needs only <div class="muaytix-ticket-selector"></div>; add data-event-id="..." for one fight night.
-->
<script>
${js}
</script>
`);
