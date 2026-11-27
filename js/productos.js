const catalog = document.querySelector('#catalog');
const more = document.querySelector('#ver-mas');
const SIZES = [470, 330, 380, 290, 440, 320, 480, 295, 400, 400]; // anchos base del modo flotante (celular), se repiten
const PAGE = 12;
let shown = 0;
let lista = [];
const EJEMPLOS = location.protocol === 'file:';   // solo al abrir el archivo en tu compu para diseñar se ven los de ejemplo
const CACHE = 'mimi-productos';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Aleatorio estable (misma disposición cada vez) por id de producto
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r, a, b) => a + r() * (b - a);
const money = (n) => (n == null ? 'S/ —' : `S/ ${Number(n).toFixed(2)}`);

function render() {
  lista.slice(shown, shown + PAGE).forEach((p, k) => {
    const i = shown + k, w = SIZES[i % SIZES.length], r = rng(p.id * 7919 + 13);
    const [main, alt] = p.imgs;
    const li = document.createElement('li');
    li.className = 'tarjeta' + (w >= 380 ? ' big' : '') + (i % 2 ? ' flip' : '') + (p.agotado ? ' is-sold' : '');
    li.style.cssText = `--w:${w}px;--r:${between(r, -5, 5).toFixed(1)}deg;--dy:${Math.round(between(r, 0, 26))}px;--delay:${(0.4 + Math.min(k, 9) * 0.2).toFixed(2)}s;--fd:${between(r, 7, 12).toFixed(1)}s;--fdl:${(-between(r, 0, 8)).toFixed(1)}s`;
    li.innerHTML = `
      <div class="float"><div class="tilt">
        <div class="pic${alt ? ' has-alt' : ''}${main ? '' : p.ejemplo ? ' empty' : ' sinfoto'}">
          <span class="badge">${i + 1}</span>
          ${p.agotado ? '<span class="sold">Agotado</span>' : ''}
          ${main ? `<img class="main" src="${esc(main)}" alt="${esc(p.nombre)}" loading="lazy">` : p.ejemplo ? 'tu imagen aquí' : ''}
          ${alt ? `<img class="alt" src="${esc(alt)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="cap"><p class="name">${esc(p.nombre)}</p><p class="price">${money(p.precio)}</p></div>
      </div></div>`;
    catalog.appendChild(li);
  });
  shown = Math.min(shown + PAGE, lista.length);
  more.hidden = shown >= lista.length;
}

more.addEventListener('click', render);

function mensaje(html) { catalog.innerHTML = `<li class="vacio">${html}</li>`; more.hidden = true; }
function mostrar(items) {
  lista = items; shown = 0; catalog.replaceChildren();
  if (lista.length) render(); else mensaje('Pronto vas a ver los productos acá.');
}
const deApi = (items) => items.map((p) => ({
  id: p.id, nombre: p.nombre, precio: p.precio, imgs: p.imgs,
  // agotado si lo marcó entero o si no queda ningún talle disponible
  agotado: p.agotado || (p.talles.length > 0 && p.talles.every((t) => p.tallesAgotados.includes(t))),
}));

// Los productos vienen del panel (/api/productos). Si falla, se muestra la última lista que se vio bien;
// si no hay ninguna, un aviso con "Reintentar". Los productos de ejemplo no se muestran nunca en el sitio publicado.
async function cargar() {
  mensaje('Cargando productos…');
  try {
    const r = await fetch('/api/productos');
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    try { localStorage.setItem(CACHE, JSON.stringify(d.items)); } catch {}
    mostrar(deApi(d.items));
  } catch {
    let guardados = null;
    try { guardados = JSON.parse(localStorage.getItem(CACHE)); } catch {}
    if (guardados?.length) mostrar(deApi(guardados));
    else if (EJEMPLOS) mostrar(PRODUCTS.map((p) => ({ ...p, ejemplo: true })));
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
