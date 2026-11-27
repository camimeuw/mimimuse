# Panel de productos

Página para que la clienta cargue y edite sus productos sin tocar código: **`/admin/`** (por ejemplo `https://tu-sitio.netlify.app/admin/`).

## Qué puede hacer
- Crear, editar, ocultar y eliminar productos.
- Categoría y subcategoría **libres** (escribe cualquiera; "Remeras" y "remeras" se unifican solas). Puede renombrar una categoría o subcategoría en todos los productos a la vez.
- Precio, precio anterior (oferta), descripción, talles, colores y hasta 8 fotos (la 1ª es la principal, la 2ª sale al pasar el mouse).
- Marcar **talles agotados** (tocando el talle) o el producto entero como **agotado**, en un clic desde la lista.
- Descargar una copia de seguridad (JSON).

Las fotos se achican solas en el navegador (máx. 1100 px, WEBP con transparencia) antes de subirse.

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
- La clave no tiene bloqueo por intentos (solo una espera de 0,8 s por intento fallido): usar una clave larga.
- Máximo 1000 productos y 1,5 MB por foto.
