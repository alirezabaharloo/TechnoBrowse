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
 * The toolbar of a profile browser window.
 * The actual web content is rendered by a WebContentsView positioned by the
 * main process just below this toolbar, using THIS profile's session partition.
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

  // ── Tell the main process how tall the toolbar is (it positions the page view) ──
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

  // ── Wire up main-process events ──
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

  // ── Keep the address bar in sync unless the user is editing it ──
  useEffect(() => {
    if (!inputFocused) setInputValue(page.displayUrl || '');
  }, [page.displayUrl, inputFocused]);

  // A fresh navigation dismisses the crash banner
  useEffect(() => {
    if (page.isLoading) setCrashed(false);
  }, [page.isLoading]);

  // Toast auto-dismiss
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
      setToast({ message: result.error || 'That address could not be loaded.', tone: 'error' });
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

  // ── Keyboard shortcuts ──
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
      } else if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        api?.goBack();
      } else if (event.altKey && event.key === 'ArrowRight') {
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
    'flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/[0.06] hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-25';

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-[#0e1730] text-slate-200">
      {/* ══ Measured toolbar (main process reads its height) ══ */}
      <div ref={toolbarRef} className="relative shrink-0 border-b border-black/60 bg-gradient-to-b from-[#141f38] to-[#101a30] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        {/* Nav row */}
        <div className="relative flex h-14 items-center gap-1 px-2">
          {/* Profile isolation chip */}
          {profile && (
            <div
              className="mr-1 hidden h-9 max-w-[150px] select-none items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.08] px-2 sm:flex"
              title={`Isolated session · persist:profile-${profile.id}\nCookies, storage, cache and logins are private to this profile.`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[8px] font-bold text-ink-900 ${
                  AVATAR_STYLES[profile.color] ?? AVATAR_STYLES.blue
                }`}
              >
                {initialsFor(profile.name)}
              </span>
              <span className="truncate text-[11px] font-semibold text-blue-200/90">{profile.name}</span>
              <ShieldCheck size={12} className="shrink-0 text-blue-400" />
            </div>
          )}

          {/* Navigation cluster */}
          <button onClick={goBack} disabled={!page.canGoBack} className={iconButton} title="Back (Alt+←)" aria-label="Back">
            <ChevronLeft size={19} strokeWidth={2.2} />
          </button>
          <button onClick={goForward} disabled={!page.canGoForward} className={iconButton} title="Forward (Alt+→)" aria-label="Forward">
            <ChevronRight size={19} strokeWidth={2.2} />
          </button>
          <button onClick={reload} className={iconButton} title="Reload (Ctrl+R)" aria-label="Reload">
            {page.isLoading ? (
              <Loader2 size={16} className="animate-spin text-blue-400" />
            ) : (
              <RotateCw size={16} strokeWidth={2.2} />
            )}
          </button>
          <button onClick={goHome} className={iconButton} title="TechnoBrowse Start page" aria-label="Home">
            <Home size={16} strokeWidth={2.2} />
          </button>

          {/* Address bar */}
          <div
            className="mx-1 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.07] bg-[#070d1d] px-3.5 transition
              focus-within:border-blue-500/50 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]"
          >
            <SchemeIcon size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
            <input
              ref={urlInputRef}
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
              aria-label="Address bar"
              placeholder="Search Google or type a URL"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-slate-100 placeholder-slate-600 outline-none"
            />
            {inputFocused && inputValue && (
              <button
                onClick={() => {
                  setInputValue('');
                  urlInputRef.current?.focus();
                }}
                className="shrink-0 rounded-full p-0.5 text-slate-500 transition hover:text-slate-200"
                aria-label="Clear address bar"
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* DevTools */}
          <button onClick={toggleDevTools} className={iconButton} title="Toggle Developer Tools (F12)" aria-label="Toggle developer tools">
            <Code2 size={17} strokeWidth={2} />
          </button>
        </div>

        {/* Loading progress hairline */}
        {page.isLoading && (
          <div className="loading-bar">
            <span />
          </div>
        )}

        {/* Crash banner (part of measured toolbar, so the page view is pushed down) */}
        {crashed && (
          <div className="flex h-11 items-center justify-center gap-3 border-t border-rose-500/20 bg-rose-600/95 px-3 text-white">
            <TriangleAlert size={15} className="shrink-0" />
            <p className="truncate text-[12px] font-medium">This page crashed. Your profile data is safe.</p>
            <button
              onClick={() => {
                setCrashed(false);
                reload();
              }}
              className="shrink-0 rounded-md border border-white/40 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-white/15"
            >
              Reload page
            </button>
          </div>
        )}

        {/* Transient error toast (inside the measured area so the page view never covers it) */}
        {toast && (
          <div className="flex h-9 items-center justify-center gap-2 border-t border-white/[0.06] bg-[#131e33] px-3 text-[11.5px] text-amber-200/90">
            <TriangleAlert size={13} className="shrink-0 text-amber-400" />
            <span className="truncate">{toast.message}</span>
            <button onClick={() => setToast(null)} className="shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-200" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Plain-browser preview notice (vite dev / preview only) */}
        {!api && (
          <div className="flex h-9 items-center justify-center border-t border-amber-500/20 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-300">
            Preview mode — the toolbar is connected to a real profile only inside the TechnoBrowse desktop app.
          </div>
        )}
      </div>

      {/* The page area below is rendered by the profile's WebContentsView (mounted by the main process). */}
      <div className="relative flex-1 bg-[#0b1220]" aria-hidden="true" />
    </div>
  );
}
