# Prompt 5 · Arregla el código — Frente A, solo en tu copia

> Paso 5 del SOP. Prerequisito: plan del Paso 4 aprobado. Todo va al duplicado `$WORK_THEME_ID`, jamás al tema vivo.

---

Estamos en el Paso 5 del SOP de ConvertMate: fixes de Frente A en la copia de trabajo de $SHOPIFY_STORE (tema `$WORK_THEME_ID`).

Reglas duras:
- Solo push al `$WORK_THEME_ID` (`shopify theme push --theme $WORK_THEME_ID --path ./theme`). Publicar NO es parte de este paso.
- Respeta `CONSTRAINTS.md` y la regla de scripts de medición: nunca quitar un script de Google/Meta/TikTok sin confirmación escrita.
- No tocar `settings_data.json` ni `templates/*.json`.
- Nunca `--allow-mutations` ni `push --live`.
- Página con test A/B activo no se toca visualmente.

Ciclo por cada fix de `data/diagnostico.json` (Frente A, en orden de severidad × esfuerzo):
1. Commit del estado actual.
2. Explica qué vas a cambiar y por qué (archivo:línea, métrica esperada).
3. Espera mi OK.
4. Aplica el cambio.
5. Push al duplicado.
6. Mide en preview con la metodología fija de la sección 2: traces + peso antes/después en ms y KB (mediana de 3).
7. Entrada en `CHANGELOG.md` con el antes/después.
8. Actualiza el estado del hallazgo en `diagnostico.json` (`aplicado`).

LISTO CUANDO: cada fix tiene su antes/después en `CHANGELOG.md`.
