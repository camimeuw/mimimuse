/* ============ Conexión con Firebase (por su API web, sin librerías) ============
   La usan la tienda (solo lectura) y el panel /admin/ (lectura y escritura).
   Los datos de conexión se escriben en data/config.js → FIREBASE = { projectId, apiKey }.
   (host, authHost y tokenHost son para las pruebas: apuntan a un Firebase de mentira.)
*/
(() => {
  'use strict';
  const cfg = () => (typeof FIREBASE !== 'undefined' && FIREBASE) || {};
  const enabled = () => !!(cfg().projectId && cfg().apiKey);
  const ruta = () => `projects/${cfg().projectId}/databases/(default)/documents`;
  const base = () => `${cfg().host || 'https://firestore.googleapis.com'}/v1/${ruta()}`;
  const nombre = (col, id) => `${ruta()}/${col}/${id}`;

  /* ---- valores de Firestore ---- */
  const enc = (v) => {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
  };
  const dec = (v) => {
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
    if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
    return null;
  };
  const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]));
  const decDoc = (d) => {
    const o = { id: decodeURIComponent(d.name.split('/').pop()), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, dec(x)])) };
    Object.defineProperty(o, 'updateTime', { value: d.updateTime });   // sirve para no pisar un cambio ajeno (no se guarda)
    return o;
  };

  /* ---- sesión de la dueña (email + clave) ---- */
  const KEY = 'mimi-admin-sesion';
  let sesion = null;                          // { email, idToken, refreshToken, exp }
  try { sesion = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* sin almacenamiento: la sesión dura lo que la página */ }
  const guardarSesion = () => { try { sesion ? localStorage.setItem(KEY, JSON.stringify(sesion)) : localStorage.removeItem(KEY); } catch { /* nada */ } };
  const errorEntrar = (codigo) => {
    const c = String(codigo || '');
    if (/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|USER_NOT_FOUND/.test(c)) return 'El email o la clave no son correctos.';
    if (/TOO_MANY_ATTEMPTS/.test(c)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (/USER_DISABLED/.test(c)) return 'Esa cuenta está deshabilitada.';
    if (/INVALID_EMAIL/.test(c)) return 'El email no es válido.';
    if (/API key not valid|API_KEY_INVALID/i.test(c)) return 'La apiKey de Firebase no es válida: revisá data/config.js.';
    return 'No se pudo entrar (' + c + ').';
  };
  const identidad = async (ruta2, cuerpo) => {
    let r;
    try { r = await fetch(`${cfg().authHost || 'https://identitytoolkit.googleapis.com'}/v1/${ruta2}?key=${cfg().apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }); }
    catch { throw new Error('No hay conexión. Revisá tu internet y volvé a intentar.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(errorEntrar(j.error && j.error.message));
    return j;
  };
  async function entrar(email, clave) {
    const j = await identidad('accounts:signInWithPassword', { email, password: clave, returnSecureToken: true });
    sesion = { email: j.email || email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 };
    guardarSesion(); return sesion;
  }
  const vencida = () => Object.assign(new Error('Tu sesión venció. Volvé a entrar.'), { autenticacion: true });
  async function renovar() {
    if (!sesion || !sesion.refreshToken) throw vencida();
    let r;
    try { r = await fetch(`${cfg().tokenHost || 'https://securetoken.googleapis.com'}/v1/token?key=${cfg().apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(sesion.refreshToken)}` }); }
    catch { throw new Error('No hay conexión. Revisá tu internet y volvé a intentar.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { sesion = null; guardarSesion(); throw vencida(); }
    sesion = { email: sesion.email, idToken: j.id_token, refreshToken: j.refresh_token || sesion.refreshToken, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
    guardarSesion();
  }
  async function token() {
    if (!sesion) throw vencida();
    if (Date.now() > sesion.exp - 60000) await renovar();
    return sesion.idToken;
  }
  const salir = () => { sesion = null; guardarSesion(); };
  const recuperarClave = (email) => identidad('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email });

  /* ---- base de datos ---- */
  async function llamar(metodo, url, cuerpo, conSesion) {
    const headers = {}; if (cuerpo) headers['Content-Type'] = 'application/json';
    if (conSesion) headers.Authorization = 'Bearer ' + await token();
    let r;
    try { r = await fetch(url, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); }
    catch { throw new Error('No hay conexión con Firebase. Revisá tu internet y volvé a intentar.'); }
    if (r.status === 404 && metodo === 'GET') return null;
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const e = new Error(mensajeError(r.status, j.error));
      e.status = r.status; e.codigo = j.error && j.error.status;
      throw e;
    }
    return metodo === 'DELETE' ? {} : r.json();
  }
  function mensajeError(estado, error = {}) {
    const m = String(error.message || ''), c = String(error.status || '');
    if (estado === 403 || c === 'PERMISSION_DENIED') return 'Firebase no te dejó hacer eso. Revisá que entraste con el email de la dueña y que las reglas estén publicadas (docs/firebase.md).';
    if (estado === 400 && /API key/i.test(m)) return 'La apiKey de Firebase no es válida: revisá data/config.js.';
    if (/FAILED_PRECONDITION|ABORTED|ALREADY_EXISTS/.test(c)) return 'Alguien guardó cambios antes que vos. Recargá la página para ver lo último.';
    if (estado === 429 || c === 'RESOURCE_EXHAUSTED') return 'Se llegó al tope gratis de Firebase por hoy. Probá de nuevo mañana.';
    if (estado >= 500) return 'Firebase no respondió bien. Probá de nuevo en un minuto.';
    return m || 'Error ' + estado;
  }
  const clave = () => `key=${cfg().apiKey}`;
  async function lista(col, conSesion) {
    const out = []; let pagina = '';
    do {
      const j = await llamar('GET', `${base()}/${col}?pageSize=300&${clave()}${pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''}`, null, conSesion);
      if (!j) break;
      (j.documents || []).forEach((d) => out.push(decDoc(d))); pagina = j.nextPageToken || '';
    } while (pagina);
    return out;
  }
  async function leer(col, id, conSesion) { const j = await llamar('GET', `${base()}/${col}/${encodeURIComponent(id)}?${clave()}`, null, conSesion); return j ? decDoc(j) : null; }
  const guardar = (col, id, datos) => llamar('PATCH', `${base()}/${col}/${encodeURIComponent(id)}?${clave()}`, { fields: campos(datos) }, true);
  const borrar = (col, id) => llamar('DELETE', `${base()}/${col}/${encodeURIComponent(id)}?${clave()}`, null, true);
  // Varias escrituras juntas (todas o ninguna). Cada una: { update:{name,fields}, currentDocument:{updateTime|exists} } o { delete: name }
  const confirmar = (escrituras) => llamar('POST', `${base()}:commit?${clave()}`, { writes: escrituras }, true);

  /* ---- fotos: cada foto es un documento; se bajan de a una y se recuerdan en el dispositivo ---- */
  const enMemoria = new Map();
  const bd = () => new Promise((ok, mal) => {
    if (typeof indexedDB === 'undefined') return mal(new Error('sin indexedDB'));
    const a = indexedDB.open('mimi-fotos', 1);
    a.onupgradeneeded = () => a.result.createObjectStore('f');
    a.onsuccess = () => ok(a.result); a.onerror = () => mal(a.error);
  });
  const idb = async (modo, id, valor) => {
    try {
      const d = await bd();
      return await new Promise((ok) => {
        const t = d.transaction('f', modo === 'get' ? 'readonly' : 'readwrite'), s = t.objectStore('f');
        const q = modo === 'get' ? s.get(id) : s.put(valor, id);
        q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined);
      });
    } catch { return undefined; }
  };
  const fotoSrc = (id) => {
    if (!enMemoria.has(id)) {
      enMemoria.set(id, (async () => {
        const guardada = await idb('get', id);
        if (guardada) return guardada;
        const d = await leer('fotos', id);
        if (!d || !d.data) throw new Error('foto no encontrada');
        const src = `data:${d.tipo || 'image/webp'};base64,${d.data}`;
        idb('put', id, src);
        return src;
      })().catch((e) => { enMemoria.delete(id); throw e; }));
    }
    return enMemoria.get(id);
  };
  // Pone la foto en un <img> cuando llega (y lo marca si no se pudo)
  const pintarFoto = (img, id) => { fotoSrc(id).then((s) => { img.src = s; }).catch(() => { img.dataset.sinFoto = '1'; }); };
  const olvidarFoto = (id) => { enMemoria.delete(id); idb('put', id, undefined); };

  const DB = { enabled, enc, dec, campos, nombre, lista, leer, guardar, borrar, confirmar, entrar, salir, recuperarClave, token, fotoSrc, pintarFoto, olvidarFoto, sesion: () => sesion, haySesion: () => !!sesion };
  (typeof window !== 'undefined' ? window : globalThis).DB = DB;
})();
