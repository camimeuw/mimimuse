# Panel de productos

Página para que la clienta cargue y edite sus productos sin tocar código: **`/admin/`** (por ejemplo `https://tu-sitio.netlify.app/admin/`).

## Qué puede hacer
- Crear, editar, ocultar y eliminar productos.
- Categoría y subcategoría **libres** (escribe cualquiera; "Remeras" y "remeras" se unifican solas). Puede renombrar una categoría o subcategoría en todos los productos a la vez.
- Precio, precio anterior (oferta), descripción, talles, colores y hasta 8 fotos (la 1ª es la principal, la 2ª sale al pasar el mouse).
- Marcar **talles agotados** (tocando el talle) o el producto entero como **agotado**, en un clic desde la lista.
- Descargar una copia de seguridad (JSON).

Las fotos se achican solas en el navegador (máx. 1100 px, WEBP con transparencia) antes de subirse. Si la foto tiene fondo blanco, el panel lo **quita solo** (casilla marcada por defecto; método del panel de Bunny Club: se queda con la prenda más grande, suaviza el borde y recorta). Si la foto ya es PNG transparente, no la toca.

**Orden:** cada producto tiene botones ▲ ▼ y "Primero"; el orden de la lista es el orden en la tienda.

## Dejarlo andando en Netlify (una sola vez)
1. En Netlify: **Site configuration → Environment variables** y crear `ADMIN_PASSWORD` con la clave de la clienta (larga: 12 caracteres o más). Opcional: `ADMIN_SECRET` con cualquier texto largo al azar (firma las sesiones; si no está, usa la clave).
2. Volver a desplegar el sitio. Netlify instala `@netlify/blobs` (ahí se guardan productos y fotos, sin cuentas extra) y publica las funciones de `netlify/functions/`.
3. Entrar a `/admin/` con la clave.

Si cambiás la clave, las sesiones abiertas dejan de servir y hay que volver a entrar.

## Probarlo en tu compu
```bash
npm install
npm run dev      # http://localhost:8888 · panel en /admin/ · clave: demo
npm test         # pruebas del servidor
```
Guarda en la carpeta `.almacen-local/` (no se sube al repositorio).

## Cómo se conecta con la tienda
- La tienda lee `GET /api/productos` (solo productos visibles). Si no hay servidor (por ejemplo abriendo `index.html` como archivo) usa los de ejemplo de `data/productos.js`.
- Los cambios del panel tardan hasta 30 segundos en verse en la tienda (caché).
- Un producto cuenta como agotado si se marca entero o si todos sus talles están agotados.

## Límites a tener presentes
- Un solo usuario (una clave). Si dos personas editan a la vez, la segunda recibe un aviso y tiene que recargar.
- Después de 5 claves incorrectas el panel se bloquea 10 minutos (y cada intento fallido espera 0,8 s). Igual conviene una clave larga.
- Máximo 1000 productos y 1,5 MB por foto.

## ¿Netlify Blobs o Firebase?
Se eligió **Netlify Blobs** para Mimi Muse:

| | Netlify Blobs (este panel) | Firebase (como Bunny Club) |
|---|---|---|
| Cuentas | ninguna extra (el sitio ya está en Netlify) | proyecto de Firebase por clienta |
| Lecturas de la tienda | 1 pedido por visita (todos los productos en un solo archivo) | 1 lectura de documento por producto y por visita |
| Tope gratis | créditos mensuales de Netlify (el plan gratis trae 300; no verificado cuánto consume Blobs) | Spark: 1 GiB, 50.000 lecturas/día, 20.000 escrituras/día; al pasarse, ese producto se apaga el resto del mes |
| Fotos | se sirven por una función con caché de 1 año en el CDN | dentro de documentos (máx. 1 MiB cada uno) |
| Inicio de sesión | una clave + bloqueo por intentos | usuarios con email, bloqueo propio de Google |

Firebase gana en el inicio de sesión (email y varias personas) y en poder ver los datos en su consola. Si hace falta más adelante, solo hay que cambiar `netlify/functions/_lib/almacen.mjs` (y el inicio de sesión).
