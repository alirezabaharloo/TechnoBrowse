// ابزارهای نمایشی پروفایل‌ها (فارسی)

export const AVATAR_STYLES = {
  blue: 'from-sky-400 to-blue-600 text-white',
  violet: 'from-violet-400 to-purple-600 text-white',
  emerald: 'from-emerald-400 to-teal-600 text-white',
  amber: 'from-amber-300 to-orange-500 text-white',
  rose: 'from-rose-400 to-red-500 text-white',
  cyan: 'from-cyan-400 to-sky-600 text-white',
  fuchsia: 'from-fuchsia-400 to-purple-600 text-white',
  lime: 'from-lime-400 to-green-600 text-white',
  orange: 'from-orange-400 to-red-500 text-white',
  teal: 'from-teal-400 to-emerald-600 text-white',
};

export function avatarStyle(color) {
  return AVATAR_STYLES[color] ?? AVATAR_STYLES.blue;
}

export function initialsFor(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '؟';
  const first = words[0][0] ?? '';
  const second = words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? '');
  return (first + second).toUpperCase();
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** ارقام انگلیسی را به ارقام فارسی تبدیل می‌کند */
export function faDigits(value) {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** زمان گذشته از رسیدن به سقف AI را به «ساعت و دقیقه» فارسی برمی‌گرداند */
export function limitElapsed(startMs, nowMs = Date.now()) {
  const start = Number(startMs);
  const now = Number(nowMs);
  if (!Number.isFinite(start) || !Number.isFinite(now) || start <= 0) return '—';
  const elapsedMinutes = Math.max(0, Math.floor((now - start) / 60000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  if (hours === 0) return `${faDigits(minutes)} دقیقه`;
  return `${faDigits(hours)} ساعت و ${faDigits(minutes)} دقیقه`;
}

export function timeAgo(iso) {
  if (!iso) return 'هرگز';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'هرگز';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'همین حالا';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${faDigits(days)} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${faDigits(months)} ماه پیش`;
  return `${faDigits(Math.floor(months / 12))} سال پیش`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Bridge to the Electron preload API, or null when running in a plain browser. */
export function nativeBridge() {
  return typeof window !== 'undefined' && window.technobrowse ? window.technobrowse : null;
}
