/**
 * Render smoke check: server-renders both React entries to catch render-time crashes
 * (bad imports, undefined components, hook misuse) without needing a display.
 * Run: npm run render-check
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { default: App } = await server.ssrLoadModule('/src/App.jsx');
  const appHtml = renderToString(React.createElement(App));
  if (!appHtml.includes('تکنو')) throw new Error('رندر داشبورد فاقد محتوای برند است');
  console.log(`PASS  داشبورد <App/> رندر شد (${appHtml.length} بایت)`);

  const { default: BrowserChrome } = await server.ssrLoadModule('/src/browser/BrowserChrome.jsx');
  const chromeHtml = renderToString(React.createElement(BrowserChrome));
  if (!chromeHtml.includes('نوار نشانی')) throw new Error('رندر نوار ابزار فاقد نوار نشانی است');
  console.log(`PASS  <BrowserChrome/> رندر شد (${chromeHtml.length} بایت)`);

  process.exitCode = 0;
} catch (error) {
  console.error('RENDER CHECK FAILED:', error);
  process.exitCode = 1;
} finally {
  await server.close();
}
