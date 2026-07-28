---
name: convertmate-report
description: Genera PDFs de informes para clientes con la marca ConvertMate (banda oscura, paleta verde, tipografía Geist). Usar cuando se pida un informe, reporte o entregable PDF para un cliente de ConvertMate, un informe de optimización o auditoría, o convertir hallazgos en un documento con marca.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/build-pdf.mjs *)
---

# Informes PDF con marca ConvertMate

Genera PDFs A4 con la identidad de ConvertMate a partir de un fragmento HTML. No escribas CSS ni estructura de página: el template del kit ya lo resuelve.

## Flujo

1. Escribe el contenido como fragmento HTML (solo `<section>`s, sin `<html>`/`<head>`/estilos propios) en `docs/` del proyecto, p. ej. `docs/informe-body.html`. Usa únicamente las clases del kit (tabla abajo).
2. Genera el PDF:

```bash
node ${CLAUDE_SKILL_DIR}/build-pdf.mjs \
  --body docs/informe-body.html \
  --headline "Velocidad de MiCliente: qué encontramos y qué corregimos" \
  --eyebrow "Informe de optimización · Ronda 1" \
  --meta '<span><b>Para</b> · Equipo MiCliente</span><span><b>Fecha</b> · 27 de julio de 2026</span><span class="pill">Tienda en vivo: sin modificar</span>' \
  --out docs/INFORME-CLIENTE-2026-07-27.pdf
```

Opcionales: `--html-out pagina.html` guarda también el HTML final (útil para revisar en navegador), `--title` cambia el título de la pestaña, `--chrome` fuerza la ruta del binario de Chrome (por defecto se autodetecta; también respeta `$CHROME_PATH`).

## Clases disponibles en el body

| Clase | Uso |
|---|---|
| `.kicker` | Etiqueta mono uppercase sobre el `<h2>` de cada sección |
| `.cards` > `.card` (`.label`, `.big`, `.sub`) | Tarjetas de métricas |
| `.chip.good` / `.chip.bad` / `.chip.warn` | Pills de estado |
| `.delta` | Números de mejora en verde marca |
| `.callout` | Caja destacada con borde de acento |
| `.tablewrap` > `table` (`td.num`, `tr.hot`) | Tablas; `tr.hot` resalta una fila |
| `.work` (ul) | Lista de tarjetas con título en negrita (`<li><b>Título</b>Texto…</li>`) |
| `ol.steps` | Pasos numerados (solo para secuencias reales) |
| `.page-break` | Fuerza salto de página antes del elemento |
| `footer.method` | Nota de metodología al final |

## Reglas de contenido

- Idioma del informe: el que use el cliente (español por defecto).
- Números en `.big` y `td.num` sin unidades inventadas: usa los datos reales que dé el usuario o los archivos del proyecto.
- `ol.steps` solo para secuencias reales de pasos; no lo uses como lista genérica.
- Cierra siempre con `footer.method` describiendo de dónde salen los datos (herramienta, fechas, muestra).
- Verifica el resultado: abre el PDF generado o el `--html-out` y revisa cortes de página; usa `.page-break` si una sección queda partida de forma fea.
