'use strict';

/**
 * URL helpers for the browser chrome.
 * Kept free of Electron imports so they can be unit-tested with plain node.
 */

const SEARCH_URL = 'https://www.google.com/search?q=';

/** URL schemes that may never be navigated to from a profile window. */
const BLOCKED_SCHEMES = new Set([
  'javascript',
  'data',
  'vbscript',
  'file', // file:// is used internally for the built-in start page only; never from user input
  'about',
  'chrome',
  'devtools',
  'view-source',
]);

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * Normalize free-typed address-bar input into a navigable http(s) URL.
 * Falls back to a Google search when the input does not look like a host.
 *
 * @param {string} raw
 * @returns {{ ok: true, url: string, isSearch: boolean } | { ok: false, error: string }}
 */
function normalizeUserUrl(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return { ok: false, error: 'Type a URL or search term first.' };
  if (input.length > 2048) return { ok: false, error: 'That address is too long.' };
  if (/[\0\r\n]/.test(input)) return { ok: false, error: 'That address contains invalid characters.' };

  const schemeMatch = input.match(SCHEME_RE);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (BLOCKED_SCHEMES.has(scheme)) {
      return { ok: false, error: `Blocked "${scheme}:" URLs for security reasons.` };
    }
    if (scheme !== 'http' && scheme !== 'https') {
      return { ok: false, error: `Unsupported scheme "${scheme}:". Only http:// and https:// are supported.` };
    }
    try {
      const parsed = new URL(input);
      if (!parsed.hostname) return { ok: false, error: 'That URL has no host.' };
      return { ok: true, url: parsed.toString(), isSearch: false };
    } catch {
      return { ok: false, error: 'That URL is not valid.' };
    }
  }

  // No explicit scheme. Does it look like a host?
  //   localhost[:port] · 127.0.0.1[:port] · [::1][:port] · example.com · sub.example.co.uk/path?q=1
  const hostCandidate =
    /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[[0-9a-fA-F:.%]+\])(:\d{1,5})?([/?#]\S*)?$/i.test(input) ||
    /^[^\s/?#]+\.[^\s/?#]{2,}(:\d{1,5})?([/?#]\S*)?$/i.test(input);

  if (hostCandidate) {
    try {
      const parsed = new URL(`https://${input}`);
      if (parsed.port && Number(parsed.port) > 65535) {
        return { ok: false, error: 'That port number is not valid.' };
      }
      return { ok: true, url: parsed.toString(), isSearch: false };
    } catch {
      // fall through to search
    }
  }

  return { ok: true, url: SEARCH_URL + encodeURIComponent(input), isSearch: true };
}

/**
 * True when the URL may be loaded inside a profile view:
 * http/https anywhere, or the exact built-in start page file.
 * @param {string} url
 * @param {string} [startPageFileUrl] file:/// URL of the built-in start page
 */
function isAllowedNavigation(url, startPageFileUrl) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') return true;
    if (protocol === 'file:' && startPageFileUrl) {
      return normalizeFileUrl(url) === normalizeFileUrl(startPageFileUrl);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * True when the URL may be opened in a new (profile-scoped) popup window.
 */
function isAllowedExternal(url) {
  try {
    const protocol = new URL(url).protocol.toLowerCase();
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeFileUrl(url) {
  // Case-insensitive, trailing-slash tolerant compare for file URLs.
  try {
    const parsed = new URL(url);
    let pathname = decodeURIComponent(parsed.pathname).replace(/\\/g, '/');
    if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return pathname.toLowerCase();
  } catch {
    return String(url).toLowerCase();
  }
}

/**
 * Parse popup window features ("width=520,height=640,left=100,top=120,toolbar=no").
 * @returns {{ width: number, height: number, x?: number, y?: number }}
 */
function parsePopupFeatures(features) {
  const result = { width: 560, height: 680 };
  if (!features) return result;
  const map = {};
  for (const part of String(features).split(',')) {
    const [key, value] = part.split('=');
    if (key && value) map[key.trim().toLowerCase()] = value.trim();
  }
  const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const w = num(map.width);
  const h = num(map.height);
  if (w) result.width = clamp(w, 480, 1400);
  if (h) result.height = clamp(h, 360, 1000);
  const x = num(map.left ?? map.screenx);
  const y = num(map.top ?? map.screeny);
  if (x !== undefined) result.x = Math.max(0, x);
  if (y !== undefined) result.y = Math.max(0, y);
  return result;
}

module.exports = {
  normalizeUserUrl,
  isAllowedNavigation,
  isAllowedExternal,
  parsePopupFeatures,
  SEARCH_URL,
};
