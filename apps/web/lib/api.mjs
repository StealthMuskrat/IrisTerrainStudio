export async function readSourceResponse(response) { const data=await response.arrayBuffer();let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data);}catch{throw new Error('The resource is not valid UTF-8.');}return{text,etag:response.headers.get('etag')}; }
export class ApiError extends Error { constructor(status, value) { super(value.error || `Request failed (${status}).`); this.status = status; this.details = value.details; } }
export class StudioApi {
  constructor() { this.token = sessionStorage.getItem('iris-studio-token') || ''; }
  setToken(token) { this.token = token; if (token) sessionStorage.setItem('iris-studio-token', token); else sessionStorage.removeItem('iris-studio-token'); }
  async request(endpoint, { query = {}, method = 'GET', headers = {}, body, raw = false } = {}) {
    const url = new URL('/api/' + endpoint, location.origin); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) url.searchParams.set(key, value);
    const response = await fetch(url, { method, headers: { ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}), ...headers }, body });
    if (!response.ok) { let value; try { value = await response.json(); } catch { value = { error: response.statusText }; } throw new ApiError(response.status, value); }
    if (raw) return response;
    return response.json();
  }
  packs() { return this.request('packs'); }
  resources(pack) { return this.request('resources', { query: { pack } }); }
  async read(pack, path) { const response = await this.request('resource', { query: { pack, path }, raw: true }); return readSourceResponse(response); }
  async backup(pack,path,id) { const response=await this.request('backup',{query:{pack,path,id},raw:true});return readSourceResponse(response); }
  async readBinary(pack, path) { const response = await this.request('resource', { query: { pack, path }, raw: true }); return { bytes: new Uint8Array(await response.arrayBuffer()), etag: response.headers.get('etag') }; }
  save(pack, path, text, etag) { return this.request('resource', { method: 'PUT', query: { pack, path }, headers: { 'Content-Type': 'application/json', [etag === '*' ? 'If-None-Match' : 'If-Match']: etag }, body: text }); }
  operation(pack, action) { return this.request('operation', { method: 'POST', query: { pack }, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }); }
  async export(pack) { const response = await this.request('export', { query: { pack }, raw: true }); return response.blob(); }
}
