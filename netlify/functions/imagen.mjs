// Público: sirve las fotos subidas desde el panel.
import { almacen } from './_lib/almacen.mjs';
import { RE_IMG } from './_lib/comun.mjs';

export default async (req) => {
  const ruta = new URL(req.url).pathname;
  const m = RE_IMG.exec(ruta);
  const img = m && (await (await almacen()).getBin('img/' + m[1]));
  if (!img) return new Response('No encontrada', { status: 404 });
  return new Response(img.data, { headers: { 'content-type': img.tipo, 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=31536000, immutable', 'netlify-cdn-cache-control': 'public, max-age=31536000, immutable' } });
};
export const config = { path: '/api/imagen/*' };
