/**
 * Visual check: screenshots the built dashboard with headless Chromium.
 * Fully self-contained: serves dist/ from an ephemeral localhost port and
 * injects a small in-memory mock of window.technobrowse (the Electron preload
 * bridge) so the real production bundle renders without Electron.
 * Usage: npm run build && node scripts/visual-check.mjs
 */
import sparticuz, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';

const binDir = path.resolve('node_modules/@sparticuz/chromium/bin');
// Extract the AL2023 shared-lib pack (libnspr4, libnss3, ...) and put it on the loader path.
const al2023Out = await inflate(path.join(binDir, 'al2023.tar.br'));
setupLambdaEnvironment(path.join(al2023Out, 'lib'));
console.log('LD_LIBRARY_PATH =', process.env.LD_LIBRARY_PATH);

const outDir = 'visuals';
fs.mkdirSync(outDir, { recursive: true });

const DIST = path.resolve('dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
console.log('serving dist/ at', base);

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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Seed a deterministic in-memory window.technobrowse before any app code runs.
await page.addInitScript(() => {
  const now = Date.now();
  const HOUR = 3600000;
  const DAY = 86400000;
  const profiles = [
    {
      id: 'seed8f3a1b2c4d5e6',
      name: 'حساب کاری',
      email: 'alex@work.com',
      color: 'blue',
      createdAt: new Date(now - 40 * DAY).toISOString(),
      lastOpenedAt: new Date(now - 5 * HOUR).toISOString(),
      directory: 'profiles/profile-seed8f3a1b2c4d5e6',
      isRunning: false,
      aiLimitReachedAt: null,
    },
    {
      id: 'seed1c2d3e4f5a6b7',
      name: 'شخصی',
      email: 'alex.personal@gmail.com',
      color: 'emerald',
      createdAt: new Date(now - 21 * DAY).toISOString(),
      lastOpenedAt: new Date(now - 2 * DAY).toISOString(),
      directory: 'profiles/profile-seed1c2d3e4f5a6b7',
      isRunning: false,
      aiLimitReachedAt: now - (3 * HOUR + 25 * 60000),
    },
  ];
  let seq = 0;
  const clone = (p) => ({ ...p });
  window.technobrowse = {
    openExternal: async () => {},
    listProfiles: async () => profiles.map(clone),
    getAppInfo: async () => ({
      version: '2.0.0',
      dataRoot: 'C:\\Users\\sample\\AppData\\Roaming\\TechnoBrowse',
      portable: false,
      profileCount: profiles.length,
      chromeFound: true,
    }),
    getChromeStatus: async () => ({
      found: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      source: 'mock',
    }),
    refreshChromeStatus: async () => window.technobrowse.getChromeStatus(),
    createProfile: async ({ name, email }) => {
      seq += 1;
      const id = `new${String(seq).padStart(4, '0')}seedrest00`.slice(0, 18).padEnd(18, '0');
      const profile = {
        id,
        name,
        email,
        color: 'violet',
        createdAt: new Date().toISOString(),
        lastOpenedAt: null,
        directory: `profiles/profile-${id}`,
        isRunning: false,
        aiLimitReachedAt: null,
      };
      profiles.unshift(profile);
      return clone(profile);
    },
    updateProfile: async (id, { name, email }) => {
      const target = profiles.find((p) => p.id === id);
      if (!target) throw new Error('پروفایل یافت نشد.');
      target.name = name;
      target.email = email;
      return clone(target);
    },
    setProfileAiLimit: async (id, enabled) => {
      const target = profiles.find((p) => p.id === id);
      if (!target) throw new Error('پروفایل یافت نشد.');
      target.aiLimitReachedAt = enabled ? Date.now() : null;
      return clone(target);
    },
    deleteProfile: async (id) => {
      const index = profiles.findIndex((p) => p.id === id);
      if (index !== -1) profiles.splice(index, 1);
      return { ok: true };
    },
    openProfile: async () => ({ ok: true, reused: false }),
    openChromeDownload: async () => ({ ok: true }),
    openDataRoot: async () => ({ ok: true }),
    onProfilesChanged: () => () => {},
  };
});

// ── 1. Dashboard ─────────────────────────────────────────────────────────────
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

// ── Promo banner: appears 2.5s after load, sweeps for 16s ────────────────────
await page.waitForTimeout(4200); // we are now ≥2.5s into the first sweep
await shot(page, 'promo-banner');

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('done:', results.join(', '));
process.exit(0);
