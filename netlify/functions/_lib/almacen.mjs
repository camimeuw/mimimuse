// Dónde se guardan los productos y las fotos.
// En Netlify: Netlify Blobs (viene incluido, sin cuentas extra).
// En tu compu: si existe ALMACEN_LOCAL=<carpeta>, se guarda en archivos (para probar sin internet).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const claveOk = (k) => /^[a-zA-Z0-9._\-\/]+$/.test(k) && !k.includes('..');

// Escrituras una detrás de otra (en la compu de prueba hay un solo proceso)
let cadena = Promise.resolve();
const enCola = (fn) => { const r = cadena.then(fn); cadena = r.catch(() => {}); return r; };

function local(dir) {
  const f = (k) => { if (!claveOk(k)) throw new Error('clave inválida'); return path.join(dir, k.replaceAll('/', '__')); };
  return {
    async getJSON(k) { try { return JSON.parse(await fs.readFile(f(k), 'utf8')); } catch { return null; } },
    async setJSON(k, v) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(k), JSON.stringify(v)); },
    // Documento + "huella" de la versión leída; setDocSi solo escribe si nadie lo cambió desde entonces
    async getDoc(k) {
      try { const t = await fs.readFile(f(k), 'utf8'); return { valor: JSON.parse(t), etag: crypto.createHash('sha1').update(t).digest('hex') }; } catch { return { valor: null, etag: null }; }
    },
    setDocSi(k, v, etag) {
      return enCola(async () => {
        if ((await this.getDoc(k)).etag !== etag) return false;
        await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(k), JSON.stringify(v)); return true;
      });
    },
    async getBin(k) { try { return { data: await fs.readFile(f(k)), tipo: (await fs.readFile(f(k) + '.tipo', 'utf8')) }; } catch { return null; } },
    async setBin(k, buf, tipo) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(k), buf); await fs.writeFile(f(k) + '.tipo', tipo); },
    async del(k) { await fs.rm(f(k), { force: true }); await fs.rm(f(k) + '.tipo', { force: true }); },
    async keys(prefijo) {
      try { return (await fs.readdir(dir)).filter((n) => !n.endsWith('.tipo')).map((n) => n.replaceAll('__', '/')).filter((n) => n.startsWith(prefijo)); } catch { return []; }
    },
  };
}

export async function almacen() {
  if (process.env.ALMACEN_LOCAL) return local(process.env.ALMACEN_LOCAL);
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name: 'mimimuse', consistency: 'strong' });   // lee siempre lo último guardado
  return {
    getJSON: (k) => s.get(k, { type: 'json' }),
    setJSON: (k, v) => s.setJSON(k, v),
    async getDoc(k) { const r = await s.getWithMetadata(k, { type: 'json' }); return r ? { valor: r.data, etag: r.etag } : { valor: null, etag: null }; },
    async setDocSi(k, v, etag) { return (await s.setJSON(k, v, etag ? { onlyIfMatch: etag } : { onlyIfNew: true })).modified; },
    async getBin(k) {
      const r = await s.getWithMetadata(k, { type: 'arrayBuffer' });
      return r ? { data: Buffer.from(r.data), tipo: r.metadata?.tipo || 'application/octet-stream' } : null;
    },
    setBin: (k, buf, tipo) => s.set(k, buf, { metadata: { tipo } }),
    del: (k) => s.delete(k),
    async keys(prefijo) { return (await s.list({ prefix: prefijo })).blobs.map((b) => b.key); },
  };
}
