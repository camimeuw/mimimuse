# Panel de productos (`/admin/`)

Guarda en Firebase (ver `docs/firebase.md`). Pensado para una persona que carga productos desde el celular o la compu.

## Qué puede hacer
- **Productos:** agregar, editar, duplicar, eliminar, ocultar y marcar agotado; talles (con talles agotados) y colores; hasta 8 fotos con el fondo blanco quitado solo; categoría y subcategoría; precio y precio anterior (oferta); orden (▲ ▼ y «Primero»).
- **Varios a la vez:** marcar productos (o todos los que coinciden con una búsqueda) y cambiar agotado/stock, ocultar/mostrar, categoría, oferta (%) o eliminar. Renombrar una categoría cambia todos los productos que la usan.
- **Planilla (Excel):** botón «Planilla (Excel)» para cargar o actualizar muchos productos con un CSV (columnas `nombre` y `precio` obligatorias; las demás opcionales; las fotos se buscan por nombre de archivo). «Bajar mis productos» baja la lista actual para editarla y volver a subirla.
- **Códigos de descuento:** pestaña «Códigos de descuento». Se crea un nombre (por ejemplo `HOLA10`), un porcentaje y, si se quiere, una fecha de vencimiento. Se pueden apagar, prender y eliminar. En la tienda se escriben en el carrito, o llegan por link: `…/?codigo=HOLA10` lo aplica solo.
- **Entrar:** email y clave (Firebase). «Olvidé mi clave» manda un mail.

No hay «Volver atrás»: eliminar y los cambios en varios productos no se pueden deshacer. «Descargar copia» baja un JSON con los productos (sin las fotos).

## Cómo funciona por dentro
- `catalogo/admin` (solo la dueña lo lee): todos los productos. `catalogo/publico`: solo los visibles; es lo que lee la tienda (1 lectura por visita). Los dos se escriben juntos o ninguno.
- Cada foto es un documento `fotos/<id>` (foto grande y miniatura). La tienda baja las fotos de a una y las recuerda en el dispositivo.
- Si alguien cambió los productos desde otro dispositivo mientras tanto, el panel avisa («Alguien guardó cambios antes que vos») en vez de pisarlos.
- Las fotos que ya no usa ningún producto se borran solas. Si se cierra el editor sin guardar, también se borran las que se habían subido.
- Código: `js/firebase.js` (conexión), `admin/datos.js` (productos, fotos y cupones), `admin/admin.js` (pantalla), `admin/fotos.js` + `foto-worker.js` (fotos en segundo plano), `admin/csv.js` (planilla).

## La tienda
- `js/productos.js` lee `catalogo/publico`; si falla, muestra la última lista que vio en ese dispositivo.
- `js/carrito.js` + `js/pedido.js`: carrito, cupón, totales y el mensaje de WhatsApp. Antes de pedir se vuelve a mirar cada producto: si ya no está o se agotó, no entra al pedido.

## Probar en tu compu
```bash
npm run dev      # http://localhost:8888  (la tienda) y /admin/ (el panel)
npm test         # pruebas
npm run falso    # un Firebase de mentira en el puerto 8110 (para pruebas)
```
`npm test` prueba la limpieza de productos, las cuentas del pedido y todo el recorrido contra un Firebase de mentira (`dev/firebase-falso.mjs`) que imita el inicio de sesión, Firestore y las reglas de `firestore.rules`.
