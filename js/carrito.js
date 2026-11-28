/* ============ Carrito: arma el pedido y lo manda por WhatsApp ============
   Se guarda en este dispositivo (localStorage). Los precios se vuelven a mirar al abrir el carrito,
   así un precio cambiado o un producto agotado no se cuela en el pedido.
*/
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'mimi-carrito', KEY_COD = 'mimi-cupon';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
  const guardar = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* sin almacenamiento: el carrito dura lo que la página */ } };

  let lineas = leer(KEY, []).filter((l) => l && l.id != null && l.cant > 0);
  let codigo = leer(KEY_COD, '');                 // código que escribió la compradora (se vuelve a validar)
  let codigos = null;                             // el cupón escrito, leído de Firebase (la lista completa no es pública)
  let pedidoCodigos = null, pedidoDe = '';

  const dialogo = $('#carrito'), boton = $('.cart'), contador = $('.cart-count');
  const mismo = (a, b) => a.id === b.id && (a.talle || '') === (b.talle || '') && (a.color || '') === (b.color || '');
  const cantidad = () => lineas.reduce((a, l) => a + l.cant, 0);

  function pintarContador() {
    const n = cantidad();
    contador.textContent = n; contador.hidden = n === 0;
    boton.setAttribute('aria-label', `Carrito, ${n} producto${n === 1 ? '' : 's'}`);
  }

  // Cupones: se pide solo el código que escribió la compradora, y solo si hace falta
  function cargarCodigos(texto) {
    const id = Pedido.norm(texto);
    if (!pedidoCodigos || pedidoDe !== id) {
      pedidoDe = id;
      pedidoCodigos = (DB.enabled() && id ? DB.leer('codigos', id) : Promise.resolve(null)).then((c) => { codigos = c ? [c] : []; }).catch(() => { codigos = []; pedidoCodigos = null; });
    }
    return pedidoCodigos;
  }
  const promo = () => (codigo && codigos ? Pedido.buscarCodigo(codigos, codigo) : null);

  // Mira cada línea contra los productos de ahora: precio actual y si todavía se puede pedir
  function estadoLineas() {
    return lineas.map((l) => {
      const p = window.Tienda && window.Tienda.listo() ? window.Tienda.porId(l.id) : undefined;
      if (p === undefined) return { ...l, ok: true };                     // todavía no cargaron los productos: se deja como está
      if (!p || p.agotado || (l.talle && p.tallesAgotados.includes(l.talle))) return { ...l, ok: false };
      return { ...l, nombre: p.nombre, precio: p.precio, ok: true };
    });
  }

  function pintar() {
    const ls = estadoLineas(), buenas = ls.filter((l) => l.ok);
    const r = promo(), pct = r && r.pct ? r.pct : 0;
    const t = Pedido.totales(buenas, pct);
    $('#car-vacio').hidden = lineas.length > 0;
    $('#car-lineas').innerHTML = ls.map((l, i) => `
      <li class="car-linea${l.ok ? '' : ' no'}">
        <div class="car-foto">${l.foto ? `<img alt="" data-foto="${esc(l.foto)}">` : ''}</div>
        <div class="car-dato">
          <p class="car-nombre">${esc(l.nombre)}</p>
          <p class="car-var">${esc([l.talle && `Talle ${l.talle}`, l.color].filter(Boolean).join(' · '))}</p>
          ${l.ok ? `<p class="car-precio">${Pedido.soles(l.precio)}</p>` : '<p class="car-aviso">Ya no está disponible</p>'}
        </div>
        <div class="car-cant">
          ${l.ok ? `<button type="button" data-i="${i}" data-d="-1" aria-label="Uno menos de ${esc(l.nombre)}">−</button><span aria-live="polite">${l.cant}</span><button type="button" data-i="${i}" data-d="1" aria-label="Uno más de ${esc(l.nombre)}">+</button>` : ''}
          <button type="button" class="car-quitar" data-i="${i}" data-q="1" aria-label="Quitar ${esc(l.nombre)}">Quitar</button>
        </div>
      </li>`).join('');
    $('#car-lineas').querySelectorAll('img[data-foto]').forEach((img) => DB.pintarFoto(img, img.dataset.foto));
    $('#car-totales').hidden = !buenas.length;
    $('#car-sub').textContent = Pedido.soles(t.subtotal);
    $('#car-desc-fila').hidden = !t.descuento;
    $('#car-desc-nombre').textContent = t.descuento ? `Cupón ${r.codigo} (−${pct}%)` : '';
    $('#car-desc').textContent = t.descuento ? `−${Pedido.soles(t.descuento)}` : '';
    $('#car-total').textContent = Pedido.soles(t.total);
    const msg = $('#car-cupon-msg');
    if (r && r.error) { msg.textContent = r.error; msg.className = 'car-cupon-msg mal'; }
    else if (r) { msg.textContent = `Código ${r.codigo} aplicado: ${r.pct}% de descuento.`; msg.className = 'car-cupon-msg ok'; }
    else if (!codigo) { msg.textContent = ''; msg.className = 'car-cupon-msg'; }
    $('#car-quitar-cupon').hidden = !(r && r.pct);
    const pedir = $('#car-pedir'), numero = typeof WHATSAPP !== 'undefined' ? WHATSAPP : '';
    const puede = buenas.length > 0 && !!numero;
    pedir.setAttribute('aria-disabled', String(!puede));
    pedir.href = puede ? Pedido.enlace(numero, Pedido.mensaje(buenas, r && r.codigo, pct)) : '#';
    $('#car-sin-numero').hidden = !!numero;
    pintarContador();
  }

  function cambiar() { guardar(KEY, lineas); pintar(); }

  function agregar(l) {
    const i = lineas.findIndex((x) => mismo(x, l));
    if (i >= 0) lineas[i].cant = Math.min(20, lineas[i].cant + 1); else lineas.push({ ...l, cant: 1 });
    guardar(KEY, lineas); pintarContador();
  }

  async function abrir() {
    pintar(); dialogo.showModal(); dialogo.scrollTop = 0;
    if (codigo && !codigos) { await cargarCodigos(codigo); pintar(); }
  }

  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) return dialogo.close();
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const i = Number(b.dataset.i);
    if (b.dataset.q) lineas.splice(i, 1);
    else lineas[i].cant = Math.max(1, Math.min(20, lineas[i].cant + Number(b.dataset.d)));
    cambiar();
  });
  $('#car-cerrar').addEventListener('click', () => dialogo.close());
  boton.addEventListener('click', abrir);
  $('#car-pedir').addEventListener('click', (e) => { if ($('#car-pedir').getAttribute('aria-disabled') === 'true') e.preventDefault(); });

  // Cupón: se escribe en el carrito o llega por link (?codigo=HOLA10)
  async function aplicarCodigo(texto, silencioso) {
    await cargarCodigos(texto);
    const r = Pedido.buscarCodigo(codigos, texto);
    if (r.error) { if (silencioso) { codigo = ''; guardar(KEY_COD, ''); } else { $('#car-cupon-msg').textContent = r.error; $('#car-cupon-msg').className = 'car-cupon-msg mal'; } return false; }
    codigo = r.codigo; guardar(KEY_COD, codigo); pintar(); return true;
  }
  $('#car-cupon').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await aplicarCodigo($('#car-codigo').value, false)) $('#car-codigo').value = '';
  });
  $('#car-quitar-cupon').addEventListener('click', () => { codigo = ''; guardar(KEY_COD, ''); $('#car-cupon-msg').textContent = ''; pintar(); });
  try { const q = new URLSearchParams(location.search).get('codigo'); if (q) aplicarCodigo(q, true); } catch { /* sin link con código */ }

  pintarContador();
  window.Carrito = { agregar, abrir, pintar, cantidad: () => cantidad() };
})();
