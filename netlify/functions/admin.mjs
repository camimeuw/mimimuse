// Panel de la clienta: entrar, ver, guardar y subir fotos. Todo por POST a /api/admin.
import crypto from 'node:crypto';
import { almacen } from './_lib/almacen.mjs';
import { json, ErrorHttp, claveOk, nuevaSesion, sesionOk, tokenDe, limpiar, tipoImagen, txt, RE_IMG } from './_lib/comun.mjs';

const MAX_FOTO = 1.5 * 1024 * 1024;
const UNA_HORA = 3600e3;
const MAX_VERSIONES = 30;   // cuántas versiones anteriores se pueden recuperar
const claveVersion = (rev) => 'ver/' + String(rev).padStart(8, '0');
const claveMeta = (rev) => 'vmeta/' + String(rev).padStart(8, '0');
const listaVersiones = async (db) => (await Promise.all((await db.keys('vmeta/')).sort().reverse().slice(0, MAX_VERSIONES).map((k) => db.getJSON(k)))).filter(Boolean);
const fotosDe = (items) => items.flatMap((p) => [...p.imgs, ...(p.thumbs || [])].filter(Boolean).map((u) => 'img/' + RE_IMG.exec(u)[1]));

// Guarda `items` como la versión nueva. Antes de pisar, deja la versión anterior en el historial.
async function guardarDoc(db, doc, etag, items, nota, confirmarVacio) {
  if (!items.length && doc.items.length && !confirmarVacio) throw new ErrorHttp('Esto dejaría la tienda sin ningún producto. Si es lo que querés, confirmalo.');
  let siguiente = Math.max(doc.nextId || 1, ...items.map((p) => (p.id || 0) + 1));
  items.forEach((p) => { if (!p.id) p.id = siguiente++; });
  const nuevo = { rev: doc.rev + 1, nextId: siguiente, items };
  // 1) copia de la versión actual ANTES de pisarla (su contenido es siempre el mismo para esa versión: si dos guardados compiten, da igual cuál la escribe)
  if (doc.items.length) await db.setJSON(claveVersion(doc.rev), { rev: doc.rev, items: doc.items, nextId: doc.nextId });
  // 2) escritura condicionada: si otro guardado se coló entre la lectura y esta línea, no se pisa
  if (!(await db.setDocSi('productos', nuevo, etag))) throw new ErrorHttp('Se cruzaron dos guardados. Esperá unos segundos y volvé a intentar.', 409);
  // 3) solo quien ganó anota qué cambió y recorta el historial
  if (doc.items.length) {
    await db.setJSON(claveMeta(doc.rev), { rev: doc.rev, fecha: Date.now(), nota: txt(nota, 120) || 'Cambio', cantidad: doc.items.length });
    for (const k of (await db.keys('ver/')).sort().reverse().slice(MAX_VERSIONES)) { await db.del(k); await db.del(k.replace('ver/', 'vmeta/')); }
  }
  await borrarFotosSueltas(db, items);
  return nuevo;
}

// Borra las fotos que no usa ningún producto ni ninguna versión guardada (y tienen más de 1 hora: pueden estar en edición)
async function borrarFotosSueltas(db, items) {
  const usadas = new Set(fotosDe(items));
  const sueltas = (await db.keys('img/')).filter((k) => !usadas.has(k) && Date.now() - parseInt(k.slice(4).split('-')[0], 36) > UNA_HORA);
  if (!sueltas.length) return;
  for (const k of await db.keys('ver/')) { const d = await db.getJSON(k); if (d) fotosDe(d.items).forEach((f) => usadas.add(f)); }
  for (const k of sueltas) if (!usadas.has(k)) await db.del(k);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const body = await req.json().catch(() => { throw new ErrorHttp('Pedido inválido.'); });
    if (body.accion === 'entrar') {
      const db0 = await almacen();
      const intentos = (await db0.getJSON('intentos')) || { n: 0, desde: 0 };
      if (intentos.n >= 5 && Date.now() - intentos.desde < 10 * 60e3) throw new ErrorHttp('Demasiados intentos. Esperá 10 minutos y probá de nuevo.', 429);
      if (!claveOk(body.clave)) {
        await db0.setJSON('intentos', { n: Date.now() - intentos.desde > 10 * 60e3 ? 1 : intentos.n + 1, desde: Date.now() - intentos.desde > 10 * 60e3 ? Date.now() : intentos.desde });
        await new Promise((r) => setTimeout(r, 800));
        throw new ErrorHttp('Clave incorrecta.', 401);
      }
      if (intentos.n) await db0.setJSON('intentos', { n: 0, desde: 0 });
      return json({ token: nuevaSesion() });
    }
    if (!sesionOk(tokenDe(req))) throw new ErrorHttp('Sesión vencida: volvé a entrar.', 401);
    const db = await almacen();

    if (body.accion === 'ver') {
      const doc = (await db.getJSON('productos')) || { rev: 0, nextId: 1, items: [] };
      return json({ rev: doc.rev, items: doc.items });
    }

    if (body.accion === 'guardar') {
      const { valor, etag } = await db.getDoc('productos');
      const doc = valor || { rev: 0, nextId: 1, items: [] };
      if (body.rev !== doc.rev) throw new ErrorHttp('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409);
      const nuevo = await guardarDoc(db, doc, etag, limpiar(body.items), body.nota, body.confirmarVacio === true);
      return json({ rev: nuevo.rev, items: nuevo.items });
    }

    if (body.accion === 'versiones') return json({ versiones: await listaVersiones(db) });

    if (body.accion === 'restaurar') {
      const v = await db.getJSON(claveVersion(Number(body.version)));
      if (!v) throw new ErrorHttp('Esa versión ya no existe.', 404);
      const { valor, etag } = await db.getDoc('productos');
      const doc = valor || { rev: 0, nextId: 1, items: [] };
      if (body.rev !== doc.rev) throw new ErrorHttp('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409);
      const nota = (await db.getJSON(claveMeta(v.rev)))?.nota || 'Cambio';
      const nuevo = await guardarDoc(db, doc, etag, limpiar(v.items), `Volvió atrás (antes de: ${nota})`, true);
      return json({ rev: nuevo.rev, items: nuevo.items });
    }

    if (body.accion === 'subir') {
      const buf = Buffer.from(String(body.datos || ''), 'base64');
      if (!buf.length || buf.length > MAX_FOTO) throw new ErrorHttp('La foto está vacía o pesa más de 1,5 MB.');
      const tipo = tipoImagen(buf);
      if (!tipo) throw new ErrorHttp('Formato no válido: usá PNG, JPG o WEBP.');
      const nombre = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${tipo[1]}`;
      await db.setBin('img/' + nombre, buf, tipo[0]);
      return json({ url: '/api/imagen/' + nombre });
    }

    throw new ErrorHttp('Acción desconocida.');
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Error del servidor.' }, 500);
  }
};
export const config = { path: '/api/admin' };
