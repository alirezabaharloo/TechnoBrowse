import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Loader2, Mail, Sparkles, User, X } from 'lucide-react';

/**
 * مودال مشترک ساخت و ویرایش مرورگر
 * mode: 'create' | 'edit'
 */
export default function ProfileFormModal({ mode, initialProfile, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [email, setEmail] = useState(initialProfile?.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= 60;

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    if (!nameValid) {
      setError('لطفاً یه اسم برای مرورگر وارد کن (حداکثر ۶۰ نویسه).');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: trimmedName, email: email.trim() });
      onClose();
    } catch (err) {
      setError(err?.message || 'یه مشکلی پیش اومد؛ دوباره امتحان کن.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-form-title"
    >
      {/* پس‌زمینه */}
      <div className="absolute inset-0 animate-fade-in bg-tint-scrim backdrop-blur-[6px]" onClick={() => !busy && onClose()} />

      {/* پنل */}
      <form
        onSubmit={submit}
        className="relative w-full max-w-md animate-zoom-in overflow-hidden rounded-2xl border border-tint-line bg-ink-800 shadow-card"
      >
        {/* خط آبی بالای مودال */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-blue-500/60 to-transparent" />

        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <div className="flex items-center gap-3">
            <img
              src="./technowin.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 select-none rounded-xl shadow-[0_4px_14px_rgba(15,23,42,0.3)]"
              draggable={false}
            />
            <div>
              <h2 id="profile-form-title" className="text-[16px] font-extrabold text-slate-100">
                {isEdit ? 'ویرایش مرورگر' : 'ایجاد مرورگر جدید'}
              </h2>
              <p className="text-[11.5px] text-slate-400">
                {isEdit ? 'تغییر اسم یا برچسب ایمیل' : 'فوری و بدون هیچ ورودی'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-tint-fill hover:text-slate-200"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-5">
          {/* نام */}
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-300">
              اسم مرورگر <span className="text-accent-400">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-tint-line bg-ink-850 px-3 transition focus-within:border-[rgba(61,139,255,0.6)] focus-within:bg-ink-800 focus-within:ring-2 focus-within:ring-[rgba(61,139,255,0.15)]">
              <User size={16} className="shrink-0 text-slate-500" />
              <input
                id="profile-name"
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مثلاً: حساب کاری، شخصی، پروژهٔ مشتری…"
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full bg-transparent text-[14px] text-slate-100 placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {/* ایمیل (برچسب اختیاری فقط) */}
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-300">
              ایمیل <span className="font-normal text-slate-500">(اختیاری؛ فقط یه برچسبه)</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-tint-line bg-ink-850 px-3 transition focus-within:border-[rgba(61,139,255,0.6)] focus-within:bg-ink-800 focus-within:ring-2 focus-within:ring-[rgba(61,139,255,0.15)]">
              <Mail size={16} className="shrink-0 text-slate-500" />
              <input
                id="profile-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@gmail.com"
                maxLength={120}
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full bg-transparent text-left text-[14px] text-slate-100 placeholder-slate-500 outline-none"
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-6 text-slate-400">
              فقط برای اینکه مرورگرها رو از هم تشخیص بدی. TechnoBrowse هیچ‌وقت وارد حسابت نمی‌شه، چیزی رو چک نمی‌کنه و رمزی ذخیره نمی‌کنه.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-500">
              <CircleAlert size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* دکمه‌ها */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="h-10 rounded-xl px-4 text-[13px] font-medium text-slate-400 transition hover:bg-tint-fill hover:text-slate-100"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={busy || !nameValid}
              className="flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500
                px-4 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]
                transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> {isEdit ? 'در حال ذخیره…' : 'در حال ایجاد…'}
                </>
              ) : isEdit ? (
                'ذخیره کردن تغییرات'
              ) : (
                'ایجاد مرورگر'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
