import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiMiddleware } from './api.js';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => apiMiddleware(req, res, async () => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const filename = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.' + filename);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
    let data, extension = path.extname(file);
    try { data = await readFile(file); } catch { if (extension) { res.writeHead(404); return res.end(); } data = await readFile(path.join(root, 'index.html')); extension = '.html'; }
    res.writeHead(200, { 'Content-Type': `${types[extension] || 'application/octet-stream'}; charset=utf-8` }); res.end(data);
  } catch { res.writeHead(500); res.end('Build the app first: npm run build'); }
}));
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log(`Persona is running locally at http://127.0.0.1:${server.address().port}`));
