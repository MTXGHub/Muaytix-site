import { chromium } from 'playwright';
import fs from 'fs';
const CH = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const shared = fs.readFileSync('_shared.css','utf8');
const a = fs.readFileSync('homepage-a.html','utf8');
const b = fs.readFileSync('homepage-b.html','utf8');
const doc = `<!doctype html><meta charset="utf-8"><meta name=viewport content="width=device-width,initial-scale=1"><style>${shared}</style>${a}${b}`;
const br = await chromium.launch({ executablePath: CH });
for (const [name,w] of [['desk',1280],['phone',390]]) {
  const p = await br.newPage({ viewport:{width:w,height:900}, deviceScaleFactor:2 });
  await p.setContent(doc, { waitUntil:'load' });
  const el = await p.$('#the-week');
  await el.screenshot({ path:`week-${name}.png` });
  const ev = await p.$('.mtx-hp__ev');
  const box = await ev.boundingBox();
  const btn = await p.$('.mtx-hp__ev .mtx-hp__btn');
  const bb = await btn.boundingBox();
  const cs = await p.$$eval('.mtx-hp__ev .mtx-hp__btn', n=>n.map(x=>getComputedStyle(x).backgroundColor));
  const when = await p.$eval('.mtx-hp__when', n=>getComputedStyle(n).color);
  console.log(name, 'card', Math.round(box.width)+'x'+Math.round(box.height), '| btn w', Math.round(bb.width), '| btn bg', cs[0], '| day', when);
  await p.close();
}
await br.close();
