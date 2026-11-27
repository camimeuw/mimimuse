# Conectar la tienda y el panel con Firebase

La tienda y el panel se publican en **GitHub Pages** (como ya está). Los productos, las fotos y los cupones se guardan en **Firebase** (gratis). Se hace una sola vez, desde el navegador del celular o de la compu.

## 1. Crear el proyecto
1. Entrá a **console.firebase.google.com** → **Crear un proyecto**. Nombre: `mimimuse`.
2. Desactivá Google Analytics y creá el proyecto.

## 2. La clave de la dueña (inicio de sesión)
1. **Compilación → Authentication → Comenzar**.
2. En **Método de acceso** elegí **Correo electrónico/contraseña**, activalo y guardá.
3. Pestaña **Usuarios → Agregar usuario**: el email y una clave de la dueña (que sea larga). Anotalos.
4. Si en **Configuración → Acciones del usuario** aparece «Habilitar creación (registro)», desmarcalo: así nadie más puede crear cuentas.

## 3. La base de datos
1. **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: `southamerica-east1` (São Paulo). Modo **producción**.

## 4. Las reglas de seguridad
1. En Firestore, pestaña **Reglas**.
2. Pegá el contenido de `firestore.rules` y **cambiá el email** de la línea `esDuena()` por el de la dueña.
3. **Publicar**.

Qué hacen: todos pueden *ver* los productos visibles, las fotos y los cupones (es lo que muestra la tienda); solo la dueña puede *cambiar* algo, y solo ella ve la lista completa (con los productos ocultos).

## 5. Copiar dos datos a `data/config.js`
1. **Configuración del proyecto** (la ruedita) → **General** → **Tus apps** → botón **</>** (Web). Registrá la app (nombre `Mimi Muse`, sin Hosting).
2. De `firebaseConfig` copiá `projectId` y `apiKey` (no son secretos) y pegalos en `data/config.js`:
   ```js
   const FIREBASE = { projectId: 'mimimuse-1234', apiKey: 'AIza…' };
   const WHATSAPP = '51999888777';   // código de país + número, sin + ni espacios
   ```
3. Subí el cambio a GitHub. En 1 o 2 minutos la tienda y el panel ya leen de Firebase.

## 6. Entrar al panel
`https://camimeuw.github.io/mimimuse/admin/` → email y clave de la dueña. «Olvidé mi clave» manda un mail de Firebase para poner una nueva.

## Opcional: proteger la apiKey
En Google Cloud → **APIs y servicios → Credenciales** → la clave de Firebase → *Restricciones de aplicación* → **Sitios web** → `camimeuw.github.io/*`. Así solo funciona desde esa página.

## Topes del plan gratis (Spark)
1 GiB guardados, **50.000 lecturas por día**, 20.000 escrituras por día. Si se pasan, Firebase corta hasta el día siguiente (la tienda muestra la última lista que vio cada visitante).
- Una visita nueva gasta unas 30 lecturas: 1 de la lista de productos y las fotos de las primeras tarjetas. Las fotos se guardan en el dispositivo, así que quien ya visitó casi no gasta. Alcanza para más de 1.000 visitas nuevas por día.
- La lista completa vive en un solo documento de Firebase (máximo ~1 MB): entran unos 400 productos con descripciones largas (más si son cortas).
- Cada foto se guarda en un documento de hasta 1 MB: el panel las achica solo (máximo 700 KB).
