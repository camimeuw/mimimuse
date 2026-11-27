# Publicar en Cloudflare Pages (`pages.dev`)

La tienda (`/`) y el panel (`/admin/`) salen del mismo repositorio. Los datos están en Firebase, así que el link puede cambiar sin perder nada.

## Configuración del proyecto
- **Repositorio:** `camimeuw/mimimuse`.
- **Rama de producción:** `main` (¡no `solo-panel` ni otra!). Si se publica otra rama, se ve una versión vieja del panel que no funciona.
- **Framework preset:** None.
- **Comando de compilación** (en una sola línea):
  ```
  mkdir dist && cp -r index.html admin assets css data js dist/
  ```
- **Directorio de salida:** `dist`.
- **Root directory:** vacío.

Cloudflare no acepta `/` ni `.` como directorio de salida; por eso el comando arma `dist` con solo lo necesario. Así **no se publican** `PRODUCT.md`, `docs`, `tests`, `firestore.rules` ni `referencia`.

## Cómo comprobar que quedó bien
- `https://TU-PROYECTO.pages.dev/data/config.js` tiene que traer `const FIREBASE = { projectId: 'mimimuse-eccab', … }` (si trae `const API = …netlify…`, se publicó una rama vieja).
- `https://TU-PROYECTO.pages.dev/admin/` muestra «Entrar» con los campos Email y Clave.
- `https://TU-PROYECTO.pages.dev/js/firebase.js` baja el archivo (no una página HTML).

## Si se agrega una carpeta nueva a la tienda
Hay que sumarla al comando: `cp -r index.html admin assets css data js CARPETA dist/`.

## Cambiar de link
No hay que tocar Firebase. La clienta entra de nuevo al panel nuevo con el mismo email y clave (la sesión se guarda por dirección). Opcional: agregar el dominio en Firebase → Authentication → Configuración → Dominios autorizados.
