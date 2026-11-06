'use strict';

/**
 * Data-directory resolution for TechnoBrowse.
 *
 * TechnoBrowse is a profile MANAGER for Google Chrome — it no longer embeds a
 * browser engine of its own, so Website storage (cookies, localStorage,
 * IndexedDB, cache) lives entirely inside each profile's private
 * Chrome user-data directory, which is created lazily on first launch.
 *
 * Layout produced:
 *   <dataRoot>/profiles.json         — profile metadata ONLY (no website data)
 *   <dataRoot>/profiles/profile-<id>/ — one dedicated Chrome user-data directory
 *                                        per profile (created on first launch)
 *
 * Where <dataRoot> is:
 *   1. Next to the portable executable (electron-builder "portable" target sets
 *      PORTABLE_EXECUTABLE_DIR) — only if that directory is writable.
 *   2. The per-user data directory (%APPDATA%/TechnoBrowse on Windows) otherwise.
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
 * Resolve and apply the data-root location.
 * @param {import('electron').App} app
 * @returns {{ dataRoot: string, profilesDir: string, profilesFile: string, portable: boolean }}
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
      const profilesDir = path.join(dataRoot, 'profiles');
      try {
        fs.mkdirSync(profilesDir, { recursive: true });
        app.setPath('userData', dataRoot);
        return {
          dataRoot,
          profilesDir,
          profilesFile: path.join(dataRoot, 'profiles.json'),
          portable: candidate.portable,
        };
      } catch {
        // fall through to the next candidate
      }
    }
  }

  throw new Error(
    'TechnoBrowse نتوانست پوشهٔ دادهٔ قابل‌نوشتنی پیدا کند. ' +
      'نسخهٔ پرتابل را به پوشه‌ای قابل‌نوشتن (مثلاً دسکتاپ یا یک درایو اکسترنال) منتقل کنید و دوباره تلاش کنید.'
  );
}

module.exports = { resolveDataRoot, isWritableDir };
