/* Build the paste-ready copy of the payment success page.
 *
 * Jason pastes the output into a Tilda HTML block. He is on a tablet, so the
 * only thing that must ever be hand-edited is payment-success.html; this script
 * produces the paste file from it. Hand-editing the paste file is how the two
 * drift apart and how a fix ends up live in one and not the other.
 *
 *   node pages/payment-success/build.mjs
 *
 * It writes both output files itself rather than to stdout, because a builder
 * that writes to stdout looks like it has done nothing when the redirect is
 * forgotten. That has already cost time once.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "payment-success.html");
const outputs = [
  join(here, "payment-success-live.txt"),
  join(here, "muaytix-payment-success-PASTE-INTO-TILDA.html"),
];

let html = readFileSync(src, "utf8");

// Comments explain the page to whoever works on it next. They are of no use to
// a guest and they are not worth the bytes in a Tilda block.
html = html.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\r?\n/gm, "");   // whole-line HTML comments
html = html.replace(/<!--[\s\S]*?-->/g, "");                       // anything left inline
html = html.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\r?\n/gm, "");   // whole-line CSS comments
html = html.replace(/[ \t]*\/\*[\s\S]*?\*\//g, "");                // anything left inline
html = html.replace(/\n{3,}/g, "\n\n");                            // no more than one blank line

// The banned list from CLAUDE.md section 2. A build that lets one of these
// through is worse than no build at all, so it fails rather than warns.
const banned = [
  [/\bofficial/i, '"official" is banned in guest copy, alt text, file names and schema'],
  [/\bLimited\b/, '"Limited" is not a guest-facing status; use Available'],
  [/—/, "em dash; use a comma, a full stop or a colon"],
  [/book your seat/i, 'use "Book Tickets"'],
  [/\b(un)?assigned seating\b/i, '"assigned seating" is a trade word, not a guest word'],
  [/selling fast|% booked|hurry|don't miss out/i, "scarcity copy"],
];
const failures = banned
  .filter(([re]) => re.test(html))
  .map(([re, why]) => `  ${html.match(re)[0]} — ${why}`);
if (failures.length) {
  console.error("Refusing to build. Banned copy found:\n" + failures.join("\n"));
  process.exit(1);
}

for (const out of outputs) writeFileSync(out, html);
console.log(`Wrote ${outputs.length} files, ${html.length} bytes each.`);
