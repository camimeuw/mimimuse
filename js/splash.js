const root = document.documentElement;

if (root.classList.contains('splash-on')) {
  const logo = document.querySelector('.logo');
  const r = logo.getBoundingClientRect();
  const h = document.querySelector('.mona').getBoundingClientRect();
  // La mona de la intro mide 2,5 px por pixel del dibujo (~183 px de ancho), sea cual sea su tamaño en el header (×2 en celu, ×3 en compu).
  const k = 2.5 / (h.width / 73);
  const hx = h.left + h.width / 2 - r.left, hy = h.top + h.height / 2 - r.top;
  logo.style.transition = 'none';
  logo.style.transform = `translate(${innerWidth / 2 - r.left - hx * k}px, ${innerHeight / 2 - r.top - hy * k}px) scale(${k})`;

  const open = () => {
    if (root.classList.contains('open')) return;
    logo.style.transition = 'transform 1.2s cubic-bezier(.65, 0, .35, 1)';
    logo.style.transform = '';
    root.classList.add('open');
  };
  setTimeout(open, 2200);   // justo después del guiño (~2,05 s)
  document.querySelector('.splash').addEventListener('click', open); // tocar para saltar
}
