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

## 0.0.3 · Requisito del markdown `0.0.3.md`

Único requisito del documento: «Mejora de compresión de modelo» (`- Estado: Activa`).
Al exportar, el modelo seguía teniendo más vértices y caras de los necesarios. No se
ha tocado ningún fichero de Spec: el estado sigue siendo `Activa` y los campos
`- Estado: ...` y `- Color: ...` de todas las Specs quedan como estaban.

### Decisión 18 · Diagnóstico: faltaba fusionar caras coplanares

La compresión previa (`buildExportMesh` en `modules/export/obj.js`) ya eliminaba las
caras ocultas entre bloques pegados y unificaba vértices coincidentes, pero cada
bloque seguía aportando sus caras unidad una a una. En una pared de 2×1 bloques, por
ejemplo, las dos caras frontales se exportaban como dos quads de 1×1 con 6 vértices,
cuando un solo quad de 2×1 con 4 vértices las cubre exactamente. Ese era el exceso
restante de vértices y caras que señala la Spec.

### Decisión 19 · Fusión de caras coplanares contiguas (greedy meshing)

`buildExportMesh` agrupa ahora las caras unidad expuestas en **planos** (misma
dirección y sentido de la normal, misma coordenada en ese eje) y fusiona en cada
plano las casillas contiguas en **rectángulos mayores**: desde cada casilla libre se
crece todo lo posible a lo largo de un eje y después todo lo posible en el otro.
No es la partición mínima posible (una L puede quedar en dos rectángulos en vez de
uno), pero nunca solapa rectángulos ni deja casillas sin cubrir, y la forma del
modelo no cambia: cada grupo de caras coplanares contiguas se sustituye por el
rectángulo que las contiene exactamente. Es la misma técnica estándar (greedy
meshing) usada por motores de vóxeles para la misma finalidad.

Detalles conservados del comportamiento anterior:

- Solo se exportan caras expuestas (`geometry.isExposed`) y vértices únicos.
- El bobinado de cada rectángulo replica el de la cara unidad que lo origina: el
  ciclo de esquinas se normaliza a la esquina de menor coordenada y se elige el
  recorrido directo o inverso según la cara (`faceCycle`), comprobado contra las
  seis direcciones de `SDD3D.cubeFaces`. Los visores que respeten el bobinado del
  OBJ ven las mismas orientaciones que antes.
- Las caras personalizadas (`state.faces`, las de puntos unidos a mano) no se
  fusionan: son quads arbitrarios, no de rejilla, y fusionarlas podría cambiar la
  forma. Se exportan como antes, descartando las que coincidan con caras ya
  exportadas.

### Decisión 20 · Huellas de caras por coordenadas en vez de por índices

La deduplicación anterior comparaba caras por la lista ordenada de **índices de
vértice**. Con la fusión eso ya no basta: una cara personalizada idéntica a una cara
unidad de 1×1 quedaría dentro de un rectángulo mayor y ninguna firma coincidiría, y
calcular las firmas unidad obligaba a crear todos los vértices unitarios, anulando
la reducción. Ahora la huella de una cara se calcula por las **coordenadas de sus
puntos** (`signatureOfPoints`, mismo esquema de claves que `model.addFace`), con lo
que la semántica de «misma cara» no cambia, no hace falta crear vértices para
comparar y una cara personalizada que coincida con una cara unidad fusionada sigue
descartándose (`unitFaceSignatures`). Efecto adicional alineado con la Spec: una
cara personalizada que coincida con un rectángulo fusionado completo también se
descarta ahora, antes se exportaría duplicada sobre las unidades.

### Decisión 21 · «Puntos» de la Spec

La Spec menciona «vértices, puntos y caras». La malla exportada (OBJ) solo lleva
vértices (`v`) y caras (`f`): no existe en ella un dato «puntos» separado. Los
«puntos» del modelo son los de unión de la rejilla (`app.getModelPoints`), que no
forman parte de la geometría exportada y que la compresión no modifica, como quedó
constatado en la Decisión 9. Se interpreta entonces que el exceso de «puntos» es el
mismo exceso de vértices de la malla, que es lo que esta decisión corrige.

### Decisión 22 · Comprobaciones realizadas

Sin ejecutar la aplicación ni ninguna prueba, y sin modificar ningún fichero de
Spec. Solo comprobación estática del código escrito:

- `node --check renderer/modules/export/obj.js`.
- Repaso manual de los seis recorridos de esquinas de `SDD3D.cubeFaces` contra los
  ciclos directo/inverso que genera `faceCycle` (coinciden todos) y de que un cubo
  suelto produce la misma malla que antes (8 vértices, 6 caras).

Efecto esperado de la mejora: un cubo suelto exporta lo mismo que antes (8 vértices,
6 caras); dos cubos pegados pasan de 6 vértices y 2 caras compartidas a 4 y 1 por
cara fusionada, y los bloques grandes reducen proporcionalmente más al fusionarse
filas y columnas enteras de caras coplanares.

### Decisión 23 · Verificación de la fusión y aviso de sesión antigua

Tras el informe del usuario de que los cubos juntos «no se fusionan» (tres cubos al
lado deberían contar como 1 en lugar de 3), se verificó la lógica real de los
módulos (`config.js`, `names.js`, `model.js`, `geometry.js`, `obj.js`) cargándolos
sobre un contexto aislado de Node, sin arrancar la aplicación ni tocar el DOM:

- Fila de 3 cubos: antes 24v/18f → comprimido 8v/6f (las mismas cifras que un cubo
  suelto, que es lo que pide el usuario).
- 2 cubos pegados: 16v/12f → 8v/6f. Placa 3×3: 72v/54f → 8v/6f. Bloque 3×3×3:
  216v/162f → 8v/6f.
- L de 3 cubos: 24v/18f → 14v/10f (dos rectángulos por cara, partición mínima para
  esa forma).
- Ninguna cara duplicada ni cara que no sea un quad; el cubo suelto da exactamente
  la misma malla que antes de la mejora.

El contador ya funde los bloques macizos al mínimo teórico (una caja siempre tiene
8 vértices y 6 caras, tenga los tamaño que tenga). Si en la aplicación se siguen
viendo las cifras de 3 cubos (24v/18f), no es la compresión: el renderer sigue con
el `obj.js` cargado antes de la mejora. Electron no recarga los scripts de un
renderer ya arrancado: hay que reiniciar la aplicación (o recargarla, `Cmd+R`) para
que la exportación use la fusión. Ocurre lo mismo con un `modelo.obj` descargado
antes de la mejora: el nuevo lleva la cabecera `# 8 vertices, 6 faces` para tres
cubos en fila.

Comprobación realizada sin ejecutar la aplicación ni ninguna prueba de la misma:
arnés temporal en un directorio externo al proyecto (no forma parte del
repositorio) que solo carga los módulos reales y llama a `buildExportMesh`.

## 0.0.3 · Pendientes del markdown 0.0.3.md (Estados: Activa)

Cuatro requisitos con Estado `Activa` en `SDD_specs/specs/0.0.3.md`. El quinto
(«Mejora de compresión de modelo») ya estaba implementado y no se ha tocado. No se
ha modificado ningún campo `- Estado: ...` ni `- Color: ...` de ningún documento de
Spec, y `0.0.3.md` tampoco se ha editado.

Convención de lectura seguida en todo el bloque: `- Color: ...` es un metadato
visual de la tarjeta de la Spec, no un requisito, y solo se ha tenido en cuenta el
markdown `0.0.3.md` para decidir qué estaba pendiente.

### Decisión 24 · Cara al unir varios puntos (Funcional)

La Spec pide calcular si la unión de puntos es capaz de formar una cara y, de ser
así, reflejarla en el modelo 3D.

Se ha añadido `renderer/modules/scene/topology.js`, que **deduce** las caras a
partir de las aristas ya existentes en lugar de guardarlas en el modelo. Motivo: el
modelo ya guarda las aristas de unión, y una cara deducida desaparece sola al
deshacer la unión, sin que el historial tenga que conocer un dato derivado ni
quedar desincronizado (el historial guarda fotogramas de `cubes`, `edges` y
`faces`).

Cómo se decide que hay cara:

1. Las aristas de unión se reparten por planos de rejilla. Un plano es un eje de
   rejilla visto en un sentido, y sus casillas son las caras unidad de cubo que
   miran en ese sentido (la misma regla de superficie visible que usan el dibujo y
   la exportación).
2. Las aristas dibujadas separan esas casillas en zonas. Una zona es una cara si
   queda cerrada por completo: al recorrerla no se puede salir de ella sin cruzar
   una arista dibujada.
3. La frontera tiene que ser un ciclo simple (cada esquina une exactamente dos
   lados) y convexo. Los contornos abiertos, las zonas que se escapan por el borde
   del modelo y los contornos no convexos se descartan en lugar de inventar una
   cara. Las esquinas que caen en mitad de un lado recto se quitan antes de
   comprobar la convexidad, para que un rectángulo de 2x1 dibujado a mano no se
   rechace por tener puntos intermedios en sus lados.

Las caras deducidas se dibujan con el mismo color y el mismo abanico de triángulos
que las caras creadas con cuatro puntos, así que «se reflejan en el modelo 3D» y
además salen en la exportación (`obj.js`), de modo que lo que se ve es lo que se
exporta.

Ambigüedades resueltas de forma conservadora:

- Las diagonales que crean los recorridos de teclado (esquina opuesta a esquina
  opuesta de una cara) no son el lado de ninguna casilla, así que no cuentan como
  contorno. Si no se filtraran, dos puntos unidos podrían cerrar una «cara»
  triangular que no existe sobre la rejilla.
- Una cara deducida que coincida con geometría que el modelo ya aporta (una cara de
  bloque, una cara creada con cuatro puntos o el rectángulo que la exportación
  fusiona) no se dibuja ni se exporta dos veces: sería la misma superficie repetida.
- La Spec dice «al unir varios puntos llegará un momento que entre los puntos se
  puede formar una cara». Se mantiene el comportamiento anterior de crear la cara al
  seleccionar cuatro puntos, y el cálculo nuevo actúa sobre lo que ya está unido. No
  se ha inventado ningún gesto ni botón adicional.

### Decisión 25 · Cubo entremedias (Funcional)

`keyboardPlace` calculaba la casilla de destino y llamaba a `addCube`, que avisaba
«Ese espacio ya está ocupado» y dejaba la selección donde estaba. Ahora, cuando la
casilla de destino ya tiene bloque, ese bloque pasa a ser el punto de partida y se
avisa con «Ese espacio ya está ocupado: bloque seleccionado».

Se ha respetado la distinción ya existente entre «colocar un bloque» (acción del
modelo, con entrada en el historial) y «elegir el bloque de partida» (un cursor: no
genera entrada de historial, ver Decisión 10). Por eso seleccionar el bloque que ya
estaba no se envuelve en `runAsOneChange`.

### Decisión 26 · Textura (Funcional)

Antes, `geometry.addQuad` daba a cada cara las coordenadas de textura fijas
`(0,0)…(1,1)`, de modo que el mapa completo se repetía en cada una de las caras de
cada bloque: la textura era, por construcción, «de cada cubo independiente».

Ahora las coordenadas de textura se calculan por la posición del vértice en la caja
que ocupa el modelo (`geometry.modelBounds`, `geometry.uvAxesOf`,
`geometry.worldUv`), proyectando sobre los dos ejes perpendiculares a la normal de
la cara. Interpretación conservadora adoptada, al ser la Spec de una sola frase: el
mapa de textura cubre el modelo entero, y añadir bloques estira la textura en vez de
volver a repetirla por bloque. Al ser una decisión de lectura, se deja constatada
aquí.

Efecto colateral esperado y aceptado: con un solo bloque la textura se ve igual que
antes (las UV de una cara unidad siguen yendo de 0 a 1), y en un modelo alargado cada
cara muestra la parte del mapa que le toca por su posición. La exportación OBJ no
lleva coordenadas de textura, así que el fichero exportado no cambia.

### Decisión 27 · Configuración (Funcional)

Se ha añadido `renderer/modules/settings.js`, más el puente
`preload.js`/`main.js` que hace la lectura y la escritura reales. La configuración se
guarda en un fichero JSON (`config.json`) en la carpeta de datos del usuario de
Electron (`app.getPath('userData')`).

Motivo de usar un fichero y no `localStorage`: el renderer se carga con `loadFile`
(`file://`) y el almacenamiento de un origen `file://` no es un sitio con garantías
para algo que la Spec pide que sobreviva al cierre; la carpeta de datos del usuario
sí lo es, y el renderer ya no puede escribir ficheros por su cuenta
(`contextIsolation: true`, `nodeIntegration: false`), así que la escritura la hace el
proceso principal por IPC. El puente expone solo `readConfig()` y `writeConfig(texto)`
con `ipcRenderer.sendSync`; si la aplicación se abre fuera de Electron el puente no
existe y la configuración simplemente no se guarda, sin romper el arranque.

Qué se guarda, y por qué:

- El control elegido (`Controles > Mouse` / `Controles > Teclado`), que es la opción
  de menú que la Spec nombra de forma explícita.
- Las opciones del menú «Ver»: líneas de cubos y puntos visibles.
- La cámara (giro, inclinación, distancia y centro) y el bloque de partida, que son
  el resto de la configuración que hoy se ajusta con la aplicación abierta.
- Las caras creadas al unir puntos, porque forman parte del modelo que el usuario ha
  construido y sin ellas la configuración volvería a medias.

Qué no se guarda, de forma conservadora:

- La textura pintada. La Spec dice «la configuración que se vaya especificando ...
  haciendo uso del menú superior»; el mapa de textura es contenido gráfico editable,
  no una opción, y guardarlo en el fichero de configuración supondría meter una
  imagen en base64 en un JSON pensado para ajustes. No se ha inventado ese formato.
- La selección de puntos en curso, que es un trazo a medias y no una configuración.
- Los bloques de la rejilla: la Spec habla de configuración, no de guardar el modelo.

El guardado se agrupa (400 ms) y se fuerza al cerrar la ventana (`beforeunload`), de
modo que no se escribe un fichero por cada tecla ni se pierde lo último al salir. Un
fichero ilegible, de otra versión o con valores inválidos no impide abrir la
aplicación: se descartan los ajustes que no sean válidos y se arranca con los valores
por defecto del resto. Como los bloques no se guardan, el bloque de partida solo se
recupera si sigue existiendo.

### Decisión 28 · Ficheros tocados y orden de carga

- Nuevos: `renderer/modules/scene/topology.js`, `renderer/modules/settings.js`.
- Modificados: `renderer/index.html` (los dos scripts nuevos), `renderer/app.js`
  (aplica la configuración guardada), `renderer/modules/scene/geometry.js`
  (coordenadas de textura y caja del modelo), `renderer/modules/scene/mesh.js` (caras
  deducidas y textura del modelo), `renderer/modules/scene/model.js` (huella, consulta
  y reemplazo de caras), `renderer/modules/export/obj.js` (caras deducidas en la
  exportación), `renderer/modules/input.js` (cubo entremedias y avisos de guardado),
  `renderer/modules/ui.js` (refresco de las opciones de vista y avisos de guardado),
  `preload.js` y `main.js` (puente del fichero de configuración).

`topology.js` se carga después de `geometry.js` y antes de `mesh.js`; `settings.js`
después de `ui.js` y antes de `input.js`, que ya lo usa desde sus eventos.

### Decisión 29 · Comprobaciones realizadas

Sin ejecutar la aplicación y sin ejecutar ninguna prueba, según lo pedido:

- `node --check` sobre los 22 ficheros JavaScript del proyecto (pasan todos).
- Repaso manual del recorrido de una cara unidad: con las cuatro aristas de la cara
  superior de un bloque, el plano produce una zona de una casilla, la frontera es un
  ciclo de cuatro esquinas, el área sale positiva y la normal es `(0, 1, 0)` en los
  ejes de la rejilla, que es la misma convención que las normales de `SDD3D.cubeFaces`.
- Repaso manual de los casos descartados: una sola arista, dos aristas en L y tres
  lados de un cuadrado dejan la zona incompleta y no producen cara.
- Repaso manual del abanico de triángulos: para cuatro puntos reproduce exactamente
  los triángulos `(0,1,2)` y `(0,2,3)` que había antes, y para más puntos usa el
  abanico desde la primera esquina, que es válido porque la cara solo se acepta si es
  convexa.
- Repaso manual de la textura: con un bloque las UV siguen siendo 0 y 1, así que el
  aspecto de un modelo de un solo bloque no cambia.
