import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const COLS = { '1000033985': ['RINGSIDE','#00A651'], '1000033982': ['CLUB CLASS','#27AAE1'],
               '1000033984': ['LEO SECTION','#FFF200'], '1000033983': ['THIRD CLASS','#F7941E'] };
for (const key of ['hub','dated']) {
  const frag = readFileSync(`${key}-live.txt`,'utf8');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${frag}</body></html>`;
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  // Stand-ins for the Tilda graphics, which this environment cannot reach.
  await p.route('**/static.tildacdn.com/**', r => {
    const id = (r.request().url().match(/(\d{10})\.webp/) || [])[1];
    const [label, col] = COLS[id] || ['SEATING MAP','#01A453'];
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body:
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#111"/><rect y="735" width="1200" height="65" fill="${col}"/><text x="60" y="380" font-family="Arial" font-size="88" font-weight="bold" fill="#fff">${label}</text><text x="60" y="460" font-family="Arial" font-size="38" fill="#aaa">stand-in ${id}</text></svg>` });
  });
  // Registered after the catch-all: Playwright matches handlers in reverse
  // order, so the last one registered wins. The logo is the real file the owner supplied, so the hero renders truthfully.
  await p.route('**/2edd0c01-d473-4a1c-b.png', r => r.fulfill({ status: 200, contentType: 'image/png',
    body: readFileSync('/root/.claude/uploads/92c34b20-70db-5c31-9f25-d0116bc68d3c/2d1ea222-image.png') }));
  await p.setContent(doc, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const nodes = await p.$$('.mtx-pi > section, .mtx-pi > header');
  for (let i = 0; i < nodes.length; i++) await nodes[i].screenshot({ path: `${key}-${i+1}.jpg`, type:'jpeg', quality: 62 });
  console.log(key, nodes.length, 'sections');
  await p.close();
}
await b.close();
