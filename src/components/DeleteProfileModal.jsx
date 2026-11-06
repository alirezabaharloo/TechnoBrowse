import { useEffect, useState } from 'react';
import { AlertTriangle, Cookie, Database, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';

export default function DeleteProfileModal({ profile, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(profile);
      onClose();
    } catch (err) {
      setError(err?.message || 'حذف پروفایل ممکن نشد. لطفاً دوباره تلاش کنید.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-profile-title"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-[6px]" onClick={() => !busy && onClose()} />

      <div className="relative w-full max-w-md animate-zoom-in overflow-hidden rounded-2xl border border-rose-500/30 bg-ink-800 shadow-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-rose-400/70 to-transparent" />

        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
              <Trash2 size={18} className="text-rose-400" />
            </div>
            <div>
              <h2 id="delete-profile-title" className="text-[16px] font-extrabold text-slate-100">
                حذف «{profile.name}»؟
              </h2>
              <p className="text-[11.5px] text-slate-400">این عملیات قابل بازگشت نیست.</p>
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-ink-800/5 hover:text-slate-200"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="rounded-xl border border-white/[0.08] bg-ink-850 p-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              همهٔ موارد زیر برای همیشه پاک می‌شوند
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-slate-300">
              <li className="flex items-center gap-2"><Cookie size={13} className="shrink-0 text-rose-500" /> کوکی‌ها و نشست‌های ورود</li>
              <li className="flex items-center gap-2"><Database size={13} className="shrink-0 text-rose-500" /> حافظهٔ محلی، IndexedDB و کش</li>
              <li className="flex items-center gap-2"><AlertTriangle size={13} className="shrink-0 text-rose-500" /> ورودهای سایت‌ها در این پروفایل</li>
            </ul>
          </div>

          <p className="flex items-center gap-2 text-[12px] text-emerald-400">
            <ShieldCheck size={14} className="shrink-0" />
            سایر پروفایل‌ها و داده‌هایشان کاملاً دست‌نخورده می‌ماند.
          </p>

          {error && <p className="text-[12px] text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => !busy && onClose()}
              className="h-10 rounded-xl px-4 text-[13px] font-medium text-slate-400 transition hover:bg-ink-800/5 hover:text-slate-100"
            >
              انصراف
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl border border-rose-300
                bg-gradient-to-br from-rose-600 to-rose-500 px-4 text-[13px] font-bold text-white
                shadow-[0_6px_18px_rgba(225,29,72,0.3)] transition hover:from-rose-500 hover:to-rose-400 active:scale-[0.98]
                disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> در حال حذف…
                </>
              ) : (
                'حذف پروفایل'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
