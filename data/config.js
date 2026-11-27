// Número que muestra el contador de visitas.
// Un contador real necesita un servicio aparte (por ejemplo una función en Netlify); mientras tanto se escribe acá a mano.
const VISITAS = 0;

// Dirección del panel (donde viven /api/productos y /api/imagen). Vacío = el mismo sitio de la tienda.
// Si la tienda está en GitHub Pages y el panel en Netlify, la tienda lee los productos de Netlify.
// Si el sitio de Netlify se llama distinto de "mimimuse-panel", cambiar el nombre acá.
const API = location.hostname.endsWith('github.io') ? 'https://mimimuse-panel.netlify.app' : '';
