const root = document.documentElement;

if (root.classList.contains('splash-on')) {
  const logo = document.querySelector('.logo');
  const r = logo.getBoundingClientRect();
  const h = document.querySelector('.mona').getBoundingClientRect();
  // Escala en medios pasos (la mona ya está ×2: 1,5 → 3 px por pixel) para que el pixel art no se deforme; ~220 px de ancho.
  const k = Math.max(1, Math.floor(Math.min(innerWidth * 0.6, 220) / h.width * 2) / 2);
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
