'use strict';

/**
 * Preload for the dashboard window.
 * Exposes a minimal, typed API surface to the React app — no Node, no cookies, no sessions.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('technobrowse', {
  /** @returns {Promise<Array<Profile>>} */
  listProfiles: () => invoke('profiles:list'),
  /** @returns {Promise<Profile>} */
  createProfile: (input) => invoke('profiles:create', { name: input?.name, email: input?.email }),
  /** @returns {Promise<Profile>} */
  updateProfile: (id, input) => invoke('profiles:update', { id, name: input?.name, email: input?.email }),
  /** @returns {Promise<{ok: true}>} */
  deleteProfile: (id) => invoke('profiles:delete', { id }),
  /** @returns {Promise<{reused: boolean}>} */
  openProfile: (id) => invoke('profiles:open', { id }),
  /** @returns {Promise<AppInfo>} */
  getAppInfo: () => invoke('app:info'),
  /** Open the local data folder in the system file manager. */
  openDataRoot: () => invoke('app:open-data-root'),
  /** Subscribe to profile-list changes (fired after create/update/delete). Returns an unsubscribe fn. */
  onProfilesChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('profiles:changed', listener);
    return () => ipcRenderer.removeListener('profiles:changed', listener);
  },
});
