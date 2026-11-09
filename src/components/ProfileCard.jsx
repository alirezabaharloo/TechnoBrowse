import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  Globe,
  Copy,
  History,
  Hourglass,
  Loader2,
  Mail,
  Pencil,
  Timer,
  TimerOff,
  Trash2,
} from 'lucide-react';
import { avatarStyle, formatDate, initialsFor, limitElapsed, timeAgo } from '../lib/profileUtils';

export default function ProfileCard({ profile, onOpen, onEdit, onDelete, onToggleAiLimit, opening, chromeAvailable = true }) {
  const [copied, setCopied] = useState(false);
  const isOpening = opening === profile.id;

  // AI usage-limit state — persisted on the profile itself (profiles.json).
  const limitAt = Number.isFinite(profile.aiLimitReachedAt) ? profile.aiLimitReachedAt : null;
  const limitActive = limitAt !== null;
  const [now, setNow] = useState(() => Date.now());

  // Keep the elapsed «ساعت : دقیقه» readout fresh while the app is open.
  useEffect(() => {
    if (!limitActive) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [limitActive]);

  const directory = profile.directory ?? `profiles/profile-${profile.id}`;

  const copyDirectory = async () => {
    try {
      await navigator.clipboard.writeText(directory);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* کلیپ‌بورد در دسترس نیست — غیرحیاتی است */
    }
  };

  return (
    <article
      aria-label={limitActive ? `${profile.name} — محدودیت استفادهٔ روزانه ثبت شده` : undefined}
      className={`profile-card group relative flex flex-col rounded-2xl border border-tint-line bg-ink-800 p-5 shadow-card${limitActive ? ' limit-card' : ''}`}
    >
      {/* سربرگ: آواتار + هویت */}
      <div className="flex items-start gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-bold tracking-wide shadow-inner ${avatarStyle(
            profile.color
          )}`}
          aria-hidden="true"
        >
          {initialsFor(profile.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold leading-snug text-slate-100" title={profile.name}>
            {profile.name}
          </h3>
          <button
            onClick={() => onEdit(profile)}
            className="mt-1 flex max-w-full items-center gap-1.5 rounded-md text-start text-[12px] text-slate-400 transition hover:text-slate-100"
            title={profile.email ? 'تغییر برچسب ایمیل' : 'افزودن برچسب ایمیل'}
          >
            <Mail size={12} className="shrink-0" />
            {profile.email ? (
              <span dir="ltr" className="truncate">{profile.email}</span>
            ) : (
              <span className="text-slate-500 hover:text-slate-300">بدون برچسب ایمیل — افزودن</span>
            )}
          </button>
        </div>
      </div>

      {/* ردیف متادیتا */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-400">
        <span className="inline-flex items-center gap-1.5" title={`ساخته‌شده در ${formatDate(profile.createdAt)}`}>
          <CalendarDays size={12} /> {formatDate(profile.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1.5" title="آخرین بار باز شده">
          <History size={12} /> {profile.lastOpenedAt ? timeAgo(profile.lastOpenedAt) : 'هنوز باز نشده'}
        </span>
      </div>

      {/* چیپ پوشهٔ دادهٔ Chrome */}
      <div className="mt-3 flex items-center gap-1.5">
        <code
          dir="ltr"
          className="truncate rounded-md border border-tint-line bg-ink-850 px-2 py-1 text-left font-mono text-[10.5px] text-accent-400"
          title="پوشهٔ داده‌های Chrome این مرورگر"
        >
          {directory}
        </code>
        <button
          onClick={copyDirectory}
          className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-tint-fill hover:text-slate-200 focus:opacity-100 group-hover:opacity-100"
          title="کپی مسیر پوشه"
          aria-label="کپی مسیر پوشه"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
        {profile.isRunning && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
            در حال اجرا
          </span>
        )}
      </div>

      {/* ردیف پیگیری محدودیت استفادهٔ روزانه — فقط وقتی فعال است */}
      {limitActive && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11.5px] font-bold text-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.18)]"
        >
          <Hourglass size={13} className="shrink-0" />
          <span>از رسیدن به محدودیت استفاده:</span>
          <span className="tabular-nums">{limitElapsed(limitAt, now)}</span>
        </div>
      )}

      {/* فضای خالی برای یکسان‌سازی ارتفاع کارت‌ها */}
      <div className="flex-1" />

      {/* دکمه‌ها */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onOpen(profile)}
          disabled={isOpening || chromeAvailable === false}
          title={chromeAvailable === false ? 'اول باید Chrome رو نصب کنی' : 'باز کردن این مرورگر در Chrome'}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500
            text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]
            transition hover:from-accent-500 hover:to-accent-400 hover:shadow-[0_8px_22px_rgba(59,130,246,0.4)]
            active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
        >
          {isOpening ? (
            <>
              <Loader2 size={16} className="animate-spin" /> در حال باز کردن…
            </>
          ) : (
            <>
              باز کردن در Chrome <Globe size={15} />
            </>
          )}
        </button>
        <button
          onClick={() => onToggleAiLimit?.(profile, !limitActive)}
          aria-pressed={limitActive}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${
            limitActive
              ? 'border-rose-500/60 bg-rose-500/15 text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.4)] hover:bg-rose-500/25'
              : 'border-tint-line bg-ink-850 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500'
          }`}
          title={limitActive ? 'برداشتن علامت محدودیت استفاده' : 'علامت زدن رسیدن به محدودیت استفاده'}
          aria-label={limitActive ? `برداشتن علامت محدودیت استفاده برای ${profile.name}` : `علامت زدن رسیدن به محدودیت استفاده برای ${profile.name}`}
        >
          {limitActive ? <TimerOff size={16} /> : <Timer size={16} />}
        </button>
        <button
          onClick={() => onEdit(profile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-tint-line bg-ink-850 text-slate-400
            transition hover:border-tint-line-strong hover:bg-tint-fill hover:text-slate-100 active:scale-95"
          title="ویرایش مرورگر"
          aria-label={`ویرایش ${profile.name}`}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(profile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-tint-line bg-ink-850 text-slate-400
            transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 active:scale-95"
          title="حذف مرورگر"
          aria-label={`حذف ${profile.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
