/**
 * rhythm-arrows/server.js
 *
 * Servidor HTTP estático para "Rhythm Arrows" — sin dependencias
 * externas (solo Node.js nativo). Sirve los archivos de public/.
 *
 * Uso: node server.js  (o npm start)
 * Página: http://localhost:3002
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3002;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // Solo GET/HEAD.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  // Prevenir path traversal fuera de public/.
  const rootCheck = PUBLIC_DIR + path.sep;
  if (!(filePath === path.join(PUBLIC_DIR, 'index.html') || filePath.startsWith(rootCheck))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[RhythmArrows] Servidor escuchando en http://localhost:${PORT}`);
  console.log(`[RhythmArrows] Ctrl+C para detener.`);
});