// Builds a self-contained block that can be pasted into a Tilda HTML block.
//
//   node agent-tix/widget/build-paste-block.mjs > paste-into-tilda.html
//
// Same widget as the hosted one, same three modes, just carried inline instead
// of loaded from an address. Pasted, it has to be re-pasted to update; loaded
// from an address, it updates everywhere at once. Use the hosted one once it is
// published; this exists so a page can go live without waiting for that.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const js = execSync('node ' + new URL('./build-served-copy.mjs', import.meta.url).pathname,
                    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

if (js.includes('</scr' + 'ipt>')) {
  throw new Error('the widget contains a closing script tag and cannot be inlined');
}

process.stdout.write(
`<!--
  MuayTix booking widget.

  Paste this whole block into a Tilda HTML block (T123) on a page at
  muaytix.com, then publish. It will not work on a Tilda preview address —
  the booking system only answers muaytix.com and www.muaytix.com.

  This div is the full calendar: month, then date, then seat class.
  For one fight night only, add the night to the div:

      <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"></div>

  For one fight night and one seat class:

      <div class="muaytix-ticket-selector" data-event-id="rws_2026_09_05"
           data-ticket-class="Third Class"></div>
-->

<div class="muaytix-ticket-selector"></div>

<script>
${js}
</script>
`);
