import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { crear, DUENA, API_KEY } from '../dev/firebase-falso.mjs';

// Firebase de mentira en un puerto libre; las dos piezas del navegador (firebase.js y datos.js) corren tal cual en Node
const falso = crear();
await new Promise((ok) => falso.listen(0, ok));
const url = `http://localhost:${falso.address().port}`;
globalThis.FIREBASE = { projectId: 'mimimuse-test', apiKey: API_KEY, host: url, authHost: url, tokenHost: url };
await import('../js/firebase.js');
await import('../admin/datos.js');
const { DB, Datos } = globalThis;
after(() => falso.close());

const F1 = 'fabc123def456', F2 = 'fxyz789uvw012', T1 = 'ft1aaaaaaaaa1';
const P = (extra = {}) => ({ nombre: 'Falda', precio: 59.9, cat: 'Faldas', sub: 'Mini', ...extra });
const cambios = async (ops, extra = {}) => { const r = await Datos.cambios({ rev: Datos.estado().doc.rev, cambios: ops, ...extra }); return r; };

// ---------- Limpieza (no toca la red)
test('limpiar: unifica categorías sin mirar tildes ni mayúsculas, recorta talles agotados y redondea', () => {
  const r = Datos.limpiar([
    { nombre: ' Falda  larga ', precio: '59.999', cat: 'Faldas', sub: 'Mini', talles: ['S', 'M', 'S'], tallesAgotados: ['M', 'XL'], colores: ['rosa'] },
    { nombre: 'Falda', precio: 70, cat: 'faldas', sub: 'mini', agotado: 1, activo: false },
    { nombre: 'Aros', precio: 5, cat: 'Accesorios', sub: 'x' },
    { nombre: 'Gorro', precio: 5, cat: 'accesórios' },
  ]);
  assert.deepEqual(r.map((p) => [p.cat, p.sub]), [['Faldas', 'Mini'], ['Faldas', 'Mini'], ['Accesorios', 'x'], ['Accesorios', '']]);
  assert.deepEqual([r[0].nombre, r[0].precio, r[0].talles, r[0].tallesAgotados], ['Falda larga', 60, ['S', 'M'], ['M']]);
  assert.deepEqual([r[1].agotado, r[1].activo], [true, false]);
});

test('limpiar: rechaza lo que no es válido, con mensajes en español', () => {
  assert.throws(() => Datos.limpiar([{ nombre: '', precio: 1 }]), /no tiene nombre/);
  assert.throws(() => Datos.limpiar([{ nombre: 'A', precio: 'abc' }]), /precio inválido/);
  assert.throws(() => Datos.limpiar([{ nombre: 'A', precio: -1 }]), /precio inválido/);
  assert.throws(() => Datos.limpiar([{ nombre: 'A', precio: 50, precioAntes: 40 }]), /precio anterior tiene que ser mayor/);
  assert.equal(Datos.limpiar([{ nombre: 'A', precio: 50, precioAntes: 80 }])[0].precioAntes, 80);
  assert.equal(Datos.limpiar([{ nombre: 'A', precio: 50, precioAntes: '' }])[0].precioAntes, null);
  assert.throws(() => Datos.limpiar('no'), /inválida/);
});

test('limpiar: fotos y miniaturas alineadas, ids falsos descartados, máximo 8, ids repetidos', () => {
  const [p] = Datos.limpiar([P({ imgs: [F1, 'https://malo.com/x.png', F2], thumbs: [T1, 'x', 'https://malo.com/y.png'] })]);
  assert.deepEqual(p.imgs, [F1, F2]); assert.deepEqual(p.thumbs, [T1, '']);
  assert.equal(Datos.limpiar([P({ imgs: Array.from({ length: 12 }, (_, i) => 'fabcdefghij' + i + 'zz') })])[0].imgs.length, 8);
  const ids = Datos.limpiar([P({ id: 7 }), P({ id: 7 }), P({ id: 'x' })]).map((p) => p.id);
  assert.deepEqual(ids, [7, null, null]);
});

test('calcular: poner (nuevo y existente), quitar, orden, lista vacía y pedidos inválidos', () => {
  let doc = { rev: 0, nextId: 1, items: [] };
  let r = Datos.calcular(doc, { cambios: [{ op: 'poner', productos: [P({ nombre: 'A' }), P({ nombre: 'B' }), P({ nombre: 'C' })] }] });
  assert.deepEqual([r.doc.rev, r.doc.nextId, r.orden], [1, 4, [1, 2, 3]]); assert.deepEqual(r.puestos.map((p) => p.id), [1, 2, 3]);
  doc = r.doc;
  r = Datos.calcular(doc, { cambios: [{ op: 'poner', productos: [{ ...doc.items[1], precio: 10 }, P({ nombre: 'D' })] }] });   // B cambia de precio y entra D
  assert.deepEqual(r.orden, [1, 2, 3, 4]); assert.equal(r.doc.items[1].precio, 10);
  r = Datos.calcular(r.doc, { cambios: [{ op: 'orden', ids: [4, 3, 2, 1] }] });
  assert.deepEqual(r.orden, [4, 3, 2, 1]); assert.equal(r.doc.items[2].precio, 10); assert.equal(r.doc.items.length, 4);
  doc = r.doc;
  r = Datos.calcular(doc, { cambios: [{ op: 'quitar', ids: [1, 2] }] }); assert.deepEqual(r.orden, [4, 3]);
  assert.throws(() => Datos.calcular(doc, { cambios: [{ op: 'quitar', ids: [1, 2, 3, 4] }] }), /sin ningún producto/);
  assert.equal(Datos.calcular(doc, { cambios: [{ op: 'quitar', ids: [1, 2, 3, 4] }], confirmarVacio: true }).orden.length, 0);
  for (const malo of [[], [{ op: 'borrar' }], null, Array.from({ length: 51 }, () => ({ op: 'orden', ids: [] }))]) assert.throws(() => Datos.calcular(doc, { cambios: malo }), /Pedido inválido/);
  assert.throws(() => Datos.calcular(doc, { cambios: [{ op: 'poner', productos: [{ nombre: 'X', precio: 'mal' }] }] }), /precio inválido/);
});

// ---------- Con Firebase de mentira (las reglas también cuentan)
test('sin entrar no se escribe ni se lee el catálogo de la dueña, pero la tienda sí lee lo público', async () => {
  await assert.rejects(() => DB.guardar('fotos', 'fabc', { data: 'x' }), /sesión venció/);
  await assert.rejects(() => DB.leer('catalogo', 'admin'), /no te dejó hacer eso/);
  assert.equal(await DB.leer('catalogo', 'publico'), null);
});

test('entrar: clave mala da un mensaje claro y la buena abre la sesión', async () => {
  await assert.rejects(() => DB.entrar(DUENA.email, 'mala'), /email o la clave no son correctos/);
  await assert.rejects(() => DB.entrar('otra@mail.com', DUENA.clave), /email o la clave no son correctos/);
  assert.equal((await DB.entrar(DUENA.email, DUENA.clave)).email, DUENA.email);
});

test('guardar productos: rev sube, el público solo recibe los visibles y todo se lee de vuelta', async () => {
  assert.deepEqual(await Datos.ver(), { rev: 0, items: [], papelera: [] });
  const r = await cambios([{ op: 'poner', productos: [P({ nombre: 'Visible' }), P({ nombre: 'Oculta', activo: false, imgs: [F1], thumbs: [T1] })] }]);
  assert.deepEqual([r.rev, r.orden], [1, [1, 2]]);
  const admin = await Datos.ver();
  assert.deepEqual(admin.items.map((p) => p.nombre), ['Visible', 'Oculta']);
  const publico = await DB.leer('catalogo', 'publico');                       // sin sesión: es lo que ve la tienda
  assert.deepEqual(JSON.parse(publico.json).map((p) => p.nombre), ['Visible']);
  assert.equal(publico.rev, 1);
});

test('un cambio hecho desde otro lado se avisa en vez de pisarlo (409), también si cambió justo en el medio', async () => {
  await assert.rejects(() => Datos.cambios({ rev: 0, cambios: [{ op: 'orden', ids: [2, 1] }] }), (e) => e.status === 409 && /Alguien guardó/.test(e.message));
  // otro dispositivo guarda entre mi lectura y mi escritura: la condición de Firebase lo frena
  const d = await DB.leer('catalogo', 'admin', true);
  await DB.confirmar([{ update: { name: DB.nombre('catalogo', 'admin'), fields: DB.campos({ rev: d.rev, nextId: d.nextId, json: d.json, fecha: 1 }) } }]);
  await assert.rejects(() => cambios([{ op: 'orden', ids: [2, 1] }]), (e) => e.status === 409);
  await Datos.ver();                                                           // recargar y listo
  assert.equal((await cambios([{ op: 'orden', ids: [2, 1] }])).orden[0], 2);
});

test('fotos: se suben como documentos, se leen, y se borran solas cuando ningún producto las usa', async () => {
  const id1 = await Datos.subir(Buffer.from('foto uno').toString('base64'), 'image/webp'), mini = await Datos.subir(Buffer.from('mini').toString('base64'), 'image/webp');
  assert.match(id1, Datos.RE_FOTO);
  assert.equal(await DB.fotoSrc(id1), `data:image/webp;base64,${Buffer.from('foto uno').toString('base64')}`);
  const [a, b] = (await Datos.ver()).items;
  await cambios([{ op: 'poner', productos: [{ ...a, imgs: [id1], thumbs: [mini] }, { ...b, imgs: [id1], thumbs: [mini] }] }]);    // las dos comparten la foto
  const existe = async (id) => !!(await DB.leer('fotos', id));
  await cambios([{ op: 'poner', productos: [{ ...a, imgs: [], thumbs: [] }] }]);
  assert.equal(await existe(id1), true, 'la sigue usando el otro producto');
  await cambios([{ op: 'poner', productos: [{ ...b, imgs: [], thumbs: [] }] }]);
  assert.equal(await existe(id1), false); assert.equal(await existe(mini), false);
});

test('borrar un producto lo manda a la papelera con sus fotos, y se puede recuperar', async () => {
  const id = await Datos.subir(Buffer.from('x').toString('base64'));
  const r = await cambios([{ op: 'poner', productos: [P({ nombre: 'Con foto', imgs: [id], thumbs: [] })] }]);
  const pid = r.puestos[0].id;
  const q = await cambios([{ op: 'quitar', ids: [pid] }]);
  assert.equal(q.papelera[0].nombre, 'Con foto'); assert.ok(q.papelera[0].borrado);
  assert.ok(!(await Datos.ver()).items.some((p) => p.id === pid));
  assert.equal(!!(await DB.leer('fotos', id)), true, 'la foto se guarda mientras está en la papelera');
  const v = await cambios([{ op: 'recuperar', ids: [pid] }]);
  assert.ok(v.orden.includes(pid)); assert.ok(!v.papelera.some((p) => p.id === pid));
  assert.deepEqual((await Datos.ver()).items.find((p) => p.id === pid).imgs, [id]);
});

test('papelera: guarda como mucho 30 y al pasarse se borran las fotos de los más viejos', async () => {
  const id = await Datos.subir(Buffer.from('vieja').toString('base64'));
  const r = await cambios([{ op: 'poner', productos: [P({ nombre: 'Viejo', imgs: [id], thumbs: [] }), ...Array.from({ length: 30 }, (_, i) => P({ nombre: `Tanda ${i}` }))] }]);
  const [viejo, ...tanda] = r.puestos.map((p) => p.id);
  await cambios([{ op: 'quitar', ids: [viejo] }]);
  const q = await cambios([{ op: 'quitar', ids: tanda }]);
  assert.equal(q.papelera.length, 30); assert.ok(!q.papelera.some((p) => p.id === viejo));
  assert.equal(await DB.leer('fotos', id), null);
});

test('la sesión se renueva sola cuando vence el permiso', async () => {
  DB.sesion().exp = 0;                                                         // "pasó una hora"
  const antes = DB.sesion().idToken;
  assert.ok((await Datos.ver()).items.length > 0);
  assert.notEqual(DB.sesion().idToken, antes);
});

test('cupones: se validan, se leen sin entrar y solo la dueña los cambia', async () => {
  assert.throws(() => Datos.validarCodigo({ id: 'a b', porcentaje: 10 }), /entre 3 y 24/);
  assert.throws(() => Datos.validarCodigo({ id: 'HOLA10', porcentaje: 0 }), /entre 1% y 99%/);
  assert.throws(() => Datos.validarCodigo({ id: 'HOLA10', porcentaje: 10, vence: '31/12/2026' }), /fecha/);
  assert.deepEqual(await Datos.guardarCodigo({ id: ' hola 10 ', porcentaje: '10', vence: '2026-12-31' }), { id: 'HOLA10', porcentaje: 10, activo: true, vence: '2026-12-31' });
  await Datos.guardarCodigo({ id: 'VERANO', porcentaje: 25, activo: false });
  const sesion = DB.sesion(); DB.salir();
  assert.deepEqual([await DB.leer('codigos', 'HOLA10'), await DB.leer('codigos', 'VERANO')].map((c) => [c.id, c.porcentaje, c.activo]), [['HOLA10', 10, true], ['VERANO', 25, false]]);   // la tienda lee un cupón sin entrar
  await assert.rejects(() => DB.lista('codigos'), /permiso|Firebase no te dejó/i);   // pero la lista completa no
  await assert.rejects(() => DB.lista('fotos'), /permiso|Firebase no te dejó/i);
  await assert.rejects(() => Datos.guardarCodigo({ id: 'LADRON', porcentaje: 99 }), /sesión venció/);
  await DB.entrar(DUENA.email, DUENA.clave);
  await Datos.borrarCodigo('VERANO');
  assert.deepEqual((await Datos.codigos()).map((c) => c.id), ['HOLA10']);
  assert.ok(sesion);
});

test('el catálogo tiene tope de tamaño y avisa en vez de fallar a medias', async () => {
  await Datos.ver();
  const largos = Array.from({ length: 500 }, (_, i) => P({ nombre: `Producto ${i}`, desc: 'x'.repeat(2000) }));
  await assert.rejects(() => cambios([{ op: 'poner', productos: largos }]), /ya no entra/);
  assert.equal((await Datos.ver()).items.length > 0, true);                    // lo anterior sigue intacto
});

test('sin internet o con Firebase caído los mensajes son claros', async () => {
  falso.estado.caido = true;
  await assert.rejects(() => Datos.ver(), /Firebase no respondió bien/);
  falso.estado.caido = false;
  const cfg = globalThis.FIREBASE; globalThis.FIREBASE = { ...cfg, host: 'http://localhost:1' };
  await assert.rejects(() => Datos.ver(), /No hay conexión/);
  globalThis.FIREBASE = cfg;
});

test('lo que entrega el panel es una copia: cambiarlo en la pantalla no cambia lo guardado hasta guardar', async () => {
  const v = await Datos.ver();
  v.items.push({ nombre: 'sin guardar', precio: 1 }); v.items[0].nombre = 'cambiado';
  const otra = await Datos.ver();
  assert.equal(otra.items.some((p) => p.nombre === 'sin guardar' || p.nombre === 'cambiado'), false);
  const r = await Datos.cambios({ rev: otra.rev, cambios: [{ op: 'poner', productos: [{ nombre: 'Nuevo', precio: 2 }] }] });
  r.puestos[0].nombre = 'tocado después';
  assert.equal(Datos.estado().doc.items.at(-1).nombre, 'Nuevo');
});
