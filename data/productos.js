// Tus productos. Más adelante esto se reemplaza por la planilla de Google Sheets (CSV + PapaParse).
// Fotos: poné los archivos en assets/productos/ y escribí la ruta en `imgs`.
//   imgs: ["assets/productos/falda-1.webp"]                       -> una foto
//   imgs: ["assets/productos/falda-1.webp", "assets/productos/falda-2.webp"]  -> la 2ª aparece al pasar el mouse
// Sin foto (imgs: []) se ve un recuadro de relleno. precio: null muestra "S/ —".
const PRODUCTS = [
  { id: 1, nombre: "Producto de ejemplo 1", precio: null, cat: "remeras",    imgs: [], agotado: false },
  { id: 2, nombre: "Producto de ejemplo 2", precio: null, cat: "faldas",     imgs: [], agotado: false },
  { id: 3, nombre: "Producto de ejemplo 3", precio: null, cat: "accesorios", imgs: [], agotado: true  },
  { id: 4, nombre: "Producto de ejemplo 4", precio: null, cat: "remeras",    imgs: [], agotado: false },
  { id: 5, nombre: "Producto de ejemplo 5", precio: null, cat: "faldas",     imgs: [], agotado: false },
  { id: 6, nombre: "Producto de ejemplo 6", precio: null, cat: "accesorios", imgs: [], agotado: false },
  { id: 7, nombre: "Producto de ejemplo 7", precio: null, cat: "remeras",    imgs: [], agotado: false },
  { id: 8, nombre: "Producto de ejemplo 8", precio: null, cat: "sale",       imgs: [], agotado: false },
];
