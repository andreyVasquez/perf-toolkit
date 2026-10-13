# Prompt 7 · Publica, entrega y follow-up

> Paso 7 del SOP. Prerequisito: QA Gate (Paso 6.5) aprobado Y aprobación escrita del cliente. Nunca publicar sin ambas.
> Método de publicación: el que fija `CONSTRAINTS.md` (sección "Método de publicación"). Ruta A = Admin (SOP). Ruta B = `push-changed.mjs --live` cuando el live está conectado a GitHub.

---

Estamos en el Paso 7 del SOP de ConvertMate: publicación y entrega de $SHOPIFY_STORE. Guíame en orden:

1. **Aprobación escrita.** Confirma que el aprobador de `CONSTRAINTS.md` aprobó por escrito sobre el link de preview. Sin esto no se sigue.
2. **Publicar según el método de CONSTRAINTS:**
   - **Ruta A · Admin (live no conectado a GitHub):**
     a. **Re-sincroniza** `settings_data.json` y `templates/*.json` desde el tema vivo hacia la copia (el cliente pudo tocar el Customizer; publicar sin esto le borra sus cambios).
     b. **Smoke-QA post-resync** (5 min): home, PDP y checkout cargan y funcionan en el preview. Lo publicado debe ser lo aprobado.
     c. **Publica** desde el Admin (Temas → Publicar). Lo hago yo a mano.
   - **Ruta B · `push-changed.mjs --live` (live conectado a GitHub):**
     a. `node $TK/scripts/push-changed.mjs --live --dry-run`: lista los archivos de código cambiados vs el tag `baseline-*` (excluye `settings_data.json`, `templates/*.json` y `sections/*.json`, por eso no hay re-sync) y el **drift-check** del live (obligatorio: nunca `--skip-drift` ni `--force` hacia el live). Si el live cambió alguno de esos archivos desde el baseline: PARA, trae el cambio, re-aplica encima y repite QA de ese archivo.
     b. Con drift limpio y mi OK: `node $TK/scripts/push-changed.mjs --live --yes-live` (vuelve a hacer el drift-check, sube con `--nodelete` y corre el smoke check). Smoke-QA manual de 5 min en el live: home, PDP, add to cart, checkout.
     c. Verifica que Shopify empujó el commit al repo de GitHub del cliente; si no llegó, avísame: el próximo deploy desde GitHub revertiría los fixes.
3. **Tag en git:** `publish-AAAA-MM-DD`.
4. **Re-mide** el peso de $HOME_URL, $PDP_URL y $COLLECTION_URL en el LIVE con la misma metodología fija de la sección 2 → `data/resultados.json` validando contra `schemas/resultados.schema.json`.
5. **Informe de entrega** con la skill `informe-estilo-convertmate` (HTML autocontenido generado con `docgen.py`, desde los JSON del proyecto): qué se hizo por frente · tabla peso antes/después · validación técnica en ms · próximos hitos (dashboard en 2–3 días, CrUX en ~4 semanas). Reglas de la skill: sin rayas (—), nunca nombrar a nadie del equipo, sin prometer fechas, nada del Frente C. Todas las cifras salen de `data/*.json` con la metodología del SOP (el ejemplo de la skill cita PageSpeed: aquí no se usa, se cita la metodología del SOP en la sección "De dónde salen las cifras"). Si hay parches en un page builder, inclúyelo en "Lo que necesitamos de ustedes". Recuérdame el QA humano antes de entregar.
6. **Entrega:** el `.html` a la tarea de ClickUp + Loom explicándolo. Kenn lo revisa, lo publica y se lo presenta al cliente. Yo no publico el informe.
7. **Follow-up +2–3 días:** agenda la captura del dashboard Web Performance del cliente (RUM real, delay ~36h) y prepara el mensaje con la plantilla de `templates/mensajes-cliente.md`. Si hubo parches en Instant, revisa ese día con `grep -c "CM perf" sections/instant-*.liquid` sobre un pull del live que sigan ahí. Con esto el proyecto cierra.

Recordatorio de rollback (sección 9): checkout roto o pixel muerto → restaurar de inmediato, avisar después. Ruta A: re-publicar el tema anterior desde el Admin. Ruta B: no hay "tema anterior"; restaurar los archivos que subió `push-changed` con su versión del tag baseline (o del zip), o con "versiones anteriores" del editor de código del Admin. Síntomas ambiguos → consultar antes. Tema anterior y zip se conservan mínimo 5 semanas.

LISTO CUANDO: el informe quedó en ClickUp con su Loom y el follow-up del dashboard quedó agendado.
