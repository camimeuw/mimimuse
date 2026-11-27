import test from 'node:test';
import assert from 'node:assert/strict';

await import('../js/pedido.js');
const { Pedido } = globalThis;
const CODIGOS = [
  { id: 'HOLA10', porcentaje: 10, activo: true, vence: '' },
  { id: 'VERANO', porcentaje: 25, activo: true, vence: '2026-12-31' },
  { id: 'APAGADO', porcentaje: 50, activo: false, vence: '' },
  { id: 'MALO', porcentaje: 0, activo: true, vence: '' },
];

test('cupón: sin mirar mayúsculas ni espacios; apagado, inexistente y vacío dan un mensaje claro', () => {
  assert.deepEqual(Pedido.buscarCodigo(CODIGOS, ' hola 10 '), { codigo: 'HOLA10', pct: 10 });
  assert.match(Pedido.buscarCodigo(CODIGOS, 'apagado').error, /no existe o ya no está disponible/);
  assert.match(Pedido.buscarCodigo(CODIGOS, 'nunca').error, /no existe/);
  assert.match(Pedido.buscarCodigo(CODIGOS, '   ').error, /Escribí tu código/);
  assert.match(Pedido.buscarCodigo(CODIGOS, 'malo').error, /no es válido/);
  assert.match(Pedido.buscarCodigo(null, 'hola10').error, /no existe/);
});

test('cupón con vencimiento: vale todo el último día y deja de valer al siguiente', () => {
  assert.equal(Pedido.buscarCodigo(CODIGOS, 'verano', new Date('2026-12-31T23:00:00')).pct, 25);
  assert.match(Pedido.buscarCodigo(CODIGOS, 'verano', new Date('2027-01-01T00:30:00')).error, /ya venció/);
});

test('totales: en centavos (sin errores de coma flotante) y con descuento redondeado', () => {
  assert.deepEqual(Pedido.totales([{ precio: 0.1, cant: 1 }, { precio: 0.2, cant: 1 }]), { subtotal: 0.3, descuento: 0, total: 0.3 });
  assert.deepEqual(Pedido.totales([{ precio: 59.9, cant: 2 }, { precio: 15, cant: 1 }], 10), { subtotal: 134.8, descuento: 13.48, total: 121.32 });
  assert.deepEqual(Pedido.totales([{ precio: 33.33, cant: 3 }], 15), { subtotal: 99.99, descuento: 15, total: 84.99 });
  assert.deepEqual(Pedido.totales([], 10), { subtotal: 0, descuento: 0, total: 0 });
});

test('mensaje de WhatsApp: líneas con talle y color, y el cupón solo si hay descuento', () => {
  const lineas = [{ nombre: 'Falda tableada', talle: 'M', color: 'rosa', precio: 59.9, cant: 2 }, { nombre: 'Aros', talle: '', color: '', precio: 15, cant: 1 }];
  const con = Pedido.mensaje(lineas, 'HOLA10', 10);
  assert.match(con, /^Hola Mimi Muse! ♡ Quiero hacer este pedido:/);
  assert.match(con, /• Falda tableada \(talle M, rosa\) — 2 × S\/ 59\.90 = S\/ 119\.80/);
  assert.match(con, /• Aros — 1 × S\/ 15\.00 = S\/ 15\.00/);
  assert.match(con, /Subtotal: S\/ 134\.80\nCupón HOLA10 \(−10%\): −S\/ 13\.48\nTotal: S\/ 121\.32$/);
  const sin = Pedido.mensaje(lineas, '', 0);
  assert.ok(!/Cupón|Subtotal/.test(sin)); assert.match(sin, /Total: S\/ 134\.80$/);
});

test('enlace de WhatsApp: solo los números del teléfono y el texto bien codificado', () => {
  const e = Pedido.enlace('+51 999-888-777', 'Hola & chau\nñandú');
  assert.equal(e, 'https://wa.me/51999888777?text=Hola%20%26%20chau%0A%C3%B1and%C3%BA');
});
