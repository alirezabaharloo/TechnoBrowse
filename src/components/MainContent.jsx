import {
  AlertTriangle,
  Globe,
  Check,
  Copy,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import ProfileCard from './ProfileCard';

export default function MainContent({
  chromeStatus,
  api,
  recheckChrome,
  info,
  copyDataRoot,
  copiedPath,
  openDataRoot,
  loading,
  profiles,
  setModal,
  openingId,
  handleOpen,
  handleToggleAiLimit,
  EmptyState,
}) {
  return (
    <main className="relative z-10 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-6">
        {/* بنر نبود Google Chrome — واضح، و بدون جایگزین پنهان */}
        {chromeStatus && chromeStatus.found === false && (
          <section
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-600/40 bg-amber-600/10 p-4 shadow-sm md:flex-row md:items-center md:gap-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-600/30 bg-amber-600/10">
              <AlertTriangle size={22} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-100">Google Chrome پیدا نشد</p>
              <p className="text-[11.5px] leading-6 text-slate-400">
                TechnoBrowse فقط مدیریت‌کننده است و خودش صفحهٔ وب را باز نمی‌کند. برای باز کردن هر پروفایل باید Google Chrome نصب باشد.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:ms-auto">
              <button
                onClick={() => api?.openChromeDownload?.()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-600/15 px-3 text-[12px] font-bold text-amber-600 transition hover:bg-amber-600/25"
              >
                <Globe size={14} /> صفحهٔ دریافت Chrome
              </button>
              <button
                onClick={recheckChrome}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-tint-line bg-ink-850 px-3 text-[12px] font-bold text-slate-300 transition hover:bg-tint-fill hover:text-slate-100"
              >
                <RefreshCw size={14} /> بررسی مجدد
              </button>
            </div>
          </section>
        )}

        {/* بنر ایزوله‌سازی */}
        <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-[rgba(61,139,255,0.2)] bg-gradient-to-l from-blue-500/15 via-ink-850 to-ink-850 p-4 shadow-sm md:flex-row md:items-center md:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(61,139,255,0.25)] bg-[rgba(61,139,255,0.1)]">
              <ShieldCheck size={22} className="text-accent-400" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-100">ایزوله‌سازی واقعی پروفایل‌ها</p>
              <p className="text-[11.5px] leading-6 text-slate-400">
                هر پروفایل یک <span dir="ltr">user-data-dir</span> مجزای Chrome است — کوکی‌ها، نشست‌های ورود، حافظهٔ محلی، IndexedDB و کش هیچ‌گاه از یک پروفایل خارج نمی‌شوند.
              </p>
            </div>
          </div>
          {info?.dataRoot && (
            <div className="flex items-center gap-1.5 ms-auto" dir="ltr">
              <code className="max-w-[220px] truncate rounded-lg border border-tint-line bg-ink-850 px-2 py-1.5 font-mono text-[10px] text-slate-400" title={info.dataRoot}>
                {info.dataRoot}
              </code>
              <button onClick={copyDataRoot} className="rounded-lg p-2 text-slate-400 transition hover:bg-tint-fill hover:text-slate-200" title="کپی مسیر پوشهٔ داده" aria-label="کپی مسیر پوشهٔ داده">
                {copiedPath ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
              <button onClick={openDataRoot} className="rounded-lg p-2 text-slate-400 transition hover:bg-tint-fill hover:text-slate-200" title="باز کردن پوشهٔ داده" aria-label="باز کردن پوشهٔ داده">
                <FolderOpen size={14} />
              </button>
            </div>
          )}
        </section>

        {/* شبکهٔ پروفایل‌ها / حالت‌های مختلف */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <div key={n} className="shimmer h-56 rounded-2xl border border-tint-line bg-ink-850" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState onCreate={() => setModal({ type: 'create' })} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                opening={openingId}
                onOpen={handleOpen}
                onEdit={(p) => setModal({ type: 'edit', profile: p })}
                onDelete={(p) => setModal({ type: 'delete', profile: p })}
                onToggleAiLimit={handleToggleAiLimit}
                chromeAvailable={chromeStatus ? chromeStatus.found !== false : true}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
