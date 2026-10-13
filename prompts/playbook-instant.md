# Playbook · Tiendas hechas con Instant (page builder)

> Se usa cuando `new-project.mjs` detecta `STORE_TYPE=instant` (secciones `sections/instant-*.liquid`, embed `instant_core`). Base: Lummia ronda 2 (2026-10-07), PDP de 160 MB → 35 MB por visita con plan B.
> Regla central: **el código que genera Instant no es nuestro.** Cada re-publish desde el editor de Instant regenera `sections/instant-*.liquid` (y snippets suyos como `funnel-*.liquid`) y pisa lo que hayamos cambiado. El propio archivo lo advierte en su `{% comment %}` inicial.

## 0 · Checklist de 30-60 min: ¿vale la pena la ronda?

Correr sobre el pull del live, antes de comprometer alcance.

```bash
cd $PROJECT/theme
ls sections/instant-*.liquid | wc -l                                  # cuántas secciones Instant
grep -l "instant" templates/*.json | head                             # qué plantillas usan Instant
for t in index product collection; do grep -o '"type": *"[^"]*"' templates/$t*.json | sort | uniq -c; done   # mezcla Instant vs nativo por plantilla
grep -c "<video" sections/instant-*.liquid | grep -v ":0"             # videos dentro de Instant
grep -n "autoplay" sections/instant-*.liquid | head                   # autoplay en Instant
grep -n "fetchpriority=\"high\"" sections/instant-*.liquid snippets/*.liquid | wc -l
grep -n "section.index" sections/instant-*.liquid | head -3           # regla eager/preload de Instant
grep -c "MutationObserver" sections/instant-*.liquid | grep -v ":0"   # observers en code-blocks
curl -s -A "Mozilla/5.0 (Linux; Android 14)" "$PDP_URL" | wc -c        # HTML de la PDP (>500 KB = mucho inline)
```

| Señal | Lectura |
|---|---|
| PDP/home 100% Instant y sin videos/imágenes pesadas | Poco margen: casi todo es editor de Instant. Ronda corta (contenido + head) o no vale la pena |
| Videos autoplay o `preload=auto` en Instant, imágenes a 1280-2000w en cajas chicas | **Vale la pena**: el grueso es Frente B y editor de Instant, sin tocar su código |
| Mezcla Instant + secciones nativas en la misma plantilla | Las nativas se arreglan normal (`playbook-tema-nativo.md`); Instant por editor |
| Muchos code-blocks con JS (observers, swaps de galería por variante) | INP alto; el fix vive en el editor de Instant, depende de quien mantiene esos bloques |

Resultado del checklist: una línea en DIAGNOSTICO.md con el reparto estimado (código nuestro / editor Instant / contenido).

## 1 · Qué SÍ se puede hacer (sin tocar código de Instant)

**Contenido (Frente B), lo que más rinde:**
- **Videos autoplay ocultos.** Buscar `<video ... autoplay>` dentro de contenedores invisibles: acordeones cerrados, `display:none`, alto 0, otra variante. En Lummia un video de **113 MB** (HEVC 18 Mbps) se reproducía en autoplay dentro de un acordeón FAQ cerrado y se bajaba entero en cada visita a la PDP. Fix: re-encode H.264 720p 2-3 Mbps + poster, y sin autoplay hasta abrirse.
- **Imágenes subidas a Instant** (`instant:<id>/<archivo>`): Instant pide `?width=1280` con `sizes=100vw` aunque la caja sea un swatch de 35-50 px. Reemplazar el asset en el editor por uno al tamaño real ×2-3 (TinyPNG) y re-publicar la sección.
- PNG/JPG de varios MB subidos tal cual → WebP. SVG > 50 KB → WebP/PNG (el CDN no redimensiona SVG).

**Código nuestro alrededor de Instant (Frente A, normal):**
- `layout/theme.liquid` y head: fuentes (preload de la fuente base, quitar duplicadas, `@import` en `<style>`), preconnects, librerías globales, código muerto, includes de apps apagadas, Frente C condicionado.
- App embeds y scripts globales: solo mitigación de carga si la app está encendida.
- Header, footer, drawer y secciones nativas: todo el checklist de `playbook-tema-nativo.md`.
- Tags duplicados: se documentan en `docs/TAGS.md` para que el cliente decida.
- **CSS/JS custom referenciado desde code-blocks** de Instant pero que vive en `assets/` (ej. `aida-x-lummia.css`, `buybox-*.css`): es archivo del tema, se edita en la copia. Típico: `body:has(...)` → clase en `<body>` (ver tema nativo #13).

## 2 · Qué se hace en el editor de Instant (lo hace quien mantiene Instant; nosotros entregamos la lista)

| Ajuste | Por qué | Cómo detectarlo |
|---|---|---|
| **Lazy/eager por sección.** Instant pone eager + preload de CSS si `section.index <= 2` | La 2.ª sección Instant de la plantilla suele estar bajo el fold y baja eager (Lummia: 26 imgs, ~800 KB) | `grep -n "section.index" sections/instant-*.liquid` y orden en `templates/*.json` |
| **fetchpriority** solo en la imagen LCP (primer slide de la galería) | Instant no lo pone, o lo pone en imágenes ocultas | `grep -n 'fetchpriority' sections/instant-*.liquid snippets/funnel-*.liquid` |
| **MutationObservers en code-blocks** sobre `document.body` con `subtree:true` y `childList` | Corren como microtareas dentro del click de variante → INP | `grep -n "observe(document.body" sections/instant-*.liquid` |
| **Galerías por variante** que se cambian por JS tras DCL | Doble galería descargada, LCP tardío en landings `?variant=` | `grep -n "metafields.custom.gallery\|refreshSliders\|dispatchEvent(new Event('resize'))" sections/instant-*.liquid` |
| Videos: quitar autoplay, poster, fuente ≤ 720p | Autoplay ignora `preload` | `grep -n "<video" sections/instant-*.liquid` |
| Listeners de scroll no pasivos con `getBoundingClientRect` | Jank/INP | `grep -n "addEventListener('scroll'" sections/instant-*.liquid` |
| Fuentes de Google cargadas desde la sección (render-blocking a mitad del body) | Duplica las del tema | `grep -n "fonts.googleapis" sections/instant-*.liquid` |

Instant ofrece un MCP (`https://api.instant.so/mcp`, citado en el comentario de cabecera de sus secciones) para hacer estos cambios en el editor si el cliente lo conecta. Sin acceso: entregar la tabla al líder técnico como "bloqueado-avisar (Instant)".

## 3 · Parches en `sections/instant-*.liquid`: permitidos con condiciones

Solo cuando el impacto es alto y el editor no está disponible en la ronda (Lummia: video de 113 MB, fetchpriority del LCP).

1. **Mínimos**: cambiar atributos (`autoplay`, `preload`, `src` → `data-cm-src`, `fetchpriority`, `loading`) o agregar un `<script>` propio al final de la sección. Nada de reestructurar markup.
2. **Marcados**: `{% comment %} CM perf AAAA-MM: <id> {% endcomment %}` junto a cada cambio.
3. **En la lista de re-aplicar del CHANGELOG**, con archivo, línea aproximada y el texto exacto:
   ```
   ### ⚠️ Re-aplicar después de cada re-publish de Instant (buscar `CM perf AAAA-MM`)
   - sections/instant-XXXX.liquid ~L318: <img> del repeater → fetchpriority="{% if forloop.first %}high{% else %}auto{% endif %}"
   - sections/instant-XXXX.liquid ~L1452: <video> → sin autoplay, preload="none", src= → data-cm-src=
   - snippets/funnel-*.liquid: también lo genera Instant → re-aplicar lazy/auto
   ```
4. Avisar al cliente/líder técnico, en el informe y en el mensaje de entrega, que **re-publicar esas secciones desde Instant revierte los parches** hasta que se haga el cambio equivalente en el editor.

**Riesgo:** alto de regresión silenciosa. Cualquier edición del cliente en Instant (un texto, un precio) re-publica la sección y vuelve el video de 113 MB. Mitigación: hacer el cambio también en el editor apenas haya acceso, y revisar con `grep -c "CM perf" sections/instant-*.liquid` en el follow-up de +2-3 días (si el conteo bajó, Instant re-publicó).

## 4 · Atajos de medición en tiendas Instant

- `instant-core.min.js` + CSS por sección (PDP Lummia: 178 + 63 + 52 KB render-blocking) es costo de app de negocio: se reporta con su costo, no se quita.
- CSS de secciones Instant ocultas (funnel de otra variante) se sigue pidiendo: `stylesheet_tag: preload: false` solo si el parche es aceptado.
- Verificar siempre las variantes que cambian la estética (`?variant=`) en screenshot-diff: Instant suele cambiar layout por variante.
