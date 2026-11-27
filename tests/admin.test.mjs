import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.ALMACEN_LOCAL = await fs.mkdtemp(path.join(os.tmpdir(), 'mimi-'));
process.env.ADMIN_PASSWORD = 'clave-de-prueba';
const admin = (await import('../netlify/functions/admin.mjs')).default;
const publico = (await import('../netlify/functions/productos.mjs')).default;
const imagen = (await import('../netlify/functions/imagen.mjs')).default;

const post = (body, token) => admin(new Request('http://x/api/admin', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64');
let token, rev;

test('entrar: clave mala falla, clave buena da sesión', async () => {
  assert.equal((await post({ accion: 'entrar', clave: 'mala' })).status, 401);
  const r = await post({ accion: 'entrar', clave: 'clave-de-prueba' });
  assert.equal(r.status, 200); token = (await r.json()).token; assert.ok(token);
});

test('sin sesión no se puede ver ni guardar', async () => {
  assert.equal((await post({ accion: 'ver' })).status, 401);
  assert.equal((await post({ accion: 'guardar', rev: 0, items: [] }, 'x.y')).status, 401);
});

test('guardar: unifica categorías, recorta talles agotados y asigna id', async () => {
  rev = (await (await post({ accion: 'ver' }, token)).json()).rev;
  const r = await post({ accion: 'guardar', rev, items: [
    { nombre: 'Falda', precio: '59.9', cat: 'Faldas', sub: 'Mini', talles: ['S', 'M', 'S'], tallesAgotados: ['M', 'XL'], colores: ['rosa'] },
    { nombre: 'Falda larga', precio: 70, cat: 'faldas', sub: 'mini', agotado: true, activo: false },
  ] }, token);
  assert.equal(r.status, 200);
  const d = await r.json(); rev = d.rev;
  assert.deepEqual(d.items.map((p) => [p.cat, p.sub]), [['Faldas', 'Mini'], ['Faldas', 'Mini']]);
  assert.deepEqual(d.items[0].talles, ['S', 'M']);
  assert.deepEqual(d.items[0].tallesAgotados, ['M']);   // XL no existe: se descarta
  assert.equal(d.items[0].precio, 59.9);
  assert.ok(d.items.every((p) => Number.isInteger(p.id)));
});

test('guardar: datos inválidos se rechazan', async () => {
  for (const item of [{ nombre: '', precio: 1 }, { nombre: 'X', precio: -3 }, { nombre: 'X', precio: 'abc' }])
    assert.equal((await post({ accion: 'guardar', rev, items: [item] }, token)).status, 400);
});

test('guardar con versión vieja da 409', async () => {
  assert.equal((await post({ accion: 'guardar', rev: rev - 1, items: [] }, token)).status, 409);
});

test('la tienda solo ve productos visibles', async () => {
  const d = await (await publico()).json();
  assert.deepEqual(d.items.map((p) => p.nombre), ['Falda']);
});

test('fotos: se suben, se sirven y se rechazan formatos falsos', async () => {
  assert.equal((await post({ accion: 'subir', datos: Buffer.from('hola').toString('base64') }, token)).status, 400);
  const r = await post({ accion: 'subir', datos: PNG }, token);
  assert.equal(r.status, 200);
  const { url } = await r.json();
  const img = await imagen(new Request('http://x' + url));
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await imagen(new Request('http://x/api/imagen/../../etc/passwd'))).status, 404);
  // una URL de foto que no es nuestra no se guarda
  const g = await post({ accion: 'guardar', rev, items: [{ nombre: 'Con foto', precio: 1, imgs: [url, 'https://malo.com/x.png'] }] }, token);
  assert.deepEqual((await g.json()).items[0].imgs, [url]);
});

test('ids repetidos: el segundo recibe uno nuevo', async () => {
  const r = await post({ accion: 'guardar', rev: (await (await post({ accion: 'ver' }, token)).json()).rev, items: [{ id: 7, nombre: 'A', precio: 1 }, { id: 7, nombre: 'B', precio: 1 }] }, token);
  const ids = (await r.json()).items.map((p) => p.id);
  assert.equal(new Set(ids).size, 2);
});

test('5 claves malas bloquean la entrada, incluso con la buena', async () => {
  for (let i = 0; i < 5; i++) await post({ accion: 'entrar', clave: 'mala' });
  assert.equal((await post({ accion: 'entrar', clave: 'clave-de-prueba' })).status, 429);
  await fs.rm(path.join(process.env.ALMACEN_LOCAL, 'intentos'), { force: true });   // fin del bloqueo
  assert.equal((await post({ accion: 'entrar', clave: 'clave-de-prueba' })).status, 200);
});

test('dos guardados a la vez con la misma versión: uno entra y el otro recibe 409 (no se pisan)', async () => {
  const d = await (await post({ accion: 'ver' }, token)).json();
  const items = (n) => d.items.map((p, i) => (i === 0 ? { ...p, nombre: n } : p));
  const [a, b] = await Promise.all([post({ accion: 'guardar', rev: d.rev, items: items('Primero') }, token), post({ accion: 'guardar', rev: d.rev, items: items('Segundo') }, token)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const final = await (await post({ accion: 'ver' }, token)).json();
  assert.equal(final.rev, d.rev + 1);
  assert.equal(final.items[0].nombre, a.status === 200 ? 'Primero' : 'Segundo');
});

// ---------- versiones anteriores ----------
const ver = async () => (await (await post({ accion: 'ver' }, token)).json());
const guardar = (items, extra = {}) => ver().then((d) => post({ accion: 'guardar', rev: d.rev, items, ...extra }, token));

test('guardar con lista vacía exige confirmación explícita', async () => {
  const d = await ver();
  assert.ok(d.items.length > 0);
  const sin = await post({ accion: 'guardar', rev: d.rev, items: [] }, token);
  assert.equal(sin.status, 400);
  assert.equal((await ver()).items.length, d.items.length);   // no se tocó nada
});

test('cada guardado deja la versión anterior; se puede volver atrás tras borrar', async () => {
  const antes = (await ver()).items;
  const r = await guardar([], { nota: 'Eliminó todo', confirmarVacio: true });
  assert.equal(r.status, 200);
  assert.equal((await ver()).items.length, 0);
  const { versiones } = await (await post({ accion: 'versiones' }, token)).json();
  assert.equal(versiones[0].nota, 'Eliminó todo');
  assert.equal(versiones[0].cantidad, antes.length);
  const rest = await post({ accion: 'restaurar', rev: (await ver()).rev, version: versiones[0].rev }, token);
  assert.equal(rest.status, 200);
  assert.deepEqual((await rest.json()).items.map((p) => p.nombre), antes.map((p) => p.nombre));
  assert.equal((await post({ accion: 'restaurar', rev: (await ver()).rev, version: 999999 }, token)).status, 404);
});

test('solo quedan las últimas 30 versiones', async () => {
  for (let i = 0; i < 33; i++) await guardar([{ nombre: 'P' + i, precio: 1 }], { nota: 'n' + i });
  const { versiones } = await (await post({ accion: 'versiones' }, token)).json();
  assert.equal(versiones.length, 30);
  const archivos = (await fs.readdir(process.env.ALMACEN_LOCAL)).filter((f) => f.startsWith('ver__'));
  assert.equal(archivos.length, 30);
});

test('fotos: se borran las sueltas viejas, pero no las que usa un producto ni una versión', async () => {
  const dir = process.env.ALMACEN_LOCAL, hace2h = (Date.now() - 2 * 3600e3).toString(36);
  const foto = async (n) => { const k = `${hace2h}-${n.repeat(12)}.png`; await fs.writeFile(path.join(dir, 'img__' + k), 'x'); await fs.writeFile(path.join(dir, 'img__' + k + '.tipo'), 'image/png'); return k; };
  const [usada, enVersion, suelta] = [await foto('a'), await foto('b'), await foto('c')];
  await guardar([{ nombre: 'Con fotos', precio: 1, imgs: ['/api/imagen/' + usada, '/api/imagen/' + enVersion] }]);
  await guardar([{ nombre: 'Con fotos', precio: 1, imgs: ['/api/imagen/' + usada] }]);   // enVersion queda solo en la versión anterior
  const existe = (k) => fs.stat(path.join(dir, 'img__' + k)).then(() => true, () => false);
  assert.equal(await existe(usada), true);
  assert.equal(await existe(enVersion), true);
  assert.equal(await existe(suelta), false);
});

test('precio anterior debe ser mayor que el precio (oferta)', async () => {
  assert.equal((await guardar([{ nombre: 'X', precio: 50, precioAntes: 40 }])).status, 400);
  assert.equal((await guardar([{ nombre: 'X', precio: 50, precioAntes: 80 }])).status, 200);
});

test('miniaturas: van alineadas con las fotos, se descartan las inválidas y no se borran mientras se usan', async () => {
  const dir = process.env.ALMACEN_LOCAL, hace2h = (Date.now() - 2 * 3600e3).toString(36);
  const foto = async (n) => { const k = `${hace2h}-${n.repeat(12)}.webp`; await fs.writeFile(path.join(dir, 'img__' + k), 'x'); await fs.writeFile(path.join(dir, 'img__' + k + '.tipo'), 'image/webp'); return '/api/imagen/' + k; };
  const [g1, m1, g2] = [await foto('d'), await foto('e'), await foto('f')];
  const r = await guardar([{ nombre: 'Con miniaturas', precio: 1, imgs: [g1, 'https://malo.com/x.png', g2], thumbs: [m1, 'x', 'https://malo.com/y.png'] }]);
  const p = (await r.json()).items[0];
  assert.deepEqual(p.imgs, [g1, g2]);          // la inválida se va y las listas siguen alineadas
  assert.deepEqual(p.thumbs, [m1, '']);         // la 2ª no tiene miniatura válida
  const existe = (u) => fs.stat(path.join(dir, 'img__' + u.split('/').pop())).then(() => true, () => false);
  assert.equal(await existe(m1), true);        // la miniatura cuenta como "en uso"
});
