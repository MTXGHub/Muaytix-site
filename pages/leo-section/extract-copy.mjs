/* Pulls the copy out of brief.txt, Part E, into copy.json.
 *
 *   node extract-copy.mjs
 *
 * The copy is final and is not retyped anywhere: this reads it from the brief
 * itself, so a typing slip cannot change a word. gen.mjs renders copy.json by
 * key, and verify.mjs diffs the built page against brief.txt directly, not
 * against copy.json, so the two ends of the pipe are checked independently.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const brief = readFileSync('brief.txt', 'utf8').split('\n');
const start = brief.findIndex(l => l.trim() === 'SEO METADATA');
const end = brief.findIndex(l => l.startsWith('BUILD NOTES (not copy)'));
if (start < 0 || end < 0) throw new Error('Part E markers not found in brief.txt');
const lines = brief.slice(start, end);

const LABEL = /^(Kicker|H1|Subheading|Intro|Fact strip|Primary CTA|Secondary link|H2|Urgency line|Trust line|CTA|Headline|Body|Detail|Photo captions|Link|Tile \d)$/;
const SEO = /^(Meta title|Meta description|URL|H1)\b/;
const out = { seo: {}, sections: {} };

let sec = null, label = null, buf = [];
const flush = () => {
  if (sec && label) {
    const blocks = []; let cur = [];
    for (const l of buf) { if (l.trim() === '') { if (cur.length) blocks.push(cur); cur = []; } else cur.push(l.trimEnd()); }
    if (cur.length) blocks.push(cur);
    (out.sections[sec][label] = out.sections[sec][label] || []).push(...blocks);
  }
  buf = [];
};

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^=+$/.test(l.trim())) continue;
  const sm = l.match(/^SECTION (\d+)\. /);
  if (sm) { flush(); sec = sm[1]; label = null; out.sections[sec] = {}; continue; }
  if (l.trim() === 'SEO METADATA') { flush(); sec = 'seo'; label = null; continue; }
  if (l.startsWith('[BUILD')) continue;
  if (sec === 'seo') {
    const m = l.match(SEO);
    if (m) { const key = m[1]; const val = lines[i + 1]; out.seo[key] = val.trim(); i++; }
    continue;
  }
  if (!sec) continue;
  if (/^Q: /.test(l)) { flush(); label = null; (out.sections[sec].faq = out.sections[sec].faq || []).push({ q: l.slice(3).trim(), a: '' }); continue; }
  if (/^A: /.test(l)) { const f = out.sections[sec].faq; f[f.length - 1].a = l.slice(3).trim(); continue; }
  if (LABEL.test(l.trim())) { flush(); label = l.trim(); continue; }
  if (sec === '13') { if (l.trim()) (out.sections[sec].links = out.sections[sec].links || []).push(l.trim()); continue; }
  buf.push(l);
}
flush();

/* Section 13 has no label lines, only the link lines themselves. */
writeFileSync('copy.json', JSON.stringify(out, null, 2) + '\n');
console.log('sections:', Object.keys(out.sections).join(', '));
console.log('seo:', JSON.stringify(out.seo));
console.log('faq entries:', out.sections['11'].faq.length, ' related links:', out.sections['13'].links.length);
