import test from 'node:test';
import assert from 'node:assert/strict';
await import('../admin/csv.js');   // script de navegador: deja CSV en globalThis
const { CSV } = globalThis;

test('lee comillas, saltos de línea dentro de una celda, BOM y punto y coma', () => {
  const filas = CSV.leer('﻿nombre;precio;descripcion\r\n"Falda; larga";59,90;"Linea 1\nLinea 2 con ""comillas"""\r\n\r\nRemera;30;\r\n');
  assert.deepEqual(filas, [['nombre', 'precio', 'descripcion'], ['Falda; larga', '59,90', 'Linea 1\nLinea 2 con "comillas"'], ['Remera', '30', '']]);
});

test('números de Excel: coma, punto, miles y "S/"', () => {
  assert.equal(CSV.numero('59,90'), 59.9); assert.equal(CSV.numero('59.90'), 59.9); assert.equal(CSV.numero('S/ 1.259,90'), 1259.9);
  assert.equal(CSV.numero('1,259.90'), 1259.9); assert.equal(CSV.numero('15'), 15); assert.ok(Number.isNaN(CSV.numero('gratis')));
});

test('filas con errores se avisan con su número de fila y las buenas pasan', () => {
  const r = CSV.aProductos(CSV.leer('Nombre,Precio,Precio anterior,Categoría,Talles,Visible,Fotos\nA,10,,Faldas,S|M,sí,a.jpg|b.jpg\n,10,,,,,\nB,abc,,,,,\nC,50,40,,,,\nD,20,30,Faldas,"S, M",no,'));
  assert.deepEqual(r.productos.map((p) => [p.fila, p.campos.nombre]), [[2, 'A'], [6, 'D']]);
  assert.deepEqual(r.errores.map((e) => e.fila), [3, 4, 5]);
  assert.match(r.errores[2].msg, /anterior/);
  assert.deepEqual(r.productos[0].campos.talles, ['S', 'M']); assert.deepEqual(r.productos[0].campos.fotos, ['a.jpg', 'b.jpg']);
  assert.equal(r.productos[1].campos.activo, false); assert.deepEqual(r.productos[1].campos.talles, ['S', 'M']);
});

test('sin columnas nombre y precio: un solo error claro', () => {
  const r = CSV.aProductos(CSV.leer('a,b\n1,2'));
  assert.equal(r.productos.length, 0); assert.equal(r.errores.length, 1); assert.match(r.errores[0].msg, /nombre/);
});

test('exportar e importar de nuevo da lo mismo (ida y vuelta, con tildes y comillas)', () => {
  const items = [{ id: 7, nombre: 'Falda "especial", larga', precio: 59.9, precioAntes: 80, cat: 'Faldas', sub: 'Mini', desc: 'Línea 1\nLínea 2', talles: ['S', 'M'], tallesAgotados: ['M'], colores: ['rosa'], agotado: true, activo: false, imgs: ['/api/imagen/a-000000000000.webp'], thumbs: ['/api/imagen/b-000000000000.webp'] }];
  const r = CSV.aProductos(CSV.leer(CSV.exportar(items)));
  assert.equal(r.errores.length, 0);
  const c = r.productos[0].campos;
  assert.deepEqual([c.id, c.nombre, c.precio, c.precioAntes, c.cat, c.sub, c.desc, c.talles, c.tallesAgotados, c.colores, c.agotado, c.activo, c.fotos, c.miniaturas],
    [7, 'Falda "especial", larga', 59.9, 80, 'Faldas', 'Mini', 'Línea 1\nLínea 2', ['S', 'M'], ['M'], ['rosa'], true, false, items[0].imgs, items[0].thumbs]);
});

test('la planilla de ejemplo se puede importar tal cual', () => {
  const r = CSV.aProductos(CSV.leer(CSV.plantilla()));
  assert.equal(r.errores.length, 0); assert.equal(r.productos.length, 2);
  assert.equal(r.productos[1].campos.precioAntes, 25);
});

test('archivos de Excel en ANSI (Windows-1252) se leen bien, y UTF-8 también', () => {
  const ansi = Uint8Array.from([...'nombre;precio\nCamiseta a'].map((c) => c.charCodeAt(0)).concat([0xf1, 0x6f, 0x73, 0x3b, 0x31, 0x30]));   // "Camiseta años;10"
  assert.equal(CSV.leer(CSV.decodificar(ansi))[1][0], 'Camiseta años');
  assert.equal(CSV.decodificar(new TextEncoder().encode('Camiseta años')), 'Camiseta años');
});
