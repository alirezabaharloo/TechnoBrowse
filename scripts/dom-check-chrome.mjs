/**
 * DOM smoke checks for the browser chrome (toolbar) with a mocked Electron bridge.
 * Verifies: toolbar renders profile chip, address bar mirrors page state,
 * typing + Enter triggers navigation with the raw input, nav buttons call the bridge,
 * loading state is reflected, and the toolbar height is reported to the main process.
 * Run: npm run dom-check:chrome
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1/browser.html',
  pretendToBeVisual: true,
});
const { window } = dom;

const setGlobal = (key, value) =>
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
setGlobal('window', window);
setGlobal('document', window.document);
setGlobal('navigator', window.navigator);
setGlobal('HTMLElement', window.HTMLElement);
setGlobal('Element', window.Element);
setGlobal('Node', window.Node);
setGlobal('MouseEvent', window.MouseEvent);
setGlobal('KeyboardEvent', window.KeyboardEvent);
setGlobal('FocusEvent', window.FocusEvent ?? window.Event);
setGlobal('Event', window.Event);
setGlobal('CustomEvent', window.CustomEvent);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
setGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
setGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
class ResizeObserverStub {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {
    this.cb?.([{ contentRect: { height: 56 } }], this);
  }
  unobserve() {}
  disconnect() {}
}
setGlobal('ResizeObserver', ResizeObserverStub);
window.ResizeObserver = ResizeObserverStub;
// jsdom reports all-zero layout boxes; pretend the toolbar is 56px tall.
window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { height: 56, width: 1280, top: 0, left: 0, bottom: 56, right: 1280, x: 0, y: 0, toJSON() { return {}; } };
};

// ── Mock the Electron chrome bridge BEFORE importing React modules ──
const calls = [];
let stateCallback = null;
const bridge = {
  ready: async () => ({
    id: 'abc1234567890def12',
    name: 'Work',
    email: 'work@example.com',
    color: 'blue',
    partition: 'persist:profile-abc1234567890def12',
  }),
  navigate: async (input) => {
    calls.push(['navigate', input]);
    return { ok: true, url: `https://${input}/` };
  },
  goBack: async () => calls.push(['goBack']),
  goForward: async () => calls.push(['goForward']),
  reload: async () => calls.push(['reload']),
  goHome: async () => calls.push(['goHome']),
  toggleDevTools: async () => calls.push(['toggleDevTools']),
  setToolbarHeight: async (height) => calls.push(['setToolbarHeight', height]),
  onState: (cb) => {
    stateCallback = cb;
    return () => {};
  },
  onToast: () => () => {},
  onCrashed: () => () => {},
};
window.technoBrowseChrome = bridge;

Object.defineProperty(window.document, 'oninput', { value: null, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { createServer } = await import('vite');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { default: BrowserChrome } = await server.ssrLoadModule('/src/browser/BrowserChrome.jsx');
await server.close();

const results = [];
const check = (name, condition) => results.push([condition ? 'PASS' : 'FAIL', name]);

const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => {
  root.render(React.createElement(BrowserChrome));
  await new Promise((r) => setTimeout(r, 20));
});

// Push an initial page state from the "main process"
await act(async () => {
  stateCallback?.({
    url: 'https://example.com/',
    displayUrl: 'https://example.com/',
    title: 'Example Domain',
    isLoading: false,
    canGoBack: true,
    canGoForward: false,
  });
});

const urlInput = document.querySelector('input[aria-label="نوار نشانی"]');
check('چیپ پروفایل نام پروفایل را نشان می‌دهد', document.body.textContent.includes('Work'));
check('نوار نشانی URL صفحهٔ جاری را نشان می‌دهد', urlInput && urlInput.value === 'https://example.com/');
check('ارتفاع نوار ابزار به پردازش اصلی اعلام شد', calls.some(([n]) => n === 'setToolbarHeight'));

// Back button enabled (canGoBack=true), forward disabled
const buttons = Array.from(document.querySelectorAll('button'));
const backButton = buttons.find((b) => b.getAttribute('aria-label') === 'بازگشت');
const forwardButton = buttons.find((b) => b.getAttribute('aria-label') === 'جلو');
check('دکمهٔ بازگشت فعال و جلو غیرفعال است', !backButton.disabled && forwardButton.disabled);

// Navigate by typing + Enter
await act(async () => {
  urlInput.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
});
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(urlInput, 'github.com');
  urlInput.dispatchEvent(new window.Event('input', { bubbles: true }));
});
await act(async () => {
  urlInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 20));
});
check('Enter در نوار نشانی با همان متن ناوبری می‌کند', calls.some(([n, v]) => n === 'navigate' && v === 'github.com'));

// Nav buttons call the bridge
await act(async () => {
  backButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
});
check('دکمهٔ بازگشت goBack را صدا می‌زند', calls.some(([n]) => n === 'goBack'));

const reloadButton = buttons.find((b) => b.getAttribute('aria-label') === 'بارگذاری مجدد');
await act(async () => {
  reloadButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
});
check('دکمهٔ بارگذاری دوباره reload را صدا می‌زند', calls.some(([n]) => n === 'reload'));

const homeButton = buttons.find((b) => b.getAttribute('aria-label') === 'خانه');
await act(async () => {
  homeButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
});
check('دکمهٔ خانه goHome را صدا می‌زند', calls.some(([n]) => n === 'goHome'));

// Loading state shows the progress indicator and spinner
await act(async () => {
  stateCallback?.({
    url: 'https://github.com/',
    displayUrl: 'https://github.com/',
    title: 'GitHub',
    isLoading: true,
    canGoBack: true,
    canGoForward: false,
  });
});
check('نوار پیشرفت هنگام بارگذاری ظاهر می‌شود', !!document.querySelector('.loading-bar'));

await act(async () => {
  root.unmount();
});

const failed = results.filter(([status]) => status === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} chrome checks passed`);
process.exit(failed.length ? 1 : 0);
