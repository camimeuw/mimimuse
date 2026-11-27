// Dónde se guardan los productos y las fotos.
// En Netlify: Netlify Blobs (viene incluido, sin cuentas extra).
// En tu compu: si existe ALMACEN_LOCAL=<carpeta>, se guarda en archivos (para probar sin internet).
import fs from 'node:fs/promises';
import path from 'node:path';

const claveOk = (k) => /^[a-zA-Z0-9._\-\/]+$/.test(k) && !k.includes('..');

function local(dir) {
  const f = (k) => { if (!claveOk(k)) throw new Error('clave inválida'); return path.join(dir, k.replaceAll('/', '__')); };
  return {
    async getJSON(k) { try { return JSON.parse(await fs.readFile(f(k), 'utf8')); } catch { return null; } },
    async setJSON(k, v) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(k), JSON.stringify(v)); },
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
  const s = getStore('mimimuse');
  return {
    getJSON: (k) => s.get(k, { type: 'json' }),
    setJSON: (k, v) => s.setJSON(k, v),
    async getBin(k) {
      const r = await s.getWithMetadata(k, { type: 'arrayBuffer' });
      return r ? { data: Buffer.from(r.data), tipo: r.metadata?.tipo || 'application/octet-stream' } : null;
    },
    setBin: (k, buf, tipo) => s.set(k, buf, { metadata: { tipo } }),
    del: (k) => s.delete(k),
    async keys(prefijo) { return (await s.list({ prefix: prefijo })).blobs.map((b) => b.key); },
  };
}
