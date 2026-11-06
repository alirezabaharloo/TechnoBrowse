import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FolderOpen,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { nativeBridge } from './lib/profileUtils';
import ProfileCard from './components/ProfileCard';
import ProfileFormModal from './components/ProfileFormModal';
import DeleteProfileModal from './components/DeleteProfileModal';
import Toasts from './components/Toasts';

const DEMO_PROFILES = [
  { id: 'demo8f3a1b2c4d5e', name: 'حساب کاری', email: 'alex@work.com', color: 'blue', createdAt: new Date(Date.now() - 86400000 * 40).toISOString(), lastOpenedAt: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 'demo1c2d3e4f5a6b', name: 'شخصی', email: 'alex.personal@gmail.com', color: 'emerald', createdAt: new Date(Date.now() - 86400000 * 21).toISOString(), lastOpenedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'demo9a8b7c6d5e4f', name: 'پروژهٔ مشتری', email: '', color: 'amber', createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), lastOpenedAt: null },
];

export default function App() {
  const api = useMemo(() => nativeBridge(), []);
  const demoMode = !api;

  const [profiles, setProfiles] = useState([]);
  const [info, setInfo] = useState(null);
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
          const [list, appInfo] = await Promise.all([api.listProfiles(), api.getAppInfo()]);
          if (!mounted) return;
          setProfiles(list);
          setInfo(appInfo);
        } else {
          setProfiles(DEMO_PROFILES);
        }
      } catch (error) {
        pushToast(error?.message || 'بارگذاری پروفایل‌ها ممکن نشد.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const unsubscribe = api?.onProfilesChanged?.(() => refresh());
    return () => {
      mounted = false;
      unsubscribe?.();
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
    await api.deleteProfile(target.id);
    await refresh();
    pushToast(`پروفایل «${target.name}» و تمام داده‌هایش حذف شد.`);
  };

  const handleOpen = async (profile) => {
    if (demoMode) {
      pushToast('برای باز کردن پنجرهٔ پروفایل‌ها، اپلیکیشن دسکتاپ را اجرا کنید.', 'info');
      return;
    }
    setOpeningId(profile.id);
    try {
      await api.openProfile(profile.id);
    } catch (error) {
      pushToast(error?.message || 'باز کردن پروفایل ممکن نشد.', 'error');
    } finally {
      setOpeningId(null);
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
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-900/10 bg-white/75 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <img
            src="./technowin.png"
            alt="نشان تکنوبروز"
            className="h-10 w-10 select-none rounded-xl shadow-[0_6px_18px_rgba(15,23,42,0.35)]"
            draggable={false}
          />
          <div className="leading-tight">
            <h1 className="text-[17px] font-extrabold tracking-tight text-slate-800">
              تکنو<span className="text-accent-600">بروز</span>
            </h1>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              مرورگر ایزولهٔ چندپروفایلی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {info?.portable && (
            <span className="hidden rounded-full border border-accent-600/25 bg-accent-600/10 px-3 py-1 text-[10.5px] font-bold tracking-wider text-accent-600 sm:inline-block">
              نسخهٔ پرتابل
            </span>
          )}
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-900/10 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm md:inline-flex">
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
          {/* بنر ایزوله‌سازی */}
          <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent-600/20 bg-gradient-to-l from-blue-500/10 via-white to-white p-4 shadow-sm md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent-600/25 bg-accent-600/10">
                <ShieldCheck size={22} className="text-accent-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-800">ایزوله‌سازی واقعی پروفایل‌ها</p>
                <p className="text-[11.5px] leading-6 text-slate-500">
                  کوکی‌ها، نشست‌های ورود، حافظهٔ محلی، کش و IndexedDB هیچ‌گاه از یک پروفایل خارج نمی‌شوند — هر پروفایل یک پارتیشن پایدار کرومیوم است.
                </p>
              </div>
            </div>
            {info?.dataRoot && (
              <div className="flex items-center gap-1.5 ms-auto" dir="ltr">
                <code className="max-w-[220px] truncate rounded-lg border border-slate-900/10 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-500" title={info.dataRoot}>
                  {info.dataRoot}
                </code>
                <button onClick={copyDataRoot} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" title="کپی مسیر پوشهٔ داده" aria-label="کپی مسیر پوشهٔ داده">
                  {copiedPath ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
                <button onClick={openDataRoot} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" title="باز کردن پوشهٔ داده" aria-label="باز کردن پوشهٔ داده">
                  <FolderOpen size={14} />
                </button>
              </div>
            )}
          </section>

          {/* شبکهٔ پروفایل‌ها / حالت‌های مختلف */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((n) => (
                <div key={n} className="shimmer h-56 rounded-2xl border border-slate-900/[0.06] bg-white/70" />
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
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ───────────────────────── پاورقی ───────────────────────── */}
      <footer className="relative z-10 flex h-8 shrink-0 items-center justify-center gap-2 border-t border-slate-900/5 bg-white/70 text-[10.5px] text-slate-500">
        <span>تکنوبروز نسخهٔ {info?.version ?? '۱.۰.۰'}</span>
        <span className="text-slate-300">•</span>
        <span>تمام داده‌ها روی همین رایانه ذخیره می‌شود</span>
        <span className="text-slate-300">•</span>
        <span>ورود به سایت‌ها را خودتان انجام می‌دهید</span>
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
    <div className="flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-4 animate-pulse rounded-full bg-blue-500/15 blur-2xl" />
        <img
          src="./technowin.png"
          alt="نشان تکنوبروز"
          className="relative h-20 w-20 select-none rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
          draggable={false}
        />
      </div>
      <h2 className="text-xl font-extrabold text-slate-800">هنوز پروفایلی نساخته‌اید</h2>
      <p className="mt-2 max-w-md text-[13px] leading-7 text-slate-500">
        اولین پروفایل ایزولهٔ خود را بسازید. هیچ ورود یا تأیید جیمیلی لازم نیست — خودتان داخل پنجرهٔ پروفایل وارد می‌شوید و هر پروفایل نشست و داده‌های خودش را نگه می‌دارد.
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
