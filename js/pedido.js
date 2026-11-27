/* ============ Cuentas del pedido: cupón, totales y mensaje de WhatsApp ============
   Sin pantalla ni red: se prueba con npm test. Las usa js/carrito.js.
*/
(() => {
  'use strict';
  const norm = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, '');
  const soles = (n) => `S/ ${Number(n).toFixed(2)}`;

  // Busca un código entre los cupones de Firebase [{ id, porcentaje, activo, vence }]. Devuelve { codigo, pct } o { error }
  function buscarCodigo(codigos, texto, hoy = new Date()) {
    const t = norm(texto);
    if (!t) return { error: 'Escribí tu código.' };
    const c = (codigos || []).find((x) => norm(x.id) === t);
    if (!c || c.activo === false) return { error: 'Ese código no existe o ya no está disponible.' };
    if (c.vence && hoy.getTime() > new Date(`${c.vence}T23:59:59`).getTime()) return { error: 'Ese código ya venció.' };
    const pct = Number(c.porcentaje) || 0;
    if (!(pct >= 1 && pct <= 99)) return { error: 'Ese código no es válido.' };
    return { codigo: norm(c.id), pct };
  }

  // Cuentas en centavos (así 0,1 + 0,2 no da 0,30000000000000004). lineas: [{ precio, cant }]
  function totales(lineas, pct = 0) {
    const subtotal = lineas.reduce((a, l) => a + Math.round(Number(l.precio) * 100) * l.cant, 0);
    const descuento = Math.round(subtotal * (pct || 0) / 100);
    return { subtotal: subtotal / 100, descuento: descuento / 100, total: (subtotal - descuento) / 100 };
  }

  function mensaje(lineas, codigo, pct) {
    const t = totales(lineas, pct);
    const detalle = (l) => [l.talle && `talle ${l.talle}`, l.color].filter(Boolean).join(', ');
    return [
      'Hola Mimi Muse! ♡ Quiero hacer este pedido:', '',
      ...lineas.map((l) => `• ${l.nombre}${detalle(l) ? ` (${detalle(l)})` : ''} — ${l.cant} × ${soles(l.precio)} = ${soles(l.precio * l.cant)}`), '',
      ...(t.descuento ? [`Subtotal: ${soles(t.subtotal)}`, `Cupón ${codigo} (−${pct}%): −${soles(t.descuento)}`] : []),
      `Total: ${soles(t.total)}`,
    ].join('\n');
  }
  const enlace = (numero, texto) => `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;

  (typeof window !== 'undefined' ? window : globalThis).Pedido = { norm, soles, buscarCodigo, totales, mensaje, enlace };
})();
