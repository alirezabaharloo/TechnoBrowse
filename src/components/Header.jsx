
import { Plus, Sparkles, Users } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header({ info, profiles, setModal }) {
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-tint-line bg-ink-900 px-6 backdrop-blur">

      {/* ── TechnoWin Premium Animated Signature ── */}

      <style>{`
        @keyframes technowin-shine {
          0% {
            transform: translateX(-160%) skewX(-20deg);
          }
          100% {
            transform: translateX(360%) skewX(-20deg);
          }
        }

        .technowin-shine {
          animation: technowin-shine 3.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .technowin-shine {
            animation: none;
            display: none;
          }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none xl:flex"
      >
        <div className="
          relative isolate flex items-center gap-3 overflow-hidden rounded-full
          border border-blue-500
          px-5 py-2
          shadow-[0_3px_14px_rgba(37,99,235,0.07)]
          backdrop-blur-md
          dark:bg-[#111827]
          dark:shadow-[0_3px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]
        ">

          {/* Animated Shine */}
          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-full">
            <div className="technowin-shine absolute -left-1/3 top-0 h-full w-1/3
              bg-gradient-to-r from-transparent via-blue-400/20 to-transparent
              dark:via-sky-300/15" />
          </div>

          {/* Left Line */}
          <span className="relative z-10 h-px w-6 shrink-0
            bg-gradient-to-r from-transparent to-blue-500/70
            dark:to-sky-400/70" />

          {/* Icon */}
          <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center
            rounded-lg border border-sky-400/20 bg-sky-400/10
           ">
            <Sparkles
              size={14}
              strokeWidth={2}
              className="text-blue-600 dark:text-sky-300"
            />
          </div>

          {/* Credit Text */}
          <span className="relative z-10 whitespace-nowrap text-[11px] font-medium
            tracking-wide text-slate-500 dark:text-slate-400">
           ساخته شده توسط تیم
          </span>

          {/* Brand Name */}
          <span className="relative z-10 whitespace-nowrap bg-gradient-to-r
            from-blue-600 via-indigo-500 to-sky-600 bg-clip-text
            text-[12px] font-black tracking-[0.09em] text-transparent
            dark:from-sky-300 dark:via-cyan-200 dark:to-blue-400">
            TechnoWin
          </span>

          {/* Accent Dot */}
          <span className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full
            bg-blue-500 dark:bg-sky-400" />

          {/* Right Line */}
          <span className="relative z-10 h-px w-6 shrink-0
            bg-gradient-to-l from-transparent to-blue-500/70
            dark:to-sky-400/70" />

        </div>
      </div>


      {/* ── Logo & Brand ── */}

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
            مدیریت چندین صفحه مرورگر
          </p>
        </div>
      </div>

      {/* ── Header Actions ── */}

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
