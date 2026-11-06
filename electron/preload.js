'use strict';

/**
 * Preload for the dashboard window.
 * Exposes a minimal, typed API surface to the React app —
 * no Node.js, no filesystem, no surprises.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('technobrowse', {
  /** @returns {Promise<Array<Profile & {isRunning: boolean}>>} */
  listProfiles: () => invoke('profiles:list'),
  /** @returns {Promise<Profile>} */
  createProfile: (input) => invoke('profiles:create', { name: input?.name, email: input?.email }),
  /** @returns {Promise<Profile>} */
  updateProfile: (id, input) => invoke('profiles:update', { id, name: input?.name, email: input?.email }),
  /** @returns {Promise<{ok: true}>} */
  deleteProfile: (id) => invoke('profiles:delete', { id }),
  /** @returns {Promise<{ok: true, reused: boolean}>} */
  openProfile: (id) => invoke('profiles:open', { id }),
  /** @returns {Promise<AppInfo>} */
  getAppInfo: () => invoke('app:info'),
  /** @returns {Promise<{found: true, executablePath: string, source: string} | {found: false, error: string}>} */
  getChromeStatus: () => invoke('app:chrome-status'),
  /** Re-check Chrome detection (the user may have just installed it). */
  refreshChromeStatus: () => invoke('app:refresh-chrome'),
  /** Open the official Chrome download page — only from an explicit user click. */
  openChromeDownload: () => invoke('app:open-chrome-download'),
  /** Open the local data folder in the system file manager. */
  openDataRoot: () => invoke('app:open-data-root'),
  /** Subscribe to profile-list changes. Returns an unsubscribe fn. */
  onProfilesChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('profiles:changed', listener);
    return () => ipcRenderer.removeListener('profiles:changed', listener);
  },
});
