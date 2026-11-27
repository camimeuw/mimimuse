const $ = (s) => document.querySelector(s);
const KEY = 'mimi-admin-token';
let token = sessionStorage.getItem(KEY) || '';
let rev = 0;
let items = [];
let edit = null;          // copia del producto que se está editando
let editandoIdx = -1;     // -1 = producto nuevo

// ---------- Comunicación con el servidor ----------
async function api(accion, datos = {}) {
  let r;
  try {
    r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion, ...datos }),
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisá tu internet y volvé a intentar.');
  }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && accion !== 'entrar') { salir(); throw new Error(d.error || 'Sesión vencida: volvé a entrar.'); }
  if (!r.ok) throw new Error(d.error || (r.status >= 500 ? 'El servidor no respondió bien. Probá de nuevo en un minuto.' : 'No se pudo completar la acción.'));
  return d;
}

let tAviso;
function aviso(msg, mal = false) {
  const a = $('#aviso');
  a.textContent = msg; a.classList.toggle('mal', mal); a.classList.add('ver');
  clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('ver'), 3500);
}

// ---------- Entrar / salir ----------
function mostrar(sesion) {
  $('#entrar').hidden = sesion; $('#panel').hidden = !sesion; $('#salir').hidden = !sesion;
}
function salir() { token = ''; sessionStorage.removeItem(KEY); mostrar(false); }
$('#salir').addEventListener('click', salir);
$('#f-entrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    token = (await api('entrar', { clave: $('#clave').value })).token;
    sessionStorage.setItem(KEY, token); $('#clave').value = '';
    await cargar();
  } catch (err) { aviso(err.message, true); }
});

async function cargar() {
  const d = await api('ver');
  rev = d.rev; items = d.items; mostrar(true); pintar();
}
// Mientras se guarda, los botones quedan apagados: así un doble toque no manda dos guardados a la vez
let ocupado = false;
function bloquear(on) {
  document.body.classList.toggle('guardando', on);
  document.querySelectorAll('#panel button, #editor button, #d-ren button, #salir').forEach((b) => {
    if (on) { b.dataset.estaba = b.disabled ? '1' : ''; b.disabled = true; } else { b.disabled = b.dataset.estaba === '1'; delete b.dataset.estaba; }
  });
}
async function guardarTodo(msg) {
  if (ocupado) throw new Error('Todavía se está guardando. Esperá un momento.');
  ocupado = true; bloquear(true); aviso('Guardando…');
  try {
    const d = await api('guardar', { rev, items });
    rev = d.rev; items = d.items;
    if (msg) aviso(msg);
  } finally { ocupado = false; bloquear(false); pintar(); }
}

// ---------- Lista ----------
const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const soles = (n) => `S/ ${Number(n).toFixed(2)}`;
const cats = () => [...new Set(items.map((p) => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const subsDe = (c) => [...new Set(items.filter((p) => p.cat === c).map((p) => p.sub).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const el = (tag, props = {}, ...hijos) => { const e = Object.assign(document.createElement(tag), props); e.append(...hijos); return e; };

function pintar() {
  const filtro = $('#f-cat'), actual = filtro.value;
  filtro.replaceChildren(el('option', { value: '', textContent: 'Todas' }), ...cats().map((c) => el('option', { value: c, textContent: c })));
  filtro.value = cats().includes(actual) ? actual : '';
  const q = sinTildes($('#buscar').value.trim());
  const vistos = items.filter((p) => (!filtro.value || p.cat === filtro.value) && (!q || sinTildes(`${p.nombre} ${p.cat} ${p.sub}`).includes(q)));
  $('#resumen').textContent = `${vistos.length} de ${items.length} productos`;
  $('#lista').replaceChildren(...vistos.map((p, k) => fila(p, vistos, k)));
}

function fila(p, vistos, k) {
  const i = items.indexOf(p);
  const foto = p.imgs[0] ? el('img', { src: p.imgs[0], alt: '' }) : el('div', { className: 'sinfoto', textContent: 'sin foto' });
  const etq = [];
  if (p.agotado) etq.push(el('span', { className: 'etq mal', textContent: 'Agotado' }));
  if (!p.activo) etq.push(el('span', { className: 'etq', textContent: 'Oculto' }));
  const tAg = p.tallesAgotados.length;
  if (tAg) etq.push(el('span', { className: 'etq mal', textContent: `Talles agotados: ${p.tallesAgotados.join(', ')}` }));
  const ruta = [p.cat, p.sub].filter(Boolean).join(' › ') || 'Sin categoría';
  const info = el('div', {},
    el('h3', { textContent: p.nombre }),
    el('p', {}, el('span', { className: 'pos', textContent: `N° ${i + 1}` }), ` · ${soles(p.precio)} · ${ruta}`),
    el('p', { textContent: [p.talles.length ? `Talles: ${p.talles.join(', ')}` : '', p.colores.length ? `Colores: ${p.colores.join(', ')}` : ''].filter(Boolean).join(' · ') }),
    el('p', {}, ...etq));
  const bAg = el('button', { type: 'button', className: 'sec', textContent: p.agotado ? 'Hay stock' : 'Marcar agotado' });
  bAg.addEventListener('click', () => rapido(p, { agotado: !p.agotado }));
  const bVis = el('button', { type: 'button', className: 'sec', textContent: p.activo ? 'Ocultar' : 'Mostrar' });
  bVis.addEventListener('click', () => rapido(p, { activo: !p.activo }));
  const bEd = el('button', { type: 'button', textContent: 'Editar' });
  bEd.addEventListener('click', () => abrirEditor(i));
  const bDel = el('button', { type: 'button', className: 'sec', textContent: 'Eliminar' });
  bDel.addEventListener('click', () => eliminar(p));
  const bUp = el('button', { type: 'button', className: 'sec', textContent: '▲', disabled: k === 0 }); bUp.setAttribute('aria-label', `Subir ${p.nombre}`);
  const bDown = el('button', { type: 'button', className: 'sec', textContent: '▼', disabled: k === vistos.length - 1 }); bDown.setAttribute('aria-label', `Bajar ${p.nombre}`);
  const bTop = el('button', { type: 'button', className: 'sec', textContent: 'Primero', disabled: i === 0 });
  bUp.addEventListener('click', () => mover(p, vistos[k - 1]));
  bDown.addEventListener('click', () => mover(p, vistos[k + 1]));
  bTop.addEventListener('click', () => reordenar([p, ...items.filter((x) => x !== p)]));
  return el('li', { className: 'item' + (p.activo ? '' : ' oculto') }, foto, info, el('div', { className: 'acciones' }, el('span', { className: 'orden' }, bUp, bDown, bTop), bAg, bVis, bEd, bDel));
}

async function rapido(p, cambios) {
  const antes = { ...p };
  Object.assign(p, cambios);
  try { await guardarTodo('Guardado'); } catch (err) { Object.assign(p, antes); pintar(); aviso(err.message, true); }
}
// El orden de la lista es el orden en la tienda
async function reordenar(nuevo) {
  const antes = items; items = nuevo;
  try { await guardarTodo('Orden guardado'); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
function mover(p, vecino) {
  const copia = items.slice(), a = copia.indexOf(p), b = copia.indexOf(vecino);
  [copia[a], copia[b]] = [copia[b], copia[a]];
  return reordenar(copia);
}
async function eliminar(p) {
  if (!confirm(`¿Eliminar "${p.nombre}"? No se puede deshacer.`)) return;
  const antes = items;
  items = items.filter((x) => x !== p);
  try { await guardarTodo('Producto eliminado'); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
$('#buscar').addEventListener('input', pintar);
$('#f-cat').addEventListener('change', pintar);

// ---------- Editor ----------
const vacio = () => ({ id: null, nombre: '', precio: '', precioAntes: '', cat: '', sub: '', desc: '', talles: [], tallesAgotados: [], colores: [], agotado: false, activo: true, imgs: [] });

function abrirEditor(i) {
  editandoIdx = i;
  edit = i < 0 ? vacio() : structuredClone(items[i]);
  $('#t-editor').textContent = i < 0 ? 'Nuevo producto' : 'Editar producto';
  $('#p-nombre').value = edit.nombre; $('#p-precio').value = edit.precio; $('#p-antes').value = edit.precioAntes ?? '';
  $('#p-cat').value = edit.cat; $('#p-sub').value = edit.sub; $('#p-desc').value = edit.desc;
  $('#p-agotado').checked = edit.agotado; $('#p-activo').checked = edit.activo;
  $('#d-cats').replaceChildren(...cats().map((c) => el('option', { value: c })));
  subsLista(); chips(); fotos(); $('#e-error').textContent = '';
  $('#editor').showModal(); $('#p-nombre').focus();
}
function subsLista() { $('#d-subs').replaceChildren(...subsDe($('#p-cat').value.trim()).map((s) => el('option', { value: s }))); }
$('#p-cat').addEventListener('input', subsLista);
$('#nuevo').addEventListener('click', () => abrirEditor(-1));
$('#cancelar').addEventListener('click', () => $('#editor').close());

// Talles y colores como "fichas"
function chips() {
  const talles = $('#c-talles'), colores = $('#c-colores');
  talles.replaceChildren(...edit.talles.map((t) => {
    const ag = edit.tallesAgotados.includes(t);
    const b = el('button', { type: 'button', textContent: t, title: 'Marcar o desmarcar agotado' });
    b.setAttribute('aria-pressed', ag); b.setAttribute('aria-label', `Talle ${t}${ag ? ', agotado' : ''}. Tocá para cambiar`);
    b.addEventListener('click', () => { edit.tallesAgotados = ag ? edit.tallesAgotados.filter((x) => x !== t) : [...edit.tallesAgotados, t]; chips(); });
    const x = el('button', { type: 'button', className: 'x', textContent: '×' });
    x.setAttribute('aria-label', `Quitar talle ${t}`);
    x.addEventListener('click', () => { edit.talles = edit.talles.filter((y) => y !== t); edit.tallesAgotados = edit.tallesAgotados.filter((y) => y !== t); chips(); });
    return el('span', { className: 'chip' }, b, x);
  }));
  colores.replaceChildren(...edit.colores.map((c) => {
    const b = el('button', { type: 'button', textContent: c, disabled: true });
    const x = el('button', { type: 'button', className: 'x', textContent: '×' });
    x.setAttribute('aria-label', `Quitar color ${c}`);
    x.addEventListener('click', () => { edit.colores = edit.colores.filter((y) => y !== c); chips(); });
    return el('span', { className: 'chip' }, b, x);
  }));
}
function agregarFichas(campo, texto) {
  const nuevos = texto.split(',').map((s) => s.trim()).filter(Boolean);
  edit[campo] = [...new Set([...edit[campo], ...nuevos])];
  chips();
}
for (const [campo, input, boton] of [['talles', '#n-talle', '#a-talle'], ['colores', '#n-color', '#a-color']]) {
  const ir = () => { agregarFichas(campo, $(input).value); $(input).value = ''; $(input).focus(); };
  $(boton).addEventListener('click', ir);
  $(input).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ir(); } });
}
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => agregarFichas('talles', b.dataset.preset)));

// Fotos: se achican en el navegador antes de subirlas
function fotos() {
  $('#fotos').replaceChildren(...edit.imgs.map((u, i) => {
    const mover = (d) => { const j = i + d; [edit.imgs[i], edit.imgs[j]] = [edit.imgs[j], edit.imgs[i]]; fotos(); };
    const izq = el('button', { type: 'button', className: 'sec', textContent: '◀', disabled: i === 0 }); izq.setAttribute('aria-label', 'Mover antes');
    const der = el('button', { type: 'button', className: 'sec', textContent: '▶', disabled: i === edit.imgs.length - 1 }); der.setAttribute('aria-label', 'Mover después');
    const x = el('button', { type: 'button', className: 'sec', textContent: '×' }); x.setAttribute('aria-label', 'Quitar foto');
    izq.addEventListener('click', () => mover(-1)); der.addEventListener('click', () => mover(1));
    x.addEventListener('click', () => { edit.imgs.splice(i, 1); fotos(); });
    return el('li', {}, el('img', { src: u, alt: `Foto ${i + 1}` }), el('div', { className: 'principal', textContent: i === 0 ? 'Principal' : i === 1 ? 'Al pasar el mouse' : '' }), el('div', { className: 'mov' }, izq, der, x));
  }));
}
// Quitar el fondo blanco: mismo método que el panel de Bunny Club (se queda con la prenda más grande y suaviza el borde)
function scaled(src, max) {
  const s = Math.min(1, max / Math.max(src.width, src.height)), w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, w, h);
  return c;
}
function tieneAlfa(c) {
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 12) if (d[i] < 250) return true;
  return false;
}
function morph(src, w, h, iters, grow) {   // agranda (grow) o achica la máscara 1 px por vuelta
  let a = src;
  for (let t = 0; t < iters; t++) {
    const out = new Uint8Array(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 1;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) { if (!grow) v = 0; continue; }
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) { if (!grow) v = 0; continue; }
          const s = a[yy * w + xx];
          if (grow) { if (s) v = 1; } else if (!s) v = 0;
        }
      }
      out[y * w + x] = v;
    }
    a = out;
  }
  return a;
}
function mayor(fg, w, h) {                  // deja solo la mancha más grande (saca motas y marcas de agua)
  const n = w * h, lab = new Int32Array(n), q = new Int32Array(n);
  let best = 0, bestSize = 0, id = 0;
  for (let s = 0; s < n; s++) {
    if (!fg[s] || lab[s]) continue;
    id++; let qs = 0, qe = 0; q[qe++] = s; lab[s] = id;
    while (qs < qe) {
      const i = q[qs++], x = i % w, y = (i / w) | 0;
      if (x > 0 && fg[i - 1] && !lab[i - 1]) { lab[i - 1] = id; q[qe++] = i - 1; }
      if (x < w - 1 && fg[i + 1] && !lab[i + 1]) { lab[i + 1] = id; q[qe++] = i + 1; }
      if (y > 0 && fg[i - w] && !lab[i - w]) { lab[i - w] = id; q[qe++] = i - w; }
      if (y < h - 1 && fg[i + w] && !lab[i + w]) { lab[i + w] = id; q[qe++] = i + w; }
    }
    if (qe > bestSize) { bestSize = qe; best = id; }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = lab[i] === best ? 1 : 0;
  return out;
}
function quitarFondo(c) {
  const w = c.width, h = c.height, n = w * h, ctx = c.getContext('2d', { willReadFrequently: true }), im = ctx.getImageData(0, 0, w, h), d = im.data;
  let bar = new Uint8Array(n);                                   // "no es blanco" = prenda o sombra
  for (let i = 0; i < n; i++) { const o = i * 4; bar[i] = Math.min(d[o], d[o + 1], d[o + 2]) < 250 ? 1 : 0; }
  bar = morph(bar, w, h, 2, true);                               // cierra huequitos del borde
  const bg = new Uint8Array(n), q = new Int32Array(n); let qs = 0, qe = 0;
  const push = (i) => { if (!bar[i] && !bg[i]) { bg[i] = 1; q[qe++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qs < qe) { const i = q[qs++], x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  let fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = bg[i] ? 0 : 1;
  fg = mayor(morph(fg, w, h, 2, false), w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {      // borde suave
    let s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += fg[yy * w + xx]; k++; } }
    d[(y * w + x) * 4 + 3] = Math.round(Math.min(1, Math.max(0, (s / k - 0.15) / 0.7)) * 255);
  }
  ctx.putImageData(im, 0, 0);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;                            // recorta los bordes transparentes
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return c;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04), o = document.createElement('canvas');
  o.width = x1 - x0 + 1 + pad * 2; o.height = y1 - y0 + 1 + pad * 2;
  o.getContext('2d').drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o;
}
async function procesar(archivo, cortar) {
  const bmp = await createImageBitmap(archivo).catch(() => { throw new Error('no es una imagen válida'); });
  let c = scaled(bmp, 1100);
  if (cortar && !tieneAlfa(c)) c = quitarFondo(c);
  let blob, max = 1100;
  for (let t = 0; t < 4; t++) {                                  // WEBP (mantiene la transparencia); si pesa mucho, se achica más
    blob = await new Promise((ok) => (t === 0 ? c : scaled(c, max)).toBlob(ok, 'image/webp', 0.88));
    if (blob.size < 1.2 * 1024 * 1024) break;
    max = Math.round(max * 0.8);
  }
  if (blob.size > 1.4 * 1024 * 1024) throw new Error('la foto es demasiado pesada');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
let subiendo = 0;
$('#subir').addEventListener('change', async (e) => {
  const archivos = [...e.target.files]; e.target.value = '';
  subiendo++; $('#guardar').disabled = true;   // no se puede guardar el producto con una foto a medio subir
  try {
    for (const f of archivos) {
      if (edit.imgs.length >= 8) { aviso('Máximo 8 fotos por producto.', true); break; }
      try { aviso(`Procesando ${f.name}…`); edit.imgs.push((await api('subir', { datos: await procesar(f, $('#p-cut').checked) })).url); fotos(); aviso('Foto subida'); }
      catch (err) { aviso(`${f.name}: ${err.message}`, true); }
    }
  } finally { if (!--subiendo) $('#guardar').disabled = false; }
});

// Guardar el producto
$('#f-prod').addEventListener('submit', async (e) => {
  e.preventDefault();
  agregarFichas('talles', $('#n-talle').value); $('#n-talle').value = '';   // por si quedó algo escrito sin agregar
  agregarFichas('colores', $('#n-color').value); $('#n-color').value = '';
  Object.assign(edit, {
    nombre: $('#p-nombre').value, precio: $('#p-precio').value, precioAntes: $('#p-antes').value,
    cat: $('#p-cat').value, sub: $('#p-sub').value, desc: $('#p-desc').value,
    agotado: $('#p-agotado').checked, activo: $('#p-activo').checked,
  });
  if (subiendo) { $('#e-error').textContent = 'Esperá a que termine de subir la foto y volvé a guardar.'; return; }
  const antes = items.slice();
  if (editandoIdx < 0) items.push(edit); else items[editandoIdx] = edit;
  try { await guardarTodo('Producto guardado'); $('#editor').close(); }
  catch (err) { items = antes; $('#e-error').textContent = err.message; pintar(); }
});

// ---------- Renombrar categoría / subcategoría ----------
$('#renombrar').addEventListener('click', () => {
  if (!cats().length) return aviso('Todavía no hay categorías.', true);
  $('#r-cat').replaceChildren(...cats().map((c) => el('option', { value: c, textContent: c })));
  subsRen(); $('#r-nuevo').value = ''; $('#d-ren').showModal(); $('#r-cat').focus();
});
function subsRen() { $('#r-sub').replaceChildren(el('option', { value: '', textContent: '(la categoría entera)' }), ...subsDe($('#r-cat').value).map((s) => el('option', { value: s, textContent: s }))); }
$('#r-cat').addEventListener('change', subsRen);
$('#r-cancelar').addEventListener('click', () => $('#d-ren').close());
$('#f-ren').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cat = $('#r-cat').value, sub = $('#r-sub').value, nuevo = $('#r-nuevo').value.trim();
  if (!nuevo) return;
  const antes = structuredClone(items);
  items.forEach((p) => { if (p.cat === cat) { if (!sub) p.cat = nuevo; else if (p.sub === sub) p.sub = nuevo; } });
  try { await guardarTodo('Nombre cambiado'); $('#d-ren').close(); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
});

// ---------- Copia de seguridad ----------
$('#copia').addEventListener('click', () => {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ fecha: new Date().toISOString(), items }, null, 2)], { type: 'application/json' })), download: `mimimuse-productos-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});

// ---------- Inicio ----------
if (token) cargar().catch(() => salir()); else mostrar(false);
