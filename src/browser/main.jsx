import React from 'react';
import { createRoot } from 'react-dom/client';
import BrowserChrome from './BrowserChrome.jsx';
import '../index.css';
import { applyTheme, getInitialTheme } from '../lib/theme';

// Keep <html data-theme> consistent with the persisted choice on boot.
applyTheme(getInitialTheme());


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserChrome />
  </React.StrictMode>
);
