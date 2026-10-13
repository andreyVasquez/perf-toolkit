# CONSTRAINTS — v2

**Marca:** PENDIENTE
**Fecha de intake:** PENDIENTE

> **GATING:** cualquier sección en PENDIENTE = **no se corre nada del Paso 4 en adelante**.
> **Defaults:** los valores marcados `[DEFAULT CM, CONFIRMAR]` son la respuesta habitual de ConvertMate y vienen prellenados para ahorrar tiempo. **Cuentan como PENDIENTE** hasta que el cliente o el líder técnico los confirme: al confirmar, borra la marca y anota quién y cuándo.

---

## Apps intocables (mecánica de negocio del cliente)

*Addi, kaching y similares entran aquí. Regla de reporte del Paso 4: "costo identificado, intocable por mecánica de negocio", con mitigación, nunca "quítala".*

- `[DEFAULT CM, CONFIRMAR]` **Toda app embed o bloque de app ENCENDIDO en el tema es intocable**: no se quita ni se desactiva. Solo se mitiga la carga (defer, lazy, facade) sin cambiar el comportamiento. El inventario completo de embeds queda en `docs/DIAGNOSTICO.md`.
- Apps apagadas pero instaladas: se proponen para desinstalar con el protocolo de la sección 9 del SOP.

| App | Por qué es intocable | A quién avisar |
|---|---|---|
| Todas las encendidas en el tema `[DEFAULT CM, CONFIRMAR]` | Regla general | Líder técnico |
| PENDIENTE (apps críticas a nombrar: page builder, checkout, suscripciones, formularios) | PENDIENTE | PENDIENTE |

**Stack propio (Frente C, interno):** `[DEFAULT CM, CONFIRMAR]` el stack propio apagado (sin test/estudio activo) **no carga**: su script queda detrás de un flag `cm_<herramienta>_enabled = false` en el tema, la app sigue instalada y se reactiva cambiando el flag. Estado por herramienta: Intelligems PENDIENTE · Heatmap PENDIENTE · Zigpoll PENDIENTE · Alia PENDIENTE.

---

## Tags de medición confirmados VIVOS

*Regla de oro 3: nunca quitar un script de medición sin confirmación escrita; pixel-check del Paso 6.5 obligatorio después de cualquier cambio.*

`[DEFAULT CM, CONFIRMAR]` **ConvertMate audita los tags y entrega `docs/TAGS.md`** (inventario con duplicados y obsoletos, columna "Decisión del cliente") para que el cliente decida. **Mientras decide, todos se tratan como vivos**: ningún script de medición se toca, y el pixel-check del Paso 6.5 debe encontrar en el preview los mismos tags que el inventario del live (`data/tags.json`). La decisión pendiente del cliente **no bloquea** la ronda.

| Tag | Vivo (sí/no) | Quién confirmó | Fecha |
|---|---|---|---|
| Google | Se trata como vivo, ver docs/TAGS.md `[DEFAULT CM, CONFIRMAR]` | Inventario CM | PENDIENTE |
| Meta | Se trata como vivo, ver docs/TAGS.md `[DEFAULT CM, CONFIRMAR]` | Inventario CM | PENDIENTE |
| TikTok | Se trata como vivo, ver docs/TAGS.md `[DEFAULT CM, CONFIRMAR]` | Inventario CM | PENDIENTE |
| Otros | Se tratan como vivos, ver docs/TAGS.md `[DEFAULT CM, CONFIRMAR]` | Inventario CM | PENDIENTE |

---

## Tests A/B activos (Intelligems u otro)

*Regla: página con test activo = no se toca visualmente hasta que el test cierre.*

- ¿Hay tests activos?: PENDIENTE (sí/no)
- Página(s): PENDIENTE
- Fecha de fin: PENDIENTE
- Variantes o estéticas que hay que preservar exactamente (ej. `?variant=` con otro diseño): PENDIENTE (o "ninguna")

---

## Acceso al Admin verificado

- [ ] Colaborador con permisos de Themes, Apps, Files y Productos confirmado **y probado**.
- [ ] Shopify CLI autenticado (`new-project.mjs` hizo pull y creó el duplicado sin error).
- ¿El tema live está conectado a GitHub?: PENDIENTE (sí/no). Si sí: repo y rama: PENDIENTE

---

## Ventana de bajo tráfico (contenido)

*Los cambios de Frente B pegan en la tienda viva al instante: solo dentro de esta ventana, con aviso el día anterior.*

- Día/hora acordados: PENDIENTE

---

## Aprobador de publicación

- Nombre: `[DEFAULT CM, CONFIRMAR]` líder técnico del proyecto (PENDIENTE: nombre)
- Canal: PENDIENTE

## Método de publicación

`[DEFAULT CM, CONFIRMAR]`
- **Live conectado a GitHub** → `push-changed.mjs --live --yes-live`: sube **solo los archivos de código** cambiados vs el tag `baseline-*` (nunca `settings_data.json`, `templates/*.json` ni `sections/*.json`, así que no hace falta re-sincronizarlos), con **drift-check obligatorio** del live antes de subir. Luego se verifica que el commit de Shopify llegó al repo de GitHub del cliente (si no, el próximo deploy desde GitHub revierte los fixes).
- **Live no conectado a GitHub** → publicar el duplicado desde el Admin (Temas → Publicar), con re-sync de `settings_data.json` + `templates/*.json` y smoke-QA (Paso 7 del SOP).
- Método elegido para esta ronda: PENDIENTE

---

## Criterio de éxito acordado por escrito

*Redacción de la sección 1 del SOP, aceptada por el cliente:*

> "Éxito de la ronda: entrega del informe con los fixes aplicados, la reducción de peso por página (antes/después) y la validación técnica de mejora. A los 2–3 días compartimos la evidencia con usuarios reales desde el panel Web Performance de tu admin de Shopify. La confirmación oficial de Google (CrUX) se refleja en ~4 semanas, porque promedia una ventana de 28 días."

- Fecha de aceptación: PENDIENTE
- Objetivo interno (no va al cliente), ej. dashboard Web Performance en verde: PENDIENTE (o "ninguno")

## Alcance (opcional)

- Páginas/secciones dentro y fuera de la ronda: PENDIENTE (o "las 3 URLs del .env")
- Herramienta de imágenes: TinyPNG (`TINYPNG_API_KEY` en `.env`) `[DEFAULT CM, CONFIRMAR]`
- Problemas conocidos del live que no causó CM (para no heredarlos en el QA): PENDIENTE (o "ninguno")
