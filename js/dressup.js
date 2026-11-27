const dressup = document.querySelector('.dressup');
const photo = dressup.querySelector('.photo');
const room = dressup.querySelector('.room');
const doll = dressup.querySelector('#doll');
const SCENES = 3;
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const rnd = (n) => Math.floor(Math.random() * n);
let z = 1;
const turno = {}; // próximo personaje de la lista

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

// ---- La muñeca: modelo + una capa por parte, todas del mismo tamaño y apiladas ----
const ORDEN = ['abajo', 'arriba', 'zapatos'];   // de atrás hacia adelante
const elegida = { arriba: 0, abajo: 0, zapatos: 0 };
const capas = {}, textos = {};

const capa = (src, alt) => {
  const i = new Image();
  i.src = src; i.alt = alt; i.draggable = false;
  doll.appendChild(i);
  return i;
};
capa(MODELO, 'Modelo');
ORDEN.forEach((k) => { capas[k] = capa(ROPA[k][0].src, ''); });
dressup.querySelectorAll('.fila').forEach((f) => { textos[f.dataset.parte] = f.querySelector('.prenda'); });

function mostrar() {
  ORDEN.forEach((k) => {
    const item = ROPA[k][elegida[k]];
    capas[k].src = item.src;
    capas[k].alt = item.nombre;
    textos[k].textContent = `${item.nombre} ${elegida[k] + 1}/${ROPA[k].length}`;
  });
}
function cambiar(parte, d) {
  const n = ROPA[parte].length;
  elegida[parte] = (elegida[parte] + d + n) % n;   // en loop
  mostrar();
}
mostrar();

function random() {
  const final = {};
  ORDEN.forEach((k) => { final[k] = rnd(ROPA[k].length); });
  const terminar = () => {
    Object.assign(elegida, final);
    mostrar();
    if (!calm.matches) { restart(photo, 'swap'); burst(); }
  };
  if (calm.matches) return terminar();
  let t = 0;
  const id = setInterval(() => {      // barajada rápida antes de elegir
    ORDEN.forEach((k) => { elegida[k] = rnd(ROPA[k].length); });
    mostrar();
    if (++t >= 6) { clearInterval(id); terminar(); }
  }, 70);
}

// ---- Agregar personajes (se arrastran) ----
function agregar(lista, clave, esPersonaje) {
  if (!lista?.length) return;
  const item = lista[(turno[clave] = ((turno[clave] ?? -1) + 1) % lista.length)];
  const p = document.createElement('div');
  p.className = 'pieza' + (esPersonaje ? ' personaje' : '') + (item.clase ? ` ${item.clase}` : '');
  p.tabIndex = 0;
  p.setAttribute('role', 'group');
  p.setAttribute('aria-label', `${item.nombre}: arrastrar con el mouse o mover con las flechas, Suprimir para quitar`);
  if (item.src) { const img = document.createElement('img'); img.src = item.src; img.alt = ''; p.appendChild(img); }
  else if (!item.clase) p.textContent = `tu imagen aquí · ${item.nombre}`;
  const x = document.createElement('button');
  x.className = 'quitar'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `Quitar ${item.nombre}`);
  p.appendChild(x);
  photo.appendChild(p);
  p.style.left = `${Math.random() * (photo.clientWidth - p.offsetWidth)}px`;
  p.style.top = `${Math.random() * (photo.clientHeight - p.offsetHeight)}px`;
  p.style.zIndex = ++z;
  p.focus({ preventScroll: true });
}

// ---- Arrastrar y soltar (mouse, táctil y lápiz) ----
let drag = null;
photo.addEventListener('pointerdown', (e) => {
  const p = e.target.closest('.pieza');
  if (!p || e.target.closest('.quitar')) return;
  const r = photo.getBoundingClientRect();
  drag = { p, dx: e.clientX - r.left - p.offsetLeft, dy: e.clientY - r.top - p.offsetTop };
  p.setPointerCapture(e.pointerId);
  p.classList.add('arrastrando');
  p.style.zIndex = ++z;
});
photo.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const r = photo.getBoundingClientRect(), { p } = drag;
  p.style.left = `${Math.max(0, Math.min(photo.clientWidth - p.offsetWidth, e.clientX - r.left - drag.dx))}px`;
  p.style.top = `${Math.max(0, Math.min(photo.clientHeight - p.offsetHeight, e.clientY - r.top - drag.dy))}px`;
});
const soltar = () => { if (drag) drag.p.classList.remove('arrastrando'); drag = null; };
photo.addEventListener('pointerup', soltar);
photo.addEventListener('pointercancel', soltar);
photo.addEventListener('keydown', (e) => {
  const p = e.target.closest('.pieza');
  if (!p || e.target.closest('.quitar')) return;
  const mv = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key];
  if (mv) {
    e.preventDefault();
    p.style.left = `${Math.max(0, Math.min(photo.clientWidth - p.offsetWidth, p.offsetLeft + mv[0]))}px`;
    p.style.top = `${Math.max(0, Math.min(photo.clientHeight - p.offsetHeight, p.offsetTop + mv[1]))}px`;
  } else if (e.key === 'Delete' || e.key === 'Backspace') p.remove();
});

dressup.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('quitar')) b.parentElement.remove();
  if (b.dataset.paso) cambiar(b.closest('.fila').dataset.parte, +b.dataset.paso);
  if (b.id === 'random') random();
  if (b.id === 'add-personaje') agregar(PERSONAJES, 'personaje', true);
  if (b.id === 'limpiar') photo.querySelectorAll('.pieza').forEach((p) => p.remove());
  if (b.dataset.scene) {
    dressup.dataset.scene = (+dressup.dataset.scene + +b.dataset.scene + SCENES) % SCENES;
    if (!calm.matches) { restart(photo, 'flash'); restart(room, 'flash'); }
  }
});
