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
    arriba: [
      { nombre: "remera corazón", src: svg(simetrico(forma(
        "M365 425 Q320 425 305 362 L215 370 L145 410 L130 545 L195 565 L205 480 L212 810 L365 810 Z", FUCSIA,
        `<path d="M290 600 q-30 -30 0 -50 q22 -10 30 12 q8 -22 30 -12 q30 20 0 50 l-30 30z" fill="${BLANCO}" stroke="#411d4b" stroke-width="4"/>`))) },
      { nombre: "top violeta", src: svg(simetrico(forma(
        "M365 440 Q335 440 322 385 L322 362 L285 366 L268 450 L225 490 L212 700 L365 700 Z", UVA,
        `<circle cx="300" cy="620" r="12" fill="${BLANCO}"/><circle cx="260" cy="560" r="9" fill="${BLANCO}"/><circle cx="320" cy="520" r="8" fill="${BLANCO}"/>`))) },
      { nombre: "buzo lila", src: svg(simetrico(forma(
        "M365 430 Q318 430 304 360 L215 368 L148 408 L98 690 L175 708 L205 545 L212 812 L365 812 Z", LILA,
        `<path d="M215 700 H365 M215 740 H365" stroke="${UVA}" stroke-width="10"/><path d="M130 520 L190 540 M120 590 L180 610" stroke="${UVA}" stroke-width="10"/>`))) },
    ],
    abajo: [
      { nombre: "pollera rosa", src: svg(simetrico(forma(
        "M365 800 L188 800 L120 1170 L365 1170 Z", FUCSIA,
        '<path d="M250 810 L215 1165 M300 810 L290 1165" stroke="#411d4b" stroke-width="4" fill="none"/>'))) },
      { nombre: "short violeta", src: svg(simetrico(forma(
        "M365 800 L188 800 L172 1040 L338 1040 L360 930 L365 930 Z", UVA,
        `<circle cx="255" cy="900" r="10" fill="${BLANCO}"/>`))) },
      { nombre: "pantalón lila", src: svg(simetrico(forma(
        "M365 800 L188 800 L150 1200 L178 1655 L335 1655 L352 1010 L365 960 Z", LILA,
        `<path d="M200 810 L170 1200" stroke="${UVA}" stroke-width="8" fill="none"/>`))) },
    ],
    zapatos: [
      { nombre: "zapatillas", src: svg(simetrico(forma(
        "M285 1655 L345 1655 L350 1745 Q362 1770 352 1788 L262 1788 Q250 1760 270 1735 Z", FUCSIA,
        `<path d="M268 1760 H352" stroke="${BLANCO}" stroke-width="8"/>`))) },
      { nombre: "botas", src: svg(simetrico(forma(
        "M268 1540 L350 1540 L352 1745 Q364 1772 354 1788 L258 1788 Q246 1762 266 1738 Z", UVA,
        `<path d="M268 1560 H350" stroke="${BLANCO}" stroke-width="8"/>`))) },
      { nombre: "bailarinas", src: svg(simetrico(forma(
        "M280 1700 L340 1700 L350 1745 Q362 1770 352 1788 L262 1788 Q250 1760 268 1738 Z", LILA,
        `<path d="M296 1706 l-14 -12 v24z M326 1706 l14 -12 v24z" fill="${FUCSIA}" stroke="#411d4b" stroke-width="4"/>`))) },
    ],
  };
})();
