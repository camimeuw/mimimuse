const dressup = document.querySelector('.dressup');
const name = dressup.querySelector('.look-name');
const dots = [...dressup.querySelectorAll('[data-dot]')];
const SCENES = 3;
let look = 0;

const showLook = (i) => {
  look = (i + dots.length) % dots.length;
  name.textContent = `Look ${look + 1}`;
  dots.forEach((d, n) => d.setAttribute('aria-current', n === look));
};

dressup.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.look) showLook(look + +b.dataset.look);
  if (b.dataset.dot) showLook(+b.dataset.dot);
  if (b.dataset.scene) dressup.dataset.scene = (+dressup.dataset.scene + +b.dataset.scene + SCENES) % SCENES;
});
