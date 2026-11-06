'use strict';

/**
 * Data-directory resolution for TechnoBrowse.
 *
 * IMPORTANT: this must run BEFORE the app is ready and BEFORE any
 * session.fromPartition('persist:...') call, so Chromium stores every
 * profile's partition inside our chosen directory.
 *
 * Resolution order:
 *   1. Next to the portable executable (electron-builder "portable" target sets
 *      PORTABLE_EXECUTABLE_DIR) — only if that directory is writable.
 *   2. The per-user data directory (%APPDATA%/TechnoBrowse on Windows).
 *
 * Layout produced:
 *   <dataRoot>/profiles.json          — profile metadata ONLY (no cookies/passwords)
 *   <dataRoot>/user-data/Partitions/* — Chromium storage (cookies, localStorage,
 *                                       IndexedDB, cache, ...) one folder per
 *                                       persistent session partition.
 */

const fs = require('fs');
const path = require('path');

function isWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.technobrowse-write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve and apply the userData / sessionData paths.
 * @param {import('electron').App} app
 * @returns {{ dataRoot: string, sessionData: string, profilesFile: string, portable: boolean }}
 */
function resolveDataRoot(app) {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR; // set by electron-builder portable target
  const defaultUserData = app.getPath('userData');

  const candidates = [];
  if (portableDir) candidates.push({ dir: portableDir, portable: true });
  candidates.push({ dir: defaultUserData, portable: false });

  for (const candidate of candidates) {
    if (isWritableDir(candidate.dir)) {
      const dataRoot = candidate.dir;
      const sessionData = path.join(dataRoot, 'user-data');
      try {
        fs.mkdirSync(sessionData, { recursive: true });
        app.setPath('userData', dataRoot);
        app.setPath('sessionData', sessionData);
        return {
          dataRoot,
          sessionData,
          profilesFile: path.join(dataRoot, 'profiles.json'),
          portable: candidate.portable,
        };
      } catch {
        // fall through to the next candidate
      }
    }
  }

  throw new Error(
    'تکنوبروز نتوانست پوشهٔ دادهٔ قابل‌نوشتنی پیدا کند. ' +
      'نسخهٔ پرتابل را به پوشه‌ای قابل‌نوشتن (مثلاً دسکتاپ یا یک درایو اکسترنال) منتقل کنید و دوباره تلاش کنید.'
  );
}

module.exports = { resolveDataRoot, isWritableDir };
