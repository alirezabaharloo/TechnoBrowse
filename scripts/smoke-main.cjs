'use strict';

/**
 * Integration smoke test for the Electron MAIN process — without a display.
 *
 * Replaces the `electron` module with a recording stub, loads electron/main.js,
 * then drives the real IPC handlers: create/open/navigate/delete profiles and
 * verifies that each profile gets its own persistent session partition and that
 * deleting a profile wipes exactly its own session data.
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
// (Previously test() fire-and-forget'd async bodies, so smoke assertions never
// actually blocked the exit code.)
const test = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (error) {
    results.push(['FAIL', `${name}\n        ${error.stack || error.message}`]);
  }
};

// ── Temp data root the stubbed app will use ──────────────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'technobrowse-smoke-'));
const tmpData = path.join(tmpRoot, 'userData');
const tmpSession = path.join(tmpData, 'user-data');
fs.mkdirSync(tmpSession, { recursive: true });

// ── Electron stub ────────────────────────────────────────────────────────────
let webContentsId = 1;

function makeWebContents(owner, webPreferences) {
  const listeners = new Map();
  return {
    id: webContentsId++,
    _owner: owner,
    _prefs: webPreferences || {},
    _url: 'about:blank',
    _title: '',
    _bounds: null,
    session: webPreferences?.session,
    navigationHistory: { canGoBack: () => false, canGoForward: () => false, goBack() {}, goForward() {} },
    setWindowOpenHandler() {},
    on(channel, fn) {
      listeners.set(channel, [...(listeners.get(channel) || []), fn]);
      return this;
    },
    once() { return this; },
    send() {},
    openDevTools() {},
    closeDevTools() {},
    isDevToolsOpened: () => false,
    reload() { this._reloaded = true; },
    getURL() { return this._url; },
    getTitle() { return this._title; },
    isLoading: () => false,
    loadURL(url) { this._url = url; return Promise.resolve(); },
    loadFile(file) { this._url = 'file://' + String(file).replace(/\\/g, '/'); return Promise.resolve(); },
    canGoBack: () => false,
    canGoForward: () => false,
    _listeners: listeners,
  };
}

class FakeBrowserWindow {
  constructor(options = {}) {
    this.options = options;
    this.webContents = makeWebContents(this, options.webPreferences);
    this.contentView = { addChildView: (view) => { this._attachedView = view; } };
    this._destroyed = false;
    this._title = options.title || '';
    FakeBrowserWindow._instances.push(this);
  }
  static _instances = [];
  static getAllWindows() { return FakeBrowserWindow._instances.filter((w) => !w._destroyed); }
  static fromWebContents() { return null; }
  on() {}
  once(event, fn) { if (event === 'ready-to-show') fn(); return this; }
  show() {}
  focus() {}
  isDestroyed() { return this._destroyed; }
  isMinimized() { return false; }
  restore() {}
  destroy() { this._destroyed = true; }
  getContentSize() { return [1280, 840]; }
  setTitle(title) { this._title = title; }
  loadURL(url) { this.webContents._url = url; return Promise.resolve(); }
  loadFile(file) { this.webContents._url = 'file://' + String(file).replace(/\\/g, '/'); return Promise.resolve(); }
}

class FakeWebContentsView {
  constructor(options = {}) {
    this.webContents = makeWebContents(this, options.webPreferences);
    this.setBackgroundColor = () => {};
    this.setBounds = (bounds) => { this.webContents._bounds = bounds; };
    FakeWebContentsView._instances.push(this);
  }
  static _instances = [];
}

const partitionSessions = new Map();
const fromPartitionCalls = [];
function fakeSession(partition) {
  if (!partitionSessions.has(partition)) {
    partitionSessions.set(partition, {
      partition,
      calls: { clearStorageData: 0, clearCache: 0, clearAuthCache: 0 },
      async clearStorageData() { this.calls.clearStorageData += 1; },
      async clearCache() { this.calls.clearCache += 1; },
      async clearAuthCache() { this.calls.clearAuthCache += 1; },
      async clearHostResolverCache() {},
      async clearCodeCaches() {},
      flushStorageData() {},
      setPermissionRequestHandler() {},
      setPermissionCheckHandler() {},
      setUserAgent(ua) { this._userAgent = ua; },
      on() {},
    });
  }
  fromPartitionCalls.push(partition);
  return partitionSessions.get(partition);
}

const ipcHandlers = new Map();
const ipcMain = {
  handle(channel, fn) { ipcHandlers.set(channel, fn); },
  on() {},
};

const appPaths = { userData: tmpData, sessionData: tmpSession };
const app = {
  getPath: (name) => {
    if (name === 'userData') return appPaths.userData;
    if (name === 'sessionData') return appPaths.sessionData;
    return path.join(tmpRoot, name);
  },
  setPath: (name, value) => { appPaths[name] = value; },
  whenReady: () => Promise.resolve(),
  on() {},
  quit() {},
  getVersion: () => '1.0.0-smoke',
  isPackaged: false,
  requestSingleInstanceLock: () => true,
  setName() {},
};

const electronStub = {
  app,
  BrowserWindow: FakeBrowserWindow,
  WebContentsView: FakeWebContentsView,
  ipcMain,
  session: { fromPartition: fakeSession },
  shell: { openPath: async () => '' },
};

// Intercept require('electron') for the main module under test.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return electronStub;
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
    assert.equal(info.sessionData, tmpSession);
    assert.equal(info.partitionPrefix, 'persist:profile-');
  });

  let profileA;
  await test('profiles:create creates isolated profile via IPC', async () => {
    profileA = await call('profiles:create', { name: 'Smoke Alpha', email: 'alpha@example.com' });
    assert.match(profileA.id, /^[a-f0-9]{18}$/);
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    assert.equal(persisted.profiles.length, 1);
    assert.ok(!JSON.stringify(persisted).includes('cookie'), 'metadata store contains no website data');
  });

  let profileB;
  await test('profiles:create second profile with distinct id', async () => {
    profileB = await call('profiles:create', { name: 'Smoke Beta', email: '' });
    assert.notEqual(profileA.id, profileB.id);
  });

  await test('profiles:open creates a window whose page view uses persist:profile-<idA> — never the default session', async () => {
    FakeBrowserWindow._instances.length = 0;
    FakeWebContentsView._instances.length = 0;
    const result = await call('profiles:open', { id: profileA.id });
    assert.equal(result.reused, false);
    const view = FakeWebContentsView._instances[0];
    assert.ok(view, 'page view created');
    assert.equal(view.webContents._prefs.session?.partition, `persist:profile-${profileA.id}`);
    assert.equal(view.webContents._prefs.nodeIntegration, false);
    assert.equal(view.webContents._prefs.contextIsolation, true);
    assert.equal(view.webContents._prefs.sandbox, true);
  });

  await test('opening the same profile twice focuses instead of duplicating', async () => {
    const result = await call('profiles:open', { id: profileA.id });
    assert.equal(result.reused, true);
  });

  await test('profiles:open creates a DIFFERENT partition for the second profile', async () => {
    const beforeB = FakeWebContentsView._instances.length;
    await call('profiles:open', { id: profileB.id });
    const view = FakeWebContentsView._instances[beforeB]; // the newly created view
    assert.equal(view.webContents._prefs.session?.partition, `persist:profile-${profileB.id}`);
  });

  await test('profile sessions present a stock desktop Chrome UA (no Electron token)', () => {
    for (const p of [profileA, profileB]) {
      const sess = partitionSessions.get(`persist:profile-${p.id}`);
      assert.ok(sess, 'partition session was created');
      assert.ok(sess._userAgent, 'setUserAgent was called on the profile session');
      assert.ok(!/Electron|TechnoBrowse/.test(sess._userAgent), `UA must not advertise Electron: ${sess._userAgent}`);
      assert.match(sess._userAgent, /Chrome\/\d+\.\d+\.\d+\.\d+ Safari\/537\.36$/);
    }
  });

  await test('chrome IPC: navigate normalizes input and loads it in the profile view', async () => {
    const chromeWindow = FakeBrowserWindow._instances.find((w) =>
      String(w.options.webPreferences?.preload || '').endsWith('chromePreload.js')
    );
    assert.ok(chromeWindow, 'chrome window found');
    const sender = chromeWindow.webContents;
    // Which profile is this chrome window bound to? Profile A was opened first.
    const ready = await call('chrome:ready', undefined, sender);
    assert.equal(ready.id, profileA.id);
    const nav = await call('chrome:navigate', { input: 'example.com' }, sender);
    assert.equal(nav.ok, true);
    assert.equal(nav.url, 'https://example.com/');
    // blocked scheme surfaces an error, no navigation
    const blocked = await call('chrome:navigate', { input: 'javascript:alert(1)' }, sender);
    assert.equal(blocked.ok, false);
  });

  await test('chrome:set-toolbar-height repositions the page view below the toolbar', async () => {
    const chromeWindow = FakeBrowserWindow._instances.find((w) =>
      String(w.options.webPreferences?.preload || '').endsWith('chromePreload.js')
    );
    const sender = chromeWindow.webContents;
    await call('chrome:set-toolbar-height', { height: 92 }, sender);
    // The handler targets the record bound to this chrome window (profile A);
    // instances[0] is profile B's view now, so locate A's view explicitly.
    const view = FakeWebContentsView._instances.find(
      (v) => v.webContents._prefs.session?.partition === `persist:profile-${profileA.id}`
    );
    assert.ok(view, 'profile A page view found');
    assert.equal(view.webContents._bounds.y, 92);
    assert.equal(view.webContents._bounds.height, 840 - 92);
    // …and profile B's view (different window) keeps its own layout
    const viewB = FakeWebContentsView._instances.find(
      (v) => v.webContents._prefs.session?.partition === `persist:profile-${profileB.id}`
    );
    assert.equal(viewB.webContents._bounds.y, 56, 'B toolbar unchanged');
  });

  await test('profiles:delete removes metadata + wipes ONLY that profile’s session', async () => {
    await call('profiles:delete', { id: profileB.id });
    const persisted = JSON.parse(fs.readFileSync(path.join(tmpData, 'profiles.json'), 'utf8'));
    assert.equal(persisted.profiles.length, 1);
    assert.equal(persisted.profiles[0].id, profileA.id);
    const wipedB = partitionSessions.get(`persist:profile-${profileB.id}`);
    assert.ok(wipedB && wipedB.calls.clearStorageData >= 1, 'session storage cleared for deleted profile');
    assert.ok(wipedB.calls.clearCache >= 1, 'cache cleared for deleted profile');
    const keptA = partitionSessions.get(`persist:profile-${profileA.id}`);
    assert.ok(!keptA || keptA.calls.clearStorageData === 0, 'surviving profile session untouched');
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
