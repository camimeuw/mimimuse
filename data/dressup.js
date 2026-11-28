// ============================================================
// DRESS UP — la modelo y la ropa son capas PNG transparentes
// que miden EXACTAMENTE 730 x 1790 px (la prenda dibujada en su lugar
// sobre el cuerpo). Se apilan en la misma posición y por eso calzan solas.
// Orden de capas: modelo → abajo → arriba → zapatos.
//
// Para usar tus prendas: poné los PNG en assets/dressup/ y cambiá solo el `src`:
//   { nombre: "remera rosa", src: "assets/dressup/arriba-1.png" }
// Mientras tanto se ven placeholders (formas de color) del mismo tamaño.
// Cada parte (arriba, abajo, zapatos) tiene 3 prendas. La modelo queda fija; las prendas se arrastran.
// ============================================================
const MODELO = "assets/dressup/modelo.png";

const ROPA = (() => {
  const W = 730, H = 1790, TRAZO = 'stroke="#411d4b" stroke-width="5" stroke-linejoin="round"';
  const svg = (dentro) => "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${dentro}</svg>`);
  // se dibuja la mitad izquierda y se espeja para la derecha (el cuerpo está centrado en x=365)
  const simetrico = (mitad) => `<g>${mitad}</g><g transform="matrix(-1 0 0 1 ${W} 0)">${mitad}</g>`;
  const forma = (d, relleno, extra = "") => `<path d="${d}" fill="${relleno}" ${TRAZO}/>${extra}`;
  const FUCSIA = "#d63fa6", LILA = "#d9a8ea", UVA = "#7b2a8e", BLANCO = "#ffffff";

  return {
    arriba: [   // remeras de demostración (PNG de 730x1790 con la prenda ya ajustada a la modelo)
      { nombre: "remera pentagrama", src: "assets/dressup/arriba-pentagrama.png" },
      { nombre: "remera gatitos", src: "assets/dressup/arriba-gatitos.png" },
      { nombre: "top violeta", src: svg(simetrico(forma(
        "M365 440 Q335 440 322 385 L322 362 L285 366 L268 450 L225 490 L212 700 L365 700 Z", UVA,
        `<circle cx="300" cy="620" r="12" fill="${BLANCO}"/><circle cx="260" cy="560" r="9" fill="${BLANCO}"/><circle cx="320" cy="520" r="8" fill="${BLANCO}"/>`))) },
      { nombre: "buzo lila", src: svg(simetrico(forma(
        "M365 430 Q318 430 304 360 L215 368 L148 408 L98 690 L175 708 L205 545 L212 812 L365 812 Z", LILA,
        `<path d="M215 700 H365 M215 740 H365" stroke="${UVA}" stroke-width="10"/><path d="M130 520 L190 540 M120 590 L180 610" stroke="${UVA}" stroke-width="10"/>`))) },
    ],
    abajo: [   // prendas de demostración (PNG de 730x1790 con la prenda ya ubicada sobre la modelo)
      { nombre: "short rosa", src: "assets/dressup/abajo-short-rosa.png" },
      { nombre: "short lunares", src: "assets/dressup/abajo-short-lunares.png" },
      { nombre: "pollera negra", src: "assets/dressup/abajo-pollera-negra.png" },
    ],
    zapatos: [   // zapatos de demostración (PNG de 730x1790 con cada zapato sobre su pie)
      { nombre: "zapatos moño", src: "assets/dressup/zapatos-mona.png" },
      { nombre: "zapatillas negras", src: "assets/dressup/zapatillas-negras.png" },
      { nombre: "botas negras", src: "assets/dressup/botas-negras.png" },
    ],
  };
})();
