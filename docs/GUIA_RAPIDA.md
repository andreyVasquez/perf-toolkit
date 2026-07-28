# Guía rápida — Ronda de velocidad Shopify
**v2.0 · La referencia completa es `docs/SOP.md` (canónico: Google Doc). Esto es el paso a paso para ejecutar; si algo contradice al SOP, gana el SOP.**

---

## Setup único por máquina (una sola vez)

```bash
git clone <repo>/perf-toolkit ~/perf-toolkit && cd ~/perf-toolkit && npm install
claude mcp add -s user chrome-devtools npx chrome-devtools-mcp@latest
mkdir -p ~/.claude/skills && cp -R ~/perf-toolkit/skills/* ~/.claude/skills/
```
Prueba de humo: `claude` → *"Check the performance of https://developers.chrome.com"* → debe abrir Chrome y grabar trace.
⚠️ Nunca conectes tu Chrome personal (nada de remote debugging): el MCP usa su instancia aislada.

---

## Por cada proyecto

**Arranque (5 min):** carpeta nueva fuera del toolkit → copia `templates/.env.example` como `.env` y `templates/CONSTRAINTS.md` → llena el `.env` con las 3 URLs de MÁS tráfico según Analytics. Antes de usar variables en la terminal: `set -a && source .env && set +a`.

| # | Paso | Qué haces | Listo cuando |
|---|---|---|---|
| 1 | **Intake** | `prompts/prompt-1-intake.md` → manda el intake al cliente, llena CONSTRAINTS.md con sus respuestas | CONSTRAINTS.md **sin PENDIENTES**. Con pendientes, NO se corre el Paso 4 en adelante |
| 2 | **Conexión y copia** | `prompts/prompt-2-conexion.md` → login CLI, pull del live, zip de respaldo, `git init` + rama `perf/AAAA-MM`, duplicado despublicado | `store execute` devuelve el nombre, existe el zip, `WORK_THEME_ID` en el `.env` |
| 3 | **Baseline** | `prompts/prompt-3-baseline.md` → `node scripts/crux-baseline.mjs --marca X` + `crux-history.mjs` + peso con DevTools MCP (metodología fija: Slow 4G · 4x · 412×915 · caché fría · mediana de 3) + captura del dashboard Web Performance de Shopify | `data/baseline.json` válido + BASELINE.md con la fuente CrUX anotada (page/origin/fallback) |
| 4 | **Auditoría** | `prompts/prompt-4-auditoria.md` → traces en las 3 URLs, análisis del código en `theme/`, TODO clasificado en frente **A** (código) / **B** (contenido) / **C** (stack propio — jamás al cliente). Apps de negocio del cliente (Addi, etc.): al reporte como "costo intocable + mitigación", nunca "quítala" | `data/diagnostico.json` completo y plan aprobado. *(Opcional: Entregable 1 con el skill `convertmate-report`)* |
| 5 | **Fixes de código** | `prompts/prompt-5-fixes-codigo.md` → por fix: commit → explicar → OK → push al duplicado → medir en preview → CHANGELOG. **Nunca** tocar `settings_data.json` ni `templates/*.json` | Cada fix con antes/después (ms y KB) en CHANGELOG.md |
| 6 | **Contenido** | `prompts/prompt-6-contenido.md` → SOLO en la ventana de bajo tráfico, con aviso el día anterior. Assets convertidos antes de que abra la ventana. Apps a desinstalar: export config + confirmación escrita, siempre | Assets subidos en la ventana; apps con respaldo hecho |
| 6.5 | **QA GATE** 🚧 | `prompts/prompt-6.5-qa-gate.md` → ① `node scripts/screenshot-diff.mjs --live "$HOME_URL" --preview "$HOME_URL?preview_theme_id=$WORK_THEME_ID" --out data/qa/` (y PDP + colección) ② `templates/checklist-qa.md` completo ③ **pixel-check**: prompt MCP que lista requests a GA4/Meta/TikTok en el preview | Los 3 checks pasan y quedan anotados. **Falta un tag vivo = NO se publica** |
| 7 | **Publica y entrega** | `prompts/prompt-7-entrega.md` → aprobación escrita sobre el preview → **re-sync** `settings_data.json` + templates desde el live → **smoke-QA** (5 min) → Publicar desde Admin → tag git → re-medir peso → Informe de entrega (skill `convertmate-report`) | Informe enviado + follow-up agendado |
| +2-3d | **Follow-up** | Captura del dashboard Web Performance del cliente (usuarios reales, delay ~36h) → se envía con la plantilla de `mensajes-cliente.md`. **El proyecto cierra aquí** | Evidencia enviada |

---

## Las 6 reglas que bloquean (memorízalas)

1. **CONSTRAINTS con PENDIENTES** → nada del Paso 4 en adelante.
2. **Código**: solo en el duplicado. **Contenido**: solo en la ventana de bajo tráfico.
3. **Pixel-check obligatorio** antes de publicar — tag de medición muerto = no se publica.
4. **Página con test A/B activo** = no se toca visualmente.
5. **Frente C** (Intelligems, Heatmap, Zigpoll, Alia): se audita siempre, jamás aparece en el reporte ni se le menciona al cliente.
6. **Publicar** requiere: aprobación escrita + QA Gate + re-sync + smoke-QA. En ese orden.

**Rollback:** checkout roto o pixel muerto → restaurar tema anterior YA, avisar después. Síntoma ambiguo (CVR, quejas) → consultar antes. El tema anterior y el zip se guardan ≥5 semanas.

**Al cliente se le promete:** informe + peso antes/después + validación técnica + evidencia del dashboard en 2-3 días. El verde de CrUX es *expectativa a ~4 semanas*, nunca promesa.

---

## Comandos de bolsillo

```bash
set -a && source .env && set +a                      # cargar variables (cada shell nueva)
node scripts/crux-baseline.mjs --marca X             # baseline CrUX (o --home/--pdp/--collection)
node scripts/crux-history.mjs --marca X              # serie semanal ~6 meses
node scripts/perf-check.mjs --all                    # semáforo de todo el portafolio (a demanda)
node scripts/screenshot-diff.mjs --live URL --preview URL --out data/qa/
# --dry-run en los de CrUX = probar sin API key · 404 de CrUX no es error: es la escalera page→origin
```
