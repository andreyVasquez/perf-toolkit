# Prompt 5 · Arregla el código — Frente A, solo en tu copia

> Paso 5 del SOP. Prerequisito: plan del Paso 4 aprobado. Todo va al duplicado `$WORK_THEME_ID`, jamás al tema vivo.
> **Ruta rápida:** 3 agentes con archivos disjuntos, sin commit ni push; el operador commitea por fix y sube con `push-changed.mjs` (`prompts/playbook-agentes.md`, Fase 2). Fixes tipo: `playbook-tema-nativo.md`; parches en `sections/instant-*`: `playbook-instant.md`.

---

Estamos en el Paso 5 del SOP de ConvertMate: fixes de Frente A en la copia de trabajo de $SHOPIFY_STORE (tema `$WORK_THEME_ID`).

Reglas duras:
- Solo push al `$WORK_THEME_ID` con `node $TK/scripts/push-changed.mjs` (sube solo los archivos de código cambiados vs baseline, nunca `settings_data.json` ni `templates/*.json`). Publicar NO es parte de este paso.
- Respeta `CONSTRAINTS.md` y la regla de scripts de medición: nunca quitar un script de Google/Meta/TikTok sin confirmación escrita.
- No tocar `settings_data.json` ni `templates/*.json`.
- Nunca `--allow-mutations` ni `push --live` (ni `push-changed --live`: eso es del Paso 7).
- Página con test A/B activo no se toca visualmente.

Ciclo por cada fix de `data/diagnostico.json` (Frente A, en orden de severidad × esfuerzo):
1. Commit del estado actual.
2. Explica qué vas a cambiar y por qué (archivo:línea, métrica esperada).
3. Espera mi OK.
4. Aplica el cambio.
5. Push al duplicado.
6. Mide en preview con la metodología fija de la sección 2: traces + peso antes/después en ms y KB (mediana de 3). Preview con cookie (`/robots.txt?preview_theme_id=$WORK_THEME_ID` primero), restar la barra de preview (~419 KB) y reportar también "LCP sin popup".
7. Entrada en `CHANGELOG.md` con el antes/después.
8. Actualiza el estado del hallazgo en `diagnostico.json` (`aplicado`).

LISTO CUANDO: cada fix tiene su antes/después en `CHANGELOG.md`.
