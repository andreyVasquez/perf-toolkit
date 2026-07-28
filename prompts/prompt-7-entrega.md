# Prompt 7 · Publica, entrega y follow-up

> Paso 7 del SOP. Prerequisito: QA Gate (Paso 6.5) aprobado Y aprobación escrita del cliente. Nunca publicar sin ambas.

---

Estamos en el Paso 7 del SOP de ConvertMate: publicación y entrega de $SHOPIFY_STORE. Guíame en orden:

1. **Aprobación escrita.** Confirma que el aprobador de `CONSTRAINTS.md` aprobó por escrito sobre el link de preview. Sin esto no se sigue.
2. **Re-sincroniza** `settings_data.json` y `templates/*.json` desde el tema vivo hacia la copia (el cliente pudo tocar el Customizer; publicar sin esto le borra sus cambios).
3. **Smoke-QA post-resync** (5 min): home, PDP y checkout cargan y funcionan en el preview. Lo publicado debe ser lo aprobado — el resync pudo cambiar algo.
4. **Publica** desde el Admin (Temas → Publicar) — lo hago yo a mano — y luego crea el tag en git: `publish-AAAA-MM-DD`.
5. **Re-mide** el peso de $HOME_URL, $PDP_URL y $COLLECTION_URL con la misma metodología fija de la sección 2 → `data/resultados.json` validando contra `schemas/resultados.schema.json`.
6. **Informe de entrega** con el skill `convertmate-report`, desde los JSON del proyecto: qué se hizo por frente · tabla peso antes/después · validación técnica en ms · próximos hitos (dashboard en 2–3 días, CrUX en ~4 semanas). Recuérdame el QA humano antes de enviar el PDF.
7. **Follow-up +2–3 días:** agenda la captura del dashboard Web Performance del cliente (RUM real, delay ~36h) y prepara el mensaje con la plantilla de `templates/mensajes-cliente.md`. Con esto el proyecto cierra.

Recordatorio de rollback (sección 9): checkout roto o pixel muerto → restaurar tema anterior de inmediato, avisar después. Síntomas ambiguos → consultar antes. Tema anterior y zip se conservan mínimo 5 semanas.

LISTO CUANDO: el informe fue enviado y el follow-up del dashboard quedó agendado.
