const dressup = document.querySelector('.dressup');
const photo = dressup.querySelector('.photo');
const room = dressup.querySelector('.room');
const doll = dressup.querySelector('#doll');
const anuncio = dressup.querySelector('#anuncio');
const SCENES = 9;   // los fondos están en css/main.css (.dressup[data-scene="N"])
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const rnd = (n) => Math.floor(Math.random() * n);

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

// Estrellitas chiquitas que salen del botón apretado (en los colores de Mimi Muse)
function estrellitas(b) {
  const r = b.getBoundingClientRect(), base = dressup.getBoundingClientRect();
  for (let k = 0; k < 5; k++) {
    const c = document.createElement('i'), a = (k / 5) * Math.PI * 2 + Math.random() * 0.8, d = 26 + Math.random() * 18;
    c.className = 'chispa mini-estrella';
    c.style.setProperty('--x', `${r.left - base.left + r.width / 2}px`); c.style.setProperty('--y', `${r.top - base.top + r.height / 2}px`);
    c.style.setProperty('--dx', `${Math.cos(a) * d}px`); c.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    c.addEventListener('animationend', () => c.remove());
    dressup.appendChild(c);
  }
}
const salta = () => { if (!calm.matches) { doll.classList.remove('gira'); restart(doll, 'salta'); } };   // la muñeca hace un saltito

// ---- La muñeca: modelo fija + una capa por parte, todas del mismo tamaño y apiladas ----
const ORDEN = ['abajo', 'arriba', 'zapatos'];   // de atrás hacia adelante
const PARTES = ORDEN.filter((k) => ROPA[k]?.length);  // una lista vacía no rompe nada: esa parte se apaga
const elegida = { arriba: 0, abajo: 0, zapatos: 0 };
const off = {};                                  // cuánto se arrastró cada prenda
const capas = {}, textos = {}, filas = {};
let barajando = false;

// Precarga: cambiar de prenda no deja la capa en blanco mientras baja el PNG
const cache = {};
PARTES.forEach((k) => ROPA[k].forEach((it) => { cache[it.src] ??= Object.assign(new Image(), { src: it.src }); }));

const capa = (src, alt) => {
  const i = new Image();
  i.src = src; i.alt = alt; i.draggable = false;
  doll.appendChild(i);
  return i;
};
capa(MODELO, 'Modelo');
PARTES.forEach((k) => { capas[k] = capa(ROPA[k][0].src, ''); off[k] = { x: 0, y: 0 }; });
dressup.querySelectorAll('.fila').forEach((f) => {
  const k = f.dataset.parte;
  textos[k] = f.querySelector('.prenda');
  filas[k] = f;
  if (!PARTES.includes(k)) { textos[k].textContent = 'sin prendas'; f.querySelectorAll('.paso').forEach((b) => { b.disabled = true; }); }
});

function mostrarRopa() {   // no se llama "mostrar": productos.js ya usa ese nombre y lo pisaba
  PARTES.forEach((k) => {
    const item = ROPA[k][elegida[k]];
    capas[k].src = item.src;
    capas[k].alt = item.nombre;
    textos[k].textContent = `${item.nombre} ${elegida[k] + 1}/${ROPA[k].length}`;
  });
}
const mover = (k, x, y) => { off[k] = { x, y }; capas[k].style.translate = `${x}px ${y}px`; };
const acomodar = () => PARTES.forEach((k) => mover(k, 0, 0));

function cambiar(parte, d) {
  if (barajando || !PARTES.includes(parte)) return;
  const n = ROPA[parte].length;
  elegida[parte] = (elegida[parte] + d + n) % n;   // en loop
  mover(parte, 0, 0);
  mostrarRopa();
  salta();
  anuncio.textContent = `${parte}: ${ROPA[parte][elegida[parte]].nombre}`;
}
mostrarRopa();

function random() {
  if (barajando || !PARTES.length) return;
  const sorteo = () => Object.fromEntries(PARTES.map((k) => [k, rnd(ROPA[k].length)]));
  const combos = PARTES.reduce((n, k) => n * ROPA[k].length, 1);
  let final = sorteo();
  while (combos > 1 && PARTES.every((k) => final[k] === elegida[k])) final = sorteo();  // que siempre cambie algo
  barajando = true;
  acomodar();
  const terminar = () => {
    Object.assign(elegida, final);
    mostrarRopa();
    barajando = false;
    anuncio.textContent = PARTES.map((k) => `${k}: ${ROPA[k][elegida[k]].nombre}`).join(', ');
    if (!calm.matches) { restart(photo, 'swap'); doll.classList.remove('salta'); restart(doll, 'gira'); burst(); }   // random: la muñeca gira
  };
  if (calm.matches) return terminar();
  let t = 0;
  const id = setInterval(() => {      // barajada rápida antes de elegir
    Object.assign(elegida, sorteo());
    mostrarRopa();
    if (++t >= 6) { clearInterval(id); terminar(); }
  }, 70);
}

// ---- Arrastrar prendas (la modelo no se mueve). Se escucha en todo el escenario: así una prenda que salió de la muñeca se puede volver a agarrar ----
const px = document.createElement('canvas');
px.width = px.height = 1;
const pctx = px.getContext('2d', { willReadFrequently: true });
const ZONAS = { arriba: [0.2, 0.5], abajo: [0.44, 0.92], zapatos: [0.85, 1] };  // por si el navegador no deja leer píxeles

// ¿La prenda `k` tiene algo dibujado justo bajo el puntero? Se mira la transparencia del PNG.
function toca(k, e) {
  const r = doll.getBoundingClientRect(), img = cache[ROPA[k][elegida[k]].src];
  const fx = (e.clientX - r.left - off[k].x) / r.width, fy = (e.clientY - r.top - off[k].y) / r.height;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;
  try {
    pctx.clearRect(0, 0, 1, 1);
    pctx.drawImage(img, -Math.floor(fx * img.naturalWidth), -Math.floor(fy * img.naturalHeight));
    return pctx.getImageData(0, 0, 1, 1).data[3] > 20;
  } catch {                       // lienzo "contaminado" (abierto desde archivo): se usan zonas del cuerpo
    return fy >= ZONAS[k][0] && fy <= ZONAS[k][1];
  }
}
const prendaEn = (e) => [...PARTES].reverse().find((k) => toca(k, e));   // la de más arriba gana

let drag = null;
photo.addEventListener('pointerdown', (e) => {
  if (barajando) return;
  const k = prendaEn(e);
  if (!k) return;                 // tocar la modelo no hace nada
  drag = { k, sx: e.clientX, sy: e.clientY, ox: off[k].x, oy: off[k].y };
  photo.setPointerCapture(e.pointerId);
  photo.style.cursor = 'grabbing';
});
photo.addEventListener('pointermove', (e) => {
  if (!drag) { if (!barajando) photo.style.cursor = prendaEn(e) ? 'grab' : 'default'; return; }
  const lim = { x: photo.clientWidth, y: photo.clientHeight };
  mover(drag.k,
    Math.max(-lim.x, Math.min(lim.x, drag.ox + e.clientX - drag.sx)),
    Math.max(-lim.y, Math.min(lim.y, drag.oy + e.clientY - drag.sy)));
});
// Táctil: el scroll de la página solo se frena si el dedo agarra una prenda
photo.addEventListener('touchstart', (e) => { if (!barajando && prendaEn(e.touches[0])) e.preventDefault(); }, { passive: false });

const soltar = () => {
  if (!drag) return;
  const { x, y } = off[drag.k];
  if (Math.hypot(x, y) < 24) mover(drag.k, 0, 0);   // cerca de su lugar: calza sola
  drag = null;
  photo.style.cursor = 'default';
};
photo.addEventListener('pointerup', soltar);
photo.addEventListener('pointercancel', soltar);

dressup.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (!calm.matches && !barajando) { restart(b, 'boing'); estrellitas(b); }   // el botón rebota y suelta estrellitas
  if (b.dataset.paso) cambiar(b.closest('.fila').dataset.parte, +b.dataset.paso);
  if (b.id === 'random') random();
  if (b.id === 'acomodar' && !barajando) { acomodar(); salta(); }
  if (b.dataset.scene) {
    dressup.dataset.scene = (+dressup.dataset.scene + +b.dataset.scene + SCENES) % SCENES;
    if (!calm.matches) { restart(photo, 'flash'); restart(room, 'flash'); }
  }
});
