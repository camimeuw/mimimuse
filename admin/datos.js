/* ============ Datos del panel: productos, fotos y cupones en Firebase ============
   Los productos viven en dos documentos que se escriben juntos (todo o nada):
     catalogo/admin    → todos los productos (solo la dueña lo puede leer)
     catalogo/publico  → solo los visibles (lo lee la tienda, con 1 sola lectura por visita)
   Las fotos son documentos aparte (fotos/<id>) y los cupones también (codigos/<CÓDIGO>).
   Lo de acá abajo que no toca la red (limpiar, calcular) se prueba con npm test.
*/
(() => {
  'use strict';
  const MAX_FOTOS = 8, MAX_JSON = 900000;           // Firestore guarda hasta ~1 MB por documento
  const RE_FOTO = /^f[a-z0-9]{12,40}$/;
  const fallo = (msg, estado) => Object.assign(new Error(msg), estado ? { status: estado } : {});

  // ---------- Limpieza: no se confía ni en lo que escribe el panel ----------
  const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const lista = (v, max, n) => [...new Set((Array.isArray(v) ? v : []).map((x) => txt(x, max)).filter(Boolean))].slice(0, n);
  const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  // Fotos y miniaturas van en listas paralelas: la miniatura i es la versión chica de la foto i ('' si no hay)
  function fotos(p) {
    const pares = (Array.isArray(p.imgs) ? p.imgs : []).map((u, k) => [u, Array.isArray(p.thumbs) ? p.thumbs[k] : '']).filter(([u]) => RE_FOTO.test(u)).slice(0, MAX_FOTOS);
    return { imgs: pares.map(([u]) => u), thumbs: pares.map(([, t]) => (RE_FOTO.test(t) ? t : '')) };
  }

  function limpiar(items) {
    if (!Array.isArray(items) || items.length > 1000) throw fallo('Lista de productos inválida (máximo 1000).');
    const formas = new Map();   // "Remeras" y "remeras" se unifican en la primera forma escrita
    const forma = (clave, valor) => { if (!valor) return ''; if (!formas.has(clave)) formas.set(clave, valor); return formas.get(clave); };
    const ids = new Set();
    return items.map((p, i) => {
      const nombre = txt(p?.nombre, 120);
      if (!nombre) throw fallo(`El producto ${i + 1} no tiene nombre.`);
      const precio = Math.round(Number(p.precio) * 100) / 100;
      if (!Number.isFinite(precio) || precio < 0) throw fallo(`"${nombre}": precio inválido.`);
      const antes = p.precioAntes === '' || p.precioAntes == null ? null : Math.round(Number(p.precioAntes) * 100) / 100;
      if (antes !== null && (!Number.isFinite(antes) || antes < 0)) throw fallo(`"${nombre}": precio anterior inválido.`);
      if (antes !== null && antes <= precio) throw fallo(`"${nombre}": el precio anterior tiene que ser mayor que el precio actual (si no hay oferta, dejalo vacío).`);
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

  // Aplica los cambios ({op:'poner'|'quitar'|'orden'}) a un documento {rev,nextId,items}. Devuelve el documento nuevo y lo que hay que avisar.
  function calcular(doc, { cambios, confirmarVacio }) {
    if (!Array.isArray(cambios) || !cambios.length || cambios.length > 50) throw fallo('Pedido inválido.');
    let items = doc.items.slice();
    const puestos = [];                              // los productos que llegaron, para devolverlos ya limpios
    for (const c of cambios) {
      if (c?.op === 'poner') {
        if (!Array.isArray(c.productos) || c.productos.length > 500) throw fallo('Pedido inválido.');
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
      } else throw fallo('Pedido inválido.');
    }
    const limpios = limpiar(items);
    if (!limpios.length && doc.items.length && !confirmarVacio) throw fallo('Esto dejaría la tienda sin ningún producto. Si es lo que querés, confirmalo.');
    let siguiente = Math.max(doc.nextId || 1, ...limpios.map((p) => (p.id || 0) + 1));
    limpios.forEach((p) => { if (!p.id) p.id = siguiente++; });
    return { doc: { rev: doc.rev + 1, nextId: siguiente, items: limpios }, orden: limpios.map((p) => p.id), puestos: puestos.map((r) => limpios[items.indexOf(r)]).filter(Boolean) };
  }
  const fotosDe = (items) => new Set(items.flatMap((p) => [...p.imgs, ...p.thumbs].filter(Boolean)));

  // ---------- Firebase ----------
  const vacio = () => ({ rev: 0, nextId: 1, items: [] });
  let actual = { doc: vacio(), updateTime: null };   // lo último que se leyó o se guardó: sirve para detectar un cambio ajeno

  async function ver() {
    const d = await DB.leer('catalogo', 'admin', true);
    actual = d ? { doc: { rev: d.rev || 0, nextId: d.nextId || 1, items: JSON.parse(d.json || '[]') }, updateTime: d.updateTime } : { doc: vacio(), updateTime: null };
    return { rev: actual.doc.rev, items: structuredClone(actual.doc.items) };     // copia: el panel cambia sus productos sin tocar los nuestros
  }

  async function cambios(body) {
    if (body.rev !== actual.doc.rev) throw fallo('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409);
    const r = calcular(actual.doc, body);
    const json = JSON.stringify(r.doc.items), publico = JSON.stringify(r.doc.items.filter((p) => p.activo));
    if (json.length > MAX_JSON) throw fallo('La lista de productos ya no entra en un solo documento de Firebase (máximo unos 400 productos con descripciones largas). Avisale a quien armó la tienda.');
    const fecha = Date.now();
    const escrituras = [
      { update: { name: DB.nombre('catalogo', 'admin'), fields: DB.campos({ rev: r.doc.rev, nextId: r.doc.nextId, json, fecha }) }, currentDocument: actual.updateTime ? { updateTime: actual.updateTime } : { exists: false } },
      { update: { name: DB.nombre('catalogo', 'publico'), fields: DB.campos({ rev: r.doc.rev, json: publico, fecha }) } },
    ];
    let resultado;
    try { resultado = await DB.confirmar(escrituras); }
    catch (e) { if (/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS/.test(e.codigo || '')) throw fallo('Alguien guardó cambios antes que vos. Recargá la página para ver lo último.', 409); throw e; }
    const antes = fotosDe(actual.doc.items);
    actual = { doc: r.doc, updateTime: resultado.writeResults?.[0]?.updateTime || null };
    await limpiarFotos(antes);                       // las fotos que ya no usa ningún producto se borran (si falla, solo queda una foto de más)
    return { rev: r.doc.rev, orden: r.orden, puestos: structuredClone(r.puestos) };
  }

  const idFoto = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  async function subir(base64, tipo) {
    const id = idFoto();
    await DB.guardar('fotos', id, { data: base64, tipo: tipo || 'image/webp' });
    return id;
  }
  // Borra fotos que ya no usa ningún producto (se llama después de guardar)
  async function limpiarFotos(candidatas) {
    const usadas = fotosDe(actual.doc.items);
    for (const id of new Set(candidatas)) if (id && !usadas.has(id)) { try { await DB.borrar('fotos', id); DB.olvidarFoto(id); } catch { /* si no se puede, queda una foto de más */ } }
  }

  // ---------- Cupones ----------
  const normCodigo = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, '');
  const codigos = async () => (await DB.lista('codigos')).sort((a, b) => a.id.localeCompare(b.id));
  function validarCodigo(c) {
    const id = normCodigo(c.id), pct = Math.round(Number(c.porcentaje));
    if (!/^[A-Z0-9_-]{3,24}$/.test(id)) throw fallo('El código debe tener entre 3 y 24 letras o números, sin espacios ni tildes.');
    if (!(pct >= 1 && pct <= 99)) throw fallo('El descuento tiene que estar entre 1% y 99%.');
    if (c.vence && !/^\d{4}-\d{2}-\d{2}$/.test(c.vence)) throw fallo('La fecha de vencimiento no es válida.');
    return { id, porcentaje: pct, activo: c.activo !== false, vence: c.vence || '' };
  }
  async function guardarCodigo(c) { const v = validarCodigo(c); await DB.guardar('codigos', v.id, { porcentaje: v.porcentaje, activo: v.activo, vence: v.vence }); return v; }
  const borrarCodigo = (id) => DB.borrar('codigos', id);

  (typeof window !== 'undefined' ? window : globalThis).Datos = { limpiar, calcular, fotosDe, RE_FOTO, ver, cambios, subir, limpiarFotos, codigos, guardarCodigo, borrarCodigo, validarCodigo, normCodigo, estado: () => actual };
})();
