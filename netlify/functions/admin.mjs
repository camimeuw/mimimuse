// Panel de la clienta: entrar, ver, guardar y subir fotos. Todo por POST a /api/admin.
import crypto from 'node:crypto';
import { almacen } from './_lib/almacen.mjs';
import { json, ErrorHttp, nuevaSesion, sesionOk, tokenDe, limpiar, tipoImagen, txt, RE_IMG } from './_lib/comun.mjs';
import { verificarClave, guardarClave, contarIntento, perdonar, ipDe, esperarFallo, versionSesion, subirVersion } from './_lib/acceso.mjs';
import { listaRespaldos, RE_DIA } from './_lib/respaldo.mjs';

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

// Borra las fotos que no usa ningún producto ni ninguna versión ni copia diaria guardada (y tienen más de 1 hora: pueden estar en edición)
async function borrarFotosSueltas(db, items) {
  const usadas = new Set(fotosDe(items));
  const sueltas = (await db.keys('img/')).filter((k) => !usadas.has(k) && Date.now() - parseInt(k.slice(4).split('-')[0], 36) > UNA_HORA);
  if (!sueltas.length) return;
  for (const k of [...await db.keys('ver/'), ...await db.keys('respaldo/')]) { const d = await db.getJSON(k); if (d) fotosDe(d.items).forEach((f) => usadas.add(f)); }
  for (const k of sueltas) if (!usadas.has(k)) await db.del(k);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const body = await req.json().catch(() => { throw new ErrorHttp('Pedido inválido.'); });
    const db = await almacen();
    if (body.accion === 'entrar') {
      const ip = ipDe(req);
      await contarIntento(db, ip);                              // se cuenta antes de mirar la clave: los intentos en paralelo no se cuelan
      if (!(await verificarClave(db, body.clave))) { await esperarFallo(); throw new ErrorHttp('Clave incorrecta.', 401); }
      await perdonar(db, ip);
      return json({ token: nuevaSesion(await versionSesion(db), body.recordar === true ? 30 * 24 : 12) });
    }
    if (!sesionOk(tokenDe(req), await versionSesion(db))) throw new ErrorHttp('Sesión vencida: volvé a entrar.', 401);

    // Cerrar la sesión en todos los dispositivos (también los que eligieron «recordarme»)
    if (body.accion === 'salirTodos') { await subirVersion(db); return json({ ok: true }); }

    if (body.accion === 'cambiarClave') {
      const ip = ipDe(req);
      await contarIntento(db, ip);                              // una sesión robada no puede adivinar la clave actual a fuerza bruta
      if (!(await verificarClave(db, body.actual))) { await esperarFallo(); throw new ErrorHttp('La clave actual no es correcta.', 401); }
      const nueva = String(body.nueva ?? '');
      if (nueva.length < 10) throw new ErrorHttp('La clave nueva tiene que tener al menos 10 caracteres (mejor una frase larga).');
      if (nueva.length > 200) throw new ErrorHttp('La clave nueva es demasiado larga (máximo 200 caracteres).');
      if (nueva === String(body.actual)) throw new ErrorHttp('La clave nueva tiene que ser distinta de la actual.');
      await guardarClave(db, nueva);
      await perdonar(db, ip);
      return json({ token: nuevaSesion(await subirVersion(db), body.recordar === true ? 30 * 24 : 12) });   // las demás sesiones se cierran; esta sigue
    }

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

    // Cambios chicos (en vez de reenviar los 200 productos en cada toque): poner / quitar / orden
    if (body.accion === 'cambios') {
      const { valor, etag } = await db.getDoc('productos');
      const doc = valor || { rev: 0, nextId: 1, items: [] };
      if (body.rev !== doc.rev) throw new ErrorHttp('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409);
      if (!Array.isArray(body.cambios) || !body.cambios.length || body.cambios.length > 50) throw new ErrorHttp('Pedido inválido.');
      let items = doc.items.slice();
      const puestos = [];                                   // los productos que llegaron, para devolverlos ya limpios
      for (const c of body.cambios) {
        if (c?.op === 'poner') {
          if (!Array.isArray(c.productos) || c.productos.length > 500) throw new ErrorHttp('Pedido inválido.');
          for (const raw of c.productos) {
            const k = Number.isInteger(raw?.id) ? items.findIndex((p) => p.id === raw.id) : -1;
            if (k >= 0) items[k] = raw; else items.push(raw);
            puestos.push(raw);
          }
        } else if (c?.op === 'quitar') {
          const ids = new Set(Array.isArray(c.ids) ? c.ids : []);
          items = items.filter((p) => !ids.has(p.id));
        } else if (c?.op === 'orden') {
          const pos = new Map((Array.isArray(c.ids) ? c.ids : []).map((id, i) => [id, i]));
          items = items.map((p, i) => [p, pos.has(p.id) ? pos.get(p.id) : 1e9 + i]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
        } else throw new ErrorHttp('Pedido inválido.');
      }
      const limpios = limpiar(items);
      const nuevo = await guardarDoc(db, doc, etag, limpios, body.nota, body.confirmarVacio === true);
      return json({ rev: nuevo.rev, orden: nuevo.items.map((p) => p.id), puestos: puestos.map((r) => nuevo.items[items.indexOf(r)]).filter(Boolean) });
    }

    if (body.accion === 'versiones') return json({ versiones: await listaVersiones(db), copias: await listaRespaldos(db) });

    if (body.accion === 'restaurarCopia') {
      if (!RE_DIA.test(String(body.dia))) throw new ErrorHttp('Pedido inválido.');
      const c = await db.getJSON('respaldo/' + body.dia);
      if (!c) throw new ErrorHttp('Esa copia ya no existe.', 404);
      const { valor, etag } = await db.getDoc('productos');
      const doc = valor || { rev: 0, nextId: 1, items: [] };
      if (body.rev !== doc.rev) throw new ErrorHttp('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409);
      const nuevo = await guardarDoc(db, doc, etag, limpiar(c.items), `Volvió a la copia del ${body.dia}`, true);
      return json({ rev: nuevo.rev, items: nuevo.items });
    }

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
