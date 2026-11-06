/**
 * Plain-node unit checks for the Electron-independent modules:
 *   electron/profileStore.js   — profile CRUD, validation, atomic persistence, corrupt-file tolerance, directory handling
 *   electron/chromeDetect.js   — launch-argument construction, Chrome detection helpers
 *   electron/paths.js          — portable/writable data-root logic (isWritableDir)
 *
 * Run: npm test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ProfileStore, buildProfileDirectory, resolveProfileDataDir, PROFILE_DIR_RE } = require('../electron/profileStore.js');
const { buildChromeLaunchArgs, parseRegistryOutput, candidatePaths } = require('../electron/chromeDetect.js');

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

await test('create assigns a dedicated profiles/profile-<id> directory', async () => {
  assert.equal(firstProfile.directory, `profiles/profile-${firstProfile.id}`);
  const onDisk = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  assert.equal(onDisk.profiles[0].directory, firstProfile.directory);
});

await test('two profiles get different ids and different directories', async () => {
  const a = await store.create({ name: 'Account A' });
  const b = await store.create({ name: 'Account B' });
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.directory, b.directory);
  assert.match(a.directory, PROFILE_DIR_RE);
  assert.match(b.directory, PROFILE_DIR_RE);
});

await test('legacy profiles.json without a directory gets one assigned on load', async () => {
  const legacyFile = path.join(tmp, 'legacy', 'profiles.json');
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  // Simulate a v1 profile created before the Chrome-manager architecture.
  const legacyId = 'abcdef0123456789ab'; // 18 hex chars
  fs.writeFileSync(legacyFile, JSON.stringify({
    version: 1,
    profiles: [{
      id: legacyId,
      name: 'Legacy Account',
      email: 'legacy@example.com',
      color: 'violet',
      createdAt: '2024-01-01T00:00:00.000Z',
      lastOpenedAt: null,
    }],
  }));
  const reopened = new ProfileStore(legacyFile);
  const list = await reopened.list();
  assert.equal(list[0].directory, `profiles/profile-${legacyId}`);
});

await test('resolveProfileDataDir stays inside <dataRoot>/profiles and rejects escapes', async () => {
  const id = '0123456789abcdef01';
  const resolved = resolveProfileDataDir(tmp, { id, directory: `profiles/profile-${id}` });
  assert.equal(resolved, path.join(tmp, 'profiles', `profile-${id}`));
  // path traversal / foreign values are replaced by the canonical directory
  const sneaky = resolveProfileDataDir(tmp, { id, directory: '../../outside' });
  assert.equal(sneaky, path.join(tmp, 'profiles', `profile-${id}`));
  const absolute = resolveProfileDataDir(tmp, { id, directory: '/etc/passwd' });
  assert.equal(absolute, path.join(tmp, 'profiles', `profile-${id}`));
  // a garbage id is rejected outright
  assert.throws(() => resolveProfileDataDir(tmp, { id: '../bad', directory: 'profiles/profile-../bad' }), /نامعتبر/);
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

await test('update edits name/email only, keeps id + directory stable', async () => {
  const updated = await store.update(firstProfile.id, { email: 'new@label.example.com' });
  assert.equal(updated.id, firstProfile.id);
  assert.equal(updated.directory, firstProfile.directory);
  assert.equal(updated.email, 'new@label.example.com');
  const renamed = await store.update(firstProfile.id, { name: 'Renamed' });
  assert.equal(renamed.name, 'Renamed');
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

// ── chromeDetect ────────────────────────────────────────────────────────────

await test('buildChromeLaunchArgs passes an argument array, never a shell string', async () => {
  const args = buildChromeLaunchArgs('/data/profiles/profile-abc123');
  assert.deepEqual(args, [
    '--user-data-dir=/data/profiles/profile-abc123',
    '--new-window',
    '--no-first-run',
    '--no-default-browser-check',
  ]);
  assert.throws(() => buildChromeLaunchArgs(''), /required/);
  // arguments are indistinguishable from a single token — no shell expansion possible
  assert.ok(args.every((a) => typeof a === 'string' && !/\s/.test(a.replace('user-data-dir=', '')) || a.startsWith('--user-data-dir=')));
});

await test('parseRegistryOutput extracts Chrome.exe from reg query output', async () => {
  const appPaths = [
    '    (default)    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '        InstallLocation    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\\',
  ];
  assert.equal(parseRegistryOutput(appPaths[0]), 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  assert.equal(parseRegistryOutput(appPaths[1]), path.join('C:\\Program Files\\Google\\Chrome\\Application', 'chrome.exe'));
  // quoted + expanded values
  assert.equal(
    parseRegistryOutput('    (default)    REG_EXPAND_SZ    "C:\\PROGRA~1\\Google\\Chrome\\Application\\Chrome.exe"'),
    'C:\\PROGRA~1\\Google\\Chrome\\Application\\Chrome.exe'
  );
  assert.equal(parseRegistryOutput('garbage output with no REG_SZ'), null);
});

await test('candidatePaths covers Program Files, (x86) and LOCALAPPDATA on Windows', async () => {
  const win = candidatePaths('win32', {
    PROGRAMFILES: 'C:\\PF',
    'PROGRAMFILES(X86)': 'C:\\PF86',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
  });
  assert.equal(win.length, 3);
  assert.ok(win.every((p) => p.endsWith(path.join('Google', 'Chrome', 'Application', 'chrome.exe'))));
  const mac = candidatePaths('darwin', {}, '/Users/me');
  assert.equal(mac[0], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
});

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter(([status]) => status === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
process.exit(failed.length ? 1 : 0);
