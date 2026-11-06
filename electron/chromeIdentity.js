'use strict';

/**
 * The User-Agent that profile browsing sessions present to websites.
 *
 * Why: Google's sign-in pages (and other bot-sensitive services) refuse to
 * render for embedded browsers — the page says "The browser you're using
 * doesn't support JavaScript, or has JavaScript turned off." whenever the UA
 * advertises Electron. Electron's Chromium IS a stock desktop Chromium, so we
 * present exactly that — nothing more, nothing less.
 *
 * The Chrome version is taken from process.versions.chrome so the UA always
 * matches the engine actually running (UA sniffing stays truthful).
 */
function buildDesktopChromeUserAgent(platform = process.platform, chromeVersion = process.versions.chrome) {
  const osToken =
    platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10_15_7'
        : 'X11; Linux x86_64';
  const version = /^\d+\.\d+\.\d+\.\d+$/.test(String(chromeVersion ?? '')) ? String(chromeVersion) : '142.0.0.0';
  return `Mozilla/5.0 (${osToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

const DESKTOP_CHROME_USER_AGENT = buildDesktopChromeUserAgent();

module.exports = { buildDesktopChromeUserAgent, DESKTOP_CHROME_USER_AGENT };
