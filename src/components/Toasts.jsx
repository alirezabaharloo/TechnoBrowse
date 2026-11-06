import { CheckCircle2, Info, X } from 'lucide-react';

/**
 * سیستم اعلان ساده (Toast)
 */
export default function Toasts({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-white/10 bg-ink-800/95 px-3.5 py-2.5 shadow-card backdrop-blur
            animate-slide-up"
        >
          {toast.tone === 'error' ? (
            <Info size={16} className="mt-0.5 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
          )}
          <p className="flex-1 text-[13px] leading-6 text-slate-200">{toast.message}</p>
          <button
            onClick={() => dismiss(toast.id)}
            className="rounded-md p-0.5 text-slate-500 transition hover:bg-ink-800/5 hover:text-slate-300"
            aria-label="بستن اعلان"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
