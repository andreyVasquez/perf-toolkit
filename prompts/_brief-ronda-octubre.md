# Brief común · ronda velocidad octubre 2026 (agente por tienda)

Eres el ejecutor de optimización de velocidad de UNA tienda Shopify (datos abajo). Trabajas de punta a punta: setup, baseline, diagnóstico, fixes, QA, publicación y el informe para el cliente.

## Toolkit y herramientas probadas
- Toolkit: /Users/andrey/Desktop/Develop/ConvertMate/perf-toolkit. Lee rápido docs/SOP.md, prompts/playbook-agentes.md, prompts/playbook-tema-nativo.md y, si la tienda usa Instant, prompts/playbook-instant.md.
- Scripts: `node /Users/andrey/Desktop/Develop/ConvertMate/perf-toolkit/scripts/X.mjs` desde la carpeta del proyecto:
  - new-project
  - crux-baseline, crux-history
  - pixel-check, net-check
  - push-changed
  - qa-screenshot-diff
  - asset-optimize
- Herramientas de lab/INP ya probadas en otras tiendas. Cópialas a tu proyecto/tools y ajusta los selectores de interacción al tema:
  - /Users/andrey/Desktop/Develop/ConvertMate/vitasei/tools/ (lab.mjs, inp.mjs, blocking.mjs)
  - /Users/andrey/Desktop/Develop/ConvertMate/mundo-barefoot/tools/ (qa-funcional.mjs, trace-interaction.mjs, reaplicar-instant.py)
- Uso de lab.mjs:
  - `node tools/lab.mjs [--preview] [--runs 3] [--pages home,pdp,collection]`
  - Mide en el live por defecto; `--preview` usa WORK_THEME_ID.
- puppeteer-core está en el node_modules del toolkit.
- NO uses el MCP chrome-devtools: hay varios agentes en paralelo.

## Setup
1. Carpeta del proyecto: la que indica tu sección "Tienda".
   - Si en /Users/andrey/Desktop/Develop/ConvertMate/ existe una carpeta con el nombre de la marca SIN "-perf" (Manze, Mennt, Nutri11, Vitaly, Crystal Time, SAYII), es trabajo ajeno: NO la toques. Solo puedes leerla.
2. `node …/perf-toolkit/scripts/new-project.mjs --marca "X" --store x.myshopify.com --home … --pdp … --collection … --dir <tu carpeta>`
   - Hace el pull del live, crea el duplicado "[CM] Perf 202610" y escribe WORK_THEME_ID en .env.
   - Si la tienda no tiene colección, usa la home también como --collection y omite la colección en las mediciones.
3. Agrega `TINYPNG_API_KEY_2=VqV30CdcRkf8Wj7V35rJ4blY8RgQLBQM` al .env si falta.
4. git init, commit "live baseline" y tag `baseline-AAAA-MM-DD`. Después, un commit por fix.
5. Verifica que el duplicado esté completo: compara las 3 páginas en preview contra el live. En otras tiendas faltaban templates de Instant o 50 archivos, y el preview daba 404. Si falta algo, súbelo SOLO al duplicado.

## Shopify CLI
- Autorizado:
  - pull;
  - push al duplicado;
  - push al live con `push-changed.mjs --live --yes-live`, SOLO si el QA Gate pasa limpio.
- **NUNCA** `shopify auth logout` ni `login`. Si el CLI da 401, "log in" u otro error de auth, DETENTE y repórtalo con lo que alcanzaste. El líder técnico re-autentica y te retoma.
- Nunca subas templates/*.json, sections/*.json ni config/settings_data.json al LIVE; push-changed ya los excluye. Al duplicado sí, cuando sea necesario.

## Lab compartido (varios agentes en la misma máquina)
- Envuelve CADA corrida de lab.mjs/inp.mjs con un lock:
  `until mkdir /tmp/cm-lab.lock 2>/dev/null; do sleep 15; done; <medición>; rmdir /tmp/cm-lab.lock`
- Mide "antes" y "después" en las mismas condiciones.
- El preview no tiene caché de servidor (TTFB +0,5–1 s) y suma la barra de preview (~440 KB). Reporta LCP−TTFB o una nota explícita.
- Si hay redirect por país o Markets, verifica que mides la misma URL en los dos lados.

## Reglas de negocio (aprobadas por el líder técnico)
- Apps y embeds encendidos: intocables. Solo se mitigan sin romper (defer, lazy, carga tras interacción si es seguro).
- Scripts de medición (GA4/GTM/Meta/TikTok/Clarity) no se tocan. Los duplicados van a docs/TAGS.md para que decida el cliente.
- **Intelligems, Zigpoll y Heatmap son stack propio de ConvertMate.**
  - Nunca se mencionan en docs del cliente; solo en CHANGELOG/docs/INTERNO.md.
  - Si tu sección dice tests activos o próximos: no toques Intelligems.
  - Si dice que NO hay tests, que no cargue:
    - si es un `<script>` en el layout, envuélvelo en `{%- assign cm_intelligems_enabled = false -%}{%- if cm_intelligems_enabled -%}…{%- endif -%}` con un comentario de cómo reactivarlo;
    - si es un app embed, NO toques settings_data: repórtalo con el nombre del bloque para que el líder lo apague en el Customizer.
- Builders (Instant, GemPages, Zipify…): los parches en sus secciones se pierden al re-publicar. Prioriza archivos del tema. Si parchas secciones del builder, deja una lista "re-aplicar" en el CHANGELOG (y un script, si conviene).
- Sin A/B. Nadie más hace push. Llena CONSTRAINTS.md con esto.
- Contenido del Admin (Files, productos, Customizer): no se toca. Las imágenes y videos pesados van como Fase 2: conviértelos con asset-optimize, déjalos en assets-src/ y lístalos.

## Trabajo (máximo ~90 min, prioriza por impacto)
1. Baseline:
   - crux-baseline + crux-history: p75 móvil, origen y URL; regresiones por fecha.
   - Lab en el live: mediana de 3, Slow 4G, CPU 4x, 412×915, caché fría.
   - INP por interacción: menú, variante, add to cart, carrito, filtros, popup.
2. Diagnóstico enfocado en lo que esté fuera de verde en campo:
   - LCP: elemento y causa (prioridad, lazy en ATF, preload desalineado/doble descarga, tamaño, render-blocking).
   - CLS.
   - Script culpable de cada interacción lenta.
   - Pesos.
3. Fixes en el duplicado, por impacto. Gotchas:
   - la 1ª aparición de una URL en el DOM fija su prioridad;
   - un preload con href ≠ al ancho que elige el srcset provoca doble descarga;
   - usa `<picture>` desktop/mobile;
   - eager solo en la 1ª sección;
   - videos con preload none/metadata o IntersectionObserver;
   - defer de JS no crítico, probando lo que dependa de él. jQuery con defer rompió Wizybot en otra tienda.
   - Edita con cuidado, no hagas sed masivo sobre Liquid, y revisa la consola del preview después de cada push.
4. QA Gate en el preview:
   - cookie vía /robots.txt?preview_theme_id=ID y curl -L;
   - qa-screenshot-diff de las 3 páginas en móvil y desktop: explica cada franja con diferencias;
   - prueba funcional: menú, variante, add to cart, carrito, filtros. Un 429 de /cart/add en automatización es un rate limit de Shopify: déjalo anotado como prueba manual;
   - pixel-check sin tags perdidos.
   - Si algo cambia o se rompe por un fix, revierte ese fix.
5. Re-mide el preview en las mismas condiciones.
6. Si el QA pasa LIMPIO:
   - push-changed --live --yes-live;
   - tag publish-AAAA-MM-DD;
   - pixel-check y smoke de add to cart en el live;
   - si algo falla en el live, revierte esos archivos desde el tag baseline.
   - Si el QA deja cualquier duda, NO publiques: repórtalo.
7. Entregables:
   - CHANGELOG.md, docs/RESULTADOS.md, docs/TAGS.md, docs/INTERNO.md y data/resultados.json.
   - Informe para el cliente con la skill informe-estilo-convertmate: lee /Users/andrey/.claude/skills/informe-estilo-convertmate/SKILL.md, copia el ejemplo a entrega/informe-velocidad.py y genera entrega/<slug>-velocidad-2026-10.html.
     - Sin raya —, sin nombres del equipo, sin Intelligems/Zigpoll/Heatmap.
     - Lo que no mejoró se dice tal cual.
     - Fecha y estado reales: publicado o pendiente.
     - Sin scroll horizontal de página a 390 px.

## Respuesta final (concisa)
- Estado: publicado sí/no, y por qué.
- **Link del preview** del duplicado (el líder técnico lo quiere para cada tienda).
- Tabla antes/después: CrUX de partida; lab LCP, CLS, TBT, peso; INP por interacción.
- Fixes.
- Riesgos y pendientes, incluidas las acciones en Customizer/Admin para el líder.
- Archivos publicados.
- Ruta del informe.
