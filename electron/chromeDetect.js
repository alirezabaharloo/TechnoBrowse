'use strict';

/**
 * Google Chrome detection + launch-argument construction.
 *
 * TechnoBrowse launches the REAL desktop Google Chrome with a per-profile
 * user-data directory. Chrome — not Electron — renders pages, runs JavaScript,
 * and owns every session, cookie and credential. This is deliberate: Google
 * signs you in correctly in a first-class browser, and no isolation depends on
 * an embedded engine.
 *
 * Resolution order:
 *   1. TECHNOBROWSE_CHROME_PATH environment variable (explicit override, e.g.
 *      for testing or non-standard installs). Must point at a Chrome executable.
 *   2. Well-known install locations (Program Files / LOCALAPPDATA on Windows,
 *      /Applications on macOS, google-chrome* on PATH for Linux dev).
 *   3. The Windows registry ("App Paths" — the same lookup Windows itself uses
 *      for `start chrome`), then the WOW6432Node InstallLocation.
 *
 * If Chrome cannot be found the app says so and refuses to fall back to any
 * embedded browser — it never silently pretends to be a browser.
 *
 * This module has no Electron imports so its pure helpers are unit-testable.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

/** Official download page — opened ONLY from an explicit user action. */
const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/';

/**
 * Arguments for a profile launch. `shell: false` and an argument ARRAY are
 * mandatory at the call site — never string-concatenate a command line.
 *   --user-data-dir   → full profile isolation (cookies, cache, prefs, …)
 *   --new-window      → always open a fresh window
 *   --no-first-run / --no-default-browser-check → no onboarding nags
 */
function buildChromeLaunchArgs(userDataDir) {
  if (typeof userDataDir !== 'string' || !userDataDir) {
    throw new Error('user-data-dir is required to launch Chrome');
  }
  return [
    `--user-data-dir=${userDataDir}`,
    '--new-window',
    '--no-first-run',
    '--no-default-browser-check',
  ];
}

const WIN_RELATIVE = path.join('Google', 'Chrome', 'Application', 'chrome.exe');

/** Well-known executable locations per platform. Existence is verified later. */
function candidatePaths(platform = process.platform, env = process.env, homedir = os.homedir()) {
  const out = [];
  if (platform === 'win32') {
    if (env.PROGRAMFILES) out.push(path.join(env.PROGRAMFILES, WIN_RELATIVE));
    if (env['PROGRAMFILES(X86)']) out.push(path.join(env['PROGRAMFILES(X86)'], WIN_RELATIVE));
    if (env.LOCALAPPDATA) out.push(path.join(env.LOCALAPPDATA, WIN_RELATIVE));
    return out;
  }
  if (platform === 'darwin') {
    out.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    out.push(path.join(homedir, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
    return out;
  }
  // Linux (developer convenience): google-chrome on PATH via execFile('which', …)
  try {
    const p = execFileSync('which', ['google-chrome'], { encoding: 'utf8', windowsHide: true }).trim();
    if (p) out.push(p);
  } catch { /* not on PATH */ }
  out.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');
  return out;
}

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a Chrome executable path from `reg query` output.
 * Handles both plain paths and quoted paths, REG_SZ and REG_EXPAND_SZ,
 * and InstallLocation-style directory values (chrome.exe is appended).
 */
function parseRegistryOutput(output) {
  if (!output) return null;
  for (const rawLine of String(output).split(/\r?\n/)) {
    const match = rawLine.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)$/);
    if (!match) continue;
    let value = match[1].trim().replace(/^"(.*)"$/, '$1').trim();
    // Expand %VARS% (common in REG_EXPAND_SZ output).
    value = value.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`);
    if (/chrome(64)?\.exe$/i.test(value)) {
      return value;
    }
    // InstallLocation-style directory value — Chrome lives at <dir>\chrome.exe
    const asDir = value.replace(/[\\/]+$/, '');
    if (/application$/i.test(asDir) || /google[\\/]chrome$/i.test(asDir)) {
      return path.join(asDir, 'chrome.exe');
    }
  }
  return null;
}

/** Query the Windows registry for a Chrome path. Returns null when not found. */
function windowsRegistryLookup(run = execFileSync) {
  const queries = [
    ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve'],
    ['HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', '/ve'],
    ['HKLM\\SOFTWARE\\WOW6432Node\\Google\\Chrome\\Application', 'InstallLocation'],
  ];
  for (const [key, valueOrFlag] of queries) {
    try {
      const args = valueOrFlag === '/ve' ? ['query', key, '/ve'] : ['query', key, '/v', valueOrFlag];
      const output = run('reg.exe', args, { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const parsed = parseRegistryOutput(output);
      if (parsed && isExecutableFile(parsed)) return parsed;
    } catch {
      // key missing / reg.exe unavailable — try the next one
    }
  }
  return null;
}

/**
 * Detect Google Chrome on this machine.
 * @returns {{ found: true, executablePath: string, source: string } | { found: false, error: string }}
 */
function detectChrome({ env = process.env, platform = process.platform, run = execFileSync } = {}) {
  // 1. Explicit override always wins (and must be real).
  const override = env.TECHNOBROWSE_CHROME_PATH;
  if (override && isExecutableFile(override)) {
    return { found: true, executablePath: override, source: 'env' };
  }

  // 2. Well-known locations.
  for (const candidate of candidatePaths(platform, env)) {
    if (isExecutableFile(candidate)) {
      return { found: true, executablePath: candidate, source: 'path' };
    }
  }

  // 3. Windows registry.
  if (platform === 'win32') {
    const fromRegistry = windowsRegistryLookup(run);
    if (fromRegistry) return { found: true, executablePath: fromRegistry, source: 'registry' };
  }

  return {
    found: false,
    error: 'گوگل کروم نصب نیست؛ برای باز کردن مرورگرها اول باید Chrome رو نصب کنی.',
  };
}

module.exports = {
  CHROME_DOWNLOAD_URL,
  buildChromeLaunchArgs,
  candidatePaths,
  parseRegistryOutput,
  isExecutableFile,
  detectChrome,
};
