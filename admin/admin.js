const $ = (s) => document.querySelector(s);
const KEY = 'mimi-admin-token';
let token = sessionStorage.getItem(KEY) || '';
let rev = 0;
let items = [];
let edit = null;          // copia del producto que se está editando
let editandoIdx = -1;     // -1 = producto nuevo

// ---------- Comunicación con el servidor ----------
async function api(accion, datos = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, ...datos }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && accion !== 'entrar') { salir(); throw new Error(d.error || 'Sesión vencida.'); }
  if (!r.ok) throw new Error(d.error || 'No se pudo completar la acción.');
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
async function guardarTodo(msg) {
  const d = await api('guardar', { rev, items });
  rev = d.rev; items = d.items; pintar(); if (msg) aviso(msg);
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
  $('#lista').replaceChildren(...vistos.map(fila));
}

function fila(p) {
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
    el('p', { textContent: `${soles(p.precio)} · ${ruta}` }),
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
  return el('li', { className: 'item' + (p.activo ? '' : ' oculto') }, foto, info, el('div', { className: 'acciones' }, bAg, bVis, bEd, bDel));
}

async function rapido(p, cambios) {
  const antes = { ...p };
  Object.assign(p, cambios);
  try { await guardarTodo('Guardado'); } catch (err) { Object.assign(p, antes); pintar(); aviso(err.message, true); }
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
async function achicar(archivo) {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.88));   // mantiene la transparencia
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
$('#subir').addEventListener('change', async (e) => {
  const archivos = [...e.target.files]; e.target.value = '';
  for (const f of archivos) {
    if (edit.imgs.length >= 8) { aviso('Máximo 8 fotos por producto.', true); break; }
    try { aviso(`Subiendo ${f.name}…`); edit.imgs.push((await api('subir', { datos: await achicar(f) })).url); fotos(); aviso('Foto subida'); }
    catch (err) { aviso(`${f.name}: ${err.message}`, true); }
  }
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
  const antes = items.slice();
  if (editandoIdx < 0) items.push(edit); else items[editandoIdx] = edit;
  $('#guardar').disabled = true;
  try { await guardarTodo('Producto guardado'); $('#editor').close(); }
  catch (err) { items = antes; $('#e-error').textContent = err.message; pintar(); }
  finally { $('#guardar').disabled = false; }
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
