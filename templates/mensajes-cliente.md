# Mensajes al cliente — plantillas

Reemplaza `{{...}}` antes de enviar. El criterio de éxito se comunica como expectativa, **nunca como promesa contractual** de verde en CrUX. Mismas reglas que el informe: sin rayas (—), nunca nombrar a nadie del equipo ("nuestro equipo"), sin prometer fechas que no decidimos.

---

## 1 · Intake — criterio de éxito

> Hola {{nombre}}, antes de arrancar dejamos por escrito cómo se ve el éxito de esta ronda:
>
> "Éxito de la ronda: entrega del informe con los fixes aplicados, la reducción de peso por página (antes/después) y la validación técnica de mejora. A los 2–3 días compartimos la evidencia con usuarios reales desde el panel Web Performance de tu admin de Shopify. La confirmación oficial de Google (CrUX) se refleja en ~4 semanas, porque promedia una ventana de 28 días."
>
> ¿Nos confirmas que estamos de acuerdo con este alcance? Con tu OK lo dejamos registrado y arrancamos.
>
> Para trabajar más rápido partimos de estas reglas, confírmanos si aplican: las apps encendidas en el tema no se quitan (solo optimizamos cómo cargan); revisamos sus tags de medición y les entregamos un inventario para que ustedes decidan, y mientras tanto no tocamos ninguno; publica {{aprobador}}.

---

## 2 · Inventario de tags (con `docs/TAGS.md`)

> Hola {{nombre}}, les compartimos el inventario de las herramientas de medición y publicidad que hoy carga la tienda. Encontramos {{n_duplicados}} casos de doble conteo y {{n_obsoletos}} tag(s) obsoleto(s). Por favor llenen la columna "Decisión del cliente" (mantener, retirar o revisar). Mientras deciden no modificamos ningún tag: todos se tratan como activos, y verificamos que sigan disparando antes de publicar.

---

## 3 · Aviso de ventana de bajo tráfico (enviar el día anterior)

> Hola {{nombre}}, mañana {{día}} de {{hora_inicio}} a {{hora_fin}} vamos a hacer los reemplazos de contenido acordados (imágenes/videos/apps). Estos cambios aplican directo en la tienda, por eso usamos la ventana de bajo tráfico que definimos. Los assets ya están preparados, así que el trabajo dentro de la ventana es corto. Te avisamos al terminar.

---

## 4 · Aviso de parches en el page builder (si aplica, junto con la entrega)

> Algunas mejoras quedaron dentro de secciones de {{builder}}. Si alguien vuelve a publicar esas secciones desde {{builder}}, las mejoras se pierden. Antes de editarlas, avísennos y las dejamos hechas también desde el editor.

---

## 5 · Follow-up del dashboard (a los 2–3 días de publicar)

> Hola {{nombre}}, te compartimos la primera evidencia con usuarios reales: captura del panel Web Performance de tu admin de Shopify ({{fecha_captura}}), ya con la mejora reflejada. {{resumen_mejora}}
>
> Recuerda que la confirmación oficial de Google (CrUX) promedia una ventana de 28 días, así que ese dato se termina de reflejar en ~4 semanas. Con esto cerramos la ronda. Cualquier duda, quedamos atentos.

> El **informe** no se manda por aquí: sale como HTML con la skill `informe-estilo-convertmate`, va a la tarea de ClickUp con un Loom, y Kenn lo publica y se lo presenta al cliente.
