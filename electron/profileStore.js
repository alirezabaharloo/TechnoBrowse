'use strict';

/**
 * Profile metadata store.
 *
 * Persists ONLY metadata (name, optional email label, timestamps, id) in a
 * JSON file. Cookies, local storage, cache, IndexedDB and login sessions are
 * NEVER stored here — they live in the Chromium partition directories managed
 * by Electron sessions (see electron/main.js).
 *
 * This module has no Electron imports so it can be unit-tested with plain node.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_VERSION = 1;
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 120;

// Directory layout: <dataRoot>/profiles/profile-<id>/ (Chrome user-data-dir).
const PROFILE_DIR_RE = /^profiles\/profile-[a-z0-9-]{4,64}$/i;

const AVATAR_PALETTE = [
  'blue', 'violet', 'emerald', 'amber', 'rose',
  'cyan', 'fuchsia', 'lime', 'orange', 'teal',
];

class ProfileStore {
  /**
   * @param {string} filePath absolute path of profiles.json
   */
  constructor(filePath) {
    this.filePath = filePath;
    /** In-memory cache; always in sync after every mutation. @type {{version:number, profiles:Array<object>} | null} */
    this._cache = null;
    /** Serializes read-modify-write cycles so concurrent IPC calls can't corrupt the file. */
    this._queue = Promise.resolve();
  }

  // ---------------------------------------------------------------- public API

  /** @returns {Promise<Array<object>>} profiles, newest first */
  async list() {
    const data = await this._read();
    return data.profiles
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  /** @returns {Promise<object | null>} */
  async get(id) {
    const data = await this._read();
    return data.profiles.find((p) => p.id === id) ?? null;
  }

  /** @returns {Promise<object>} the created profile */
  async create(input) {
    const { name, email } = validateProfileInput(input, { partial: false });
    const id = generateProfileId();
    const now = new Date().toISOString();
    const profile = {
      id,
      name,
      email,
      color: AVATAR_PALETTE[crypto.randomInt(0, AVATAR_PALETTE.length)],
      createdAt: now,
      lastOpenedAt: null,
      directory: buildProfileDirectory(id),
    };
    await this._mutate((data) => {
      data.profiles.push(profile);
    });
    return profile;
  }

  /** @returns {Promise<object>} the updated profile */
  async update(id, input) {
    assertId(id);
    const { name, email } = validateProfileInput(input, { partial: true });
    let updated = null;
    await this._mutate((data) => {
      const profile = data.profiles.find((p) => p.id === id);
      if (!profile) throw new Error('پروفایل یافت نشد. شاید حذف شده باشد.');
      if (name !== undefined) profile.name = name;
      if (email !== undefined) profile.email = email;
      updated = { ...profile };
    });
    return updated;
  }

  /** Removes the profile metadata. @returns {Promise<object>} the removed profile */
  async remove(id) {
    assertId(id);
    let removed = null;
    await this._mutate((data) => {
      const index = data.profiles.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('پروفایل یافت نشد. شاید قبلاً حذف شده باشد.');
      removed = data.profiles[index];
      data.profiles.splice(index, 1);
    });
    return removed;
  }

  /** Updates lastOpenedAt; failures are non-fatal. */
  async markOpened(id) {
    try {
      await this._mutate((data) => {
        const profile = data.profiles.find((p) => p.id === id);
        if (profile) profile.lastOpenedAt = new Date().toISOString();
      });
    } catch {
      /* never block opening a profile because of a bookkeeping failure */
    }
  }

  /** Synchronous-ish helper used by the smoke test only. */
  async raw() {
    return this._read();
  }

  // --------------------------------------------------------------- internals

  async _read() {
    if (this._cache) return structuredCloneSafe(this._cache);
    const data = readFromDisk(this.filePath);
    this._cache = data;
    return structuredCloneSafe(data);
  }

  async _mutate(fn) {
    const run = async () => {
      const data = this._cache ? structuredCloneSafe(this._cache) : readFromDisk(this.filePath);
      fn(data);
      await atomicWrite(this.filePath, data);
      this._cache = data;
    };
    const next = this._queue.then(run, run);
    this._queue = next.catch(() => {});
    return next;
  }
}

// ------------------------------------------------------------------ helpers

/** Deterministic relative directory for a profile (POSIX-style, forward slashes). */
function buildProfileDirectory(id) {
  assertId(id);
  return `profiles/profile-${id}`;
}

/** Self-heal: any missing/invalid directory is replaced by the canonical one. */
function sanitizeProfileDirectory(dir, id) {
  const candidate = typeof dir === 'string' ? dir.trim().replace(/\\/g, '/') : '';
  if (PROFILE_DIR_RE.test(candidate)) return candidate;
  // Legacy profiles (pre-manager architecture) have no directory → assign one.
  try {
    return buildProfileDirectory(id);
  } catch {
    return undefined; // unusable entry; it will still be filtered by the id/name check above
  }
}

/**
 * Resolve a profile's Chrome user-data directory to an absolute path and prove
 * it stays inside <dataRoot>/profiles. Never trusts the stored string beyond
 * the strict regex, and never accepts renderer-supplied paths.
 */
function resolveProfileDataDir(dataRoot, profile) {
  const id = String(profile?.id ?? '');
  assertId(id);
  const relative = sanitizeProfileDirectory(profile?.directory, id);
  const profilesRoot = path.resolve(dataRoot, 'profiles');
  const absolute = path.resolve(dataRoot, relative);
  if (!absolute.startsWith(profilesRoot + path.sep)) {
    throw new Error('مسیر پوشهٔ پروفایل نامعتبر است.');
  }
  return absolute;
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateProfileId() {
  // Stable, unique, filesystem- and partition-name-safe.
  return crypto.randomBytes(9).toString('hex'); // 18 hex chars
}

function assertId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]{4,64}$/i.test(id)) {
    throw new Error('شناسهٔ پروفایل نامعتبر است.');
  }
}

/**
 * @param {unknown} input
 * @param {{ partial: boolean }} opts partial=true allows omitted fields
 */
function validateProfileInput(input, { partial }) {
  const source = (input && typeof input === 'object') ? input : {};
  const result = {};

  const hasName = Object.prototype.hasOwnProperty.call(source, 'name');
  const hasEmail = Object.prototype.hasOwnProperty.call(source, 'email');

  if (!partial || hasName) {
    const raw = String(source.name ?? '');
    // Reject control characters (tabs/newlines/etc.) before collapsing whitespace.
    // eslint-disable-next-line no-control-regex
    if (/[\0-\x1f\x7f]/.test(raw)) throw new Error('نام پروفایل شامل نویسهٔ نامعتبر است.');
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) throw new Error('لطفاً نام پروفایل را وارد کنید.');
    if (name.length > MAX_NAME_LENGTH) {
      throw new Error(`نام پروفایل باید حداکثر ${MAX_NAME_LENGTH} نویسه باشد.`);
    }
    result.name = name;
  }

  if (!partial || hasEmail) {
    const email = String(source.email ?? '').trim();
    if (!email) {
      result.email = '';
    } else {
      if (email.length > MAX_EMAIL_LENGTH) {
        throw new Error(`برچسب ایمیل باید حداکثر ${MAX_EMAIL_LENGTH} نویسه باشد.`);
      }
      // eslint-disable-next-line no-control-regex
      if (/[\0-\x1f\x7f]/.test(email)) throw new Error('برچسب ایمیل شامل نویسهٔ نامعتبر است.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('این نشانی ایمیل درست به نظر نمی‌رسد. مثال: name@gmail.com');
      }
      result.email = email.toLowerCase();
    }
  }

  return result;
}

function emptyData() {
  return { version: STORE_VERSION, profiles: [] };
}

/**
 * Read profiles.json tolerantly. A corrupt file is never fatal: it is backed
 * up next to the original and an empty store is returned, so the app still
 * starts (the Chromium partitions on disk are untouched).
 */
function readFromDisk(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return emptyData();
    throw error;
  }
  if (!raw.trim()) return emptyData();
  try {
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
    const clean = profiles
      .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string'
        && /^[a-z0-9-]{4,64}$/i.test(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: typeof p.email === 'string' ? p.email : '',
        color: typeof p.color === 'string' ? p.color : 'blue',
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        lastOpenedAt: typeof p.lastOpenedAt === 'string' ? p.lastOpenedAt : null,
        directory: sanitizeProfileDirectory(p.directory, p.id),
      }));
    return { version: STORE_VERSION, profiles: clean };
  } catch (error) {
    const backup = `${filePath}.corrupt-${Date.now()}.bak`;
    try {
      fs.copyFileSync(filePath, backup);
    } catch {
      /* best effort */
    }
    process.stderr.write(
      `[technobrowse] profiles.json was unreadable (${error.message}). ` +
        `Backed up to ${backup} and starting with an empty profile list.\n`
    );
    return emptyData();
  }
}

async function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.profiles-${process.pid}-${Date.now()}.tmp`);
  const payload = JSON.stringify({ version: STORE_VERSION, profiles: data.profiles }, null, 2);
  const handle = await fs.promises.open(tmp, 'w');
  try {
    await handle.writeFile(payload, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.promises.rename(tmp, filePath);
}

module.exports = {
  ProfileStore,
  validateProfileInput,
  generateProfileId,
  buildProfileDirectory,
  resolveProfileDataDir,
  PROFILE_DIR_RE,
};
