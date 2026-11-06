import React from 'react';
import { createRoot } from 'react-dom/client';
import BrowserChrome from './BrowserChrome.jsx';
import '../index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserChrome />
  </React.StrictMode>
);
