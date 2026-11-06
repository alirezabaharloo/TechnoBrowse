/**
 * DOM smoke checks for the dashboard (demo mode — no Electron required).
 * Drives the real UI with jsdom: create → validation error → successful create →
 * delete flow. Catches wiring mistakes that SSR can't (events, state, effects).
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
// No window.technobrowse on purpose → the dashboard runs in demo mode.

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

check('داشبورد پروفایل‌های نمونه را نشان می‌دهد', text().includes('حساب کاری') && text().includes('شخصی'));

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
await setInput(nameInput, 'پروفایل تازهٔ من');
check('دکمهٔ ثبت بعد از وارد کردن نام فعال می‌شود', submitButton.disabled === false);

// Create it
await click(submitButton);
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
});
check('پروفایل جدید در شبکه ظاهر می‌شود', text().includes('پروفایل تازهٔ من'));

// Open the delete dialog for the new profile and cancel it
const card = Array.from(document.querySelectorAll('article')).find((el) => el.textContent.includes('پروفایل تازهٔ من'));
const deleteButton = card?.querySelector('button[aria-label^="حذف"]');
await click(deleteButton);
check('دیالوگ حذف با فهرست پیامدها باز می‌شود', text().includes('کوکی‌ها و نشست‌های ورود'));

const cancelButton = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'انصراف');
await click(cancelButton);
check('با انصراف دیالوگ بسته می‌شود و پروفایل می‌ماند', text().includes('پروفایل تازهٔ من'));

// Confirm deletion for real (re-query: React re-rendered since we grabbed references)
const card2 = Array.from(document.querySelectorAll('article')).find((el) => el.textContent.includes('پروفایل تازهٔ من'));
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
  el.textContent.includes('پروفایل تازهٔ من')
);
check('بعد از حذف تأییدشده پروفایل حذف می‌شود', remainingCards.length === 0);

await act(async () => {
  root.unmount();
});

const failed = results.filter(([status]) => status === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} DOM checks passed`);
process.exit(failed.length ? 1 : 0);
