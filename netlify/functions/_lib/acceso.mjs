// Quién puede entrar al panel: clave, límite de intentos por conexión y versión de las sesiones.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { ErrorHttp } from './comun.mjs';

const scrypt = promisify(crypto.scrypt);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const igual = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);

// ---- Clave: la que eligió la dueña desde el panel (guardada con scrypt) o, si nunca la cambió, la de Netlify (ADMIN_PASSWORD).
// La de Netlify siempre entra: es la llave de la desarrolladora por si la dueña olvida la suya.
export const claveEnv = (pass) => !!process.env.ADMIN_PASSWORD && igual(sha(pass), sha(process.env.ADMIN_PASSWORD));
export async function verificarClave(db, pass) {
  pass = String(pass ?? '').slice(0, 200);
  if (claveEnv(pass)) return true;
  const c = await db.getJSON('credenciales');
  return !!c && igual(await scrypt(pass, Buffer.from(c.salt, 'hex'), 64), Buffer.from(c.hash, 'hex'));
}
export async function guardarClave(db, nueva) {
  const salt = crypto.randomBytes(16);
  await db.setJSON('credenciales', { salt: salt.toString('hex'), hash: (await scrypt(String(nueva), salt, 64)).toString('hex'), fecha: Date.now() });
}

// ---- Límite de intentos: 5 por conexión cada 10 minutos. Se cuenta ANTES de mirar la clave y con escritura condicionada,
// así 30 intentos a la vez no se cuelan, y alguien desde otra conexión no puede bloquear a la dueña.
const MAX_INTENTOS = 5, VENTANA = 10 * 60e3;
export const ipDe = (req) => req.headers.get('x-nf-client-connection-ip') || 'sin-ip';   // lo pone Netlify: el visitante no puede falsearlo
const claveIntentos = (ip) => 'intentos/' + crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
export async function contarIntento(db, ip) {
  const k = claveIntentos(ip);
  for (let i = 0; i < 25; i++) {
    const { valor, etag } = await db.getDoc(k), ahora = Date.now();
    const v = valor && ahora - valor.desde < VENTANA ? valor : { n: 0, desde: ahora };
    if (v.n >= MAX_INTENTOS) throw new ErrorHttp('Demasiados intentos. Esperá 10 minutos y probá de nuevo.', 429);
    if (await db.setDocSi(k, { n: v.n + 1, desde: v.desde }, etag)) return;
  }
  throw new ErrorHttp('Demasiados intentos a la vez. Esperá un momento y probá de nuevo.', 429);
}
export const perdonar = (db, ip) => db.del(claveIntentos(ip));
export const esperarFallo = () => new Promise((r) => setTimeout(r, 800));

// ---- Versión de las sesiones
export const versionSesion = async (db) => (await db.getJSON('sesion'))?.v ?? 0;
export async function subirVersion(db) {
  for (let i = 0; i < 25; i++) {
    const { valor, etag } = await db.getDoc('sesion'), v = (valor?.v ?? 0) + 1;
    if (await db.setDocSi('sesion', { v }, etag)) return v;
  }
  throw new ErrorHttp('No se pudo cerrar las sesiones. Probá de nuevo.', 409);
}
