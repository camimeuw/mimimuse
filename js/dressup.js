const dressup = document.querySelector('.dressup');
const photo = dressup.querySelector('.photo');
const room = dressup.querySelector('.room');
const name = dressup.querySelector('.look-name');
const dots = [...dressup.querySelectorAll('[data-dot]')];
const SCENES = 3;
const calm = matchMedia('(prefers-reduced-motion: reduce)');
let look = 0;

// Reinicia una animación de CSS aunque se repita seguido
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

function burst() {
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('i');
    const a = (k / 6) * Math.PI * 2 + Math.random() * 0.6, d = 70 + Math.random() * 50;
    c.className = 'chispa';
    c.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    c.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    c.addEventListener('animationend', () => c.remove());
    photo.appendChild(c);
  }
}

const showLook = (i) => {
  const n = (i + dots.length) % dots.length;
  if (n === look) return;
  look = n;
  name.textContent = `Look ${look + 1}`;
  dots.forEach((d, k) => d.setAttribute('aria-current', k === look));
  if (!calm.matches) { restart(photo, 'swap'); burst(); }
};

dressup.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.look) showLook(look + +b.dataset.look);
  if (b.dataset.dot) showLook(+b.dataset.dot);
  if (b.dataset.scene) {
    dressup.dataset.scene = (+dressup.dataset.scene + +b.dataset.scene + SCENES) % SCENES;
    if (!calm.matches) { restart(photo, 'flash'); restart(room, 'flash'); }
  }
});
