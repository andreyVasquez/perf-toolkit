# Prompt 6 · Arregla el contenido — Frente B, es global

> Paso 6 del SOP. Prerequisito: ventana de bajo tráfico acordada en CONSTRAINTS y aviso al cliente enviado el día anterior (plantilla en `templates/mensajes-cliente.md`).

---

Estamos en el Paso 6 del SOP de ConvertMate: contenido (Frente B) de $SHOPIFY_STORE. OJO: aquí no hay copia posible — cada asset reemplazado pega en la tienda viva al instante. Solo se ejecuta dentro de la ventana de bajo tráfico acordada.

Antes de que abra la ventana:
1. Arma el plan por asset desde `data/diagnostico.json` (Frente B): URL actual · peso · spec destino · orden de reemplazo.
2. Deja todos los assets ya convertidos (specs estándar: SVG > 50 KB → WebP/PNG 1080px < 150 KB · GIF → MP4 H.264 + poster · video autoplay → 720p 2–3 Mbps o poster + clic).
3. Verifica que el aviso de ventana ya se envió.

Dentro de la ventana:
4. Reemplaza asset por asset en el orden del plan, verificando cada uno en la tienda tras subirlo.

Desinstalación de apps — protocolo de la sección 9, sin excepciones:
1. Export o screenshots completos de la configuración (descuentos, flows, settings).
2. Confirmación ESCRITA del cliente de que se puede desinstalar.
3. Verificar contra `CONSTRAINTS.md` que ninguna mecánica de negocio cuelga de ella.
4. Desinstalar → entrada en `CHANGELOG.md` con fecha y respaldo linkeado.

Actualiza el estado de cada hallazgo en `diagnostico.json`.

LISTO CUANDO: los assets quedaron subidos dentro de la ventana y las apps acordadas fueron desinstaladas con su respaldo hecho.
