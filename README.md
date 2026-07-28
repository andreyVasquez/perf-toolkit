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
# Verificar dentro de claude con /skills: convertmate-report, performance, core-web-vitals
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
│   └── screenshot-diff.mjs    # preview vs live, mobile+desktop (QA Gate 6.5)
├── schemas/
│   ├── baseline.schema.json   # v1, draft-07
│   ├── diagnostico.schema.json
│   ├── resultados.schema.json
│   └── ejemplos/              # un JSON válido por schema
├── prompts/                   # los 8 prompts del SOP (pasos 1–7 + 6.5), versionados
├── skills/
│   ├── convertmate-report/    # PDFs de entregables con marca
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

**`screenshot-diff.mjs`** — preview vs live, full-page en mobile (412×915) y desktop (1440×900), diff visual por par y % de píxeles distintos (alerta > 1%, exit 1). Chrome local, mismo patrón de detección que el skill convertmate-report (`--chrome` > `$CHROME_PATH` > rutas conocidas).

```bash
node scripts/screenshot-diff.mjs --live "$HOME_URL" \
  --preview "$HOME_URL?preview_theme_id=$WORK_THEME_ID" --out data/qa/
```

## Uso por proyecto

Cada proyecto de cliente vive en su propia carpeta (no en este repo): `.env` desde `templates/env.example`, `CONSTRAINTS.md` desde `templates/CONSTRAINTS.md`, y se siguen los 8 pasos del SOP con los prompts de `prompts/` en orden. GATING: `CONSTRAINTS.md` con PENDIENTES = no se corre nada del Paso 4 en adelante.
