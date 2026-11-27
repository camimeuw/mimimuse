// Copia diaria de los productos (aparte de las 30 versiones): sirve si un error se descubre días después.
export const MAX_RESPALDOS = 14;
const diaDe = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
export const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function hacerRespaldo(db) {
  const doc = await db.getJSON('productos');
  if (!doc?.items?.length) return { hecho: false, motivo: 'no hay productos' };
  const dias = (await db.keys('rmeta/')).sort();
  if (dias.length && (await db.getJSON(dias.at(-1)))?.rev === doc.rev) return { hecho: false, motivo: 'sin cambios desde la última copia' };
  const dia = diaDe();
  await db.setJSON('respaldo/' + dia, doc);
  await db.setJSON('rmeta/' + dia, { dia, fecha: Date.now(), rev: doc.rev, cantidad: doc.items.length });
  for (const k of (await db.keys('rmeta/')).sort().reverse().slice(MAX_RESPALDOS)) { await db.del(k); await db.del(k.replace('rmeta/', 'respaldo/')); }
  return { hecho: true, dia, rev: doc.rev, cantidad: doc.items.length };
}
export const listaRespaldos = async (db) => (await Promise.all((await db.keys('rmeta/')).sort().reverse().map((k) => db.getJSON(k)))).filter(Boolean);
