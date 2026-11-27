// Panel de la clienta: entrar, ver, guardar y subir fotos. Todo por POST a /api/admin.
import crypto from 'node:crypto';
import { almacen } from './_lib/almacen.mjs';
import { json, ErrorHttp, claveOk, nuevaSesion, sesionOk, tokenDe, limpiar, tipoImagen, RE_IMG } from './_lib/comun.mjs';

const MAX_FOTO = 1.5 * 1024 * 1024;
const UNA_HORA = 3600e3;

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
      const items = limpiar(body.items);
      let siguiente = Math.max(doc.nextId || 1, ...items.map((p) => (p.id || 0) + 1));
      items.forEach((p) => { if (!p.id) p.id = siguiente++; });
      const nuevo = { rev: doc.rev + 1, nextId: siguiente, items };
      // Escritura condicionada: si otro guardado se coló entre la lectura y esta línea, no se pisa
      if (!(await db.setDocSi('productos', nuevo, etag))) throw new ErrorHttp('Se cruzaron dos guardados. Esperá unos segundos y volvé a intentar.', 409);
      // Borra fotos que ya no usa ningún producto (las de menos de 1 hora se respetan: pueden estar en edición)
      const usadas = new Set(items.flatMap((p) => p.imgs.map((u) => 'img/' + RE_IMG.exec(u)[1])));
      for (const k of await db.keys('img/')) {
        const subida = parseInt(k.slice(4).split('-')[0], 36);
        if (!usadas.has(k) && Date.now() - subida > UNA_HORA) await db.del(k);
      }
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
