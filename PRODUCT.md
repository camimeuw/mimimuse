# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS y JavaScript puro (sin frameworks), HTML y CSS en archivos separados. Se programa en VS Code y se publica en Netlify. Productos administrados desde Google Sheets (CSV publicado, leído con PapaParse).

## Users

Adolescentes y jóvenes de Perú que entran desde el celular (llegan por redes sociales). Buscan ropa de estética kawaii / Y2K y quieren ver cómo se ve un look completo antes de pedir. Mobile-first. La edad exacta y el canal de entrada principal quedan por confirmar con la clienta.

Audiencia secundaria: la dueña de Mimi Muse, que administra el catálogo desde una planilla (o no, si contrata la carga).

## Product Purpose

Tienda web a medida para Mimi Muse, marca de ropa de Perú (precios en soles, S/). Mostrar unos 200 productos y convertir la visita en un pedido: el carrito arma el mensaje y lo envía por WhatsApp. Éxito: la clienta puede mantener el catálogo sola desde Google Sheets y las compradoras llegan al pedido sin fricción.

## Positioning

La tienda se recorre como un lookbook "Dress Up": el inicio es un closet + modelo con looks completos (una foto por look, no superposición real de prendas), con un cuartito "Mimi Mode" de fondos/escenas y una mascota chibi propia. El catálogo completo vive aparte, en "ver todos los productos". Pedido directo por WhatsApp, sin pasarela de pago.

## Operating Context

- Inicio (Dress Up): header con reproductor de música (play/pausa, nombre de canción, barra de progreso), logo flotante animado, carrito y menú; closet a la izquierda (TOP, BOTTOM, SHOES, ACC; cada prenda lleva al producto); modelo al centro con flechas y puntitos para pasar de look; cuartito "Mimi Mode" a la derecha (◂ ▸ cambia fondo/escena); mascota chibi decorativa abajo a la derecha.
- Todos los productos (página aparte): mismo header y mismos dos botones ("Dress Up ✧" y "ver todos los productos →"); filtros por categoría (todas, remeras, faldas, accesorios, sale) y buscador; productos sin caja, numerados en circulitos, a distintas alturas con flotación suave; nombre y precio debajo; "ver más" y lazy loading; footer con WhatsApp, Instagram y TikTok.
- Popup de producto con talles, carrito por WhatsApp.
- Boceto a lápiz en 4 pantallas: https://claude.ai/artifact/9tRGySCr3CB7arzroGXiiZ (escritorio con la estructura final; las dos de celular son una versión anterior y falta reordenarlas para que arranquen en el Dress Up).

## Capabilities and Constraints

- Plan Estándar (S/ 490) + Dress Up/lookbook hasta 5 looks (S/ 200) + escena animada (S/ 150, por confirmar) + buscador (S/ 60) = S/ 900. Opcional: carga de los 200 productos por la desarrolladora, +S/ 200.
- No incluye fotos, logo ni dominio (.com). Entrega de 7 a 14 días hábiles; pago 50% al empezar y 50% al entregar.
- Moneda: soles (S/). Pago y entrega se coordinan por WhatsApp; envíos, medios de pago y talles por producto quedan sin decidir más allá de lo anterior.
- Escena animada (mascota colgando ropa en una soga, prendas meciéndose): sin confirmar con la clienta.
- Sin decidir: quién carga los 200 productos, y la idea del cuartito "Mimi Mode".
- Con 200 productos: "ver más" y lazy loading obligatorios.

## Brand Commitments

- Nombre: Mimi Muse. Estética kawaii / Y2K en rosa, violeta y blanco.
- Logo: chica con capucha de conejito con globito que dice "RUDE!", y nombre en letras burbuja con brillitos.
- Referencia del Dress Up: lookbook tipo "Style Book / Dress Up Mode", con fondo de lunares, casillas redondeadas y flechas violetas.
- Referencia de los productos flotando: otra tienda de la desarrolladora, "Bunny Club".
- La ilustración no se cobra aparte.

## Evidence on Hand

Existe solo el boceto a lápiz. No hay todavía: fotos de looks (modelo sin fondo, PNG), fotos de cada prenda sin fondo, la canción del reproductor, ni la imagen/idea del cuartito "Mimi Mode". No inventar productos, precios ni testimonios; usar placeholders hasta recibir el material.

## Product Principles

1. El look completo vence a la grilla: se entra por el Dress Up, el catálogo es el segundo paso.
2. De prenda a pedido en pocos toques, desde el celular, terminando en WhatsApp.
3. La clienta debe poder mantener el catálogo sola desde la planilla.
4. Jugueteo con función: música, mascota y escenas acompañan, nunca estorban la compra.
5. Mobile-first, construido una sección por vez.
