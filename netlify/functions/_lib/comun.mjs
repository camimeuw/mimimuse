import crypto from 'node:crypto';

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });

export class ErrorHttp extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

// ---- Sesión firmada "vence.versión.firma" (el secreto sale de ADMIN_SECRET o, si no hay, de ADMIN_PASSWORD) ----
// Subir la versión (cerrar sesión en todos los dispositivos, cambiar la clave) invalida todas las sesiones anteriores.
const secreto = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
const firma = (p) => crypto.createHmac('sha256', secreto()).update(p).digest('base64url');

export function nuevaSesion(version = 0, horas = 12) { const p = `${Date.now() + horas * 3600e3}.${version}`; return `${p}.${firma(p)}`; }
export function sesionOk(t, version = 0) {
  const [exp, v, f] = String(t || '').split('.');
  if (!exp || v === undefined || !f || !secreto()) return false;
  const esperado = Buffer.from(firma(`${exp}.${v}`)), recibido = Buffer.from(f);
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido) && Number(exp) > Date.now() && Number(v) === version;
}
export const tokenDe = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

// ---- Limpieza de los productos que llegan del panel (no se confía en el navegador) ----
export const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lista = (v, max, n) => [...new Set((Array.isArray(v) ? v : []).map((x) => txt(x, max)).filter(Boolean))].slice(0, n);
const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const RE_IMG = /^\/api\/imagen\/([a-z0-9]{6,12}-[a-f0-9]{12}\.(?:webp|png|jpg))$/;

// Fotos y miniaturas van en listas paralelas: la miniatura i es la versión chica de la foto i ('' si no hay)
function fotos(p) {
  const pares = (Array.isArray(p.imgs) ? p.imgs : []).map((u, k) => [u, Array.isArray(p.thumbs) ? p.thumbs[k] : '']).filter(([u]) => RE_IMG.test(u)).slice(0, 8);
  return { imgs: pares.map(([u]) => u), thumbs: pares.map(([, t]) => (RE_IMG.test(t) ? t : '')) };
}

export function limpiar(items) {
  if (!Array.isArray(items) || items.length > 1000) throw new ErrorHttp('Lista de productos inválida (máximo 1000).');
  const formas = new Map(); // "Remeras" y "remeras" se unifican en la primera forma escrita
  const forma = (clave, valor) => { if (!valor) return ''; if (!formas.has(clave)) formas.set(clave, valor); return formas.get(clave); };
  const ids = new Set();
  return items.map((p, i) => {
    const nombre = txt(p?.nombre, 120);
    if (!nombre) throw new ErrorHttp(`El producto ${i + 1} no tiene nombre.`);
    const precio = Math.round(Number(p.precio) * 100) / 100;
    if (!Number.isFinite(precio) || precio < 0) throw new ErrorHttp(`"${nombre}": precio inválido.`);
    const antes = p.precioAntes === '' || p.precioAntes == null ? null : Math.round(Number(p.precioAntes) * 100) / 100;
    if (antes !== null && (!Number.isFinite(antes) || antes < 0)) throw new ErrorHttp(`"${nombre}": precio anterior inválido.`);
    if (antes !== null && antes <= precio) throw new ErrorHttp(`"${nombre}": el precio anterior tiene que ser mayor que el precio actual (si no hay oferta, dejalo vacío).`);
    const cat = txt(p.cat, 40), sub = cat ? txt(p.sub, 40) : '';
    const talles = lista(p.talles, 20, 30);
    return {
      id: Number.isInteger(p.id) && p.id > 0 && !ids.has(p.id) && ids.add(p.id) ? p.id : null,
      nombre, precio, precioAntes: antes,
      cat: forma('c|' + sinTildes(cat), cat),
      sub: sub ? forma(`s|${sinTildes(cat)}|${sinTildes(sub)}`, sub) : '',
      desc: String(p.desc ?? '').replace(/\r/g, '').trim().slice(0, 2000),
      talles,
      tallesAgotados: lista(p.tallesAgotados, 20, 30).filter((t) => talles.includes(t)),
      colores: lista(p.colores, 30, 30),
      agotado: !!p.agotado,
      activo: p.activo !== false,
      ...fotos(p),
    };
  });
}

// ---- Tipo real de una imagen, por sus primeros bytes ----
export function tipoImagen(b) {
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return ['image/webp', 'webp'];
  if (b.length > 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return ['image/png', 'png'];
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['image/jpeg', 'jpg'];
  return null;
}
