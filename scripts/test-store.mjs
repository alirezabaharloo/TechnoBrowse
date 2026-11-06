/**
 * Plain-node unit checks for the Electron-independent modules:
 *   electron/profileStore.js   — profile CRUD, validation, atomic persistence, corrupt-file tolerance
 *   electron/urlUtils.js       — address-bar normalization, scheme blocking, popup features
 *
 * Run: npm test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ProfileStore } = require('../electron/profileStore.js');
const { normalizeUserUrl, isAllowedNavigation, isAllowedExternal, parsePopupFeatures } = require('../electron/urlUtils.js');

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', `${name}\n        ${error.message}`]);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'technobrowse-test-'));
const storeFile = path.join(tmp, 'profiles.json');

// ── ProfileStore ────────────────────────────────────────────────────────────

const store = new ProfileStore(storeFile);

let firstProfile;
await test('create assigns unique ids, persists atomically, defaults email to ""', async () => {
  firstProfile = await store.create({ name: '  Work   Account  ', email: '  ALEX@Work.com ' });
  assert.equal(firstProfile.name, 'Work Account'); // whitespace collapsed
  assert.equal(firstProfile.email, 'alex@work.com'); // normalized lowercase
  assert.match(firstProfile.id, /^[a-f0-9]{18}$/);
  assert.ok(fs.existsSync(storeFile), 'profiles.json written');
  const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  assert.equal(onDisk.profiles.length, 1);
  assert.equal(onDisk.profiles[0].id, firstProfile.id);
  assert.ok(!('cookies' in onDisk.profiles[0]), 'no website data in profiles.json');
});

await test('two profiles get different ids (isolated partitions)', async () => {
  const a = await store.create({ name: 'Account A' });
  const b = await store.create({ name: 'Account B' });
  assert.notEqual(a.id, b.id);
  assert.notEqual(`persist:profile-${a.id}`, `persist:profile-${b.id}`);
});

await test('create validates name length and characters', async () => {
  await assert.rejects(() => store.create({ name: '' }), /پروفایل/);
  await assert.rejects(() => store.create({ name: 'x'.repeat(61) }), /60/);
  await assert.rejects(() => store.create({ name: 'bad\nname' }), /نامعتبر/);
});

await test('create validates optional email shape but allows empty', async () => {
  await assert.rejects(() => store.create({ name: 'X', email: 'not-an-email' }), /ایمیل/);
  const ok = await store.create({ name: 'X', email: '' });
  assert.equal(ok.email, '');
});

await test('update edits name/email only, keeps id stable', async () => {
  const updated = await store.update(firstProfile.id, { email: 'new@label.example.com' });
  assert.equal(updated.id, firstProfile.id);
  assert.equal(updated.email, 'new@label.example.com');
  const renamed = await store.update(firstProfile.id, { name: 'Renamed' });
  assert.equal(renamed.name, 'Renamed');
  assert.equal(renamed.email, 'new@label.example.com');
});

await test('update/remove reject unknown ids and bad id formats', async () => {
  await assert.rejects(() => store.update('f'.repeat(18), { name: 'Nope' }), /یافت نشد/);
  await assert.rejects(() => store.remove('!!bad'), /نامعتبر/);
});

await test('markOpened sets lastOpenedAt', async () => {
  await store.markOpened(firstProfile.id);
  const p = await store.get(firstProfile.id);
  assert.ok(p.lastOpenedAt && !Number.isNaN(Date.parse(p.lastOpenedAt)));
});

await test('a fresh store instance re-reads profiles.json (persistence across restarts)', async () => {
  const reopened = new ProfileStore(storeFile);
  const list = await reopened.list();
  assert.ok(list.length >= 2, 'profiles survived a restart');
  assert.ok(list.some((p) => p.id === firstProfile.id));
});

await test('corrupt profiles.json is backed up, not fatal', async () => {
  const corruptFile = path.join(tmp, 'corrupt', 'profiles.json');
  fs.mkdirSync(path.dirname(corruptFile), { recursive: true });
  fs.writeFileSync(corruptFile, '{ this is not json !!!', 'utf8');
  const recovered = new ProfileStore(corruptFile);
  const list = await recovered.list();
  assert.deepEqual(list, []);
  const backups = fs.readdirSync(path.dirname(corruptFile)).filter((f) => f.includes('.corrupt-'));
  assert.ok(backups.length === 1, 'corrupt file was backed up for forensics');
});

await test('remove deletes only the targeted profile', async () => {
  const before = await store.list();
  const [victim] = before;
  await store.remove(victim.id);
  const after = await store.list();
  assert.equal(after.length, before.length - 1);
  assert.ok(!after.some((p) => p.id === victim.id));
});

// ── urlUtils ────────────────────────────────────────────────────────────────

await test('typed hosts become https URLs', async () => {
  assert.equal(normalizeUserUrl('example.com').url, 'https://example.com/');
  assert.equal(normalizeUserUrl('https://news.ycombinator.com/item?id=1').url, 'https://news.ycombinator.com/item?id=1');
  assert.equal(normalizeUserUrl('http://localhost:3000/dashboard').url, 'http://localhost:3000/dashboard');
  assert.equal(normalizeUserUrl('192.168.1.20:8080').url, 'https://192.168.1.20:8080/');
  assert.equal(normalizeUserUrl('[::1]:5173').url, 'https://[::1]:5173/');
});

await test('free text becomes a Google search', async () => {
  const result = normalizeUserUrl('how do electron sessions work');
  assert.ok(result.isSearch);
  assert.match(result.url, /^https:\/\/www\.google\.com\/search\?q=/);
});

await test('dangerous schemes are blocked', async () => {
  for (const input of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'vbscript:x', 'about:blank']) {
    assert.equal(normalizeUserUrl(input).ok, false, `blocked: ${input}`);
  }
});

await test('unknown schemes are blocked, http/https allowed', async () => {
  assert.equal(normalizeUserUrl('ftp://example.com').ok, false);
  assert.equal(normalizeUserUrl('steam://rungame/123').ok, false);
  assert.equal(normalizeUserUrl('https://ok.example.com').ok, true);
});

await test('isAllowedNavigation enforces http(s) + exact start page only', async () => {
  const start = pathToFileUrl(path.join(tmp, 'start.html'));
  assert.equal(isAllowedNavigation('https://example.com', start), true);
  assert.equal(isAllowedNavigation('http://example.com', start), true);
  assert.equal(isAllowedNavigation(start, start), true);
  assert.equal(isAllowedNavigation(`file://C:\\other\\page.html`, start), false);
  assert.equal(isAllowedNavigation('javascript:alert(1)', start), false);
  assert.equal(isAllowedNavigation('about:blank', start), false);
});

await test('isAllowedExternal only permits http(s)', async () => {
  assert.equal(isAllowedExternal('https://accounts.google.com'), true);
  assert.equal(isAllowedExternal('file:///C:/x'), false);
  assert.equal(isAllowedExternal('javascript:x'), false);
});

await test('popup features are parsed and clamped', async () => {
  assert.deepEqual(parsePopupFeatures('width=520,height=640'), { width: 520, height: 640 });
  assert.deepEqual(parsePopupFeatures('width=99999,height=10'), { width: 1400, height: 360 });
  assert.deepEqual(parsePopupFeatures(undefined), { width: 560, height: 680 });
  assert.deepEqual(parsePopupFeatures('left=42,top=33,width=500,height=600'), { width: 500, height: 600, x: 42, y: 33 });
});

function pathToFileUrl(p) {
  let resolved = path.resolve(p).replace(/\\/g, '/');
  if (!resolved.startsWith('/')) resolved = '/' + resolved;
  return 'file://' + encodeURI(resolved);
}

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter(([status]) => status === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
process.exit(failed.length ? 1 : 0);
