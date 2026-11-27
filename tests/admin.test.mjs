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
