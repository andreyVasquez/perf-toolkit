# perf-toolkit · ConvertMate

Toolkit de optimización de velocidad Shopify. El SOP describe; este repo ejecuta.

**Fuente de verdad:** el SOP vive como Google Doc (comentable); `docs/SOP.md` es la copia de referencia en el repo.

## Setup único por máquina

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
# Verificar dentro de claude con /skills: informe-estilo-convertmate, performance, core-web-vitals
```

**No** configurar remote debugging sobre tu Chrome personal: el MCP lanza su propia instancia aislada con perfil limpio. El Chrome personal ensucia los traces con extensiones y sesiones, y expone tus cuentas logueadas.

**Prueba de humo:** en cualquier carpeta, `claude` → "Check the performance of https://developers.chrome.com". Si abre Chrome y graba trace, listo.

## Mapa del repo

```
perf-toolkit/
├── docs/
│   └── SOP.md                 # copia de referencia del SOP (canónico: Google Doc)
├── scripts/                   # Node 18+, ESM, sin dependencias (fetch nativo)
│   ├── lib.mjs                # utilidades compartidas (CrUX API, .env, escalera, tablas)
│   ├── crux-baseline.mjs      # p75 + histogramas, PHONE/DESKTOP, origin + 3 URLs
│   ├── crux-history.mjs       # serie semanal ~6 meses (backtesting y cierre)
│   ├── perf-check.mjs         # tabla semáforo de todas las marcas (--all lee stores.json)
│   ├── screenshot-diff.mjs    # preview vs live, mobile+desktop (QA Gate 6.5)
│   ├── new-project.mjs        # pasos 1-2 en un comando (carpeta, .env, pull, zip, git + tag baseline, duplicado, tipo de tienda)
│   ├── push-changed.mjs       # push solo de archivos de código cambiados vs baseline (drift-check + smoke check)
│   ├── pixel-check.mjs        # tags de medición por página con puppeteer (inventario y QA Gate)
│   ├── net-check.mjs          # requests y prioridades sin MCP (fetchpriority del LCP, dobles descargas)
│   └── asset-optimize.mjs     # (si existe) TinyPNG + ffmpeg para el Frente B
├── schemas/
│   ├── baseline.schema.json   # v1, draft-07
│   ├── diagnostico.schema.json
│   ├── resultados.schema.json
│   └── ejemplos/              # un JSON válido por schema
├── prompts/                   # los 8 prompts del SOP (pasos 1–7 + 6.5), versionados
│   ├── playbook-agentes.md    # pasos 3-4, 5 y 6.5 con agentes en paralelo (prompts plantilla)
│   ├── playbook-instant.md    # tiendas hechas con Instant: qué se toca, qué va al editor, parches
│   └── playbook-tema-nativo.md # quick-wins de temas Shopify con greps y fix tipo
├── skills/
│   ├── informe-estilo-convertmate/ # informes al cliente en HTML autocontenido (docgen.py), los publica Kenn
│   ├── performance/           # (pendiente de agregar) Addy Osmani, versión pinneada
│   └── core-web-vitals/       # (pendiente de agregar) Addy Osmani, versión pinneada
├── templates/
│   ├── CONSTRAINTS.md         # plantilla v2 (Paso 1)
│   ├── checklist-qa.md        # checklist funcional del Paso 6.5
│   ├── mensajes-cliente.md    # intake, aviso de ventana, follow-up dashboard
│   └── env.example            # copiar como .env por proyecto
├── package.json               # deps de screenshot-diff (puppeteer-core, pixelmatch, pngjs)
└── stores.json                # marcas y sus 3 URLs (para perf-check --all)
```

## Scripts

Los de CrUX leen `CRUX_API_KEY` del `.env` del directorio actual (o del entorno) y aceptan `--dry-run` para ver la salida con data de ejemplo sin API key. Un 404 de CrUX (sin data) no es error: activa la escalera de fallback de la sección 2 del SOP (page → origin, marcado en `fuente`; los niveles siguientes son manuales).

**`crux-baseline.mjs`** — p75 + histogramas de LCP/INP/CLS, PHONE y DESKTOP, origin + 3 URLs; escribe `data/baseline.json` (solo PHONE, valida contra su schema).

```bash
node scripts/crux-baseline.mjs --marca X    # o --home URL --pdp URL --collection URL
```

**`crux-history.mjs`** — serie semanal CrUX de ~6 meses, p75 móvil de las 3 métricas; escribe `data/history.json`.

```bash
node scripts/crux-history.mjs --marca X
```

**`perf-check.mjs`** — tabla semáforo del portafolio (🟢 LCP ≤ 2500 ms · INP ≤ 200 ms · CLS ≤ 0.1), p75 móvil con fuente page/origin; a demanda, sin estado ni archivos.

```bash
node scripts/perf-check.mjs --all           # o --marca X
```

**`screenshot-diff.mjs`** — preview vs live, full-page en mobile (412×915) y desktop (1440×900), diff visual por par y % de píxeles distintos (alerta > 1%, exit 1). Chrome local: `--chrome` > `$CHROME_PATH` > rutas conocidas. Contexto nuevo por captura y verificar `Shopify.theme.id` en ambos lados: la cookie de preview se pega.

```bash
node scripts/screenshot-diff.mjs --live "$HOME_URL" \
  --preview "$HOME_URL?preview_theme_id=$WORK_THEME_ID" --out data/qa/
```

Los scripts de tienda se corren **desde la carpeta del proyecto** (leen su `.env`), con `TK=~/perf-toolkit`. Uso asumido; la referencia es `--help` de cada script.

**`new-project.mjs`** — pasos 1-2 automáticos e idempotentes: carpeta + `.env` + `CONSTRAINTS.md`, `theme pull --live`, zip de respaldo, git + commit y tag `baseline-AAAA-MM-DD` + rama `perf/AAAA-MM`, duplicado `[CM] Perf AAAAMM` → `WORK_THEME_ID`, alta en `stores.json`, y detección del tipo de tienda (Instant / GemPages / tema nativo) y app embeds ON/OFF → `data/tienda.json`.

```bash
node $TK/scripts/new-project.mjs --marca "X" --store x.myshopify.com \
  --home URL --pdp URL --collection URL [--dir ~/ConvertMate/x] [--dry-run] [--detect-only]
```

**`push-changed.mjs`** — sube al duplicado solo los archivos de `theme/` cambiados vs el último tag `baseline-*` (excluye `settings_data.json`, `templates/*.json`, `sections/*.json`), con drift-check del live y smoke check del preview (theme id + 0 `Liquid error`). `--live --yes-live` publica esos mismos archivos al live (solo Paso 7, live conectado a GitHub, ver `docs/GUIA_RAPIDA.md`).

```bash
node $TK/scripts/push-changed.mjs [--dry-run]          # al duplicado
node $TK/scripts/push-changed.mjs --smoke-only
node $TK/scripts/push-changed.mjs --live --yes-live    # al live (Paso 7, ruta B)
```

**`pixel-check.mjs`** — tags de medición por página con puppeteer (contexto limpio por URL, scroll, variante + add to cart). Sin `--url` usa las 3 URLs del `.env`. En el live genera el inventario y los esperados; en el preview sale con exit 1 si falta un tag. `--sgtm-host` para GTM server-side con dominio propio.

```bash
node $TK/scripts/pixel-check.mjs --save-expect data/tags.json      # live → tags esperados (revisar a mano)
node $TK/scripts/pixel-check.mjs --preview --expect data/tags.json  # QA Gate: exit 1 si falta un tag
```

**`net-check.mjs`** — requests de una página con prioridad, tamaño e iniciador, sin MCP: verifica que el recurso LCP salga en High, que no haya dobles descargas (preload con ancho distinto al `srcset`) y que galerías ocultas y videos no pidan bytes al cargar.

```bash
node $TK/scripts/net-check.mjs --url "$PDP_URL" [--preview-theme-id $WORK_THEME_ID]
```

**`asset-optimize.mjs`** (si existe) — conversión del Frente B: imágenes con TinyPNG (`TINYPNG_API_KEY`), videos con ffmpeg (H.264 720p, faststart, poster).

## Uso por proyecto

Ruta rápida de un día: **`docs/GUIA_RAPIDA.md`** (scripts + `prompts/playbook-agentes.md`). Cada proyecto de cliente vive en su propia carpeta (no en este repo), creada por `new-project.mjs`; se siguen los 8 pasos del SOP con los prompts de `prompts/`. GATING: `CONSTRAINTS.md` con PENDIENTES (o defaults sin confirmar) = no se corre nada del Paso 4 en adelante.

Informes al cliente: skill `informe-estilo-convertmate` (HTML, no PDF). Las cifras salen de `data/*.json` con la metodología del SOP (PageSpeed Insights no se usa, aunque el ejemplo de la skill lo cite). El `.html` va a ClickUp con un Loom; Kenn lo publica.
