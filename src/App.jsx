import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  Check,
  Copy,
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { nativeBridge } from './lib/profileUtils';
import ThemeToggle from './components/ThemeToggle';
import ProfileCard from './components/ProfileCard';
import ProfileFormModal from './components/ProfileFormModal';
import DeleteProfileModal from './components/DeleteProfileModal';
import Toasts from './components/Toasts';

const DEMO_PROFILES = [
  { id: 'demo8f3a1b2c4d5e', name: 'حساب کاری', email: 'alex@work.com', color: 'blue', createdAt: new Date(Date.now() - 86400000 * 40).toISOString(), lastOpenedAt: new Date(Date.now() - 3600000 * 5).toISOString(), directory: 'profiles/profile-demo8f3a1b2c4d5e', isRunning: false },
  { id: 'demo1c2d3e4f5a6b', name: 'شخصی', email: 'alex.personal@gmail.com', color: 'emerald', createdAt: new Date(Date.now() - 86400000 * 21).toISOString(), lastOpenedAt: new Date(Date.now() - 86400000 * 2).toISOString(), directory: 'profiles/profile-demo1c2d3e4f5a6b', isRunning: false },
  { id: 'demo9a8b7c6d5e4f', name: 'پروژهٔ مشتری', email: '', color: 'amber', createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), lastOpenedAt: null, directory: 'profiles/profile-demo9a8b7c6d5e4f', isRunning: false },
];

export default function App() {
  const api = useMemo(() => nativeBridge(), []);
  const demoMode = !api;

  const [profiles, setProfiles] = useState([]);
  const [info, setInfo] = useState(null);
  const [chromeStatus, setChromeStatus] = useState(null); // null = unknown yet
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type: 'create' | 'edit' | 'delete', profile? }
  const [toasts, setToasts] = useState([]);
  const [openingId, setOpeningId] = useState(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const pushToast = useCallback((message, tone = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 4600);
  }, [dismissToast]);

  const refresh = useCallback(async () => {
    if (!api) return;
    const list = await api.listProfiles();
    setProfiles(list);
  }, [api]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (api) {
          const [list, appInfo, chrome] = await Promise.all([
            api.listProfiles(),
            api.getAppInfo(),
            api.getChromeStatus(),
          ]);
          if (!mounted) return;
          setProfiles(list);
          setInfo(appInfo);
          setChromeStatus(chrome);
        } else {
          setProfiles(DEMO_PROFILES);
          setChromeStatus({ found: true, source: 'demo' });
        }
      } catch (error) {
        pushToast(error?.message || 'بارگذاری پروفایل‌ها ممکن نشد.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const unsubscribe = api?.onProfilesChanged?.(() => refresh());
    // Refresh when the window regains focus so «در حال اجرا» badges and open/running state stay accurate.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted = false;
      unsubscribe?.();
      window.removeEventListener('focus', onFocus);
    };
  }, [api, pushToast, refresh]);

  const handleCreate = async ({ name, email }) => {
    if (demoMode) {
      const demo = {
        id: `demo${Math.random().toString(16).slice(2, 16)}`,
        name, email,
        color: 'violet',
        createdAt: new Date().toISOString(),
        lastOpenedAt: null,
      };
      setProfiles((list) => [demo, ...list]);
      pushToast(`پروفایل «${name}» ایجاد شد (حالت پیش‌نمایش).`);
      return;
    }
    await api.createProfile({ name, email });
    await refresh();
    pushToast(`پروفایل «${name}» ایجاد شد.`);
  };

  const handleEdit = async ({ name, email }) => {
    const target = modal?.profile;
    if (!target) return;
    if (demoMode) {
      setProfiles((list) => list.map((p) => (p.id === target.id ? { ...p, name, email } : p)));
      pushToast('پروفایل به‌روزرسانی شد (حالت پیش‌نمایش).');
      return;
    }
    await api.updateProfile(target.id, { name, email });
    await refresh();
    pushToast('پروفایل به‌روزرسانی شد.');
  };

  const handleDelete = async (target) => {
    if (demoMode) {
      setProfiles((list) => list.filter((p) => p.id !== target.id));
      pushToast(`پروفایل «${target.name}» حذف شد (حالت پیش‌نمایش).`);
      return;
    }
    try {
      await api.deleteProfile(target.id);
      await refresh();
      pushToast(`پروفایل «${target.name}» و تمام داده‌هایش حذف شد.`);
    } catch (error) {
      pushToast(error?.message || 'حذف پروفایل ممکن نشد.', 'error');
    }
  };

  const handleOpen = async (profile) => {
    if (demoMode) {
      pushToast('برای باز کردن پنجرهٔ پروفایل‌ها، اپلیکیشن دسکتاپ را اجرا کنید.', 'info');
      return;
    }
    setOpeningId(profile.id);
    try {
      const result = await api.openProfile(profile.id);
      if (result?.reused) {
        pushToast('این پروفایل هم‌اکنون در حال اجراست — پنجرهٔ Chrome آن را بررسی کنید.', 'info');
      }
    } catch (error) {
      if (error?.code === 'CHROME_NOT_FOUND' || /Chrome پیدا نشد/.test(error?.message ?? '')) {
        setChromeStatus({ found: false, error: error?.message });
      }
      pushToast(error?.message || 'باز کردن پروفایل ممکن نشد.', 'error');
    } finally {
      setOpeningId(null);
    }
  };

  const recheckChrome = async () => {
    if (!api?.refreshChromeStatus) return;
    try {
      const status = await api.refreshChromeStatus();
      setChromeStatus(status);
      pushToast(
        status?.found ? 'Google Chrome پیدا شد — می‌توانید پروفایل‌ها را باز کنید.' : 'هنوز Google Chrome پیدا نشد.',
        status?.found ? 'success' : 'error'
      );
    } catch {
      pushToast('بررسی مجدد Chrome ممکن نشد.', 'error');
    }
  };

  const copyDataRoot = async () => {
    if (!info?.dataRoot) return;
    try {
      await navigator.clipboard.writeText(info.dataRoot);
      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1400);
    } catch {
      pushToast('کپی در کلیپ‌بورد ممکن نشد.', 'error');
    }
  };

  const openDataRoot = async () => {
    if (api?.openDataRoot) {
      const result = await api.openDataRoot();
      if (result?.error) pushToast(result.error, 'error');
    }
  };

  return (
    <div className="app-backdrop relative flex h-full flex-col overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0" />

      {/* ───────────────────────── سربرگ ───────────────────────── */}
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

      {/* ───────────────────────── محتوا ───────────────────────── */}
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
                  chromeAvailable={chromeStatus ? chromeStatus.found !== false : true}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ───────────────────────── پاورقی ───────────────────────── */}
      <footer className="relative z-10 flex h-8 shrink-0 items-center justify-center gap-2 border-t border-tint-line bg-ink-850 text-[10.5px] text-slate-400">
        <span>TechnoBrowse نسخهٔ {info?.version ?? '۱.۰.۰'}</span>
        <span className="text-slate-600">•</span>
        <span>تمام داده‌ها روی همین رایانه ذخیره می‌شود</span>
        <span className="text-slate-600">•</span>
        <span>ورود به سایت‌ها داخل Chrome خودتان انجام می‌شود</span>
      </footer>

      {/* ───────────────────────── مودال‌ها و اعلان‌ها ───────────────────────── */}
      {modal?.type === 'create' && (
        <ProfileFormModal mode="create" onClose={() => setModal(null)} onSubmit={handleCreate} />
      )}
      {modal?.type === 'edit' && (
        <ProfileFormModal mode="edit" initialProfile={modal.profile} onClose={() => setModal(null)} onSubmit={handleEdit} />
      )}
      {modal?.type === 'delete' && (
        <DeleteProfileModal profile={modal.profile} onClose={() => setModal(null)} onConfirm={handleDelete} />
      )}
      <Toasts toasts={toasts} dismiss={dismissToast} />
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-ink-850 px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-4 animate-pulse rounded-full bg-blue-500/15 blur-2xl" />
        <img
          src="./technowin.png"
          alt="نشان TechnoBrowse"
          className="relative h-20 w-20 select-none rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
          draggable={false}
        />
      </div>
      <h2 className="text-xl font-extrabold text-slate-100">هنوز پروفایلی نساخته‌اید</h2>
      <p className="mt-2 max-w-md text-[13px] leading-7 text-slate-400">
        اولین پروفایل خود را بسازید. TechnoBrowse فقط مدیریت می‌کند — سایت‌ها داخل Google Chrome باز می‌شوند و هر پروفایل داده‌ها و نشست‌های خودش را جدا نگه می‌دارد؛ هیچ ورود یا تأیید جیمیلی در این برنامه لازم نیست.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-6
          text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]
          transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]"
      >
        <Plus size={18} strokeWidth={2.5} /> ایجاد پروفایل جدید
      </button>
    </div>
  );
}
