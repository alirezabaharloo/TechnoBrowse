/**
 * Dev launcher: starts Vite, waits for it, then boots Electron against it.
 * Usage: npm run dev
 *
 * Spawns the JS entry points with process.execPath directly (no .cmd shims,
 * no shell) so paths containing spaces (e.g. "C:\Users\me\My Projects\app")
 * work unchanged on Windows.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5173;
const VITE_URL = `http://127.0.0.1:${PORT}`;

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronBin = path.join(root, 'node_modules', 'electron', 'cli.js');
const node = process.execPath;

const children = new Set();
function run(name, script, args, options = {}) {
  const child = spawn(node, [script, ...args], {
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    cwd: root,
    shell: false, // critical: paths with spaces must stay intact
  });
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (name === 'electron') {
      shutdown(code ?? (signal ? 1 : 0));
    }
  });
  children.add(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
          else setTimeout(attempt, 250);
        });
    };
    attempt();
  });
}

console.log('[dev] starting Vite…');
run('vite', viteBin, ['--port', String(PORT), '--strictPort']);

waitForServer(VITE_URL)
  .then(() => {
    console.log('[dev] Vite is ready — launching Electron…');
    run('electron', electronBin, ['.'], { env: { VITE_DEV_SERVER_URL: VITE_URL } });
  })
  .catch((error) => {
    console.error(`[dev] ${error.message}`);
    shutdown(1);
  });
