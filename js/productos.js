const catalog = document.querySelector('#catalog');
const more = document.querySelector('#ver-mas');
const SIZES = [470, 330, 380, 290, 440, 320, 480, 295, 400, 400]; // anchos base, se repiten
const PAGE = 12;
let shown = 0;

// Aleatorio estable (misma disposición cada vez) por id de producto
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const between = (r, a, b) => a + r() * (b - a);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n == null ? 'S/ —' : `S/ ${Number(n).toFixed(2)}`);

function render() {
  PRODUCTS.slice(shown, shown + PAGE).forEach((p, k) => {
    const i = shown + k, w = SIZES[i % SIZES.length], r = rng(p.id * 7919 + 13);
    const [main, alt] = p.imgs;
    const li = document.createElement('li');
    li.className = 'item' + (w >= 380 ? ' big' : '') + (i % 2 ? ' flip' : '') + (p.agotado ? ' is-sold' : '');
    li.style.cssText = `--w:${w}px;--r:${between(r, -5, 5).toFixed(1)}deg;--dy:${Math.round(between(r, 0, 26))}px;--delay:${(0.4 + Math.min(k, 9) * 0.2).toFixed(2)}s;--fd:${between(r, 7, 12).toFixed(1)}s;--fdl:${(-between(r, 0, 8)).toFixed(1)}s`;
    li.innerHTML = `
      <div class="float"><div class="tilt">
        <div class="pic${alt ? ' has-alt' : ''}${main ? '' : ' empty'}">
          <span class="badge">${i + 1}</span>
          ${p.agotado ? '<span class="sold">Agotado</span>' : ''}
          ${main ? `<img class="main" src="${esc(main)}" alt="${esc(p.nombre)}" loading="lazy">` : ''}
          ${alt ? `<img class="alt" src="${esc(alt)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="cap"><span class="name">${esc(p.nombre)}</span><span class="price">${money(p.precio)}</span></div>
      </div></div>`;
    catalog.appendChild(li);
  });
  shown = Math.min(shown + PAGE, PRODUCTS.length);
  more.hidden = shown >= PRODUCTS.length;
}

more.addEventListener('click', render);
render();
