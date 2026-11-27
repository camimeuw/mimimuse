const root = document.documentElement;
const logo = document.querySelector('.logo');

if (root.classList.contains('splash-on')) {
  // El logo ya está en su lugar final; lo llevamos al centro y lo hacemos volver (FLIP).
  const r = logo.getBoundingClientRect();
  const s = Math.min(innerWidth * 0.72, 380) / r.width;
  const dx = innerWidth / 2 - (r.left + r.width / 2);
  const dy = innerHeight / 2 - (r.top + r.height / 2) + 0.17 * r.height * s; // centra solo la cabeza
  logo.style.transition = 'none';
  logo.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;

  const open = () => {
    if (root.classList.contains('open')) return;
    logo.style.transition = 'transform 1.1s cubic-bezier(.34, 1.3, .64, 1)';
    logo.style.transform = '';
    root.classList.add('open');
  };
  setTimeout(open, 2300);
  document.querySelector('.splash').addEventListener('click', open); // tocar para saltar
}
