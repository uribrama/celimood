import { chromium } from 'playwright-core';

const shotDir = '/tmp/claude-1000/-home-uri-Descargas-celimood/e3d63d7d-26e6-463b-baad-6d7cd468abfd/scratchpad';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 12/13/14 width
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForSelector('text=¿Cómo estuvo tu día?');
await page.screenshot({ path: `${shotDir}/v1-today-light.png` });

// Log mood to reveal energy/tags/nota + check tab bar with content behind it
await page.getByRole('button', { name: 'Bien' }).click();
await page.waitForSelector('text=Energía');
await page.waitForTimeout(400);
await page.screenshot({ path: `${shotDir}/v2-today-energy-light.png` });

// Set an energy level
await page.getByRole('button', { name: 'Energía: Alta' }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${shotDir}/v3-today-energy-set-light.png` });

// Hover a tag (mouse-driven env, confirm hover state renders)
const workTag = page.getByRole('button', { name: /Trabajo/ });
await workTag.hover();
await page.waitForTimeout(150);
await page.screenshot({ path: `${shotDir}/v4-chip-hover-light.png` });

// Tab bar close-up
await page.locator('nav').screenshot({ path: `${shotDir}/v5-tabbar-light.png` });

// Navigate to Calendar, hover an empty cell
await page.getByRole('button', { name: 'Calendario' }).click();
await page.waitForTimeout(300);
const emptyCell = page.locator('main button.aspect-square').nth(10);
await emptyCell.hover();
await page.waitForTimeout(150);
await page.screenshot({ path: `${shotDir}/v6-calendar-hover-light.png` });

// Switch to dark
await page.getByRole('button', { name: 'Ajustes' }).click();
await page.waitForSelector('text=Tema');
await page.getByRole('button', { name: 'Oscuro' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/v7-settings-dark.png` });

await page.getByRole('button', { name: 'Hoy' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/v8-today-dark.png` });

await page.locator('nav').screenshot({ path: `${shotDir}/v9-tabbar-dark.png` });

await page.getByRole('button', { name: 'Calendario' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/v10-calendar-dark.png` });

console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
