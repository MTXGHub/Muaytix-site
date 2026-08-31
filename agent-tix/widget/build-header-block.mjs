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
  MuayTix booking widget.

  Paste this ONCE into the site-wide header (Tilda: Site Settings > More >
  HTML code for the HEAD). Every page that needs the widget then carries only:

      <div class="muaytix-ticket-selector"></div>                  full calendar
      <div class="muaytix-ticket-selector"
           data-event-id="rws_2026_09_05"></div>                   one night
      <div class="muaytix-ticket-selector"
           data-event-id="rws_2026_09_05"
           data-ticket-class="Third Class"></div>                  one night, one class

  Changing the widget then means changing this one block, and every page
  follows. Nothing to re-paste page by page.
-->
<script>
${js}
</script>
`);
