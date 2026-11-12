/**
 * DOM smoke checks for the dashboard.
 * Drives the real UI with jsdom: empty state → create → validation error →
 * successful create → delete flow. Catches wiring mistakes that SSR can't
 * (events, state, effects).
 *
 * There is no web/demo fallback in the app under test: it requires the
 * Electron preload bridge (window.technobrowse). These checks install a small
 * in-memory mock of that exact IPC surface (same methods, same shapes) so the
 * real renderer runs against a deterministic fake backend.
 * Run: npm run dom-check
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1/',
  pretendToBeVisual: true,
});

// ── Browser globals ───────────────────────────────────────────────────────────
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
setGlobal('Event', window.Event);
setGlobal('CustomEvent', window.CustomEvent);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.ResizeObserver = globalThis.ResizeObserver;
// React decides its input-event strategy at import time; make sure it sees a DOM.
Object.defineProperty(window.document, 'oninput', { value: null, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── In-memory mock of the Electron preload bridge (window.technobrowse) ───────
{
  const FAKE_DATA_ROOT = 'C:\\Users\\sample\\AppData\\Roaming\\TechnoBrowse';
  const mockProfiles = [];
  let seq = 0;
  const clone = (p) => ({ ...p });
  const pickColor = () => ['violet', 'blue', 'emerald', 'amber'][seq % 4];

  window.technobrowse = {
    openExternal: async () => {},
    listProfiles: async () => mockProfiles.map(clone),
    getAppInfo: async () => ({
      version: '2.0.0',
      dataRoot: FAKE_DATA_ROOT,
      portable: false,
      profileCount: mockProfiles.length,
      chromeFound: true,
    }),
    getChromeStatus: async () => ({
      found: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      source: 'mock',
    }),
    refreshChromeStatus: async () => window.technobrowse.getChromeStatus(),
    createProfile: async ({ name, email }) => {
      seq += 1;
      const id = `mock${String(seq).padStart(4, '0')}${'abcdef'.slice(0, 6)}`.slice(0, 18).padEnd(18, '0');
      const profile = {
        id,
        name,
        email,
        color: pickColor(),
        createdAt: new Date().toISOString(),
        lastOpenedAt: null,
        directory: `profiles/profile-${id}`,
        isRunning: false,
        aiLimitReachedAt: null,
      };
      mockProfiles.unshift(profile);
      return clone(profile);
    },
    updateProfile: async (id, { name, email }) => {
      const target = mockProfiles.find((p) => p.id === id);
      if (!target) throw new Error('پروفایل یافت نشد.');
      target.name = name;
      target.email = email;
      return clone(target);
    },
    setProfileAiLimit: async (id, enabled) => {
      const target = mockProfiles.find((p) => p.id === id);
      if (!target) throw new Error('پروفایل یافت نشد.');
      target.aiLimitReachedAt = enabled ? Date.now() : null;
      return clone(target);
    },
    deleteProfile: async (id) => {
      const index = mockProfiles.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('پروفایل یافت نشد.');
      mockProfiles.splice(index, 1);
      return { ok: true };
    },
    openProfile: async () => ({ ok: true, reused: false }),
    openChromeDownload: async () => ({ ok: true }),
    openDataRoot: async () => ({ ok: true }),
    onProfilesChanged: () => () => {},
  };
}

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

const results = [];
const check = (name, condition) => {
  results.push([condition ? 'PASS' : 'FAIL', name]);
};

// Load the JSX source through Vite's SSR transform.
const { createServer } = await import('vite');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { default: App } = await server.ssrLoadModule('/src/App.jsx');
await server.close();

const container = document.getElementById('root');
const root = createRoot(container);

await act(async () => {
  root.render(React.createElement(App));
});

const text = () => document.body.textContent || '';
const click = async (element) => {
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};
const setInput = async (element, value) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const findByText = (selector, snippet) =>
  Array.from(document.querySelectorAll(selector)).find((el) => el.textContent?.includes(snippet));

check('با نبود پروفایل، حالت خالی داشبورد نشان داده می‌شود', text().includes('هنوز هیچ حسابی نساختی'));

const createButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
  b.textContent.includes('ایجاد پروفایل جدید')
);
check('دکمهٔ برجستۀ «ایجاد پروفایل جدید» وجود دارد', createButtons.length >= 1);

// Open the create modal
await click(createButtons[0]);
check('مودال ساخت پروفایل باز می‌شود', !!document.querySelector('#profile-name'));

// Submit with an empty name → validation error
const submitButton = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
  b.textContent.includes('ایجاد پروفایل')
);
check('دکمهٔ ثبت تا وارد کردن نام غیرفعال است', submitButton.disabled === true);

// Type a name and confirm enabled
const nameInput = document.querySelector('#profile-name');
await setInput(nameInput, 'حساب تازهٔ من');
check('دکمهٔ ثبت بعد از وارد کردن نام فعال می‌شود', submitButton.disabled === false);

// Create it
await click(submitButton);
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
});
check('پروفایل جدید در شبکه ظاهر می‌شود', text().includes('حساب تازهٔ من'));

// Open the delete dialog for the new profile and cancel it
const card = Array.from(document.querySelectorAll('article')).find((el) => el.textContent.includes('حساب تازهٔ من'));
const deleteButton = card?.querySelector('button[aria-label^="حذف"]');
await click(deleteButton);
check('دیالوگ حذف با فهرست پیامدها باز می‌شود', text().includes('کوکی‌ها و نشست‌های ورود'));

const cancelButton = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'انصراف');
await click(cancelButton);
check('با انصراف دیالوگ بسته می‌شود و پروفایل می‌ماند', text().includes('حساب تازهٔ من'));

// Confirm deletion for real (re-query: React re-rendered since we grabbed references)
const card2 = Array.from(document.querySelectorAll('article')).find((el) => el.textContent.includes('حساب تازهٔ من'));
const deleteButton2 = card2?.querySelector('button[aria-label^="حذف"]');
await click(deleteButton2);
const confirmButton = Array.from(document.querySelectorAll('button')).find((b) =>
  b.textContent.trim() === 'حذف پروفایل'
);
await click(confirmButton);
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
});
const remainingCards = Array.from(document.querySelectorAll('article')).filter((el) =>
  el.textContent.includes('حساب تازهٔ من')
);
check('بعد از حذف تأییدشده پروفایل حذف می‌شود', remainingCards.length === 0);

await act(async () => {
  root.unmount();
});

const failed = results.filter(([status]) => status === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} DOM checks passed`);
process.exit(failed.length ? 1 : 0);
