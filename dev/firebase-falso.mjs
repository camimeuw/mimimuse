// Un Firebase de mentira para probar el panel y la tienda sin internet ni cuenta (solo para pruebas).
// Imita lo que usa el panel: inicio de sesión con email, Firestore (leer, listar, guardar, borrar y "commit" con condiciones)
// y las reglas de seguridad de firestore.rules: todos leen un documento (menos catalogo/admin), solo la dueña lista fotos y cupones, y solo ella escribe.
import http from 'node:http';
import { fileURLToPath } from 'node:url';

export const DUENA = { email: 'duena@mimimuse.test', clave: 'clave-demo-123' };
export const API_KEY = 'test-key';
const DOCS = '/v1/projects/mimimuse-test/databases/(default)/documents';

export function crear() {
  const docs = new Map();            // "col/id" -> { fields, createTime, updateTime }
  const tokens = new Map();          // idToken -> email
  const estado = { n: 0, mails: [], escrituras: 0, lecturas: 0, caido: false };
  const hora = () => `${new Date().toISOString().slice(0, 19)}.${String(++estado.n).padStart(6, '0')}Z`;
  const nombre = (k) => `projects/mimimuse-test/databases/(default)/documents/${k}`;
  const ver = (k, d) => ({ name: nombre(k), fields: d.fields, createTime: d.createTime, updateTime: d.updateTime });
  const error = (res, status, codigo, mensaje) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: status, message: mensaje || codigo, status: codigo } })); };
  const enviar = (res, cuerpo, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(cuerpo)); };
  const nuevoToken = (email) => { const t = `tok${++estado.n}`; tokens.set(t, email); return t; };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x'); const partes = []; for await (const c of req) partes.push(c);
      const cuerpo = Buffer.concat(partes).toString();
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
      if (estado.caido) return error(res, 503, 'UNAVAILABLE', 'caído');
      if (url.searchParams.get('key') !== API_KEY) return error(res, 400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.');

      // ---- Inicio de sesión
      if (url.pathname === '/v1/accounts:signInWithPassword') {
        const b = JSON.parse(cuerpo);
        if (b.email !== DUENA.email || b.password !== DUENA.clave) return error(res, 400, 'INVALID_ARGUMENT', 'INVALID_LOGIN_CREDENTIALS');
        return enviar(res, { email: b.email, idToken: nuevoToken(b.email), refreshToken: 'refresco-1', expiresIn: String(estado.expiresIn ?? 3600) });
      }
      if (url.pathname === '/v1/accounts:sendOobCode') { estado.mails.push(JSON.parse(cuerpo)); return enviar(res, { email: JSON.parse(cuerpo).email }); }
      if (url.pathname === '/v1/token') {
        if (!/refresh_token=refresco-1/.test(cuerpo)) return error(res, 400, 'INVALID_ARGUMENT', 'INVALID_REFRESH_TOKEN');
        return enviar(res, { id_token: nuevoToken(DUENA.email), refresh_token: 'refresco-1', expires_in: '3600' });
      }

      // ---- Firestore (con las reglas de firestore.rules)
      if (!url.pathname.startsWith(DOCS)) return error(res, 404, 'NOT_FOUND');
      const email = tokens.get((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      const duena = email === DUENA.email;
      const resto = decodeURIComponent(url.pathname.slice(DOCS.length)).replace(/^\//, '');
      const puedeLeer = (k) => k !== 'catalogo/admin' || duena;
      const puedeEscribir = () => duena;

      if (resto === ':commit' && req.method === 'POST') {
        const { writes = [] } = JSON.parse(cuerpo);
        const clave = (n) => n.split('/documents/')[1];
        for (const w of writes) {
          const k = clave(w.update ? w.update.name : w.delete);
          if (!puedeEscribir()) return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
          const d = docs.get(k), c = w.currentDocument;
          if (c && c.exists === false && d) return error(res, 409, 'ALREADY_EXISTS', 'Document already exists');
          if (c && c.updateTime && (!d || d.updateTime !== c.updateTime)) return error(res, 400, 'FAILED_PRECONDITION', 'The precondition failed');
        }
        const resultados = [];
        for (const w of writes) {
          const t = hora();
          if (w.update) { const k = clave(w.update.name), d = docs.get(k); docs.set(k, { fields: w.update.fields || {}, createTime: d ? d.createTime : t, updateTime: t }); estado.escrituras++; resultados.push({ updateTime: t }); }
          else { docs.delete(clave(w.delete)); estado.escrituras++; resultados.push({ updateTime: t }); }
        }
        return enviar(res, { writeResults: resultados, commitTime: hora() });
      }

      const [col, id] = resto.split('/');
      if (req.method === 'GET' && col && !id) {
        if (!duena && (['fotos', 'codigos'].includes(col) || [...docs.keys()].some((k) => k.startsWith(col + '/') && !puedeLeer(k)))) return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');   // la lista de fotos y cupones es solo de la dueña
        const lista = [...docs.entries()].filter(([k]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/')).map(([k, d]) => ver(k, d));
        estado.lecturas += lista.length;
        return enviar(res, lista.length ? { documents: lista } : {});
      }
      if (req.method === 'GET' && id) {
        if (!puedeLeer(`${col}/${id}`)) return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
        const d = docs.get(`${col}/${id}`); if (!d) return error(res, 404, 'NOT_FOUND');
        estado.lecturas++; return enviar(res, ver(`${col}/${id}`, d));
      }
      if (req.method === 'PATCH' && id) {
        if (!puedeEscribir()) return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
        const t = hora(), d = docs.get(`${col}/${id}`), nuevo = { fields: JSON.parse(cuerpo).fields || {}, createTime: d ? d.createTime : t, updateTime: t };
        if (JSON.stringify(nuevo.fields).length > 1_050_000) return error(res, 400, 'INVALID_ARGUMENT', 'Document too large');
        docs.set(`${col}/${id}`, nuevo); estado.escrituras++; return enviar(res, ver(`${col}/${id}`, nuevo));
      }
      if (req.method === 'DELETE' && id) {
        if (!puedeEscribir()) return error(res, 403, 'PERMISSION_DENIED', 'Missing or insufficient permissions.');
        docs.delete(`${col}/${id}`); estado.escrituras++; return enviar(res, {});
      }
      return error(res, 404, 'NOT_FOUND');
    } catch (e) { console.error(e); error(res, 500, 'INTERNAL', String(e.message)); }
  });
  server.docs = docs; server.estado = estado; server.tokens = tokens;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = process.env.PORT || 8110;
  crear().listen(puerto, () => console.log(`Firebase de mentira en http://localhost:${puerto}  (dueña: ${DUENA.email} / ${DUENA.clave}, apiKey: ${API_KEY})`));
}
