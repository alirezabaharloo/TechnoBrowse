import { useEffect, useState } from 'react';
import { AlertTriangle, Cookie, Database, Globe, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';

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

  const isRunning = profile?.isRunning === true;

  const confirm = async () => {
    if (isRunning) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(profile);
      onClose();
    } catch (err) {
      setError(err?.message || 'پاک کردن انجام نشد؛ دوباره امتحان کن.');
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
      <div className="absolute inset-0 animate-fade-in bg-tint-scrim backdrop-blur-[6px]" onClick={() => !busy && onClose()} />

      <div className="relative w-full max-w-md animate-zoom-in overflow-hidden rounded-2xl border border-rose-500/30 bg-ink-800 shadow-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-rose-400/70 to-transparent" />

        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
              <Trash2 size={18} className="text-rose-500" />
            </div>
            <div>
              <h2 id="delete-profile-title" className="text-[16px] font-extrabold text-slate-100">
                حذف «{profile.name}»؟
              </h2>
              <p className="text-[11.5px] text-slate-400">این کار قابل برگشت نیست.</p>
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-tint-fill hover:text-slate-200"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="rounded-xl border border-tint-line bg-ink-850 p-3.5">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              همهٔ اینا برای همیشه پاک می‌شن
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-slate-300">
              <li className="flex items-center gap-2"><Cookie size={13} className="shrink-0 text-rose-500" /> کوکی‌ها و اطلاعات ورود</li>
              <li className="flex items-center gap-2"><Database size={13} className="shrink-0 text-rose-500" /> اطلاعات سایت‌ها و کش</li>
              <li className="flex items-center gap-2"><AlertTriangle size={13} className="shrink-0 text-rose-500" /> ورودهات به سایت‌ها تو این مرورگر</li>
            </ul>
          </div>

          {isRunning && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-600/10 p-2.5 text-[12px] leading-6 text-amber-600">
              <Globe size={14} className="mt-0.5 shrink-0" />
              این مرورگر همین الان بازه؛ اول پنجرهٔ Chrome ش رو ببند، بعد پاک کن.
            </p>
          )}

          <p className="flex items-center gap-2 text-[12px] text-emerald-600">
            <ShieldCheck size={14} className="shrink-0" />
            بقیهٔ مرورگرها و داده‌هاشون دست‌نخورده می‌مونن.
          </p>

          {error && <p className="text-[12px] text-rose-500">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => !busy && onClose()}
              className="h-10 rounded-xl px-4 text-[13px] font-medium text-slate-400 transition hover:bg-tint-fill hover:text-slate-100"
            >
              انصراف
            </button>
            <button
              onClick={confirm}
              disabled={busy || isRunning}
              className="flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl border border-rose-500/40
                bg-gradient-to-br from-rose-600 to-rose-500 px-4 text-[13px] font-bold text-white
                shadow-[0_6px_18px_rgba(225,29,72,0.3)] transition hover:from-rose-500 hover:to-rose-400 active:scale-[0.98]
                disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> در حال حذف…
                </>
              ) : (
                'حذف مرورگر'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
