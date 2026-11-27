// Servidor para probar en tu compu: sirve la carpeta y las 3 funciones (/api/...).
// Uso:  npm run dev   →  http://localhost:8888  (panel en /admin/, clave: demo)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.mp3': 'audio/mpeg' };
const funciones = [
  [/^\/api\/productos$/, './../netlify/functions/productos.mjs'],
  [/^\/api\/admin$/, './../netlify/functions/admin.mjs'],
  [/^\/api\/imagen\//, './../netlify/functions/imagen.mjs'],
];

export function crear() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const f = funciones.find(([re]) => re.test(url.pathname));
      if (f) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const r = await (await import(f[1])).default(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
        res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
      }
      let p = path.join(raiz, decodeURIComponent(url.pathname));
      if (!p.startsWith(raiz)) { res.writeHead(403); return res.end(); }
      if ((await fs.stat(p).catch(() => null))?.isDirectory()) p = path.join(p, 'index.html');
      const data = await fs.readFile(p);
      res.writeHead(200, { 'content-type': TIPOS[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    } catch { res.writeHead(404); res.end('No encontrado'); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = process.env.PORT || 8888;
  crear().listen(puerto, () => console.log(`http://localhost:${puerto}  (panel: /admin/)`));
}
