# Prompt 1 · Intake y CONSTRAINTS

> Paso 1 del SOP. Prerequisito: carpeta del proyecto creada, `templates/env.example` copiado como `.env` y `templates/CONSTRAINTS.md` copiado como `CONSTRAINTS.md`.

---

Estamos en el Paso 1 (Intake) del SOP de ConvertMate. Todavía NO se toca nada de la tienda.

Contexto:
- Tienda: $SHOPIFY_STORE
- URLs de más tráfico según Analytics: $HOME_URL · $PDP_URL · $COLLECTION_URL

Tu tarea:
1. Lee `CONSTRAINTS.md` de esta carpeta.
2. Lista todas las secciones que siguen en PENDIENTE y, para cada una, redacta la pregunta exacta que hay que hacerle al cliente para cerrarla (apps intocables, tags de medición vivos, tests A/B activos, acceso al Admin, ventana de bajo tráfico, aprobador de publicación, criterio de éxito por escrito).
3. Verifica que el `.env` tenga `SHOPIFY_STORE`, `HOME_URL`, `PDP_URL` y `COLLECTION_URL` llenos (`CRUX_API_KEY` y `WORK_THEME_ID` se llenan en el Paso 2).
4. Recuérdame la regla de GATING: cualquier sección en PENDIENTE = no se corre nada del Paso 4 en adelante.

No propongas fixes ni midas nada todavía.

LISTO CUANDO: `CONSTRAINTS.md` no tiene PENDIENTES.
