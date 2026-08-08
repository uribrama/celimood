import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5173');
console.log('hover:hover matches:', await page.evaluate(() => window.matchMedia('(hover: hover)').matches));
console.log('any-hover matches:', await page.evaluate(() => window.matchMedia('(any-hover: hover)').matches));
console.log('pointer:fine matches:', await page.evaluate(() => window.matchMedia('(pointer: fine)').matches));
await browser.close();
