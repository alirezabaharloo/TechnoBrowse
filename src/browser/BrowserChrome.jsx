import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  Compass,
  Globe,
  Home,
  Loader2,
  Lock,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { AVATAR_STYLES, chromeBridge, initialsFor } from '../lib/profileUtils';

const EMPTY_PAGE = {
  url: '',
  displayUrl: '',
  title: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
};

/**
 * نوار ابزار پنجرهٔ مرورگر پروفایل.
 * محتوای وب توسط WebContentsView که زیر همین نوار قرار می‌گیرد، با نشست مخصوص
 * همین پروفایل رندر می‌شود.
 */
export default function BrowserChrome() {
  const api = useMemo(() => chromeBridge(), []);

  const toolbarRef = useRef(null);
  const urlInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState(EMPTY_PAGE);
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [toast, setToast] = useState(null); // { message, tone }
  const [crashed, setCrashed] = useState(false);

  // ── به پردازش اصلی می‌گوییم نوار ابزار چند پیکسل ارتفاع دارد (او محل نمایش صفحه را تنظیم می‌کند) ──
  useEffect(() => {
    if (!api || !toolbarRef.current) return undefined;
    const el = toolbarRef.current;
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height > 0) api.setToolbarHeight(height);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
    };
  }, [api]);

  // ── رویدادهای پردازش اصلی ──
  useEffect(() => {
    if (!api) return undefined;
    let mounted = true;
    api.ready().then((info) => {
      if (mounted) setProfile(info);
    }).catch(() => {});
    const offState = api.onState((state) => {
      setPage({ ...EMPTY_PAGE, ...state });
    });
    const offToast = api.onToast((payload) => {
      if (payload?.message) setToast({ message: payload.message, tone: payload.tone || 'error' });
    });
    const offCrashed = api.onCrashed(() => setCrashed(true));
    return () => {
      mounted = false;
      offState?.();
      offToast?.();
      offCrashed?.();
    };
  }, [api]);

  // ── همگام‌سازی نوار نشانی با صفحهٔ جاری (مگر اینکه کاربر در حال تایپ باشد) ──
  useEffect(() => {
    if (!inputFocused) setInputValue(page.displayUrl || '');
  }, [page.displayUrl, inputFocused]);

  // ناوبری تازه نوار خطای کرش را می‌بندد
  useEffect(() => {
    if (page.isLoading) setCrashed(false);
  }, [page.isLoading]);

  // پنهان‌سازی خودکار اعلان
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submitNavigation = useCallback(async () => {
    if (!api) return;
    const value = inputValue.trim();
    if (!value) return;
    const result = await api.navigate(value);
    if (result && result.ok === false) {
      setToast({ message: result.error || 'بارگذاری این نشانی ممکن نشد.', tone: 'error' });
      urlInputRef.current?.select();
    } else {
      urlInputRef.current?.blur();
    }
  }, [api, inputValue]);

  const goBack = useCallback(() => api?.goBack(), [api]);
  const goForward = useCallback(() => api?.goForward(), [api]);
  const reload = useCallback(() => api?.reload(), [api]);
  const goHome = useCallback(() => api?.goHome(), [api]);
  const toggleDevTools = useCallback(() => api?.toggleDevTools(), [api]);

  // ── میانبرهای صفحه‌کلید ──
  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'l') {
        event.preventDefault();
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      } else if (mod && key === 'r') {
        event.preventDefault();
        api?.reload();
      } else if (event.key === 'F12' || (mod && event.shiftKey && (key === 'i' || key === 'c'))) {
        event.preventDefault();
        api?.toggleDevTools();
      } else if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        api?.goBack(); // در رابط راست‌چین: بازگشت رو به «راست» است
      } else if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        api?.goForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [api]);

  const SchemeIcon = useMemo(() => {
    const url = page.displayUrl || '';
    if (url.startsWith('technobrowse://')) return Compass;
    if (url.startsWith('https://')) return Lock;
    return Globe;
  }, [page.displayUrl]);

  const iconButton =
    'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-100 active:scale-95 disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ink-900 text-slate-200">
      {/* ══ نوار ابزار (ارتفاعش توسط پردازش اصلی خوانده می‌شود) ══ */}
      <div ref={toolbarRef} className="relative shrink-0 border-b border-white/10 bg-gradient-to-b from-ink-850 to-ink-900 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
        {/* ردیف ناوبری */}
        <div className="relative flex h-14 items-center gap-1 px-2">
          {/* چیپ ایزولهٔ پروفایل */}
          {profile && (
            <div
              className="me-1 hidden h-9 max-w-[160px] select-none items-center gap-2 rounded-lg border border-accent-400/20 bg-accent-400/[0.08] px-2 sm:flex"
              title={`نشست ایزوله · persist:profile-${profile.id}\nکوکی‌ها، حافظه و کش این پروفایل خصوصی است.`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[8px] font-bold text-white ${
                  AVATAR_STYLES[profile.color] ?? AVATAR_STYLES.blue
                }`}
              >
                {initialsFor(profile.name)}
              </span>
              <span className="truncate text-[11px] font-bold text-accent-400">{profile.name}</span>
              <ShieldCheck size={12} className="shrink-0 text-accent-400" />
            </div>
          )}

          {/* دکمه‌های ناوبری (در رابط راست‌چین: بازگشت → | جلو ←) */}
          <button onClick={goBack} disabled={!page.canGoBack} className={iconButton} title="بازگشت (Alt+→)" aria-label="بازگشت">
            <ChevronRight size={19} strokeWidth={2.2} />
          </button>
          <button onClick={goForward} disabled={!page.canGoForward} className={iconButton} title="جلو (Alt+←)" aria-label="جلو">
            <ChevronLeft size={19} strokeWidth={2.2} />
          </button>
          <button onClick={reload} className={iconButton} title="بارگذاری مجدد (Ctrl+R)" aria-label="بارگذاری مجدد">
            {page.isLoading ? (
              <Loader2 size={16} className="animate-spin text-accent-400" />
            ) : (
              <RotateCw size={16} strokeWidth={2.2} />
            )}
          </button>
          <button onClick={goHome} className={iconButton} title="صفحهٔ شروع تکنوبروز" aria-label="خانه">
            <Home size={16} strokeWidth={2.2} />
          </button>

          {/* نوار نشانی (نشانی همیشه چپ‌چین) */}
          <div
            className="mx-1 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-ink-800 px-3.5 shadow-sm transition
              focus-within:border-accent-400/50 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
          >
            <SchemeIcon size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
            <input
              ref={urlInputRef}
              dir="ltr"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onFocus={() => {
                setInputFocused(true);
                urlInputRef.current?.select();
              }}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitNavigation();
                } else if (event.key === 'Escape') {
                  setInputValue(page.displayUrl || '');
                  urlInputRef.current?.blur();
                }
              }}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              inputMode="url"
              aria-label="نوار نشانی"
              placeholder="جستجو در گوگل یا نشانی اینترنتی بنویسید"
              className="h-full min-w-0 flex-1 bg-transparent text-left text-[13px] text-slate-100 placeholder-slate-500 outline-none"
            />
            {inputFocused && inputValue && (
              <button
                onClick={() => {
                  setInputValue('');
                  urlInputRef.current?.focus();
                }}
                className="shrink-0 rounded-full p-0.5 text-slate-500 transition hover:text-slate-200"
                aria-label="پاک کردن نوار نشانی"
                title="پاک کردن"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* ابزارهای توسعه‌دهنده */}
          <button onClick={toggleDevTools} className={iconButton} title="ابزارهای توسعه‌دهنده (F12)" aria-label="ابزارهای توسعه‌دهنده">
            <Code2 size={17} strokeWidth={2} />
          </button>
        </div>

        {/* خط پیشرفت بارگذاری */}
        {page.isLoading && (
          <div className="loading-bar">
            <span />
          </div>
        )}

        {/* نوار خطای کرش (بخشی از ارتفاع نوار ابزار است تا صفحه زیرش قرار بگیرد) */}
        {crashed && (
          <div className="flex h-11 items-center justify-center gap-3 border-t border-rose-500/30 bg-rose-600 px-3 text-white">
            <TriangleAlert size={15} className="shrink-0" />
            <p className="truncate text-[12px] font-medium">این صفحه از کار افتاد. داده‌های پروفایل شما محفوظ است.</p>
            <button
              onClick={() => {
                setCrashed(false);
                reload();
              }}
              className="shrink-0 rounded-md border border-white/50 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-ink-800/15"
            >
              بارگذاری دوباره
            </button>
          </div>
        )}

        {/* اعلان موقت خطا (داخل ناحیهٔ اندازه‌گیری‌شده تا صفحه رویش نیاید) */}
        {toast && (
          <div className="flex h-9 items-center justify-center gap-2 border-t border-white/5 bg-amber-400/10 px-3 text-[11.5px] text-amber-200">
            <TriangleAlert size={13} className="shrink-0 text-amber-500" />
            <span className="truncate">{toast.message}</span>
            <button onClick={() => setToast(null)} className="shrink-0 rounded p-0.5 text-amber-500 transition hover:text-amber-200" aria-label="بستن اعلان">
              <X size={13} />
            </button>
          </div>
        )}

        {/* اعلان حالت پیش‌نمایش (فقط خارج از اپلیکیشن دسکتاپ) */}
        {!api && (
          <div className="flex h-9 items-center justify-center border-t border-amber-400/30 bg-amber-400/10 px-3 text-[11px] font-medium text-amber-200">
            حالت پیش‌نمایش — نوار ابزار فقط داخل اپلیکیشن دسکتاپ تکنوبروز به پروفایل واقعی متصل می‌شود.
          </div>
        )}
      </div>

      {/* ناحیهٔ صفحه — توسط WebContentsView پروفایل (که پردازش اصلی نصب می‌کند) رندر می‌شود. */}
      <div className="relative flex-1 bg-ink-900" aria-hidden="true" />
    </div>
  );
}
