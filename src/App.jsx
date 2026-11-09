import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { nativeBridge } from './lib/profileUtils';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import ModalLayer from './components/ModalLayer';
import PromoBanner from './components/PromoBanner';

const HOUR = 3600000;
const DAY = 86400000;
const DEMO_PROFILES = [
  { id: 'demo8f3a1b2c4d5e', name: 'حساب کاری', email: 'alex@work.com', color: 'blue', createdAt: new Date(Date.now() - 40 * DAY).toISOString(), lastOpenedAt: new Date(Date.now() - 5 * HOUR).toISOString(), directory: 'profiles/profile-demo8f3a1b2c4d5e', isRunning: false, aiLimitReachedAt: null },
  { id: 'demo1c2d3e4f5a6b', name: 'شخصی', email: 'alex.personal@gmail.com', color: 'emerald', createdAt: new Date(Date.now() - 21 * DAY).toISOString(), lastOpenedAt: new Date(Date.now() - 2 * DAY).toISOString(), directory: 'profiles/profile-demo1c2d3e4f5a6b', isRunning: false, aiLimitReachedAt: Date.now() - (3 * HOUR + 25 * 60000) },
  { id: 'demo9a8b7c6d5e4f', name: 'پروژهٔ مشتری', email: '', color: 'amber', createdAt: new Date(Date.now() - 6 * DAY).toISOString(), lastOpenedAt: null, directory: 'profiles/profile-demo9a8b7c6d5e4f', isRunning: false, aiLimitReachedAt: null },
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
        pushToast(error?.message || 'بارگذاری مرورگرها انجام نشد.', 'error');
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
      const id = `demo${Math.random().toString(16).slice(2, 16)}`;
      const demo = {
        id,
        name, email,
        color: 'violet',
        createdAt: new Date().toISOString(),
        lastOpenedAt: null,
        directory: `profiles/profile-${id}`,
        isRunning: false,
        aiLimitReachedAt: null,
      };
      setProfiles((list) => [demo, ...list]);
      pushToast(`مرورگر «${name}» ساخته شد (حالت پیش‌نمایش).`);
      return;
    }
    await api.createProfile({ name, email });
    await refresh();
    pushToast(`مرورگر «${name}» ساخته شد.`);
  };

  const handleEdit = async ({ name, email }) => {
    const target = modal?.profile;
    if (!target) return;
    if (demoMode) {
      setProfiles((list) => list.map((p) => (p.id === target.id ? { ...p, name, email } : p)));
      pushToast('تغییرات مرورگر ذخیره شد (حالت پیش‌نمایش).');
      return;
    }
    await api.updateProfile(target.id, { name, email });
    await refresh();
    pushToast('تغییرات مرورگر ذخیره شد.');
  };

  const handleDelete = async (target) => {
    if (demoMode) {
      setProfiles((list) => list.filter((p) => p.id !== target.id));
      pushToast(`مرورگر «${target.name}» پاک شد (حالت پیش‌نمایش).`);
      return;
    }
    try {
      await api.deleteProfile(target.id);
      await refresh();
      pushToast(`مرورگر «${target.name}» و همهٔ داده‌هاش پاک شد.`);
    } catch (error) {
      pushToast(error?.message || 'پاک کردن مرورگر انجام نشد.', 'error');
    }
  };

  const handleToggleAiLimit = async (profile, enabled) => {
    if (demoMode) {
      setProfiles((list) =>
        list.map((p) => (p.id === profile.id ? { ...p, aiLimitReachedAt: enabled ? Date.now() : null } : p))
      );
      pushToast(
        enabled ? `این اکانت به محدودیت استفاده روزانه خودش رسیده.` : `علامت محدودیت استفاده برداشته شد.`,
        'info'
      );
      return;
    }
    try {
      await api.setProfileAiLimit(profile.id, enabled);
      await refresh();
      pushToast(
        enabled ? `این اکانت به محدودیت استفاده روزانه خودش رسیده.` : `علامت محدودیت استفاده برداشته شد.`,
        'success'
      );
    } catch (error) {
      pushToast(error?.message || 'ذخیرهٔ وضعیت محدودیت استفاده انجام نشد.', 'error');
    }
  };

  const handleOpen = async (profile) => {
    if (demoMode) {
      pushToast('باز کردن مرورگر فقط تو نسخهٔ دسکتاپ کار می‌کنه؛ اینجا حالت پیش‌نمایشه.', 'info');
      return;
    }
    setOpeningId(profile.id);
    try {
      const result = await api.openProfile(profile.id);
      if (result?.reused) {
        pushToast('این مرورگر همین الان بازه؛ پنجرهٔ Chrome ش رو ببین.', 'info');
      }
    } catch (error) {
      if (error?.code === 'CHROME_NOT_FOUND' || /کروم/.test(error?.message ?? '')) {
        setChromeStatus({ found: false, error: error?.message });
      }
      pushToast(error?.message || 'باز کردن مرورگر انجام نشد.', 'error');
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
        status?.found ? 'کروم پیدا شد؛ می‌تونی مرورگرها رو باز کنی.' : 'هنوز کروم پیدا نشد.',
        status?.found ? 'success' : 'error'
      );
    } catch {
      pushToast('بررسی دوبارهٔ کروم انجام نشد.', 'error');
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

      <Header info={info} profiles={profiles} setModal={setModal} />

      <MainContent
        chromeStatus={chromeStatus}
        api={api}
        recheckChrome={recheckChrome}
        info={info}
        copyDataRoot={copyDataRoot}
        copiedPath={copiedPath}
        openDataRoot={openDataRoot}
        loading={loading}
        profiles={profiles}
        setModal={setModal}
        openingId={openingId}
        handleOpen={handleOpen}
        handleToggleAiLimit={handleToggleAiLimit}
        EmptyState={EmptyState}
      />

      <Footer info={info} />

      <PromoBanner />

      <ModalLayer
        modal={modal}
        setModal={setModal}
        handleCreate={handleCreate}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        toasts={toasts}
        dismissToast={dismissToast}
      />
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
      <h2 className="text-xl font-extrabold text-slate-100">هنوز مرورگری نساختی</h2>
      <p className="mt-2 max-w-md text-[13px] leading-7 text-slate-400">
        اولین مرورگرت رو همین‌جا بساز؛ خبری از ورود و تأیید جیمیل نیست. سایت‌ها رو داخل Chrome باز می‌کنی و هر مرورگر کوکی‌ها و اطلاعات خودش رو جدا نگه می‌داره.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-6
          text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]
          transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]"
      >
        <Plus size={18} strokeWidth={2.5} /> ایجاد مرورگر جدید
      </button>
    </div>
  );
}
