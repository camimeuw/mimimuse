// Público: la tienda lee de acá los productos visibles (también desde otro sitio: son datos públicos y de solo lectura).
import { almacen } from './_lib/almacen.mjs';
import { json } from './_lib/comun.mjs';

export default async () => {
  const doc = (await (await almacen()).getJSON('productos')) || { rev: 0, items: [] };
  return json({ rev: doc.rev, items: doc.items.filter((p) => p.activo) }, 200, { 'cache-control': 'public, max-age=30', 'access-control-allow-origin': '*' });
};
export const config = { path: '/api/productos' };
