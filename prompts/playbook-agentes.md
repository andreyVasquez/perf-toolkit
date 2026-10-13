# Playbook · Pasos 3-4 y 5 con agentes en paralelo

> Cómo corre un solo operador una ronda en un día con Claude Code. Validado en Lummia (2026-10-07): diagnóstico completo (74 hallazgos) + Fase 1 de fixes + medición + QA en una jornada.
> No reemplaza a los prompts 3, 4, 5 y 6.5: los reparte entre agentes. Las reglas del SOP (CONSTRAINTS, GATING, Frente C, nada al live) aplican igual a cada agente.

## Variables (se pegan arriba de cada prompt de agente)

```
$PROJECT        carpeta absoluta del proyecto (ej. ~/ConvertMate/lummia)
$TK             carpeta del toolkit (ej. ~/perf-toolkit)
$SHOPIFY_STORE  marca.myshopify.com        $DOMAIN  www.marca.com
$HOME_URL $PDP_URL $COLLECTION_URL         las 3 de más tráfico
$LIVE_THEME_ID  tema publicado             $WORK_THEME_ID  duplicado [CM] Perf AAAAMM
$STORE_TYPE     instant | gempages | nativo (lo detecta new-project.mjs → data/tienda.json)
```

## Mapa

```
Operador: new-project.mjs → CONSTRAINTS sin PENDIENTES → crux-baseline + crux-history (minutos)
   │
   ├─ FASE 1 · diagnóstico (en paralelo, ~1.5-2 h)
   │    A lab + traces (ÚNICO con MCP)   B código estático   C contenido/assets   D tags
   │    └──────────────┬───────────────────────┴──────────────────┘
   │                   E consolidador → data/diagnostico.json + docs/DIAGNOSTICO.md
   │  Operador: aprueba plan, asigna hallazgos por carril
   │
   ├─ FASE 2 · fixes Frente A (en paralelo, ~1.5 h) · archivos DISJUNTOS · sin commit/push
   │    F1 header/layout   F2 videos/lazy/Instant   F3 imágenes/reseñas/colección
   │  Operador: diff por fix → commit por fix → push-changed.mjs (al duplicado)
   │
   └─ FASE 3 · validación (en paralelo, ~1 h)
        G medición preview (MCP)   H QA gate (screenshot-diff + pixel-check + funcional)
```

**Reglas del fan-out**
- **Un solo agente con el MCP chrome-devtools a la vez** (A en fase 1, G en fase 3). El MCP maneja un navegador; dos agentes encima se pisan las páginas y los traces. Los demás usan `curl` o puppeteer-core del toolkit.
- Cada agente escribe **sus** archivos de salida (lista cerrada en su prompt) y devuelve ≤ 15 líneas. El detalle va al archivo, no al chat.
- Ningún agente toca la tienda (ni push, ni Admin, ni subir assets), ni hace commit. Todo lo que llega al tema lo hace el operador.
- Si un agente necesita un archivo fuera de su carril, **lo reporta, no lo edita**.

---

## Lecciones (leer antes de lanzar)

1. **El MCP chrome-devtools se desconecta** en sesiones largas (pasó cerrando un trace de interacciones). Reconectar con `/mcp` y avisarle al agente con SendMessage: "MCP reconectado, repite la corrida N". Pedir que guarde cada trace a disco apenas termina (`data/traces/*.json.gz`) para no perder corridas.
2. **Preview con cookie, no con redirect.** `?preview_theme_id=` hace un 302 que suma ~1.2 s de TTFB al trace. En cada contexto aislado: abrir primero `https://$DOMAIN/robots.txt?preview_theme_id=$WORK_THEME_ID` (fija la cookie sin bajar assets) y luego navegar a la URL limpia. Verificar `Shopify.theme.id === $WORK_THEME_ID` en cada corrida.
3. **La cookie de preview se pega.** Si el live y el preview se capturan en el mismo navegador, el "live" sale del preview. Contexto nuevo por captura y verificación de `Shopify.theme.id` (live = `$LIVE_THEME_ID`).
4. **La barra de preview suma ~419 KB y 9 requests** (preview-bar vendor/app JS, vendor.css, Inter). El live no la carga: restarla al comparar peso, o reportar "peso después − barra".
5. **El LCP de lab suele ser el popup de Klaviyo** (aparece a los 18-34 s y gana por tamaño). Reportar siempre dos LCP: con popup y **"LCP sin popup"** = último candidato LCP que no es `FORM.klaviyo-form` ni un hijo `kl-private-*`. El que refleja los fixes es el segundo.
6. **Shopify marca la sesión automatizada como bot** y responde **429 en `/cart/add.js`**. No es fallo del tema: anotar, esperar y repetir con sesión limpia, o verificar add-to-cart a mano.
7. **fetchpriority: gana la primera aparición de la URL en el DOM.** Si la misma imagen aparece antes (duplicado oculto, `loading=eager`, prioridad auto), el parser la pide con esa prioridad y el `fetchpriority="high"` de la copia visible no sirve. Revisar con `net-check.mjs` que el request LCP salga en High.
8. **Preload (`<link>` o header `Link`) con ancho distinto al que elige el `srcset`** = doble descarga del recurso LCP (Lummia: 1100w + 1500w del hero). `imagesrcset`/`imagesizes` del preload deben ser idénticos a los del `<img>`/`<picture>`.
9. **Apps encendidas en el tema = intocables.** Solo mitigación (defer, lazy, facade) sin cambiar el comportamiento. Se reportan con su costo en ms.
10. **Instant regenera `sections/instant-*.liquid` y sus snippets al re-publicar.** Todo parche ahí lleva marca `CM perf AAAA-MM` y entra a la lista "Re-aplicar después de cada re-publish de Instant" del CHANGELOG (ver `playbook-instant.md`).
11. **Medición y QA en paralelo compiten por CPU.** Si el TBT del preview sale raro, repetir G con H detenido.

---

## FASE 1 · Diagnóstico

Prerequisito: `CONSTRAINTS.md` sin PENDIENTES (GATING), `data/baseline.json` con la parte CrUX ya corrida por el operador, `theme/` con el pull del live.

### Agente A · Lab + traces (MCP)

```
Proyecto $PROJECT. Paso 3 (parte lab) y Paso 4 (traces) del SOP ConvertMate. Eres el ÚNICO agente con el MCP chrome-devtools. No toques theme/ ni la tienda.
Metodología FIJA (SOP §2): Slow 4G · CPU 4x · 412×915 DPR 2.625 móvil+touch, UA Chrome Android · caché fría (contexto aislado nuevo por corrida, trace iniciado antes de navegar) · 3 corridas por página, mediana por métrica. Entorno: LIVE https://$DOMAIN (verifica Shopify.theme.id === $LIVE_THEME_ID en cada corrida).
Páginas: $HOME_URL · $PDP_URL · $COLLECTION_URL.
1. Por corrida: LCP (con popup y "LCP sin popup" = último candidato que no es FORM.klaviyo-form ni hijo kl-private-*), CLS con elemento y causa, TBT, FCP, KB transferidos (encodedDataLength), requests. Guarda cada trace apenas termina en data/traces/<pagina>-run<N>.json.gz.
2. Sobre la corrida mediana: fases del LCP (TTFB, load delay, load time, render delay) con URL y prioridad del recurso; render-blocking; long tasks con atribución; costo por third-party agrupado por app/dominio (main thread ms + KB); insights del MCP (LCPDiscovery, ImageDelivery, RenderBlocking, ThirdParties).
3. PDP: sesión de interacciones (cambio de variante, abrir/cerrar acordeón, cerrar popup, add to cart) con duración INP por interacción y atribución. Si responde 429 en /cart/add.js, anótalo y sigue.
4. Salida: data/baseline.json (agrega las mediciones lab a lo que ya existe, valida contra $TK/schemas/baseline.schema.json) · docs/BASELINE.md · docs/TRACES.md. Frente C (Intelligems, Heatmap, Zigpoll, Alia) se mide igual y se marca INTERNO.
Si el MCP se desconecta, dime en qué corrida ibas y espera; yo reconecto.
Devuelve ≤15 líneas: mediana por página (LCP, LCP sin popup, CLS, TBT, KB) y top 5 causas.
```

### Agente B · Auditoría de código estática

```
Proyecto $PROJECT. Paso 4 del SOP ConvertMate, Frente A, SOLO lectura. NO uses el MCP chrome-devtools (lo usa otro agente). No edites theme/.
Tipo de tienda: $STORE_TYPE. Lee CONSTRAINTS.md y, según el tipo, $TK/prompts/playbook-tema-nativo.md y/o $TK/prompts/playbook-instant.md (checklist con greps).
Método: lectura de theme/ en el orden del SOP (layout/theme.liquid head → assets/*.js → sections/header.liquid → snippets con scripts → sections de home/PDP/colección) + HTML renderizado del live con curl (UA móvil) de las 3 URLs + pesos reales con curl.
Por hallazgo: id A-NN · archivo:línea exacta · problema · métrica · severidad · esfuerzo (quick-win <2h / medio / complejo) · riesgo · fix propuesto · estado (listo | bloqueado-avisar [app intocable, archivo generado por Instant, Frente C] | requiere-customizer [vive en templates/*.json o settings_data.json]).
Además: inventario de app embeds de config/settings_data.json (ON/OFF, qué carga medido, costo, mitigación sin quitarla); apps sin embed con código en el tema; includes de apps apagadas/desinstaladas; scripts de medición en lista aparte (no se tocan); búsqueda de scripts que maquillan métricas.
Las atribuciones de INP/CLS son hipótesis: deja al final "Notas para el trace" para que se confirmen.
Salida: docs/AUDIT-CODE.md (Frente C en sección INTERNO). Devuelve ≤15 líneas: top 10 por impacto.
```

### Agente C · Contenido y assets (Frente B)

```
Proyecto $PROJECT. Paso 4 (inventario) y preparación del Paso 6 del SOP ConvertMate, Frente B. NO subas, reemplaces ni borres nada en la tienda. NO uses el MCP chrome-devtools.
1. Captura con puppeteer-core del toolkit ($TK/node_modules): móvil 412×915 DPR 2.625 UA Android con scroll completo + desktop 1440×900. Páginas: $HOME_URL, $PDP_URL (más ?variant= de las variantes que cambian la estética, si CONSTRAINTS las nombra), $COLLECTION_URL.
2. Inventario de imágenes, videos, SVG y GIF: URL · bytes transferidos reales · original (GET sin width) · caja en px · autoplay/preload · visible o no (contenedores display:none / alto 0 / acordeón cerrado) · dónde está referenciado (grep en templates/*.json, sections/*.json, settings_data.json y literales en sections/, snippets/, assets/*.css) · vía de cambio: Customizer/Admin (global, va en la ventana) | Archivo del tema (copia → push) | App Instant (editor de Instant + re-publicar).
3. Videos: ffprobe remoto (resolución, códec, bitrate). Specs: autoplay → H.264 720p 2-3 Mbps (o menos si la caja es chica), faststart, poster WebP; GIF → MP4 + poster; SVG > 50 KB → WebP/PNG.
4. Convierte en local: originales en assets-src/originales/, optimizados en assets-src/optimizados/. Imágenes con TinyPNG (TINYPNG_API_KEY del .env, o $TK/scripts/asset-optimize.mjs si existe) al ancho real de la caja ×2-3; videos con ffmpeg (-c:v libx264 -crf 26-28 -preset slow -vf scale=-2:720 -movflags +faststart -an si es mudo).
5. Salida: data/assets-plan.json (plan ordenado por ahorro, ATF ×2, PDP ×1.5) + docs/AUDIT-CONTENT.md (totales por página actual vs con plan B). Devuelve ≤15 líneas: top 10 por ahorro y MB totales.
```

### Agente D · Tags de medición

```
Proyecto $PROJECT. Inventario de tags de medición/marketing (insumo del Paso 4 y referencia del pixel-check del Paso 6.5). NO uses el MCP chrome-devtools. No toques theme/ ni la tienda.
Corre `node $TK/scripts/pixel-check.mjs --save-expect data/tags.json` sobre el LIVE (sin --url usa las 3 URLs del .env; contexto nuevo por URL, scroll, variante + add to cart en PDP; si la tienda usa GTM server-side/Stape con dominio propio, agrega --sgtm-host). Revisa data/tags.json: marca "opcional": true lo que no es obligatorio. Si /cart/add.js responde 429 (sesión marcada bot), anótalo: no es fallo.
Por tag: plataforma · ID · vía de carga (Web Pixels/Customer events, app embed, theme.liquid, GTM, Stape) · páginas · eventos observados · duplicados (mismo pixel dos veces, mismo evento a dos conversiones, propiedades sin identificar) · obsoletos (UA) · peso por página.
Salida:
- data/tags.json (esperados {plataforma, id}, generado por --save-expect = referencia del --expect del QA gate).
- docs/TAGS.md para el CLIENTE: lenguaje simple, sin nombres del equipo, columna "Decisión del cliente (mantener / retirar / revisar)" vacía, y la frase: mientras ustedes deciden no modificamos ningún tag, todos se tratan como activos.
- docs/TAGS-interno.md: detalle técnico y lo del Frente C.
Devuelve ≤10 líneas: nº de tags, duplicados, obsoletos, KB por página.
```

### Agente E · Consolidador (cuando A-D terminan)

```
Proyecto $PROJECT. Paso 4 del SOP ConvertMate: consolidación. No toques theme/ ni la tienda.
Insumo: CONSTRAINTS.md, docs/BASELINE.md, docs/TRACES.md, docs/AUDIT-CODE.md, docs/AUDIT-CONTENT.md, data/assets-plan.json, docs/TAGS.md, data/tags.json, CHANGELOG.md.
1. Cruza hipótesis de código (B) con atribuciones del trace (A): confirma, corrige o descarta. Un hallazgo sin evidencia de trace queda como hipótesis.
2. Une A/B/C/D en una sola lista sin duplicados, clasificada Frente A / B / C; apps de negocio como "costo identificado, intocable por mecánica de negocio" con su costo en ms y mitigación; tags en lista aparte (decisión del cliente). Cruza con CONSTRAINTS → bloqueado-avisar.
3. Propón el plan por fases y, para la Fase 1 de código, reparte los hallazgos listos en 3 carriles con ARCHIVOS DISJUNTOS: F1 header/layout/global · F2 videos/lazy/Instant · F3 imágenes/reseñas/colección. Si dos hallazgos tocan el mismo archivo, van al mismo carril. Lista los archivos de cada carril.
4. Salida: data/diagnostico.json (valida contra $TK/schemas/diagnostico.schema.json) + docs/DIAGNOSTICO.md (resumen ejecutivo en lenguaje de negocio, campo vs lab, hallazgos priorizados, plan; al final sección "INTERNO, no va al cliente" con Frente C y techos técnicos).
Devuelve ≤15 líneas: conteo por frente, top 5 y la tabla de carriles con sus archivos.
```

**Operador:** revisa DIAGNOSTICO.md, aprueba el plan (o el aprobador de CONSTRAINTS), ajusta carriles. Sin plan aprobado no hay Fase 2.

---

## FASE 2 · Fixes Frente A (3 carriles)

Antes de lanzar: `git status` limpio y en la rama `perf/AAAA-MM`. Prompt común + carril:

```
Proyecto $PROJECT. Paso 5 del SOP ConvertMate. Carril $CARRIL. Hallazgos asignados: $IDS (de data/diagnostico.json).
ARCHIVOS PERMITIDOS (solo estos): $ARCHIVOS. Cualquier otro archivo: repórtalo, no lo edites. Otros 2 agentes editan theme/ en paralelo.
Prohibido: commit, push, shopify CLI, tocar la tienda, settings_data.json, templates/*.json, quitar scripts de medición, cambiar comportamiento de apps encendidas (solo mitigar carga). Página con test A/B activo no se toca visualmente. Preservar la estética de las variantes que nombra CONSTRAINTS.
Lee $TK/prompts/playbook-tema-nativo.md (y playbook-instant.md si tocas sections/instant-*). En archivos generados por Instant: parche mínimo, marcado {% comment %} CM perf AAAA-MM {% endcomment %}, y anótalo para la lista de re-aplicar.
Por cada hallazgo, en orden: aplica el fix → verifica sintaxis Liquid/JS (llaves, {% end* %}, comillas) → escribe una entrada en $PROJECT/fixes-$CARRIL.md: id · archivos:líneas · qué y por qué · cómo verificarlo en preview · riesgo · si es Instant, texto exacto del parche para re-aplicar.
Devuelve ≤15 líneas: ids hechos, ids no hechos y por qué, archivos tocados.
```

| Carril | Típicamente | Archivos típicos |
|---|---|---|
| F1 header/layout | CLS del header, logo sin dims, fuentes/preconnect, librerías globales condicionales, código muerto, `body:has` → clases, includes de apps desinstaladas, Frente C condicionado | `layout/*.liquid`, `sections/header.liquid`, snippets globales del head, CSS global |
| F2 videos/lazy/Instant | videos sin autoplay/preload, src al viewport/click, lazy en galerías ocultas, parches Instant | `sections/instant-*.liquid`, snippets de funnel/variante, secciones y snippets de video |
| F3 imágenes/reseñas/colección | hero `<picture>`, eager solo index 1, fetchpriority LCP, reseñas lazy con dims, `sizes` de cards | hero/slideshow, image-with-text, reseñas, `main-collection-product-grid`, `product-tile*`/`card-product` |

**Operador, por fix** (el ciclo del Prompt 5, pero en lote):
```bash
git diff -- <archivos del fix>                    # revisar
git add <archivos del fix> && git commit -m "A-06 hero <picture> + eager solo index 1"
node $TK/scripts/push-changed.mjs                 # solo archivos de código cambiados vs baseline → $WORK_THEME_ID
```
Al terminar los 3 carriles: pasar `fixes-*.md` al CHANGELOG (tabla Fix · Archivos · Qué) y la sección **"Re-aplicar después de cada re-publish de Instant"**; marcar `aplicado` en `diagnostico.json`. `push-changed.mjs` hace smoke check; si falla, no se sigue.

---

## FASE 3 · Validación (2 agentes)

### Agente G · Medición del preview (MCP)

```
Proyecto $PROJECT. Paso 5 (medición) del SOP ConvertMate. Eres el ÚNICO agente con el MCP chrome-devtools. No toques theme/ ni la tienda.
Antes = docs/BASELINE.md (live, esta mañana). Después = PREVIEW del tema $WORK_THEME_ID con la MISMA metodología (SOP §2) y el mismo cálculo de métricas que la baseline (reproduce primero un número de la baseline desde su trace para confirmar el método).
Preview: en cada contexto aislado abre primero https://$DOMAIN/robots.txt?preview_theme_id=$WORK_THEME_ID y luego navega a la URL limpia; verifica Shopify.theme.id === $WORK_THEME_ID en cada corrida.
Por página (3 corridas, mediana): LCP con popup, LCP sin popup, CLS, TBT, FCP, KB, requests. Peso también "después − barra de preview" (~419 KB / 9 req; mide la barra en tu corrida). Repite la sesión de interacciones de la PDP (429 en cart/add = anotar y repetir más tarde).
Verifica los checks de los fixes (ver CHANGELOG): recurso LCP en prioridad High, sin doble descarga del hero, galerías ocultas sin requests, videos sin bytes al cargar.
Salida: docs/RESULTADOS-FASE<N>.md (tabla antes/después por página, corridas, checks pasa/falla, diferencias de método) + traces en data/traces/preview-*.json.gz. Devuelve ≤15 líneas.
```

### Agente H · QA gate (sin MCP)

```
Proyecto $PROJECT. Paso 6.5 del SOP ConvertMate (QA Gate). NO uses el MCP chrome-devtools. No toques theme/ ni la tienda.
1. Screenshot-diff: $TK/scripts/screenshot-diff.mjs live vs preview, mobile + desktop, las 3 URLs y las variantes de PDP de CONSTRAINTS. Contexto nuevo por captura y verificación de Shopify.theme.id en ambos lados. Ocultar popups, barra de preview, videos y congelar carruseles en AMBOS lados. Cada diferencia: esperada (del fix, con id) o inesperada (BLOQUEA).
2. Pixel-check: `node $TK/scripts/pixel-check.mjs --preview --expect data/tags.json` (3 URLs del .env, salida data/pixel-check-preview.json). Exit 1 / falta un tag esperado = BLOQUEADO.
3. Funcional con puppeteer sobre preview y live (móvil y desktop): $TK/templates/checklist-qa.md (variantes, add to cart, cart drawer, llegar a checkout sin pagar, popup abre/cierra, búsqueda, filtros, widget de bundle/suscripción, acordeones, sliders). 429 en cart/add = anotar como "no concluyente, verificar a mano", no como falla.
Salida: docs/QA-GATE-FASE<N>.md (tabla check · resultado · evidencia en data/qa/) + checklist-qa marcada. Devuelve ≤15 líneas: PASA / BLOQUEADO y por qué.
```

**Operador:** con RESULTADOS + QA-GATE en verde (o diferencias esperadas anotadas) → los tres resultados al CHANGELOG → Paso 6 (contenido, en la ventana) y Paso 7.
