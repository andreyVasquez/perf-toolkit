# Prompt 3 · Baseline — mide el punto de partida

> Paso 3 del SOP. Prerequisito: Paso 2 LISTO. Requiere `$CRUX_API_KEY` en el `.env` y el MCP chrome-devtools activo.

---

Estamos en el Paso 3 del SOP de ConvertMate: baseline de $SHOPIFY_STORE. La metodología de medición es la FIJA de la sección 2 del SOP — no se re-decide ni se documenta por auditoría, se referencia: Slow 4G · CPU 4x · viewport 412×915 móvil · caché fría · 3 corridas por página, se reporta la mediana · campo = CrUX API p75 móvil ventana 28 días · entorno de campo PRODUCCIÓN, nunca preview.

Páginas (las 3 de más tráfico): $HOME_URL · $PDP_URL · $COLLECTION_URL

Tu tarea:
1. Corre `scripts/crux-baseline.mjs` y `scripts/crux-history.mjs` con `$CRUX_API_KEY`.
2. Aplica la escalera de fallback cuando no haya data de campo, en orden y sin saltarse niveles: (1) CrUX page-level → (2) CrUX origin-level → (3) dashboard Web Performance de Shopify filtrado por tipo de página → (4) reporte ShopifyQL con CSS selectors. Anota qué nivel se usó por página.
3. Mide el peso por página de las 3 URLs con Chrome DevTools MCP usando la metodología fija (mediana de 3, caché fría).
4. Pídeme la captura del dashboard Web Performance del admin de Shopify como estado inicial.
5. Salida: `data/baseline.json` validando contra `schemas/baseline.schema.json` (fuente por medición: crux-page | crux-origin | shopify-rum | lab; `metodologia_version: "2.0"`) + `docs/BASELINE.md` legible.

PageSpeed Insights no se usa en ninguna parte del proceso.

LISTO CUANDO: existe `baseline.json` validando contra el schema, con CrUX (o su fallback anotado), peso de las 3 páginas y la captura del dashboard.
