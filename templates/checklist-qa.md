# Checklist funcional — QA Gate (Paso 6.5)

Se corre sobre el **preview** del tema de trabajo (y el mismo recorrido sobre el live para comparar), móvil 412 y desktop 1440, en las 3 URLs cuando aplique. Cualquier ítem que falle BLOQUEA la publicación.

Lo puede correr el Agente H con puppeteer (`prompts/playbook-agentes.md`, Fase 3). Lo que el script no pueda concluir se verifica a mano.

- [ ] Selector de variantes funciona (todas las variantes; las que cambian la estética según CONSTRAINTS se ven igual que en el live)
- [ ] Add to cart funciona
- [ ] Cart drawer abre y actualiza
- [ ] Se llega a checkout (sin pagar)
- [ ] Popup aparece y cierra
- [ ] Búsqueda funciona
- [ ] Filtros de colección funcionan
- [ ] Widget de suscripción/bundle funciona (si existe)
- [ ] Acordeones, sliders y videos tocados por los fixes: abren, avanzan y reproducen al entrar en viewport o al click
- [ ] Imágenes lazy de galerías ocultas aparecen al mostrarse (otra variante, drawer, popup)

**Fecha:** ______ · **Ejecutado por:** ______ · **Tema:** ______

**Trampas de la automatización:**
- Preview con cookie: abrir primero `/robots.txt?preview_theme_id=ID` y verificar `Shopify.theme.id` en cada página. Contexto de navegador nuevo por captura: si no, la cookie de preview se pega y el "live" sale del preview.
- **429 en `/cart/add.js`** = Shopify marcó la sesión como bot. Es "no concluyente", no falla: repetir más tarde con sesión limpia o a mano.
- Ocultar popup, barra de preview y videos y congelar carruseles **en ambos lados** antes del screenshot-diff.

> Este checklist es el check 2 de 3 del QA Gate. Los otros dos: screenshot-diff (`scripts/screenshot-diff.mjs`) y pixel-check (`scripts/pixel-check.mjs --preview --expect data/tags.json`: el preview debe disparar los mismos tags que el inventario del live). Los tres resultados se anotan en el CHANGELOG.
