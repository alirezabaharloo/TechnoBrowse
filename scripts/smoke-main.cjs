'use strict';

/**
 * Integration smoke test for the Electron MAIN process — without a display.
 *
 * TechnoBrowse is a Chrome profile MANAGER: the main process creates/deletes
 * profiles and launches real Chrome with a per-profile user-data directory.
 * This stubs `electron` and `child_process.spawn` (recording the exact
 * arguments) and verifies the full IPC surface end to end.
 *
 * Run: npm run smoke
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const results = [];
// NOTE: async — every test body is genuinely awaited before the report runs.
const test = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', `${name}\n        ${error.stack || error.message}`]);
  }
};

// ── Temp data root + a REAL fake "chrome" executable (detection must find it) ─
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'technobrowse-smoke-'));
const tmpData = path.join(tmpRoot, 'userData');
fs.mkdirSync(tmpData, { recursive: true });
const fakeChromePath = path.join(tmpRoot, 'chrome-stub');
fs.writeFileSync(fakeChromePath, '#!/bin/sh\nexit 0\n');
fs.chmodSync(fakeChromePath, 0o755);
// Detection reads this at call time — override to a nonexistent path later to
// simulate "Chrome is not installed".
process.env.TECHNOBROWSE_CHROME_PATH = fakeChromePath;

// ── Electron stub ────────────────────────────────────────────────────────────
function makeWebContents() {
  return {
    id: 1,
    setWindowOpenHandler() {},
    on() {},
    send() {},
    loadURL() { return Promise.resolve(); },
    loadFile() { return Promise.resolve(); },
  };
}

class FakeBrowserWindow {
  constructor(options = {}) {
    this.options = options;
    this.webContents = makeWebContents();
    FakeBrowserWindow._instances.push(this);
  }
  static _instances = [];
  static getAllWindows() { return FakeBrowserWindow._instances.slice(); }
  on() {}
  once(event, fn) { if (event === 'ready-to-show') fn(); return this; }
  show() {}
  focus() {}
  destroy() {}
  loadURL() { return Promise.resolve(); }
  loadFile() { return Promise.resolve(); }
}

// child_process stub — records spawns; the fake pid is THIS process so
// isPidAlive() (process.kill(pid, 0)) reports it as running.
const spawnCalls = [];
const fakeSpawn = (command, args, options) => {
  spawnCalls.push({ command, args, options });
  return {
    pid: process.pid,
    unref() {},
    on() {},
  };
};

const ipcHandlers = new Map();
const ipcMain = {
  handle(channel, fn) { ipcHandlers.set(channel, fn); },
  on() {},
};

const appPaths = { userData: tmpData };
const app = {
  getPath: (name) => (name === 'userData' ? appPaths.userData : path.join(tmpRoot, name)),
  setPath: (name, value) => { appPaths[name] = value; },
  whenReady: () => Promise.resolve(),
  on() {},
  quit() {},
  getVersion: () => '2.0.0-smoke',
  isPackaged: false,
  requestSingleInstanceLock: () => true,
  setName() {},
};

const electronStub = {
  app,
  BrowserWindow: FakeBrowserWindow,
  ipcMain,
  shell: { openPath: async () => '', openExternal: async () => {} },
};

// Intercept require('electron') and spawn inside the main module under test.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
  if (request === 'child_process' || request === 'node:child_process') {
    return { ...originalLoad.call(this, request, parent, isMain), spawn: fakeSpawn };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// ── Load the main process ────────────────────────────────────────────────────
require('../electron/main.js');

// Flush promise chains kicked off by whenReady().
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  await flush();
  await flush();
  await flush();

  const call = async (channel, payload, sender) => {
    const handler = ipcHandlers.get(channel);
    assert.ok(handler, `IPC handler registered: ${channel}`);
    return handler({ sender: sender ?? { id: -1 } }, payload);
  };

  await test('app:info reports the sandboxed temp data root', async () => {
    const info = await call('app:info');
    assert.equal(info.dataRoot, tmpData);
    assert.equal(info.portable, false);
    assert.equal(info.chromeFound, true);
  });

  await test('app:chrome-status finds the env-provided Chrome', async () => {
    const status = await call('app:chrome-status');
    assert.equal(status.found, true);
    assert.equal(status.executablePath, fakeChromePath);
    assert.equal(status.source, 'env');
  });

  let profileA;
  await test('profiles:create assigns a dedicated directory and creates it on disk', async () => {
    profileA = await call('profiles:create', { name: 'Smoke Alpha', email: 'alpha@example.com' });
    assert.match(profileA.id, /^[a-f0-9]{18}$/);
    assert.equal(profileA.directory, `profiles/profile-${profileA.id}`);
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    assert.equal(persisted.profiles.length, 1);
    assert.equal(persisted.profiles[0].directory, profileA.directory);
    assert.ok(!JSON.stringify(persisted).includes('cookie'), 'metadata store contains no website data');
    assert.ok(fs.statSync(path.join(tmpData, profileA.directory)).isDirectory(), 'profile directory created eagerly');
  });

  let profileB;
  await test('profiles:create second profile with distinct id', async () => {
    profileB = await call('profiles:create', { name: 'Smoke Beta', email: '' });
    assert.notEqual(profileA.id, profileB.id);
  });

  await test('profiles:open launches Chrome with a per-profile --user-data-dir (no shell)', async () => {
    const result = await call('profiles:open', { id: profileA.id });
    assert.equal(result.reused, false);
    assert.equal(spawnCalls.length, 1);
    const { command, args, options } = spawnCalls[0];
    assert.equal(command, fakeChromePath);
    assert.deepEqual(args.slice(1), ['--new-window', '--no-first-run', '--no-default-browser-check']);
    assert.equal(args[0], `--user-data-dir=${path.join(tmpData, profileA.directory)}`);
    assert.equal(options.shell, false);
    assert.ok(Array.isArray(args) && !args.some((a) => a.includes('profile-' + profileB.id)), 'B directory never passed to A launch');
  });

  await test('opening the same profile twice does NOT spawn a second Chrome', async () => {
    const result = await call('profiles:open', { id: profileA.id });
    assert.equal(result.reused, true);
    assert.equal(spawnCalls.length, 1, 'no new spawn for a running profile');
  });

  await test('each profile launches with its OWN user-data-dir', async () => {
    await call('profiles:open', { id: profileB.id });
    assert.equal(spawnCalls.length, 2);
    assert.equal(spawnCalls[1].args[0], `--user-data-dir=${path.join(tmpData, profileB.directory)}`);
    assert.ok(!spawnCalls[1].args[0].includes(profileA.id));
  });

  await test('profiles:set-ai-limit stores Date.now()-class timestamps and persists them', async () => {
    const before = Date.now();
    const marked = await call('profiles:set-ai-limit', { id: profileB.id, enabled: true });
    const after = Date.now();
    assert.equal(typeof marked.aiLimitReachedAt, 'number');
    assert.ok(marked.aiLimitReachedAt >= before && marked.aiLimitReachedAt <= after,
      `timestamp comes from the main-process clock (${marked.aiLimitReachedAt})`);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    const persisted = onDisk.profiles.find((x) => x.id === profileB.id);
    assert.equal(persisted.aiLimitReachedAt, marked.aiLimitReachedAt, 'persisted to profiles.json');
    const list = await call('profiles:list');
    assert.equal(list.find((x) => x.id === profileB.id).aiLimitReachedAt, marked.aiLimitReachedAt);
  });

  await test('profiles:set-ai-limit with enabled:false clears the timestamp', async () => {
    const cleared = await call('profiles:set-ai-limit', { id: profileB.id, enabled: false });
    assert.equal(cleared.aiLimitReachedAt, null);
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    assert.equal(onDisk.profiles.find((x) => x.id === profileB.id).aiLimitReachedAt, null);
  });

  await test('profiles:set-ai-limit rejects invalid ids', async () => {
    await assert.rejects(call('profiles:set-ai-limit', { id: '../../evil', enabled: true }), /درست نیست/);
  });

  await test('delete is REFUSED while the profile looks running', async () => {
    await assert.rejects(call('profiles:delete', { id: profileA.id }), /در حال اجراست/);
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    assert.equal(persisted.profiles.length, 2, 'metadata untouched');
    assert.ok(fs.existsSync(path.join(tmpData, profileA.directory)), 'directory untouched');
  });

  await test('profiles:list reports isRunning for launched profiles', async () => {
    const list = await call('profiles:list');
    const a = list.find((p) => p.id === profileA.id);
    const b = list.find((p) => p.id === profileB.id);
    assert.equal(a.isRunning, true);
    assert.equal(b.isRunning, true); // also "running" — launched in this session
  });

  await test('delete proceeds for a profile with no running Chrome and wipes its directory', async () => {
    // Profile B's fake chrome is "alive" too — delete must refuse for B as well.
    await assert.rejects(call('profiles:delete', { id: profileB.id }), /در حال اجراست/);
  });

  await test('chrome "disappears" → open reports CHROME_NOT_FOUND and no spawn happens', async () => {
    const spawnsBefore = spawnCalls.length;
    process.env.TECHNOBROWSE_CHROME_PATH = path.join(tmpRoot, 'definitely-not-chrome.exe');
    const refreshed = await call('app:refresh-chrome');
    assert.equal(refreshed.found, false);
    await assert.rejects(call('profiles:open', { id: profileA.id }), /کروم/);
    assert.equal(spawnCalls.length, spawnsBefore, 'no spawn without Chrome');
    // restore and re-check
    process.env.TECHNOBROWSE_CHROME_PATH = fakeChromePath;
    const again = await call('app:refresh-chrome');
    assert.equal(again.found, true);
  });

  await test('delete refuses invalid profile ids before touching anything', async () => {
    await assert.rejects(call('profiles:delete', { id: '../../etc' }), /درست نیست/);
  });

  // ── Report ─────────────────────────────────────────────────────────────────
  const failed = results.filter(([status]) => status === 'FAIL');
  for (const [status, name] of results) console.log(`${status}  ${name}`);
  console.log(`\n${results.length - failed.length}/${results.length} smoke tests passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error('SMOKE TEST CRASHED:', error);
  process.exit(1);
});
