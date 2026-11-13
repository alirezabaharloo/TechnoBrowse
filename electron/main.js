'use strict';

/**
 * TechnoBrowse — main process.
 *
 * TechnoBrowse is NOT a browser. It is a lightweight manager for Google Chrome
 * profiles: it creates/lists/renames/deletes profiles and launches real Chrome
 * with a per-profile user-data directory. Chrome then owns everything that
 * matters for the web pages — rendering, JavaScript, authentication, cookies,
 * localStorage, IndexedDB, sessions, cache.
 *
 *   <dataRoot>/profiles.json              — metadata ONLY (no website data)
 *   <dataRoot>/profiles/profile-<id>/     — one dedicated Chrome user-data-dir
 *                                            per profile, nothing else shared
 *
 * No WebContentsView, no sessions, no embedded engine, no cookie access.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { resolveDataRoot } = require('./paths');
const { ProfileStore, resolveProfileDataDir } = require('./profileStore');
const {
  CHROME_DOWNLOAD_URL,
  buildChromeLaunchArgs,
  detectChrome,
} = require('./chromeDetect');

// --- 1. Resolve storage locations BEFORE anything else touches disk. ---
const storage = resolveDataRoot(app); // sets userData to the portable-aware data root
const store = new ProfileStore(storage.profilesFile);

// --- 2. Single instance: re-focus the dashboard instead of fighting over profiles.json. ---
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const IS_DEV = Boolean(DEV_SERVER_URL);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const APP_ICON = (() => {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'dist', 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
})();

const dashboardWindows = new Set();

/** profileId -> pid of the Chrome we launched (in-memory; the OS is the source of truth). */
const launchedChrome = new Map();

let chromeStatusCache = null; // lazy; cleared when the user asks for a re-check

// ---------------------------------------------------------------------------
// Chrome detection (never automatic-install; never a fallback engine)
// ---------------------------------------------------------------------------

function getChromeStatus() {
  if (!chromeStatusCache) chromeStatusCache = detectChrome();
  return chromeStatusCache;
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM'; // exists but owned by someone else
  }
}

/** True when THIS app launched Chrome for the profile and it still looks alive. */
function isLaunchedByUs(id) {
  const pid = launchedChrome.get(id);
  return pid !== undefined && isPidAlive(pid);
}

/** Chrome drops a SingletonLock in the user-data-dir while it is in use. */
function singletonLockExists(absoluteDir) {
  try {
    return fs.existsSync(path.join(absoluteDir, 'SingletonLock'));
  } catch {
    return false;
  }
}

/** Conservative check used before DESTRUCTIVE operations (delete). */
function isProfileInUse(absoluteDir, id) {
  return isLaunchedByUs(id) || singletonLockExists(absoluteDir);
}

// ---------------------------------------------------------------------------
// Window creation (the dashboard is the ONLY window this app creates)
// ---------------------------------------------------------------------------

function baseWebPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
    preload: path.join(__dirname, 'preload.js'),
  };
}

/** The dashboard may only ever load our bundled page or the dev server. */
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
    title: 'TechnoBrowse',
    autoHideMenuBar: true,
    ...(APP_ICON ? { icon: APP_ICON } : {}),
    webPreferences: baseWebPreferences(),
  });

  dashboardWindows.add(win);
  win.on('closed', () => dashboardWindows.delete(win));
  win.once('ready-to-show', () => win.show());

  // The dashboard never opens windows; Chrome owns actual browsing.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  guardAppWindowNavigation(win);

  if (IS_DEV) {
    win.loadURL(`${DEV_SERVER_URL}/index.html`);
  } else {
    win.loadFile(path.join(DIST_DIR, 'index.html'));
  }
  return win;
}

// ---------------------------------------------------------------------------
// Profile lifecycle
// ---------------------------------------------------------------------------

async function profilesWithStatus() {
  const list = await store.list();
  return list.map((profile) => {
    let absoluteDir = null;
    try {
      absoluteDir = resolveProfileDataDir(storage.dataRoot, profile);
    } catch {
      absoluteDir = null;
    }
    return {
      ...profile,
      isRunning: absoluteDir ? isProfileInUse(absoluteDir, profile.id) : isLaunchedByUs(profile.id),
    };
  });
}

async function launchProfile(id) {
  const profile = await store.get(id);
  if (!profile) throw new Error('پروفایل یافت نشد. شاید حذف شده باشد.');

  const status = getChromeStatus();
  if (!status.found) {
    const error = new Error(
      'Google Chrome پیدا نشد. برای باز کردن پروفایل‌ها باید Google Chrome نصب باشد.'
    );
    error.code = 'CHROME_NOT_FOUND';
    throw error;
  }

  const absoluteDir = resolveProfileDataDir(storage.dataRoot, profile);
  fs.mkdirSync(absoluteDir, { recursive: true });

  // If we launched Chrome for this profile and it's still alive, don't spawn a
  // second process against the same user-data directory — ask the user to use
  // the existing window instead.
  if (isLaunchedByUs(profile.id)) {
    return { ok: true, reused: true };
  }

  // A stale SingletonLock (e.g. from a Chrome that was already running before
  // TechnoBrowse started) is NOT an error: Chrome forwards the invocation to
  // the existing instance and simply opens a new window there — it never
  // initializes the directory twice. Safe to spawn.
  const child = spawn(status.executablePath, buildChromeLaunchArgs(absoluteDir), {
    shell: false,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  if (typeof child.pid === 'number') {
    launchedChrome.set(profile.id, child.pid);
  }
  child.on('error', (error) => {
    launchedChrome.delete(profile.id);
    process.stderr.write(`[technobrowse] failed to launch Chrome: ${error.message}\n`);
  });

  await store.markOpened(profile.id);
  return { ok: true, reused: false, pid: child.pid ?? null };
}

async function deleteProfileCompletely(id) {
  const profile = await store.get(id);
  if (!profile) throw new Error('پروفایل یافت نشد. شاید قبلاً حذف شده باشد.');

  const absoluteDir = resolveProfileDataDir(storage.dataRoot, profile);
  if (isProfileInUse(absoluteDir, id)) {
    throw new Error(
      `پروفایل «${profile.name}» در حال اجراست. ابتدا پنجرهٔ Google Chrome مربوط به این پروفایل را ببندید و دوباره تلاش کنید.`
    );
  }

  // 1. Remove metadata first (throws if missing — caller surfaces the error).
  const removed = await store.remove(id);

  // 2. Wipe ONLY this profile's Chrome user-data directory (cookies, storage,
  //    sessions, cache, prefs — Chrome manages it; we remove the folder).
  try {
    await fs.promises.rm(absoluteDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    // Metadata is gone; the leftover directory is harmless garbage on disk.
    process.stderr.write(`[technobrowse] could not remove ${absoluteDir}: ${error.message}\n`);
  }

  launchedChrome.delete(id);
  return removed;
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
  ipcMain.handle('profiles:list', async () => profilesWithStatus());

  ipcMain.handle('profiles:create', async (_event, payload) => {
    const profile = await store.create(payload ?? {});
    // Create the Chrome user-data directory eagerly so it always exists.
    try {
      fs.mkdirSync(resolveProfileDataDir(storage.dataRoot, profile), { recursive: true });
    } catch (error) {
      process.stderr.write(`[technobrowse] could not create profile directory: ${error.message}\n`);
    }
    broadcastProfilesChanged();
    return profile;
  });

  ipcMain.handle('profiles:update', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    const profile = await store.update(id, payload ?? {});
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

  ipcMain.handle('profiles:set-ai-limit', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    if (!/^[a-z0-9-]{4,64}$/i.test(id)) throw new Error('شناسهٔ پروفایل نامعتبر است.');
    // The main process owns the clock — the timestamp is exactly "now",
    // never a renderer-supplied value.
    const reachedAt = payload?.enabled === true ? Date.now() : null;
    const updated = await store.setAiLimit(id, reachedAt);
    broadcastProfilesChanged();
    return updated;
  });

  ipcMain.handle('profiles:open', async (_event, payload) => {
    const id = String(payload?.id ?? '');
    if (!/^[a-z0-9-]{4,64}$/i.test(id)) throw new Error('شناسهٔ پروفایل نامعتبر است.');
    const result = await launchProfile(id);
    broadcastProfilesChanged();
    return result;
  });

  ipcMain.handle('app:info', async () => {
    const profiles = await store.list();
    const chrome = getChromeStatus();
    return {
      version: app.getVersion(),
      dataRoot: storage.dataRoot,
      portable: storage.portable,
      profileCount: profiles.length,
      chromeFound: chrome.found === true,
    };
  });

  ipcMain.handle('app:chrome-status', async () => getChromeStatus());

  ipcMain.handle('app:refresh-chrome', async () => {
    chromeStatusCache = null;
    return getChromeStatus();
  });

  ipcMain.handle('app:open-chrome-download', async () => {
    // Opened ONLY from an explicit click in the UI; never automatically.
    await shell.openExternal(CHROME_DOWNLOAD_URL);
    return { ok: true };
  });

  ipcMain.handle('app:open-data-root', async () => {
    try {
      const error = await shell.openPath(storage.dataRoot);
      return error ? { error } : { ok: true };
    } catch (error) {
      return { error: error?.message || 'باز کردن پوشهٔ داده ممکن نشد.' };
    }
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

const SMOKE_TEST = process.env.TECHNOBROWSE_SMOKE_TEST === '1';

app.whenReady().then(async () => {
  registerDashboardIpc();
  createDashboardWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
  });

  if (SMOKE_TEST) {
    setTimeout(async () => {
      let ok = true;
      try {
        const profiles = await store.list();
        const chrome = getChromeStatus();
        process.stdout.write(`SMOKE_TEST profiles=${profiles.length} dataRoot=${storage.dataRoot} chromeFound=${chrome.found}\n`);
        process.stdout.write('SMOKE_TEST OK\n');
      } catch (error) {
        ok = false;
        process.stderr.write(`SMOKE_TEST FAILED: ${error.message}\n`);
      } finally {
        process.exit(ok ? 0 : 1);
      }
    }, 1500);
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

process.on('uncaughtException', (error) => {
  process.stderr.write(`[technobrowse] uncaughtException: ${error?.stack || error}\n`);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[technobrowse] unhandledRejection: ${reason?.stack || reason}\n`);
});


// redirect PromoBanner icons to specify link
ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Invalid URL');
  }

  await shell.openExternal(url);
});