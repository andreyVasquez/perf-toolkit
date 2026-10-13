---
name: informe-estilo-convertmate
description: Arma un informe para cliente (velocidad de carga, resultados de tests, auditoría, análisis, reporte de lo que se hizo) como una página HTML con la identidad visual de ConvertMate, lista para que Kenn la publique. Úsala cuando el colaborador diga "haz el informe", "arma el reporte para el cliente", "pásalo al estilo de ConvertMate", "informe de velocidad", "reporte de resultados" o cuando una tarea pida entregar un informe al cliente.
---

# Informe con el estilo de ConvertMate

Todo informe que va al cliente sale como una página web con la identidad de ConvertMate, nunca como
PDF, Word o Excel. Tú generas el archivo `.html` con esta skill y se lo entregas a Kenn. Kenn lo
publica y le comparte el link al cliente. Tú no publicas nada.

## 1. Reúne el insumo
- Lo que hiciste, con cifras reales: antes y después, capturas, mediciones, lo que quedó pendiente.
- Solo cifras que tengas medidas. Nada inventado ni redondeado a favor.

## 2. Genera la página
1. Copia `ejemplos/ejemplo-informe-velocidad.py` a tu carpeta de trabajo y cámbiale SOLO el contenido.
   Es un informe real ya publicado: úsalo como modelo de tono y de estructura.
2. Bloques disponibles (en `scripts/docgen.py`):
   - `hero(pill, titulo, bajada, cliente, dominio, pais=, fecha=, chips=[(clase,texto)])`
   - `indice([(id, titulo)])`
   - `section(id, eyebrow, titulo, descripcion, contenido)`
   - `metrics([metric(k, v, chip, [notas])])` para cifras grandes (antes → después)
   - `table(encabezados, filas, num=(índices de columnas numéricas))`
   - `card(titulo, *parrafos)` para explicar qué significa algo
   - `learns([learn(titulo, texto, [(clase, pill)])])` para hallazgos y cambios hechos
   - `ol([...])` para "Lo que sigue" y "Lo que necesitamos de ustedes"
   - `atribucion(titulo, texto)` para decir de dónde salen las cifras
   - `documento(titulo_pestana, *bloques, cliente=)` arma todo con encabezado, logos y pie
   - Pills: `pill-ok` (verde, logrado), `pill-warn` (amarillo, problema), `pill-neutral` (gris, pendiente)
3. Corre `python3 tu-informe.py`. Sale un solo archivo `.html` que ya trae todo adentro (estilos,
   logos, imágenes), sin depender de nada más.
4. Ábrelo en el navegador y revísalo en celular (390 px) y computador. Sin scroll horizontal.

## Estructura recomendada
Hero con el resultado en una frase → Lo que conseguimos (cifras) → Punto de partida →
Qué encontramos → Qué hicimos → Antes y después → Cómo lo verificamos → Lo que sigue →
Lo que necesitamos de ustedes (numerado) → De dónde salen las cifras.

## Reglas
- Nunca nombres a nadie del equipo: siempre "nuestro equipo".
- Sin raya (—) en el texto: `documento()` falla si encuentra una. Usa coma o punto.
- Sin disculpas por demoras y sin prometer fechas: eso lo decide Kenn.
- Si algo no mejoró, se dice tal cual.
- Si una mejora tiene plata detrás, la cifra va al mes y al año.

## 3. Entrega
- Sube el `.html` a la tarea de ClickUp (o al hilo de tu diario) junto con tu Loom explicando el informe.
- Kenn lo revisa, lo publica y se lo presenta al cliente. Sin Loom no se presenta.
