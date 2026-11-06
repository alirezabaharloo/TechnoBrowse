/**
 * Theme (dark / light) for TechnoBrowse.
 * The choice is stored in localStorage and applied via [data-theme] on <html>;
 * all colors flow from CSS variables (see index.css), so flipping is instant.
 */
export const THEME_STORAGE_KEY = 'tb-theme';

export function getInitialTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable (e.g. file://) — fall through to default */
  }
  return 'dark'; // the app's original look is the default
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* non-fatal */
  }
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', next);
  window.dispatchEvent(new CustomEvent('tb:theme', { detail: next }));
  return next;
}

export function currentTheme() {
  if (typeof document === 'undefined') return 'dark'; // SSR (render-check)
  return document.documentElement?.dataset?.theme === 'light' ? 'light' : 'dark';
}
