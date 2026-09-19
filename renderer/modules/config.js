// #region Namespace compartido
// Todos los módulos del renderer colaboran a través de este único objeto global,
// creado antes de cargar cualquier dependencia.
window.SDD3D = window.SDD3D || {};
// #endregion Namespace compartido

(() => {
  'use strict';

  const { SDD3D } = window;

  // #region Configuración visual y de interacción
  // Reúne colores, límites de cámara y umbrales comunes para que el comportamiento
  // de la interfaz y del renderizado se pueda ajustar desde un solo lugar.
  SDD3D.COLORS = {
    cube: [0.31, 0.72, 0.68],
    selected: [0.96, 0.73, 0.31],
    customFace: [0.94, 0.51, 0.25],
    cubeLine: [0.62, 0.68, 0.74],
    edge: [0.98, 0.78, 0.31],
    point: [0.98, 0.88, 0.46],
    pointSelected: [1.0, 0.42, 0.26],
    grid: [0.18, 0.22, 0.27],
    gridAxis: [0.27, 0.35, 0.4]
  };

  // La rejilla se dibuja semitransparente («una opacidad casi 0»), repartida en tres
  // planos translúcidos cuyo patrón de líneas calcula el sombreador de fragmentos.
  // Al no ser líneas sueltas, cada píxel recibe como mucho un trazo por plano y la
  // acumulación de líneas lejanas no puede formar una sombra.
  SDD3D.GRID_ALPHA = 0.1;
  // Separación del patrón, en unidades de rejilla: la rejilla fina y la gruesa que la
  // sustituye cuando la fina se junta tanto en pantalla que ya no se distingue.
  SDD3D.GRID_MINOR_STEP = 1;
  SDD3D.GRID_MAJOR_STEP = 10;
  // Hasta esta distancia de la cámara las líneas se ven enteras; a partir de ahí se
  // desvanecen hasta desaparecer. El fundido termina antes del plano lejano (100), así
  // que tampoco se ve un borde de rejilla, y es también el radio con el que los planos
  // se centran en la cámara para que la rejilla parezca infinita.
  SDD3D.GRID_FADE_START = 5;
  SDD3D.GRID_FADE_END = 90;
  SDD3D.CAMERA_FAR = 100;
  // Campo de visión vertical de la proyección, en radianes. Lo usan la matriz de
  // proyección y el desplazamiento de cámara (para que el modelo siga al puntero).
  SDD3D.CAMERA_FOV = Math.PI / 3;
  // Giro de cámara por píxel arrastrado. Bajo a propósito: un arrastre lento y controlable.
  SDD3D.ORBIT_SENSITIVITY = 0.004;
  // Desplazamiento de cámara por píxel arrastrado, como múltiplo del desplazamiento
  // exacto: con 1 el modelo sigue al puntero píxel a píxel, a cualquier distancia.
  SDD3D.PAN_SENSITIVITY = 1;
  // Píxeles de arrastre necesarios para distinguir un arrastre de un click. Se
  // deja margen al temblor natural del ratón al pulsar: con 3 px, un click con algo
  // de movimiento se interpretaba como arrastre y no quitaba ni colocaba nada.
  SDD3D.CLICK_THRESHOLD = 6;
  // Margen con el que un click sobre un punto de unión deja pasar un posible doble
  // click antes de actuar: un click en modo Mouse borra y un doble click elige punto,
  // así que solo ese click espera, para no borrar el bloque de debajo del punto. El
  // resto de clicks se aplican al momento.
  SDD3D.DOUBLE_CLICK_GUARD_MS = 220;
  // #endregion Configuración visual y de interacción

  // #region Geometría base del cubo
  // Define las caras, esquinas y aristas del cubo unidad que reutilizan la malla,
  // la selección y el cálculo de superficies visibles.
  // Caras del cubo unidad: normales y esquinas en orden antihorario visto desde fuera.
  SDD3D.cubeFaces = [
    {
      normal: [1, 0, 0],
      corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    },
    {
      normal: [-1, 0, 0],
      corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
    },
    {
      normal: [0, 1, 0],
      corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
    },
    {
      normal: [0, -1, 0],
      corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
    },
    {
      normal: [0, 0, 1],
      corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
    },
    {
      normal: [0, 0, -1],
      corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
    }
  ];

  // Esquinas y aristas de un cubo unidad: se usan para las líneas limitantes
  // entre cubos y para el contorno del bloque seleccionado.
  SDD3D.CUBE_CORNERS = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
  ];

  SDD3D.CUBE_EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  // #endregion Geometría base del cubo
})();
