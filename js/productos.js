const catalog = document.querySelector('#catalog');
const more = document.querySelector('#ver-mas');
const PAGE = 12;
let shown = 0;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n == null ? 'S/ —' : `S/ ${Number(n).toFixed(2)}`);

function render() {
  PRODUCTS.slice(shown, shown + PAGE).forEach((p, k) => {
    const [main, alt] = p.imgs;
    const li = document.createElement('li');
    li.className = 'tarjeta' + (p.agotado ? ' is-sold' : '');
    li.innerHTML = `
      <div class="pic${alt ? ' has-alt' : ''}${main ? '' : ' empty'}">
        <span class="badge">${shown + k + 1}</span>
        ${p.agotado ? '<span class="sold">Agotado</span>' : ''}
        ${main ? `<img class="main" src="${esc(main)}" alt="${esc(p.nombre)}" loading="lazy">` : 'tu imagen aquí'}
        ${alt ? `<img class="alt" src="${esc(alt)}" alt="" loading="lazy">` : ''}
      </div>
      <p class="name">${esc(p.nombre)}</p>
      <p class="price">${money(p.precio)}</p>`;
    catalog.appendChild(li);
  });
  shown = Math.min(shown + PAGE, PRODUCTS.length);
  more.hidden = shown >= PRODUCTS.length;
}

more.addEventListener('click', render);
render();
