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

4. La dueña puede cambiar su clave desde el panel (botón **Seguridad**). Ahí se guarda solo su *hash* (scrypt, con sal), nunca la clave. La clave de `ADMIN_PASSWORD` **sigue sirviendo siempre**: es la llave de la desarrolladora por si la dueña olvida la suya (se entra con esa y se pone una nueva). Si no querés ese acceso, no la compartas y usá `ADMIN_SECRET` aparte.
5. Las **copias diarias** las hace la función programada `netlify/functions/respaldo.mjs` (`@daily`). Netlify las programa solo al desplegar; se ven en Netlify → **Logs → Functions**.

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

## Miniaturas y lista liviana
- Al subir una foto, el panel genera la foto (máx. 1100 px) **y una miniatura** (máx. 360 px). La lista del panel y las tarjetas de la tienda usan la miniatura; la foto grande se carga solo al abrir el producto. Los productos cargados antes de este cambio siguen funcionando con la foto grande (sin miniatura).
- La lista del panel dibuja de a 30 productos ("Ver más") y carga las fotos de a poco; "seleccionar" toma todos los que coinciden con la búsqueda, se vean o no.

## Cargar muchos productos sin que se trabe
- **Guardados chicos:** cada acción manda solo lo que cambió (`accion: cambios` con operaciones `poner` / `quitar` / `orden`), no los 200 productos. Medido con 200 productos: un cambio pasó de ~97 KB de ida y ~97 KB de vuelta a **0,5 KB y 1,1 KB**. El servidor valida igual que antes (limpieza, `rev`, versiones, lista vacía) y la lista del panel se rearma con la respuesta; si no coincidiera, la vuelve a pedir.
- **Fotos en segundo plano:** achicar, quitar el fondo y hacer la miniatura corre en un *Web Worker* (`admin/foto-worker.js` + `admin/fotos.js`); la página sigue respondiendo. Si el navegador no permite Workers, se hace en la propia página (más lento y la pantalla puede quedar quieta unos segundos por foto). Si al quitar el fondo la prenda "desaparece" (casi nada queda visible), se sube la foto sin quitarlo y avisa.
- **Planilla (botón «Planilla (Excel)»):** baja una planilla de ejemplo o *mis productos*; se completa en Excel/Google Sheets y se guarda como **CSV**. Columnas: `id`, `nombre`, `precio`, `precio_anterior`, `categoria`, `subcategoria`, `descripcion`, `talles`, `talles_agotados`, `colores`, `agotado`, `visible`, `fotos`, `miniaturas` (varios valores separados con `|`; las columnas que falten no se tocan). Solo `nombre` y `precio` son obligatorias. Acepta coma o punto y coma, precios con coma o punto (`59,90`), comillas, saltos de línea dentro de una celda y los CSV en ANSI que genera Excel en español.
  - **Nuevos y cambios:** una fila **sin id** crea un producto; una fila **con el id** de un producto existente lo actualiza (para cambiar muchos precios: «Bajar mis productos», editar, volver a subir). Las filas con errores se listan con su número y no se importan; las demás sí.
  - **Fotos:** se escriben los nombres de archivo en la columna `fotos` (`remera-1.jpg | remera-2.jpg`), se eligen todas juntas y se buscan por nombre (sin distinguir mayúsculas). Se procesan de a dos, con barra de progreso y botón **Cancelar** (si se cancela no cambia ningún producto). Las fotos que faltan se avisan y esos productos se importan sin ellas.
  - **Un solo guardado al final**, con «Deshacer» y entrada en «Volver atrás». Si alguien guardó mientras se subían las fotos, se rearma sobre la lista nueva y se reintenta una vez.
- Máximo 500 filas por planilla (si hay más, dividirla).

## Lo que ven las compradoras
- **Filtros:** buscador y botones por categoría, subcategoría y "En oferta". Salen solos de lo que cargó la dueña.
- **Popup del producto** (al tocar una tarjeta): fotos, categoría, precio (con el anterior tachado y el %), descripción, talles (los agotados tachados y marcados "agotado" para lectores de pantalla) y colores. Se cierra con la X, Esc o tocando afuera.
- Etiqueta **-20%** en la tarjeta cuando hay oferta (o "Agotado" si no hay stock).

## Volver atrás, varios productos a la vez y ofertas
- **Volver atrás:** cada cambio guarda cómo estaba antes (los últimos 30). Después de eliminar o de una acción en varios productos aparece **Deshacer** durante 10 segundos, y el botón **Volver atrás** lista los cambios para volver a cualquiera ("Antes de: Eliminó «Falda»"). Volver atrás también queda como un cambio: se puede recuperar. Las fotos (y miniaturas) no se borran mientras las use algún producto o alguna de esas 30 versiones. Cada versión se guarda en su propia entrada (`ver/…`, `vmeta/…`), sin un índice compartido que se pueda pisar.
- **Lista vacía:** si un guardado dejaría la tienda sin productos, el servidor lo rechaza salvo que se confirme (eliminar el último producto o "Eliminar" a todos).
- **Duplicar:** abre el editor con una copia (mismas fotos) para cambiarle nombre y datos; no se guarda hasta apretar Guardar.
- **Varios a la vez:** se marcan productos (o "seleccionar todos los que se ven" tras buscar o filtrar) y aparece una barra: agotado / hay stock, ocultar / mostrar, cambiar categoría, oferta y eliminar.
- **Oferta:** un producto está en oferta si su *precio anterior* es mayor que el precio. "Oferta…" aplica un % (el precio actual pasa a ser el anterior; si ya había oferta, se calcula sobre el anterior) y "Quitar oferta" lo deja como estaba. El servidor rechaza un precio anterior menor o igual al precio.

## Para que no se pierda nada al guardar
- El servidor guarda con **escritura condicionada** (`onlyIfMatch` de Netlify Blobs) y lee con **consistencia fuerte**: si dos guardados se cruzan, entra uno y el otro recibe un aviso (409) en vez de pisarlo.
- Mientras se guarda, los botones del panel quedan apagados (un doble toque no manda dos guardados) y no se puede guardar un producto con una foto subiéndose.
- Sin internet o con el servidor caído, el panel avisa en español y **no pierde lo escrito** en el editor.
- La tienda guarda la última lista que vio bien: si el servidor falla, muestra esa; si nunca vio ninguna, muestra "No pudimos cargar los productos" con un botón Reintentar. Los productos de ejemplo solo se ven al abrir `index.html` como archivo. Un producto sin foto muestra la mona.

## Seguridad
- **Intentos de clave:** máximo 5 cada 10 minutos **por conexión** (IP, la que informa Netlify en `x-nf-client-connection-ip`; no se puede falsear con otras cabeceras). El intento se cuenta *antes* de mirar la clave y con escritura condicionada: 30 intentos a la vez dejan pasar exactamente 5 (los otros 25 reciben 429). Alguien desde otra conexión **no** puede bloquear a la dueña. Una entrada buena borra los intentos. Cambiar la clave también cuenta los intentos fallidos (una sesión robada no puede adivinar la clave actual).
- **Sesiones:** el token lleva su vencimiento y una *versión*. «Cerrar todas las sesiones» y cambiar la clave suben la versión: los tokens anteriores dejan de servir, también los de «Recordarme» (30 días, guardados en el dispositivo; sin eso, 12 horas y solo en la pestaña). Los tokens manipulados, vencidos o del formato anterior dan 401.
- **Clave:** pantalla de entrada con «Mostrar la clave»; la clave nueva pide 10 caracteres o más.
- **Cabeceras (`netlify.toml`):** `Content-Security-Policy` (scripts, conexiones y workers solo del propio sitio; nada de scripts en línea ni `eval`; sin `unsafe-inline` en scripts), `X-Frame-Options: DENY` y `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS. Para poder aplicarlo, el script de la intro pasó de la página a `js/intro.js`. Los estilos en línea siguen permitidos (la tienda usa `style="…"` en los dibujitos). Las respuestas de `/api/…` llevan `nosniff` (Netlify no aplica `[[headers]]` a las funciones).
- Comprobado con Playwright contra el CSP real (`npm run dev` aplica las cabeceras de `netlify.toml`): ni la tienda ni el panel dan violaciones, y un script inyectado, un `fetch` y una imagen a otro dominio quedan bloqueados.

## Copias diarias
- Cada día se guarda una copia completa de los productos (`respaldo/AAAA-MM-DD`) y se conservan las últimas 14; si no hubo cambios desde la última, no se repite. Se ven en **Volver atrás → Copias de cada día**; «Volver a esta copia» restaura y queda como un cambio más (se puede deshacer). Las fotos de las copias no se borran. Aparte de las 30 versiones, que se gastan con cada cambio, estas sirven si un error se descubre varios días después.
- No incluye las fotos como archivos: las fotos se conservan mientras alguna copia las use. **Descargar copia** sigue bajando un JSON con los productos.

## Límites a tener presentes
- Un solo usuario (una clave). Si dos personas editan a la vez, la segunda recibe un aviso y tiene que recargar.
- El bloqueo es por conexión: varias personas detrás de la misma conexión (misma oficina) comparten los 5 intentos.
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
