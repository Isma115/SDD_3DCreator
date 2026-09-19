// Primitivas de geometría compartidas por todos los constructores de buffers:
// composición de vértices de malla, de líneas y consulta de caras y aristas que
// forman parte de la superficie visible del modelo.
(() => {
  'use strict';

  const { SDD3D } = window;

  function isExposed(cube, normal) {
    return !SDD3D.app.state.cubes.has(SDD3D.names.keyOf({
      x: cube.x + normal[0],
      y: cube.y + normal[1],
      z: cube.z + normal[2]
    }));
  }

  // Aristas de la rejilla que forman parte de la superficie visible del modelo.
  //
  // Una arista de la rejilla es la esquina de cuatro casillas a la vez (en 2D, la
  // esquina de cuatro cuadrados). Si las cuatro están ocupadas, la arista queda
  // dentro del modelo y no debe trazarse: es la rejilla interior que se veía sobre
  // las caras. Si falta alguna de las cuatro, la arista es un borde real y se
  // traza. Al ser un conjunto de aristas de rejilla, las aristas compartidas por
  // varios cubos se cuentan una sola vez.
  //
  // Las cuatro casillas que rodean la arista son el bloque 2x2 que crece hacia los
  // dos ejes perpendiculares desde la esquina de MAYOR coordenada de la arista.
  // Ese punto es fijo para la arista, mientras que el punto de arranque depende de
  // en qué sentido la recorra el cubo que la mira: mirar desde el arranque dejaba
  // sin ocultar las aristas interiores que se recorrían desde su esquina menor (en
  // un bloque 3x3x3 solo se ocultaban 5 de las 12 aristas interiores), y esas líneas
  // volvían a dibujarse sobre las caras lisas.
  const GRID_AXES = ['x', 'y', 'z'];

  function exposedCubeEdges() {
    const cubes = SDD3D.app.state.cubes;
    const edges = new Map();
    for (const cube of cubes.values()) {
      for (const [first, second] of SDD3D.CUBE_EDGES) {
        const start = SDD3D.CUBE_CORNERS[first];
        const end = SDD3D.CUBE_CORNERS[second];
        const startPoint = { x: cube.x + start[0], y: cube.y + start[1], z: cube.z + start[2] };
        const endPoint = { x: cube.x + end[0], y: cube.y + end[1], z: cube.z + end[2] };
        // La arista va en el eje en el que sus dos esquinas coinciden; los otros
        // dos ejes son las direcciones en las que hay que mirar las cuatro casillas.
        const along = GRID_AXES.find((axis) => startPoint[axis] === endPoint[axis]);
        const around = GRID_AXES.filter((axis) => axis !== along);
        const base = {
          x: Math.max(startPoint.x, endPoint.x),
          y: Math.max(startPoint.y, endPoint.y),
          z: Math.max(startPoint.z, endPoint.z)
        };
        let surrounded = true;
        for (const firstOffset of [-1, 0]) {
          for (const secondOffset of [-1, 0]) {
            const neighbor = { x: base.x, y: base.y, z: base.z };
            neighbor[around[0]] = base[around[0]] + firstOffset;
            neighbor[around[1]] = base[around[1]] + secondOffset;
            if (!cubes.has(SDD3D.names.keyOf(neighbor))) surrounded = false;
          }
        }
        if (surrounded) continue;
        // La clave lleva los dos extremos ordenados: varias aristas comparten
        // esquina y la misma arista puede recorrerse en los dos sentidos según el
        // cubo que la mire, así que solo los dos extremos la identifican.
        const key = SDD3D.names.edgeKeyOf(startPoint, endPoint);
        if (edges.has(key)) continue;
        edges.set(key, [startPoint, endPoint]);
      }
    }
    return [...edges.values()];
  }

  function addMeshVertex(target, position, normal, color, uv) {
    target.push(
      position[0], position[1], position[2],
      normal[0], normal[1], normal[2],
      color[0], color[1], color[2],
      uv[0], uv[1]
    );
  }

  function addQuad(target, points, normal, color) {
    const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
    const triangles = [[0, 1, 2], [0, 2, 3]];
    for (const triangle of triangles) {
      for (const index of triangle) addMeshVertex(target, points[index], normal, color, uvs[index]);
    }
  }

  function addLine(target, first, second, color) {
    target.push(first[0], first[1], first[2], color[0], color[1], color[2]);
    target.push(second[0], second[1], second[2], color[0], color[1], color[2]);
  }

  SDD3D.geometry = { isExposed, exposedCubeEdges, addMeshVertex, addQuad, addLine };
})();
