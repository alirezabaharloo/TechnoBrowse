'use strict';

/**
 * Preload for the browser chrome (toolbar) of a profile window.
 * The page being browsed gets NO access to any of this — this bridge exists
 * only for the chrome UI, which is part of the app.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

const subscribe = (channel) => (callback) => {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('technoBrowseChrome', {
  /** @returns {Promise<{id,name,email,color,partition}>} */
  ready: () => invoke('chrome:ready'),
  /** Navigate to a typed URL or search query. @returns {Promise<{ok:boolean, url?:string, error?:string, isSearch?:boolean}>} */
  navigate: (input) => invoke('chrome:navigate', { input }),
  goBack: () => invoke('chrome:go-back'),
  goForward: () => invoke('chrome:go-forward'),
  reload: () => invoke('chrome:reload'),
  goHome: () => invoke('chrome:go-home'),
  toggleDevTools: () => invoke('chrome:toggle-devtools'),
  /** Tell the main process how tall the toolbar is so the page view can be positioned. */
  setToolbarHeight: (height) => invoke('chrome:set-toolbar-height', { height }),
  /** Subscribe to page-state updates { url, displayUrl, title, isLoading, canGoBack, canGoForward }. */
  onState: subscribe('chrome:state'),
  /** Subscribe to transient error toasts { message, tone }. */
  onToast: subscribe('chrome:toast'),
  /** Subscribe to renderer-crash notifications { reason }. */
  onCrashed: subscribe('chrome:crashed'),
});
