import {defaultAssetsReader} from './default-assets.mjs';
import{starterCatalog}from'./starter-packs.mjs';
import http from 'node:http';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { PackStore, StoreError } from './pack-store.mjs';
import {runtimeStatusReader} from './runtime-status.mjs';
import { ARCHIVE_LIMIT, JSON_LIMIT, resourcePath } from '../../packages/shared/paths.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mcmeta': 'application/json; charset=utf-8', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8' };
function headers(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'same-origin'); response.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
}
function json(response, status, value) { response.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); }
async function body(request, limit = JSON_LIMIT) {
  const chunks = []; let length = 0;
  for await (const chunk of request) { if ((length += chunk.length) > limit) throw new StoreError(413, 'Request exceeds the file size limit.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
function authenticated(request, token) { if (!token) return true; const supplied = Buffer.from((request.headers.authorization || '').replace(/^Bearer /, '')); const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); }
export async function createStudioServer({ root = process.env.IRIS_PACKS_DIR || path.join(repository, 'packs'), host = process.env.HOST || '127.0.0.1', token = process.env.IRIS_STUDIO_TOKEN || '', renderingDefaults = process.env.IRIS_RENDERING_DEFAULTS_DIR || path.join(repository,'.local-assets/rendering-defaults') } = {}) {
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!loopback && token.length < 32) throw new Error('Set IRIS_STUDIO_TOKEN to at least 32 characters before binding to a non-loopback address.');
  const store = new PackStore(root); await store.initialize();
  const lock = JSON.parse(await fs.readFile(path.join(repository, 'upstream.lock.json'), 'utf8'));
  const runtimeStatus=runtimeStatusReader(repository),defaultAssets=defaultAssetsReader(renderingDefaults);
  const server = http.createServer(async (request, response) => {
    headers(response);
    try {
      const url = new URL(request.url, 'http://localhost'), method = request.method;
      const hostname = new URL('http://' + request.headers.host).hostname;
      if (loopback && !['localhost','127.0.0.1','[::1]'].includes(hostname)) throw new StoreError(403, 'Unrecognized local host.');
      if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new StoreError(403, 'Cross-origin file operations are disabled.');
      if(url.pathname==='/healthz'&&['GET','HEAD'].includes(method))return json(response,200,{status:'ok'});
      if (url.pathname.startsWith('/api/')) {
        if (!authenticated(request, token)) throw new StoreError(401, 'Enter the server access token to open packs.');
        const pack = url.searchParams.get('pack'), relative = url.searchParams.get('path');
        if (method === 'GET' && url.pathname === '/api/status') {
          return json(response, 200, { name: 'Iris Terrain Studio', version: '0.1.0-dev', target: { iris: lock.iris.version, minecraft: lock.minecraft.version, commit: lock.iris.commit }, engine:await runtimeStatus(), authenticated: !!token });
        }
        if(method==='GET'&&url.pathname==='/api/rendering-defaults')return json(response,200,(await defaultAssets()).status);
        if(['GET','HEAD'].includes(method)&&url.pathname==='/api/rendering-default'){const data=(await defaultAssets()).archives.get(url.searchParams.get('role'));if(!data)throw new StoreError(404,'Configured rendering asset not found.');response.writeHead(200,{'Content-Type':MIME['.zip'],'Content-Length':data.length,'Cache-Control':'private, no-cache'});return response.end(method==='HEAD'?undefined:data);}
        if (method === 'GET' && url.pathname === '/api/packs') return json(response, 200, { packs: await store.packs() });
        if (method === 'GET' && url.pathname === '/api/pack-starters') return json(response,200,{starters:starterCatalog()});
        if (method === 'POST' && url.pathname === '/api/packs') { const data = JSON.parse((await body(request)).toString('utf8')); if(!data||typeof data!=='object'||Array.isArray(data))throw new StoreError(400,'Pack creation requires a JSON object.'); return json(response, 201, await store.create(data.id,{template:data.template})); }
        if (method === 'GET' && url.pathname === '/api/resources') return json(response, 200, await store.resources(pack));
        if (['GET','HEAD'].includes(method) && url.pathname === '/api/resource') {
          const result = await store.read(pack, relative); response.setHeader('ETag', result.etag); response.setHeader('Cache-Control', 'no-store');
          if (request.headers['if-none-match'] === result.etag) { response.writeHead(304); return response.end(); }
          response.writeHead(200, { 'Content-Type': MIME[path.extname(relative).toLowerCase()] || 'application/octet-stream', 'Content-Length': result.data.length }); return response.end(method === 'HEAD' ? undefined : result.data);
        }
        if (method === 'PUT' && url.pathname === '/api/resource') {
          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw new StoreError(415, 'Save configuration as application/json.');
          const text = (await body(request)).toString('utf8'), create = request.headers['if-none-match'] === '*';
          return json(response, 200, await store.save(pack, relative, text, create ? '*' : request.headers['if-match'], create));
        }
        if (method === 'GET' && url.pathname === '/api/references') return json(response, 200, { references: await store.references(pack, relative) });
        if (method === 'POST' && url.pathname === '/api/operation') return json(response, 200, await store.operation(pack, JSON.parse((await body(request)).toString('utf8'))));
        if (method === 'GET' && url.pathname === '/api/backup') { const result=await store.readBackup(pack,relative,url.searchParams.get('id')); response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Length':result.data.length,'ETag':result.etag,'Cache-Control':'no-store'}); return response.end(result.data); }
        if (method === 'GET' && url.pathname === '/api/backups') return json(response, 200, { backups: await store.backups(pack, relative) });
        if (method === 'POST' && url.pathname === '/api/restore') { const data = JSON.parse((await body(request)).toString('utf8')); return json(response, 200, await store.restore(pack, relative, data.id, request.headers['if-none-match']==='*'?'*':request.headers['if-match'],data.backupEtag)); }
        if (method === 'GET' && url.pathname === '/api/export') { const archive = await store.export(pack); response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${pack}.zip"`, 'Content-Length': archive.length, 'Cache-Control': 'no-store' }); return response.end(archive); }
        if (method === 'POST' && url.pathname === '/api/import') return json(response, 201, await store.import(pack, await body(request, ARCHIVE_LIMIT), { stripRoot: url.searchParams.get('stripRoot') === 'true' }));
        throw new StoreError(404, 'Pack operation not found.');
      }
      if (!['GET','HEAD'].includes(method)) throw new StoreError(405, 'Method not allowed.');
      let filename;
      if (url.pathname === '/') filename = path.join(repository, 'apps/web/index.html');
      else if (url.pathname.startsWith('/packages/')) filename = path.join(repository, resourcePath(decodeURIComponent(url.pathname.slice(1))));
      else if (url.pathname.startsWith('/app/')) filename = path.join(repository, 'apps/web', resourcePath(decodeURIComponent(url.pathname.slice(5))));
      else throw new StoreError(404, 'Application asset not found.');
      // Pack-specific schema bundles contain private resource names and hashes.
      // Check the decoded path so encoded URL segments cannot bypass auth.
      if(filename.startsWith(path.join(repository,'apps/web/engine/schema-generated')+path.sep)&&!authenticated(request,token))throw new StoreError(401,'Enter the server access token to load native pack schemas.');
      const extension = path.extname(filename).toLowerCase(); if (!MIME[extension]) throw new StoreError(404, 'Application asset not found.');
      const data = await fs.readFile(filename).catch(error => { if (error.code === 'ENOENT' || error.code === 'EISDIR') throw new StoreError(404, 'Application asset not found.'); throw error; });
      response.writeHead(200, { 'Content-Type': MIME[extension], 'Content-Length': data.length, 'Cache-Control': 'no-cache' }); response.end(method === 'HEAD' ? undefined : data);
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError || error instanceof URIError ? 400 : 500);
      if (status === 500) console.error(error);
      if (!response.headersSent) json(response, status, { error: status === 500 ? 'The operation could not be completed.' : error.message, details: error.details }); else response.destroy();
    }
  });
  server.requestTimeout = 120000; server.headersTimeout = 15000;
  return { server, store, host };
}
export async function start() {
  const { server, host } = await createStudioServer(); const port = Number(process.env.PORT || 4783);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  console.log(`Iris Terrain Studio: http://${host.includes(':') ? '[' + host + ']' : host}:${server.address().port}`);
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) start().catch(error => { console.error(error.message); process.exitCode = 1; });
