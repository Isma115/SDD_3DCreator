// La rejilla no se compone de líneas sueltas: son tres planos translúcidos —el suelo
// y los dos planos de los ejes— y el patrón de líneas lo calcula el sombreador de
// fragmentos. Al no haber líneas que se solapen, cada píxel recibe como mucho un trazo
// por plano y la acumulación de líneas lejanas ya no puede formar la sombra que
// aparecía con la rejilla de líneas. El patrón se calcula con coordenadas de mundo, de
// modo que las líneas siguen ancladas a la rejilla aunque cada plano se centre en la
// cámara para cubrir siempre la zona visible.
(() => {
  'use strict';

  const { SDD3D } = window;

  const X_AXIS = [1, 0, 0];
  const Y_AXIS = [0, 1, 0];
  const Z_AXIS = [0, 0, 1];

  // El suelo va un poco por debajo de 0 para no competir con la cara inferior de los
  // bloques de la capa 0, que es el mismo plano.
  const FLOOR_OFFSET = -0.003;

  // Vértices de un quad en triángulo-strip: el centro desplazado media anchura en las
  // dos direcciones del plano. El radio es el del fundido de la rejilla (90), así que
  // el borde del quad cae siempre donde las líneas ya se han desvanecido y no se ve
  // dónde termina el plano.
  function buildQuad(center, firstAxis, secondAxis) {
    const half = SDD3D.GRID_FADE_END;
    const vertices = [];
    for (const [first, second] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      vertices.push(
        center.x + (firstAxis[0] * first + secondAxis[0] * second) * half,
        center.y + (firstAxis[1] * first + secondAxis[1] * second) * half,
        center.z + (firstAxis[2] * first + secondAxis[2] * second) * half
      );
    }
    return vertices;
  }

  // Planos de la rejilla, centrados en la cámara para que siempre cubran lo que se ve:
  // el suelo en xz (índice 0) y los planos de los ejes z = 0 (índice 1) y x = 0
  // (índice 2). El índice es el que usa el sombreador para elegir qué dos coordenadas
  // del mundo forman el patrón de cada plano.
  function buildPlanes(eye) {
    return [
      {
        index: 0,
        vertices: buildQuad({ x: eye.x, y: FLOOR_OFFSET, z: eye.z }, X_AXIS, Z_AXIS)
      },
      {
        index: 1,
        vertices: buildQuad({ x: eye.x, y: eye.y, z: 0 }, X_AXIS, Y_AXIS)
      },
      {
        index: 2,
        vertices: buildQuad({ x: 0, y: eye.y, z: eye.z }, Z_AXIS, Y_AXIS)
      }
    ];
  }

  // Expone el constructor de planos que consume el bucle de renderizado.
  SDD3D.grid = { buildPlanes };
})();
