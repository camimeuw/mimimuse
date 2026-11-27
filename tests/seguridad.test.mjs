import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

process.env.ALMACEN_LOCAL = await fs.mkdtemp(path.join(os.tmpdir(), 'mimi-seg-'));
process.env.ADMIN_PASSWORD = 'clave-de-netlify';
const dir = process.env.ALMACEN_LOCAL;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const { hacerRespaldo, MAX_RESPALDOS } = await import('../netlify/functions/_lib/respaldo.mjs');
const { almacen } = await import('../netlify/functions/_lib/almacen.mjs');

const post = (body, { token, ip } = {}) => admin(new Request('http://x/api/admin', { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(ip ? { 'x-nf-client-connection-ip': ip } : {}) }, body: JSON.stringify(body) }));
const entrar = async (clave, ip, extra = {}) => { const r = await post({ accion: 'entrar', clave, ...extra }, { ip }); return { status: r.status, ...(await r.json()) }; };
const sinBloqueos = async () => { for (const f of await fs.readdir(dir)) if (f.startsWith('intentos__')) await fs.rm(path.join(dir, f)); };
const conFecha = async (ms, fn) => { const real = Date.now; Date.now = () => real() + ms; try { return await fn(); } finally { Date.now = real; } };

test('30 intentos malos A LA VEZ: solo 5 llegan a mirar la clave, el resto recibe 429', async () => {
  const rs = await Promise.all(Array.from({ length: 30 }, () => post({ accion: 'entrar', clave: 'mala' }, { ip: '1.1.1.1' })));
  const por = (c) => rs.filter((r) => r.status === c).length;
  assert.equal(por(401), 5); assert.equal(por(429), 25);
});

test('esa conexión queda bloqueada aunque use la clave buena, pero la dueña desde otra conexión entra', async () => {
  assert.equal((await entrar('clave-de-netlify', '1.1.1.1')).status, 429);
  assert.equal((await entrar('clave-de-netlify', '2.2.2.2')).status, 200);
});

test('el bloqueo se levanta a los 10 minutos', async () => {
  assert.equal((await conFecha(11 * 60e3, () => entrar('clave-de-netlify', '1.1.1.1'))).status, 200);
});

test('una entrada buena borra los intentos fallidos', async () => {
  await sinBloqueos();
  for (let i = 0; i < 4; i++) await entrar('mala', '3.3.3.3');
  assert.equal((await entrar('clave-de-netlify', '3.3.3.3')).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await entrar('mala', '3.3.3.3')).status, 401);   // empieza de cero: no se bloquea
  assert.equal((await entrar('clave-de-netlify', '3.3.3.3')).status, 200);
});

test('el pedido no puede falsear su conexión con X-Forwarded-For', async () => {
  await sinBloqueos();
  const mal = (n) => admin(new Request('http://x/api/admin', { method: 'POST', headers: { 'x-forwarded-for': `9.9.9.${n}` }, body: JSON.stringify({ accion: 'entrar', clave: 'mala' }) }));
  const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => mal(i)));
  assert.equal(rs.filter((r) => r.status === 401).length, 5);   // todos cuentan como la misma conexión
});

test('«recordarme» da una sesión de 30 días; si no, de 12 horas', async () => {
  await sinBloqueos();
  const horas = (t) => (Number(t.split('.')[0]) - Date.now()) / 3600e3;
  assert.ok(Math.abs(horas((await entrar('clave-de-netlify', '4.4.4.4')).token) - 12) < 0.1);
  assert.ok(Math.abs(horas((await entrar('clave-de-netlify', '4.4.4.4', { recordar: true })).token) - 720) < 0.1);
});

test('tokens manipulados, del formato viejo o vencidos no sirven', async () => {
  const { token } = await entrar('clave-de-netlify', '4.4.4.4');
  assert.equal((await post({ accion: 'ver' }, { token })).status, 200);
  const [exp, v, firma] = token.split('.');
  for (const malo of [`${exp}.${v}.x${firma.slice(1)}`, `${Number(exp) + 1e9}.${v}.${firma}`, `${exp}.${Number(v) + 1}.${firma}`, `${exp}.${firma}`, '', 'a.b.c']) assert.equal((await post({ accion: 'ver' }, { token: malo })).status, 401, malo);
  assert.equal((await conFecha(13 * 3600e3, () => post({ accion: 'ver' }, { token }))).status, 401);   // pasaron 13 horas
});

test('cerrar sesión en todos los dispositivos invalida todas las sesiones; entrar de nuevo anda', async () => {
  const a = (await entrar('clave-de-netlify', '5.5.5.5')).token, b = (await entrar('clave-de-netlify', '5.5.5.5', { recordar: true })).token;
  assert.equal((await post({ accion: 'salirTodos' }, { token: a })).status, 200);
  assert.equal((await post({ accion: 'ver' }, { token: a })).status, 401);
  assert.equal((await post({ accion: 'ver' }, { token: b })).status, 401);
  const c = (await entrar('clave-de-netlify', '5.5.5.5')).token;
  assert.equal((await post({ accion: 'ver' }, { token: c })).status, 200);
});

test('cambiar la clave: validaciones, la vieja deja de entrar, la nueva entra, las demás sesiones se cierran y la de Netlify sigue valiendo', async () => {
  await sinBloqueos();
  const token = (await entrar('clave-de-netlify', '6.6.6.6')).token, otra = (await entrar('clave-de-netlify', '7.7.7.7')).token;
  const cambiar = (d) => post({ accion: 'cambiarClave', ...d }, { token, ip: '6.6.6.6' });
  assert.equal((await cambiar({ actual: 'incorrecta', nueva: 'una frase larga y bonita' })).status, 401);
  assert.equal((await cambiar({ actual: 'clave-de-netlify', nueva: 'corta' })).status, 400);
  assert.equal((await cambiar({ actual: 'clave-de-netlify', nueva: 'clave-de-netlify' })).status, 400);
  assert.equal((await cambiar({ actual: 'clave-de-netlify', nueva: 'x'.repeat(201) })).status, 400);
  const r = await cambiar({ actual: 'clave-de-netlify', nueva: 'mi frase larga 2026' });
  assert.equal(r.status, 200);
  const nuevo = (await r.json()).token;
  assert.equal((await post({ accion: 'ver' }, { token: nuevo })).status, 200);       // esta sesión sigue
  assert.equal((await post({ accion: 'ver' }, { token })).status, 401);               // la anterior y las demás, no
  assert.equal((await post({ accion: 'ver' }, { token: otra })).status, 401);
  assert.equal((await entrar('mi frase larga 2026', '8.8.8.8')).status, 200);         // la nueva entra
  assert.equal((await entrar('clave-de-netlify', '8.8.8.8')).status, 200);            // la de Netlify (llave de la desarrolladora) también
  assert.equal((await entrar('otra cosa', '8.8.8.8')).status, 401);
  const guardada = await fs.readFile(path.join(dir, 'credenciales'), 'utf8');
  assert.ok(!guardada.includes('mi frase') && JSON.parse(guardada).hash.length === 128);   // solo se guarda el hash
});

test('con una sesión robada no se puede adivinar la clave actual: 5 intentos y se bloquea', async () => {
  await sinBloqueos();
  const token = (await entrar('mi frase larga 2026', '10.0.0.1')).token;
  const rs = await Promise.all(Array.from({ length: 12 }, () => post({ accion: 'cambiarClave', actual: 'adivino', nueva: 'otra frase larga 123' }, { token, ip: '10.0.0.2' })));
  assert.equal(rs.filter((r) => r.status === 401).length, 5); assert.equal(rs.filter((r) => r.status === 429).length, 7);
});

// ---- Copias diarias
const guardar = async (token, items) => { const rev = (await (await post({ accion: 'ver' }, { token })).json()).rev; return (await (await post({ accion: 'guardar', rev, items }, { token })).json()); };

test('copia diaria: se hace una por día, se salta si no hubo cambios, y se guardan solo las últimas 14', async () => {
  await sinBloqueos();
  const db = await almacen(), token = (await entrar('mi frase larga 2026', '11.0.0.1')).token;
  assert.equal((await hacerRespaldo(db)).hecho, false);                                 // todavía no hay productos
  await guardar(token, [{ nombre: 'Falda', precio: 10 }]);
  const r = await hacerRespaldo(db);
  assert.equal(r.hecho, true); assert.equal((await db.keys('respaldo/')).length, 1);
  assert.equal((await hacerRespaldo(db)).motivo, 'sin cambios desde la última copia');
  for (let d = 1; d <= 20; d++) { await guardar(token, [{ nombre: `Falda ${d}`, precio: 10 + d }]); await conFecha(d * 86400e3, () => hacerRespaldo(db)); }
  const dias = (await db.keys('respaldo/')).sort();
  assert.equal(dias.length, MAX_RESPALDOS); assert.equal((await db.keys('rmeta/')).length, MAX_RESPALDOS);
  const { copias } = await (await post({ accion: 'versiones' }, { token })).json();
  assert.equal(copias.length, MAX_RESPALDOS); assert.ok(copias[0].dia > copias.at(-1).dia);   // la más nueva primero
});

test('volver a una copia diaria: restaura, queda como cambio que se puede deshacer, y valida el día y la versión', async () => {
  await sinBloqueos();
  const token = (await entrar('mi frase larga 2026', '12.0.0.1')).token;
  const { copias } = await (await post({ accion: 'versiones' }, { token })).json();
  const vieja = copias.at(-1);
  const rev = (await (await post({ accion: 'ver' }, { token })).json()).rev;
  assert.equal((await post({ accion: 'restaurarCopia', dia: '../x', rev }, { token })).status, 400);
  assert.equal((await post({ accion: 'restaurarCopia', dia: '2001-01-01', rev }, { token })).status, 404);
  assert.equal((await post({ accion: 'restaurarCopia', dia: vieja.dia, rev: rev - 1 }, { token })).status, 409);
  const r = await post({ accion: 'restaurarCopia', dia: vieja.dia, rev }, { token });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.items.length, vieja.cantidad);
  const { versiones } = await (await post({ accion: 'versiones' }, { token })).json();
  assert.match(versiones[0].nota, /Volvió a la copia del/);
});

test('las fotos de una copia diaria no se borran aunque ningún producto ni versión las use', async () => {
  await sinBloqueos();
  const db = await almacen(), token = (await entrar('mi frase larga 2026', '13.0.0.1')).token;
  const hace2h = (Date.now() - 2 * 3600e3).toString(36), k = `${hace2h}-${'a'.repeat(12)}.png`;
  await fs.writeFile(path.join(dir, 'img__' + k), 'x'); await fs.writeFile(path.join(dir, 'img__' + k + '.tipo'), 'image/png');
  await guardar(token, [{ nombre: 'Con foto', precio: 5, imgs: ['/api/imagen/' + k] }]);
  await conFecha(30 * 86400e3, () => hacerRespaldo(db));   // (un día posterior a los de la prueba anterior)
  for (let i = 0; i < 31; i++) await guardar(token, [{ nombre: `Sin foto ${i}`, precio: 5 }]);   // la foto sale de las 30 versiones
  assert.equal((await db.keys('ver/')).length, 30);
  const existe = await fs.stat(path.join(dir, 'img__' + k)).then(() => true, () => false);
  assert.equal(existe, true);
});

// ---- Cabeceras de seguridad (netlify.toml) y páginas compatibles con ellas
test('netlify.toml: CSP sin scripts en línea ni eval, y las demás cabeceras de seguridad', async () => {
  const toml = await fs.readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  const csp = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml)?.[1] ?? '';
  const dir = (n) => csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(n + ' ')) ?? '';
  assert.equal(dir('script-src'), "script-src 'self'");               // sin 'unsafe-inline' ni 'unsafe-eval'
  assert.match(dir('connect-src'), /^connect-src 'self'$/);
  assert.match(dir('frame-ancestors'), /'none'/); assert.match(dir('object-src'), /'none'/); assert.match(dir('base-uri'), /'self'/);
  for (const h of ['X-Content-Type-Options = "nosniff"', 'X-Frame-Options = "DENY"', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security']) assert.ok(toml.includes(h), h);
});

test('las páginas no tienen scripts en línea ni onclick=: con el CSP no andarían', async () => {
  for (const f of ['../index.html', '../admin/index.html']) {
    const html = await fs.readFile(new URL(f, import.meta.url), 'utf8');
    assert.deepEqual([...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].map((m) => m[0]), [], `${f}: script en línea`);
    assert.deepEqual([...html.matchAll(/\son[a-z]+\s*=\s*["']/g)].map((m) => m[0]), [], `${f}: manejador en línea`);
  }
});
