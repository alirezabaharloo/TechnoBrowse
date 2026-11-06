import { useState } from 'react';
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Mail,
  Pencil,
  Trash2,
} from 'lucide-react';
import { avatarStyle, formatDate, initialsFor, timeAgo } from '../lib/profileUtils';

export default function ProfileCard({ profile, onOpen, onEdit, onDelete, opening }) {
  const [copied, setCopied] = useState(false);
  const isOpening = opening === profile.id;

  const copyPartition = async () => {
    try {
      await navigator.clipboard.writeText(`persist:profile-${profile.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* کلیپ‌بورد در دسترس نیست — غیرحیاتی است */
    }
  };

  return (
    <article className="profile-card group relative flex flex-col rounded-2xl border border-slate-900/[0.08] bg-white p-5 shadow-card">
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
          <h3 className="truncate text-[16px] font-bold leading-snug text-slate-800" title={profile.name}>
            {profile.name}
          </h3>
          <button
            onClick={() => onEdit(profile)}
            className="mt-1 flex max-w-full items-center gap-1.5 rounded-md text-start text-[12px] text-slate-500 transition hover:text-slate-800"
            title={profile.email ? 'ویرایش برچسب ایمیل' : 'افزودن برچسب ایمیل'}
          >
            <Mail size={12} className="shrink-0" />
            {profile.email ? (
              <span dir="ltr" className="truncate">{profile.email}</span>
            ) : (
              <span className="text-slate-400 hover:text-slate-600">بدون برچسب ایمیل — افزودن</span>
            )}
          </button>
        </div>
      </div>

      {/* ردیف متادیتا */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5" title={`ساخته‌شده در ${formatDate(profile.createdAt)}`}>
          <CalendarDays size={12} /> {formatDate(profile.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1.5" title="آخرین بار باز شده">
          <History size={12} /> {profile.lastOpenedAt ? timeAgo(profile.lastOpenedAt) : 'هنوز باز نشده'}
        </span>
      </div>

      {/* چیپ پارتیشن */}
      <div className="mt-3 flex items-center gap-1.5">
        <code
          dir="ltr"
          className="truncate rounded-md border border-slate-900/[0.07] bg-slate-50 px-2 py-1 text-left font-mono text-[10.5px] text-accent-600"
          title="پارتیشن ذخیره‌سازی کرومیوم این پروفایل"
        >
          persist:profile-{profile.id}
        </code>
        <button
          onClick={copyPartition}
          className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
          title="کپی نام پارتیشن"
          aria-label="کپی نام پارتیشن"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        </button>
      </div>

      {/* فضای خالی برای یکسان‌سازی ارتفاع کارت‌ها */}
      <div className="flex-1" />

      {/* دکمه‌ها */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onOpen(profile)}
          disabled={isOpening}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500
            text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]
            transition hover:from-accent-500 hover:to-accent-400 hover:shadow-[0_8px_22px_rgba(59,130,246,0.4)]
            active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
        >
          {isOpening ? (
            <>
              <Loader2 size={16} className="animate-spin" /> در حال باز کردن…
            </>
          ) : (
            <>
              باز کردن پروفایل <ExternalLink size={15} />
            </>
          )}
        </button>
        <button
          onClick={() => onEdit(profile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900/[0.08] bg-slate-50 text-slate-500
            transition hover:border-slate-900/15 hover:bg-slate-100 hover:text-slate-800 active:scale-95"
          title="ویرایش پروفایل"
          aria-label={`ویرایش ${profile.name}`}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete(profile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-900/[0.08] bg-slate-50 text-slate-500
            transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
          title="حذف پروفایل"
          aria-label={`حذف ${profile.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
