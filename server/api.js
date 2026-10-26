import { readFile, writeFile, readdir, rename, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { blank, validatePreset } from '../src/schema.js';
import { createProfileStore } from './profiles.js';
import { createNamedJson } from './filenames.js';

export function createApi(dataDir) {
  const presetsDir = path.join(dataDir, 'presets');
  const profiles = createProfileStore(dataDir);
  async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
  async function atomicWrite(file, data) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
    await rename(temporary, file);
  }
  return async function api(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next?.();
    const send = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
    // All file mutations must originate from this local app, not another website.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) return send(403, { error: 'Origin not allowed' });
    if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Cross-site requests are not allowed' });
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'Local access only' });
    try {
      await mkdir(presetsDir, { recursive: true });
      let body;
      if (['POST','PUT'].includes(req.method)) {
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 256000) return send(413, { error: 'File too large' }); }
        body = JSON.parse(raw);
      }
      if (url.pathname === '/api/blank' && req.method === 'GET') {
        let template;
        try { template = await readJson(path.join(dataDir, 'blank.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; template = blank; }
        return send(200, { ...validatePreset({ ...template, name:'Blank template' }), name: '' });
      }
      if (url.pathname === '/api/profile') {
        if (req.method === 'GET') return send(200,await profiles.active());
        if (req.method === 'PUT') { const state = await profiles.list(); const {id,...profile} = await profiles.save(body,state.activeProfileId); return send(200,profile); }
      }
      if (url.pathname === '/api/profiles/blank' && req.method === 'GET') return send(200,await profiles.template());
      if (url.pathname === '/api/profiles/active' && req.method === 'PUT') return send(200,await profiles.activate(body.activeProfileId));
      if (url.pathname === '/api/profiles') {
        if (req.method === 'GET') return send(200,await profiles.list());
        if (req.method === 'POST') return send(201,await profiles.save(body));
      }
      const profileMatch = decodeURIComponent(url.pathname).match(/^\/api\/profiles\/([\p{L}\p{N}_ .-]{1,150})$/u);
      if (profileMatch) {
        // Reserved endpoints never become file IDs, keeping the template immutable in the UI.
        if (['blank','active'].includes(profileMatch[1])) return send(404,{error:'Not found'});
        if (req.method === 'PUT') return send(200,await profiles.save(body,profileMatch[1]));
        if (req.method === 'DELETE') return send(200,await profiles.remove(profileMatch[1]));
      }
      if (url.pathname === '/api/presets') {
        if (req.method === 'GET') {
          const files = (await readdir(presetsDir)).filter(f => f.endsWith('.json'));
          const presets = [], errors = [];
          for (const file of files) {
            try {
              const id = file.slice(0,-5);
              if (!/^[\p{L}\p{N}_ .-]{1,150}$/u.test(id) || id === '.' || id === '..') throw new Error('Unsupported filename');
              presets.push({ id, ...validatePreset(await readJson(path.join(presetsDir, file))) });
            }
            catch { errors.push(file); }
          }
          return send(200, { presets, errors });
        }
        if (req.method === 'POST') {
          const preset = validatePreset(body);
          const id = await createNamedJson(presetsDir,preset.name,preset,'preset');
          return send(201, { id, ...preset });
        }
      }
      const match = decodeURIComponent(url.pathname).match(/^\/api\/presets\/([\p{L}\p{N}_ .-]{1,150})$/u);
      if (match) {
        if (match[1] === '.' || match[1] === '..') return send(400, { error: 'Invalid filename' });
        const file = path.join(presetsDir, `${match[1]}.json`);
        if (req.method === 'DELETE') { await unlink(file); return send(200, { ok: true }); }
        if (req.method === 'PUT') { await readFile(file); const preset = validatePreset(body); await atomicWrite(file, preset); return send(200, { id: match[1], ...preset }); }
      }
      return send(404, { error: 'Not found' });
    } catch (error) { return send(error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'File not found' : error.message }); }
  };
}
export const apiMiddleware = createApi(fileURLToPath(new URL('../data', import.meta.url)));
