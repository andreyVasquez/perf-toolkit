# Playbook · Quick-wins en temas Shopify nativos

> Checklist priorizado para el Agente B (auditoría estática) y los carriles de fixes. Generalizado de los hallazgos A-01…A-25 de Lummia (`lummia/docs/AUDIT-CODE.md`), tema Shapes 3.0 + secciones custom.
> Todos los greps se corren desde `theme/`. Un grep da candidatos, no hallazgos: confirmar con el HTML renderizado (`curl -A "Mozilla/5.0 (Linux; Android 14)" URL`) y con el trace del Agente A.
> Reglas: archivo:línea exacta por hallazgo · nunca `settings_data.json` ni `templates/*.json` (eso es `requiere-customizer`) · apps encendidas solo se mitigan.

Orden = impacto típico sobre la meta (CLS y LCP de PDP primero).

## CLS

**1 · Espaciador del header con CSS aplicado tarde.** El tema reserva el alto del header con un `<div style="height:Npx">` o un margen negativo que vive en el CSS personalizado global (`settings.custom_css`), y ese CSS se imprime al final del `<body>`. Hasta que llega, el contenido salta N px (Lummia: 162 px, CLS 0.144 en PDP y colección).
```bash
grep -n "custom_css\|settings.css" layout/theme.liquid | head
grep -n -E 'style="height: *[0-9]+px|margin-bottom: *-[0-9]+px' sections/header.liquid
grep -o '"custom_css":[^]]*' config/settings_data.json | head -c 600     # leer, no editar
```
Fix: imprimir la regla crítica (la del espaciador/margen) en un `<style>` antes del nav en `sections/header.liquid`, con comentario "si cambia el valor en el CSS global, actualizar aquí".

**2 · Logos e imágenes del header sin width/height.**
```bash
grep -n "<img" sections/header.liquid snippets/*logo*.liquid 2>/dev/null | grep -v "width="
```
Fix: `width`/`height` intrínsecos (SVG: del viewBox) en cada `<img>`; o `image_tag` que los pone solo.

**3 · Imágenes sin dimensiones en general** (reseñas, beneficios, antes/después, drawer). Saltan al hacer scroll y suman a CLS.
```bash
grep -rn "<img" sections snippets | grep -v -E "width=|image_tag" | wc -l
grep -rn "<img" sections snippets | grep -v -E "width=|image_tag" | cut -d: -f1 | sort | uniq -c | sort -rn | head
```
Fix: `image_url: width: N | image_tag: loading: 'lazy'` o `aspect-ratio` en CSS.

**4 · Bloques movidos por JS después de pintar** (upsell metido al buy-box en `DOMContentLoaded`, banners inyectados arriba).
```bash
grep -rn -E "(appendChild|insertBefore|prepend|insertAdjacentElement)\(" sections snippets | grep -i -E "DOMContentLoaded|addEventListener\('load" | head
```
Fix: renderizar en su sitio final; si no se puede, `<script>` inline inmediatamente después del markup (no en DCL) y alto reservado.

**5 · Clases de estética por variante puestas por JS** (`body.barbie-active` tras cargar) en landings `?variant=`.
```bash
grep -rn "classList.add('.*-active')" sections snippets layout | head
```
Fix: clase server-side en `<body>` según `product.selected_variant.optionN`.

## LCP

**6 · Hero con versión desktop y mobile, ambas eager (y a veces ambas con preload).** En móvil baja también la imagen desktop.
```bash
grep -rn -E "hidden (md|lg):block|(md|lg):hidden|small--hide|medium-up--hide|mobile-only|desktop-only" sections snippets | grep -i -E "img|image" | head
grep -rn -E "preload: *true" sections snippets
```
Fix: un solo `<picture><source media="(min-width: 990px)" srcset=…><img …></picture>`; preload solo del primero.

**7 · Eager por `section.index <= N` en vez de solo la primera.** La 3.ª sección de la plantilla (bajo el fold) baja eager.
```bash
grep -rn "section.index" sections snippets
```
Fix: eager solo si `section.index == 1` o `section.location == 'header'`; resto `lazy`.

**8 · fetchpriority del LCP ausente, o en imágenes ocultas.**
```bash
grep -rn 'fetchpriority' sections snippets layout | head -30
```
Fix: `fetchpriority="high"` solo en la imagen LCP (primer slide, primera card); `auto`/`lazy` en el resto, **incluidas las copias ocultas de la misma URL**: si la URL aparece antes en el DOM con prioridad auto, gana esa. Verificar con `net-check.mjs` que el request sale en High.

**9 · Preload con ancho distinto al del srcset** = doble descarga del LCP.
```bash
grep -rn -E "imagesrcset|imagesizes|rel=\"preload\".*as=\"image\"|preload: true" sections snippets layout
```
Fix: `imagesrcset`/`imagesizes` del preload idénticos al `srcset`/`sizes` del `<img>`; o quitar el preload y dejar `fetchpriority=high`.

**10 · Videos con `autoplay` o `preload="auto"`.** `autoplay` ignora `preload` y baja el video entero al cargar (Lummia home: 13.7 MB 1080p para una caja de 412 px).
```bash
grep -rn -E "<video|video_tag" sections snippets | grep -E "autoplay|preload=\"auto\"|preload: 'auto'"
grep -rn "video.sources\[" sections snippets                         # elección de rendition
```
Fix: sin atributo `autoplay`, `preload="none"`, `src` (o `data-src`) asignado con `IntersectionObserver` y `play()` al entrar en viewport; elegir la fuente con lado corto ≤ 720. Re-encode en Frente B.

**11 · Galerías/bloques ocultos con imágenes eager** (otra variante, drawer `x-show`, popups).
```bash
grep -rn -E "loading=\"eager\"|loading: 'eager'|fetchpriority=\"high\"" sections snippets | cut -c1-140   # candidatos; mirar si el contenedor está oculto
grep -n -E "<img|img_url" sections/header.liquid | grep -v lazy                                   # drawer/menús del header
```
Fix: `loading="lazy"` (lazy dentro de `display:none` no se descarga) + `fetchpriority="auto"`.

**12 · Reseñas sin lazy** (Judge.me, Loox, Revie, Okendo legacy en snippets): decenas de JPG de origen externo sin resize.
```bash
grep -rln -i -E "review|revie|judge|loox|okendo|yotpo|stamped" snippets sections | xargs grep -n "<img" | grep -v "loading=" | head
```
Fix: `loading="lazy" decoding="async"` + dimensiones, también en los strings HTML que genera su JS.

**13 · `sizes` de cards sin gutters** (`50vw` o `100vw`): móvil pide 750w para una caja de 172 px.
```bash
grep -rn "sizes=" snippets/card-product*.liquid snippets/*tile*.liquid snippets/*card*.liquid sections/main-collection-product-grid.liquid 2>/dev/null
grep -rn "widths:" snippets/card-product*.liquid snippets/*tile*.liquid 2>/dev/null
```
Fix: `sizes="(min-width: 990px) calc((100vw - 130px) / 4), calc((100vw - 34px) / 2)"` según el grid real, y anchos intermedios en `widths` (ej. 360, 460, 540). Primera fila eager, máx. 2 con `fetchpriority=high`.

**14 · `img_url: 'master'` / `image_url` sin width** (originales de 400 KB-8 MB).
```bash
grep -rn -E "img_url: *'master'|image_url *\}\}|image_url *\|" sections snippets | grep -v "width:" | head
```
Fix: `image_url: width: N` al tamaño de la caja ×2-3.

## Head, fuentes y librerías globales

**15 · Librerías de CDN públicos en todas las páginas** (Flickity, Swiper, Slick, bootstrap-icons de jsDelivr): otro origen en el camino crítico y CSS render-blocking.
```bash
grep -rn -E "cdn.jsdelivr|unpkg.com|cdnjs|bootstrapcdn" layout sections snippets | cut -c1-160
grep -rln -E "Flickity|new Swiper|\.slick\(" sections snippets assets/*.js
```
Fix: cargar la librería solo en las secciones/plantillas que la usan; iconos como SVG inline; CSS no bloqueante (`media="print" onload`) con las reglas de layout críticas inline.

**16 · Fuentes duplicadas, sin preload o con `@import`.**
```bash
grep -rn -E "fonts.googleapis|fonts.gstatic" layout sections snippets | cut -c1-160
grep -rn "@import" assets/*.css sections snippets | head
grep -n -E "preload.*woff2|font_url" layout/theme.liquid snippets/css-*.liquid 2>/dev/null
```
Fix: una sola carga por familia, `preload` del woff2 de la fuente base, `preconnect` a gstatic con `crossorigin`, quitar `@import` en `<style>`; familias que no usan las 3 plantillas, condicionadas por `template`.

**17 · Preconnects de builders/apps en todas las páginas** (GemPages, ucarecdn, cloudfront) aunque la plantilla no los use.
```bash
grep -rn 'rel="preconnect"\|rel="dns-prefetch"' layout snippets | cut -c1-160
```
Fix: condicionarlos a las plantillas que los usan.

## Código muerto

**18 · ScriptLoader o lazy-loaders sin consumidores** (listeners en `window` + timers para elementos que no existen).
```bash
grep -n -E "ScriptLoader|data-src|data-href" layout/theme.liquid
grep -rln -E "data-src=|data-href=" sections snippets | head            # ¿alguien lo usa?
```
Fix: eliminar el bloque.

**19 · Includes de apps desinstaladas o apagadas** (AVADA, PageFly, Shogun, Bold, Instafeed…).
```bash
grep -n -E "\{%-? *(render|include) '" layout/theme.liquid | cut -c1-120
find snippets -name "*.liquid" -size -200c                               # snippets vacíos o casi
```
Fix: quitar el include si el snippet está vacío o la app está OFF/desinstalada (cruce con el inventario de app embeds). La desinstalación de la app va por el protocolo de la sección 9 del SOP.

**20 · Integraciones legacy que serializan metafields enteros** (`JSON.parse` síncrono de 100 KB al final del body) o bloques para nodos que no existen en la plantilla.
```bash
grep -rn -E "JSON.parse\('\{\{|\| json *\}\}" snippets sections | cut -c1-140 | head
```
Fix: `<script type="application/json">` + parse al acercarse el contenedor; no renderizar donde no hay nodos.

**21 · Loops sobre `collections.all.products` para leer un dato.**
```bash
grep -rn "collections.all.products" sections snippets layout
```
Fix: `all_products['handle']`.

## INP

**22 · `body:has()` / `html:has()` con estados que cambian en cada click.** Cada mutación del atributo re-evalúa el selector sobre todo el documento dentro del frame de la interacción.
```bash
grep -rn -E "(body|html):has\(" assets/*.css sections snippets layout | cut -c1-160
```
Fix: clase en `<body>` (`body.aida-active`) toggleada en el mismo evento que ya cambia la variante, y puesta server-side para la variante inicial.

**23 · MutationObservers sobre `document.body` / `documentElement` con `subtree:true`.**
```bash
grep -rn -E "observe\( *(document\.body|document\.documentElement|document)" assets sections snippets layout | cut -c1-160
```
Fix: observar solo el contenedor que cambia, `attributeFilter` sin `childList`, coalescer con `requestAnimationFrame`, `disconnect()` cuando ya no hace falta.

**24 · Listeners globales caros** (click en captura con `getBoundingClientRect`, scroll no pasivo, `dispatchEvent(new Event('resize'))`, `setInterval` de sliders fuera de pantalla).
```bash
grep -rn -E "addEventListener\('(click|scroll|touchmove)'" layout snippets sections | grep -v passive | cut -c1-160 | head
grep -rn -E "dispatchEvent\(new Event\('resize'\)\)|setInterval\(" sections snippets | head
```
Fix: `e.target.closest()`, `{passive:true}` + rAF, IntersectionObserver, pausar intervalos fuera de viewport, renderizar el listener solo en la plantilla que lo necesita.

**25 · `console.log` en producción con nodos DOM.**
```bash
grep -rn "console.log" sections snippets layout assets/*.js | wc -l
```
Fix: quitarlos en los archivos que ya se tocan.

## Frente C (interno, nunca al cliente)

```bash
grep -rn -E "intelligems|heatmap\.com|zigpoll|alia" layout snippets | cut -c1-140
```
Stack propio apagado no carga: envolver en `{% if cm_<herramienta>_enabled %}` con el flag en `false` y anotar cómo reactivarlo (Lummia C-01: −101 KB gzip por página).
