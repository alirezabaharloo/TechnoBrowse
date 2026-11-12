import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { nativeBridge } from './lib/profileUtils';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import ModalLayer from './components/ModalLayer';
import PromoBanner from './components/PromoBanner';

export default function App() {
  const api = useMemo(() => nativeBridge(), []);

  const [profiles, setProfiles] = useState([]);
  const [info, setInfo] = useState(null);
  const [chromeStatus, setChromeStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [openingId, setOpeningId] = useState(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const dismissToast = useCallback(
    (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    []
  );

  const pushToast = useCallback(
    (message, tone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setToasts((list) => [
        ...list.slice(-2),
        { id, message, tone },
      ]);

      window.setTimeout(() => dismissToast(id), 4600);
    },
    [dismissToast]
  );

  const refresh = useCallback(async () => {
    if (!api) return;

    const list = await api.listProfiles();
    setProfiles(list);
  }, [api]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!api) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const [list, appInfo, chrome] = await Promise.all([
          api.listProfiles(),
          api.getAppInfo(),
          api.getChromeStatus(),
        ]);

        if (!mounted) return;

        setProfiles(list);
        setInfo(appInfo);
        setChromeStatus(chrome);
      } catch (error) {
        pushToast(
          error?.message || 'گرفتن فهرست حساب‌ها با مشکل روبه‌رو شد.',
          'error'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const unsubscribe = api?.onProfilesChanged?.(() => refresh());

    // Refresh when the window regains focus so «باز است» badges and open/running state stay accurate.
    const onFocus = () => refresh();

    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      unsubscribe?.();
      window.removeEventListener('focus', onFocus);
    };
  }, [api, pushToast, refresh]);

  const handleCreate = async ({ name, email }) => {
    if (!api) return;

    await api.createProfile({ name, email });
    await refresh();

    pushToast(`حساب «${name}» ساخته شد.`);
  };

  const handleEdit = async ({ name, email }) => {
    if (!api) return;

    const target = modal?.profile;

    if (!target) return;

    await api.updateProfile(target.id, { name, email });
    await refresh();

    pushToast('اطلاعات حساب تغییر کرد.');
  };

  const handleDelete = async (target) => {
    if (!api) return;

    try {
      await api.deleteProfile(target.id);
      await refresh();

      pushToast(`حساب «${target.name}» و همهٔ اطلاعاتش حذف شد.`);
    } catch (error) {
      pushToast(
        error?.message || 'حساب حذف نشد. دوباره تلاش کن.',
        'error'
      );
    }
  };

  const handleToggleAiLimit = async (profile, enabled) => {
    if (!api) return;

    try {
      await api.setProfileAiLimit(profile.id, enabled);
      await refresh();

      pushToast(
        enabled
          ? `محدودیت استفاده از هوش مصنوعی برای «${profile.name}» ثبت شد.`
          : `محدودیت استفاده از هوش مصنوعی برای «${profile.name}» برداشته شد.`,
        'success'
      );
    } catch (error) {
      pushToast(
        error?.message || 'ذخیرهٔ این تغییر انجام نشد. دوباره تلاش کن.',
        'error'
      );
    }
  };

  const handleOpen = async (profile) => {
    if (!api) return;

    setOpeningId(profile.id);

    try {
      const result = await api.openProfile(profile.id);

      if (result?.reused) {
        pushToast(
          'این حساب از قبل بازه؛ پنجرهٔ Chrome رو بررسی کن.',
          'info'
        );
      }
    } catch (error) {
      if (
        error?.code === 'CHROME_NOT_FOUND' ||
        /Chrome پیدا نشد/.test(error?.message ?? '')
      ) {
        setChromeStatus({
          found: false,
          error: error?.message,
        });
      }

      pushToast(
        error?.message || 'این حساب باز نشد. دوباره تلاش کن.',
        'error'
      );
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
        status?.found
          ? 'Chrome پیدا شد؛ حالا می‌تونی حساب‌هات رو باز کنی.'
          : 'هنوز برنامه Chrome روی سیستم پیدا نشد.',
        status?.found ? 'success' : 'error'
      );
    } catch {
      pushToast(
        'نتونستم وضعیت Chrome رو دوباره بررسی کنم.',
        'error'
      );
    }
  };

  const copyDataRoot = async () => {
    if (!info?.dataRoot) return;

    try {
      await navigator.clipboard.writeText(info.dataRoot);

      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1400);
    } catch {
      pushToast('کپی کردن متن انجام نشد.', 'error');
    }
  };

  const openDataRoot = async () => {
    if (api?.openDataRoot) {
      const result = await api.openDataRoot();

      if (result?.error) {
        pushToast(result.error, 'error');
      }
    }
  };

  // TechnoBrowse is a desktop-only Electron app. Without the preload bridge
  // there is nothing safe to fall back to — fail loudly, never silently.
  if (!api) {
    return <BridgeRequired />;
  }

  return (
    <div className="app-backdrop relative flex h-full flex-col overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0" />

      <Header
        info={info}
        profiles={profiles}
        setModal={setModal}
      />

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

/**
 * Rendered when window.technobrowse (the Electron preload bridge) is missing —
 * i.e. someone opened the page in a plain browser. Deliberately NOT a demo
 * mode: no fake data, no simulated actions, just a clear explanation.
 */
function BridgeRequired() {
  return (
    <div className="app-backdrop relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="app-grid pointer-events-none absolute inset-0" />

      <img
        src="./technowin.png"
        alt="لوگوی TechnoBrowse"
        className="relative h-20 w-20 select-none rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
        draggable={false}
      />

      <h1 className="relative mt-6 text-2xl font-extrabold text-slate-100">
        اتصال به هستهٔ TechnoBrowse برقرار نشد
      </h1>

      <p className="relative mt-3 max-w-md text-[13px] leading-7 text-slate-400">
        TechnoBrowse فقط داخل اپلیکیشن دسکتاپش اجرا می‌شه و نسخهٔ تحت وب نداره. اگر این صفحه رو در مرورگر معمولی باز کرده‌ای، همون فایل رو ببند و برنامهٔ TechnoBrowse رو اجرا کن.
      </p>

      <p className="relative mt-2 max-w-md text-[12px] leading-6 text-slate-500">
        اگر داخل خودِ اپ دسکتاپ این پیام رو می‌بینی، یعنی preload bridge بارگذاری نشده — پس نصب یا بیلد برنامه مشکل داره و باید دوباره نصب بشه.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="relative mt-6 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-6
          text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]
          transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]"
      >
        دوباره تلاش کن
      </button>
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
          alt="لوگوی TechnoBrowse"
          className="relative h-20 w-20 select-none rounded-2xl shadow-[0_16px_40px_rgba(15,23,42,0.35)]"
          draggable={false}
        />
      </div>

      <h2 className="text-xl font-extrabold text-slate-100">
        هنوز هیچ حسابی نساختی
      </h2>

      <p className="mt-2 max-w-md text-[13px] leading-7 text-slate-400">
        اولین حساب رو بساز! TechnoBrowse فقط حساب‌هات رو مدیریت می‌کنه؛ سایت‌ها توی Chrome باز می‌شن و اطلاعات هر حساب جدا از بقیه می‌مونه. برای استفاده از این برنامه هم لازم نیست از داخلش وارد Gmail بشی.
      </p>

      <button
        onClick={onCreate}
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-6
          text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]
          transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]"
      >
        <Plus size={18} strokeWidth={2.5} /> ساخت حساب جدید
      </button>
    </div>
  );
}
