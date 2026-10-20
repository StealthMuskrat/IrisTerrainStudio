import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { compareProbe } from './compare.mjs';

const here = new URL('./', import.meta.url);
const target = new URL('target/', here);
let chrome;
let socket;
let server;
let pending = new Map();
const eventWaiters = new Map();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

try {
  const native = JSON.parse(await readFile(new URL('native.json', target), 'utf8'));
  const plan = native.cases.map(({ id, seed, x, y, z }) => ({ id, seed, x, y, z }));
  const rngNative = JSON.parse(await readFile(new URL('rng-native.json', target), 'utf8'));
  const rngPlan = rngNative.cases.map(({ id, seed, textSeed, signature }) => ({ id, seed, textSeed, signature }));
  const wasm = await readFile(new URL('wasm/probe.wasm', target));
  const runtime = await readFile(new URL('wasm/probe.wasm-runtime.js', target));
  const routes = new Map([
    ['/', ['text/html', '<!doctype html><title>VolmLib portability probe</title>']],
    ['/inputs.json', ['application/json', JSON.stringify(plan)]],
    ['/rng-inputs.json', ['application/json', JSON.stringify(rngPlan)]],
    ['/probe-worker.js', ['text/javascript', await readFile(new URL('browser/worker.js', here))]],
    ['/probe.wasm', ['application/wasm', wasm]],
    ['/probe.wasm-runtime.js', ['text/javascript', runtime]],
  ]);
  server = createServer((request, response) => {
    const route = routes.get(request.url);
    if (!route) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': route[0], 'Cache-Control': 'no-store' }).end(route[1]);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  await mkdir(new URL('chrome-profile/', target), { recursive: true });
  chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox',
    '--disable-dev-shm-usage', '--no-first-run', '--remote-debugging-port=0',
    `--user-data-dir=${new URL('chrome-profile/', target).pathname}`], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome DevTools startup timed out')), 20000);
    let stderr = '';
    chrome.on('error', error => { clearTimeout(timer); reject(error); });
    chrome.on('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}: ${stderr.slice(-2000)}`)); });
    chrome.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-10000);
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await once(socket, 'open');
  let nextId = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const eventKey = `${message.sessionId}:${message.method}`;
    if (eventWaiters.has(eventKey)) {
      const { resolve, timer } = eventWaiters.get(eventKey);
      eventWaiters.delete(eventKey);
      clearTimeout(timer);
      resolve(message.params);
    }
    if (!pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  });
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 180000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const version = await command('Browser.getVersion');
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  const expression = `(async () => {
    const cases = await (await fetch('${origin}/inputs.json')).json();
    const rngCases = await (await fetch('${origin}/rng-inputs.json')).json();
    const run = (order, kind, inputs) => new Promise((resolve, reject) => {
      const worker = new Worker('${origin}/probe-worker.js');
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker timed out')); }, 120000);
      worker.onmessage = event => { clearTimeout(timer); worker.terminate(); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
      worker.postMessage({ cases: inputs, order, kind });
    });
    const orders = ['forward', 'reverse', 'shuffle'];
    const noise = await Promise.all(orders.map(order => run(order, 'noise', cases)));
    const rng = await Promise.all(orders.map(order => run(order, 'rng', rngCases)));
    return { noise, rng };
  })()`;
  // Wait until the target has navigated to its local origin before executing fetch/worker code.
  await command('Page.enable', {}, sessionId);
  const pageLoaded = new Promise((resolve, reject) => {
    const key = `${sessionId}:Page.loadEventFired`;
    const timer = setTimeout(() => { eventWaiters.delete(key); reject(new Error('Page navigation timed out')); }, 30000);
    eventWaiters.set(key, { resolve, timer });
  });
  await command('Page.navigate', { url: origin }, sessionId);
  await pageLoaded;
  const evaluation = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (evaluation.exceptionDetails) throw new Error(JSON.stringify(evaluation.exceptionDetails));
  const workers = evaluation.result.value;
  const comparison = compareProbe(native, workers.noise);
  const rngComparison = compareProbe(rngNative, workers.rng);
  const report = {
    formatVersion: 2, scope: 'volmlib-noise-and-rng-portability', releaseMatchVerified: false,
    irisTerrainParityVerified: false, equal: comparison.equal && rngComparison.equal,
    comparisons: comparison.comparisons + rngComparison.comparisons,
    mismatches: comparison.mismatches + rngComparison.mismatches,
    noise: comparison, rng: rngComparison, browser: version,
    sourceManifestSha256: hash(await readFile(new URL('source-lock.json', here))),
    wasmSha256: hash(wasm), runtimeSha256: hash(runtime),
    nativeCaptureSha256: hash(await readFile(new URL('native.json', target))),
    nativeRngCaptureSha256: hash(await readFile(new URL('rng-native.json', target))),
  };
  await writeFile(new URL('browser.json', target), JSON.stringify(workers));
  await writeFile(new URL('report.json', target), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = comparison.equal && rngComparison.equal ? 0 : 1;
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  for (const { timer } of eventWaiters.values()) clearTimeout(timer);
  eventWaiters.clear();
  socket?.close();
  chrome?.kill('SIGTERM');
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
}
