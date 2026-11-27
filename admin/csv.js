// Planilla (CSV) de productos: leer, validar y escribir. Sin dependencias; se usa en el panel y en las pruebas.
(function (g) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIAS = { id: 'id', nombre: 'nombre', producto: 'nombre', precio: 'precio', precioanterior: 'precioAntes', preciooriginal: 'precioAntes', antes: 'precioAntes',
    categoria: 'cat', subcategoria: 'sub', descripcion: 'desc', talles: 'talles', talle: 'talles', tallesagotados: 'tallesAgotados', colores: 'colores', color: 'colores',
    agotado: 'agotado', visible: 'activo', activo: 'activo', fotos: 'fotos', foto: 'fotos', miniaturas: 'miniaturas' };
  const COLUMNAS = ['id', 'nombre', 'precio', 'precio_anterior', 'categoria', 'subcategoria', 'descripcion', 'talles', 'talles_agotados', 'colores', 'agotado', 'visible', 'fotos', 'miniaturas'];

  function delimitador(t) {
    const l = t.split(/\r?\n/)[0] || '', n = (c) => (l.match(new RegExp(c, 'g')) || []).length;
    const coma = n(','), punto = n(';'), tab = n('\t');
    return tab > coma && tab > punto ? '\t' : punto > coma ? ';' : ',';
  }
  // Texto del archivo -> filas de celdas (maneja comillas, saltos de línea dentro de una celda y el BOM de Excel)
  function leer(texto) {
    texto = String(texto).replace(/^﻿/, '');
    const d = delimitador(texto), filas = []; let fila = [], cel = '', q = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (q) { if (c === '"') { if (texto[i + 1] === '"') { cel += '"'; i++; } else q = false; } else cel += c; }
      else if (c === '"') q = true;
      else if (c === d) { fila.push(cel); cel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; fila.push(cel); filas.push(fila); fila = []; cel = ''; }
      else cel += c;
    }
    if (cel !== '' || fila.length) { fila.push(cel); filas.push(fila); }
    return filas.filter((f) => f.some((c) => c.trim()));
  }

  // "59,90", "59.90", "S/ 1.259,90" -> número (o NaN)
  function numero(s) {
    let t = String(s ?? '').replace(/[^\d.,-]/g, '');
    if (!t) return NaN;
    const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
    if (coma >= 0 && punto >= 0) t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (coma >= 0) t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
    return Number(t);
  }
  const lista = (s) => String(s ?? '').split(/[|,]/).map((x) => x.trim()).filter(Boolean);
  const si = (s) => /^(si|s|1|true|x|yes)$/.test(norm(s));

  // Filas -> { productos: [{ fila, campos }], errores: [{ fila, msg }], columnas }
  function aProductos(filas) {
    const [cab = [], ...cuerpo] = filas, col = {};
    cab.forEach((h, i) => { const campo = ALIAS[norm(h)]; if (campo && !(campo in col)) col[campo] = i; });
    const errores = [], productos = [];
    if (!('nombre' in col) || !('precio' in col)) return { productos, errores: [{ fila: 1, msg: `Faltan columnas: la primera fila tiene que tener al menos «nombre» y «precio». Descargá la planilla de ejemplo.` }], columnas: col };
    cuerpo.forEach((f, k) => {
      const fila = k + 2, get = (c) => (c in col ? (f[col[c]] ?? '').trim() : undefined);
      const nombre = get('nombre'), precio = numero(get('precio'));
      if (!nombre) return errores.push({ fila, msg: 'Falta el nombre.' });
      if (!Number.isFinite(precio) || precio < 0) return errores.push({ fila, msg: `«${nombre}»: el precio no es un número válido.` });
      const c = { nombre, precio };
      if ('id' in col && get('id')) { const id = Number(get('id')); if (Number.isInteger(id) && id > 0) c.id = id; else return errores.push({ fila, msg: `«${nombre}»: el id tiene que ser un número entero (o dejalo vacío si es nuevo).` }); }
      if ('precioAntes' in col) {
        const a = get('precioAntes') === '' ? null : numero(get('precioAntes'));
        if (a !== null && (!Number.isFinite(a) || a <= precio)) return errores.push({ fila, msg: `«${nombre}»: el precio anterior tiene que ser mayor que el precio (o dejalo vacío si no hay oferta).` });
        c.precioAntes = a;
      }
      for (const campo of ['cat', 'sub', 'desc']) if (campo in col) c[campo] = get(campo);
      for (const campo of ['talles', 'tallesAgotados', 'colores']) if (campo in col) c[campo] = lista(get(campo));
      if ('agotado' in col) c.agotado = si(get('agotado'));
      if ('activo' in col) c.activo = get('activo') === '' ? true : si(get('activo'));
      if ('fotos' in col && get('fotos')) c.fotos = lista(get('fotos'));
      if ('miniaturas' in col && get('miniaturas')) c.miniaturas = lista(get('miniaturas'));
      productos.push({ fila, campos: c });
    });
    return { productos, errores, columnas: col };
  }

  const cel = (v) => { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const aTexto = (filas) => '﻿' + filas.map((f) => f.map(cel).join(',')).join('\r\n') + '\r\n';
  function exportar(items) {
    return aTexto([COLUMNAS, ...items.map((p) => [p.id, p.nombre, p.precio, p.precioAntes ?? '', p.cat, p.sub, p.desc, p.talles.join(' | '), p.tallesAgotados.join(' | '), p.colores.join(' | '), p.agotado ? 'sí' : 'no', p.activo ? 'sí' : 'no', p.imgs.join(' | '), (p.thumbs || []).join(' | ')])]);
  }
  const plantilla = () => aTexto([COLUMNAS.slice(0, 13), ['', 'Falda tableada', '59.90', '', 'Faldas', 'Mini', 'Falda tableada con cintura alta.', 'S | M | L', 'M', 'rosa | negro', 'no', 'sí', 'falda-tableada-1.jpg | falda-tableada-2.jpg'], ['', 'Aros de estrella', '15', '25', 'Accesorios', 'Aros', '', 'Único', '', 'dorado', 'no', 'sí', 'aros-estrella.png']]);

  // Excel en español guarda "CSV" en ANSI (Windows-1252), no en UTF-8: si no es UTF-8 válido se lee como ANSI
  function decodificar(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
  }

  g.CSV = { decodificar, leer, aProductos, exportar, plantilla, numero, norm };
})(typeof self !== 'undefined' ? self : globalThis);
