# Specs completas

## Versión 0.0.0

## Tecnología
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Implementar aplicación Electron y poder ejecutarla con npm run dev

## Que se va a ver dentro
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Los modelos 3D se van a poder crear y editar en un espacio 3D

## Controles
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Van a existir controles de teclado y ratón

Con WASD se podrá colocar un bloque según la dirección de la cámara el bloque se colocará a derecha, izquierda, arriba, abajo, etc

W: arriba
A: izquierda
S: abajo
D: derecha

Con los controles de ratón, si pulso click derecho en una cara de un cubo, se colocará un cubo justo pegado a esa cara, si pulso click izquierdo apuntando con el puntero sobre un bloque, este se eliminará

## Botón para ver puntos de unión
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Se van a poder unir dos puntos:

Haciendo doble click se selecciona un punto y se va a pedir que se haga doble click sobre otro punto.

Haciendo doble click sobre el segundo punto, ambos se unirán con una línea imaginaría

Uniendo 4 puntos se formará una cara

## Grid 3D
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Todo estará formado por un Grid 3D, se pueden colocar bloques nuevos, unir puntos para formar rampas u formas más complejas, etc

## Exportación
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Al momento de Exportar el modelo 3D se va a llamar a un algoritmo que lo que haga sea fusionar todo el modelo 3D sin cambiar su forma, pero de tal forma que se eliminen vértices sobrantes, puntos que no se vean, caras que tampoco se vean, etc, todo esto producto de juntar bloque con bloque entre si

## Elegir un control
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Va a existir un menú superior

Uno de esos menús será "Controles"

Controles > Mouse (cambiará a control de mouse)
Controles > Teclado (cambiará a modo de control de teclado)

## Información sobre el control de teclado
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Si el control de teclado está seleccionado, al hacer click sobre un cubo, el siguiente cubo que aparecerá al pulsar una de las teclas WASD partirá desde ese botón seleccionado

## Textos indicativos y UI
- Estado: Implementada
- Categoría: Diseño
- Color: Amarillo

Van a haber pocos textos indicativos en la interfaz de la aplicación

El diseño visual será lo más simplificado posible

## Texturizado
- Estado: Implementada
- Categoría: Funcional
- Color: Cian

Menú nuevo "Textura" al pulsarlo se abrirán controles para pintar sobre el modelo 3D desde su vista de textura en 2D (mapa de textura, ventana emergente en la que poder pintar) o bien pintando sobre ella o bien importando texturas y pegándolas ahí

## Versión 0.0.1

## Amplia el grid 3D
- Estado: Implementada
- Categoría: Diseño

Amplia la rejilla 3D para que parezca infinita, que sea mucho más sutil que no se note tanto las líneas, una opacidad casi 0

## Mover cámara arrastrando click izquierdo
- Estado: Implementada
- Categoría: Funcional

En lugar de con el botón central, que se utilice el click izquierdo para arrastrar

## Ventana completa
- Estado: Implementada
- Categoría: Funcional

Que se ejecute la aplicación en modo ventana pero que ocupe todo el espacio disponible

## Sin cubos
- Estado: Implementada
- Categoría: Funcional

Si no hay cubos desde los que partir, entonces si se pulsa WASD aparecerá un cubo en el centro, del que se podrá partir

## Control por defecto
- Estado: Implementada
- Categoría: Funcional

Por defecto el control será de mouse

## Líneas en los cubos
- Estado: Implementada
- Categoría: Diseño
- Color: Amarillo

Se tiene que poder ver las líneas limitantes entre cubos, Opción configurable en un nuevo Menú "Ver"

## Sombra en el Grid
- Estado: Implementada
- Categoría: Diseño

Debido a que el grid visual del entorno 3D es infinito, se ve una sombra debido a la acumulación de líneas a lo lejos, molesta a la vista que se vea así

## Fix: unión de puntos
- Estado: Implementada
- Categoría: Fix
- Color: Rojo

Al terminar de unir dos puntos, se tienen que deseleccionar ambos

Agrega también un botón en el menú superior que solo aparezca al haber seleccionado un punto que sea "Deseleccionar puntos"

## Divisón de responsabilidades de código
- Estado: Implementada
- Categoría: Rendimiento

Divide el código en responsabilidades para que la lógica no dependan de unos pocos ficheros, sino que el código esté bien organizado

## Versión 0.0.2

## Mini cubos visuales
- Estado: Implementada
- Categoría: Diseño

En los cubos aparece como una rejilla de minicubos que no quiero que aparezca, los cubos deben verse lisos, pero parece solo ser un error visual

## Cubo de partida
- Estado: Implementada
- Categoría: Funcional

Haciendo uso de los controles de teclado el cubo de partida debe cambiar dinámicamente, ya que si señalo un cubo y pulso en "A" ya no puedo seguir añadiendo cubos, ya que el cubo de punto de partida no ha cambiado

## Controles Ctrl+z y Ctrl+y
- Estado: Implementada
- Categoría: Funcional

Crea controles Ctrl+z y Ctrl+y para Deshacer y Rehacer

## Aviso de exportar
- Estado: Implementada
- Categoría: Funcional

Al momento de Exportar el modelo 3D debe aparecer una ventana informativa que indique la cantidad nueva de vértices, caras, puntos, etc resultantes de haber realizado la compresión

## Versión 0.0.3

## Mejora de compresión de modelo
- Estado: Implementada
- Categoría: Funcional

Al tratar de exportar el modelo, aún así tiene más vértices, puntos y caras de los necesarios, trata de darle solución a esto

## Cara al unir varios puntos
- Estado: Activa
- Categoría: Funcional

Al unir varios puntos llegará un momento que entre los puntos se puede formar una cara, tiene que calcularse si la unión de puntos sería capaz de formar una cara, y de ser así que se refleje la cara en el modelo 3D

## Cubo entremedias
- Estado: Activa
- Categoría: Funcional

Usando los controles de teclado, si quiero colocar un cubo dónde ya hay un cubo, no se va a colocar uno nuevo sino que se va a seleccionar ese cubo que hay en medio para así poder continuar añadiendo cubos desde ahí

## Textura
- Estado: Activa
- Categoría: Funcional

La textura que se pinta debe aplicarse a todo el modelo en general, no a cada cubo independiente

## Configuración
- Estado: Activa
- Categoría: Funcional

La configuración que se vaya especificando en la aplicación haciendo uso del menú superior debe irse guardandose y cargandose cada vez que se vuelva a ejecutar la aplicación
