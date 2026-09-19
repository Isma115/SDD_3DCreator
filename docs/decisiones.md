# Decisiones de implementación

Registro de las decisiones conservadoras tomadas al implementar los pendientes de
`SDD_specs/specs/`. Los documentos de Spec no se modifican: ni sus textos, ni sus
campos `- Estado: ...`, ni sus campos `- Color: ...`.

## 0.0.1 · División de responsabilidades de código (Estado: Activa)

Único requisito pendiente del markdown `0.0.1.md`. El resto de requisitos del
documento ya estaban implementados y no se han tocado.

Punto de partida: `renderer/app.js` concentraba todo el renderer (1153 líneas):
estado del modelo, matemáticas, cámara, WebGL, entrada, interfaz y exportación.

### Decisión 1 · Carga de módulos sin bundler

La especificación no fija ningún mecanismo de módulos. Se mantiene la arquitectura
existente (Electron + `file://` + `<script src>`, sin build ni dependencias nuevas)
y se dividen los ficheros usando scripts clásicos más un namespace único
`window.SDD3D`, en lugar de módulos ES.

Motivo: los módulos ES sobre `file://` quedan sujetos a comprobaciones de origen
que un script clásico no tiene, y la aplicación se sirve con `loadFile`. Introducir
un bundler habría añadido un requisito que las Specs no piden.

### Decisión 2 · Módulos creados

`renderer/index.html` carga, en este orden:

1. `modules/config.js` — namespace, colores, constantes de grid/cámara y geometría del cubo unidad.
2. `modules/names.js` — claves canónicas de coordenadas de rejilla.
3. `modules/math/vectors.js` — operaciones de vectores 3D.
4. `modules/math/matrices.js` — matrices de vista/proyección y transformaciones.
5. `modules/scene/model.js` — estado del modelo, cubos, aristas, caras y textos de estado.
6. `modules/math/camera.js` — cámara orbital, proyección a pantalla y direcciones de rejilla.
7. `modules/dom.js` — referencias del DOM y contexto 2D del mapa de textura.
8. `modules/scene/geometry.js` — primitivas de composición de vértices y líneas.
9. `modules/scene/grid.js` — rejilla 3D del entorno.
10. `modules/scene/mesh.js` — geometría de dibujo del modelo (superficies y líneas).
11. `modules/picking.js` — rayo de selección, intersección con cubos y punto más cercano.
12. `modules/renderer/renderer.js` — contexto WebGL, shaders, buffers, textura y bucle de dibujo.
13. `modules/export/obj.js` — fusión de caras visibles y exportación OBJ.
14. `modules/selection.js` — selección de puntos de unión, aristas y caras.
15. `modules/ui.js` — menús, botones, mapa de textura y cierre de menús.
16. `modules/input.js` — eventos del lienzo 3D y atajos de teclado.
17. `app.js` — punto de entrada: enlaza eventos, arranca el bucle y pinta el estado inicial.

Los módulos se comunican solo a través de `window.SDD3D`; ninguno depende de
variables globales sueltas.

### Decisión 3 · WebGL no disponible

En el fichero original, la ausencia de contexto WebGL abortaba todo el script
(`return` en la IIFE). Tras dividir el código ese `return` ya no puede detener el
arranque, así que `modules/renderer/renderer.js` publica en ese caso un
`SDD3D.renderer` con operaciones vacías y el mismo aviso en pantalla
(`WebGL no disponible`). El comportamiento visible se conserva: mensaje de estado
y ninguna llamada de dibujo.

### Decisión 4 · Sin cambios de comportamiento

La división es un movimiento de código, no una reescritura. Se conservan la
geometría, las constantes, el orden de dibujo, los tiempos (retardo de 220 ms del
click, umbral de arrastre), los textos de estado y los identificadores del DOM.
Los identificadores y nombres de fichero siguen el inglés usado ya en el código;
los comentarios se mantienen en español.

### Decisión 5 · Comprobaciones realizadas

Sin ejecutar la aplicación ni ninguna prueba. Solo comprobación estática del
código escrito:

- `node --check` sobre los 17 ficheros JavaScript.
- Carga de los 17 scripts en el orden de `index.html` sobre un DOM simulado: no
  hay referencias a `window.SDD3D.*` sin definir y todos los módulos registran su
  parte antes de que `app.js` los use.
- Todos los identificadores usados con `getElementById` existen en `index.html`.
- Comparación contra el `app.js` anterior: las 66 funciones originales están
  presentes, los 25 registros de `addEventListener` coinciden y el conjunto de
  literales de cadena es idéntico (la única diferencia son los 16 `'use strict'`
  de los módulos nuevos). Las diferencias restantes son solo el prefijo de
  namespace y el alias local de las referencias al DOM.

## 0.0.2 · Requisitos del markdown `0.0.2.md`

Los cuatro requisitos del documento estaban pendientes. Se implementan los cuatro.
Los campos `- Estado: ...` y `- Color: ...` de las Specs no se han tocado.

### Decisión 6 · Mini cubos visuales (Diseño)

Síntoma: sobre las caras de los cubos se veía una rejilla de minicubos.

Causa: `mesh.buildCubeEdgeLines` trazaba las 12 aristas de **cada** cubo, incluidas
las interiores entre cubos pegados, y esas líneas se dibujaban sobre las caras
lisas de los cubos vecinos.

Solución: se trazan solo las aristas que pertenecen a la superficie visible del
modelo. La regla se calcula en `geometry.exposedCubeEdges()`: una arista de rejilla
es la esquina de cuatro casillas a la vez; si las cuatro están ocupadas la arista
queda dentro del modelo y no se traza, y si falta alguna es un borde real. Al
tratarse de un conjunto de aristas de rejilla, las compartidas por varios cubos se
cuentan una sola vez (`names.edgeKeyOf` ordena los dos extremos para que la misma
arista dé la misma clave la mire el cubo que la mire).

Efecto: cubo suelto 12 aristas; dos cubos pegados 20; fila de tres 28; bloque
2×2×2 48 de 54; bloque 3×3×3 132 de 144; bloque 4×4×4 192 de 300 (las ocultas son
siempre las aristas interiores del sólido). El contorno amarillo del
bloque seleccionado en modo teclado sigue siendo el del cubo completo (12 aristas):
es el indicador de selección y las Specs no piden cambiarlo. La opción
`Ver > Líneas de cubos` del menú sigue funcionando igual, ahora sin rejilla interior.

### Decisión 7 · Cubo de partida dinámico (Funcional)

Con el control de teclado, el bloque de partida no cambiaba al colocar con WASD: el
segundo bloque se calculaba desde el bloque original, que ya estaba ocupado, y el
modelo dejaba de crecer. Ahora, tras colocar un bloque, el punto de partida pasa a
ser el bloque recién colocado, de modo que se pueden encadenar bloques sin volver a
seleccionar a mano. Si la casilla de destino está ocupada no se coloca nada y el
punto de partida se queda donde estaba.

La ambigüedad de la Spec (no dice literalmente cuál debe ser el nuevo punto de
partida) se resuelve así por ser la lectura que elimina el bloqueo descrito y la
que mantiene el modelo creciendo en la dirección de la cámara.

### Decisión 8 · Deshacer y rehacer (Funcional)

Módulo nuevo `modules/history.js`, cargado antes de `ui.js` e `input.js` y después
de `selection.js`. Se registra en `SDD3D.history`.

Modelo elegido: **fotogramas del estado del modelo** (bloques, aristas, caras,
bloque seleccionado y puntos en curso) en lugar de operaciones inversas. Son pocos
datos y así ninguna vía de cambio se queda fuera del historial. El tope es de 100
fotogramas; al superarlo se descarta el más antiguo, que pasa a ser el nuevo suelo.

Captura de cambios: `addCube`, `removeCube`, `addEdge` y `addFace` se envuelven al
cargar el módulo, y solo guardan fotograma cuando el cambio ha sido efectivo (las
funciones devuelven un valor falso si el espacio está ocupado, la arista o la cara
ya existen o el bloque no existe). Son la única vía de modificación del modelo, así
que no hace falta instrumentar cada sitio que las llama. Elegir el bloque de
partida no genera entrada propia: es un cursor, y cada fotograma ya guarda cuál
estaba seleccionado. Mover el punto de partida y colocar el bloque cuentan como una
sola acción (`SDD3D.history.runAsOneChange`, envoltorio de uso interno; ver
Decisión 11).

Atajos: `Ctrl+z` deshace y `Ctrl+y` rehace, disponibles en los dos controles y con
el aviso de exportación abierto. `Ctrl+Mayús+z` también rehace, por costumbre
extendida en otros editores; añadirlo no quita nada a lo pedido. En macOS se acepta
`Cmd` además de `Ctrl` porque `Ctrl+z` no es el atajo natural del sistema.

Fuera del historial, de forma deliberada: la órbita y el zoom de cámara, el modo de
control, las opciones de vista y el mapa de textura. Las Specs solo piden deshacer y
rehacer, y en el enunciado «Ctrl+z y Ctrl+y para Deshacer y Rehacer» no se detalla
qué cuenta como acción deshacible. Se limita a los cambios del modelo 3D, que son
los que el usuario espera poder revertir sin perder la vista que ha encuadrado.

### Decisión 9 · Aviso de exportación (Funcional)

`modules/export/obj.js` separa el cálculo del informe (`buildCompressionReport`) de
la presentación: la exportación sigue generando y descargando el OBJ y además
devuelve el informe, y es `ui.openExportModal(report)` quien rellena el aviso. Así
la exportación no depende del DOM y el aviso queda en el módulo de interfaz.

El aviso es un modal nuevo (`#exportModal` en `index.html`, estilos en
`styles.css`) con el mismo aspecto que el de textura. Muestra un resumen y una
tabla de tres filas:

| Dato | Comprimido | Antes |
| --- | --- | --- |
| Vértices | vértices únicos del resultado | 8 por bloque |
| Caras | caras visibles del resultado | 6 por bloque |
| Puntos | puntos de unión del modelo | puntos de unión del modelo |

Ambigüedad de la Spec («la cantidad nueva de vértices, caras, puntos, etc
resultantes de haber realizado la compresión»): se interpreta que «nueva» es la
cifra resultante de la compresión y se acompaña de la cifra anterior para que el
aviso sea informativo y comparable. «Puntos» se toma como los puntos de unión de la
rejilla que el modelo ya usa (`app.getModelPoints`); la compresión no los modifica,
así que antes y después coinciden. Se cierra con su botón, con `Escape` o pulsando
fuera de la tarjeta, y mientras está abierto no se colocan bloques con WASD.

### Decisión 10 · Selección del bloque de partida centralizada

`app.setSelectedCube` y `selection.setPointPath` son ahora los dos únicos puntos de
cambio de la selección. El historial necesita observar la selección para
restaurarla, y centralizarla evita tener que interceptar cada sitio que la
modificaba (entrada, click de selección y cambio de control).

### Decisión 11 · Correcciones encontradas al comprobar

Durante la comprobación estática aparecieron tres defectos que se han corregido:

1. Los fotogramas del historial compartían las referencias de los puntos con el
   estado vivo, así que un fotograma antiguo se modificaba solo. Ahora `collect()`
   copia cada punto.
2. El fotograma que se guardaba era el **anterior** al cambio, de modo que rehacer
   no podía devolver el estado siguiente. Ahora se guarda el estado resultante
   después de cada cambio.
3. Al colocar con WASD, `addCube` guardaba el fotograma antes de que
   `keyboardPlace` moviera el punto de partida, y esa segunda modificación no
   entraba en el historial. Ahora las dos forman una sola acción
   (`runAsOneChange`).

### Decisión 12 · Comprobaciones realizadas

Sin ejecutar la aplicación ni ninguna prueba, y sin modificar ningún fichero de
Spec. Comprobación estática del código escrito:

- `node --check` sobre los 18 ficheros JavaScript.
- Carga de los 18 scripts en el orden de `index.html` sobre un DOM simulado, con
  el namespace vigilado: ninguna lectura de `SDD3D.<algo>` sin definir y ningún
  `getElementById` de un identificador que no exista en `index.html`.
- 65 comprobaciones de comportamiento sobre ese DOM simulado: reparto de aristas
  visibles en cubo suelto, dos cubos pegados, fila de tres, 2×2×2 y 3×3×3 (contraste
  con el cálculo explícito de la regla de las cuatro casillas); encadenado de WASD y
  casilla ocupada; deshacer/rehacer con suelo, techo, descarte del futuro y
  restauración de la selección; aristas y caras en el historial; y las cifras del
  aviso de exportación (un cubo y dos cubos, con la reducción de caras y vértices).

Los scripts de comprobación son temporales y no forman parte del proyecto.

### Decisión 13 · Corrección de la regla de aristas interiores (Mini cubos visuales)

Al revisar el requisito «Mini cubos visuales», que sigue en `- Estado: Activa`, la
comprobación estática de `geometry.exposedCubeEdges()` reveló que la regla solo
ocultaba una parte de las aristas interiores: en un bloque 3×3×3 trazaba 139 de las
144 aristas de cubo en vez de 132, y en un 4×4×4 264 de 300. Las que se le escapaban
volvían a dibujarse justo sobre las caras lisas, que es el síntoma de la Spec.

Causa: las cuatro casillas que rodean una arista se miraban desde el punto de
arranque que trae la arista, y ese punto no es fijo: el mismo tramo se recorre desde
una esquina u otra según el cubo que lo mire. Cuando el cubo lo recorría desde su
esquina menor, la comprobación se hacía sobre las cuatro casillas del lado contrario
y la arista pasaba por borde real. La proporción de aristas interiores que se
escapaban crece con el tamaño del bloque: 2×2×2 traza 54 aristas en vez de 48 (6 de
más), 3×3×3 139 en vez de 132 (7 de más) y 4×4×4 264 en vez de 192 (72 de más).

Solución: se toma como base la esquina de **mayor** coordenada de la arista, que es
la misma la recorra quien la recorra, y se comprueban las cuatro casillas del bloque
2×2 que crece desde ahí hacia los dos ejes perpendiculares (desplazamientos −1 y 0),
que es exactamente el conjunto de casillas que comparten la arista. El resto del
módulo no cambia: la clave de arista (`names.edgeKeyOf`) sigue ordenando los dos
extremos y cada arista se sigue contando una sola vez.

Efecto medido (aristas trazadas / aristas de cubo únicas): cubo suelto 12/12, dos
cubos 20/20, fila de tres 28/28, L y escalera 36/36, bloques separados 24/24, capa
3×3 plana 60/64, 2×2×2 48/54, 3×3×3 132/144, 3×3×3 sin centro 120/144, 4×4×4
192/300. En todos los casos el conjunto oculto coincide con el oráculo de ocupación
(arista interior = las cuatro casillas que la rodean existen) y ninguna arista
trazada es ajena al modelo. Los recuentos de la Decisión 6 quedan corregidos aquí.

Con la corrección, las caras planas del modelo no reciben ninguna línea interior: lo
que se dibuja son los bordes reales de la superficie (`Ver > Líneas de cubos`), que
es lo que pide el requisito «Líneas en los cubos» de `0.0.1.md`.

### Decisión 14 · Comprobación de la corrección

Sin ejecutar la aplicación ni ninguna prueba, y sin modificar ningún fichero de
Spec: `node --check renderer/modules/scene/geometry.js` y una comprobación sobre los
módulos reales cargados en un contexto aislado (`config.js`, `names.js`,
`geometry.js`, con el estado del modelo simulado), sin DOM ni WebGL.

Comprobado en once formas (cubo suelto, dos cubos, fila de tres, 2×2×2, 3×3×3,
4×4×4, L, escalera, 3×3×3 sin centro, dos bloques separados y capa 3×3 plana):
aristas trazadas = aristas de cubo únicas − aristas interiores según el oráculo de
ocupación, sin aristas ajenas y con el conjunto oculto idéntico al del oráculo. Antes
de la corrección, esa misma comprobación fallaba en 2×2×2 (54 trazadas frente a 48),
3×3×3 (139 frente a 132) y 4×4×4 (264 frente a 192), y coincidía en las formas
pequeñas de una sola capa o de un solo cubo de grosor.

### Ambigüedades y correcciones constatadas (Mini cubos visuales)

1. El lienzo 2D del mapa de textura (`initializeTextureCanvas`) lleva una cuadrícula
   de referencia de 32 píxeles y el mapa se aplica a la cara completa de cada cubo,
   así que esa cuadrícula de la textura se ve repetida sobre las caras mientras haya
   textura pintada. No se toca: la Spec habla de una rejilla de minicubos en los
   cubos, que es geometría (aristas), y el lienzo con cuadrícula es el mapa de
   textura que pide «Texturizado» en `0.0.0.md`; quitar la cuadrícula cambiaría el
   contenido del mapa, no la superficie del cubo.
2. La Spec no dice si la corrección debe aplicarse también al contorno amarillo del
   bloque seleccionado en modo teclado. Se mantiene el contorno completo del cubo:
   es el indicador de selección, no una arista de la superficie, y ninguna Spec pide
   cambiarlo.
3. La Decisión 6 daba por buenos los recuentos 54 y 139 que produce la regla tal
   como estaba. No eran el resultado correcto de la regla: se conserva su texto por
   ser el registro de lo decidido entonces y aquí queda constatada la corrección
   (Decisión 13). El requisito sigue con `- Estado: Activa` en la Spec, que no se ha
   tocado.

### Decisión 15 · La cuadrícula del mapa de textura se estampaba en las caras

Con la Decisión 13 la geometría de las caras quedó lisa (solo bordes reales), pero la
rejilla de minicubos seguía apareciendo porque tenía un segundo origen, este de
textura y no de geometría.

Causa: `renderer.initializeTextureCanvas` pintaba en el mapa 2D una cuadrícula de
referencia cada 32 píxeles (256/32 = 8×8) y `geometry.addQuad` asigna a cada cara las
UV `[0,0]`–`[1,1]`, es decir el mapa completo. El mapa entero, cuadrícula incluida,
se aplicaba a **cada** cara del cubo y se veía como una rejilla de 8×8 minicubos
sobre caras planas. La luz es constante por cara y el color del mapa se multiplica
por ella, así que la cuadrícula se veía con nitidez.

Solución: el mapa de textura arranca liso (un solo `fillRect` con el color base). No
se toca nada más: ni las UV, ni el shader, ni el pincel, ni la importación de
imágenes, ni el tamaño del lienzo. Lo que se pinte o se importe se sigue viendo en
las caras igual que antes.

Comprobado que el defecto no venía de otro sitio, para no dejar el síntoma a medias:

- El grid del entorno se dibuja solo en el plano del suelo (y=−0.003) con
  `depthMask(false)` y **antes** de la malla, con la prueba de profundidad activa: no
  puede atravesar las caras del cubo.
- Las líneas de cubo (`buildCubeEdgeLines`) solo trazan bordes reales de la
  superficie (Decisión 13): en un cubo suelto son sus 12 aristas, el contorno.
- El contorno amarillo del bloque seleccionado solo se dibuja en modo teclado y
  sobre el bloque señalado; no aparece por defecto en modo mouse.
- El shader no tiene patrón de rejilla: luz constante por cara y color plano o
  textura.

### Decisión 16 · Comprobación de la Decisión 15

Sin ejecutar la aplicación ni ninguna prueba, y sin modificar ningún fichero de
Spec: `node --check renderer/modules/renderer/renderer.js` y una comprobación sobre
el módulo real cargado en un contexto aislado (`renderer.js` con WebGL simulado, que
compila y enlaza) registrando las llamadas al contexto 2D del mapa de textura.

Resultado: en el arranque el mapa recibe una única llamada, `fillRect(0,0,256,256)`,
y cero trazos de cuadrícula. Antes de la corrección el mismo registro daba 18 trazos
(`beginPath`, `moveTo`, `lineTo`, `stroke`) además del relleno.

### Decisión 17 · Corrección de las ambigüedades anotadas en la Decisión 14

La ambigüedad 1 de la Decisión 14 decía que la cuadrícula del mapa de textura no se
tocaba por ser contenido del mapa. Con el aviso del usuario («siguen apareciendo,
parece solo un error visual») se resuelve lo contrario: el requisito «Mini cubos
visuales» pide que los cubos se vean lisos, y con las UV actuales cualquier
cuadrícula del mapa se ve en las caras. Se quita la cuadrícula del mapa, no la
textura: pintar, importar y ver lo pintado siguen igual. El mapa de textura que pide
«Texturizado» sigue existiendo y sigue siendo pintable; lo único que desaparece es
una guía de referencia que no pedía ninguna Spec.

Las ambigüedades 2 y 3 de esa decisión siguen vigentes tal cual.

### Nota

El directorio `docs/` de este proyecto desapareció del disco durante la sesión
(última modificación del directorio raíz: 02:20). Este fichero se ha restaurado con
su contenido original íntegro más las decisiones de `0.0.2`.
