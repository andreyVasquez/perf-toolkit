# Prompt 4 · Auditoría — clasifica en tres frentes

> Paso 4 del SOP. Prerequisito: `CONSTRAINTS.md` sin PENDIENTES (GATING) y baseline LISTO. Sin fixes todavía.

---

Estamos en el Paso 4 del SOP de ConvertMate: auditoría de $SHOPIFY_STORE. Solo diagnóstico — NO apliques ningún fix.

**Traces** con Chrome DevTools MCP en $HOME_URL, $PDP_URL y $COLLECTION_URL — metodología fija de la sección 2 (Slow 4G, 4x CPU, 412×915, caché fría), mediana de 3 corridas por página:
- Atribución de LCP / CLS / INP.
- Recursos render-blocking.
- Costo individual de cada third-party en ms.
- Payloads mayores.

**Análisis de código** en `theme/`, en este orden: `layout/theme.liquid` (head) → `assets/*.js` → `sections/header.liquid` → snippets con scripts → sections de home/PDP/colección.

**Clasificación de cada hallazgo** — con archivo y línea exacta (o URL del asset):
- Frente A — código del tema (se arregla en el Paso 5, en la copia).
- Frente B — contenido del Admin: imágenes, videos, apps (Paso 6, pega en vivo al instante).
- Frente C — stack propio (Intelligems, Heatmap, Zigpoll, Alia): se audita SIEMPRE, nunca aparece en el reporte al cliente.
- Apps de negocio del cliente (Addi, kaching, etc.): SÍ van al reporte como "costo identificado — intocable por mecánica de negocio", con costo en ms y mitigación posible (lazy load, facade, defer). Nunca como recomendación de quitarlas.
- Scripts de medición (Google/Meta/TikTok): lista aparte, no se tocan sin la confirmación del Paso 1.
- Scripts que maquillan métricas (detectan bots o Lighthouse): eliminar siempre.

En contenido (Frente B) busca: SVG > 50 KB (el CDN no los redimensiona) → WebP/PNG 1080px < 150 KB · GIF animado → MP4 H.264 + poster · video autoplay → 720p 2–3 Mbps o poster + clic · app deshabilitada pero instalada → desinstalar (protocolo sección 9).

Cada hallazgo con: métrica impactada, severidad, esfuerzo (quick-win < 2h / medio 2–8h / complejo 8h+), riesgo. Cruza con `CONSTRAINTS.md` → estado `bloqueado-avisar` donde aplique.

La corroboración de campo usa `crux-baseline.mjs` y el dashboard de Shopify — PageSpeed Insights no se usa en ninguna parte del proceso.

Salida: `data/diagnostico.json` validando contra `schemas/diagnostico.schema.json` + `docs/DIAGNOSTICO.md`.

LISTO CUANDO: cada hallazgo está clasificado A/B/C en `diagnostico.json` y el plan está aprobado antes de tocar código.
