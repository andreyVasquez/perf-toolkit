> **Nota:** la fuente canónica de este SOP es el Google Doc (comentable). Esta copia en el repo es de referencia; ante cualquier diferencia, manda el Doc.

# SOP — Optimización de Velocidad Shopify · ConvertMate
**Versión 2.0 · Julio 2026**
Reemplaza y fusiona: *Protocolo interno de performance (julio 2026)* + *Runbook de auditoría con Claude Code (jul-02)*. A partir de hoy, esos dos documentos dejan de usarse.

**Dónde vive:** este documento en Google Doc (comentable) · todo lo ejecutable en el repo **`perf-toolkit`** (scripts, prompts, schemas, skills). El Doc describe; el repo ejecuta.

**Validado por:** ejecución real de Chris (Travesuras) y Santi (The Gummy Box). Las fricciones encontradas alimentan la v2.1.

---

## 1 · Criterio de éxito

El proyecto **cierra con la entrega del informe al publicar**, con resultados inmediatos y verificables:

1. **Fixes aplicados y documentados** (CHANGELOG por fix).
2. **Peso por página antes/después** (KB y %, con la metodología fija de la sección 2).
3. **Validación técnica de mejora** en ms (traces preview vs live, mediana de 3).

**Follow-up a los 2–3 días:** captura del panel **Web Performance del admin de Shopify del cliente** — RUM con usuarios reales y delay de ~36h. Es la evidencia de campo temprana, en el dashboard del propio cliente.

**El verde de CrUX se comunica como expectativa, nunca como promesa contractual:**

> *Redacción para el intake:* "Éxito de la ronda: entrega del informe con los fixes aplicados, la reducción de peso por página (antes/después) y la validación técnica de mejora. A los 2–3 días compartimos la evidencia con usuarios reales desde el panel Web Performance de tu admin de Shopify. La confirmación oficial de Google (CrUX) se refleja en ~4 semanas, porque promedia una ventana de 28 días."

**Uso interno (no va al cliente):** si en los traces se identifica un techo técnico (apps de negocio, TTFB de Shopify) que impide el verde, se documenta en DIAGNOSTICO.md con evidencia. Es el respaldo si el cliente pregunta a las 4 semanas por qué una métrica no llegó a verde.

---

## 2 · Metodología de medición — FIJA

No se ajusta por auditoría ni por preferencia personal. Si algún día se cambia, se cambia aquí, se versiona, y las mediciones anteriores se marcan como no comparables.

| Parámetro | Valor |
|---|---|
| Red simulada | Slow 4G (perfil estándar DevTools) |
| CPU throttling | 4x |
| Viewport | 412 × 915 (móvil). Desktop solo como secundario |
| Caché | Fría, siempre |
| Corridas | 3 por página · se reporta la **mediana** |
| Hora | Cualquiera (la mediana absorbe la varianza) |
| Dato de campo | CrUX API · p75 móvil · ventana 28 días |
| Páginas | Home · PDP best seller · Colección top — las 3 de MÁS tráfico según Analytics |
| Entorno de campo | PRODUCCIÓN, nunca preview |

**Escalera de fallback cuando no hay data de campo** (en orden, sin saltarse niveles):
1. CrUX **page-level** (ideal)
2. CrUX **origin-level**
3. **Dashboard Web Performance de Shopify** filtrado por tipo de página (trackea más tráfico que CrUX, delay ~36h)
4. Diagnóstico fino: reporte **ShopifyQL** con CSS selectors (identifica QUÉ elemento es el LCP / causa el CLS con usuarios reales)

En BASELINE.md siempre se anota **qué nivel de la escalera se usó** por página.

---

## 3 · Reglas de oro

1. **Nunca sobre el tema vivo.** Todo cambio de código va al duplicado despublicado.
2. **El contenido no tiene copia.** Imágenes, videos y apps pegan en la tienda viva al instante → ventana de bajo tráfico, siempre.
3. **Nunca quitar un script de medición** (Google, Meta, TikTok) sin confirmación escrita — y después de cualquier cambio, el **pixel-check del Paso 6.5 es obligatorio**.
4. **Nunca publicar** sin aprobación escrita del cliente **y** QA Gate (Paso 6.5) aprobado.
5. **Git local por tienda** (repo NO conectado a la tienda; push/pull siempre vía Shopify CLI): rama `perf/AAAA-MM`, commit por bloque de fixes, **tag al publicar**. Además, zip del tema vivo antes de arrancar (respaldo independiente de git).
6. **El stack propio jamás aparece en el reporte al cliente** (ver Frente C, sección 6).
7. **Página con test A/B activo no se toca visualmente** hasta que el test cierre.
8. Nunca usar `--allow-mutations` ni `push --live`.

---

## 4 · El toolkit (repo `perf-toolkit`)

```
perf-toolkit/
├── scripts/
│   ├── lib.mjs                # utilidades compartidas (CrUX API, .env, escalera, tablas)
│   ├── crux-baseline.mjs      # p75 + histogramas, PHONE/DESKTOP, origin + 3 URLs
│   ├── crux-history.mjs       # serie semanal ~6 meses (backtesting y cierre)
│   ├── perf-check.mjs         # tabla semáforo de todas las marcas (--all lee stores.json)
│   └── screenshot-diff.mjs    # preview vs live, mobile+desktop, 3 URLs
├── schemas/
│   ├── baseline.schema.json
│   ├── diagnostico.schema.json
│   ├── resultados.schema.json
│   └── ejemplos/              # un JSON válido por schema
├── prompts/                   # los 8 prompts del SOP, versionados
├── skills/
│   ├── convertmate-report/    # PDFs de entregables con marca (SKILL.md + build-pdf.mjs + template + fonts)
│   ├── performance/           # Addy Osmani, versión pinneada
│   └── core-web-vitals/       # Addy Osmani, versión pinneada
├── templates/
│   ├── CONSTRAINTS.md         # plantilla v2 (sección 5, Paso 1)
│   ├── checklist-qa.md        # checklist funcional del Paso 6.5
│   ├── mensajes-cliente.md    # intake, aviso de ventana, follow-up dashboard
│   └── env.example            # se copia como .env por proyecto (Paso 1)
├── package.json               # deps de screenshot-diff (puppeteer-core, pixelmatch, pngjs)
└── stores.json                # marcas y sus 3 URLs (para perf-check --all)
```

### Setup único por máquina (reemplaza la Parte A del runbook viejo)

```bash
# 1. Clonar el toolkit (actualizarlo después es solo git pull)
git clone <repo>/perf-toolkit ~/perf-toolkit
cd ~/perf-toolkit && npm install   # deps de screenshot-diff.mjs

# 2. MCP de Chrome DevTools a nivel usuario
claude mcp add -s user chrome-devtools npx chrome-devtools-mcp@latest
claude mcp list   # debe aparecer chrome-devtools

# 3. Skills desde el repo (NUNCA instalación individual desde GitHub)
mkdir -p ~/.claude/skills
cp -R ~/perf-toolkit/skills/* ~/.claude/skills/
# Verificar dentro de claude con /skills: convertmate-report, performance, core-web-vitals
```

**Eliminado del setup viejo:** el paso A.3 (remote debugging sobre tu Chrome personal). El MCP lanza su **propia instancia aislada con perfil limpio** — el Chrome personal ensucia los traces con extensiones y sesiones, y expone tus cuentas logueadas.

**Prueba de humo del setup:** en cualquier carpeta, `claude` → "Check the performance of https://developers.chrome.com". Si abre Chrome y graba trace, listo.

---

## 5 · El proceso — 8 pasos

Se corren en orden, sin saltarse ninguno. Cada paso tiene su prompt en `prompts/` y su criterio de LISTO.

---

### PASO 1 · Intake y CONSTRAINTS — pregunta antes de tocar nada

En la carpeta del proyecto: `.env` (lo llenas tú) y `CONSTRAINTS.md` (respuestas del cliente, desde `templates/CONSTRAINTS.md`).

```
# .env
SHOPIFY_STORE= HOME_URL= PDP_URL= COLLECTION_URL=   ← las 3 de MÁS tráfico (Analytics)
CRUX_API_KEY=  WORK_THEME_ID=                        ← se llena en el Paso 2
```

**CONSTRAINTS.md v2 — secciones:**
- **Apps intocables (mecánica de negocio del cliente):** app · por qué · a quién avisar. *(Addi, kaching y similares entran aquí — ver regla de reporte en Paso 4.)*
- **Tags de medición confirmados VIVOS:** Google / Meta / TikTok / otros · quién confirmó · fecha.
- **Tests A/B activos (Intelligems u otro):** sí/no · página · fecha de fin. *Regla: página con test activo = no se toca visualmente.*
- **Acceso al Admin verificado:** checkbox (colaborador con Themes, Apps, Files y Productos confirmado y probado).
- **Ventana de bajo tráfico (contenido):** día/hora acordados.
- **Aprobador de publicación:** nombre · canal.
- **Criterio de éxito acordado por escrito:** la redacción de la sección 1, con fecha.

**GATING:** cualquier sección en PENDIENTE = **no se corre nada del Paso 4 en adelante**.

`LISTO CUANDO` CONSTRAINTS.md no tiene PENDIENTES.

---

### PASO 2 · Conecta la tienda y haz tu copia

```bash
shopify theme list --store $SHOPIFY_STORE            # login navegador
shopify store auth --store $SHOPIFY_STORE \
  --scopes read_products,read_content,read_themes,read_script_tags
shopify store execute --store "$SHOPIFY_STORE" \
  --query '{ shop { name myshopifyDomain } }'         # prueba: devuelve el nombre
shopify theme pull --store $SHOPIFY_STORE --live --path ./theme
cd theme && zip -r ../backup-live-$(date +%F).zip . && cd ..
git init && git add -A && git commit -m "live baseline $(date +%F)"
git checkout -b perf/$(date +%Y-%m)
shopify theme push --unpublished --path ./theme       # duplicado "[CM] Perf AAAAMM" → ID al .env
```

Recuerda: `set -a && source .env && set +a` antes de usar las variables (cada shell es nueva).

`LISTO CUANDO` el `store execute` devuelve el nombre, existe el zip, el repo git tiene el commit baseline y `WORK_THEME_ID` quedó en el `.env`.

---

### PASO 3 · Mide el punto de partida

**Prompt 3 — Baseline** *(en `prompts/`)*: corre `crux-baseline.mjs` + `crux-history.mjs` (aplica la escalera de fallback de la sección 2 y anota el nivel usado por página) · peso por página con Chrome DevTools MCP usando la **metodología fija de la sección 2** (no se re-decide ni se documenta por auditoría: se referencia) · captura del **dashboard Web Performance de Shopify** como estado inicial · salida: `data/baseline.json` (schema del repo) + `docs/BASELINE.md`.

`LISTO CUANDO` existe `baseline.json` validando contra el schema, con CrUX (o su fallback anotado), peso de las 3 páginas y la captura del dashboard.

---

### PASO 4 · Audita y clasifica en TRES frentes

| Frente | Qué es | Dónde se arregla |
|---|---|---|
| **A — Código del tema** | Vive en tu copia, se prueba aislado | Paso 5 |
| **B — Contenido del Admin** | Imágenes, videos, apps. Global: pega en la tienda viva al instante | Paso 6 |
| **C — Stack propio** (Intelligems, Heatmap, Zigpoll, Alia) | Se audita SIEMPRE, **nunca aparece en el reporte** | Workstream interno (sección 6) |

**Apps de negocio del cliente (Addi, kaching, etc.):** SÍ aparecen en el reporte, como **"costo identificado — intocable por mecánica de negocio"**, con su costo en ms y la mitigación de carga posible (lazy load, facade, defer). **Nunca** como recomendación de quitarlas. Ocultarlas deja el reporte incompleto; proponer quitarlas invita al cliente a romper su propia operación.

**Qué buscar en contenido (Frente B) — fix estándar:**
| Hallazgo | Fix |
|---|---|
| SVG > 50 KB (el CDN no los redimensiona) | WebP/PNG · 1080px · <150 KB |
| GIF animado | MP4 H.264 + poster (90–95% menos) |
| Video autoplay | 720p · 2–3 Mbps, o poster + clic |
| App deshabilitada pero instalada | Desinstalar (protocolo de la sección 9) |

**Scripts de terceros:** medición (Google/Meta/TikTok) → lista aparte, no se tocan sin la confirmación del Paso 1. Scripts que **maquillan métricas** (detectan bots o Lighthouse) → **eliminar siempre**.

**Prompt 4 — Auditoría** *(anexo con los prompts del runbook viejo, mejorados)*: traces con DevTools MCP en las 3 URLs — **mediana de 3 corridas**, atribución de LCP/CLS/INP, render-blocking, costo individual de cada third-party, payloads mayores · análisis del código en `theme/` en este orden: `layout/theme.liquid` (head) → `assets/*.js` → `sections/header.liquid` → snippets con scripts → sections de home/PDP/colección · cada hallazgo con **archivo y línea exacta**, clasificado A/B/C, métrica impactada, severidad, esfuerzo (quick win <2h / medio 2–8h / complejo 8h+), riesgo · cruza con CONSTRAINTS → `BLOQUEADO-AVISAR` donde aplique · **la corroboración de campo usa `crux-baseline.mjs` y el dashboard de Shopify — PageSpeed Insights no se usa en ninguna parte del proceso** · salida: `data/diagnostico.json` + `docs/DIAGNOSTICO.md`. Sin fixes todavía.

`LISTO CUANDO` cada hallazgo está clasificado A/B/C en `diagnostico.json` y el plan está aprobado antes de tocar código.

**► Entregable 1 — Reporte de auditoría** (si el proyecto lo incluye): se genera desde `diagnostico.json` con el skill `convertmate-report` (sección 7).

---

### PASO 5 · Arregla el código — Frente A, solo en tu copia

Ciclo por cada fix: **commit → explicar qué y por qué → OK propio → cambiar → push al duplicado → medir en preview** (traces + peso antes/después en ms y KB) → entrada en CHANGELOG.md.

Reglas del prompt: solo al `WORK_THEME_ID` · respeta CONSTRAINTS y la regla de scripts de medición · **no tocar `settings_data.json` ni `templates/*.json`** · publicar NO es parte de este paso.

`LISTO CUANDO` cada fix tiene su antes/después en CHANGELOG.md.

---

### PASO 6 · Arregla el contenido — Frente B, es global

Sin copia posible: cada asset reemplazado pega en la tienda viva al instante. **Solo en la ventana de bajo tráfico** acordada en el Paso 1, con aviso al cliente el día anterior (plantilla en `templates/mensajes-cliente.md`).

Plan por asset: URL actual · peso · spec destino · orden de reemplazo. Assets ya convertidos antes de que abra la ventana.

**Desinstalación de apps:** siempre con el protocolo de la sección 9 (export + confirmación escrita). Sin excepciones.

`LISTO CUANDO` los assets quedaron subidos dentro de la ventana y las apps acordadas fueron desinstaladas con su respaldo hecho.

---

### PASO 6.5 · QA GATE — bloqueante, nuevo

Nada se publica sin pasar los tres checks. "Se ve y funciona igual" deja de ser una frase: son verificaciones ejecutables.

1. **Screenshot-diff** — `screenshot-diff.mjs`: preview vs live, mobile + desktop, las 3 URLs. Diferencias visuales esperables (las del fix) se anotan; las inesperadas bloquean.
2. **Checklist funcional fija** (`templates/checklist-qa.md`): selector de variantes · add to cart · cart drawer · llegar a checkout · popup · búsqueda · filtros de colección · widget de suscripción/bundle si existe.
3. **Pixel-check** — prompt de DevTools MCP: carga el preview y lista los requests salientes a GA4, Meta y TikTok (y los "otros" de CONSTRAINTS). **Si falta un tag que CONSTRAINTS marca vivo → BLOQUEADO, no se publica.** Esta es la trampa que ya nos costó en LABIF, convertida en check.

`LISTO CUANDO` los tres checks pasan y quedan anotados (capturas + salida del pixel-check) en el CHANGELOG.

---

### PASO 7 · Publica, entrega y follow-up

1. **Aprobación escrita** del aprobador sobre el link de preview.
2. **Re-sincroniza** `settings_data.json` y `templates/*.json` desde el tema vivo (el cliente pudo tocar el Customizer; publicar sin esto le borra sus cambios).
3. **Smoke-QA post-resync** (5 min): home, PDP y checkout cargan y funcionan en el preview. Lo publicado debe ser lo aprobado — el resync pudo cambiar algo.
4. **Publica** desde el Admin (Temas → Publicar) y **tag en git** (`publish-AAAA-MM-DD`).
5. **Re-mide** peso con la misma metodología (sección 2) → `data/resultados.json`.
6. **► Entregable 2 — Informe de entrega** con `convertmate-report` (sección 7): qué se hizo por frente, peso antes/después, validación en ms, y los dos próximos hitos (dashboard en 2–3 días, CrUX en ~4 semanas).
7. **Follow-up +2–3 días:** captura del dashboard Web Performance del cliente con la mejora de usuarios reales → se envía con la plantilla de `mensajes-cliente.md`. **Con esto el proyecto cierra.**

`LISTO CUANDO` el informe fue enviado y el follow-up del dashboard quedó agendado.

---

## 6 · Frente C — Stack propio (interno, invisible al cliente)

Intelligems, Heatmap, Zigpoll y Alia se **auditan y miden siempre** (costo en ms en cada trace). Si su costo es material (ej.: Intelligems bloqueando render ~3s en móvil, hallazgo real de rondas anteriores), se abre un **workstream interno con responsable y deadline** — no un "lo vemos después": si el frente C no se optimiza, las CWV del cliente no mejoran y el criterio de éxito de la sección 1 no se cumple.

Nada del Frente C aparece en reportes, y **jamás** se le propone al cliente evaluar o quitar nuestro stack de recolección.

---

## 7 · Entregables — generados, no redactados

Dos plantillas, dos momentos. Ambas salen de los JSON del proyecto y se convierten en **PDF con marca ConvertMate** usando el skill `convertmate-report` del toolkit (fragmento HTML con las clases del kit → `build-pdf.mjs` → PDF A4 con banda, paleta y tipografía de la empresa).

**1 · Reporte de auditoría** (post Paso 4). Estructura fija: resumen ejecutivo en lenguaje de negocio · metodología · resultados por página (lab vs campo vs umbral) · problemas priorizados (severidad × esfuerzo) · plan por fases con **rangos de esfuerzo, no fechas** · mejora esperada en **rangos conservadores, nunca cifras exactas** · riesgos e integraciones sensibles · próximos pasos.

**2 · Informe de entrega** (Paso 7). Qué se hizo por frente · tabla peso antes/después con `.delta` · validación técnica en ms · próximos hitos (dashboard, CrUX estimado) · `footer.method` con la metodología.

**QA humano antes de enviar cualquier PDF** (nadie lo delega a Claude Code):
- Los números coinciden con `data/*.json` (nunca contra una corrida nueva de otra herramienta).
- Proyecciones en rangos conservadores, no promesas.
- Ningún fix listado pone en riesgo tracking/checkout sin su flag.
- Nada del Frente C ni datos internos en el documento.
- Nombre del cliente, fechas y URLs correctos.
- El PDF abierto: sin cortes feos de página (usar `.page-break` si hace falta).

---

## 8 · Regresiones

`perf-check.mjs --all` lee `stores.json` y escupe la tabla semáforo CrUX de todas las marcas en una corrida. **Opcional y a demanda** — sin calendario ni rutina. Existe para cuando alguien quiera revisar el estado del portafolio o ante una sospecha puntual.

---

## 9 · Reglas operativas

**Autonomía.** Cada uno ejecuta sus proyectos completos sin peer review. Única obligación de visibilidad: un cambio que toque **checkout o tracking** se avisa en team-dev (aviso, no permiso).

**Desinstalación de apps — protocolo, sin excepciones:**
1. Export o screenshots completos de la configuración de la app (descuentos, flows, settings).
2. Confirmación **escrita** del cliente de que la app se puede desinstalar.
3. Verificar que ninguna mecánica de negocio cuelga de ella (cruce con CONSTRAINTS).
4. Desinstalar → entrada en CHANGELOG con fecha y respaldo linkeado.

**Rollback post-publicación — triggers separados:**
- **Inmediato, sin consultar** (se avisa después): checkout roto o pixel de medición muerto. Se restaura el tema anterior desde el Admin.
- **Consultar antes** (cliente/jefe): síntomas ambiguos — caída de CVR, quejas aisladas, comportamiento raro sin error claro.
- El tema anterior y el zip se conservan **mínimo 5 semanas** post-publicación (cubre la ventana completa de CrUX).

---

## 10 · Trampas conocidas

1. **La data de CrUX tarda ~4 semanas** (ventana de 28 días). Medir al día siguiente de publicar "demuestra" que no sirvió. El puente es el dashboard de Shopify (~36h).
2. **Tags de medición:** confirmar cuáles siguen vivos ANTES de retirar scripts (nos pasó en LABIF) **y verificar que disparan DESPUÉS** (pixel-check del 6.5).
3. **Tests activos de Intelligems:** cambios visuales sobre una página con test corriendo ensucian la data del experimento — y esa data es nuestra. No se toca hasta que cierre.
4. **Stack propio vs apps del cliente:** nunca poner al cliente a deliberar sobre nuestras herramientas de recolección (Frente C). Las apps de negocio del cliente se reportan como costo intocable con mitigación, nunca como "quítala".
5. **El CDN de Shopify no redimensiona SVG** — un SVG de 2 MB llega entero al usuario.
6. **El cliente puede tocar el Customizer** durante el proyecto aunque diga que no: por eso existen el resync y el smoke-QA del Paso 7.
7. **Apps con cuota agotada** cargan su script pero no funcionan: peso muerto que nadie nota.
8. **Configs de prueba en producción** (un caso: 12 copias del mismo script).
9. **Scripts que maquillan métricas** (detectan bots/Lighthouse): se eliminan siempre, sin preguntar.
10. **Shopify tiene un techo:** TTFB, parte del JS de plataforma y apps de terceros no se controlan. Prometer verde absoluto sin tocar apps de negocio suele ser irreal — por eso el criterio de éxito de la sección 1 no promete verde.
11. **Un trace no es un dato, es una muestra:** siempre mediana de 3, siempre corroborada con campo. Una corrida sola la refuta cualquiera con otra corrida.
12. **El Chrome personal ensucia los traces** (extensiones, sesiones): el MCP usa su instancia aislada, nunca el navegador de uso diario.

---

## 11 · Validación y mantenimiento del SOP

- **Prueba de fuego:** Chris ejecuta Travesuras y Santi ejecuta The Gummy Box con este SOP y el toolkit, teclado de ellos. Cada atasco se anota — esa lista es el backlog de la v2.1, no una lista de regaños.
- **Loom complementario:** se graba después de esa primera ejecución validada (grabar el proceso antes de probarlo es grabar errores).
- **El catálogo de fixes se alimenta solo:** cada `diagnostico.json` nuevo suma sus hallazgos al conocimiento común del Paso 4.
- Cambios al SOP: propuesta comentada en este Doc → se acuerda → se versiona aquí y en el repo.

---
*Metodología resumida: CrUX API (usuarios reales, p75 móvil, 28 días) y dashboard de Shopify como datos de campo · Chrome DevTools MCP como diagnóstico (Slow 4G · 4x CPU · 412×915 · caché fría · mediana de 3) · peso por página con parámetros fijos para comparar entre marcas y en el tiempo · entregables generados desde JSON con el kit de marca ConvertMate.*
