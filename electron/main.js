'use strict';

/**
 * TechnoBrowse — main process.
 *
 * Core idea: every profile owns one persistent Chromium session created from
 *   session.fromPartition('persist:profile-<id>')
 * Nothing else ever browses websites, and no session is ever shared between
 * profiles. Profile metadata lives in <dataRoot>/profiles.json; website data
 * lives in <sessionData>/Partitions/profile-<id>. The two never mix.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');

const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require('electron');

// --- 1. Resolve storage locations BEFORE anything else touches storage. ---
const { resolveDataRoot } = require('./paths');
const { ProfileStore } = require('./profileStore');
const {
  normalizeUserUrl,
  isAllowedNavigation,
  isAllowedExternal,
  parsePopupFeatures,
} = require('./urlUtils');

const storage = resolveDataRoot(app); // sets userData + sessionData
const store = new ProfileStore(storage.profilesFile);

// --- 2. Single instance: re-focusing the dashboard is better than two instances fighting over the same profiles.json.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const START_PAGE_CANDIDATES = [
  path.join(DIST_DIR, 'start.html'),
  path.join(__dirname, '..', 'public', 'start.html'),
];
const startPagePath = START_PAGE_CANDIDATES.find((p) => fs.existsSync(p)) || START_PAGE_CANDIDATES[0];
const startPageFileUrl = pathToFileURL(startPagePath).href;

const PROFILE_PARTITION_PREFIX = 'persist:profile-';
const partitionFor = (id) => `${PROFILE_PARTITION_PREFIX}${id}`;
const getProfileSession = (id) => session.fromPartition(partitionFor(id));

const APP_ICON = (() => {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'dist', 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
})();

// --- 3. Tracking open windows so a profile can be focused instead of duplicated, and so deletion can close them.
/** profileId -> { win: BrowserWindow, view: WebContentsView, profile: object, toolbarHeight: number } */
const profileWindows = new Map();
/** webContents.id -> profileId (for the profile window's chrome UI) */
const chromeSenders = new Map();
/** profileId -> Set<BrowserWindow> (bare popup windows spawned by that profile) */
const profilePopups = new Map();
const dashboardWindows = new Set();

const DEFAULT_TOOLBAR_HEIGHT = 56;
const TAB_BAR_HEIGHT = 0;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function baseWebPreferences(preloadPath) {
  const prefs = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
  };
  if (preloadPath) prefs.preload = preloadPath;
  return prefs;
}

/** The app's own windows (dashboard/chrome) may only ever load our bundled pages or the dev server. */
function guardAppWindowNavigation(win) {
  const isAllowedAppUrl = (url) => {
    if (IS_DEV) return url.startsWith(DEV_SERVER_URL);
    return url.startsWith('file://');
  };
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedAppUrl(url)) event.preventDefault();
  });
}

function createDashboardWindow() {
  const win = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b1220',
    title: 'تکنوبروز',
    autoHideMenuBar: true,
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: baseWebPreferences(path.join(__dirname, 'preload.js')),
  });

  dashboardWindows.add(win);
  win.on('closed', () => dashboardWindows.delete(win));
  win.once('ready-to-show', () => win.show());

  // The dashboard never opens windows or navigates away.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  guardAppWindowNavigation(win);

  loadRendererPage(win, 'index.html');
  return win;
}

function createProfileWindow(profile) {
  const existing = profileWindows.get(profile.id);
  if (existing && !existing.win.isDestroyed()) {
    if (existing.win.isMinimized()) existing.win.restore();
    existing.win.focus();
    return { reused: true };
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b1220',
    title: `${profile.name} · تکنوبروز`,
    autoHideMenuBar: true,
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: baseWebPreferences(path.join(__dirname, 'chromePreload.js')),
  });

  // The isolated session for THIS profile — the whole point of the app.
  const profileSession = getProfileSession(profile.id);
  hardenSession(profileSession);

  const view = new WebContentsView({
    webPreferences: {
      session: profileSession, // <<< explicit per-profile partition, never the default session
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });
  view.setBackgroundColor('#0b1220');
  win.contentView.addChildView(view);

  const record = {
    win,
    view,
    profile: { ...profile },
    toolbarHeight: DEFAULT_TOOLBAR_HEIGHT,
  };
  profileWindows.set(profile.id, record);
  chromeSenders.set(win.webContents.id, profile.id);

  const layout = () => {
    const [width, height] = win.getContentSize();
    const top = record.toolbarHeight + TAB_BAR_HEIGHT;
    view.setBounds({
      x: 0,
      y: top,
      width: Math.max(0, width),
      height: Math.max(0, height - top),
    });
  };
  win.on('resize', layout);
  win.once('ready-to-show', () => {
    layout();
    win.show();
  });

  // --- wire up the page view -------------------------------------------------
  attachNavigationGuards(view.webContents, profile);
  attachStateForwarding(view.webContents, record);

  win.on('closed', () => {
    chromeSenders.delete(win.webContents.id);
    profileWindows.delete(profile.id);
    closeProfilePopups(profile.id);
  });

  loadRendererPage(win, 'browser.html');
  guardAppWindowNavigation(win);
  // Home = the built-in start page (bundled with the app, no network needed).
  view.webContents.loadFile(startPagePath).catch((error) => {
    process.stderr.write(`[technobrowse] failed to load start page: ${error.message}\n`);
  });

  store.markOpened(profile.id);
  return { reused: false };
}

function createProfilePopup(profile, { url, features }) {
  // OAuth / window.open flows must keep working, inside the SAME partition,
  // so cookies set during sign-in are visible to the main profile window.
  // The session has to be assigned when the webContents is created, so it is
  // passed straight into webPreferences here.
  const popupFeatures = parsePopupFeatures(features);
  const popup = new BrowserWindow({
    width: popupFeatures.width,
    height: popupFeatures.height,
    ...(popupFeatures.x !== undefined ? { x: popupFeatures.x } : {}),
    ...(popupFeatures.y !== undefined ? { y: popupFeatures.y } : {}),
    minWidth: 320,
    minHeight: 240,
    title: 'تکنوبروز',
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: {
      ...baseWebPreferences(), // bare OAuth popup: no app APIs exposed to websites
      session: getProfileSession(profile.id),
    },
  });

  trackPopup(profile.id, popup);
  attachNavigationGuards(popup.webContents, profile);
  popup.loadURL(url).catch(() => {});
  return popup;
}

function trackPopup(profileId, popup) {
  if (!profilePopups.has(profileId)) profilePopups.set(profileId, new Set());
  const set = profilePopups.get(profileId);
  set.add(popup);
  popup.on('closed', () => {
    set.delete(popup);
    if (set.size === 0) profilePopups.delete(profileId);
  });
}

function closeProfilePopups(profileId) {
  const set = profilePopups.get(profileId);
  if (!set) return;
  for (const popup of Array.from(set)) {
    if (!popup.isDestroyed()) popup.destroy();
  }
  profilePopups.delete(profileId);
}

function loadRendererPage(win, page) {
  if (IS_DEV) {
    win.loadURL(`${DEV_SERVER_URL}/${page}`);
  } else {
    win.loadFile(path.join(DIST_DIR, page));
  }
}

// ---------------------------------------------------------------------------
// Security: sessions, navigation guards, window-open policy
// ---------------------------------------------------------------------------

function hardenSession(profileSession) {
  // Deny sensitive hardware-ish permissions outright; everything else behaves
  // like a normal browser (user is prompted by Chromium where applicable).
  const denied = new Set(['usb', 'serial', 'hid', 'midiSysex', 'bluetooth']);
  profileSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(!denied.has(permission));
  });
  profileSession.setPermissionCheckHandler((webContents, permission) => !denied.has(permission));
}

function attachNavigationGuards(contents, profile) {
  // Only http(s) and the built-in start page may load in a profile view.
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, startPageFileUrl)) {
      event.preventDefault();
      notifyChrome(contents, 'chrome:toast', {
        message: 'این پیوند مسدود شد چون از یک شمای نشانی پشتیبانی‌نشده استفاده می‌کند.',
        tone: 'error',
      });
    }
  });

  contents.setWindowOpenHandler(({ url, features, disposition }) =>
    handleProfileWindowOpen(profile, url, features, disposition)
  );

  // The <webview> tag must never be used to bypass our session assignment.
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function handleProfileWindowOpen(profile, url, features) {
  if (!isAllowedExternal(url)) {
    return { action: 'deny' };
  }
  createProfilePopup(profile, { url, features });
  return { action: 'deny' }; // we open our own session-scoped window instead
}

/** Push loading/url/title/history state from the page view into the chrome UI. */
function attachStateForwarding(contents, record) {
  const send = () => sendChromeState(record);
  contents.on('did-start-loading', send);
  contents.on('did-stop-loading', send);
  contents.on('did-navigate', send);
  contents.on('did-navigate-in-page', send);
  contents.on('page-title-updated', send);
  contents.on('did-finish-load', send);
  contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return; // ERR_ABORTED — normal during redirects/stop
    send();
    try {
      record.win.webContents.send('chrome:toast', {
        message: `بارگذاری صفحه ممکن نشد (${errorDescription || errorCode}). نشانی و اتصال خود را بررسی کنید.`,
        tone: 'error',
      });
    } catch {
      /* window already gone */
    }
  });
  contents.on('render-process-gone', (event, details) => {
    try {
      record.win.webContents.send('chrome:crashed', { reason: details?.reason || 'unknown' });
    } catch {
      /* window already gone */
    }
  });
}

function sendChromeState(record) {
  try {
    if (record.win.isDestroyed()) return;
    const contents = record.view.webContents;
    const history = contents.navigationHistory;
    const canGoBack = history?.canGoBack?.() ?? (typeof contents.canGoBack === 'function' ? contents.canGoBack() : false);
    const canGoForward =
      history?.canGoForward?.() ?? (typeof contents.canGoForward === 'function' ? contents.canGoForward() : false);
    const rawUrl = contents.getURL();
    record.win.webContents.send('chrome:state', {
      url: rawUrl,
      displayUrl: displayUrlFor(rawUrl),
      title: contents.getTitle(),
      isLoading: contents.isLoading(),
      canGoBack,
      canGoForward,
    });
    const pageTitle = contents.getTitle();
    record.win.setTitle(pageTitle ? `${pageTitle} · ${record.profile.name} — تکنوبروز` : `${record.profile.name} — تکنوبروز`);
  } catch {
    /* window mid-teardown */
  }
}

function displayUrlFor(url) {
  // Show a friendly pseudo-URL for the built-in start page.
  if (url && url.startsWith('file://') && normalizeFileForCompare(url) === normalizeFileForCompare(startPageFileUrl)) {
    return 'technobrowse://start';
  }
  return url || '';
}

function normalizeFileForCompare(url) {
  try {
    let p = fileURLToPath(url).replace(/\\/g, '/');
    if (p.endsWith('/')) p = p.slice(0, -1);
    return p.toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

function notifyChrome(contents, channel, payload) {
  // Find the record whose *page* webContents matches, else fall back to any sender match.
  for (const record of profileWindows.values()) {
    if (record.view.webContents === contents) {
      try {
        record.win.webContents.send(channel, payload);
      } catch {
        /* window gone */
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Profile deletion: metadata + Chromium partition wiped together, atomically enough for a desktop app.
// ---------------------------------------------------------------------------

async function deleteProfileCompletely(id) {
  // 1. Close every window belonging to this profile (main window + popups).
  closeProfilePopups(id);
  const record = profileWindows.get(id);
  if (record) {
    chromeSenders.delete(record.win.webContents.id);
    profileWindows.delete(id);
    try {
      record.win.destroy();
    } catch {
      /* already gone */
    }
  }
  // Give Chromium a beat to release file handles before wiping the partition.
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 2. Remove metadata (throws if missing — caller surfaces the error).
  const removed = await store.remove(id);

  // 3. Wipe the persistent session: cookies, storage, cache, auth caches, then the on-disk partition folder.
  await wipeProfilePartition(id);

  return removed;
}

async function wipeProfilePartition(id) {
  const partitionName = `profile-${id}`; // folder name used by persist: partitions
  try {
    const ses = session.fromPartition(partitionFor(id));
    await ses.clearStorageData(); // cookies, localStorage, sessionStorage, IndexedDB, service workers, cacheStorage...
    await ses.clearCache();
    await ses.clearAuthCache();
    try {
      await ses.clearHostResolverCache();
    } catch {
      /* older Electron */
    }
    try {
      if (typeof ses.clearCodeCaches === 'function') await ses.clearCodeCaches({});
    } catch {
      /* not supported everywhere */
    }
    if (typeof ses.flushStorageData === 'function') {
      try {
        await ses.flushStorageData();
      } catch {
        /* ignore */
      }
    }
  } catch (error) {
    process.stderr.write(`[technobrowse] session clear for profile ${id} failed: ${error.message}\n`);
  }

  const partitionDir = path.join(app.getPath('sessionData'), 'Partitions', partitionName);
  try {
    await fs.promises.rm(partitionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    // Not fatal: clearStorageData already emptied the data Chromium knows about.
    process.stderr.write(`[technobrowse] could not remove partition dir ${partitionDir}: ${error.message}\n`);
  }
}

// ---------------------------------------------------------------------------
// IPC — dashboard
// ---------------------------------------------------------------------------

function broadcastProfilesChanged() {
  for (const win of dashboardWindows) {
    try {
      win.webContents.send('profiles:changed');
    } catch {
      /* window gone */
    }
  }
}

function registerDashboardIpc() {
  ipcMain.handle('profiles:list', async () => store.list());

  ipcMain.handle('profiles:create', async (_event, payload) => {
    const profile = await store.create(payload ?? {});
    broadcastProfilesChanged();
    return profile;
  });

  ipcMain.handle('profiles:update', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    const profile = await store.update(id, payload ?? {});
    // Keep the record + title in any open window in sync.
    const record = profileWindows.get(id);
    if (record) {
      record.profile = { ...record.profile, ...profile };
      sendChromeState(record);
    }
    broadcastProfilesChanged();
    return profile;
  });

  ipcMain.handle('profiles:delete', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    if (!/^[a-z0-9-]{4,64}$/i.test(id)) throw new Error('شناسهٔ پروفایل نامعتبر است.');
    await deleteProfileCompletely(id);
    broadcastProfilesChanged();
    return { ok: true };
  });

  ipcMain.handle('profiles:open', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    const profile = await store.get(id);
    if (!profile) throw new Error('پروفایل یافت نشد. شاید حذف شده باشد.');
    const result = createProfileWindow(profile);
    broadcastProfilesChanged();
    return result;
  });

  ipcMain.handle('app:info', async () => {
    const profiles = await store.list();
    return {
      version: app.getVersion(),
      dataRoot: storage.dataRoot,
      sessionData: app.getPath('sessionData'),
      portable: storage.portable,
      profileCount: profiles.length,
      partitionPrefix: PROFILE_PARTITION_PREFIX,
    };
  });

  ipcMain.handle('app:open-data-root', async () => {
    try {
      const { shell } = require('electron');
      const error = await shell.openPath(storage.dataRoot);
      return error ? { error } : { ok: true };
    } catch (error) {
      return { error: error?.message || 'باز کردن پوشهٔ داده ممکن نشد.' };
    }
  });
}

// ---------------------------------------------------------------------------
// IPC — browser chrome (toolbar)
// ---------------------------------------------------------------------------

function recordFromChromeSender(sender) {
  const profileId = chromeSenders.get(sender.id);
  if (!profileId) return null;
  const record = profileWindows.get(profileId);
  if (!record) return null;
  return record;
}

function registerChromeIpc() {
  ipcMain.handle('chrome:ready', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) throw new Error('این نوار ابزار به پروفایلی متصل نیست.');
    sendChromeState(record);
    return {
      id: record.profile.id,
      name: record.profile.name,
      email: record.profile.email,
      color: record.profile.color,
      partition: partitionFor(record.profile.id),
    };
  });

  ipcMain.handle('chrome:navigate', async (event, payload) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return { ok: false, error: 'پنجرهٔ پروفایلی متصل نیست.' };
    const normalized = normalizeUserUrl(payload?.input ?? '');
    if (!normalized.ok) return normalized;
    try {
      await record.view.webContents.loadURL(normalized.url);
      sendChromeState(record);
      return { ok: true, url: normalized.url, isSearch: normalized.isSearch === true };
    } catch (error) {
      return { ok: false, error: error?.message || 'ناوبری انجام نشد.' };
    }
  });

  ipcMain.handle('chrome:go-back', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    const contents = record.view.webContents;
    const history = contents.navigationHistory;
    if (history?.canGoBack?.()) history.goBack();
    else if (typeof contents.canGoBack === 'function' && contents.canGoBack()) contents.goBack();
  });

  ipcMain.handle('chrome:go-forward', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    const contents = record.view.webContents;
    const history = contents.navigationHistory;
    if (history?.canGoForward?.()) history.goForward();
    else if (typeof contents.canGoForward === 'function' && contents.canGoForward()) contents.goForward();
  });

  ipcMain.handle('chrome:reload', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    record.view.webContents.reload();
  });

  ipcMain.handle('chrome:go-home', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    await record.view.webContents.loadFile(startPagePath);
    sendChromeState(record);
  });

  ipcMain.handle('chrome:toggle-devtools', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    const contents = record.view.webContents;
    if (contents.isDevToolsOpened()) contents.closeDevTools();
    else contents.openDevTools({ mode: 'detach' });
  });

  ipcMain.handle('chrome:set-toolbar-height', async (event, payload) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    const height = Math.round(Number(payload?.height));
    if (!Number.isFinite(height)) return;
    record.toolbarHeight = Math.min(168, Math.max(40, height));
    const [width, contentHeight] = record.win.getContentSize();
    const top = record.toolbarHeight + TAB_BAR_HEIGHT;
    record.view.setBounds({
      x: 0,
      y: top,
      width: Math.max(0, width),
      height: Math.max(0, contentHeight - top),
    });
  });

  ipcMain.handle('chrome:focus-url', async (event) => {
    const record = recordFromChromeSender(event.sender);
    if (!record) return;
    sendChromeState(record);
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

const SMOKE_TEST = process.env.TECHNOBROWSE_SMOKE_TEST === '1';

app.whenReady().then(async () => {
  registerDashboardIpc();
  registerChromeIpc();
  createDashboardWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });

  if (SMOKE_TEST) {
    // Headless-CI style sanity check: create data, open+close a profile window, then exit.
    setTimeout(async () => {
      let ok = true;
      try {
        const profiles = await store.list();
        process.stdout.write(`SMOKE_TEST profiles=${profiles.length} dataRoot=${storage.dataRoot}\n`);
        process.stdout.write('SMOKE_TEST OK\n');
      } catch (error) {
        ok = false;
        process.stderr.write(`SMOKE_TEST FAILED: ${error.message}\n`);
      } finally {
        process.exit(ok ? 0 : 1);
      }
    }, 2500);
  }
});

app.on('second-instance', () => {
  const [win] = dashboardWindows;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    createDashboardWindow();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  // Blanket defense in depth: no <webview> attachments anywhere.
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

// Surface unexpected errors instead of dying silently.
process.on('uncaughtException', (error) => {
  process.stderr.write(`[technobrowse] uncaughtException: ${error?.stack || error}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[technobrowse] unhandledRejection: ${reason?.stack || reason}\n`);
});
