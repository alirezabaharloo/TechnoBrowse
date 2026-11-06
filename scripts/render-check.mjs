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
  if (!appHtml.includes('Techno')) throw new Error('App render missing brand markup');
  console.log(`PASS  dashboard <App/> rendered (${appHtml.length} bytes)`);

  const { default: BrowserChrome } = await server.ssrLoadModule('/src/browser/BrowserChrome.jsx');
  const chromeHtml = renderToString(React.createElement(BrowserChrome));
  if (!chromeHtml.includes('Address bar')) throw new Error('BrowserChrome render missing address bar');
  console.log(`PASS  <BrowserChrome/> rendered (${chromeHtml.length} bytes)`);

  process.exitCode = 0;
} catch (error) {
  console.error('RENDER CHECK FAILED:', error);
  process.exitCode = 1;
} finally {
  await server.close();
}
