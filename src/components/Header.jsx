import { Plus, Sparkles, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header({ info, profiles, setModal }) {
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-tint-line bg-ink-900 px-6 backdrop-blur">
      {/* ── اعتبار ساخت: تیم TechnoWin ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none items-center gap-2.5 xl:flex"
      >
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-[rgba(61,139,255,0.55)]" />
        <Sparkles size={12} className="text-accent-400" />
        <span className="bg-gradient-to-l from-accent-400 via-accent-500 to-accent-600 bg-clip-text text-[11.5px] font-extrabold tracking-[0.08em] text-transparent">
          ساخته شده توسط تیم TechnoWin
        </span>
        <Sparkles size={12} className="text-accent-400" />
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-[rgba(61,139,255,0.55)]" />
      </div>

      <div className="flex items-center gap-3">
        <img
          src="./technowin.png"
          alt="نشان TechnoBrowse"
          className="h-10 w-10 select-none rounded-xl shadow-[0_6px_18px_rgba(15,23,42,0.35)]"
          draggable={false}
        />
        <div className="leading-tight">
          <h1 className="text-[17px] font-extrabold tracking-tight text-slate-100">
            Techno<span className="text-accent-400">Browse</span>
          </h1>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            مدیر پروفایل‌های Chrome
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <ThemeToggle className="h-10 w-10 rounded-xl" />
        {info?.portable && (
          <span className="hidden rounded-full border border-[rgba(61,139,255,0.25)] bg-[rgba(61,139,255,0.1)] px-3 py-1 text-[10.5px] font-bold tracking-wider text-accent-400 sm:inline-block">
            نسخهٔ پرتابل
          </span>
        )}
        <span className="hidden items-center gap-1.5 rounded-full border border-tint-line bg-ink-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 shadow-sm md:inline-flex">
          <Users size={12} />
          {`${profiles.length.toLocaleString('fa-IR')} پروفایل`}
        </span>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-4
            text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]
            transition hover:from-accent-500 hover:to-accent-400 hover:shadow-[0_10px_30px_rgba(59,130,246,0.4)] active:scale-[0.98]"
        >
          <Plus size={17} strokeWidth={2.5} />
          <span className="hidden sm:inline">ایجاد پروفایل جدید</span>
          <span className="sm:hidden">پروفایل جدید</span>
        </button>
      </div>
    </header>
  );
}
