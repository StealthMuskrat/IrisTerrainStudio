import * as fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resourcePath, jsonPath, packId, JSON_LIMIT, FILE_LIMIT, ARCHIVE_LIMIT, ENTRY_LIMIT } from '../../packages/shared/paths.mjs';
import { readZip, writeZip } from '../../packages/shared/zip.mjs';
import { JsonDocument } from '../../packages/iris-config/document.mjs';
export class StoreError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const digest = data => '"' + createHash('sha256').update(data).digest('hex') + '"';
export class PackStore {
  constructor(root) { this.root = path.resolve(root); this.locks = new Map(); }
  async initialize() { await fs.mkdir(this.root, { recursive: true }); this.root = await fs.realpath(this.root); }
  async withLock(key, action) {
    const prior = this.locks.get(key) || Promise.resolve(); let release; const held = new Promise(resolve => { release = resolve; }); const chain = prior.catch(() => {}).then(() => held); this.locks.set(key, chain);
    await prior.catch(() => {}); try { return await action(); } finally { release(); if (this.locks.get(key) === chain) this.locks.delete(key); }
  }
  async safe(pack, relative, { parents = false } = {}) {
    const base = path.join(this.root, packId(pack)); const rootStat = await fs.lstat(base).catch(() => null);
    if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) throw new StoreError(404, 'Pack not found.');
    if (!relative) return base;
    const parts = resourcePath(relative).split('/'); let current = base;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]); let stat = await fs.lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (stat?.isSymbolicLink()) throw new StoreError(403, 'Symbolic links are outside the editable pack boundary.');
      if (i < parts.length - 1) {
        if (!stat && parents) { await fs.mkdir(current); stat = await fs.lstat(current); }
        if (!stat?.isDirectory()) throw new StoreError(404, 'Resource directory not found.');
      }
    }
    return current;
  }
  async packs() { return (await fs.readdir(this.root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(entry.name)).map(entry => ({ id: entry.name, name: entry.name })).sort((a, b) => a.id.localeCompare(b.id)); }
  async create(id) { packId(id); await fs.mkdir(path.join(this.root, id)).catch(error => { if (error.code === 'EEXIST') throw new StoreError(409, 'A pack with that name already exists.'); throw error; }); return { id, name: id }; }
  async resources(pack) {
    const base = await this.safe(pack), results = []; let total = 0;
    const walk = async (directory, prefix = '') => {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.iris-terrain-studio')) continue;
        const name = prefix + entry.name;
        if (entry.isSymbolicLink()) { results.push({ path: name, readOnly: true, reason: 'Symbolic link', size: 0 }); continue; }
        if (entry.isDirectory()) await walk(path.join(directory, entry.name), name + '/');
        else if (entry.isFile()) { const stat = await fs.stat(path.join(directory, entry.name)); total += stat.size; results.push({ path: name, size: stat.size, modifiedAt: stat.mtime.toISOString(), editable: name.toLowerCase().endsWith('.json') && stat.size <= JSON_LIMIT }); }
        if (results.length > ENTRY_LIMIT) throw new StoreError(413, 'Pack contains too many resources.');
      }
    };
    await walk(base); return { pack, resources: results.sort((a, b) => a.path.localeCompare(b.path)), bytes: total };
  }
  async read(pack, relative) {
    const filename = await this.safe(pack, relative); const handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)).catch(error => { if (error.code === 'ENOENT') throw new StoreError(404, 'Resource not found.'); throw error; });
    try { const stat = await handle.stat(); if (!stat.isFile() || stat.size > FILE_LIMIT) throw new StoreError(413, 'Resource is not a regular file or exceeds the size limit.'); const data = await handle.readFile(); return { data, etag: digest(data), modifiedAt: stat.mtime.toISOString() }; } finally { await handle.close(); }
  }
  validate(text) { if (Buffer.byteLength(text) > JSON_LIMIT) throw new StoreError(413, 'Configuration exceeds 8 MiB.'); try { const doc = new JsonDocument(text); if (doc.root.type !== 'object') throw new Error('An Iris resource must be a JSON object.'); if (doc.issues.length) throw new Error(doc.issues[0].message); } catch (error) { throw new StoreError(422, error.message, { line: error.line, column: error.column }); } }
  async backup(pack, relative, data) {
    const directory = await this.internal(pack, ['backups', createHash('sha256').update(relative).digest('hex')], true); const id = Date.now() + '-' + randomUUID();
    await fs.writeFile(path.join(directory, id + '.data'), data, { flag: 'wx' });
    await fs.writeFile(path.join(directory, id + '.json'), JSON.stringify({ id, path: relative, bytes: data.length, createdAt: new Date().toISOString(), etag: digest(data) }), { flag: 'wx' });
    return id;
  }
  async internal(pack, parts, create = false) {
    let current = await this.safe(pack);
    for (const part of ['.iris-terrain-studio', ...parts]) {
      current = path.join(current, part); let stat = await fs.lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!stat && create) { await fs.mkdir(current); stat = await fs.lstat(current); }
      if (stat?.isSymbolicLink() || stat && !stat.isDirectory()) throw new StoreError(403, 'Invalid application metadata directory.');
      if (!stat) return null;
    }
    return current;
  }
  async save(pack, relative, text, expected, create = false) {
    jsonPath(relative); this.validate(text); if (!expected) throw new StoreError(428, 'A file version is required before saving.');
    return this.withLock(pack + '/' + relative, async () => {
      let original; try { original = await this.read(pack, relative); } catch (error) { if (error.status !== 404) throw error; }
      if (create ? original || expected !== '*' : !original || original.etag !== expected) throw new StoreError(409, 'This resource changed on disk. Review the current version before saving.', { currentEtag: original?.etag });
      const filename = await this.safe(pack, relative, { parents: create }), temporary = path.join(path.dirname(filename), '.iris-terrain-studio-tmp-' + randomUUID());
      if (original) await this.backup(pack, relative, original.data);
      try {
        const file = await fs.open(temporary, 'wx', 0o600); try { await file.writeFile(text, 'utf8'); await file.sync(); } finally { await file.close(); }
        if (original && (await this.read(pack, relative)).etag !== expected) throw new StoreError(409, 'The file changed while the save was being prepared.');
        if (create) { await fs.link(temporary, filename).catch(error => { if (error.code === 'EEXIST') throw new StoreError(409, 'A resource with that path already exists.'); throw error; }); await fs.unlink(temporary); }
        else await fs.rename(temporary, filename);
      } finally { await fs.unlink(temporary).catch(() => {}); }
      return { path: relative, etag: digest(Buffer.from(text)), savedAt: new Date().toISOString() };
    });
  }
  async references(pack, relative) {
    const id = relative.replace(/^[^/]+\//, '').replace(/\.json$/i, ''), short = id.split('/').at(-1), matches = [];
    for (const row of (await this.resources(pack)).resources) {
      if (!row.editable || row.path === relative) continue;
      try { const document = new JsonDocument((await this.read(pack, row.path)).data.toString('utf8')); for (const node of document.nodes.values()) if (node.type === 'string' && [id, short, relative, relative.replace(/\.json$/i, '')].includes(node.value)) matches.push({ path: row.path, pointer: node.pointer, value: node.value, confidence: 'possible' }); } catch { /* Other invalid resources remain untouched. */ }
    }
    return matches;
  }
  async operation(pack, action) {
    const source = jsonPath(action.path); const current = await this.read(pack, source); if (current.etag !== action.etag) throw new StoreError(409, 'The resource changed on disk.');
    if (action.type === 'duplicate') return this.save(pack, jsonPath(action.target), current.data.toString('utf8'), '*', true);
    if (action.type === 'rename') {
      const references = await this.references(pack, source); if (references.length && !action.confirmReferences) throw new StoreError(409, 'Other files may reference this resource. Renaming does not rewrite unknown fields.', { references });
      const result = await this.save(pack, jsonPath(action.target), current.data.toString('utf8'), '*', true);
      try { await this.operation(pack, { ...action, type: 'delete', confirmReferences: true }); } catch (error) { error.details = { ...error.details, duplicateCreated: result.path }; throw error; }
      return { ...result, references };
    }
    if (action.type === 'delete') return this.withLock(pack + '/' + source, async () => {
      const references = await this.references(pack, source); if (references.length && !action.confirmReferences) throw new StoreError(409, 'Other files may reference this resource.', { references });
      const latest = await this.read(pack, source); if (latest.etag !== action.etag) throw new StoreError(409, 'The resource changed on disk.');
      await this.backup(pack, source, latest.data); await fs.unlink(await this.safe(pack, source)); return { path: source, deleted: true, references };
    });
    throw new StoreError(400, 'Unknown resource operation.');
  }
  async backups(pack, relative) {
    if (!relative) {
      const base = await this.internal(pack, ['backups']); if (!base) return [];
      const result = [];
      for (const entry of await fs.readdir(base, { withFileTypes: true })) {
        if (!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
        result.push(...await this.backupRecords(await this.internal(pack, ['backups', entry.name])));
        if (result.length > 50000) throw new StoreError(413, 'Pack history exceeds the listing budget.');
      }
      return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    }
    jsonPath(relative); const directory = await this.internal(pack, ['backups', createHash('sha256').update(relative).digest('hex')]); if (!directory) return [];
    return (await this.backupRecords(directory)).filter(row=>row.path===relative).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async backupRecords(directory) {
    const files = await fs.readdir(directory).catch(error => { if (error.code === 'ENOENT') return []; throw error; }); const result = [];
    for (const file of files.filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name))) {
      const handle = await fs.open(path.join(directory,file),constants.O_RDONLY|(constants.O_NOFOLLOW||0));
      try {
        const stat=await handle.stat();if(!stat.isFile()||stat.size>8192)throw new StoreError(422,'Invalid backup metadata.');
        const row=JSON.parse(await handle.readFile('utf8'));jsonPath(row.path);
        if(file!==row.id+'.json'||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>JSON_LIMIT||!/^"[a-f0-9]{64}"$/.test(row.etag)||!Number.isFinite(Date.parse(row.createdAt)))throw new StoreError(422,'Invalid backup metadata.');
        result.push({id:row.id,path:row.path,bytes:row.bytes,createdAt:row.createdAt,etag:row.etag});
      } finally { await handle.close(); }
    }
    return result;
  }
  async restore(pack, relative, id, expected) {
    const backup = (await this.backups(pack, relative)).find(row => row.id === id); if (!backup) throw new StoreError(404, 'Backup not found.');
    const directory = await this.internal(pack, ['backups', createHash('sha256').update(relative).digest('hex')]);
    const handle=await fs.open(path.join(directory,id+'.data'),constants.O_RDONLY|(constants.O_NOFOLLOW||0));
    try {
      const stat=await handle.stat();if(!stat.isFile()||stat.size!==backup.bytes||stat.size>JSON_LIMIT)throw new StoreError(422,'Invalid backup data.');
      const data=await handle.readFile();if(digest(data)!==backup.etag)throw new StoreError(422,'Backup data differs from its saved checksum.');
      return this.save(pack,relative,data.toString('utf8'),expected,expected==='*');
    } finally { await handle.close(); }
  }
  async export(pack) { const entries = new Map(); for (const row of (await this.resources(pack)).resources) { if (row.readOnly) throw new StoreError(422, 'Pack export does not follow symbolic links.'); entries.set(resourcePath(row.path), (await this.read(pack, row.path)).data); } return writeZip(entries); }
  async import(id, archive, { stripRoot = false } = {}) {
    packId(id); const files = await readZip(archive); if (!files.size) throw new StoreError(422, 'The archive contains no files.');
    const top = [...new Set([...files.keys()].map(name => name.split('/')[0]))]; if (stripRoot && (top.length !== 1 || [...files.keys()].some(name => !name.includes('/')))) throw new StoreError(422, 'Removing a root folder requires exactly one enclosing folder.');
    const stage = path.join(this.root, '.iris-terrain-studio-import-' + randomUUID()); await fs.mkdir(stage);
    try { for (const [original, data] of files) { const relative = resourcePath(stripRoot ? original.slice(original.indexOf('/') + 1) : original); const target = path.join(stage, ...relative.split('/')); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, data, { flag: 'wx' }); } await this.withLock('pack/' + id, async () => { if (await fs.lstat(path.join(this.root, id)).catch(() => null)) throw new StoreError(409, 'A pack with that name already exists.'); await fs.rename(stage, path.join(this.root, id)); }); } finally { await fs.rm(stage, { recursive: true, force: true }); }
    return { id, files: files.size, bytes: [...files.values()].reduce((sum, data) => sum + data.length, 0) };
  }
}
