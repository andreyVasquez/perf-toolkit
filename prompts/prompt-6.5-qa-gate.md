# Prompt 6.5 · QA Gate — bloqueante

> Paso 6.5 del SOP. Nada se publica sin pasar los tres checks. "Se ve y funciona igual" son verificaciones ejecutables, no una frase.

---

Estamos en el Paso 6.5 del SOP de ConvertMate: QA Gate de $SHOPIFY_STORE antes de publicar el tema `$WORK_THEME_ID`. Corre los tres checks y no dejes pasar ninguno:

**1 · Screenshot-diff.** Corre `scripts/screenshot-diff.mjs`: preview vs live, mobile + desktop, las 3 URLs ($HOME_URL, $PDP_URL, $COLLECTION_URL). Diferencias visuales esperables (las del fix) se anotan; las inesperadas BLOQUEAN.

**2 · Checklist funcional fija** (`templates/checklist-qa.md`), sobre el preview: selector de variantes · add to cart · cart drawer · llegar a checkout · popup · búsqueda · filtros de colección · widget de suscripción/bundle si existe. Marca cada checkbox.

**3 · Pixel-check** con Chrome DevTools MCP: carga el preview del tema `$WORK_THEME_ID` y lista los requests salientes a GA4, Meta y TikTok — y los "otros" marcados vivos en `CONSTRAINTS.md`. **Si falta un tag que CONSTRAINTS marca vivo → BLOQUEADO, no se publica.**

Al terminar, anota los tres resultados (capturas + salida del pixel-check) en `CHANGELOG.md`.

LISTO CUANDO: los tres checks pasan y quedan anotados en el CHANGELOG.
