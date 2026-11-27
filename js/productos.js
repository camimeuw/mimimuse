const catalog = document.querySelector('#catalog');
const more = document.querySelector('#ver-mas');
const SIZES = [470, 330, 380, 290, 440, 320, 480, 295, 400, 400]; // anchos base del modo flotante (celular), se repiten
const PAGE = 12;
let shown = 0;
let todos = [];                 // todos los productos
let vista = [];                 // los que pasan los filtros
const f = { cat: '', sub: '', q: '', oferta: false };
const EJEMPLOS = location.protocol === 'file:';   // solo al abrir el archivo en tu compu para diseñar se ven los de ejemplo
const CACHE = 'mimi-productos';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Aleatorio estable (misma disposición cada vez) por id de producto
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r, a, b) => a + r() * (b - a);
const money = (n) => (n == null ? 'S/ —' : `S/ ${Number(n).toFixed(2)}`);
const enOferta = (p) => p.precioAntes != null && p.precioAntes > p.precio;
const descuento = (p) => Math.round((1 - p.precio / p.precioAntes) * 100);
const precioHtml = (p) => (enOferta(p) ? `${money(p.precio)} <s>${money(p.precioAntes)}</s>` : money(p.precio));

// ---------- Tarjetas ----------
function render() {
  vista.slice(shown, shown + PAGE).forEach((p, k) => {
    const i = shown + k, w = SIZES[i % SIZES.length], r = rng(p.id * 7919 + 13);
    const main = p.thumbs[0] || p.imgs[0], alt = p.thumbs[1] || p.imgs[1];   // en la tarjeta van las miniaturas; las fotos grandes, en el popup
    const li = document.createElement('li');
    li.className = 'tarjeta' + (w >= 380 ? ' big' : '') + (i % 2 ? ' flip' : '') + (p.agotado ? ' is-sold' : '');
    li.style.cssText = `--w:${w}px;--r:${between(r, -5, 5).toFixed(1)}deg;--dy:${Math.round(between(r, 0, 26))}px;--delay:${(0.4 + Math.min(k, 9) * 0.2).toFixed(2)}s;--fd:${between(r, 7, 12).toFixed(1)}s;--fdl:${(-between(r, 0, 8)).toFixed(1)}s`;
    li.innerHTML = `
      <div class="float"><div class="tilt">
        <div class="pic${alt ? ' has-alt' : ''}${main ? '' : p.ejemplo ? ' empty' : ' sinfoto'}">
          <span class="badge">${i + 1}</span>
          ${p.agotado ? '<span class="sold">Agotado</span>' : enOferta(p) ? `<span class="sale">-${descuento(p)}%</span>` : ''}
          ${main ? `<img class="main" src="${esc(main)}" alt="${esc(p.nombre)}" loading="lazy">` : p.ejemplo ? 'tu imagen aquí' : ''}
          ${alt ? `<img class="alt" src="${esc(alt)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="cap"><p class="name">${esc(p.nombre)}</p><p class="price">${precioHtml(p)}</p></div>
      </div></div>
      <button type="button" class="abrir" data-i="${i}" aria-label="Ver ${esc(p.nombre)}"></button>`;
    catalog.appendChild(li);
  });
  shown = Math.min(shown + PAGE, vista.length);
  more.hidden = shown >= vista.length;
}
more.addEventListener('click', render);

function mensaje(html) { catalog.innerHTML = `<li class="vacio">${html}</li>`; more.hidden = true; }

// ---------- Filtros ----------
const filtros = document.querySelector('#filtros'), chipsCat = document.querySelector('#chips-cat'), chipsSub = document.querySelector('#chips-sub'), buscar = document.querySelector('#buscar-tienda');
const unicos = (lista) => [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
function chip(texto, activo, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip-f'; b.textContent = texto; b.setAttribute('aria-pressed', activo);
  b.addEventListener('click', fn);
  return b;
}
function pintarFiltros() {
  filtros.hidden = !todos.length;
  const cats = unicos(todos.map((p) => p.cat)), subs = f.cat ? unicos(todos.filter((p) => p.cat === f.cat).map((p) => p.sub)) : [];
  const cambiar = (cambios) => { Object.assign(f, cambios); aplicar(); };
  chipsCat.replaceChildren(
    chip('Todos', !f.cat && !f.oferta, () => cambiar({ cat: '', sub: '', oferta: false })),
    ...(todos.some(enOferta) ? [chip('En oferta', f.oferta, () => cambiar({ cat: '', sub: '', oferta: !f.oferta }))] : []),
    ...cats.map((c) => chip(c, f.cat === c, () => cambiar({ cat: f.cat === c ? '' : c, sub: '', oferta: false }))));
  chipsSub.hidden = !subs.length;
  chipsSub.replaceChildren(...subs.map((s) => chip(s, f.sub === s, () => cambiar({ sub: f.sub === s ? '' : s }))));
}
let espera;
buscar.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { f.q = buscar.value.trim(); aplicar(); }, 150); });

function aplicar() {
  vista = todos.filter((p) => (!f.oferta || enOferta(p)) && (!f.cat || p.cat === f.cat) && (!f.sub || p.sub === f.sub) && (!f.q || norm(`${p.nombre} ${p.cat} ${p.sub}`).includes(norm(f.q))));
  shown = 0; catalog.replaceChildren(); pintarFiltros();
  if (vista.length) render();
  else if (todos.length) {
    mensaje('No hay productos con ese filtro. <button type="button" class="ver-mas" id="limpiar-f">Ver todos</button>');
    document.querySelector('#limpiar-f').addEventListener('click', () => { Object.assign(f, { cat: '', sub: '', q: '', oferta: false }); buscar.value = ''; aplicar(); });
  } else mensaje('Pronto vas a ver los productos acá.');
}
function mostrar(items) { todos = items; Object.assign(f, { cat: '', sub: '', q: '', oferta: false }); buscar.value = ''; aplicar(); }

// ---------- Popup del producto ----------
const popup = document.querySelector('#popup');
const $p = (s) => popup.querySelector(s);
function fichas(ul, lista, agotadas = []) {
  ul.hidden = ul.previousElementSibling.hidden = !lista.length;
  ul.innerHTML = lista.map((t) => agotadas.includes(t) ? `<li class="ficha agotado">${esc(t)}<span class="sr-only"> (agotado)</span></li>` : `<li class="ficha">${esc(t)}</li>`).join('');
}
function abrir(p) {
  const foto = (k) => {
    const cont = $p('#pp-foto');
    cont.className = 'pp-foto' + (p.imgs[k] ? '' : ' sinfoto');
    cont.innerHTML = p.imgs[k] ? `<img src="${esc(p.imgs[k])}" alt="${esc(p.nombre)}, foto ${k + 1}">` : '';
    $p('#pp-minis').querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-current', n === k));
  };
  $p('#pp-minis').innerHTML = p.imgs.length > 1 ? p.imgs.map((u, k) => `<button type="button" aria-label="Ver foto ${k + 1}"><img src="${esc(p.thumbs[k] || u)}" alt=""></button>`).join('') : '';
  $p('#pp-minis').onclick = (e) => { const b = e.target.closest('button'); if (b) foto([...$p('#pp-minis').children].indexOf(b)); };
  foto(0);
  $p('#pp-ruta').textContent = [p.cat, p.sub].filter(Boolean).join(' › ');
  $p('#pp-nombre').textContent = p.nombre;
  $p('#pp-precio').innerHTML = precioHtml(p) + (enOferta(p) ? ` <span class="sale-txt">-${descuento(p)}%</span>` : '');
  $p('#pp-agotado').hidden = !p.agotado;
  $p('#pp-desc').textContent = p.desc;
  fichas($p('#pp-talles'), p.talles, p.tallesAgotados);
  fichas($p('#pp-colores'), p.colores);
  popup.showModal();
  popup.scrollTop = 0;
}
catalog.addEventListener('click', (e) => { const b = e.target.closest('.abrir'); if (b) abrir(vista[+b.dataset.i]); });
$p('#pp-cerrar').addEventListener('click', () => popup.close());
popup.addEventListener('click', (e) => { if (e.target === popup) popup.close(); });

// ---------- Carga ----------
const enPanel = (u) => (API && String(u).startsWith('/api/') ? API + u : u);   // las fotos del panel viven en la dirección del panel
const deApi = (items) => items.map((p) => {
  const talles = p.talles || [], agotadas = p.tallesAgotados || [];
  return {
    id: p.id, nombre: p.nombre, precio: p.precio, precioAntes: p.precioAntes ?? null, cat: p.cat || '', sub: p.sub || '', desc: p.desc || '',
    talles, tallesAgotados: agotadas, colores: p.colores || [], imgs: (p.imgs || []).map(enPanel), thumbs: (p.thumbs || []).map(enPanel), ejemplo: !!p.ejemplo,
    // agotado si lo marcó entero o si no queda ningún talle disponible
    agotado: !!p.agotado || (talles.length > 0 && talles.every((t) => agotadas.includes(t))),
  };
});

// Los productos vienen del panel (/api/productos). Si falla, se muestra la última lista que se vio bien;
// si no hay ninguna, un aviso con "Reintentar". Los productos de ejemplo no se muestran nunca en el sitio publicado.
async function cargar() {
  mensaje('Cargando productos…');
  try {
    const r = await fetch(API + '/api/productos');
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    try { localStorage.setItem(CACHE, JSON.stringify(d.items)); } catch {}
    mostrar(deApi(d.items));
  } catch {
    let guardados = null;
    try { guardados = JSON.parse(localStorage.getItem(CACHE)); } catch {}
    if (guardados?.length) mostrar(deApi(guardados));
    else if (EJEMPLOS) mostrar(deApi(PRODUCTS.map((p) => ({ ...p, ejemplo: true }))));
    else {
      mensaje('No pudimos cargar los productos. <button type="button" class="ver-mas" id="reintentar">Reintentar</button>');
      document.querySelector('#reintentar').addEventListener('click', cargar);
    }
  }
}
cargar();

// Celular: el botón de arriba del juego abre los productos (flotando) y vuelve al dress up
const btn = document.querySelector('#btn-productos');
btn.addEventListener('click', () => {
  const abierto = document.body.classList.toggle('ver-productos');
  btn.textContent = abierto ? '← volver al dress up' : 'ver todos los productos →';
  btn.setAttribute('aria-expanded', abierto);
  btn.scrollIntoView({ block: 'start' });
});
