/**
 * Visual check: screenshots the built dashboard (preview/demo mode)
 * using a self-contained Chromium.
 * Usage: node scripts/visual-check.mjs <baseUrl>
 */
import sparticuz, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { chromium } from 'playwright-core';
import path from 'node:path';

const binDir = path.resolve('node_modules/@sparticuz/chromium/bin');
// Extract the AL2023 shared-lib pack (libnspr4, libnss3, ...) and put it on the loader path.
const al2023Out = await inflate(path.join(binDir, 'al2023.tar.br'));
setupLambdaEnvironment(path.join(al2023Out, 'lib'));
console.log('LD_LIBRARY_PATH =', process.env.LD_LIBRARY_PATH);

const base = process.argv[2] || 'http://127.0.0.1:4173';
const outDir = 'visuals';
import fs from 'node:fs';
fs.mkdirSync(outDir, { recursive: true });

const executablePath = await sparticuz.executablePath();
console.log('chromium:', executablePath);

const browser = await chromium.launch({
  executablePath,
  args: [...sparticuz.args, '--no-sandbox', '--disable-gpu'],
  headless: true,
});

const results = [];
const shot = async (page, name) => {
  const file = `${outDir}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  results.push(file);
  console.log('saved', file);
};

// ── 1. Dashboard ─────────────────────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot(page, 'dashboard');

// Open the create modal
const createBtn = page.getByRole('button', { name: /ایجاد پروفایل جدید/ }).first();
await createBtn.click();
await page.waitForTimeout(350);
await shot(page, 'create-modal');

// Type a name and create the profile
await page.locator('#profile-name').fill('پروژهٔ مشتری');
await page.locator('#profile-email').fill('client@work-mail.com');
await shot(page, 'create-modal-filled');
await page.getByRole('button', { name: 'ایجاد پروفایل', exact: true }).click();
await page.waitForTimeout(400);
await shot(page, 'after-create');

// Delete dialog
const deleteButtons = page.getByRole('button', { name: /حذف پروژهٔ مشتری/ });
await deleteButtons.first().click();
await page.waitForTimeout(300);
await shot(page, 'delete-dialog');
await page.keyboard.press('Escape');

await browser.close();
console.log('done:', results.join(', '));
