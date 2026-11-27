// Hace el trabajo pesado de las fotos fuera de la página.
importScripts('fotos.js');
self.onmessage = async (e) => {
  const { id, archivo, cortar } = e.data;
  try { self.postMessage({ id, ...(await self.procesarFoto(archivo, cortar)) }); }
  catch (err) { self.postMessage({ id, error: err.message }); }
};
