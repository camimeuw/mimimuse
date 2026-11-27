// Procesado de fotos: achicar, quitar el fondo blanco y hacer la miniatura.
// Corre en un Worker (para que la página no se trabe con muchas fotos); si el navegador no puede, corre en la página.
// El método de quitar fondo es el del panel de Bunny Club: se queda con la prenda más grande y suaviza el borde.
(function (g) {
  const enWorker = typeof document === 'undefined';
  const lienzo = (w, h) => (enWorker ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const ctx = (c) => c.getContext('2d', { willReadFrequently: true });
  const aBlob = (c, calidad) => (enWorker ? c.convertToBlob({ type: 'image/webp', quality: calidad }) : new Promise((ok) => c.toBlob(ok, 'image/webp', calidad)));

  function achicado(src, max) {
    const s = Math.min(1, max / Math.max(src.width, src.height)), w = Math.max(1, Math.round(src.width * s)), h = Math.max(1, Math.round(src.height * s));
    const c = lienzo(w, h); ctx(c).drawImage(src, 0, 0, w, h); return c;
  }
  function tieneAlfa(c) {
    const d = ctx(c).getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 12) if (d[i] < 250) return true;
    return false;
  }
  function opacoPct(c) {                       // qué parte de la imagen quedó visible (0 a 1)
    const d = ctx(c).getImageData(0, 0, c.width, c.height).data; let n = 0, t = 0;
    for (let i = 3; i < d.length; i += 12) { t++; if (d[i] > 128) n++; }
    return t ? n / t : 0;
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
    const w = c.width, h = c.height, n = w * h, cx = ctx(c), im = cx.getImageData(0, 0, w, h), d = im.data;
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
    cx.putImageData(im, 0, 0);
    let x0 = w, y0 = h, x1 = 0, y1 = 0;                            // recorta los bordes transparentes
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return c;
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04), o = lienzo(x1 - x0 + 1 + pad * 2, y1 - y0 + 1 + pad * 2);
    ctx(o).drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
    return o;
  }

  // Devuelve { foto, mini, aviso }: la foto (máx. 1100 px) y la miniatura (máx. 360 px) en WEBP, que mantiene la transparencia
  async function procesarFoto(archivo, cortar) {
    const bmp = await createImageBitmap(archivo).catch(() => { throw new Error('no es una imagen válida'); });
    const original = achicado(bmp, 1100);
    let c = original, aviso = '';
    if (cortar && !tieneAlfa(original)) {
      const copia = achicado(original, 1100);
      c = quitarFondo(copia);
      if (opacoPct(c) < 0.1) { c = original; aviso = 'no se pudo separar la prenda del fondo, se subió sin quitarlo'; }   // la prenda "desapareció": mejor dejarla como estaba
    }
    let blob, max = 1100;
    for (let t = 0; t < 4; t++) {                                  // si pesa mucho, se achica más
      blob = await aBlob(t === 0 ? c : achicado(c, max), 0.88);
      if (blob.size < 550 * 1024) break;            // Firebase guarda hasta 1 MB por documento (la foto va en base64: pesa 1/3 más)
      max = Math.round(max * 0.8);
    }
    if (blob.size > 700 * 1024) throw new Error('la foto es demasiado pesada');
    return { foto: blob, mini: await aBlob(achicado(c, 360), 0.8), aviso };
  }
  g.procesarFoto = procesarFoto;
})(typeof self !== 'undefined' ? self : globalThis);
