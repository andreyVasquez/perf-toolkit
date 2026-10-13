"""Ejemplo real: informe de velocidad de BeautyBoost (5-oct-2026), publicado en
https://blueprint.convertmate.co/v/beautyboost-velocidad-2026-10-cf2bdc.html
Para un documento nuevo: copia este archivo, cambia SOLO el contenido y corre:  python3 mi-doc.py
El HTML sale en la carpeta desde donde lo corres."""
import sys,os
sys.path.insert(0, os.path.expanduser('~/.claude/skills/informe-estilo-convertmate/scripts'))
from docgen import *

cabecera=hero('Velocidad de carga',
  'Velocidad de carga de BeautyBoost: auditoría y resultados de la primera fase',
  'El contenido principal de la tienda ahora aparece en menos de la mitad del tiempo en las tres páginas medidas, sin ningún cambio visual. La tienda en vivo no se ha tocado: las correcciones están en una copia del tema y se publican con su aprobación.',
  'BeautyBoost','beautyboost.com.co',fecha='5 de octubre de 2026',
  chips=[('pill-neutral','3 páginas medidas: inicio, ficha y colección'),('pill-neutral','Celular primero'),('pill-ok','Tienda en vivo sin modificar')])

nav=indice([('resumen','Lo que conseguimos'),('partida','El punto de partida con visitantes reales'),('causa','Por qué la tienda se demora'),('hallazgos','Lo que encontramos'),('correcciones','Lo que corregimos'),('antes-despues','Antes y después'),('verificacion','Cómo verificamos que nada se rompió'),('nota','Por qué la nota de PageSpeed no sube'),('sigue','Lo que sigue'),('necesitamos','Lo que necesitamos de ustedes')])

s1=section('resumen','Resumen','Lo que conseguimos','Aplicamos las correcciones de la primera fase en una copia del tema y la medimos contra la tienda en vivo, al mismo tiempo y en las mismas condiciones.',
 metrics([metric('Inicio · contenido principal','23,3 → 10,2 s','↓ 56% menos tiempo',['Medido con PageSpeed en celular, mediana de tres corridas']),
          metric('Ficha de producto · contenido principal','20,7 → 8,5 s','↓ 59% menos tiempo',['Ficha del Colágeno Hidrolizado de Máxima Absorción']),
          metric('Colección · contenido principal','23,0 → 8,2 s','↓ 64% menos tiempo',['Colección Bienestar'])])+
 card('Qué significa','El primer contenido en pantalla también llega en la mitad del tiempo: pasa de 8 a 10 segundos a 4 o 5 segundos en las tres páginas. Todo esto sin ningún cambio visual en la tienda.',
      'Estas son medidas de laboratorio, con un celular de gama media y una conexión 4G lenta. Un visitante real ve la tienda mucho más rápido. Las usamos porque permiten comparar el antes y el después con la misma vara, el mismo día.'))

s2=section('partida','Punto de partida','El punto de partida con visitantes reales','Google mide la velocidad con el tiempo que tarda en aparecer el elemento principal de la pantalla (LCP). Estos son los datos de visitantes reales en celular de los últimos 28 días, al 3 de octubre de 2026.',
 metrics([metric('Velocidad de carga (LCP)','3,1 s','Objetivo ≤ 2,5 s',['En la página de inicio es 3,5 s']),
          metric('Respuesta al tocar (INP)','285 ms','Objetivo ≤ 200 ms',['En amarillo, cerca del objetivo']),
          metric('Estabilidad visual (CLS)','0,00','Cumple · objetivo ≤ 0,10',['La página no salta mientras carga'])])+
 table(['Página (celular, visitantes reales)','Carga','Respuesta al tocar','Estabilidad','Estado'],
  [['Inicio','3.508 ms','327 ms','0,01','<span class="pill-warn">La más lenta</span>'],
   ['Ficha · Colágeno Hidrolizado de Máxima Absorción','3.227 ms','322 ms','0,00','<span class="pill-warn">Fuera en carga</span>'],
   ['Colección · Bienestar','3.168 ms','253 ms','0,00','<span class="pill-warn">Fuera en carga</span>'],
   ['Promedio del sitio','3.095 ms','285 ms','0,00','<span class="pill-warn">Fuera en carga</span>']],num=(1,2,3))+
 '<p class="section-desc prosa-larga">En la página de inicio, el 47% de las visitas espera más de 2,5 segundos para ver el contenido principal. En computador el sitio cumple casi todo, con una excepción: la ficha de producto tarda 3,9 s también en escritorio, lo que indica que tiene un problema de peso propio.</p>'+
 table(['Semana','Inicio','Ficha','Colección'],[['20 de junio','2.331 ms','2.594 ms','2.163 ms'],['1 de agosto','3.848 ms','3.805 ms','4.109 ms'],['12 de septiembre','3.042 ms','3.121 ms','1.743 ms'],['3 de octubre','3.508 ms','3.227 ms','3.168 ms']],num=(1,2,3))+
 card('Hubo un momento en que esto empeoró','Entre finales de junio y la primera semana de julio de 2026 la velocidad empeoró a la vez en las tres páginas: el inicio pasó de 2,3 s a 3,8 s. Que las tres empeoren juntas apunta a un cambio que afecta todo el sitio, como una app nueva, un script agregado al tema o un cambio de tema. La colección se recuperó en septiembre (llegó a 1,7 s) y volvió a empeorar en las dos últimas semanas. Identificar qué cambió en esas fechas puede ser el ajuste que más velocidad devuelva.'))

s3=section('causa','La causa','Por qué la tienda se demora','Grabamos la carga de las tres páginas simulando un celular con una conexión 4G lenta, tres veces cada una. En las tres pasa lo mismo.',
 learns([learn('El servidor responde rápido','La tienda entrega la página en menos de 0,2 s. No es un problema de Shopify ni del hosting.',[('pill-ok','Bien')]),
         learn('La imagen principal se pide a tiempo','El navegador la pide en menos de un segundo y con prioridad alta.',[('pill-ok','Bien')]),
         learn('Pero tarda entre 11 y 19 segundos en llegar','Al mismo tiempo la página está descargando entre 2,4 y 3,7 MB de otras cosas, y en una conexión lenta todo comparte el mismo ancho de banda.',[('pill-warn','Aquí está el freno')])])+
 table(['Página','Peso total','Archivos'],[['Inicio','6,4 MB','366'],['Ficha de producto','7,9 MB sin contar video','560'],['Colección','5,5 MB','366']],num=(1,2))+
 '<p class="section-desc prosa-larga">Más de la mitad del peso es código JavaScript (3,1 a 3,6 MB por página), casi todo de apps y etiquetas de medición.</p>')

s4=section('hallazgos','Hallazgos','Lo que encontramos','Cinco puntos concretos, ordenados por el tiempo que devuelven.',
 learns([learn('1 · Cuatro imágenes «urgentes» donde debería haber una','El tema marca como prioritaria la primera imagen de cada carrusel, no solo la de arriba. El inicio tiene cuatro carruseles, así que el navegador descarga cuatro imágenes a la vez aunque tres estén muy abajo. En la ficha pasa lo mismo con la galería, un carrusel y dos bloques de producto destacado.',[('pill-ok','Corregido en la copia')]),
         learn('2 · Una librería de íconos completa para tres íconos','El pie de página carga FontAwesome completa, en versión de prueba, para dibujar WhatsApp, correo y teléfono. Son 241 KB que se descargaban con prioridad máxima, por delante de la imagen principal, en todas las páginas.',[('pill-ok','Corregido en la copia')]),
         learn('3 · La imagen del popup pesa 1 MB','El popup de Klaviyo usa un PNG de 923 × 1118 píxeles que se muestra a 541 × 655. Una versión optimizada pesa menos de 100 KB y se ve igual.',[('pill-warn','Se ajusta en Klaviyo')]),
         learn('4 · Tres videos completos en la ficha de producto','El widget de Videowise descarga tres videos, unos 9,5 MB, aunque el visitante no los reproduzca. Es más que todo el resto de la página junta. Se corrige mostrando la portada y descargando el video solo cuando se toca.',[('pill-warn','Se ajusta en Videowise')]),
         learn('5 · Un script que ya no hace nada','El tema carga en todas las páginas un script de RD Station que hoy devuelve un archivo vacío. Quitarlo no cambia ninguna medición, pero queremos su confirmación antes.',[('pill-neutral','Pendiente de su confirmación')])]))

s5=section('correcciones','El trabajo','Lo que corregimos','Todo sobre una copia del tema. La tienda en vivo sigue igual.',
 learns([learn('Una sola imagen «urgente» por página','Ahora solo la primera sección tiene prioridad y el resto se carga al bajar. Es el ajuste que más tiempo devolvió.'),
         learn('Fuera la librería FontAwesome','Los tres íconos del pie de página son ahora dibujos vectoriales idénticos: 241 KB menos por página.'),
         learn('El carrusel del inicio espera a que la página se vea','Rotaba cada 2,5 s desde antes de que la página apareciera, y en celulares lentos se veía primero la segunda diapositiva en blanco. Ahora empieza a rotar cuando la página terminó de cargar.'),
         learn('Tipografía pedida una sola vez','La fuente Poppins se pedía dos veces a Google por una diferencia de mayúsculas en la configuración.'),
         learn('Script vacío de RD Station','Preparado para retirarse cuando nos confirmen que ya no se usa.',[('pill-neutral','Pendiente')])]))

s6=section('antes-despues','Antes y después','Antes y después','Tienda en vivo y copia con las correcciones, medidas de forma intercalada en la misma sesión. Tres corridas por página, se reporta la del medio.',
 table(['Página','Métrica','En vivo','Con correcciones','Cambio'],
  [['Inicio','Contenido principal','23,3 s','10,2 s','<span class="pill-ok">−56%</span>'],['','Primer contenido','9,6 s','4,7 s','<span class="pill-ok">−51%</span>'],['','Nota de PageSpeed','25','27','+2'],
   ['Ficha de producto','Contenido principal','20,7 s','8,5 s','<span class="pill-ok">−59%</span>'],['','Primer contenido','8,2 s','4,8 s','<span class="pill-ok">−41%</span>'],['','Nota de PageSpeed','26','26','igual'],
   ['Colección','Contenido principal','23,0 s','8,2 s','<span class="pill-ok">−64%</span>'],['','Primer contenido','9,6 s','4,4 s','<span class="pill-ok">−54%</span>'],['','Nota de PageSpeed','27','28','+1']],num=(2,3,4))+
 '<p class="section-desc prosa-larga">La segunda vara son grabaciones reales de la carga en Chrome, simulando un celular con 4G lenta. Son más exigentes y más variables que PageSpeed.</p>'+
 table(['Página','En vivo','Con correcciones','Cambio'],[['Inicio','21,2 s','12,6 s','<span class="pill-ok">−41%</span>'],['Ficha de producto','14,2 s','10,8 s','<span class="pill-ok">−24%</span>'],['Colección','11,6 s','14,9 s','<span class="pill-neutral">Sin mejora medible</span>']],num=(1,2,3))+
 card('Lo decimos tal cual','En la colección esta segunda medición no muestra mejora. La colección ya tenía una sola imagen prioritaria, así que el ajuste principal no le aplicaba. Además, la copia del tema se mide con dos desventajas que la tienda publicada no tendrá: la barra de vista previa de Shopify (unos 370 KB) y una redirección de 0,6 s al entrar. La confirmación definitiva de la colección será la medición después de publicar.',
      'Otro dato que da confianza: con las correcciones la página de inicio es mucho más estable. Sus tres cargas dieron 13,5, 12,3 y 12,6 s. En vivo oscilaron entre 14 y 22 s.'))

s7=section('verificacion','Control','Cómo verificamos que nada se rompió','Antes de pedir su aprobación revisamos la copia completa.',
 learns([learn('Revisión visual','Capturas completas en vivo contra la copia, en celular y computador. Solo aparecen las diferencias esperadas: el carrusel en otra diapositiva, la barra de vista previa, popups al azar y secciones que cargan a distinto ritmo.',[('pill-ok','Sin cambios visuales')]),
         learn('Compra','En la copia, «Añadir al carrito» agrega el producto y abre el carrito lateral.',[('pill-ok','Funciona')]),
         learn('Medición','En la copia disparan todas las etiquetas: Google Analytics, Google Ads (incluido el evento de agregar al carrito), Campaign Manager, Meta, TikTok, Klaviyo, Clarity y el tracker de atribución.',[('pill-ok','Intacta')])]))

s8=section('nota','Sobre la nota','Por qué la nota de PageSpeed no sube','La nota de PageSpeed le da mucho peso al tiempo con el navegador bloqueado, que hoy está entre 2,5 y 4 segundos. Ese bloqueo viene de código que corre en el celular del visitante, y casi todo es de terceros, no del tema. Ninguna de estas herramientas se debe quitar, pero algunas se pueden cargar con menos impacto.',
 table(['Fuente','Tiempo de procesador','Qué se puede hacer'],
  [['Etiquetas de Google','~1,6 s','Hoy hay cinco identificadores distintos (Ads, dos Analytics, Google &amp; YouTube, Campaign Manager), más Merchant Center. Unificarlos en Tag Manager con su equipo de pauta es la acción de mayor impacto.'],
   ['Klaviyo','~1,0 s','Optimizar la imagen del popup, que pesa casi 1 MB.'],
   ['Script de una app que corre como bloque único','2,2 a 2,6 s','Identificar a qué app pertenece y si se puede diferir.'],
   ['Mercado Pago (antifraude)','0,4 a 1,0 s','Intocable: protege los pagos.'],
   ['Zipify One Click Upsell','~0,4 s · 390 KB','Revisar si puede cargar solo en carrito y ficha.']],num=(1,))+
 '<p class="section-desc prosa-larga">Quedan dos ajustes de contenido que no requieren código: la imagen del popup de Klaviyo (de 1 MB a menos de 100 KB) y los videos de la ficha en Videowise (9,5 MB que se descargan aunque nadie los reproduzca). También hay un píxel de app que responde con error en cada carga.</p>')

s9=section('sigue','Qué sigue','Lo que sigue','Con las etiquetas de medición y las apps de negocio hay un límite que no depende del tema. Por eso no prometemos llegar al verde en esta ronda, y cada fase se mide antes de pasar a la siguiente.',
 table(['Fase','Qué se hace','Dónde','Estado'],
  [['1','Una sola imagen prioritaria por página','Código del tema, en la copia','<span class="pill-ok">Hecho</span>'],['1','Íconos del pie de página sin FontAwesome','Tema','<span class="pill-ok">Hecho</span>'],['1','Imagen del popup optimizada','Klaviyo','<span class="pill-neutral">Pendiente</span>'],
   ['2','Videos de la ficha con portada y carga al tocar','Videowise','<span class="pill-neutral">Pendiente</span>'],['2','Quitar el script vacío de RD Station y la tipografía duplicada','Tema','<span class="pill-warn">Falta su confirmación</span>'],
   ['3','Zipify y chat solo donde se usan, etiquetas de Google unificadas','Apps y pauta, con su equipo','<span class="pill-neutral">Siguiente ronda</span>']])+
 ol(['Publicar la copia del tema con su aprobación, en una ventana de bajo tráfico.','Volver a medir la tienda publicada, ya sin la barra de vista previa.','Seguir los visitantes reales en el panel de velocidad de Shopify a los 2 o 3 días, y en Google en unas 4 semanas, porque promedia 28 días.']))

s10=section('necesitamos','De su lado','Lo que necesitamos de ustedes','Con esto cerramos la primera fase y arrancamos la segunda.',
 ol(['Su aprobación para publicar la copia del tema con las correcciones, y la persona que la aprueba.',
     'Confirmarnos si RD Station sigue en uso, y cuáles etiquetas de medición siguen activas (Google Ads, Analytics, Campaign Manager, Meta, TikTok).',
     'El historial de cambios entre el 20 de junio y el 10 de julio (apps instaladas o activadas, cambios de tema), y qué cambió en la colección Bienestar desde mediados de septiembre.',
     'Una captura del panel de velocidad web de Shopify (Análisis, Informes) como punto de partida.']))


attr=atribucion('De dónde salen las cifras','Visitantes reales: Chrome UX Report, percentil 75 en celular, 28 días al 3 de octubre de 2026. Laboratorio: Lighthouse 12.8 en modo celular y grabaciones de Chrome DevTools, con 4G lenta y procesador 4 veces más lento, caché vacía, mediana de tres corridas, tienda en vivo y copia intercaladas el 5 de octubre de 2026. La copia incluye la barra de vista previa de Shopify.')

html=documento('BeautyBoost · Velocidad de carga · ConvertMate',cabecera,nav,s1,s2,s3,s4,s5,s6,s7,s8,s9,s10,attr,cliente='BeautyBoost')
open('bb-velocidad.html','w').write(html); print('bb-velocidad.html',len(html))
