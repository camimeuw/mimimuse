const $ = (s) => document.querySelector(s);
let rev = 0;
let items = [];
let edit = null;          // copia del producto que se está editando
let editandoIdx = -1;     // -1 = producto nuevo

// ---------- Comunicación con Firebase (datos.js) ----------
async function api(accion, datos = {}) {
  try {
    if (accion === 'ver') return await Datos.ver();
    if (accion === 'cambios') return await Datos.cambios(datos);
    throw new Error('Acción desconocida.');
  } catch (e) {
    if (e.autenticacion) salir();                 // la sesión venció: vuelve a la pantalla de entrar
    throw e;
  }
}

let tAviso;
function aviso(msg, mal = false, accion = null) {
  const a = $('#aviso');
  a.replaceChildren(msg);
  if (accion) {
    const b = el('button', { type: 'button', textContent: accion.texto });
    b.addEventListener('click', () => { a.classList.remove('ver', 'conaccion'); accion.hacer(); });
    a.append(' ', b);
  }
  a.classList.toggle('mal', mal); a.classList.toggle('conaccion', !!accion); a.classList.add('ver');
  clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('ver', 'conaccion'), accion ? 10000 : 3500);
}

// ---------- Entrar / salir ----------
let pestana = 'productos';
function mostrar(sesion) {
  const hay = DB.enabled();
  $('#falta').hidden = hay; $('#entrar').hidden = !hay || sesion;
  $('#pestanas').hidden = !sesion; $('#panel').hidden = !sesion || pestana !== 'productos'; $('#codigos').hidden = !sesion || pestana !== 'codigos';
  $('#salir').hidden = !sesion; $('#ver-tienda').hidden = !sesion;
  document.querySelectorAll('#pestanas button').forEach((b) => b.setAttribute('aria-current', b.dataset.pestana === pestana ? 'page' : 'false'));
}
function salir() { DB.salir(); mostrar(false); }
$('#salir').addEventListener('click', salir);
$('#ver-clave').addEventListener('change', (e) => { $('#clave').type = e.target.checked ? 'text' : 'password'; });
$('#f-entrar').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#e-entrar').textContent = '';
  try { await DB.entrar($('#email').value.trim(), $('#clave').value); $('#clave').value = ''; await cargar(); }
  catch (err) { $('#e-entrar').textContent = err.message; }
});
$('#olvide').addEventListener('click', async () => {
  const email = $('#email').value.trim();
  if (!email) { $('#e-entrar').textContent = 'Escribí tu email arriba y volvé a tocar «Olvidé mi clave».'; return; }
  try { await DB.recuperarClave(email); $('#e-entrar').textContent = ''; aviso('Te mandamos un mail para poner una clave nueva. Mirá también el correo no deseado.'); }
  catch (err) { $('#e-entrar').textContent = err.message; }
});

async function cargar() {
  const d = await api('ver');
  rev = d.rev; items = d.items; mostrar(true); pintar();
}
const recargarLista = async () => { const d = await api('ver'); rev = d.rev; items = d.items; };

// Mientras se guarda, los botones quedan apagados: así un doble toque no manda dos guardados a la vez
let ocupado = false;
function bloquear(on) {
  document.body.classList.toggle('guardando', on);
  document.querySelectorAll('#panel button, #panel input, #editor button, #d-ren button, #d-masiva button, #d-import button, #masivo button, #codigos button, #codigos input, #pestanas button, #salir').forEach((b) => {
    if (on) { b.dataset.estaba = b.disabled ? '1' : ''; b.disabled = true; } else { b.disabled = b.dataset.estaba === '1'; delete b.dataset.estaba; }
  });
}
// Solo se manda lo que cambió (no los 200 productos): cambios = [{op:'poner', productos}, {op:'quitar', ids}, {op:'orden', ids}]
// vacio = confirma que la lista puede quedar vacía
const poner = (productos) => productos.length ? [{ op: 'poner', productos }] : [];
async function guardarTodo(msg, { cambios, vacio = false } = {}) {
  if (ocupado) throw new Error('Todavía se está guardando. Esperá un momento.');
  ocupado = true; bloquear(true); aviso('Guardando…');
  try {
    const d = await api('cambios', { rev, cambios, confirmarVacio: vacio });
    rev = d.rev;
    const porId = new Map(items.filter((p) => p.id != null).map((p) => [p.id, p]));
    for (const p of d.puestos) porId.set(p.id, p);          // lo que se guardó ya viene limpio y con su número
    const nuevos = d.orden.map((id) => porId.get(id));
    if (nuevos.every(Boolean)) items = nuevos; else await recargarLista();
    if (msg) aviso(msg);
  } finally { ocupado = false; bloquear(false); pintar(); }
}

// ---------- Lista ----------
const sinTildes = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const soles = (n) => `S/ ${Number(n).toFixed(2)}`;
const cats = () => [...new Set(items.map((p) => p.cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const subsDe = (c) => [...new Set(items.filter((p) => p.cat === c).map((p) => p.sub).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const el = (tag, props = {}, ...hijos) => { const e = Object.assign(document.createElement(tag), props); e.append(...hijos); return e; };
const enOferta = (p) => p.precioAntes != null && p.precioAntes > p.precio;
const sel = new Set();                                   // ids de los productos marcados
const marcados = () => items.filter((p) => sel.has(p.id));
const PAGINA = 30;                                        // filas que se dibujan por vez (la lista de 200 no se carga de golpe)
let mostrados = PAGINA;

function visibles() {
  const q = sinTildes($('#buscar').value.trim()), c = $('#f-cat').value;
  return items.filter((p) => (!c || p.cat === c) && (!q || sinTildes(`${p.nombre} ${p.cat} ${p.sub}`).includes(q)));
}
function pintar() {
  const filtro = $('#f-cat'), actual = filtro.value;
  filtro.replaceChildren(el('option', { value: '', textContent: 'Todas' }), ...cats().map((c) => el('option', { value: c, textContent: c })));
  filtro.value = cats().includes(actual) ? actual : '';
  for (const id of [...sel]) if (!items.some((p) => p.id === id)) sel.delete(id);
  const vistos = visibles();
  $('#resumen').textContent = `${vistos.length} de ${items.length} productos`;
  $('#lista').replaceChildren(...vistos.slice(0, mostrados).map((p, k) => fila(p, vistos, k)));
  $('#mas').hidden = vistos.length <= mostrados;
  $('#mas').textContent = `Ver más (${Math.min(PAGINA, vistos.length - mostrados)} de ${vistos.length - mostrados} que faltan)`;
  $('#todos-txt').textContent = `Seleccionar los ${vistos.length} que coinciden`;
  $('#todos').checked = vistos.length > 0 && vistos.every((p) => sel.has(p.id));
  $('#masivo').hidden = !sel.size;
  $('#m-cuantos').textContent = `${sel.size} seleccionado${sel.size === 1 ? '' : 's'}`;
}

function fila(p, vistos, k) {
  const i = items.indexOf(p);
  const foto = p.imgs[0] ? el('img', { alt: '', width: 64, height: 64, decoding: 'async' }) : el('div', { className: 'sinfoto', textContent: 'sin foto' });
  if (p.imgs[0]) DB.pintarFoto(foto, p.thumbs?.[0] || p.imgs[0]);
  const etq = [];
  if (p.agotado) etq.push(el('span', { className: 'etq mal', textContent: 'Agotado' }));
  if (enOferta(p)) etq.push(el('span', { className: 'etq', textContent: `Oferta -${Math.round((1 - p.precio / p.precioAntes) * 100)}%` }));
  if (!p.activo) etq.push(el('span', { className: 'etq', textContent: 'Oculto' }));
  if (p.tallesAgotados.length) etq.push(el('span', { className: 'etq mal', textContent: `Talles agotados: ${p.tallesAgotados.join(', ')}` }));
  const ruta = [p.cat, p.sub].filter(Boolean).join(' › ') || 'Sin categoría';
  const info = el('div', {},
    el('h3', { textContent: p.nombre }),
    el('p', {}, el('span', { className: 'pos', textContent: `N° ${i + 1}` }), ` · ${soles(p.precio)}${enOferta(p) ? ` (antes ${soles(p.precioAntes)})` : ''} · ${ruta}`),
    el('p', { textContent: [p.talles.length ? `Talles: ${p.talles.join(', ')}` : '', p.colores.length ? `Colores: ${p.colores.join(', ')}` : ''].filter(Boolean).join(' · ') }),
    el('p', {}, ...etq));
  const marca = el('input', { type: 'checkbox', className: 'marca', checked: sel.has(p.id) }); marca.setAttribute('aria-label', `Seleccionar ${p.nombre}`);
  marca.addEventListener('change', () => { marca.checked ? sel.add(p.id) : sel.delete(p.id); pintar(); });
  const boton = (texto, clase, fn, extra = {}) => { const b = el('button', { type: 'button', className: clase, textContent: texto, ...extra }); b.addEventListener('click', fn); return b; };
  const bUp = boton('▲', 'sec', () => mover(p, vistos[k - 1]), { disabled: k === 0 }); bUp.setAttribute('aria-label', `Subir ${p.nombre}`);
  const bDown = boton('▼', 'sec', () => mover(p, vistos[k + 1]), { disabled: k === vistos.length - 1 }); bDown.setAttribute('aria-label', `Bajar ${p.nombre}`);
  const bTop = boton('Primero', 'sec', () => reordenar([p, ...items.filter((x) => x !== p)]), { disabled: i === 0 });
  return el('li', { className: 'item' + (p.activo ? '' : ' oculto') }, marca, foto, info, el('div', { className: 'acciones' },
    el('span', { className: 'orden' }, bUp, bDown, bTop),
    boton(p.agotado ? 'Hay stock' : 'Marcar agotado', 'sec', () => rapido(p, { agotado: !p.agotado }, p.agotado ? 'Marcó con stock' : 'Marcó agotado')),
    boton(p.activo ? 'Ocultar' : 'Mostrar', 'sec', () => rapido(p, { activo: !p.activo }, p.activo ? 'Ocultó' : 'Mostró')),
    boton('Duplicar', 'sec', () => abrirEditor(-1, { ...structuredClone(p), id: null, nombre: `${p.nombre} (copia)` })),
    boton('Editar', '', () => abrirEditor(i)),
    boton('Eliminar', 'sec', () => eliminar(p))));
}

async function rapido(p, cambios, que) {
  const antes = { ...p };
  Object.assign(p, cambios);
  try { await guardarTodo('Guardado', { cambios: poner([p]), nota: `${que} «${p.nombre}»` }); } catch (err) { Object.assign(p, antes); pintar(); aviso(err.message, true); }
}
// El orden de la lista es el orden en la tienda
async function reordenar(nuevo) {
  const antes = items; items = nuevo;
  try { await guardarTodo('Orden guardado', { cambios: [{ op: 'orden', ids: nuevo.map((p) => p.id) }], nota: 'Cambió el orden' }); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
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
  try { await guardarTodo('Producto eliminado.', { cambios: [{ op: 'quitar', ids: [p.id] }], vacio: !items.length }); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
$('#buscar').addEventListener('input', () => { mostrados = PAGINA; pintar(); });
$('#f-cat').addEventListener('change', () => { mostrados = PAGINA; pintar(); });
$('#mas').addEventListener('click', () => { mostrados += PAGINA; pintar(); });

// ---------- Varios productos a la vez ----------
$('#todos').addEventListener('change', (e) => { for (const p of visibles()) e.target.checked ? sel.add(p.id) : sel.delete(p.id); pintar(); });
$('#m-quitar').addEventListener('click', () => { sel.clear(); pintar(); });
async function masivo(cambia, nota, msg) {
  const antes = structuredClone(items), n = marcados().length, tocados = marcados();
  tocados.forEach(cambia);
  try { await guardarTodo(`${msg} (${n})`, { cambios: poner(tocados), nota }); sel.clear(); pintar(); }
  catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
let modoMasivo = '';
function abrirMasivo(modo) {
  modoMasivo = modo;
  $('#m-titulo').textContent = modo === 'cat' ? `Cambiar categoría de ${sel.size} producto${sel.size === 1 ? '' : 's'}` : `Aplicar oferta a ${sel.size} producto${sel.size === 1 ? '' : 's'}`;
  $('#m-cat').hidden = modo !== 'cat'; $('#m-of').hidden = modo !== 'of';
  $('#m-c').value = ''; $('#m-s').value = ''; $('#m-p').value = ''; $('#m-error').textContent = '';
  $('#d-cats').replaceChildren(...cats().map((c) => el('option', { value: c })));
  $('#d-masiva').showModal(); ($(modo === 'cat' ? '#m-c' : '#m-p')).focus();
}
$('#m-c').addEventListener('input', () => $('#d-subs').replaceChildren(...subsDe($('#m-c').value.trim()).map((s) => el('option', { value: s }))));
$('#m-cancelar').addEventListener('click', () => $('#d-masiva').close());
$('#f-masiva').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (modoMasivo === 'cat') {
    const c = $('#m-c').value.trim(), s = $('#m-s').value.trim();
    if (!c) { $('#m-error').textContent = 'Escribí la categoría.'; return; }
    $('#d-masiva').close();
    return masivo((p) => { p.cat = c; p.sub = s; }, `Cambió la categoría a «${c}»`, 'Categoría cambiada');
  }
  const pct = Number($('#m-p').value);
  if (!Number.isInteger(pct) || pct < 1 || pct > 90) { $('#m-error').textContent = 'Poné un número entero del 1 al 90.'; return; }
  $('#d-masiva').close();
  masivo((p) => { const base = enOferta(p) ? p.precioAntes : p.precio; p.precioAntes = base; p.precio = Math.round(base * (100 - pct)) / 100; }, `Aplicó ${pct}% de oferta`, 'Oferta aplicada');
});
$('#masivo').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-m]'); if (!b) return;
  const m = b.dataset.m;
  if (m === 'agotado') masivo((p) => { p.agotado = true; }, 'Marcó agotado', 'Marcados como agotados');
  else if (m === 'stock') masivo((p) => { p.agotado = false; p.tallesAgotados = []; }, 'Marcó con stock', 'Marcados con stock');
  else if (m === 'ocultar') masivo((p) => { p.activo = false; }, 'Ocultó', 'Ocultados');
  else if (m === 'mostrar') masivo((p) => { p.activo = true; }, 'Mostró', 'Mostrados');
  else if (m === 'sinoferta') masivo((p) => { if (enOferta(p)) { p.precio = p.precioAntes; p.precioAntes = null; } }, 'Quitó la oferta', 'Oferta quitada');
  else if (m === 'cat' || m === 'of') abrirMasivo(m);
  else if (m === 'eliminar') {
    const n = sel.size;
    if (!confirm(`¿Eliminar ${n} producto${n === 1 ? '' : 's'}? No se puede deshacer.`)) return;
    const antes = items, ids = [...sel]; items = items.filter((p) => !sel.has(p.id));
    guardarTodo(`Eliminados (${n})`, { cambios: [{ op: 'quitar', ids }], vacio: !items.length }).then(() => { sel.clear(); pintar(); }, (err) => { items = antes; pintar(); aviso(err.message, true); });
  }
});

// ---------- Editor ----------
const vacio = () => ({ id: null, nombre: '', precio: '', precioAntes: '', cat: '', sub: '', desc: '', talles: [], tallesAgotados: [], colores: [], agotado: false, activo: true, imgs: [], thumbs: [] });

function abrirEditor(i, base = null) {
  editandoIdx = i;
  edit = base ? structuredClone(base) : i < 0 ? vacio() : structuredClone(items[i]);
  edit.thumbs = edit.imgs.map((_, k) => edit.thumbs?.[k] || '');   // productos viejos sin miniaturas
  $('#t-editor').textContent = base ? 'Duplicar producto: revisá el nombre y las fotos' : i < 0 ? 'Nuevo producto' : 'Editar producto';
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
    const mover = (d) => { const j = i + d; for (const l of [edit.imgs, edit.thumbs]) [l[i], l[j]] = [l[j], l[i]]; fotos(); };
    const izq = el('button', { type: 'button', className: 'sec', textContent: '◀', disabled: i === 0 }); izq.setAttribute('aria-label', 'Mover antes');
    const der = el('button', { type: 'button', className: 'sec', textContent: '▶', disabled: i === edit.imgs.length - 1 }); der.setAttribute('aria-label', 'Mover después');
    const x = el('button', { type: 'button', className: 'sec', textContent: '×' }); x.setAttribute('aria-label', 'Quitar foto');
    izq.addEventListener('click', () => mover(-1)); der.addEventListener('click', () => mover(1));
    x.addEventListener('click', () => { edit.imgs.splice(i, 1); edit.thumbs.splice(i, 1); fotos(); });
    const img = el('img', { alt: `Foto ${i + 1}` }); DB.pintarFoto(img, edit.thumbs[i] || u);
    return el('li', {}, img, el('div', { className: 'principal', textContent: i === 0 ? 'Principal' : i === 1 ? 'Al pasar el mouse' : '' }), el('div', { className: 'mov' }, izq, der, x));
  }));
}
// Las fotos se achican y se les quita el fondo en un Worker (la página no se traba con muchas fotos);
// si el navegador no lo permite, se hace en la propia página (procesarFoto viene de fotos.js)
let worker = null, enWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined', seq = 0;
const esperando = new Map();
function tareaWorker(archivo, cortar) {
  return new Promise((ok, mal) => {
    if (!worker) {
      worker = new Worker('foto-worker.js');
      worker.onmessage = ({ data }) => { const t = esperando.get(data.id); esperando.delete(data.id); if (t) data.error ? t.mal(new Error(data.error)) : t.ok(data); };
      worker.onerror = () => { enWorker = false; worker = null; for (const t of esperando.values()) t.mal(Object.assign(new Error('worker'), { reintentar: true })); esperando.clear(); };
    }
    const id = ++seq; esperando.set(id, { ok, mal }); worker.postMessage({ id, archivo, cortar });
  });
}
async function procesar(archivo, cortar) {
  if (enWorker) { try { return await tareaWorker(archivo, cortar); } catch (e) { if (!e.reintentar) throw e; } }
  return window.procesarFoto(archivo, cortar);
}
const aBase64 = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => mal(new Error('no se pudo leer la foto')); r.readAsDataURL(blob); });
// Procesa una foto y la sube (la foto y su miniatura son dos documentos de Firebase). Devuelve { url, mini, aviso } con los números de foto
async function subirFoto(archivo, cortar) {
  const { foto, mini, aviso } = await procesar(archivo, cortar);
  try {
    const url = await Datos.subir(await aBase64(foto), foto.type), urlMini = await Datos.subir(await aBase64(mini), mini.type);
    return { url, mini: urlMini, aviso };
  } catch (e) { if (e.autenticacion) salir(); throw e; }
}
// Fotos subidas en el editor: si se cierra sin guardar, se borran
const nuevasFotos = new Set();
$('#editor').addEventListener('close', () => { const ids = [...nuevasFotos]; nuevasFotos.clear(); if (ids.length) Datos.limpiarFotos(ids); });
let subiendo = 0;
$('#subir').addEventListener('change', async (e) => {
  const archivos = [...e.target.files]; e.target.value = '';
  subiendo++; $('#guardar').disabled = true;   // no se puede guardar el producto con una foto a medio subir
  try {
    for (const f of archivos) {
      if (edit.imgs.length >= 8) { aviso('Máximo 8 fotos por producto.', true); break; }
      try {
        aviso(`Procesando ${f.name}…`);
        const r = await subirFoto(f, $('#p-cut').checked);
        nuevasFotos.add(r.url); nuevasFotos.add(r.mini); edit.imgs.push(r.url); edit.thumbs.push(r.mini); fotos(); aviso(r.aviso ? `${f.name}: ${r.aviso}` : 'Foto subida', !!r.aviso);
      }
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
  try { await guardarTodo('Producto guardado', { cambios: poner([edit]), nota: `${editandoIdx < 0 ? 'Creó' : 'Editó'} «${edit.nombre}»` }); $('#editor').close(); }
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
  const tocados = [];
  items.forEach((p) => { if (p.cat === cat) { if (!sub) { p.cat = nuevo; tocados.push(p); } else if (p.sub === sub) { p.sub = nuevo; tocados.push(p); } } });
  try { await guardarTodo('Nombre cambiado', { cambios: poner(tocados), nota: `Renombró «${sub || cat}» a «${nuevo}»` }); $('#d-ren').close(); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
});

// ---------- Planilla (Excel / CSV): cargar o actualizar muchos productos ----------
const bajar = (nombre, texto, tipo) => { const a = el('a', { href: URL.createObjectURL(new Blob([texto], { type: tipo })), download: nombre }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const hoy = () => new Date().toISOString().slice(0, 10);
const RE_URL = Datos.RE_FOTO;                  // un número de foto que ya está en Firebase (viene de «Bajar mis productos»)
let plan = null, archivosFotos = new Map(), cancelaImport = false, importando = false;
const linea = (txt) => el('li', { textContent: txt });
const clave = (n) => n.toLowerCase();
const nombresFotos = () => new Set(plan.filas.flatMap((f) => (f.campos.fotos || []).filter((n) => !RE_URL.test(n)).map(clave)));

function resumirPlan() {
  const ids = new Set(items.map((p) => p.id)), nombres = new Set(items.map((p) => sinTildes(p.nombre)));
  const filas = plan.filas, actualizan = filas.filter((f) => f.campos.id != null && ids.has(f.campos.id)).length;
  const idsRaros = filas.filter((f) => f.campos.id != null && !ids.has(f.campos.id)).length;
  const repetidos = filas.filter((f) => !(f.campos.id != null && ids.has(f.campos.id)) && nombres.has(sinTildes(f.campos.nombre))).length;
  const pedidas = nombresFotos(), faltan = [...pedidas].filter((n) => !archivosFotos.has(n));
  const partes = [`${filas.length} producto${filas.length === 1 ? '' : 's'} listo${filas.length === 1 ? '' : 's'} para importar: ${filas.length - actualizan} nuevo${filas.length - actualizan === 1 ? '' : 's'} y ${actualizan} que se actualiza${actualizan === 1 ? '' : 'n'}.`];
  if (idsRaros) partes.push(`${idsRaros} tienen un id que no existe: se crean como nuevos.`);
  if (repetidos) partes.push(`${repetidos} nuevos tienen el mismo nombre que un producto que ya está (se crean igual).`);
  if (plan.errores.length) partes.push(`${plan.errores.length} fila${plan.errores.length === 1 ? '' : 's'} con errores no se importan.`);
  $('#i-txt').textContent = partes.join(' ');
  $('#i-errores').replaceChildren(...plan.errores.slice(0, 12).map((e) => linea(`Fila ${e.fila}: ${e.msg}`)), ...(plan.errores.length > 12 ? [linea(`…y ${plan.errores.length - 12} más.`)] : []));
  $('#i-fotos-paso').hidden = !pedidas.size;
  $('#i-faltan').textContent = !pedidas.size ? '' : faltan.length ? `Faltan ${faltan.length} de ${pedidas.size} fotos: ${faltan.slice(0, 5).join(', ')}${faltan.length > 5 ? '…' : ''}. Esos productos se importan sin esas fotos.` : `Están las ${pedidas.size} fotos.`;
  $('#i-importar').hidden = !filas.length; $('#i-importar').textContent = `Importar ${filas.length} producto${filas.length === 1 ? '' : 's'}`;
  $('#i-resumen').hidden = false;
}
$('#planilla').addEventListener('click', () => {
  plan = null; archivosFotos = new Map(); $('#i-csv').value = ''; $('#i-fotos').value = '';
  for (const id of ['#i-resumen', '#i-progreso', '#i-importar']) $(id).hidden = true;
  $('#i-paso1').hidden = false; $('#i-error').textContent = ''; $('#d-import').showModal();
});
$('#i-bajar').addEventListener('click', () => bajar(`mimimuse-productos-${hoy()}.csv`, CSV.exportar(items), 'text/csv;charset=utf-8'));
$('#i-ejemplo').addEventListener('click', () => bajar('mimimuse-planilla-ejemplo.csv', CSV.plantilla(), 'text/csv;charset=utf-8'));
$('#i-csv').addEventListener('change', async (e) => {
  const f = e.target.files[0]; $('#i-error').textContent = ''; if (!f) return;
  try {
    if (f.size > 5 * 1024 * 1024) throw new Error('La planilla pesa demasiado: ¿es el archivo correcto?');
    const r = CSV.aProductos(CSV.leer(CSV.decodificar(await f.arrayBuffer())));
    if (r.productos.length > 500) throw new Error('Hay más de 500 filas: dividí la planilla en partes.');
    plan = { filas: r.productos, errores: r.errores };
    resumirPlan();
    if (!r.productos.length) $('#i-error').textContent = r.errores.length === 1 && r.errores[0].fila === 1 ? '' : 'No hay ningún producto para importar.';
  } catch (err) { plan = null; $('#i-resumen').hidden = true; $('#i-importar').hidden = true; $('#i-error').textContent = err.message; }
});
$('#i-fotos').addEventListener('change', (e) => { for (const f of e.target.files) archivosFotos.set(clave(f.name), f); e.target.value = ''; if (plan) resumirPlan(); });
$('#i-cerrar').addEventListener('click', () => { if (importando) { cancelaImport = true; $('#i-estado').textContent = 'Cancelando…'; } else $('#d-import').close(); });
$('#d-import').addEventListener('cancel', (e) => { if (importando) { e.preventDefault(); cancelaImport = true; $('#i-estado').textContent = 'Cancelando…'; } });

// Arma los cambios con la lista tal como está AHORA (si alguien guardó mientras subían las fotos, se vuelve a armar)
function armarCambios(subidas) {
  const porId = new Map(items.map((p) => [p.id, p])), tocados = [];
  for (const { campos } of plan.filas) {
    const { fotos: nf, miniaturas: nm, ...resto } = campos;
    const viejo = campos.id != null ? porId.get(campos.id) : null;
    const p = viejo ? structuredClone(viejo) : vacio();
    Object.assign(p, resto);
    if (!viejo) p.id = null;
    if (nf) {
      const fs = nf.map((n, k) => (RE_URL.test(n) ? { url: n, mini: RE_URL.test(nm?.[k] || '') ? nm[k] : '' } : subidas.get(clave(n)))).filter(Boolean).slice(0, 8);
      if (fs.length) { p.imgs = fs.map((x) => x.url); p.thumbs = fs.map((x) => x.mini); }
    }
    p.thumbs = p.imgs.map((_, k) => p.thumbs?.[k] || '');
    tocados.push(p);
  }
  return poner(tocados);
}
$('#i-importar').addEventListener('click', async () => {
  const cola = [...nombresFotos()].filter((n) => archivosFotos.has(n)), subidas = new Map(), fallos = [], cortar = $('#i-cut').checked;
  const n = plan.filas.length;
  importando = true; cancelaImport = false;
  for (const id of ['#i-paso1', '#i-resumen', '#i-importar']) $(id).hidden = true;
  $('#i-progreso').hidden = false; $('#i-fallos').replaceChildren(); $('#i-error').textContent = ''; $('#i-cerrar').textContent = 'Cancelar';
  const total = cola.length, barra = $('#i-barra'); barra.max = Math.max(1, total); barra.value = 0;
  let hechas = 0, seguidos = 0;
  const estado = (t) => { $('#i-estado').textContent = t; };
  estado(total ? `Preparando las fotos: 0 de ${total}…` : 'Guardando los productos…');
  const carril = async () => {      // 2 carriles: mientras una foto se sube, la siguiente se procesa
    while (!cancelaImport && cola.length) {
      const nombre = cola.shift();
      try {
        const r = await subirFoto(archivosFotos.get(nombre), cortar);
        subidas.set(nombre, r); seguidos = 0;
        if (r.aviso) fallos.push(`${nombre}: ${r.aviso}`);
      } catch (err) {
        if (err.autenticacion) { cancelaImport = true; break; }
        fallos.push(`${nombre}: ${err.message}`);
        if (++seguidos >= 5) { cancelaImport = true; $('#i-error').textContent = 'Se cortó la conexión: revisá tu internet y volvé a intentar.'; }
      }
      barra.value = ++hechas; estado(`Preparando las fotos: ${hechas} de ${total}…`);
    }
  };
  try {
    await Promise.all([carril(), carril()]);
    if (cancelaImport) { Datos.limpiarFotos([...subidas.values()].flatMap((x) => [x.url, x.mini])); estado($('#i-error').textContent ? 'No se importó nada.' : 'Importación cancelada: no se cambió ningún producto.'); return; }
    estado('Guardando los productos…');
    for (let intento = 0; ; intento++) {
      try { await guardarTodo(`Importó ${n} producto${n === 1 ? '' : 's'}`, { cambios: armarCambios(subidas) }); break; }
      catch (err) { if (err.status === 409 && !intento) { await recargarLista(); continue; } throw err; }
    }
    estado(`Listo: se importaron ${n} producto${n === 1 ? '' : 's'}.${fallos.length ? ` Ojo con ${fallos.length} foto${fallos.length === 1 ? '' : 's'}:` : ''}`);
    $('#i-fallos').replaceChildren(...fallos.slice(0, 12).map(linea));
    barra.value = barra.max;
    if (!fallos.length) $('#d-import').close();      // sin problemas: se cierra solo
  } catch (err) { Datos.limpiarFotos([...subidas.values()].flatMap((x) => [x.url, x.mini])); $('#i-error').textContent = err.message; estado('No se pudo guardar. Los productos no cambiaron.'); }
  finally { importando = false; $('#i-cerrar').textContent = 'Cerrar'; }
});

// ---------- Copia de seguridad ----------
$('#copia').addEventListener('click', () => {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ fecha: new Date().toISOString(), items }, null, 2)], { type: 'application/json' })), download: `mimimuse-productos-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});

// ---------- Cupones (códigos de descuento) ----------
let codigos = [];
const fechaLinda = (iso) => iso.split('-').reverse().join('/');
async function cargarCodigos() { codigos = await Datos.codigos(); pintarCodigos(); }
function pintarCodigos() {
  const boton = (texto, clase, fn) => { const b = el('button', { type: 'button', className: clase, textContent: texto }); b.addEventListener('click', fn); return b; };
  $('#cd-lista').replaceChildren(...(codigos.length ? codigos.map((c) => el('li', { className: 'cd' + (c.activo === false ? ' oculto' : '') },
    el('div', {}, el('strong', { textContent: c.id }), el('p', { textContent: `${c.porcentaje}% de descuento · ${c.vence ? `vence el ${fechaLinda(c.vence)}` : 'sin vencimiento'}${c.activo === false ? ' · apagado' : ''}` })),
    el('div', { className: 'acciones' },
      boton(c.activo === false ? 'Activar' : 'Apagar', 'sec', () => cambiarCodigo(async () => { await Datos.guardarCodigo({ ...c, activo: c.activo === false }); })),
      boton('Eliminar', 'sec', () => { if (confirm(`¿Eliminar el código ${c.id}?`)) cambiarCodigo(() => Datos.borrarCodigo(c.id)); })))) : [el('li', { className: 'cd', textContent: 'Todavía no hay códigos. Creá el primero arriba.' })]));
}
async function cambiarCodigo(accion) {
  try { await accion(); await cargarCodigos(); } catch (err) { if (err.autenticacion) salir(); aviso(err.message, true); }
}
$('#f-codigo').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#cd-error').textContent = '';
  try {
    const v = await Datos.guardarCodigo({ id: $('#cd-nombre').value, porcentaje: $('#cd-pct').value, vence: $('#cd-vence').value });
    $('#f-codigo').reset(); await cargarCodigos(); aviso(`Código ${v.id} creado`);
  } catch (err) { if (err.autenticacion) salir(); $('#cd-error').textContent = err.message; }
});
$('#pestanas').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-pestana]'); if (!b || b.dataset.pestana === pestana) return;
  pestana = b.dataset.pestana; sel.clear(); mostrar(true); pintar();
  if (pestana === 'codigos') { try { await cargarCodigos(); } catch (err) { aviso(err.message, true); } }
});

// ---------- Inicio ----------
if (DB.enabled() && DB.haySesion()) cargar().catch(() => salir()); else mostrar(false);
