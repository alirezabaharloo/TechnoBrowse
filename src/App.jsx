import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Copy,
  Check,
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
  { id: 'demo8f3a1b2c4d5e', name: 'Work Account', email: 'alex@work.com', color: 'blue', createdAt: new Date(Date.now() - 86400000 * 40).toISOString(), lastOpenedAt: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 'demo1c2d3e4f5a6b', name: 'Personal', email: 'alex.personal@gmail.com', color: 'emerald', createdAt: new Date(Date.now() - 86400000 * 21).toISOString(), lastOpenedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'demo9a8b7c6d5e4f', name: 'Freelance Client', email: '', color: 'amber', createdAt: new Date(Date.now() - 86400000 * 6).toISOString(), lastOpenedAt: null },
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
        pushToast(error?.message || 'Could not load profiles.', 'error');
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
      pushToast(`Profile “${name}” created (preview mode).`);
      return;
    }
    await api.createProfile({ name, email });
    await refresh();
    pushToast(`Profile “${name}” created.`);
  };

  const handleEdit = async ({ name, email }) => {
    const target = modal?.profile;
    if (!target) return;
    if (demoMode) {
      setProfiles((list) => list.map((p) => (p.id === target.id ? { ...p, name, email } : p)));
      pushToast('Profile updated (preview mode).');
      return;
    }
    await api.updateProfile(target.id, { name, email });
    await refresh();
    pushToast('Profile updated.');
  };

  const handleDelete = async (target) => {
    if (demoMode) {
      setProfiles((list) => list.filter((p) => p.id !== target.id));
      pushToast(`Profile “${target.name}” deleted (preview mode).`);
      return;
    }
    await api.deleteProfile(target.id);
    await refresh();
    pushToast(`Profile “${target.name}” and all its data were deleted.`);
  };

  const handleOpen = async (profile) => {
    if (demoMode) {
      pushToast('Open TechnoBrowse on your desktop to launch profile windows.', 'info');
      return;
    }
    setOpeningId(profile.id);
    try {
      await api.openProfile(profile.id);
    } catch (error) {
      pushToast(error?.message || 'Could not open the profile.', 'error');
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
      pushToast('Could not copy to the clipboard.', 'error');
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

      {/* ───────────────────────── Header ───────────────────────── */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/5 bg-ink-900/60 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-600 via-accent-500 to-accent-400 shadow-[0_6px_20px_rgba(37,99,235,0.45)]">
            <Compass size={21} strokeWidth={2.2} className="text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-[16px] font-bold tracking-tight text-slate-100">
              Techno<span className="text-blue-400">Browse</span>
            </h1>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Isolated Multi-Profile Browser
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {info?.portable && (
            <span className="hidden rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-blue-300 sm:inline-block">
              Portable
            </span>
          )}
          <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-ink-800 px-3 py-1.5 text-[11px] font-medium text-slate-400 md:inline-flex">
            <Users size={12} />
            {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'}
          </span>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-4
              text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.45)]
              transition hover:from-accent-500 hover:to-accent-400 hover:shadow-[0_10px_30px_rgba(59,130,246,0.5)] active:scale-[0.98]"
          >
            <Plus size={17} strokeWidth={2.5} />
            <span className="hidden sm:inline">Create New Profile</span>
            <span className="sm:hidden">New Profile</span>
          </button>
        </div>
      </header>

      {/* ───────────────────────── Content ───────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-6">
          {/* Isolation banner */}
          <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-blue-500/15 bg-gradient-to-r from-blue-600/[0.12] via-ink-800/80 to-ink-800/80 p-4 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10">
                <ShieldCheck size={22} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-100">True profile isolation</p>
                <p className="text-[11.5px] leading-snug text-slate-500">
                  Cookies, logins, local storage, cache and IndexedDB never leave a profile — each one is its own
                  persistent Chromium partition.
                </p>
              </div>
            </div>
            {info?.dataRoot && (
              <div className="flex items-center gap-1.5 md:ml-auto">
                <code className="max-w-[220px] truncate rounded-lg border border-white/5 bg-ink-850 px-2 py-1.5 font-mono text-[10px] text-slate-500" title={info.dataRoot}>
                  {info.dataRoot}
                </code>
                <button onClick={copyDataRoot} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" title="Copy data folder path" aria-label="Copy data folder path">
                  {copiedPath ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <button onClick={openDataRoot} className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" title="Open data folder" aria-label="Open data folder">
                  <FolderOpen size={14} />
                </button>
              </div>
            )}
          </section>

          {/* Profiles grid / states */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((n) => (
                <div key={n} className="shimmer h-56 rounded-2xl border border-white/5 bg-ink-800/60" />
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

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="relative z-10 flex h-8 shrink-0 items-center justify-center border-t border-white/5 bg-ink-900/60 text-[10.5px] text-slate-600">
        TechnoBrowse v{info?.version ?? '1.0.0'}
        <span className="mx-2 text-slate-700">•</span>All data stays on this computer
        <span className="mx-2 text-slate-700">•</span>Logins are handled by you, inside each profile window
      </footer>

      {/* ───────────────────────── Modals & toasts ───────────────────────── */}
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
    <div className="flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-4 animate-pulse rounded-full bg-blue-500/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-500/25 bg-gradient-to-br from-ink-750 to-ink-800">
          <Compass size={38} className="text-blue-400" strokeWidth={1.6} />
        </div>
      </div>
      <h2 className="text-xl font-semibold text-slate-100">No profiles yet</h2>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
        Create your first isolated profile. No sign-in or Gmail verification is needed — you log into websites
        yourself, directly inside each profile window, and every profile keeps its own session.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-accent-600 to-accent-500 px-6
          text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.45)]
          transition hover:from-accent-500 hover:to-accent-400 active:scale-[0.98]"
      >
        <Plus size={18} strokeWidth={2.5} /> Create New Profile
      </button>
    </div>
  );
}
