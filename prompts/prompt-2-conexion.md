# Prompt 2 · Conecta la tienda y haz tu copia

> Paso 2 del SOP. Prerequisito: Paso 1 sin PENDIENTES. Recuerda `set -a && source .env && set +a` en cada shell nueva.
> **Atajo:** `node $TK/scripts/new-project.mjs` hace los pasos 1-2 automáticos (carpeta, `.env`, pull, zip, git + tag baseline, duplicado, detección de tipo de tienda y app embeds). Este prompt queda para verificar su salida o para hacerlo a mano si el script falla.

---

Estamos en el Paso 2 del SOP de ConvertMate: conectar la tienda $SHOPIFY_STORE y crear la copia de trabajo. Reglas de oro: nunca sobre el tema vivo, nunca `--allow-mutations`, nunca `push --live`.

Ejecuta en orden y detente si algo falla:

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
shopify theme push --unpublished --path ./theme       # duplicado "[CM] Perf AAAAMM"
```

Al terminar:
1. Anota el ID del tema duplicado como `WORK_THEME_ID` en el `.env`.
2. Confirma que existe el zip de respaldo del tema vivo (independiente de git).
3. Confirma que el repo git local tiene el commit baseline y la rama `perf/AAAA-MM`.

LISTO CUANDO: el `store execute` devuelve el nombre, existe el zip, el repo git tiene el commit baseline y `WORK_THEME_ID` quedó en el `.env`.
