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
  document.querySelectorAll('#panel button, #panel input, #editor button, #d-ren button, #d-masiva button, #d-ver button, #masivo button, #salir').forEach((b) => {
    if (on) { b.dataset.estaba = b.disabled ? '1' : ''; b.disabled = true; } else { b.disabled = b.dataset.estaba === '1'; delete b.dataset.estaba; }
  });
}
// nota = qué se cambió (queda en "Volver atrás"); deshacer = muestra el botón "Deshacer" 10 s; vacio = confirma que la lista puede quedar vacía
async function guardarTodo(msg, { nota = '', deshacer = false, vacio = false } = {}) {
  if (ocupado) throw new Error('Todavía se está guardando. Esperá un momento.');
  ocupado = true; bloquear(true); aviso('Guardando…');
  try {
    const d = await api('guardar', { rev, items, nota, confirmarVacio: vacio });
    const anterior = rev; rev = d.rev; items = d.items;
    if (msg) aviso(msg, false, deshacer ? { texto: 'Deshacer', hacer: () => volverA(anterior) } : null);
  } finally { ocupado = false; bloquear(false); pintar(); }
}
// Vuelve a la versión guardada antes de un cambio (el cambio queda como otra versión: también se puede recuperar)
async function volverA(version) {
  if (ocupado) return;
  ocupado = true; bloquear(true); aviso('Volviendo atrás…');
  try {
    const d = await api('restaurar', { rev, version });
    rev = d.rev; items = d.items; aviso('Listo: volvió a como estaba.');
    return true;
  } catch (err) { aviso(err.message, true); }
  finally { ocupado = false; bloquear(false); pintar(); }
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
  $('#lista').replaceChildren(...vistos.map((p, k) => fila(p, vistos, k)));
  $('#todos').checked = vistos.length > 0 && vistos.every((p) => sel.has(p.id));
  $('#masivo').hidden = !sel.size;
  $('#m-cuantos').textContent = `${sel.size} seleccionado${sel.size === 1 ? '' : 's'}`;
}

function fila(p, vistos, k) {
  const i = items.indexOf(p);
  const foto = p.imgs[0] ? el('img', { src: p.imgs[0], alt: '' }) : el('div', { className: 'sinfoto', textContent: 'sin foto' });
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
  try { await guardarTodo('Guardado', { nota: `${que} «${p.nombre}»` }); } catch (err) { Object.assign(p, antes); pintar(); aviso(err.message, true); }
}
// El orden de la lista es el orden en la tienda
async function reordenar(nuevo) {
  const antes = items; items = nuevo;
  try { await guardarTodo('Orden guardado', { nota: 'Cambió el orden' }); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
function mover(p, vecino) {
  const copia = items.slice(), a = copia.indexOf(p), b = copia.indexOf(vecino);
  [copia[a], copia[b]] = [copia[b], copia[a]];
  return reordenar(copia);
}
async function eliminar(p) {
  if (!confirm(`¿Eliminar "${p.nombre}"? Después vas a poder deshacerlo con el botón "Deshacer" o desde "Volver atrás".`)) return;
  const antes = items;
  items = items.filter((x) => x !== p);
  try { await guardarTodo('Producto eliminado.', { nota: `Eliminó «${p.nombre}»`, deshacer: true, vacio: !items.length }); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
}
$('#buscar').addEventListener('input', pintar);
$('#f-cat').addEventListener('change', pintar);

// ---------- Varios productos a la vez ----------
$('#todos').addEventListener('change', (e) => { for (const p of visibles()) e.target.checked ? sel.add(p.id) : sel.delete(p.id); pintar(); });
$('#m-quitar').addEventListener('click', () => { sel.clear(); pintar(); });
async function masivo(cambia, nota, msg) {
  const antes = structuredClone(items), n = marcados().length;
  marcados().forEach(cambia);
  try { await guardarTodo(`${msg} (${n})`, { nota: `${nota} en ${n} producto${n === 1 ? '' : 's'}`, deshacer: true }); sel.clear(); pintar(); }
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
    if (!confirm(`¿Eliminar ${n} producto${n === 1 ? '' : 's'}? Después vas a poder deshacerlo.`)) return;
    const antes = items; items = items.filter((p) => !sel.has(p.id));
    guardarTodo(`Eliminados (${n})`, { nota: `Eliminó ${n} producto${n === 1 ? '' : 's'}`, deshacer: true, vacio: !items.length }).then(() => { sel.clear(); pintar(); }, (err) => { items = antes; pintar(); aviso(err.message, true); });
  }
});

// ---------- Volver atrás ----------
$('#versiones').addEventListener('click', async () => {
  try {
    const { versiones } = await api('versiones');
    $('#v-lista').replaceChildren(...(versiones.length ? versiones.map((v) => {
      const b = el('button', { type: 'button', textContent: 'Volver a esta' });
      b.addEventListener('click', async () => {
        if (!confirm(`¿Volver a como estaba ANTES de: ${v.nota}?\n\nLo que hiciste después también queda guardado: lo podés recuperar desde esta misma lista.`)) return;
        if (await volverA(v.rev)) $('#d-ver').close();
      });
      return el('li', {}, el('div', {}, el('strong', { textContent: `Antes de: ${v.nota}` }), el('small', { textContent: `${new Date(v.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })} · ${v.cantidad} productos` })), b);
    }) : [el('li', {}, 'Todavía no hay versiones anteriores.')]));
    $('#d-ver').showModal();
  } catch (err) { aviso(err.message, true); }
});
$('#v-cerrar').addEventListener('click', () => $('#d-ver').close());

// ---------- Editor ----------
const vacio = () => ({ id: null, nombre: '', precio: '', precioAntes: '', cat: '', sub: '', desc: '', talles: [], tallesAgotados: [], colores: [], agotado: false, activo: true, imgs: [] });

function abrirEditor(i, base = null) {
  editandoIdx = i;
  edit = base ? structuredClone(base) : i < 0 ? vacio() : structuredClone(items[i]);
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
  try { await guardarTodo('Producto guardado', { nota: `${editandoIdx < 0 ? 'Creó' : 'Editó'} «${edit.nombre}»` }); $('#editor').close(); }
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
  try { await guardarTodo('Nombre cambiado', { nota: `Renombró «${sub || cat}» a «${nuevo}»` }); $('#d-ren').close(); } catch (err) { items = antes; pintar(); aviso(err.message, true); }
});

// ---------- Copia de seguridad ----------
$('#copia').addEventListener('click', () => {
  const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ fecha: new Date().toISOString(), items }, null, 2)], { type: 'application/json' })), download: `mimimuse-productos-${new Date().toISOString().slice(0, 10)}.json` });
  a.click(); URL.revokeObjectURL(a.href);
});

// ---------- Inicio ----------
if (token) cargar().catch(() => salir()); else mostrar(false);
