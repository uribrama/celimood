import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Bien' }).click();
await page.waitForSelector('text=Tags');
const tag = page.getByRole('button', { name: /Trabajo/ });
const box = await tag.boundingBox();
console.log('box', box);
await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 5 });
await page.waitForTimeout(200);
console.log('matches(:hover):', await tag.evaluate(el => el.matches(':hover')));
console.log('elementFromPoint === chip?', await page.evaluate(([x,y]) => {
  const el = document.elementFromPoint(x,y);
  return el?.textContent;
}, [box.x + box.width/2, box.y + box.height/2]));
await browser.close();
