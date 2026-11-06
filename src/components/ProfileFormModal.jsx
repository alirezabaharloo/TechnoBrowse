import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Loader2, Mail, Sparkles, User, X } from 'lucide-react';

/**
 * Shared modal for creating and editing a profile.
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
      setError('Please enter a profile name (up to 60 characters).');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: trimmedName, email: email.trim() });
      onClose();
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
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
      {/* Backdrop */}
      <div className="absolute inset-0 animate-fade-in bg-[#03060f]/70 backdrop-blur-[6px]" onClick={() => !busy && onClose()} />

      {/* Panel */}
      <form
        onSubmit={submit}
        className="relative w-full max-w-md animate-zoom-in overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-800 shadow-card"
      >
        {/* Accent hairline */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-600 to-accent-400 shadow-[0_4px_14px_rgba(37,99,235,0.4)]">
              {isEdit ? <User size={18} className="text-white" /> : <Sparkles size={18} className="text-white" />}
            </div>
            <div>
              <h2 id="profile-form-title" className="text-[16px] font-semibold text-slate-100">
                {isEdit ? 'Edit Profile' : 'Create New Profile'}
              </h2>
              <p className="text-[11.5px] text-slate-500">
                {isEdit ? 'Rename or update the email label.' : 'Instant, isolated, no sign-in required.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-5">
          {/* Name */}
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Profile name <span className="text-blue-400">*</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-ink-850 px-3 transition focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
              <User size={16} className="shrink-0 text-slate-500" />
              <input
                id="profile-name"
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Work Account, Personal, Client Project…"
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full bg-transparent text-[14px] text-slate-100 placeholder-slate-600 outline-none"
              />
            </div>
          </div>

          {/* Email (optional label only) */}
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Email <span className="font-normal normal-case text-slate-600">(optional, label only)</span>
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-ink-850 px-3 transition focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20">
              <Mail size={16} className="shrink-0 text-slate-500" />
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@gmail.com"
                maxLength={120}
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full bg-transparent text-[14px] text-slate-100 placeholder-slate-600 outline-none"
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
              A label to help you tell profiles apart. TechnoBrowse never signs in, verifies or stores your credentials.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-300">
              <CircleAlert size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="h-10 rounded-xl px-4 text-[13px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !nameValid}
              className="flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500
                px-4 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)]
                transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> {isEdit ? 'Saving…' : 'Creating…'}
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
