// Namespace único compartido por los módulos del renderer. Se declara aquí porque
// config.js es el primer script que carga index.html.
window.SDD3D = window.SDD3D || {};

(() => {
  'use strict';

  const { SDD3D } = window;

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

  // La rejilla se dibuja semitransparente y con una extensión mayor que el plano lejano
  // de la cámara (100), de forma que su borde nunca entre en la vista y parezca infinita.
  SDD3D.GRID_ALPHA = 0.1;
  SDD3D.GRID_EXTENT = 160;
  // Las líneas del grid se desvanecen con la distancia a la cámara para que la
  // acumulación de líneas lejanas no forme una sombra sobre el suelo. El fundido
  // termina antes del plano lejano, así que tampoco se ve un borde de rejilla.
  SDD3D.GRID_FADE_START = 5;
  SDD3D.GRID_FADE_END = 90;
  SDD3D.CAMERA_FAR = 100;
  // Giro de cámara por píxel arrastrado. Bajo a propósito: un arrastre lento y controlable.
  SDD3D.ORBIT_SENSITIVITY = 0.004;
  // Píxeles de arrastre necesarios para distinguir un arrastre de un click.
  SDD3D.CLICK_THRESHOLD = 3;

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
})();
