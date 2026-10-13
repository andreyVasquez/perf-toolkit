# Guía rápida · Ronda de velocidad Shopify en un día
**v2.1 · Un operador + Claude Code.** La referencia completa es `docs/SOP.md` (canónico: Google Doc). Esto es la ruta rápida; si algo contradice al SOP, gana el SOP, salvo la **ruta B de publicación** (abajo), que es una excepción a la regla de oro 8 acordada en CONSTRAINTS y pendiente de versionar en el Doc.

---

## Setup único por máquina

```bash
git clone <repo>/perf-toolkit ~/perf-toolkit && cd ~/perf-toolkit && npm install
claude mcp add -s user chrome-devtools npx chrome-devtools-mcp@latest
mkdir -p ~/.claude/skills && cp -R ~/perf-toolkit/skills/* ~/.claude/skills/   # /skills: informe-estilo-convertmate
# en ~/perf-toolkit/.env: CRUX_API_KEY y TINYPNG_API_KEY (new-project.mjs los copia a cada proyecto)
```
Prueba de humo: `claude` → *"Check the performance of https://developers.chrome.com"* → abre Chrome y graba trace. Nunca conectes tu Chrome personal: el MCP usa su instancia aislada.

En cada shell: `export TK=~/perf-toolkit` y, dentro del proyecto, `set -a && source .env && set +a`.

---

## La ruta del día (~8-9 h de reloj)

| Hora | Paso | Qué haces | Tiempo | Listo cuando |
|---|---|---|---|---|
| 0:00 | **Arranque (pasos 1-2)** | `node $TK/scripts/new-project.mjs --marca "X" --store x.myshopify.com --home URL --pdp URL --collection URL` → carpeta, `.env`, pull del live, zip, git + tag `baseline-*` + rama `perf/AAAA-MM`, duplicado → `WORK_THEME_ID`, tipo de tienda en `data/tienda.json` | 10 min | Script sin errores; `WORK_THEME_ID` en `.env` |
| 0:10 | **Intake** | `CONSTRAINTS.md` ya viene con los **defaults ConvertMate**: confírmalos con el líder técnico/cliente (mensaje 1 de `templates/mensajes-cliente.md`), llena lo específico (tests A/B, variantes a preservar, ventana, ¿live conectado a GitHub?) y borra cada marca `[DEFAULT CM, CONFIRMAR]` | 15-30 min | **Sin PENDIENTES ni defaults sin confirmar** (GATING) |
| 0:40 | **CrUX** | `node $TK/scripts/crux-baseline.mjs --marca X` + `crux-history.mjs --marca X`; captura del dashboard Web Performance de Shopify | 5 min | `data/baseline.json` con CrUX y nivel de escalera |
| 0:45 | **Diagnóstico en paralelo (pasos 3-4)** | `prompts/playbook-agentes.md` Fase 1: lanza **A** (lab + traces, único con MCP), **B** (código, con `playbook-tema-nativo.md` / `playbook-instant.md`), **C** (contenido + conversión TinyPNG/ffmpeg), **D** (tags con `pixel-check.mjs`) en un solo mensaje. Mientras: revisa `data/tienda.json`, el checklist de 30-60 min si es Instant | 1.5-2 h | Los 4 docs escritos |
| 2:45 | **Consolidación** | Agente **E** → `data/diagnostico.json` + `docs/DIAGNOSTICO.md` + carriles con archivos disjuntos. Tú: revisas, el aprobador aprueba el plan. Manda `docs/TAGS.md` al cliente (mensaje 2) | 30-45 min | Plan aprobado. *(Opcional: Entregable 1 con `informe-estilo-convertmate`)* |
| 3:30 | **Fixes Frente A (paso 5)** | Fase 2: agentes **F1** header/layout, **F2** videos/lazy/Instant, **F3** imágenes/reseñas/colección, sin commit ni push. Tú, por fix: `git diff` → `git add <archivos> && git commit -m "A-NN ..."` → `node $TK/scripts/push-changed.mjs` (al duplicado, con smoke check) | 1.5-2 h | CHANGELOG con tabla de fixes + lista "re-aplicar tras re-publish de Instant" |
| 5:30 | **Validación (pasos 5 y 6.5)** | Fase 3: **G** mide el preview (MCP, misma metodología, LCP sin popup, peso − barra de preview) y **H** corre el QA gate (screenshot-diff + `pixel-check.mjs --preview --expect data/tags.json` + funcional). Checks que fallan → fix chico → `push-changed` → re-check de ese punto con `net-check.mjs` | 1-1.5 h | `docs/RESULTADOS-FASE1.md` + `docs/QA-GATE-FASE1.md` en verde, anotados en el CHANGELOG |
| 7:00 | **Contenido (paso 6)** | Solo en la ventana, con aviso el día anterior (mensaje 3). Assets ya convertidos por C en `assets-src/optimizados/`; subir en el orden de `data/assets-plan.json`. Assets de Instant: editor de Instant → re-publicar → `shopify theme pull --live --only "sections/instant-*"` → re-aplicar la lista del CHANGELOG | 30-60 min | Assets subidos en la ventana; apps con protocolo de desinstalación |
| 8:00 | **Publicar (paso 7)** | Aprobación escrita sobre el preview → ruta A o B (abajo) → tag `publish-AAAA-MM-DD` → re-medir el live (agente con MCP) → `data/resultados.json` | 45-60 min | Publicado, pixel-check del live OK |
| 9:00 | **Informe** | Skill `informe-estilo-convertmate` desde `data/*.json` → `.html` → QA humano (SOP §7) → ClickUp + Loom a Kenn. Kenn lo publica | 45-60 min | Informe y Loom en ClickUp |
| +2-3 d | **Follow-up** | Captura del dashboard Web Performance (mensaje 5). Si hubo parches en Instant: `grep -c "CM perf" sections/instant-*.liquid` sobre un pull del live | 15 min | Evidencia enviada. **Cierra el proyecto** |

Los tiempos son de reloj con agentes en paralelo; el cuello de botella real es la espera de aprobaciones del cliente. Pide aprobación del plan y de la ventana apenas tengas DIAGNOSTICO.md.

---

## Publicación: dos rutas

**Ruta A · Admin (default, live NO conectado a GitHub).** Re-sync de `settings_data.json` + `templates/*.json` desde el live → smoke-QA 5 min en preview → Temas → Publicar el duplicado.

**Ruta B · `push-changed.mjs --live` (live conectado a GitHub).** Publicar el duplicado desde el Admin desconectaría el tema de la rama de GitHub; en vez de eso se suben al tema live **solo los archivos de código** del fix.
```bash
node $TK/scripts/push-changed.mjs --live --dry-run     # lista de archivos + drift-check del live
node $TK/scripts/push-changed.mjs --live --yes-live    # drift-check otra vez, push --nodelete, smoke check
```
- **No se re-sincroniza `settings_data.json`/templates porque no se suben** (el script excluye `settings_data.json`, `templates/*.json` y `sections/*.json`). Cambios de Customizer que pida el plan se hacen a mano en el Admin.
- **Drift-check obligatorio:** si el live cambió un archivo desde el baseline, el script aborta. Nunca `--force` ni `--skip-drift` hacia el live: trae el cambio, re-aplica el fix encima, re-QA de ese archivo.
- Después: smoke-QA manual en el live (home, PDP, add to cart, checkout) + pixel-check del live, y verificar que Shopify empujó el commit al repo GitHub del cliente (si no, el próximo deploy desde GitHub revierte los fixes).
- Rollback: no hay "tema anterior"; se restauran los archivos subidos desde el tag baseline o el zip (o "versiones anteriores" del editor de código).

---

## Las 7 reglas que bloquean

1. **CONSTRAINTS con PENDIENTES o defaults sin confirmar** → nada del Paso 4 en adelante.
2. **Código**: solo en el duplicado (`push-changed.mjs` sin `--live`). **Contenido**: solo en la ventana de bajo tráfico.
3. **Pixel-check obligatorio** antes y después de publicar: tag del inventario que no dispara = no se publica.
4. **Página con test A/B activo** = no se toca visualmente. Variantes a preservar: screenshot-diff de cada una.
5. **Apps encendidas** = intocables, solo mitigación. **Frente C**: se audita siempre, jamás aparece en el reporte.
6. **Publicar** requiere aprobación escrita + QA Gate + (ruta A: re-sync + smoke-QA · ruta B: drift-check limpio + smoke-QA). En ese orden.
7. **Un solo agente con el MCP chrome-devtools a la vez**; ningún agente commitea, pushea ni toca la tienda.

**Rollback:** checkout roto o pixel muerto → restaurar YA, avisar después. Síntoma ambiguo (CVR, quejas) → consultar antes. Tema anterior y zip ≥ 5 semanas.

**Al cliente se le promete:** informe + peso antes/después + validación técnica + evidencia del dashboard en 2-3 días. El verde de CrUX es *expectativa a ~4 semanas*, nunca promesa.

---

## Trampas que cuestan horas (detalle en `prompts/playbook-agentes.md`)

- MCP desconectado → `/mcp` y avisarle al agente qué corrida repetir.
- Preview: abrir `/robots.txt?preview_theme_id=ID` primero (cookie, sin 302); verificar `Shopify.theme.id` en cada corrida y captura.
- Barra de preview ≈ +419 KB / 9 requests: restarla al comparar peso.
- LCP de lab = popup de Klaviyo casi siempre → reportar también **LCP sin popup**.
- 429 en `/cart/add.js` = sesión marcada bot, no fallo del tema.
- `fetchpriority=high` no sirve si la misma URL aparece antes en el DOM con prioridad auto; preload con ancho distinto al `srcset` = doble descarga. Se verifica con `net-check.mjs`.
- Instant re-publica y pisa `sections/instant-*.liquid`: parches marcados `CM perf AAAA-MM` + lista de re-aplicar en el CHANGELOG.

---

## Comandos de bolsillo

```bash
export TK=~/perf-toolkit; set -a && source .env && set +a
node $TK/scripts/new-project.mjs --marca X --store x.myshopify.com --home URL --pdp URL --collection URL
node $TK/scripts/new-project.mjs --detect-only                # re-detectar tipo de tienda y embeds
node $TK/scripts/crux-baseline.mjs --marca X                  # CrUX (--dry-run sin API key; 404 = escalera)
node $TK/scripts/crux-history.mjs --marca X
node $TK/scripts/push-changed.mjs [--dry-run]                 # al duplicado + smoke check
node $TK/scripts/pixel-check.mjs --save-expect data/tags.json  # live → esperados
node $TK/scripts/pixel-check.mjs --preview --expect data/tags.json   # QA Gate
node $TK/scripts/net-check.mjs --url "$PDP_URL" --preview-theme-id $WORK_THEME_ID
node $TK/scripts/screenshot-diff.mjs --live URL --preview "URL?preview_theme_id=$WORK_THEME_ID" --out data/qa/
node $TK/scripts/perf-check.mjs --all                         # semáforo del portafolio (a demanda)
```
Los flags de `net-check` y `asset-optimize` son los asumidos: confirma con `--help`.
