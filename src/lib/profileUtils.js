// Shared display helpers for profiles.

export const AVATAR_STYLES = {
  blue: 'from-sky-400 to-blue-600 text-ink-900',
  violet: 'from-violet-400 to-purple-600 text-ink-900',
  emerald: 'from-emerald-400 to-teal-600 text-ink-900',
  amber: 'from-amber-300 to-orange-500 text-ink-900',
  rose: 'from-rose-400 to-red-500 text-ink-900',
  cyan: 'from-cyan-400 to-sky-600 text-ink-900',
  fuchsia: 'from-fuchsia-400 to-purple-600 text-ink-900',
  lime: 'from-lime-400 to-green-600 text-ink-900',
  orange: 'from-orange-400 to-red-500 text-ink-900',
  teal: 'from-teal-400 to-emerald-600 text-ink-900',
};

export function avatarStyle(color) {
  return AVATAR_STYLES[color] ?? AVATAR_STYLES.blue;
}

export function initialsFor(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? '');
  return (first + second).toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Bridge to the Electron preload API, or null when running in a plain browser. */
export function nativeBridge() {
  return typeof window !== 'undefined' && window.technobrowse ? window.technobrowse : null;
}

export function chromeBridge() {
  return typeof window !== 'undefined' && window.technoBrowseChrome ? window.technoBrowseChrome : null;
}
