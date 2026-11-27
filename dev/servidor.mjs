// Servidor para ver la tienda y el panel en tu compu (solo sirve archivos).
// Uso:  npm run dev   →  http://localhost:8888  (el panel está en /admin/)
// Para probar sin Firebase de verdad: node dev/firebase-falso.mjs (ver docs/firebase.md).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };

export function crear() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = path.join(raiz, decodeURIComponent(url.pathname));
      if (!p.startsWith(raiz)) { res.writeHead(403); return res.end(); }
      if ((await fs.stat(p).catch(() => null))?.isDirectory()) p = path.join(p, 'index.html');
      const data = await fs.readFile(p);
      res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
    } catch { res.writeHead(404); res.end('No encontrado'); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = process.env.PORT || 8888;
  crear().listen(puerto, () => console.log(`http://localhost:${puerto}  (panel: /admin/)`));
}
