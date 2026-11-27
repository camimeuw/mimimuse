# Tarjetas de producto de Bunny Club (referencia)

Extraído de https://camimeuw.github.io/bunnyclub.ar/ (`css/style.css` y `js/app.js`, función `renderCatalog`).
Capturas: `bunnyclub-productos-compu.png` (1366 px) y `bunnyclub-productos-celu.png` (390 px).

## HTML de una tarjeta

Se genera por JS, una `<li>` por producto dentro de `<ul id="catalog">`. Las variables CSS del `style` son aleatorias pero estables (semilla = id del producto).

```html
<li class="item big flip" style="--w:470px; --k:47.0; --r:0.7deg; --dy:9px; --dx:-9px; --delay:.40s; --out:0s; --fd:7.2s; --fdl:-.3s">
  <button class="item-btn" data-id="0" aria-label="Ver Producto">
    <div class="float"><div class="tilt">
      <div class="pic has-alt">            <!-- has-alt solo si hay segunda foto -->
        <span class="badge">1</span>       <!-- número del producto -->
        <span class="sold">Agotado</span>  <!-- solo si está agotado (+ clase is-sold en la li) -->
        <img class="main" src="foto1.webp" alt="Producto" loading="lazy">
        <img class="alt"  src="foto2.webp" alt="" loading="lazy">   <!-- aparece en hover -->
      </div>
      <div class="cap"><span class="name">Producto</span><span class="price">$14.400</span></div>
    </div></div>
  </button>
</li>
```

Clases de la `<li>`: `big` si el ancho base es ≥ 380 px, `flip` en los índices impares (texto a la derecha), `is-sold` si está agotado.
Anchos base (`--w`) por posición: `[470, 330, 380, 290, 440, 320, 480, 295, 400, 400]` (se repite).
Aleatorios por producto: `--r` entre -5° y 5°, `--dy` entre 0 y 26 px, `--fd` entre 7 y 12 s, `--fdl` entre -8 y 0 s. `--delay` = 0.4 s + 0.2 s por posición (máx. posición 9).

## Medidas calculadas (compu, 1366 px)

| Qué | Valor |
|---|---|
| Columnas | 4 × 285,5 px (`repeat(4, minmax(0,1fr))`) |
| Imagen (`.pic`) | cuadrada 285,5 × 285,5, `object-fit: contain` |
| Nombre | Wizards Magic, 17,08 px (`clamp(15px, 1.25vw, 18px)`), color `#1a1016` |
| Precio | Wizards Magic, 17,08 px, color `#b8588b` |
| Sombra de la foto | `drop-shadow(0 14px 14px rgba(120,50,90,.22))` (sin caja ni borde) |
| Fondo de la página | `#F6E2EE` |

## Variables (`:root`)

```css
--bg: #F6E2EE; --ink: #1a1016; --ink-soft: #4a3441; --pink: #e9a9cb; --pink-deep: #b8588b;
--font-title: "Wizards Magic", "Times New Roman", serif;   /* nombres y precios */
--ease: cubic-bezier(.22, .61, .36, 1);
```

## CSS exacto de las tarjetas

```css
#catalog { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); justify-items: center; align-items: start; gap: 28px 6px; max-width: 1320px; margin: 0 auto; padding: 56px 0 26px; }
.item { position: relative; width: min(var(--w), 100%); margin-top: var(--dy); margin-left: 0; animation: floatIn 2.8s var(--ease) var(--delay) backwards; }
#catalog.leaving .item { animation: floatOut .9s var(--ease) var(--out) forwards; }
.item .float { animation: float var(--fd) ease-in-out var(--fdl) infinite alternate; }
.item .tilt { transform: rotate(var(--r)); transition: transform .8s var(--ease); }
.item-btn { display: block; width: 100%; text-align: inherit; padding: 0; }
.item-btn:hover .tilt { transform: rotate(calc(var(--r) * -.4)) scale(1.05); }
.item .pic { position: relative; aspect-ratio: 1 / 1; display: grid; place-items: center; }
.item .pic img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 14px 14px rgba(120, 50, 90, .22)); transition: opacity .6s; }
.item .pic .alt { position: absolute; inset: 0; opacity: 0; }
.item-btn:hover .pic.has-alt .alt { opacity: 1; }
.item-btn:hover .pic.has-alt .main { opacity: 0; }
.pic.empty::before, .m-stage.empty::before { content: ""; width: 62%; aspect-ratio: 1; border-radius: 46% 54% 50% 50% / 52% 46% 54% 48%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.95), rgba(255,255,255,.35) 70%); box-shadow: 0 0 0 6px rgba(255,255,255,.35), 0 14px 30px -10px rgba(184,88,139,.35); }
.item .badge { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: #fff; font-family: var(--font-title); font-size: 13px; box-shadow: 0 0 0 3px rgba(255,255,255,.7); z-index: 2; }
.item .sold { position: absolute; right: 2%; top: 8%; z-index: 2; font-family: var(--font-script); font-weight: 700; font-size: 15px; padding: 1px 9px 2px; background: #fff; border-radius: 999px; transform: rotate(8deg); box-shadow: 0 4px 12px rgba(0,0,0,.12); }
.item.is-sold .pic img { opacity: .55; }
.item .cap { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; transform: rotate(calc(var(--r) * -.5)); }
.item.flip .cap { align-items: flex-end; text-align: right; }
.item .name { overflow-wrap: anywhere; font-family: var(--font-title); font-size: clamp(15px, 1.25vw, 18px); line-height: 1.05; letter-spacing: .01em; }
.item .price { font-family: var(--font-title); font-size: clamp(15px, 1.25vw, 18px); color: var(--pink-deep); text-shadow: 0 0 10px rgba(255,255,255,.9); }
.item .price::before { content: ""; display: inline-block; width: 12px; height: 1.5px; background: currentColor; vertical-align: middle; margin-right: 5px; opacity: .6; }
.item.flip .price::before { display: none; }
.item.flip .price::after { content: ""; display: inline-block; width: 12px; height: 1.5px; background: currentColor; vertical-align: middle; margin-left: 5px; opacity: .6; }
```

Detalles sueltos del mismo archivo:

```css
.item img, .m-stage img { -webkit-user-drag: none; }
.item-btn, .m-stage, .m-thumbs button { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.item-btn:focus { outline: none; }   /* ojo: quita el foco visible; conviene darle otro estilo */
@keyframes floatIn { from { opacity: 0; transform: translateY(90px) scale(.96); filter: blur(8px); } 55% { opacity: 1; } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes floatOut { to { opacity: 0; transform: translateY(-80px) scale(.96); filter: blur(8px); } }
@keyframes float { from { transform: translateY(0); } to { transform: translateY(-14px); } }
```

## Hover

- Sobre la tarjeta: la foto se inclina al revés y crece: `rotate(calc(var(--r) * -.4)) scale(1.05)`, con transición de .8 s (`--ease`).
- Si hay segunda foto: cross-fade de .6 s entre `.main` y `.alt`.
- No hay caja, borde ni sombra de tarjeta: solo la sombra de la foto.

## Posiciones desparramadas

Los ajustes por posición (`nth-child`, tamaños `big`, desplazamientos) están en las líneas 127-144 de `style.css`, todos dentro de `@media (max-width: 640px)` (celular); el layout de compu usa solo `--w`, `--dy` y el `flip`. Con un filtro activo, `#catalog.plain` apaga esos ajustes y deja una grilla limpia.

```css
@media (max-width: 640px) {
  #catalog { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 0; max-width: none; padding-left: .5vw; padding-right: .5vw; padding-top: 34px; }
  .item { width: 100%; margin-left: 0; margin-top: calc(var(--dy) * .5); }
  #catalog .item:nth-child(3n+2) { translate: 0 24px; }
  #catalog .item:nth-child(2) { margin-top: calc(var(--dy) * .5 + 55px); translate: 0 30px; scale: 1.18; transform-origin: 50% 0; z-index: 2; }
  .item.big { width: 128%; z-index: 1; }
  #catalog .item.big:nth-child(3n+1) { justify-self: start; }
  #catalog .item.big:nth-child(3n) { justify-self: end; }
  #catalog .item.big:nth-child(3n+2) { width: 100%; }
  #catalog .item:nth-child(7), #catalog .item:nth-child(9) { width: 132%; }
  #catalog .item:nth-child(8) { translate: 0 130px; z-index: 2; }
  #catalog .item:nth-child(10) { translate: 0 -8px; width: 112%; justify-self: start; }
  #catalog:not(.plain) .item.big:nth-child(n+11) { width: 104%; }
  #catalog:not(.plain) .item.big:nth-child(n+11):nth-child(3n+2) { width: 100%; }
  #catalog .item:nth-child(4) { justify-self: end; }
  #catalog .item:nth-child(6) { justify-self: start; }
  .item .badge { width: 20px; height: 20px; font-size: 11px; }
}
```
