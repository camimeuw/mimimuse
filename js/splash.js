const root = document.documentElement;

if (root.classList.contains('splash-on')) {
  const logo = document.querySelector('.logo');
  const r = logo.getBoundingClientRect();
  const h = document.querySelector('.mona').getBoundingClientRect();
  // Escala entera para que el pixel art no se deforme; centra la cabeza de la mona.
  const k = Math.max(1, Math.floor(Math.min(innerWidth * 0.8, 440) / h.width));
  const hx = h.left + h.width / 2 - r.left, hy = h.top + h.height / 2 - r.top;
  logo.style.transition = 'none';
  logo.style.transform = `translate(${innerWidth / 2 - r.left - hx * k}px, ${innerHeight / 2 - r.top - hy * k}px) scale(${k})`;

  const open = () => {
    if (root.classList.contains('open')) return;
    logo.style.transition = root.classList.contains('calma') ? 'none' : 'transform 1.1s cubic-bezier(.34, 1.3, .64, 1)';
    logo.style.transform = '';
    root.classList.add('open');
  };
  setTimeout(open, 2400);
  document.querySelector('.splash').addEventListener('click', open); // tocar para saltar
}
